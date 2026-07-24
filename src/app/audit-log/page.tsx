'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ScrollText, AlertTriangle, Info, AlertOctagon, Zap,
  Bot, User, Clock, Server, Mail, RefreshCw, Filter, Code2, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime, formatDate } from '@/lib/utils/helpers';
import { exportToCSV } from '@/lib/utils/export';
import { fetchWithCache, invalidateCache } from '@/lib/utils/cache';
import type { AuditLog, AuditSeverity, AuditSource } from '@/lib/types/database';

const severityConfig: Record<AuditSeverity, { icon: React.ElementType; color: string; badge: string }> = {
  info: { icon: Info, color: 'text-blue-600', badge: 'badge-brain3-neutral' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', badge: 'badge-brain3-warning' },
  error: { icon: AlertOctagon, color: 'text-red-600', badge: 'badge-brain3-critical' },
  critical: { icon: Zap, color: 'text-red-700', badge: 'badge-brain3-critical' },
};

const sourceIcons: Record<AuditSource, React.ElementType> = {
  ai_agent: Bot,
  human: User,
  system: Server,
  cron: Clock,
  email_service: Mail,
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPayloadId, setExpandedPayloadId] = useState<string | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async (forceFresh = false) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(severityFilter && severityFilter !== 'all' ? { severity: severityFilter } : {}),
      });
      const url = `/api/audit-logs?${params}`;
      const data = await fetchWithCache<{ logs: AuditLog[]; total: number; totalPages: number }>(url, forceFresh);
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, severityFilter]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(severityFilter && severityFilter !== 'all' ? { severity: severityFilter } : {}),
      });
      const url = `/api/audit-logs?${params}`;
      try {
        const data = await fetchWithCache<{ logs: AuditLog[]; total: number; totalPages: number }>(url);
        if (!ignore) {
          setLogs(data.logs || []);
          setTotalLogs(data.total || 0);
          setTotalPages(data.totalPages || 1);
        }
      } catch {
        if (!ignore) toast.error('Failed to load audit logs');
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, severityFilter]);

  const refresh = () => {
    setRefreshing(true);
    invalidateCache('/api/audit-logs');
    fetchLogs(true);
  };

  const handleExportCSV = () => {
    exportToCSV('ai_audit_trail', logs, [
      { key: 'created_at', label: 'Timestamp' },
      { key: 'severity', label: 'Severity' },
      { key: 'action_type', label: 'Action Type' },
      { key: 'source', label: 'Source' },
      { key: 'message', label: 'Message' },
      { key: 'details', label: 'Payload Details' },
    ]);
    toast.success('Audit trail exported to CSV');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 w-64 rounded-2xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">AI Audit Trail</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Immutable activity stream recording all AI reasoning and system triggers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="btn-outline-brain3"
          >
            <Download className="w-4 h-4 text-gray-700" />
            Export CSV
          </button>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setLoading(true); }}
              className="bg-white border border-gray-200 rounded-full py-2 px-4 text-xs font-semibold text-gray-800 shadow-sm focus:outline-none"
            >
              <option value="">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <button onClick={refresh} className="btn-outline-brain3">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Logs Feed */}
      {logs.length === 0 ? (
        <div className="card-brain3 p-16 text-center">
          <ScrollText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-gray-900">No audit log entries recorded</p>
          <p className="text-sm text-gray-500 mt-1">Run a stock audit to generate autonomous agent logs</p>
        </div>
      ) : (
        <div className="card-brain3 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Execution Activity Stream
            </span>
            <span className="badge-brain3 badge-brain3-neutral">{logs.length} events</span>
          </div>

          <div className="space-y-3">
            {logs.map((log) => {
              const severity = severityConfig[log.severity] || severityConfig.info;
              const SourceIcon = sourceIcons[log.source] || Server;
              const isPayloadExpanded = expandedPayloadId === log.id;
              const hasDetails = log.details && Object.keys(log.details).length > 0;

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-gray-50/80 border border-gray-100 hover:border-gray-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge-brain3 ${severity.badge}`}>{log.severity}</span>
                        <code className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-200 text-gray-800 font-bold">
                          {log.action_type}
                        </code>
                        <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1.5">
                          <SourceIcon className="w-3.5 h-3.5 text-gray-400" />
                          {log.source}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-gray-900 mt-2 leading-relaxed">
                        {log.message}
                      </p>

                      {hasDetails && (
                        <div className="mt-3">
                          <button
                            onClick={() => setExpandedPayloadId(isPayloadExpanded ? null : log.id)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#064e3b] hover:underline"
                          >
                            <Code2 className="w-3 h-3" />
                            {isPayloadExpanded ? 'Hide Payload' : 'View Payload Details'}
                          </button>

                          {isPayloadExpanded && (
                            <div className="mt-2 bg-gray-900 text-emerald-300 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto">
                              <pre className="whitespace-pre-wrap">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-mono font-bold text-gray-600">
                        {formatRelativeTime(log.created_at)}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Pagination Bar */}
          {totalLogs > 0 && (
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-4">
              <span className="text-xs font-semibold text-gray-500 font-mono">
                Page {page} of {totalPages || 1} ({totalLogs} total events)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-outline-brain3 px-3.5 py-1.5 text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs font-bold text-gray-700 font-mono px-1">
                  {page} / {totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn-outline-brain3 px-3.5 py-1.5 text-xs disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
