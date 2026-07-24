import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/inventory
 * Fetch all active inventory items with supplier info
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
        id, sku, name, category, unit_price, cost_price,
        current_stock, min_stock_level, max_stock_capacity,
        reorder_point, avg_daily_sales, supplier_id, is_active,
        last_restocked_at, created_at, updated_at,
        supplier:suppliers (id, name, contact_email, lead_time_days)
      `)
      .eq('is_active', true)
      .order('current_stock', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

