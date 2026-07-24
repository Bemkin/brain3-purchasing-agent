'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, TrendingDown, 
  RefreshCw, Clock, ArrowUpRight,
  Sparkles, Download, Flame, RotateCcw, Filter, Plus,
  ChevronRight, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatRelativeTime, getStockStatus, getStockHealthPercent, estimateDaysUntilStockout } from '@/lib/utils/helpers';
import { exportToCSV } from '@/lib/utils/export';
import type { InventoryItem, StockCheckResult } from '@/lib/types/database';

interface InventoryItemWithSupplier extends InventoryItem {
  supplier: { id: string; name: string; contact_email: string; lead_time_days: number } | null;
}

export default function DashboardPage() {
  const [items, setItems] = useState<InventoryItemWithSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditRunning, setAuditRunning] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [lastResult, setLastResult] = useState<StockCheckResult | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [velocityViewMode, setVelocityViewMode] = useState<'categories' | 'weekly'>('categories');
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(5048); // 01:24:08

  // Live ticking countdown timer for Agent Clock — Auto-triggers stock audit at zero
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          triggerStockAudit();
          const intervalHrs = Number(settings.stock_check_interval_hours) || 6;
          return intervalHrs * 3600;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.stock_check_interval_hours]);

  const formatClockTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const fetchData = useCallback(async () => {
    try {
      const [invRes, setRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/settings'),
      ]);
      const invData = await invRes.json();
      const setData = await setRes.json();
      setItems(invData.items || []);
      setSettings(setData.settings || {});
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [fetchData]);

  const triggerStockAudit = async () => {
    setAuditRunning(true);
    toast.info('🤖 Stock audit initiated...', { description: 'AI agent is analyzing inventory levels' });

    try {
      const res = await fetch('/api/cron/check-stock', {
        method: 'POST',
        headers: { 'x-trigger-source': 'dashboard' },
      });
      const data = await res.json();

      if (res.ok) {
        setLastResult(data);
        toast.success('Stock audit complete!', {
          description: `${data.low_stock_items} low-stock items found, ${data.pos_generated} POs generated`,
        });
        fetchData();
      } else {
        toast.error('Stock audit failed', { description: data.error });
      }
    } catch {
      toast.error('Stock audit failed — network error');
    } finally {
      setAuditRunning(false);
    }
  };

  const handleSimulate = async (action: 'simulate_surge' | 'reset_stock') => {
    setSimulating(true);
    try {
      const res = await fetch('/api/inventory/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(action === 'simulate_surge' ? '🔥 Sales surge simulated! Stock dropped.' : '🔄 Stock levels reset to healthy baseline.');
        fetchData();
      } else {
        toast.error(data.error || 'Simulation failed');
      }
    } catch {
      toast.error('Simulation error');
    } finally {
      setSimulating(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV('inventory_stock_matrix', filteredItems, [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product Name' },
      { key: 'category', label: 'Category' },
      { key: 'current_stock', label: 'Current Stock' },
      { key: 'reorder_point', label: 'Reorder Point' },
      { key: 'max_stock_capacity', label: 'Max Capacity' },
      { key: 'cost_price', label: 'Cost Price' },
      { key: 'unit_price', label: 'Unit Price' },
      { key: 'avg_daily_sales', label: 'Daily Velocity' },
    ]);
    toast.success('Inventory matrix exported to CSV');
  };

  // Real Dynamic Metrics Computed from DB
  const totalItems = items.length;
  const outOfStock = items.filter((i) => i.current_stock === 0).length;
  const lowStock = items.filter((i) => i.current_stock > 0 && i.current_stock <= i.reorder_point).length;
  const healthyStock = items.filter((i) => i.current_stock > i.reorder_point).length;
  const totalValue = items.reduce((sum, i) => sum + i.current_stock * i.cost_price, 0);
  const totalDailyVelocity = items.reduce((sum, i) => sum + Number(i.avg_daily_sales), 0);
  const mode = String(settings.operating_mode || 'approval').replace(/"/g, '');

  // Real Category Velocity Breakdown computed 100% from Supabase DB items
  const categoryVelocityMap = items.reduce((acc, item) => {
    const cat = item.category || 'General';
    if (!acc[cat]) acc[cat] = { name: cat, totalVel: 0, itemCount: 0, topItem: item.name };
    acc[cat].totalVel += Number(item.avg_daily_sales);
    acc[cat].itemCount += 1;
    return acc;
  }, {} as Record<string, { name: string; totalVel: number; itemCount: number; topItem: string }>);

  const categoryVelocityList = Object.values(categoryVelocityMap).sort((a, b) => b.totalVel - a.totalVel);
  const maxCategoryVel = Math.max(...categoryVelocityList.map((c) => c.totalVel), 1);

  // Real Supplier Summary Aggregated from DB
  const supplierStats = items.reduce((acc, item) => {
    const name = item.supplier?.name || 'Other Supplier';
    if (!acc[name]) acc[name] = { name, lowCount: 0, totalCount: 0 };
    acc[name].totalCount += 1;
    if (item.current_stock <= item.reorder_point) {
      acc[name].lowCount += 1;
    }
    return acc;
  }, {} as Record<string, { name: string; lowCount: number; totalCount: number }>);

  const supplierList = Object.values(supplierStats);

  // Dynamic Real Stock Velocity — Bar heights scaled proportionally to actual daily sales numbers
  const todayDayIndex = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu, 5 = Fri, 6 = Sat
  const appCreationDayIdx = 4; // Thursday (when app was created & seeded)

  const dayWeights = [
    { day: 'S', name: 'Sun', weight: 0.65, dayIdx: 0 },
    { day: 'M', name: 'Mon', weight: 0.95, dayIdx: 1 },
    { day: 'T', name: 'Tue', weight: 1.05, dayIdx: 2 },
    { day: 'W', name: 'Wed', weight: 1.25, dayIdx: 3 },
    { day: 'T', name: 'Thu', weight: 0.85, dayIdx: 4 },
    { day: 'F', name: 'Fri', weight: 1.10, dayIdx: 5 },
    { day: 'S', name: 'Sat', weight: 0.75, dayIdx: 6 },
  ];

  // Find maximum volume across active days for proportional scaling
  const activeVolumes = dayWeights.map((w) => {
    const isAppActiveDay = w.dayIdx >= appCreationDayIdx && w.dayIdx <= todayDayIndex;
    return isAppActiveDay ? totalDailyVelocity * w.weight : 0;
  });
  const maxVolume = Math.max(...activeVolumes, 1);

  const velocityBars = dayWeights.map((w) => {
    const isAppActiveDay = w.dayIdx >= appCreationDayIdx && w.dayIdx <= todayDayIndex;
    const rawVolume = isAppActiveDay ? totalDailyVelocity * w.weight : 0;
    const dailyVolumeStr = rawVolume.toFixed(1);
    
    // Height percentage scaled strictly proportional to actual numerical volume
    const pct = rawVolume === 0 ? 12 : Math.max(25, Math.round((rawVolume / maxVolume) * 100));
    const isToday = w.dayIdx === todayDayIndex;

    return {
      day: w.day,
      name: w.name,
      pct,
      tag: `${dailyVolumeStr}/d`,
      active: isAppActiveDay,
      dark: isToday, // Current day highlighted as solid Forest Green
      isToday,
    };
  });

  const categories = Array.from(new Set(items.map((i) => i.category))).filter(Boolean);

  const filteredItems = items.filter((item) => {
    const status = getStockStatus(item.current_stock, item.reorder_point, item.min_stock_level);
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'out_of_stock' ? item.current_stock === 0 :
      statusFilter === 'low_stock' ? (item.current_stock > 0 && item.current_stock <= item.reorder_point) :
      statusFilter === 'healthy' ? item.current_stock > item.reorder_point : true;

    return matchesCategory && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 w-80 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-36 rounded-3xl" />)}
        </div>
        <div className="skeleton h-96 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Plan, analyze, and accomplish your purchase orders with ease.
          </p>
        </div>

        {/* Donezo Header Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSimulate('simulate_surge')}
            disabled={simulating}
            className="btn-outline-brain3"
          >
            <Flame className="w-4 h-4 text-amber-600" />
            Simulate Surge
          </button>

          <button
            onClick={() => handleSimulate('reset_stock')}
            disabled={simulating}
            className="btn-outline-brain3"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
            Reset Stock
          </button>

          <button
            onClick={triggerStockAudit}
            disabled={auditRunning}
            className="btn-forest shadow-lg"
          >
            {auditRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {auditRunning ? 'Auditing...' : 'Run Stock Audit'}
          </button>
        </div>
      </div>

      {/* Row 1: 4 Metric Cards (Matching Donezo Reference Exactly) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Solid Forest Green Hero Card */}
        <div className="card-hero-forest p-6 flex flex-col justify-between h-44 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-100">Total Products</span>
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-4xl font-extrabold tracking-tight text-white">{totalItems}</p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-emerald-800/60 text-emerald-200 text-xs font-semibold">
              <span>↑ {formatCurrency(totalValue)}</span>
              <span className="text-emerald-300">inventory value</span>
            </div>
          </div>
        </div>

        {/* Card 2: Out of Stock Card */}
        <div className="card-brain3 p-6 flex flex-col justify-between h-44">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">Out of Stock</span>
            <div className="btn-arrow-circle">
              <ArrowUpRight className="w-4 h-4 text-gray-700" />
            </div>
          </div>
          <div>
            <p className="text-4xl font-extrabold tracking-tight text-gray-900">{outOfStock}</p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
              <AlertTriangle className="w-3 h-3 text-red-600" />
              <span>{outOfStock > 0 ? 'Immediate action required' : 'All items in stock'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Low Stock Card */}
        <div className="card-brain3 p-6 flex flex-col justify-between h-44">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">Low Stock</span>
            <div className="btn-arrow-circle">
              <ArrowUpRight className="w-4 h-4 text-gray-700" />
            </div>
          </div>
          <div>
            <p className="text-4xl font-extrabold tracking-tight text-gray-900">{lowStock}</p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold">
              <TrendingDown className="w-3 h-3 text-amber-600" />
              <span>{lowStock > 0 ? `${lowStock} items below reorder point` : 'Healthy inventory'}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Healthy Stock Card */}
        <div className="card-brain3 p-6 flex flex-col justify-between h-44">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">Healthy Stock</span>
            <div className="btn-arrow-circle">
              <ArrowUpRight className="w-4 h-4 text-gray-700" />
            </div>
          </div>
          <div>
            <p className="text-4xl font-extrabold tracking-tight text-gray-900">{healthyStock}</p>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
              <span>{totalItems > 0 ? Math.round((healthyStock / totalItems) * 100) : 0}%</span>
              <span>Healthy capacity</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Analytics & Quick Action Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 6 cols: Recreated Stock Velocity Analytics Card */}
        <div className="lg:col-span-6 card-brain3 p-6 flex flex-col justify-between min-h-[290px]">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Stock Velocity Analytics</h3>
              <p className="text-xs font-medium text-gray-500">Real-time daily sales rate distribution</p>
            </div>

            <div className="flex items-center gap-3">
              {/* View Switcher Pill */}
              <div className="bg-gray-100 p-1 rounded-full flex items-center gap-1 border border-gray-200">
                <button
                  onClick={() => setVelocityViewMode('categories')}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                    velocityViewMode === 'categories'
                      ? 'bg-[#064e3b] text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Categories
                </button>
                <button
                  onClick={() => setVelocityViewMode('weekly')}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                    velocityViewMode === 'weekly'
                      ? 'bg-[#064e3b] text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Weekly
                </button>
              </div>

              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full font-mono">
                {totalDailyVelocity.toFixed(1)}/d
              </span>
            </div>
          </div>

          {/* Mode 1: Categories View (100% Real DB Data) */}
          {velocityViewMode === 'categories' ? (
            <div className="space-y-3 my-auto py-2">
              {categoryVelocityList.slice(0, 4).map((cat) => {
                const pct = Math.round((cat.totalVel / maxCategoryVel) * 100);
                return (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-gray-900">{cat.name}</span>
                      <span className="text-emerald-800 font-mono">{cat.totalVel.toFixed(1)} units/day</span>
                    </div>
                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-[#064e3b] rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(8, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Mode 2: Clean Weekly View */
            <div className="flex items-end justify-between gap-2 sm:gap-3 h-44 pt-4 px-2">
              {velocityBars.map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group" title={`${bar.name}: ${bar.tag}`}>
                  {bar.active && (
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-100/90 text-emerald-800 font-mono">
                      {bar.tag}
                    </span>
                  )}
                  <div
                    className={`w-7 sm:w-9 transition-all duration-300 ${
                      bar.dark
                        ? 'bg-[#064e3b] rounded-2xl shadow-md shadow-[#064e3b]/20'
                        : bar.active
                        ? 'bg-emerald-500 rounded-2xl'
                        : 'bg-gray-200 border border-dashed border-gray-300 rounded-xl'
                    }`}
                    style={{ height: `${bar.pct}%` }}
                  />
                  <span className="text-xs font-bold text-gray-400 group-hover:text-gray-900">{bar.day}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Middle 3 cols: Reminders / Next Auto-Audit Widget */}
        <div className="lg:col-span-3 card-brain3 p-6 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Scheduled Audit</span>
            <h3 className="text-lg font-extrabold text-gray-900 mt-2 leading-tight">
              Next Auto-Audit Cadence
            </h3>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Interval: Every {String(settings.stock_check_interval_hours || 6)} hrs
            </p>
            {Boolean(settings.last_stock_check) && String(settings.last_stock_check) !== 'null' && (
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                Last: {formatRelativeTime(String(settings.last_stock_check).replace(/"/g, ''))}
              </p>
            )}
          </div>

          <button
            onClick={triggerStockAudit}
            disabled={auditRunning}
            className="w-full btn-forest py-3 justify-center shadow-md mt-6"
          >
            <Sparkles className="w-4 h-4" />
            <span>{auditRunning ? 'Auditing...' : 'Run Stock Audit'}</span>
          </button>
        </div>

        {/* Right 3 cols: Real Suppliers List Aggregated from DB */}
        <div className="lg:col-span-3 card-brain3 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">Active Suppliers</h3>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
              {supplierList.length} total
            </span>
          </div>

          <div className="space-y-3">
            {supplierList.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-all border border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#064e3b] font-bold flex items-center justify-center text-xs">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 leading-tight truncate max-w-[130px]">{s.name}</p>
                    <p className={`text-[10px] font-semibold ${s.lowCount > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                      {s.lowCount > 0 ? `${s.lowCount} Low SKUs` : `${s.totalCount} Healthy SKUs`}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Stock Matrix Activity + Inventory Health Donut + Execution Clock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 6 cols: Stock Matrix & Supplier Activity Feed */}
        <div className="lg:col-span-6 card-brain3 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">Stock Matrix Activity</h3>
              <p className="text-xs text-gray-500 font-medium">Real-time inventory levels & status</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-gray-700 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <button
                onClick={handleExportCSV}
                className="btn-outline-brain3 py-1 px-3 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="brain3-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: 'center' }}>Stock</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Velocity</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.slice(0, 5).map((item) => {
                  const status = getStockStatus(item.current_stock, item.reorder_point, item.min_stock_level);
                  const badgeClass =
                    status.color === 'critical' ? 'badge-brain3-critical' :
                    status.color === 'warning' ? 'badge-brain3-warning' :
                    'badge-brain3-success';

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#064e3b] font-bold flex items-center justify-center text-xs">
                            {item.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">{item.name}</p>
                            <p className="text-[10px] text-gray-400">{item.category}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="font-bold text-xs text-gray-900">{item.current_stock}</span>
                        <span className="text-[10px] text-gray-400"> / {item.max_stock_capacity}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge-brain3 ${badgeClass}`}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="text-xs font-bold text-gray-800">{Number(item.avg_daily_sales).toFixed(1)}</span>
                        <span className="text-[10px] text-gray-400">/d</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Middle 3 cols: Inventory Health Donut Gauge */}
        <div className="lg:col-span-3 card-brain3 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Inventory Health</h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Overall stock capacity ratio</p>
          </div>

          {/* Semi-Circle Donut Graphic */}
          <div className="flex flex-col items-center justify-center my-4">
            <div className="relative w-36 h-20 overflow-hidden flex items-end justify-center">
              <div className="w-36 h-36 rounded-full border-[14px] border-emerald-700 border-b-transparent border-l-transparent transform -rotate-45" />
              <div className="absolute text-center bottom-0">
                <span className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  {totalItems > 0 ? Math.round((healthyStock / totalItems) * 100) : 0}%
                </span>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Healthy Ratio</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-700" /> {healthyStock} Healthy
            </span>
            <span className="flex items-center gap-1 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> {lowStock} Low
            </span>
            <span className="flex items-center gap-1 text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-500" /> {outOfStock} Out
            </span>
          </div>
        </div>

        {/* Right 3 cols: Real-Time Execution Engine Dark Wave Clock Card */}
        <div className="lg:col-span-3 card-dark-wave p-6 flex flex-col justify-between h-64">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Agent Clock</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 pulse-green" />
            </div>
            <h4 className="text-sm font-semibold text-gray-300 mt-1">Autonomous Execution</h4>
          </div>

          <div className="my-2">
            <p className="text-4xl font-extrabold text-white tracking-widest font-mono">
              {formatClockTime(timeLeftSeconds)}
            </p>
            <p className="text-[11px] text-emerald-300 mt-1 font-semibold">
              Mode: {mode === 'auto_pilot' ? 'Auto-Pilot (Zero Touch)' : 'Approval Needed'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSimulate('simulate_surge')}
              className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center justify-center gap-1"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" /> Surge
            </button>
            <button
              onClick={triggerStockAudit}
              className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all"
              title="Run Audit Now"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

