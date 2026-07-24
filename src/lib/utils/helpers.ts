/**
 * PO Number Generator
 * Format: PO-YYYY-NNNN (e.g., PO-2026-0001)
 */
export function generatePONumber(sequenceNumber: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequenceNumber).padStart(4, '0');
  const uniqueTime = String(Date.now()).slice(-3);
  return `PO-${year}-${padded}${uniqueTime}`;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

/**
 * Calculate stock health percentage
 */
export function getStockHealthPercent(currentStock: number, maxCapacity: number): number {
  if (maxCapacity === 0) return 0;
  return Math.round((currentStock / maxCapacity) * 100);
}

/**
 * Get stock status label and color
 */
export function getStockStatus(currentStock: number, reorderPoint: number, minStockLevel: number): {
  label: string;
  color: 'critical' | 'warning' | 'healthy' | 'overstocked';
} {
  if (currentStock === 0) return { label: 'Out of Stock', color: 'critical' };
  if (currentStock <= minStockLevel) return { label: 'Critical', color: 'critical' };
  if (currentStock <= reorderPoint) return { label: 'Low Stock', color: 'warning' };
  return { label: 'In Stock', color: 'healthy' };
}

/**
 * Calculate days until stockout based on average daily sales
 */
export function estimateDaysUntilStockout(currentStock: number, avgDailySales: number): number {
  if (avgDailySales <= 0) return 999;
  return Math.floor(currentStock / avgDailySales);
}

/**
 * Fallback reorder quantity calculation (when AI fails)
 * Formula: (reorder_point * 2) - current_stock, capped at max_capacity
 */
export function calculateFallbackReorderQty(
  currentStock: number,
  reorderPoint: number,
  maxCapacity: number
): number {
  const raw = (reorderPoint * 2) - currentStock;
  const capped = Math.min(raw, maxCapacity - currentStock);
  return Math.max(capped, 1); // At least 1 unit
}
