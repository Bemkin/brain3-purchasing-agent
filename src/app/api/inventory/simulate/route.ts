import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SimulateInventorySchema } from '@/lib/schemas';

/**
 * POST /api/inventory/simulate
 * Endpoint to simulate sales surge or reset inventory stock for demo video recording
 */
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  try {
    const body = await request.json();
    const parsed = SimulateInventorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid action', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action } = parsed.data;

    if (action === 'simulate_surge') {
      // Fetch all items to randomize selection
      const { data: allItems, error } = await supabase
        .from('inventory_items')
        .select('id, name, sku, reorder_point, min_stock_level')
        .eq('is_active', true);

      if (error || !allItems || allItems.length === 0) {
        return NextResponse.json({ error: 'No items found' }, { status: 404 });
      }

      // Shuffle array randomly (Fisher-Yates)
      const shuffled = [...allItems].sort(() => 0.5 - Math.random());

      // Pick a random count between 3 and 6 items
      const targetCount = Math.floor(Math.random() * 4) + 3; // 3, 4, 5, or 6
      const selectedItems = shuffled.slice(0, Math.min(targetCount, shuffled.length));

      // Update selected items in parallel with randomized low stock levels
      const updatePromises = selectedItems.map((item) => {
        // Random stock between 0 and 30% of reorder point (some hit 0 stockout!)
        const newStock = Math.random() < 0.25 
          ? 0 
          : Math.floor(Math.random() * (item.reorder_point * 0.35));

        return supabase
          .from('inventory_items')
          .update({ current_stock: newStock })
          .eq('id', item.id);
      });

      const results = await Promise.all(updatePromises);
      const updateError = results.find((r) => r.error);
      if (updateError) {
        console.error('Surge simulation partial update error:', updateError.error?.message);
      }

      // Audit log
      const itemSummaries = selectedItems.map((i) => `${i.name} (${i.sku})`);
      const { error: logErr } = await supabase.from('ai_audit_logs').insert({
        action_type: 'stock_adjustment',
        severity: 'warning',
        message: `Randomized sales surge simulated for ${selectedItems.length} items: ${itemSummaries.join(', ')}`,
        details: { items_affected: itemSummaries, count: selectedItems.length },
        source: 'human',
      });
      if (logErr) {
        console.error('Failed to log surge simulation:', logErr.message);
      }

      return NextResponse.json({
        success: true,
        message: `Randomized sales surge: ${selectedItems.length} items dropped below reorder points`,
        affected_items: itemSummaries,
      });
    }

    if (action === 'reset_stock') {
      // Reset items to healthy stock levels (70-90% of max capacity)
      const { data: items } = await supabase
        .from('inventory_items')
        .select('id, max_stock_capacity');

      if (items) {
        const resetPromises = items.map((item) => {
          const healthyStock = Math.floor(item.max_stock_capacity * (0.65 + Math.random() * 0.25));
          return supabase
            .from('inventory_items')
            .update({ current_stock: healthyStock })
            .eq('id', item.id);
        });
        const resetResults = await Promise.all(resetPromises);
        const resetErr = resetResults.find((r) => r.error);
        if (resetErr) {
          console.error('Reset stock partial update error:', resetErr.error?.message);
        }
      }

      const { error: resetLogErr } = await supabase.from('ai_audit_logs').insert({
        action_type: 'stock_adjustment',
        severity: 'info',
        message: `Inventory stock levels reset to healthy baseline across all items`,
        source: 'human',
      });
      if (resetLogErr) {
        console.error('Failed to log stock reset:', resetLogErr.message);
      }

      return NextResponse.json({ success: true, message: 'All stock levels reset to healthy baseline' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

