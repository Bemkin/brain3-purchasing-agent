# 🚀 Brain3 AI Purchasing Agent — Technical Solution & System Walkthrough

**Project Name**: Brain3 — Autonomous AI Purchasing Manager for E-Commerce & Retail  
**Author**: Bemnet Kibret  
**Target Role**: Full Stack AI Web Developer  
**Live Demo**: [https://github.com/Bemkin/brain3-purchasing-agent.git](https://github.com/Bemkin/brain3-purchasing-agent.git)  

---

## 1. 🤖 Executive Overview: The AI Agent
**Brain3** is an autonomous supply chain purchasing agent engineered to replace manual inventory management roles in e-commerce and retail businesses. Powered by **Google Gemini 3.5 Flash Lite**, Brain3 operates 24/7 to monitor stock depletion rates, predict stockouts based on sales velocity and lead times, generate structured purchase orders with natural language reasoning, and dispatch vendor communications without human friction.

---

## 2. 🚨 Problem Statement & Value Proposition
In traditional e-commerce operations, inventory managers spend hours daily:
- Manually auditing stock levels across hundreds of SKUs.
- Calculating reorder points and safety stock buffers.
- Drafting individual purchase orders and emailing suppliers.

**The Business Impact**: Human delays lead to stockouts, lost sales revenue, overstocking capital lockup, and vendor miscommunication. Brain3 completely automates this end-to-end lifecycle—from initial stockout detection to automated HTML PO invoice dispatch.

---

## 3. 🛠️ Technology Stack & Architecture
Brain3 is built using a modern, production-grade, 100% free-tier full-stack architecture:

- **Frontend & UI**: Next.js App Router (React 19), TypeScript, and Vanilla Tailwind CSS featuring the executive Donezo design system.
- **Database Layer**: Supabase PostgreSQL with a fully normalized 3-Normal-Form (3NF) relational schema (`suppliers`, `inventory_items`, `purchase_orders`, `po_line_items`, `ai_audit_logs`, `system_settings`).
- **AI Intelligence**: Google Gemini 3.5 Flash Lite API via `@google/genai` SDK with strict JSON schema enforcement.
- **Email Dispatch**: Resend Email API delivering transactional HTML purchase order invoices.
- **Infrastructure & Automation**: Vercel Serverless hosting paired with automated cron check triggers.

---

## 4. ⚙️ Execution Flow & Deterministic Fallback Engine

### A. Autonomous Audit Execution Flow
1. **Stock Detection**: The system identifies all SKUs where `current_stock <= reorder_point`.
2. **Supplier Grouping**: Low-stock items are grouped by vendor to optimize order batching.
3. **AI Reasoning**: Gemini 3.5 Flash Lite analyzes daily sales velocity (`avg_daily_sales`), safety stock ratios, and supplier lead times (`lead_time_days`) to calculate exact reorder quantities and supply chain urgency.
4. **Structured Order Generation**: Generates PO numbers and writes line items to Supabase.

### B. High-Availability Deterministic Fallback
To ensure **zero supply chain downtime**, Brain3 implements a dual-layer fallback mechanism:
- If the Gemini API experiences network timeouts, rate limits (429), or schema validation errors, the system automatically fails over to a deterministic mathematical baseline formula:
  $$\text{Reorder Quantity} = (2 \times \text{reorder\_point}) - \text{current\_stock}$$
- This guarantees that purchase orders are generated on schedule regardless of external AI service availability.

---

## 5. 🖥️ Core Frontend Feature: Purchase Orders Hub (`/purchase-orders`)
The **Purchase Orders Hub** serves as the central control tower for supply chain operators:

- **Live Gemini AI Reasoning Cards**: Displays natural language supply chain explanations for every order (e.g. *"Mechanical Keyboard RGB: Stock critical (0 days). Covers lead time safety buffer."*).
- **Dual Operating Modes**:
  - **Human-in-the-Loop Approval Mode**: Operators review PO line items, unit costs, and click **`Approve & Dispatch Email`** to trigger live Resend email dispatches.
  - **Zero-Touch Auto-Pilot Mode**: The system automatically approves and dispatches POs instantly upon generation.
- **Interactive Controls**: Filter orders by status (`Pending Approval`, `Approved`, `Sent`, `Cancelled`), export CSV data, and print formatted PDF PO invoices.

---

## 6. ⚡ Core Backend Engine: Serverless Cron Automation (`check-stock/route.ts`)
The core backend intelligence resides in `src/app/api/cron/check-stock/route.ts`:

- **Single JOIN Query Performance**: Replaced N+1 query loops with a single Supabase PostgreSQL JOIN query (`supplier:suppliers(...)`, `line_items:po_line_items(...)`), returning data in **< 30ms**.
- **Ultra-Fast Generation**: Configured Gemini 3.5 Flash Lite with `temperature: 0` and `maxOutputTokens: 2048`, cutting stock audit execution time down to **~5 seconds**.
- **In-Memory Email Dispatch**: Executes `dispatchPOEmail(poId)` in-memory to prevent HTTP loopback latency on serverless deployments.
- **Immutable Audit Logging**: Every action, API request, fallback event, and email delivery is recorded in `ai_audit_logs`.

---

## 🏆 Summary
Brain3 demonstrates full-stack software engineering, AI agent design, high-availability fallback architecture, and production readiness. All code is type-checked, committed to GitHub, and live on Vercel.
