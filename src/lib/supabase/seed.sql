-- ============================================================
-- Brain3 Purchasing Agent — Seed Data
-- Realistic E-Commerce Inventory for Demo
-- ============================================================

-- ---- 5 Suppliers ----
INSERT INTO public.suppliers (id, name, contact_email, contact_phone, lead_time_days, rating) VALUES
('a1b2c3d4-0001-4000-8000-000000000001', 'TechSource Electronics', 'orders@techsource-electronics.com', '+1-555-0101', 5, 4.80),
('a1b2c3d4-0002-4000-8000-000000000002', 'Global Gadgets Inc.', 'procurement@globalgadgets.com', '+1-555-0202', 7, 4.50),
('a1b2c3d4-0003-4000-8000-000000000003', 'HomeGoods Direct', 'supply@homegoodsdirect.com', '+1-555-0303', 3, 4.90),
('a1b2c3d4-0004-4000-8000-000000000004', 'FitGear Wholesale', 'orders@fitgearwholesale.com', '+1-555-0404', 10, 4.20),
('a1b2c3d4-0005-4000-8000-000000000005', 'OfficePro Supplies', 'bulk@officeprosupplies.com', '+1-555-0505', 4, 4.70);

-- ---- 15 Inventory Items (Mix of low-stock, healthy-stock, and critical) ----

-- TechSource Electronics items
INSERT INTO public.inventory_items (id, sku, name, category, unit_price, cost_price, current_stock, min_stock_level, max_stock_capacity, reorder_point, avg_daily_sales, supplier_id, last_restocked_at) VALUES
('b1c2d3e4-0001-4000-8000-000000000001', 'ELEC-WH-1000', 'Wireless Headphones Pro', 'Electronics', 79.99, 32.00, 8, 15, 500, 30, 4.50, 'a1b2c3d4-0001-4000-8000-000000000001', '2026-07-10T10:00:00Z'),
('b1c2d3e4-0002-4000-8000-000000000002', 'ELEC-USB-C50', 'USB-C Hub 7-in-1', 'Electronics', 49.99, 18.50, 3, 10, 300, 20, 3.20, 'a1b2c3d4-0001-4000-8000-000000000001', '2026-07-05T10:00:00Z'),
('b1c2d3e4-0003-4000-8000-000000000003', 'ELEC-CHRG-W1', 'Wireless Charging Pad', 'Electronics', 29.99, 11.00, 45, 20, 400, 40, 2.80, 'a1b2c3d4-0001-4000-8000-000000000001', '2026-07-18T10:00:00Z'),

-- Global Gadgets items
('b1c2d3e4-0004-4000-8000-000000000004', 'GADG-SPK-BT1', 'Bluetooth Speaker Mini', 'Gadgets', 39.99, 15.00, 12, 15, 350, 25, 3.80, 'a1b2c3d4-0002-4000-8000-000000000002', '2026-07-12T10:00:00Z'),
('b1c2d3e4-0005-4000-8000-000000000005', 'GADG-CAM-WB1', 'HD Webcam 1080p', 'Gadgets', 59.99, 22.00, 0, 10, 200, 15, 2.10, 'a1b2c3d4-0002-4000-8000-000000000002', '2026-06-28T10:00:00Z'),
('b1c2d3e4-0006-4000-8000-000000000006', 'GADG-PWR-BK1', 'Power Bank 20000mAh', 'Gadgets', 44.99, 19.00, 85, 20, 400, 35, 1.90, 'a1b2c3d4-0002-4000-8000-000000000002', '2026-07-20T10:00:00Z'),

-- HomeGoods Direct items
('b1c2d3e4-0007-4000-8000-000000000007', 'HOME-MUG-SS1', 'Smart Mug Temperature Control', 'Home & Kitchen', 34.99, 14.00, 5, 10, 300, 20, 5.20, 'a1b2c3d4-0003-4000-8000-000000000003', '2026-07-08T10:00:00Z'),
('b1c2d3e4-0008-4000-8000-000000000008', 'HOME-LMP-LD1', 'LED Desk Lamp Adjustable', 'Home & Kitchen', 42.99, 17.50, 22, 15, 250, 25, 2.40, 'a1b2c3d4-0003-4000-8000-000000000003', '2026-07-15T10:00:00Z'),
('b1c2d3e4-0009-4000-8000-000000000009', 'HOME-SCL-DG1', 'Digital Kitchen Scale', 'Home & Kitchen', 24.99, 9.50, 120, 25, 500, 50, 3.10, 'a1b2c3d4-0003-4000-8000-000000000003', '2026-07-22T10:00:00Z'),

-- FitGear Wholesale items
('b1c2d3e4-0010-4000-8000-000000000010', 'FIT-MAT-YG1', 'Premium Yoga Mat', 'Fitness', 29.99, 10.00, 2, 10, 400, 20, 4.70, 'a1b2c3d4-0004-4000-8000-000000000004', '2026-07-01T10:00:00Z'),
('b1c2d3e4-0011-4000-8000-000000000011', 'FIT-BTL-WTR', 'Insulated Water Bottle 32oz', 'Fitness', 19.99, 7.00, 65, 20, 600, 40, 6.30, 'a1b2c3d4-0004-4000-8000-000000000004', '2026-07-19T10:00:00Z'),
('b1c2d3e4-0012-4000-8000-000000000012', 'FIT-BND-RS1', 'Resistance Band Set (5pc)', 'Fitness', 24.99, 8.50, 18, 15, 350, 25, 3.50, 'a1b2c3d4-0004-4000-8000-000000000004', '2026-07-14T10:00:00Z'),

-- OfficePro Supplies items
('b1c2d3e4-0013-4000-8000-000000000013', 'OFFC-KBD-MK1', 'Mechanical Keyboard RGB', 'Office', 89.99, 38.00, 7, 10, 200, 15, 2.00, 'a1b2c3d4-0005-4000-8000-000000000005', '2026-07-11T10:00:00Z'),
('b1c2d3e4-0014-4000-8000-000000000014', 'OFFC-MSE-ER1', 'Ergonomic Mouse Wireless', 'Office', 54.99, 21.00, 35, 15, 300, 25, 1.70, 'a1b2c3d4-0005-4000-8000-000000000005', '2026-07-17T10:00:00Z'),
('b1c2d3e4-0015-4000-8000-000000000015', 'OFFC-MON-ST1', 'Monitor Stand Adjustable', 'Office', 39.99, 16.00, 50, 10, 200, 20, 1.20, 'a1b2c3d4-0005-4000-8000-000000000005', '2026-07-21T10:00:00Z');

-- ---- System Settings (Pre-seeded defaults) ----
INSERT INTO public.system_settings (key, value) VALUES
('operating_mode', '"approval"'),
('stock_check_interval_hours', '6'),
('po_approval_threshold_usd', '500'),
('ai_model', '"gemini-3.5-flash-lite"'),
('email_notifications_enabled', 'true'),
('max_auto_pilot_po_amount', '1000'),
('last_stock_check', 'null');
