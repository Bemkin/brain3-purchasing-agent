'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Bell, Mail, Menu, Package, FileText, Bot, X, CheckCircle2, AlertTriangle, ArrowRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatRelativeTime } from '@/lib/utils/helpers';
import type { InventoryItem, PurchaseOrder } from '@/lib/types/database';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

interface SearchItem {
  id: string;
  type: 'inventory' | 'po' | 'log';
  title: string;
  subtitle: string;
  badge?: string;
  url: string;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [mailOpen, setMailOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; text: string; time: string; read: boolean; type: 'warning' | 'info' | 'success' }>>([]);
  const [emailLogs, setEmailLogs] = useState<Array<{ id: string; po_number: string; recipient: string; subject: string; sent_at: string }>>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 1. Global Keyboard Shortcut (⌘F or Ctrl+F) listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setMailOpen(false);
        setBellOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 2. Fetch Notifications & Email logs
  useEffect(() => {
    // Fetch inventory for low stock alerts
    fetch('/api/inventory')
      .then((res) => res.json())
      .then((data) => {
        const items: InventoryItem[] = data.items || [];
        const low = items.filter((i) => i.current_stock <= i.reorder_point);
        const notifs = low.map((item) => ({
          id: `low-${item.id}`,
          title: `Low Stock Alert: ${item.name}`,
          text: `Current stock: ${item.current_stock} (Reorder point: ${item.reorder_point})`,
          time: 'Just now',
          read: false,
          type: item.current_stock === 0 ? ('warning' as const) : ('info' as const),
        }));
        setNotifications(notifs);
      })
      .catch((err) => {
        toast.error('Failed to load stock alerts');
      });

    // Fetch POs for mail log
    fetch('/api/purchase-orders')
      .then((res) => res.json())
      .then((data) => {
        const orders: (PurchaseOrder & { supplier?: { contact_email?: string } })[] = data.purchase_orders || [];
        const logs = orders.map((po) => ({
          id: po.id,
          po_number: po.po_number,
          recipient: po.supplier?.contact_email || 'supplier@vendor.com',
          subject: `Purchase Order ${po.po_number} from Donezo/Brain3`,
          sent_at: po.sent_at || po.created_at,
        }));
        setEmailLogs(logs);
      })
      .catch(() => {});
  }, []);

  // 3. Live search query execution
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    const q = searchQuery.toLowerCase();

    Promise.all([
      fetch('/api/inventory').then((r) => r.json()),
      fetch('/api/purchase-orders').then((r) => r.json()),
    ])
      .then(([invData, poData]) => {
        const invItems: SearchItem[] = ((invData.items || []) as InventoryItem[])
          .filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
          .slice(0, 4)
          .map((i) => ({
            id: i.id,
            type: 'inventory',
            title: i.name,
            subtitle: `SKU: ${i.sku} • Stock: ${i.current_stock}/${i.max_stock_capacity}`,
            badge: i.current_stock <= i.reorder_point ? 'Low Stock' : 'Healthy',
            url: `/?item=${i.id}`,
          }));

        const poItems: SearchItem[] = ((poData.purchase_orders || []) as (PurchaseOrder & { supplier?: { name?: string } })[])
          .filter((po) => po.po_number.toLowerCase().includes(q) || po.supplier?.name?.toLowerCase().includes(q))
          .slice(0, 4)
          .map((po) => ({
            id: po.id,
            type: 'po',
            title: `PO ${po.po_number}`,
            subtitle: `${po.supplier?.name || 'Supplier'} • ${formatCurrency(Number(po.total_amount))}`,
            badge: po.status.replace('_', ' '),
            url: `/purchase-orders?po=${po.id}`,
          }));

        setSearchResults([...invItems, ...poItems]);
      })
      .catch(() => {})
      .finally(() => setLoadingSearch(false));
  }, [searchQuery]);

  // Click outside listener for search & popovers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="bg-white px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-slate-300 shadow-xs shrink-0 gap-3 relative z-30">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Toggle Button */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Input Container with Live Dropdown */}
        <div ref={searchContainerRef} className="relative w-full max-w-xs sm:w-80 md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search inventory, POs, suppliers..."
            className="w-full bg-white border border-gray-200/80 rounded-full pl-10 pr-12 py-2 text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#064e3b] focus:ring-2 focus:ring-[#064e3b]/10 shadow-sm transition-all"
          />
          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="hidden sm:block absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
              ⌘F
            </span>
          )}

          {/* Floating Search Results Dropdown */}
          {searchOpen && searchQuery.trim() !== '' && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <span>Search Results</span>
                <span>{loadingSearch ? 'Searching...' : `${searchResults.length} matches`}</span>
              </div>

              {searchResults.length === 0 && !loadingSearch ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  No matching inventory items or purchase orders found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {searchResults.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => {
                        router.push(item.url);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-emerald-50/60 flex items-center justify-between text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-100 group-hover:bg-[#064e3b] text-gray-600 group-hover:text-white flex items-center justify-center transition-colors">
                          {item.type === 'inventory' ? <Package className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 group-hover:text-[#064e3b]">{item.title}</p>
                          <p className="text-[11px] text-gray-400 font-medium">{item.subtitle}</p>
                        </div>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-mono">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center gap-2 sm:gap-4 relative">
        {/* Mail Button */}
        <div className="relative">
          <button
            onClick={() => {
              setMailOpen(!mailOpen);
              setBellOpen(false);
            }}
            className="hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-gray-200 items-center justify-center text-gray-600 hover:text-[#064e3b] hover:bg-emerald-50/50 shadow-sm transition-all"
            title="Supplier Email Logs"
          >
            <Mail className="w-4 h-4" />
          </button>

          {/* Mail Popover */}
          {mailOpen && (
            <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-white rounded-3xl border border-gray-100 shadow-2xl z-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#064e3b]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
                    Dispatched Supplier Emails
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Resend API
                </span>
              </div>

              {emailLogs.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No emails dispatched yet</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {emailLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-left space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 font-mono">{log.po_number}</span>
                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> SENT
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 font-medium truncate">To: {log.recipient}</p>
                      <p className="text-[10px] text-gray-400">{formatRelativeTime(log.sent_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bell Notifications Button */}
        <div className="relative">
          <button
            onClick={() => {
              setBellOpen(!bellOpen);
              setMailOpen(false);
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:text-[#064e3b] hover:bg-emerald-50/50 shadow-sm transition-all relative"
            title="System Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute top-2 right-2 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Bell Popover Drawer */}
          {bellOpen && (
            <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-white rounded-3xl border border-gray-100 shadow-2xl z-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#064e3b]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
                    System Alerts ({unreadCount})
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-bold text-[#064e3b] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">All stock levels healthy — no active alerts</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        n.type === 'warning' ? 'bg-red-50/60 border-red-100' : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${n.type === 'warning' ? 'text-red-600' : 'text-amber-600'}`} />
                        <div>
                          <p className="text-xs font-bold text-gray-900">{n.title}</p>
                          <p className="text-[11px] text-gray-600 mt-0.5 font-medium">{n.text}</p>
                          <span className="text-[10px] text-gray-400 mt-1 block">{n.time}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2.5 sm:pl-2 sm:border-l sm:border-gray-200">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#064e3b] text-white font-bold flex items-center justify-center text-xs sm:text-sm shadow-md">
            TM
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-bold text-gray-900 leading-tight">Totok Michael</p>
            <p className="text-[11px] font-medium text-gray-500">tmichael20@gmail.com</p>
          </div>
        </div>
      </div>
    </header>
  );
}
