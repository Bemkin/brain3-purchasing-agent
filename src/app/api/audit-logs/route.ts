import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/audit-logs
 * Fetch audit logs with optional filtering
 */
export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '15', 10);
    const actionType = searchParams.get('action_type');
    const severity = searchParams.get('severity');
    const source = searchParams.get('source');

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('ai_audit_logs')
      .select('id, action_type, severity, message, details, related_po_id, related_item_id, source, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (actionType && actionType !== 'all') {
      query = query.eq('action_type', actionType);
    }
    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }
    if (source && source !== 'all') {
      query = query.eq('source', source);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    return NextResponse.json({
      logs: data || [],
      total: count || (data ? data.length : 0),
      page,
      pageSize,
      totalPages: Math.ceil((count || (data ? data.length : 0)) / pageSize),
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
