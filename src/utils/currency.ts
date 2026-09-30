export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) {
    return '₹—';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatRsPlain(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) {
    return 'Rs. --';
  }
  return 'Rs. ' + new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function cleanNumericString(val: string | number | undefined | null): string {
  return String(val ?? '')
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*)\./g, '$1');
}

export function formatNumberWithCommas(raw: string): string {
  if (raw === '') return '';
  const dotIndex = raw.indexOf('.');
  const intPart = dotIndex === -1 ? raw : raw.slice(0, dotIndex);
  const decPart = dotIndex === -1 ? '' : raw.slice(dotIndex);
  if (intPart === '') return decPart;
  const num = Number(intPart);
  const formattedInt = Number.isFinite(num)
    ? num.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    : intPart;
  return formattedInt + decPart;
}
