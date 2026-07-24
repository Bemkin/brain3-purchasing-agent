-- ============================================================
-- Brain3 Purchasing Agent — PostgreSQL Schema (3NF)
-- Autonomous AI Purchasing Manager for E-Commerce / Retail
-- ============================================================

-- 1. Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    contact_email   TEXT NOT NULL,
    contact_phone   TEXT,
    lead_time_days  INTEGER NOT NULL DEFAULT 7 CHECK (lead_time_days > 0),
    rating          NUMERIC(3,2) NOT NULL DEFAULT 5.00 CHECK (rating >= 0 AND rating <= 5),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Inventory Items
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku                 TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    category            TEXT NOT NULL,
    unit_price          NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    cost_price          NUMERIC(10,2) NOT NULL CHECK (cost_price >= 0),
    current_stock       INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock_level     INTEGER NOT NULL DEFAULT 10 CHECK (min_stock_level >= 0),
    max_stock_capacity  INTEGER NOT NULL DEFAULT 1000 CHECK (max_stock_capacity > 0),
    reorder_point       INTEGER NOT NULL DEFAULT 25 CHECK (reorder_point >= 0),
    avg_daily_sales     NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (avg_daily_sales >= 0),
    supplier_id         UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    last_restocked_at   TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT reorder_below_capacity CHECK (reorder_point < max_stock_capacity),
    CONSTRAINT min_below_capacity CHECK (min_stock_level < max_stock_capacity)
);

-- 3. Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number       TEXT NOT NULL UNIQUE,
    supplier_id     UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','pending_approval','approved','sent','acknowledged','cancelled')),
    total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    currency        TEXT NOT NULL DEFAULT 'USD',
    notes           TEXT,
    ai_reasoning    TEXT,
    created_by      TEXT NOT NULL DEFAULT 'ai_agent',
    approved_by     TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PO Line Items (junction table — normalized)
CREATE TABLE IF NOT EXISTS public.po_line_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id   UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    inventory_item_id   UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    quantity_ordered    INTEGER NOT NULL CHECK (quantity_ordered > 0),
    unit_cost           NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
    total_cost          NUMERIC(12,2) NOT NULL CHECK (total_cost >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. AI Audit Logs
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type     TEXT NOT NULL
                    CHECK (action_type IN (
                        'stock_check_initiated','low_stock_detected','reorder_analysis_requested',
                        'reorder_analysis_completed','po_generated','po_approved','po_rejected',
                        'po_edited','po_sent','po_cancelled','email_sent','email_failed',
                        'ai_error','mode_changed','manual_override','system_error',
                        'stock_adjustment','supplier_created'
                    )),
    severity        TEXT NOT NULL DEFAULT 'info'
                    CHECK (severity IN ('info','warning','error','critical')),
    message         TEXT NOT NULL,
    details         JSONB,
    related_po_id   UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    related_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    source          TEXT NOT NULL DEFAULT 'system'
                    CHECK (source IN ('ai_agent','human','system','cron','email_service')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key             TEXT NOT NULL UNIQUE,
    value           JSONB NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes for Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier_id ON public.inventory_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON public.inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_reorder ON public.inventory_items(current_stock, reorder_point) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_items_active_stock ON public.inventory_items(is_active, current_stock ASC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at ON public.purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status_created ON public.purchase_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_po_id ON public.po_line_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_item_id ON public.po_line_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.ai_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.ai_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_created ON public.ai_audit_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_source_created ON public.ai_audit_logs(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_po_id ON public.ai_audit_logs(related_po_id) WHERE related_po_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_compound ON public.ai_audit_logs(action_type, severity, source, created_at DESC);

-- ============================================================
-- Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DROP TRIGGER IF EXISTS set_updated_at_suppliers ON public.suppliers;
CREATE TRIGGER set_updated_at_suppliers
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_inventory_items ON public.inventory_items;
CREATE TRIGGER set_updated_at_inventory_items
    BEFORE UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_purchase_orders ON public.purchase_orders;
CREATE TRIGGER set_updated_at_purchase_orders
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_system_settings ON public.system_settings;
CREATE TRIGGER set_updated_at_system_settings
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
