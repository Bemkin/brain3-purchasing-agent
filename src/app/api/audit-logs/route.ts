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

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const actionType = searchParams.get('action_type');
    const severity = searchParams.get('severity');
    const source = searchParams.get('source');

    let query = supabase
      .from('ai_audit_logs')
      .select('id, action_type, severity, message, details, related_po_id, related_item_id, source, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (actionType) {
      query = query.eq('action_type', actionType);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (source) {
      query = query.eq('source', source);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    return NextResponse.json({ logs: data, count: data?.length ?? 0 });
  } catch (err) {
    console.error('Audit logs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
