/**
 * Asia/Jakarta (WIB / UTC+7) timezone utilities and budget formulas for Neko Dompet.
 */

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Returns WIB calendar components for a given date or timestamp.
 * Month is 0-indexed (0 = Jan, 11 = Dec).
 * Day is 0-indexed (0 = Sun, 1 = Mon, ..., 6 = Sat).
 * @param {Date|string|number} [date=new Date()]
 */
export function getWIBParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const wibTime = d.getTime() + WIB_OFFSET_MS;
  const wib = new Date(wibTime);
  return {
    year: wib.getUTCFullYear(),
    month: wib.getUTCMonth(),
    date: wib.getUTCDate(),
    day: wib.getUTCDay(),
    hours: wib.getUTCHours(),
    minutes: wib.getUTCMinutes(),
    seconds: wib.getUTCSeconds(),
    time: d.getTime()
  };
}

/**
 * Returns a Date representing 00:00:00 WIB on the given WIB year, month, date.
 * @param {number} year
 * @param {number} month
 * @param {number} date
 * @returns {Date}
 */
export function createWIBDate(year, month, date) {
  return new Date(Date.UTC(year, month, date, -7, 0, 0, 0));
}

/**
 * Returns ISO 8601 string in WIB format (+07:00).
 * e.g. "2026-10-13T14:59:00+07:00"
 * @param {Date|string|number} [date=new Date()]
 * @returns {string}
 */
export function toWIBISOString(date = new Date()) {
  const p = getWIBParts(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month + 1)}-${pad(p.date)}T${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}+07:00`;
}

/**
 * Get week range: start (00:00:00 WIB) and end (00:00:00 WIB 7 days later).
 * @param {Date|string|number} [date=new Date()]
 * @param {number} [startDayOfWeek=1] 1 = Monday (default), 0 or 7 = Sunday
 * @returns {{ start: Date, end: Date }}
 */
export function getWeekRange(date = new Date(), startDayOfWeek = 1) {
  const todayWIB = getWIBParts(date);
  const startDay = Number(startDayOfWeek ?? 1) % 7;
  const daysSinceStart = (todayWIB.day - startDay + 7) % 7;

  const start = createWIBDate(todayWIB.year, todayWIB.month, todayWIB.date - daysSinceStart);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  return { start, end };
}

/**
 * Checks if a date falls in [start, end)
 * @param {Date|string|number} date
 * @param {Date|string|number} start
 * @param {Date|string|number} end
 * @returns {boolean}
 */
export function isDateInWeek(date, start, end) {
  const t = (date instanceof Date ? date : new Date(date)).getTime();
  const s = (start instanceof Date ? start : new Date(start)).getTime();
  const e = (end instanceof Date ? end : new Date(end)).getTime();
  return t >= s && t < e;
}

/**
 * Calculates core budget formulas according to PRD Section 10.3 and 10.4.
 *
 * @param {Object} params
 * @param {Array} [params.budgetCategories=[]]
 * @param {Array} [params.transactionsThisWeek=[]]
 * @param {Date|string|number} [params.todayDate=new Date()]
 * @param {number} [params.startDayOfWeek=1]
 * @returns {{
 *   A: number,
 *   P: number,
 *   S: number,
 *   r: number,
 *   hari_ke: number,
 *   hari_sisa: number,
 *   P_sebelum_hari_ini: number,
 *   P_hari_ini: number,
 *   jatah: number,
 *   sisa_hari: number,
 *   status: 'good'|'warn'|'bad'
 * }}
 */
export function calculateBudgetFormulas({
  budgetCategories = [],
  transactionsThisWeek = [],
  todayDate = new Date(),
  startDayOfWeek = 1
} = {}) {
  const keluarCategories = (budgetCategories || []).filter((c) => c.tipe === 'keluar');
  const A = keluarCategories.length > 0
    ? keluarCategories.reduce((sum, c) => sum + (Number(c.limit_mingguan) || 0), 0)
    : 116000;

  const todayWIB = getWIBParts(todayDate || new Date());
  const startDay = Number(startDayOfWeek ?? 1) % 7;
  const daysSinceStart = (todayWIB.day - startDay + 7) % 7;
  const hari_ke = daysSinceStart + 1;
  const hari_sisa = Math.max(1, 8 - hari_ke);

  const todayStartMs = createWIBDate(todayWIB.year, todayWIB.month, todayWIB.date).getTime();
  const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000;

  let P = 0;
  let P_sebelum_hari_ini = 0;
  let P_hari_ini = 0;

  for (const tx of transactionsThisWeek || []) {
    if (tx.tipe !== 'keluar') continue;
    const nominal = Number(tx.nominal) || 0;
    P += nominal;

    const txTime = (tx.tanggal instanceof Date ? tx.tanggal : new Date(tx.tanggal)).getTime();
    if (txTime < todayStartMs) {
      P_sebelum_hari_ini += nominal;
    } else if (txTime >= todayStartMs && txTime < todayEndMs) {
      P_hari_ini += nominal;
    }
  }

  const S = A - P;
  const r = A > 0 ? S / A : 0;
  const jatah = Math.max(0, Math.floor((A - P_sebelum_hari_ini) / hari_sisa / 100) * 100);
  const sisa_hari = jatah - P_hari_ini;

  let status = 'bad';
  if (r > 0.35) {
    status = 'good';
  } else if (r >= 0.10) {
    status = 'warn';
  } else {
    status = 'bad';
  }

  return {
    A,
    P,
    S,
    r,
    hari_ke,
    hari_sisa,
    P_sebelum_hari_ini,
    P_hari_ini,
    jatah,
    sisa_hari,
    status
  };
}
