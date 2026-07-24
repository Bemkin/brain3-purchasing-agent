import { z } from 'zod';

// ============================================================
// Zod Schemas — Runtime validation for all API boundaries
// ============================================================

// ---- Inventory Schemas ----
export const InventoryItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  unit_price: z.number().nonnegative(),
  cost_price: z.number().nonnegative(),
  current_stock: z.number().int().nonnegative(),
  min_stock_level: z.number().int().nonnegative(),
  max_stock_capacity: z.number().int().positive(),
  reorder_point: z.number().int().nonnegative(),
  avg_daily_sales: z.number().nonnegative(),
  supplier_id: z.string().uuid(),
  is_active: z.boolean(),
  last_restocked_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ---- Purchase Order Schemas ----
export const POStatusEnum = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'acknowledged',
  'cancelled',
]);

export const CreatePOSchema = z.object({
  supplier_id: z.string().uuid(),
  notes: z.string().optional(),
  ai_reasoning: z.string().optional(),
  line_items: z.array(
    z.object({
      inventory_item_id: z.string().uuid(),
      quantity_ordered: z.number().int().positive(),
      unit_cost: z.number().nonnegative(),
    })
  ).min(1),
});

export const UpdatePOStatusSchema = z.object({
  status: POStatusEnum,
  approved_by: z.string().optional(),
});

// ---- AI Response Schemas ----
const UrgencyEnum = z.preprocess(
  (val) => (typeof val === 'string' ? val.toLowerCase() : val),
  z.enum(['critical', 'high', 'medium', 'low'])
);

export const ReorderAnalysisSchema = z.object({
  recommended_quantity: z.number().positive(),
  reasoning: z.string().max(500),
  urgency: UrgencyEnum,
  confidence_score: z.number().min(0).max(1),
  estimated_days_until_stockout: z.number().nonnegative(),
  suggested_reorder_frequency_days: z.number().positive(),
});

export const BatchReorderResponseSchema = z.object({
  supplier_id: z.string().optional(),
  supplier_name: z.string().optional(),
  items: z.array(
    z.object({
      sku: z.string().optional(),
      inventory_item_id: z.string().optional(),
      item_name: z.string().optional(),
      current_stock: z.coerce.number().optional(),
      recommended_quantity: z.coerce.number().positive(),
      unit_cost: z.coerce.number().nonnegative().optional(),
      reasoning: z.string().catch('AI Recommended reorder quantity based on velocity and lead time.'),
      urgency: UrgencyEnum.optional(),
      estimated_days_until_stockout: z.coerce.number().nonnegative().optional(),
    })
  ),
  overall_urgency: UrgencyEnum.optional(),
  total_estimated_cost: z.coerce.number().nonnegative().optional(),
});

// ---- Audit Log Schemas ----
export const AuditActionTypeEnum = z.enum([
  'stock_check_initiated',
  'low_stock_detected',
  'reorder_analysis_requested',
  'reorder_analysis_completed',
  'po_generated',
  'po_approved',
  'po_rejected',
  'po_edited',
  'po_sent',
  'po_cancelled',
  'email_sent',
  'email_failed',
  'ai_error',
  'mode_changed',
  'manual_override',
  'system_error',
  'stock_adjustment',
  'supplier_created',
]);

export const AuditSeverityEnum = z.enum(['info', 'warning', 'error', 'critical']);
export const AuditSourceEnum = z.enum(['ai_agent', 'human', 'system', 'cron', 'email_service']);

export const CreateAuditLogSchema = z.object({
  action_type: AuditActionTypeEnum,
  severity: AuditSeverityEnum,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
  related_po_id: z.string().uuid().optional(),
  related_item_id: z.string().uuid().optional(),
  source: AuditSourceEnum,
});

// ---- Settings Schemas ----
export const OperatingModeEnum = z.enum(['approval', 'auto_pilot']);

export const UpdateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]),
});

// ---- Supplier Schemas ----
export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact_email: z.string().email('Invalid email address'),
  contact_phone: z.string().nullable().optional(),
  lead_time_days: z.coerce.number().int().positive().default(3),
});

export const UpdateSupplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().nullable().optional(),
  lead_time_days: z.coerce.number().int().positive().optional(),
});

// ---- Simulation & Email Action Schemas ----
export const SimulateInventorySchema = z.object({
  action: z.enum(['simulate_surge', 'reset_stock']),
});

export const SendPOEmailSchema = z.object({
  purchaseOrderId: z.string().uuid('Invalid purchase order ID'),
});

// Type inference helpers
export type CreatePO = z.infer<typeof CreatePOSchema>;
export type UpdatePOStatus = z.infer<typeof UpdatePOStatusSchema>;
export type CreateAuditLog = z.infer<typeof CreateAuditLogSchema>;
export type UpdateSetting = z.infer<typeof UpdateSettingSchema>;
export type BatchReorderResponse = z.infer<typeof BatchReorderResponseSchema>;
export type CreateSupplier = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplier = z.infer<typeof UpdateSupplierSchema>;
export type SimulateInventory = z.infer<typeof SimulateInventorySchema>;
export type SendPOEmail = z.infer<typeof SendPOEmailSchema>;

