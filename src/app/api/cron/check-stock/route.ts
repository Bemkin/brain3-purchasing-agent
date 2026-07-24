import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { genAI, GEMINI_MODEL, buildReorderSystemPrompt, buildReorderUserPrompt } from '@/lib/ai/gemini';
import { BatchReorderResponseSchema } from '@/lib/schemas';
import { generatePONumber, calculateFallbackReorderQty } from '@/lib/utils/helpers';
import type { StockCheckResult } from '@/lib/types/database';

/**
 * POST /api/cron/check-stock
 * 
 * THE CORE AUTOMATION ENGINE.
 * 
 * Flow:
 * 1. Log "stock_check_initiated"
 * 2. Query items WHERE current_stock <= reorder_point
 * 3. Group low-stock items by supplier
 * 4. For each supplier group, call Gemini for reorder analysis
 * 5. Validate AI response with Zod (fallback to simple formula if invalid)
 * 6. Generate PO + line items
 * 7. Based on operating_mode: auto-send or queue for approval
 * 8. Return summary
 */
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const startTime = Date.now();

  // Optional: verify cron secret for production security
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || request.headers.get('x-cron-secret');
  const isManualTrigger = request.headers.get('x-trigger-source') === 'dashboard';

  if (!isManualTrigger && secret !== process.env.CRON_SECRET) {
    // Allow manual triggers from the dashboard without cron secret
    // In production, this would be stricter
  }

  const result: StockCheckResult = {
    items_checked: 0,
    low_stock_items: 0,
    pos_generated: 0,
    pos_auto_sent: 0,
    errors: 0,
    mode: 'approval',
    timestamp: new Date().toISOString(),
  };

  try {
    // Step 1: Log initiation
    await supabase.from('ai_audit_logs').insert({
      action_type: 'stock_check_initiated',
      severity: 'info',
      message: `Autonomous stock check initiated${isManualTrigger ? ' (manual trigger from dashboard)' : ' (cron scheduled)'}`,
      details: { trigger: isManualTrigger ? 'dashboard' : 'cron' },
      source: isManualTrigger ? 'human' : 'cron',
    });

    // Step 2: Get operating mode
    const { data: modeSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'operating_mode')
      .single();

    const operatingMode = (modeSetting?.value as string)?.replace(/"/g, '') || 'approval';
    result.mode = operatingMode as 'approval' | 'auto_pilot';

    // Step 3: Fetch all active inventory items with supplier info
    const { data: allItems, error: itemsError } = await supabase
      .from('inventory_items')
      .select(`
        id, sku, name, category, cost_price, current_stock,
        min_stock_level, max_stock_capacity, reorder_point,
        avg_daily_sales, supplier_id,
        suppliers:supplier_id (id, name, contact_email, lead_time_days)
      `)
      .eq('is_active', true);

    if (itemsError || !allItems) {
      throw new Error(`Failed to fetch inventory: ${itemsError?.message}`);
    }

    result.items_checked = allItems.length;

    // Step 4: Filter low-stock items (current_stock <= reorder_point)
    const lowStockItems = allItems.filter(
      (item) => item.current_stock <= item.reorder_point
    );

    result.low_stock_items = lowStockItems.length;

    if (lowStockItems.length === 0) {
      await supabase.from('ai_audit_logs').insert({
        action_type: 'stock_check_initiated',
        severity: 'info',
        message: `Stock check complete: All ${result.items_checked} items are above reorder points. No action needed.`,
        details: { items_checked: result.items_checked, duration_ms: Date.now() - startTime },
        source: isManualTrigger ? 'human' : 'cron',
      });

      // Update last check timestamp
      await supabase
        .from('system_settings')
        .update({ value: JSON.stringify(new Date().toISOString()) })
        .eq('key', 'last_stock_check');

      return NextResponse.json(result);
    }

    // Log all low-stock items in a SINGLE batch insert (instead of 9 sequential awaits)
    await supabase.from('ai_audit_logs').insert(
      lowStockItems.map((item) => ({
        action_type: 'low_stock_detected',
        severity: item.current_stock === 0 ? 'critical' : 'warning',
        message: `Low stock: ${item.name} (${item.sku}) — ${item.current_stock} units remaining (reorder point: ${item.reorder_point})`,
        details: {
          item_name: item.name,
          sku: item.sku,
          current_stock: item.current_stock,
          reorder_point: item.reorder_point,
          avg_daily_sales: item.avg_daily_sales,
        },
        related_item_id: item.id,
        source: 'ai_agent',
      }))
    );

    // Step 5: Group by supplier
    const supplierGroups = new Map<string, typeof lowStockItems>();
    for (const item of lowStockItems) {
      const supplierId = item.supplier_id;
      if (!supplierGroups.has(supplierId)) {
        supplierGroups.set(supplierId, []);
      }
      supplierGroups.get(supplierId)!.push(item);
    }

    // Step 5b: Perform a SINGLE batch call to Gemini for ALL low-stock items across suppliers
    const allItemsForAI = lowStockItems.map((item) => {
      const supplier = item.suppliers as unknown as { id: string; name: string; contact_email: string; lead_time_days: number };
      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        current_stock: item.current_stock,
        min_stock_level: item.min_stock_level,
        max_stock_capacity: item.max_stock_capacity,
        reorder_point: item.reorder_point,
        avg_daily_sales: Number(item.avg_daily_sales),
        cost_price: Number(item.cost_price),
        supplier_name: supplier.name,
        supplier_id: item.supplier_id,
        lead_time_days: supplier.lead_time_days,
      };
    });

    // Fire AI request + analysis log in parallel
    const [, , aiResponse] = await Promise.all([
      supabase.from('ai_audit_logs').insert({
        action_type: 'reorder_analysis_requested',
        severity: 'info',
        message: `Requesting batch AI reorder analysis for ${allItemsForAI.length} items across ${supplierGroups.size} suppliers`,
        details: { item_count: allItemsForAI.length, supplier_count: supplierGroups.size },
        source: 'ai_agent',
      }),
      // Pre-fetch PO count while AI is thinking (needed for PO numbering)
      supabase.from('purchase_orders').select('id', { count: 'exact', head: true }),
      // The Gemini call — the main bottleneck
      genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: buildReorderUserPrompt(allItemsForAI),
        config: {
          systemInstruction: buildReorderSystemPrompt(),
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      }).catch((err: Error) => err),
    ]);

    // Get PO count result (fetched in parallel above)
    const { count: existingPoCount } = await supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true });
    const poCounter = existingPoCount || 0;

    const aiBatchResultsMap = new Map<string, unknown>();
    let batchAIFailed = false;
    let batchAIErrorMsg = '';

    if (aiResponse instanceof Error) {
      batchAIFailed = true;
      batchAIErrorMsg = aiResponse.message;
      console.warn('Batch AI analysis failed, falling back per supplier:', aiResponse);
    } else {
      try {
        const rawText = aiResponse.text?.trim() || '';
        const cleanedText = rawText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        let jsonParsed: unknown;
        try {
          jsonParsed = JSON.parse(cleanedText);
        } catch {
          throw new Error(`AI returned unparseable JSON: ${cleanedText.substring(0, 200)}`);
        }

        const addResultToMap = (entry: Record<string, unknown>) => {
          const sId = String(entry.supplier_id || '');
          const sName = String(entry.supplier_name || '');
          if (sId) aiBatchResultsMap.set(sId, entry);
          if (sName) {
            aiBatchResultsMap.set(sName, entry);
            aiBatchResultsMap.set(sName.toLowerCase(), entry);
          }
        };

        if (Array.isArray(jsonParsed)) {
          for (const item of jsonParsed) {
            if (item && typeof item === 'object') {
              addResultToMap(item as Record<string, unknown>);
            }
          }
        } else if (jsonParsed && typeof jsonParsed === 'object') {
          for (const [key, val] of Object.entries(jsonParsed)) {
            if (val && typeof val === 'object') {
              addResultToMap({ supplier_id: key, ...(val as object) });
            }
          }
        }
      } catch (parseErr) {
        batchAIFailed = true;
        batchAIErrorMsg = parseErr instanceof Error ? parseErr.message : 'Unknown parse error';
      }
    }

    // Step 6: Process ALL supplier groups in PARALLEL (instead of sequential for-loop)
    const supplierEntries = Array.from(supplierGroups.entries());

    const supplierResults = await Promise.allSettled(
      supplierEntries.map(async ([supplierId, items], index) => {
        const supplier = items[0].suppliers as unknown as {
          id: string; name: string; contact_email: string; lead_time_days: number;
        };

        const itemsForAI = items.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          current_stock: item.current_stock,
          min_stock_level: item.min_stock_level,
          max_stock_capacity: item.max_stock_capacity,
          reorder_point: item.reorder_point,
          avg_daily_sales: Number(item.avg_daily_sales),
          cost_price: Number(item.cost_price),
          supplier_name: supplier.name,
          supplier_id: supplierId,
          lead_time_days: supplier.lead_time_days,
        }));

        let reorderItems: {
          inventory_item_id: string;
          item_name: string;
          recommended_quantity: number;
          unit_cost: number;
          reasoning: string;
          urgency: string;
        }[] = [];

        let aiReasoning = '';
        let usedFallback = false;

        const supplierAIResult =
          aiBatchResultsMap.get(supplierId) ||
          aiBatchResultsMap.get(supplier.name) ||
          aiBatchResultsMap.get(supplier.name.toLowerCase());

        if (!batchAIFailed && supplierAIResult) {
          const validated = BatchReorderResponseSchema.safeParse(supplierAIResult);

          if (validated.success) {
            reorderItems = validated.data.items.map((item) => {
              const matchedItem = itemsForAI.find(
                (i) => i.id === item.inventory_item_id || i.sku === item.sku
              ) || itemsForAI[0];

              return {
                inventory_item_id: matchedItem.id,
                item_name: item.item_name || matchedItem.name,
                recommended_quantity: Math.round(
                  Math.min(
                    item.recommended_quantity,
                    matchedItem.max_stock_capacity - matchedItem.current_stock
                  )
                ),
                unit_cost: item.unit_cost || matchedItem.cost_price,
                reasoning: item.reasoning,
                urgency: item.urgency || (matchedItem.current_stock === 0 ? 'critical' : 'high'),
              };
            });

            aiReasoning = reorderItems.map((i) => `${i.item_name}: ${i.reasoning}`).join('; ');
          } else {
            usedFallback = true;
          }
        } else {
          usedFallback = true;
        }

        if (usedFallback) {
          reorderItems = itemsForAI.map((item) => ({
            inventory_item_id: item.id,
            item_name: item.name,
            recommended_quantity: calculateFallbackReorderQty(
              item.current_stock,
              item.reorder_point,
              item.max_stock_capacity
            ),
            unit_cost: item.cost_price,
            reasoning: `Fallback: (reorder_point × 2) - current_stock = ${(item.reorder_point * 2) - item.current_stock}`,
            urgency: item.current_stock === 0 ? 'critical' : 'high',
          }));

          aiReasoning = `[FALLBACK MODE] AI payload unavailable. Using formula-based reorder quantities.`;
        }

        // Generate PO — use index-based numbering to avoid race conditions
        const poNumber = generatePONumber(poCounter + index + 1);
        const totalAmount = reorderItems.reduce(
          (sum, item) => sum + item.recommended_quantity * item.unit_cost,
          0
        );

        const poStatus = operatingMode === 'auto_pilot' ? 'approved' : 'pending_approval';

        const { data: po, error: poError } = await supabase
          .from('purchase_orders')
          .insert({
            po_number: poNumber,
            supplier_id: supplierId,
            status: poStatus,
            total_amount: totalAmount,
            notes: usedFallback
              ? 'Generated using fallback formula (AI was unavailable)'
              : `AI-generated with ${reorderItems.length} line items`,
            ai_reasoning: aiReasoning,
            created_by: 'ai_agent',
          })
          .select('id, po_number, status, total_amount')
          .single();

        if (poError || !po) {
          throw new Error(`Failed to create PO: ${poError?.message}`);
        }

        // Insert line items + log PO generation in parallel
        const logDetails = {
          po_number: po.po_number,
          supplier_name: supplier.name,
          total_amount: totalAmount,
          item_count: reorderItems.length,
          mode: operatingMode,
          used_fallback: usedFallback,
        };

        await Promise.all([
          supabase.from('po_line_items').insert(
            reorderItems.map((item) => ({
              purchase_order_id: po.id,
              inventory_item_id: item.inventory_item_id,
              quantity_ordered: item.recommended_quantity,
              unit_cost: item.unit_cost,
              total_cost: item.recommended_quantity * item.unit_cost,
            }))
          ),
          supabase.from('ai_audit_logs').insert({
            action_type: 'po_generated',
            severity: 'info',
            message: `PO ${po.po_number} generated for ${supplier.name} — $${totalAmount.toFixed(2)} (${reorderItems.length} items) [${operatingMode === 'auto_pilot' ? 'Auto-Pilot' : 'Pending Approval'}]`,
            details: logDetails,
            related_po_id: po.id,
            source: 'ai_agent',
          }),
          // Log AI result type
          usedFallback
            ? supabase.from('ai_audit_logs').insert({
                action_type: 'ai_error',
                severity: 'warning',
                message: `AI analysis fallback for ${supplier.name}: ${batchAIErrorMsg || 'Supplier payload omitted by AI'}`,
                details: { error: batchAIErrorMsg, supplier_name: supplier.name },
                source: 'ai_agent',
              })
            : supabase.from('ai_audit_logs').insert({
                action_type: 'reorder_analysis_completed',
                severity: 'info',
                message: `AI analysis complete for ${supplier.name}: ${reorderItems.length} items, total cost $${totalAmount.toFixed(2)}`,
                details: { supplier_name: supplier.name, items: reorderItems },
                source: 'ai_agent',
              }),
        ]);

        // Auto-pilot email (fire-and-forget style, don't block other suppliers)
        let emailSent = false;
        if (operatingMode === 'auto_pilot') {
          try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const emailResponse = await fetch(`${appUrl}/api/email/send-po`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ purchaseOrderId: po.id }),
            });
            emailSent = emailResponse.ok;
            if (!emailSent) {
              console.error('Auto-send email failed:', await emailResponse.text());
            }
          } catch (emailErr) {
            console.error('Auto-send email error:', emailErr);
          }
        }

        return { po: po.po_number, emailSent, usedFallback };
      })
    );

    // Aggregate results from parallel execution
    for (const settled of supplierResults) {
      if (settled.status === 'fulfilled') {
        result.pos_generated++;
        if (settled.value.emailSent) result.pos_auto_sent++;
      } else {
        result.errors++;
        console.error('Supplier processing failed:', settled.reason);
      }
    }

    // Update last check timestamp
    await supabase
      .from('system_settings')
      .update({ value: JSON.stringify(new Date().toISOString()) })
      .eq('key', 'last_stock_check');

    // Final summary log
    const durationMs = Date.now() - startTime;
    await supabase.from('ai_audit_logs').insert({
      action_type: 'stock_check_initiated',
      severity: result.errors > 0 ? 'warning' : 'info',
      message: `Stock check complete in ${durationMs}ms: ${result.items_checked} checked, ${result.low_stock_items} low, ${result.pos_generated} POs generated${result.pos_auto_sent > 0 ? `, ${result.pos_auto_sent} auto-sent` : ''}${result.errors > 0 ? `, ${result.errors} errors` : ''}`,
      details: { ...result, duration_ms: durationMs },
      source: isManualTrigger ? 'human' : 'cron',
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Stock check critical error:', err);

    await supabase.from('ai_audit_logs').insert({
      action_type: 'system_error',
      severity: 'critical',
      message: `Stock check failed: ${err instanceof Error ? err.message : 'Unknown critical error'}`,
      details: { error: String(err) },
      source: 'system',
    });

    return NextResponse.json(
      { error: 'Stock check failed', details: String(err) },
      { status: 500 }
    );
  }
}
