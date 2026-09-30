import QRCode from 'qrcode';

export interface UpiPaymentDetails {
  upiId: string;
  payeeName: string;
  amount: number;
  transactionNote?: string;
  transactionRef?: string;
}

export function buildUpiPayload(details: UpiPaymentDetails): string {
  const { upiId, payeeName, amount, transactionNote, transactionRef } = details;
  const cleanId = (upiId || '').trim();
  const cleanName = encodeURIComponent((payeeName || 'PayBack Merchant').trim());
  const formattedAmount = amount.toFixed(2);
  const note = encodeURIComponent((transactionNote || 'Loan Repayment').trim());

  let uri = `upi://pay?pa=${cleanId}&pn=${cleanName}&am=${formattedAmount}&cu=INR&tn=${note}`;
  if (transactionRef) {
    uri += `&tr=${encodeURIComponent(transactionRef)}`;
  }
  return uri;
}

export async function generateUpiQrDataUrl(details: UpiPaymentDetails): Promise<string> {
  const payload = buildUpiPayload(details);
  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate UPI QR code:', err);
    throw err;
  }
}

export function openUpiIntent(details: UpiPaymentDetails): void {
  const payload = buildUpiPayload(details);
  window.location.href = payload;
}
