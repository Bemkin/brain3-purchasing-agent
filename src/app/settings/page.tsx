'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Zap, Shield, Clock, DollarSign, Save, RefreshCw, Cpu, Mail, Server } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data.settings || {});
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = async (key: string, value: unknown) => {
    setSaving(key);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        setSettings((prev) => ({ ...prev, [key]: value }));
        toast.success(`Setting "${key}" updated`);
      } else {
        toast.error('Failed to update setting');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(null);
    }
  };

  const mode = String(settings.operating_mode || 'approval').replace(/"/g, '');
  const isAutoPilot = mode === 'auto_pilot';

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="skeleton h-12 w-64 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-44 rounded-3xl" />
          <div className="skeleton h-44 rounded-3xl" />
        </div>
        <div className="skeleton h-64 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Agent Control Center</h1>
        <p className="text-sm font-medium text-gray-500 mt-1">
          Configure autonomous agent execution parameters, dual-node operating modes, and safeguards.
        </p>
      </div>

      {/* Dual Operating Mode Selection Panels */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">
          Select Autonomous Operating Node
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Approval Mode Panel */}
          <div
            onClick={() => updateSetting('operating_mode', 'approval')}
            className={`card-brain3 p-6 cursor-pointer transition-all ${
              !isAutoPilot
                ? 'border-2 border-[#064e3b] bg-emerald-50/40 shadow-lg'
                : 'hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center shadow-md">
                <Shield className="w-5 h-5" />
              </div>
              {!isAutoPilot && <span className="badge-brain3 badge-brain3-success">Active Node</span>}
            </div>
            <h3 className="text-base font-extrabold text-gray-900">Approval Mode</h3>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed font-medium">
              Human-in-the-loop safety net. The AI agent analyzes stock, recommends PO quantities, but awaits operator sign-off before emailing suppliers.
            </p>
          </div>

          {/* Auto-Pilot Mode Panel */}
          <div
            onClick={() => updateSetting('operating_mode', 'auto_pilot')}
            className={`card-brain3 p-6 cursor-pointer transition-all ${
              isAutoPilot
                ? 'border-2 border-[#064e3b] bg-emerald-50/40 shadow-lg'
                : 'hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <Zap className="w-5 h-5" />
              </div>
              {isAutoPilot && <span className="badge-brain3 badge-brain3-success">Active Node</span>}
            </div>
            <h3 className="text-base font-extrabold text-gray-900">Auto-Pilot Mode</h3>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed font-medium">
              Fully autonomous zero-touch procurement. AI generates POs, approves orders within threshold, and dispatches supplier emails instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Threshold & Frequency Settings */}
      <div className="card-brain3 p-6 space-y-6">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#064e3b]" />
          Automation Safeguards & Schedule
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PO Threshold */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 block">
              Auto-Pilot PO Approval Ceiling (USD)
            </label>
            <p className="text-[11px] text-gray-400 font-medium">
              Orders exceeding this amount fall back to Approval Mode automatically.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="number"
                value={Number(settings.po_approval_threshold_usd || 500)}
                onChange={(e) => setSettings((prev) => ({ ...prev, po_approval_threshold_usd: Number(e.target.value) }))}
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm font-mono font-bold flex-1 focus:outline-none focus:border-[#064e3b]"
              />
              <button
                onClick={() => updateSetting('po_approval_threshold_usd', Number(settings.po_approval_threshold_usd || 500))}
                disabled={saving === 'po_approval_threshold_usd'}
                className="btn-forest text-xs py-2.5 px-4"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>

          {/* Check Interval */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 block">
              Autonomous Check Cadence (Hours)
            </label>
            <p className="text-[11px] text-gray-400 font-medium">
              Scheduled cron trigger interval for stock matrix audit.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="number"
                min={1}
                max={24}
                value={Number(settings.stock_check_interval_hours || 6)}
                onChange={(e) => setSettings((prev) => ({ ...prev, stock_check_interval_hours: Number(e.target.value) }))}
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm font-mono font-bold flex-1 focus:outline-none focus:border-[#064e3b]"
              />
              <button
                onClick={() => updateSetting('stock_check_interval_hours', Number(settings.stock_check_interval_hours || 6))}
                disabled={saving === 'stock_check_interval_hours'}
                className="btn-forest text-xs py-2.5 px-4"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Parameters Card */}
      <div className="card-brain3 p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-[#064e3b]" />
          System & Engine Parameters
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">AI Engine</span>
            <span className="text-xs font-bold text-gray-900 font-mono mt-1 block">
              {String(settings.ai_model || 'gemini-3.5-flash-lite').replace(/"/g, '')}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Email Dispatch</span>
            <span className="text-xs font-bold text-emerald-800 font-mono mt-1 block">
              Resend API (Active)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Database Node</span>
            <span className="text-xs font-bold text-gray-900 font-mono mt-1 block">
              Supabase 3NF SQL
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Validation Layer</span>
            <span className="text-xs font-bold text-[#064e3b] font-mono mt-1 block">
              Zod Strict Schema
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
