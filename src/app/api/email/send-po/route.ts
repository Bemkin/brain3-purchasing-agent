import { NextResponse } from 'next/server';
import { dispatchPOEmail } from '@/lib/services/email';
import { SendPOEmailSchema } from '@/lib/schemas';

/**
 * POST /api/email/send-po
 * Send a purchase order email to the supplier
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = SendPOEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid purchaseOrderId', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { purchaseOrderId } = parsed.data;
    const result = await dispatchPOEmail(purchaseOrderId);

    return NextResponse.json({
      success: true,
      emailId: result.emailId,
      message: `PO ${result.poNumber} sent successfully`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

