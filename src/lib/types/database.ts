// ============================================================
// Database Types — Strict TypeScript types matching our 3NF schema
// ============================================================

// ---- Suppliers ----
export interface Supplier {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string | null;
  lead_time_days: number;
  rating: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Inventory Items ----
export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit_price: number;
  cost_price: number;
  current_stock: number;
  min_stock_level: number;
  max_stock_capacity: number;
  reorder_point: number;
  avg_daily_sales: number;
  supplier_id: string;
  is_active: boolean;
  last_restocked_at: string | null;
  created_at: string;
  updated_at: string;
}

// With joined supplier data
export interface InventoryItemWithSupplier extends InventoryItem {
  supplier: Pick<Supplier, 'id' | 'name' | 'contact_email' | 'lead_time_days'>;
}

// ---- Purchase Orders ----
export type POStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'acknowledged'
  | 'cancelled';

export interface PurchaseOrder {
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
  updated_at: string;
}

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  supplier: Pick<Supplier, 'id' | 'name' | 'contact_email'>;
  line_items: POLineItemWithProduct[];
}

// ---- PO Line Items ----
export interface POLineItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string;
  quantity_ordered: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
}

export interface POLineItemWithProduct extends POLineItem {
  inventory_item: Pick<InventoryItem, 'id' | 'name' | 'sku' | 'current_stock'>;
}

// ---- AI Audit Logs ----
export type AuditActionType =
  | 'stock_check_initiated'
  | 'low_stock_detected'
  | 'reorder_analysis_requested'
  | 'reorder_analysis_completed'
  | 'po_generated'
  | 'po_approved'
  | 'po_rejected'
  | 'po_edited'
  | 'po_sent'
  | 'po_cancelled'
  | 'email_sent'
  | 'email_failed'
  | 'ai_error'
  | 'mode_changed'
  | 'manual_override'
  | 'system_error';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AuditSource = 'ai_agent' | 'human' | 'system' | 'cron' | 'email_service';

export interface AuditLog {
  id: string;
  action_type: AuditActionType;
  severity: AuditSeverity;
  message: string;
  details: Record<string, unknown> | null;
  related_po_id: string | null;
  related_item_id: string | null;
  source: AuditSource;
  created_at: string;
}

// ---- System Settings ----
export type OperatingMode = 'approval' | 'auto_pilot';

export interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

// ---- AI Response Types ----
export interface ReorderAnalysis {
  recommended_quantity: number;
  reasoning: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  confidence_score: number;
  estimated_days_until_stockout: number;
  suggested_reorder_frequency_days: number;
}

export interface StockCheckResult {
  items_checked: number;
  low_stock_items: number;
  pos_generated: number;
  pos_auto_sent: number;
  errors: number;
  mode: OperatingMode;
  timestamp: string;
}
