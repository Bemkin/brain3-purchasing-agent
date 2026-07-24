import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UpdateSettingSchema } from '@/lib/schemas';

/**
 * GET /api/settings
 * Fetch all system settings
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('system_settings')
      .select('id, key, value, updated_at')
      .order('key', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Convert array to key-value map for easy access
    const settingsMap: Record<string, unknown> = {};
    (data || []).forEach((setting) => {
      settingsMap[setting.key] = setting.value;
    });

    return NextResponse.json({ settings: settingsMap, raw: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * Update a system setting
 */
export async function PUT(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const parsed = UpdateSettingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { key, value } = parsed.data;

    const { data, error } = await supabase
      .from('system_settings')
      .update({ value: value as unknown as object })
      .eq('key', key)
      .select('id, key, value, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }

    // Log mode changes to audit
    if (key === 'operating_mode') {
      const { error: logErr } = await supabase.from('ai_audit_logs').insert({
        action_type: 'mode_changed',
        severity: 'info',
        message: `Operating mode changed to: ${JSON.stringify(value)}`,
        details: { key, new_value: value },
        source: 'human',
      });
      if (logErr) {
        console.error('Failed to log mode change:', logErr.message);
      }
    }

    return NextResponse.json({ setting: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

