import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generatePONumber } from '@/lib/utils/helpers';
import { CreatePOSchema, UpdatePOStatusSchema } from '@/lib/schemas';

/**
 * GET /api/purchase-orders
 * Fetch all purchase orders with supplier info and line items
 */
export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '15', 10);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('purchase_orders')
      .select(
        `
        id, po_number, supplier_id, status, total_amount, currency,
        notes, ai_reasoning, created_by, approved_by, sent_at,
        created_at, updated_at,
        supplier:suppliers (id, name, contact_email),
        line_items:po_line_items (
          id, quantity_ordered, unit_cost, total_cost,
          inventory_item:inventory_items (id, name, sku, current_stock)
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply pagination bounds if specified
    if (searchParams.has('page')) {
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to fetch purchase orders:', error);
      return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
    }

    return NextResponse.json({
      purchase_orders: data || [],
      total: count || (data ? data.length : 0),
      page,
      pageSize,
      totalPages: Math.ceil((count || (data ? data.length : 0)) / pageSize),
    });
  } catch (err) {
    console.error('Purchase orders error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/purchase-orders
 * Create a new purchase order with line items
 */
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const parsed = CreatePOSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { supplier_id, notes, ai_reasoning, line_items } = parsed.data;

    // Get next PO number
    const { count } = await supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true });

    const poNumber = generatePONumber((count || 0) + 1);

    // Calculate total
    const totalAmount = line_items.reduce(
      (sum, item) => sum + item.quantity_ordered * item.unit_cost,
      0
    );

    // Insert PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        supplier_id,
        status: 'draft',
        total_amount: totalAmount,
        notes: notes || null,
        ai_reasoning: ai_reasoning || null,
        created_by: 'ai_agent',
      })
      .select('id, po_number, status, total_amount, created_at')
      .single();

    if (poError || !po) {
      console.error('Failed to create PO:', poError);
      return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 });
    }

    // Insert line items
    const lineItemsInsert = line_items.map((item) => ({
      purchase_order_id: po.id,
      inventory_item_id: item.inventory_item_id,
      quantity_ordered: item.quantity_ordered,
      unit_cost: item.unit_cost,
      total_cost: item.quantity_ordered * item.unit_cost,
    }));

    const { error: liError } = await supabase
      .from('po_line_items')
      .insert(lineItemsInsert);

    if (liError) {
      console.error('Failed to insert line items:', liError);
      // Rollback PO
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      return NextResponse.json({ error: 'Failed to create line items' }, { status: 500 });
    }

    return NextResponse.json({ purchase_order: po }, { status: 201 });
  } catch (err) {
    console.error('Create PO error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/purchase-orders
 * Update PO status (approve, reject, cancel)
 */
export async function PATCH(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { id, ...statusUpdate } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing purchase order ID' }, { status: 400 });
    }

    const parsed = UpdatePOStatusSchema.safeParse(statusUpdate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid status update', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      status: parsed.data.status,
    };

    if (parsed.data.approved_by) {
      updatePayload.approved_by = parsed.data.approved_by;
    }
    if (parsed.data.status === 'sent') {
      updatePayload.sent_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .update(updatePayload)
      .eq('id', id)
      .select('id, po_number, status, total_amount, updated_at')
      .single();

    if (error) {
      console.error('Failed to update PO status:', error);
      return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
    }

    // Audit log the status change
    const actionMap: Record<string, string> = {
      approved: 'po_approved',
      cancelled: 'po_cancelled',
      sent: 'po_sent',
      pending_approval: 'po_generated',
    };

    const actionType = actionMap[parsed.data.status] || 'po_edited';

    await supabase.from('ai_audit_logs').insert({
      action_type: actionType,
      severity: parsed.data.status === 'cancelled' ? 'warning' : 'info',
      message: `PO ${data.po_number} status changed to ${parsed.data.status}`,
      details: { po_id: id, new_status: parsed.data.status, approved_by: parsed.data.approved_by },
      related_po_id: id,
      source: 'human',
    });

    return NextResponse.json({ purchase_order: data });
  } catch (err) {
    console.error('Update PO error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
