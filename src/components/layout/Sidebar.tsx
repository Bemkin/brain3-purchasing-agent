'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  ShoppingCart,
  Building2,
  ScrollText,
  Settings,
  Sparkles,
  Bot,
  X
} from 'lucide-react';

const generalItems = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [poCount, setPoCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/purchase-orders?pageSize=1')
      .then((res) => res.json())
      .then((data) => {
        if (data.total !== undefined) {
          setPoCount(data.total);
        } else if (data.purchase_orders) {
          setPoCount(data.purchase_orders.length);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch PO count for sidebar badge:', err);
      });
  }, [pathname]);

  const menuItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, count: poCount !== null ? String(poCount) : undefined },
    { href: '/suppliers', label: 'Suppliers', icon: Building2 },
    { href: '/audit-log', label: 'Audit Log', icon: ScrollText },
  ];

  const content = (
    <div className="w-65 h-full bg-[#eaedf1] flex flex-col justify-between p-6 overflow-y-auto border-r border-slate-300/90 shadow-xs">
      <div className="space-y-8">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#064e3b] flex items-center justify-center text-white shadow-md shadow-[#064e3b]/20">
              <Bot className="w-5 h-5 text-[#34d399]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight font-sans">Brain3</h1>
              <p className="text-[11px] font-semibold text-emerald-700 tracking-wide uppercase">AI Purchasing</p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation - MENU */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2">Menu</p>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold
                    transition-all duration-200 relative group
                    ${isActive
                      ? 'text-gray-900 bg-gray-50'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/80'
                    }
                  `}
                >
                  {/* Active Green Indicator Bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#064e3b] rounded-r-full" />
                  )}

                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-[#064e3b]' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.count !== undefined && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#064e3b] text-white">
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Navigation - GENERAL */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2">General</p>
          <nav className="space-y-1">
            {generalItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold
                    transition-all duration-200 relative group
                    ${isActive
                      ? 'text-gray-900 bg-gray-50'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/80'
                    }
                  `}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#064e3b] rounded-r-full" />
                  )}

                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-[#064e3b]' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Promo / Agent Status Card */}
      <div className="card-dark-wave p-5 space-y-3 mt-6">
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-[#34d399]" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">Autonomous Agent</p>
          <p className="text-xs text-gray-300 mt-1">Gemini AI engine active</p>
        </div>
        <Link
          href="/settings"
          onClick={() => {
            toast.success('AI Engine Operational', {
              description: 'Gemini AI Engine • Supabase PostgreSQL Connected • Resend Active',
            });
            if (onClose) onClose();
          }}
          className="block w-full py-2.5 px-3 bg-[#059669] hover:bg-[#047857] text-white text-center rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
        >
          Operational — Change Mode
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 border-r border-gray-100 h-screen">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <div className="relative z-10 animate-slide-in">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
