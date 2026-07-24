'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Mail, Clock, Package, Plus, Search,
  Edit2, ShieldCheck, AlertTriangle, DollarSign, X
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils/helpers';
import { fetchWithCache, invalidateCache } from '@/lib/utils/cache';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  reorder_point: number;
}

interface Supplier {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string | null;
  lead_time_days: number;
  created_at: string;
  total_skus: number;
  low_stock_skus: number;
  total_pos: number;
  total_spend: number;
  items: InventoryItem[];
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    lead_time_days: '3',
  });

  const fetchSuppliers = useCallback(async (forceFresh = false) => {
    try {
      const data = await fetchWithCache<{ suppliers: Supplier[] }>('/api/suppliers', forceFresh);
      setSuppliers(data.suppliers || []);
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const data = await fetchWithCache<{ suppliers: Supplier[] }>('/api/suppliers');
        if (!ignore) {
          setSuppliers(data.suppliers || []);
        }
      } catch {
        if (!ignore) toast.error('Failed to load suppliers');
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contact_email) {
      toast.error('Name and contact email are required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(`Supplier "${formData.name}" created!`);
        setIsAddModalOpen(false);
        setFormData({ name: '', contact_email: '', contact_phone: '', lead_time_days: '3' });
        invalidateCache('/api/suppliers');
        fetchSuppliers(true);
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to create supplier');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSupplier.id,
          name: formData.name,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone,
          lead_time_days: Number(formData.lead_time_days) || 3,
        }),
      });

      if (res.ok) {
        toast.success(`Supplier updated successfully!`);
        setIsEditModalOpen(false);
        setEditingSupplier(null);
        invalidateCache('/api/suppliers');
        fetchSuppliers(true);
      } else {
        toast.error('Failed to update supplier');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_email: supplier.contact_email,
      contact_phone: supplier.contact_phone || '',
      lead_time_days: String(supplier.lead_time_days),
    });
    setIsEditModalOpen(true);
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contact_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSuppliers = suppliers.length;
  const avgLeadTime =
    suppliers.length > 0
      ? (suppliers.reduce((acc, s) => acc + s.lead_time_days, 0) / suppliers.length).toFixed(1)
      : '0';
  const totalSpendAll = suppliers.reduce((acc, s) => acc + s.total_spend, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-12 w-72 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-3xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-56 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Suppliers Directory</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Manage vendor profiles, lead times, supplied SKUs, and procurement history.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({ name: '', contact_email: '', contact_phone: '', lead_time_days: '3' });
            setIsAddModalOpen(true);
          }}
          className="btn-forest flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add New Supplier
        </button>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card-brain3 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Active Suppliers</span>
            <div className="btn-arrow-circle">
              <Building2 className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-gray-900 mt-3">{totalSuppliers}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Verified enterprise vendors</p>
        </div>

        <div className="card-brain3 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Avg Lead Time</span>
            <div className="btn-arrow-circle">
              <Clock className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-gray-900 mt-3">{avgLeadTime} <span className="text-lg font-normal text-gray-500">days</span></p>
          <p className="text-xs text-gray-500 mt-1 font-medium">Fulfillment window expectation</p>
        </div>

        <div className="card-hero-forest p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Total Spend</span>
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-white mt-3">{formatCurrency(totalSpendAll)}</p>
          <p className="text-xs text-emerald-200 mt-1 font-medium">Fulfilled purchase order volume</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card-brain3 p-4 flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search suppliers by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400 placeholder:font-normal"
        />
      </div>

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredSuppliers.map((supplier) => {
          const initials = supplier.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

          return (
            <div key={supplier.id} className="card-brain3 p-6 flex flex-col justify-between space-y-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center font-extrabold text-base shadow-sm">
                    {initials}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 leading-snug">{supplier.name}</h3>
                    <p className="text-xs font-medium text-gray-500 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-gray-400" />
                      {supplier.contact_email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => openEditModal(supplier)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                  title="Edit Supplier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Stat Pills */}
              <div className="grid grid-cols-3 gap-2.5 bg-gray-50/80 p-3 rounded-2xl border border-gray-100 text-center">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Supplied SKUs</p>
                  <p className="text-sm font-extrabold text-gray-900 mt-0.5">{supplier.total_skus} SKUs</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lead Time</p>
                  <p className="text-sm font-extrabold text-emerald-800 mt-0.5">{supplier.lead_time_days} days</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total PO Spend</p>
                  <p className="text-sm font-extrabold text-gray-900 mt-0.5">{formatCurrency(supplier.total_spend)}</p>
                </div>
              </div>

              {/* Status & Actions Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                {supplier.low_stock_skus > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    {supplier.low_stock_skus} SKUs Need Reorder
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    All Stock Healthy
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedSupplier(supplier)}
                    className="btn-outline-brain3 text-xs py-1.5 px-3"
                  >
                    <Package className="w-3.5 h-3.5" />
                    View SKUs ({supplier.total_skus})
                  </button>

                  <a
                    href={`mailto:${supplier.contact_email}?subject=Brain3 Procurement Inquiry`}
                    className="btn-forest text-xs py-1.5 px-3"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal 1: View Supplied Items Drawer */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="card-brain3 max-w-2xl w-full p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">{selectedSupplier.name}</h3>
                <p className="text-xs font-medium text-gray-500 mt-0.5">Supplied Inventory Catalog ({selectedSupplier.items.length} items)</p>
              </div>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedSupplier.items.length === 0 ? (
                <p className="text-sm font-medium text-gray-500 text-center py-6">No inventory items assigned to this vendor yet.</p>
              ) : (
                selectedSupplier.items.map((item) => {
                  const isLow = item.current_stock <= item.reorder_point;
                  return (
                    <div key={item.id} className="p-3.5 bg-gray-50 rounded-2xl flex items-center justify-between gap-3 border border-gray-100">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{item.name}</p>
                        <p className="text-xs font-mono text-gray-400 mt-0.5">SKU: {item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-gray-900">{item.current_stock} units</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                          isLow ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          {isLow ? `Reorder Point: ${item.reorder_point}` : 'Healthy'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Add / Edit Supplier Dialog */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="card-brain3 max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-xl font-extrabold text-gray-900">
                {isEditModalOpen ? 'Edit Supplier Profile' : 'Add New Supplier'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={isEditModalOpen ? handleUpdateSupplier : handleCreateSupplier} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Company / Vendor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nexus Electronics Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:border-[#064e3b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Contact Email *</label>
                <input
                  type="email"
                  required
                  placeholder="orders@vendor.com"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:border-[#064e3b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+1 555-0192"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:border-[#064e3b]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formData.lead_time_days}
                    onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:border-[#064e3b]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="btn-outline-brain3 text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-forest text-xs py-2 px-5 disabled:opacity-50">
                  {submitting ? 'Saving...' : isEditModalOpen ? 'Save Changes' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
