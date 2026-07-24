import { NextResponse } from 'next/server';
import { dispatchPOEmail } from '@/lib/services/email';

/**
 * POST /api/email/send-po
 * Send a purchase order email to the supplier
 */
export async function POST(request: Request) {
  try {
    const { purchaseOrderId } = await request.json();

    if (!purchaseOrderId) {
      return NextResponse.json({ error: 'Missing purchaseOrderId' }, { status: 400 });
    }

    const result = await dispatchPOEmail(purchaseOrderId);

    return NextResponse.json({
      success: true,
      emailId: result.emailId,
      message: `PO ${result.poNumber} sent successfully`,
    });
  } catch (err) {
    console.error('Send PO email error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
