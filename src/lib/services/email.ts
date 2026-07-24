import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

interface SupplierRelation {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string | null;
}

interface LineItemRelation {
  id: string;
  quantity_ordered: number;
  unit_cost: number;
  total_cost: number;
  inventory_items: { id: string; name: string; sku: string } | null;
}

/**
 * Helper service function to send PO invoice emails via Resend.
 * Works seamlessly in serverless functions, cron routes, and API endpoints.
 */
export async function dispatchPOEmail(purchaseOrderId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable');
  }

  const resend = new Resend(apiKey);
  const supabase = createServerSupabaseClient();

  // Fetch PO with supplier and line items
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select(`
      id, po_number, status, total_amount, currency, notes, ai_reasoning, created_at,
      suppliers:supplier_id (id, name, contact_email, contact_phone)
    `)
    .eq('id', purchaseOrderId)
    .single();

  if (poError || !po) {
    throw new Error(`Purchase order not found: ${poError?.message}`);
  }

  // Fetch line items with product names
  const { data: lineItemsData, error: liError } = await supabase
    .from('po_line_items')
    .select(`
      id, quantity_ordered, unit_cost, total_cost,
      inventory_items:inventory_item_id (id, name, sku)
    `)
    .eq('purchase_order_id', purchaseOrderId);

  if (liError) {
    throw new Error(`Failed to fetch line items: ${liError.message}`);
  }

  const rawSupplier = po.suppliers;
  const supplier: SupplierRelation = Array.isArray(rawSupplier) ? rawSupplier[0] : (rawSupplier as unknown as SupplierRelation);
  const lineItems: LineItemRelation[] = (lineItemsData || []).map((li) => ({
    id: String(li.id),
    quantity_ordered: Number(li.quantity_ordered),
    unit_cost: Number(li.unit_cost),
    total_cost: Number(li.total_cost),
    inventory_items: Array.isArray(li.inventory_items) ? li.inventory_items[0] : li.inventory_items,
  }));

  // Build email HTML
  const itemRows = lineItems.map((li) => {
    const item = li.inventory_items || { name: 'Item', sku: 'N/A' };
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.sku}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${li.quantity_ordered}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(li.unit_cost).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(li.total_cost).toFixed(2)}</td>
      </tr>`;
  }).join('');

  const emailHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #1f2937;">
      <div style="background: linear-gradient(135deg, #064e3b 0%, #042f2e 100%); padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📦 Purchase Order</h1>
        <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">${po.po_number} — Dispatched by Brain3 AI Agent</p>
      </div>
      
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb;">
        <div style="margin-bottom: 24px;">
          <p style="margin: 4px 0;"><strong>To:</strong> ${supplier.name}</p>
          <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(po.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p style="margin: 4px 0;"><strong>PO Number:</strong> ${po.po_number}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
              <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">SKU</th>
              <th style="padding: 12px 10px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
              <th style="padding: 12px 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Unit Cost</th>
              <th style="padding: 12px 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="padding: 14px 10px; text-align: right; font-weight: bold; border-top: 2px solid #064e3b;">Total Amount:</td>
              <td style="padding: 14px 10px; text-align: right; font-weight: bold; font-size: 18px; border-top: 2px solid #064e3b; color: #059669;">$${Number(po.total_amount).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        ${po.notes ? `<div style="margin-top: 20px; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #059669;"><strong>Notes:</strong> ${po.notes}</div>` : ''}
      </div>
      
      <div style="background: #f8fafc; padding: 20px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: 0;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">This purchase order was generated by Brain3 AI Purchasing Agent. Please confirm receipt and estimated delivery date by replying to this email.</p>
      </div>
    </div>`;

  // Resend free tier restriction: onboarding@resend.dev can ONLY send to account owner's verified email.
  const senderEmail = process.env.RESEND_FROM_EMAIL || 'Brain3 AI Purchasing Agent <onboarding@resend.dev>';
  const isDemoTestingDomain = senderEmail.includes('resend.dev');
  const fallbackDemoEmail = process.env.NOTIFICATION_EMAIL || process.env.RESEND_RECIPIENT_EMAIL || 'bemnetkibret4@gmail.com';
  const actualTargetEmail = isDemoTestingDomain ? fallbackDemoEmail : supplier.contact_email;

  const demoBannerHtml = isDemoTestingDomain
    ? `<div style="background: #ecfdf5; border: 1px solid #10b981; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: #065f46;">
        <strong>📌 Demo Dispatch Notice:</strong> Originally addressed to vendor <strong>${supplier.name} (${supplier.contact_email})</strong>. Delivered to target demo email: <code>${actualTargetEmail}</code>.
      </div>`
    : '';

  const { data: emailResult, error: emailError } = await resend.emails.send({
    from: senderEmail,
    to: [actualTargetEmail],
    subject: `Purchase Order ${po.po_number} — ${supplier.name}`,
    html: demoBannerHtml + emailHtml,
  });

  if (emailError) {
    const { error: logErr } = await supabase.from('ai_audit_logs').insert({
      action_type: 'email_failed',
      severity: 'error',
      message: `Failed to send PO ${po.po_number} email to ${supplier.contact_email}: ${emailError.message}`,
      details: { po_number: po.po_number, supplier_email: supplier.contact_email, error: emailError },
      related_po_id: po.id,
      source: 'email_service',
    });
    if (logErr) {
      console.error('Failed to insert audit log for email failure:', logErr.message);
    }

    throw new Error(`Resend email error: ${emailError.message}`);
  }

  // Update PO status to 'sent'
  const { error: poUpdateErr } = await supabase
    .from('purchase_orders')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', po.id);

  if (poUpdateErr) {
    console.error(`Failed to update PO ${po.id} status to sent:`, poUpdateErr.message);
  }

  // Log email success
  const { error: logSuccessErr } = await supabase.from('ai_audit_logs').insert({
    action_type: 'email_sent',
    severity: 'info',
    message: `PO ${po.po_number} emailed to ${supplier.name} (${actualTargetEmail})`,
    details: {
      po_number: po.po_number,
      supplier: supplier.name,
      email_id: emailResult?.id,
      total_amount: po.total_amount,
    },
    related_po_id: po.id,
    source: 'email_service',
  });

  if (logSuccessErr) {
    console.error('Failed to insert audit log for email success:', logSuccessErr.message);
  }

  return { emailId: emailResult?.id, poNumber: po.po_number };
}
