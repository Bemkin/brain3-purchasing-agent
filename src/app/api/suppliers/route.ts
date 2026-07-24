import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/suppliers
 * Fetch all suppliers with aggregated product count & PO stats
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Fetch suppliers with products and purchase orders
    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select(`
        id, name, contact_email, contact_phone, lead_time_days, created_at,
        inventory_items (id, name, sku, current_stock, reorder_point),
        purchase_orders (id, po_number, total_amount, status, created_at)
      `)
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to fetch suppliers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedSuppliers = (suppliers || []).map((s) => {
      const items = s.inventory_items || [];
      const pos = s.purchase_orders || [];
      const lowStockCount = items.filter((i) => i.current_stock <= i.reorder_point).length;
      const totalSpend = pos.filter((p) => p.status !== 'cancelled').reduce((sum, p) => sum + Number(p.total_amount), 0);

      return {
        id: s.id,
        name: s.name,
        contact_email: s.contact_email,
        contact_phone: s.contact_phone,
        lead_time_days: s.lead_time_days || 3,
        created_at: s.created_at,
        total_skus: items.length,
        low_stock_skus: lowStockCount,
        total_pos: pos.length,
        total_spend: totalSpend,
        items,
      };
    });

    return NextResponse.json({ suppliers: formattedSuppliers });
  } catch (err) {
    console.error('Suppliers GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/suppliers
 * Create a new supplier
 */
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const { name, contact_email, contact_phone, lead_time_days } = body;

    if (!name || !contact_email) {
      return NextResponse.json({ error: 'Name and contact email are required' }, { status: 400 });
    }

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .insert({
        name,
        contact_email,
        contact_phone: contact_phone || null,
        lead_time_days: Number(lead_time_days) || 3,
      })
      .select('id, name, contact_email, lead_time_days')
      .single();

    if (error) {
      console.error('Failed to create supplier:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('ai_audit_logs').insert({
      action_type: 'supplier_created',
      severity: 'info',
      message: `New supplier created: ${name} (${contact_email})`,
      details: { supplier_id: supplier.id, name, contact_email },
      source: 'human',
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err) {
    console.error('Suppliers POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/suppliers
 * Update an existing supplier
 */
export async function PATCH(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { id, address, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing supplier ID' }, { status: 400 });
    }

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select('id, name, contact_email, lead_time_days')
      .single();

    if (error) {
      console.error('Failed to update supplier:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ supplier });
  } catch (err) {
    console.error('Suppliers PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
