import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

export const genAI = new GoogleGenAI({ apiKey });

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/**
 * Build the system prompt for reorder analysis.
 * Includes explicit guardrails to constrain AI output.
 */
export function buildReorderSystemPrompt(): string {
  return `You are an expert supply chain AI purchasing agent for an e-commerce company. 
Your job is to analyze inventory levels and recommend optimal purchase order quantities.

## STRICT RULES (NEVER VIOLATE):
1. NEVER recommend ordering more units than (max_stock_capacity - current_stock) for any item.
2. ONLY use suppliers from the provided supplier list — do NOT invent supplier names or IDs.
3. ALWAYS consider the supplier's lead_time_days when calculating urgency.
4. If avg_daily_sales is 0, use a conservative estimate of 1 unit per day.
5. Factor in the cost_price when calculating total costs — use the exact cost_price provided.
6. Set urgency based on estimated days until stockout:
   - critical: 0-2 days
   - high: 3-5 days  
   - medium: 6-14 days
   - low: 15+ days
7. Your recommended_quantity should cover at least (lead_time_days * avg_daily_sales * 1.5) to provide a safety buffer.
8. Return ONLY valid JSON matching the exact schema provided. No additional text or explanation outside the JSON.`;
}

export function buildReorderUserPrompt(items: {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  min_stock_level: number;
  max_stock_capacity: number;
  reorder_point: number;
  avg_daily_sales: number;
  cost_price: number;
  supplier_name: string;
  supplier_id: string;
  lead_time_days: number;
}[]): string {
  // Concise input structure
  const compactItems = items.map((i) => ({
    sku: i.sku,
    name: i.name,
    stock: i.current_stock,
    reorder_point: i.reorder_point,
    max_cap: i.max_stock_capacity,
    daily_sales: i.avg_daily_sales,
    cost: i.cost_price,
    supplier_id: i.supplier_id,
    supplier_name: i.supplier_name,
    lead_time: i.lead_time_days,
  }));

  return `Analyze these low-stock inventory items and recommend purchase order quantities grouped by supplier.

## INVENTORY DATA:
${JSON.stringify(compactItems)}

## OUTPUT FORMAT (JSON ARRAY):
[
  {
    "supplier_id": "<supplier_id>",
    "supplier_name": "<supplier_name>",
    "items": [
      {
        "sku": "<sku>",
        "item_name": "<name>",
        "current_stock": <number>,
        "recommended_quantity": <positive_number>,
        "unit_cost": <number>,
        "reasoning": "<short reasoning, max 100 chars>",
        "urgency": "<critical|high|medium|low>",
        "estimated_days_until_stockout": <number>
      }
    ],
    "overall_urgency": "<critical|high|medium|low>",
    "total_estimated_cost": <total_cost>
  }
]

Respond ONLY with the JSON array.`;
}
