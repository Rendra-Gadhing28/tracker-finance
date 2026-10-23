/**
 * Budget status helper based on spent / limit ratio
 * @param {number} spent
 * @param {number} limit
 * @returns {{ ratio: number, status: 'aman' | 'hampir' | 'lewat', color: string }}
 */
export function budgetStatus(spent, limit) {
  const ratio = limit > 0 ? spent / limit : 0;
  const status = ratio > 1 ? 'lewat' : ratio >= 0.8 ? 'hampir' : 'aman';
  const color = {
    aman: 'var(--accent)',
    hampir: 'var(--warn)',
    lewat: 'var(--expense)'
  }[status];
  return { ratio, status, color };
}
