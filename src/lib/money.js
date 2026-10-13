/**
 * Format integer to Indonesian Rupiah string.
 * e.g. 72500 -> "Rp 72.500", -3500 -> "-Rp 3.500", 0 -> "Rp 0"
 * @param {number|string} amount
 * @returns {string}
 */
export function formatRp(amount) {
  const num = Math.round(Number(amount)) || 0;
  const isNegative = num < 0;
  const absStr = Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-Rp ${absStr}` : `Rp ${absStr}`;
}

/**
 * Parse string to integer Rupiah amount.
 * e.g. "Rp 72.500" -> 72500, "-Rp 3.500" -> -3500, "72.500" -> 72500
 * @param {string|number} str
 * @returns {number}
 */
export function parseRp(str) {
  if (typeof str === 'number') return Math.round(str) || 0;
  if (!str || typeof str !== 'string') return 0;
  const isNegative = /[-\u2212]/.test(str);
  const cleaned = str.replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  const val = parseInt(cleaned, 10);
  return isNegative ? -val : val;
}
