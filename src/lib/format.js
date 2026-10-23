const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

export const rupiah = (n) => idr.format(n).replace(/\u00a0/g, ' ');

export function compact(n) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' jt';
  if (a >= 1_000) return Math.round(n / 1_000) + ' rb';
  return String(n);
}
