export function getCurrencySymbol(currency) {
  if (!currency) return '₦';
  const c = currency.toUpperCase();
  if (c === 'NGN') return '₦';
  if (c === 'USD') return '$';
  return c + ' ';
}

export function formatAmount(amount, currency = 'NGN') {
  if (amount == null) return '';
  try {
    const formatted = Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${getCurrencySymbol(currency)}${formatted}`;
  } catch {
    return `${getCurrencySymbol(currency)}${amount}`;
  }
}
