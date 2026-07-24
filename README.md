# 🤖 Brain3 — Autonomous AI Purchasing Agent

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini-3.5%20Flash%20Lite-8E75B2?logo=google)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![Resend](https://img.shields.io/badge/Resend-Email%20API-000000)](https://resend.com/)

> **Brain3** is an enterprise-grade, zero-touch autonomous purchasing agent designed to continuously monitor inventory levels, predict stock depletion, generate AI-optimized purchase orders, and dispatch supplier emails autonomously.

---

## 🌟 Key Architecture & Capabilities

### 1. Dual-Node Operating System
- **Auto-Pilot Mode (Zero Touch)**: Fully autonomous procurement. The AI agent audits stock, calculates optimal reorder quantities, generates POs, approves orders within threshold ceiling, and sends supplier emails automatically.
- **Approval Mode (Human-in-the-Loop)**: AI generates draft PO recommendations with detailed reasoning, queuing them for human operator sign-off before dispatch.

### 2. Gemini 3.5 Flash Lite + Zod Schema Validation
- Consolidates low-stock inventory audit items into a single parallel batch request to Gemini `gemini-3.5-flash-lite` (optimizing for 15 RPM / 250K TPM rate limits).
- Enforces strict JSON schema validation via **Zod** (`BatchReorderResponseSchema`).

### 3. Fail-Safe Mathematical Engineering
- If Gemini API quota or network errors occur, the pipeline gracefully falls back to deterministic mathematical reorder engineering:
  $$\text{Reorder Quantity} = \min\left((\text{Reorder Point} \times 2) - \text{Current Stock}, \, \text{Max Capacity} - \text{Current Stock}\right)$$
- Guarantees zero system downtime and continuous business continuity.

### 4. Executive Light Dashboard Aesthetic
- Modern executive UI inspired by the Donezo Light SaaS dashboard.
- **Color Palette**: Solid Forest Green (`#064e3b`), Emerald Green (`#059669`), Off-White canvas (`#f3f4f6`), and crisp white card containers (`24px` radius).
- **Interactive Header**: `⌘F` / `Ctrl+F` global search shortcut, live instant search dropdown, supplier email logs popover, and system alerts notification drawer.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16.2.11 (App Router + Turbopack) |
| **Language** | TypeScript (Strict Mode) |
| **AI Model** | Google Gemini `gemini-3.5-flash-lite` via `@google/genai` SDK |
| **Database** | Supabase PostgreSQL 3NF (`suppliers`, `inventory_items`, `purchase_orders`, `po_line_items`, `system_settings`, `ai_audit_logs`) |
| **Email Service** | Resend API (`resend`) |
| **Styling & UI** | Vanilla CSS + TailwindCSS + Lucide Icons + Sonner Toasts |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18+`
- **npm**: `v9+`

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd brain3-purchasing-agent
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the project root:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google Gemini AI Key
GEMINI_API_KEY=your-gemini-api-key

# Resend Email API Key
RESEND_API_KEY=your-resend-api-key
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Endpoints Reference

| Route | Method | Description |
| :--- | :---: | :--- |
| `/api/cron/check-stock` | `POST` | Core automation engine executing stock audit, Gemini AI batch analysis, and PO generation. |
| `/api/inventory` | `GET` | Fetches active inventory items with supplier details. |
| `/api/purchase-orders` | `GET / PATCH` | Fetches PO list / updates PO approval status. |
| `/api/email/send-po` | `POST` | Dispatches PO invoice email to vendor supplier via Resend. |
| `/api/inventory/simulate` | `POST` | Simulates randomized sales surge or resets stock capacity. |
| `/api/settings` | `GET / PUT` | Retrieves and updates operating mode and threshold settings. |

---

## 🛡️ Verification & Build Commands

```bash
# Type check and production build
npx next build

# Code linting
npm run lint
```

---

## 📄 License
Internal Proprietary Enterprise Project — Created for Brain3 Purchasing Automation.
