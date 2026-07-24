'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Check, X, Send, ChevronDown, ChevronUp,
  Package, DollarSign, Clock, FileText, Bot, Printer, Building2, Download, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils/helpers';
import { exportToCSV } from '@/lib/utils/export';
import { fetchWithCache, invalidateCache } from '@/lib/utils/cache';
import type { POStatus } from '@/lib/types/database';

interface LineItem {
  id: string;
  quantity_ordered: number;
  unit_cost: number;
  total_cost: number;
  inventory_item: { id: string; name: string; sku: string; current_stock: number } | null;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  status: POStatus;
  total_amount: number;
  currency: string;
  notes: string | null;
  ai_reasoning: string | null;
  created_by: string;
  approved_by: string | null;
  sent_at: string | null;
  created_at: string;
  supplier: { id: string; name: string; contact_email: string } | null;
  line_items: LineItem[];
}

const statusConfig: Record<POStatus, { label: string; badge: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', badge: 'badge-brain3-neutral', icon: FileText },
  pending_approval: { label: 'Pending Approval', badge: 'badge-brain3-warning', icon: Clock },
  approved: { label: 'Approved', badge: 'badge-brain3-success', icon: Check },
  sent: { label: 'Sent', badge: 'badge-brain3-success', icon: Send },
  acknowledged: { label: 'Acknowledged', badge: 'badge-brain3-success', icon: Check },
  cancelled: { label: 'Cancelled', badge: 'badge-brain3-critical', icon: X },
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Pagination & Filtering State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchOrders = useCallback(async (forceFresh = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      const url = `/api/purchase-orders?${params.toString()}`;
      const data = await fetchWithCache<{ purchase_orders: PurchaseOrder[]; total: number; totalPages: number }>(url, forceFresh);
      setOrders(data.purchase_orders || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    let ignore = false;
    const loadData = async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        });
        const url = `/api/purchase-orders?${params.toString()}`;
        const data = await fetchWithCache<{ purchase_orders: PurchaseOrder[]; total: number; totalPages: number }>(url);
        if (!ignore) {
          setOrders(data.purchase_orders || []);
          setTotalCount(data.total || 0);
          setTotalPages(data.totalPages || 1);
        }
      } catch {
        if (!ignore) toast.error('Failed to load purchase orders');
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    loadData();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, statusFilter]);

  const updateStatus = async (id: string, status: POStatus, poNumber: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, approved_by: 'human_operator' }),
      });

      if (res.ok) {
        toast.success(`PO ${poNumber} ${status === 'approved' ? 'approved' : status === 'cancelled' ? 'cancelled' : 'updated'}`);

        if (status === 'approved') {
          toast.info(`📧 Sending PO ${poNumber} to supplier...`);
          const emailRes = await fetch('/api/email/send-po', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ purchaseOrderId: id }),
          });
          if (emailRes.ok) {
            toast.success(`PO ${poNumber} emailed to supplier!`);
          } else {
            toast.warning('PO approved but email send failed');
          }
        }
        invalidateCache('/api/purchase-orders');
        fetchOrders(true);
      } else {
        toast.error('Failed to update PO status');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrintPO = (order: PurchaseOrder) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print PO.');
      return;
    }

    const itemsRows = order.line_items.map((li) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${li.inventory_item?.name || '—'} (${li.inventory_item?.sku || ''})</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${li.quantity_ordered}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(li.unit_cost).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(li.total_cost).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>PO ${order.po_number} - ${order.supplier?.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            .header { border-bottom: 2px solid #064e3b; padding-bottom: 20px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #064e3b; }
            .subtitle { font-size: 14px; color: #666; }
            .info { margin-bottom: 30px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f4f4f4; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
            .total { text-align: right; margin-top: 20px; font-size: 18px; font-weight: bold; color: #064e3b; }
            .reasoning { margin-top: 30px; padding: 15px; background: #ecfdf5; border-left: 4px solid #059669; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">PURCHASE ORDER</div>
            <div class="subtitle">Brain3 Autonomous Purchasing Agent</div>
          </div>
          <div class="info">
            <strong>PO Number:</strong> ${order.po_number}<br>
            <strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}<br>
            <strong>Supplier:</strong> ${order.supplier?.name}<br>
            <strong>Contact Email:</strong> ${order.supplier?.contact_email}<br>
            <strong>Status:</strong> ${order.status.toUpperCase()}
          </div>
          <table>
            <thead>
              <tr>
                <th>Item & SKU</th>
                <th style="text-align: center;">Quantity</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          <div class="total">Total PO Amount: $${Number(order.total_amount).toFixed(2)} USD</div>
          ${order.ai_reasoning ? `<div class="reasoning"><strong>AI Reasoning:</strong> ${order.ai_reasoning}</div>` : ''}
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportCSV = () => {
    const csvData = orders.flatMap((o) =>
      o.line_items.map((li) => ({
        po_number: o.po_number,
        supplier: o.supplier?.name || '',
        status: o.status,
        item_name: li.inventory_item?.name || '',
        sku: li.inventory_item?.sku || '',
        quantity_ordered: li.quantity_ordered,
        unit_cost: li.unit_cost,
        total_cost: li.total_cost,
        po_total: o.total_amount,
        created_at: o.created_at,
      }))
    );

    exportToCSV('purchase_orders_export', csvData, [
      { key: 'po_number', label: 'PO Number' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'status', label: 'Status' },
      { key: 'item_name', label: 'Item Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'quantity_ordered', label: 'Quantity Ordered' },
      { key: 'unit_cost', label: 'Unit Cost' },
      { key: 'total_cost', label: 'Line Total' },
      { key: 'po_total', label: 'PO Total' },
      { key: 'created_at', label: 'Date Created' },
    ]);
    toast.success('Purchase orders exported to CSV');
  };

  const pendingCount = orders.filter((o) => o.status === 'pending_approval').length;
  const sentCount = orders.filter((o) => o.status === 'sent' || o.status === 'approved').length;
  const totalValue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 w-72 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-3xl" />)}
        </div>
        <div className="skeleton h-96 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Purchase Orders</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Manage AI-generated purchase orders and supplier communications.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="btn-outline-brain3"
        >
          <Download className="w-4 h-4 text-gray-700" />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card-brain3 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending Approval</span>
            <div className="btn-arrow-circle">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-gray-900 mt-3">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Awaiting operator sign-off</p>
        </div>

        <div className="card-brain3 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Dispatched POs</span>
            <div className="btn-arrow-circle">
              <Send className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-gray-900 mt-3">{sentCount}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Sent to vendor / acknowledged</p>
        </div>

        <div className="card-hero-forest p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Total PO Volume</span>
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-white mt-3">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-emerald-200 mt-1 font-medium">Cumulative procurement spend</p>
        </div>
      </div>

      {/* Filter Tabs & Pagination Control Bar */}
      <div className="card-brain3 p-4 flex items-center justify-between flex-wrap gap-4">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'pending_approval', label: 'Pending Approval' },
            { id: 'approved', label: 'Approved' },
            { id: 'sent', label: 'Sent' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                statusFilter === tab.id
                  ? 'bg-[#064e3b] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-500 font-mono">
            Page {page} of {totalPages || 1} ({totalCount} total)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-outline-brain3 px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-outline-brain3 px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Orders Feed */}
      {orders.length === 0 ? (
        <div className="card-brain3 p-16 text-center">
          <div className="w-16 h-16 rounded-3xl bg-gray-100 mx-auto mb-4 flex items-center justify-center text-gray-400">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <p className="text-lg font-bold text-gray-900">No purchase orders generated</p>
          <p className="text-sm text-gray-500 mt-1">Run a stock audit from the dashboard to trigger AI PO creation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const config = statusConfig[order.status] || statusConfig.draft;
            const StatusIcon = config.icon;
            const isExpanded = expandedId === order.id;
            const isPending = order.status === 'pending_approval';
            const isLoading = actionLoading === order.id;

            return (
              <div key={order.id} className="card-brain3 overflow-hidden">
                {/* Header Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full p-5 px-6 flex items-center justify-between transition-colors text-left hover:bg-gray-50/80"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#064e3b] font-bold flex items-center justify-center shadow-sm border border-emerald-100">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-extrabold text-gray-900 font-mono">
                          {order.po_number}
                        </span>
                        <span className={`badge-brain3 ${config.badge}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-gray-500 mt-0.5">
                        {order.supplier?.name || 'Unknown Supplier'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-base font-extrabold text-gray-900">
                        {formatCurrency(Number(order.total_amount))}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-400">
                        {order.line_items?.length || 0} line items
                      </p>
                    </div>

                    <span className="text-xs font-medium text-gray-400">
                      {formatRelativeTime(order.created_at)}
                    </span>

                    <div className="btn-arrow-circle">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-6 space-y-5 border-t border-gray-100 bg-gray-50/50">
                    {/* AI Reasoning Block */}
                    {order.ai_reasoning && (
                      <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-100 relative">
                        <div className="flex items-center gap-2 mb-1.5 text-[#064e3b] font-bold text-xs">
                          <Bot className="w-4 h-4" />
                          <span>Gemini AI Reasoning & Supply Chain Context</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed font-medium">
                          {order.ai_reasoning}
                        </p>
                      </div>
                    )}

                    {/* Line Items Table */}
                    <div className="overflow-x-auto">
                      <table className="brain3-table bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <thead>
                          <tr>
                            <th>Item Details</th>
                            <th style={{ textAlign: 'center' }}>Current Stock</th>
                            <th style={{ textAlign: 'center' }}>Reorder Qty</th>
                            <th style={{ textAlign: 'right' }}>Unit Cost</th>
                            <th style={{ textAlign: 'right' }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.line_items.map((li) => (
                            <tr key={li.id}>
                              <td>
                                <p className="text-xs font-bold text-gray-900">{li.inventory_item?.name || '—'}</p>
                                <code className="text-[10px] text-gray-400 font-mono">{li.inventory_item?.sku}</code>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="text-xs font-medium text-gray-600">{li.inventory_item?.current_stock ?? '—'}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badge-brain3 badge-brain3-success font-mono">
                                  <Package className="w-3 h-3" />
                                  +{li.quantity_ordered}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="text-xs font-medium text-gray-600 font-mono">{formatCurrency(Number(li.unit_cost))}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="text-xs font-bold text-gray-900 font-mono">{formatCurrency(Number(li.total_cost))}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                        <span>Created: {formatDate(order.created_at)}</span>
                        {order.sent_at && <span>Sent: {formatDate(order.sent_at)}</span>}
                        <span>Source: <code className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">{order.created_by}</code></span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePrintPO(order)}
                          className="btn-outline-brain3 py-2 text-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print / PDF PO
                        </button>

                        {isPending && (
                          <>
                            <button
                              onClick={() => updateStatus(order.id, 'cancelled', order.po_number)}
                              disabled={isLoading}
                              className="px-4 py-2 rounded-full bg-red-50 text-red-700 font-bold text-xs hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                              {isLoading ? 'Processing...' : 'Reject PO'}
                            </button>
                            <button
                              onClick={() => updateStatus(order.id, 'approved', order.po_number)}
                              disabled={isLoading}
                              className="btn-forest py-2 text-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              {isLoading ? 'Approving...' : 'Approve & Dispatch Email'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Pagination Bar */}
      {totalCount > 0 && (
        <div className="card-brain3 p-4 flex items-center justify-between flex-wrap gap-4">
          <span className="text-xs font-semibold text-gray-500 font-mono">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} purchase orders
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-outline-brain3 px-4 py-2 text-xs disabled:opacity-40"
            >
              Previous Page
            </button>
            <span className="text-xs font-bold text-gray-700 font-mono px-2">
              {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-outline-brain3 px-4 py-2 text-xs disabled:opacity-40"
            >
              Next Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
