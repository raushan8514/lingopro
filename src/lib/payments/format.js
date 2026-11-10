export function formatMinorCurrency(amount, currency) {
  const fractionDigits = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: fractionDigits,
  }).format(amount / 10 ** fractionDigits);
}
