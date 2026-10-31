import { getWIBParts } from './week.js';

export const FULL_INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Returns monthly recap identifier string (e.g. "2026-10").
 *
 * @param {Date|string|number} [date=new Date()]
 * @returns {string}
 */
export function getMonthlyRecapKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const p = getWIBParts(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month + 1)}`;
}

/**
 * Checks whether monthly recap should be triggered based on stored last recap key.
 *
 * @param {string|null|undefined} lastRecapKey
 * @param {Date|string|number} [currentDate=new Date()]
 * @returns {boolean}
 */
export function shouldTriggerMonthlyRecap(lastRecapKey, currentDate = new Date()) {
  if (!lastRecapKey) return true;
  const currentKey = getMonthlyRecapKey(currentDate);
  return String(lastRecapKey).trim() !== currentKey;
}

/**
 * Generates cat advice insight text from mascot Neko.
 *
 * @param {Object} stats
 * @returns {string}
 */
export function getCatRecapAdvice({
  totalKeluar = 0,
  totalMasuk = 0,
  totalTabung = 0,
  netSavings = 0,
  savingsRate = 0,
  topCategories = [],
  prevMonthDiff = 0
} = {}) {
  if (totalKeluar === 0 && totalMasuk === 0 && totalTabung === 0) {
    return 'Belum ada catatan transaksi di bulan ini, Nya. Yuk mulai catat pengeluaranmu! 🐾';
  }

  if (totalMasuk > 0 && totalKeluar > totalMasuk) {
    return 'Waduh, pengeluaran bulan ini melebihi pemasukan, Nya! Yuk rem jajan dulu dan prioritaskan kebutuhan penting! 😿⚠️';
  }

  const topCat = topCategories && topCategories[0];
  if (topCat && topCat.id === 'jajan' && topCat.persentase >= 40) {
    return `Pengeluaran jajan mendominasi ${topCat.persentase}% belanjaanmu, Nya! Coba masak sendiri sesekali biar tabungan makin gendut! 🍙🐾`;
  }

  if (prevMonthDiff > 30 && prevMonthDiff !== 100) {
    return `Pengeluaran naik ${prevMonthDiff}% dibanding bulan lalu, Nya! Coba cek pos pengeluaran mana yang bisa ditekan bulan depan! 🐾📉`;
  }

  if (savingsRate >= 40 || totalTabung >= 500000) {
    return 'Keren banget, Nya! Kamu berhasil menyisihkan tabungan yang besar bulan ini. Neko sangat bangga padamu! 🐾🌟';
  }

  if (savingsRate >= 20) {
    return 'Kerja bagus, Nya! Keuanganmu stabil dan tabungan terus bertambah. Pertahankan ritme ini ya! 🐱💰';
  }

  if (prevMonthDiff < 0) {
    return `Hebat, pengeluaranmu turun ${Math.abs(prevMonthDiff)}% dibanding bulan lalu, Nya! Makin jago mengatur budget! 🍃🐾`;
  }

  return 'Catatan keuangan bulan ini tersusun rapi, Nya! Tetap konsisten pantau dompetmu bersama Neko! 🐾✨';
}

/**
 * Generates comprehensive monthly recap statistics and Neko cat mascot insights.
 *
 * @param {Array<Object>} [transactions=[]]
 * @param {Array<Object>} [categories=[]]
 * @param {Date|string|number} [targetDate=new Date()]
 * @returns {{
 *   periodName: string,
 *   totalKeluar: number,
 *   totalMasuk: number,
 *   totalTabung: number,
 *   netSavings: number,
 *   savingsRate: number,
 *   topCategories: Array<Object>,
 *   dailyAverage: number,
 *   prevMonthDiff: number,
 *   catAdvice: string
 * }}
 */
export function generateMonthlyRecap(transactions = [], categories = [], targetDate = new Date()) {
  const ref = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const p = getWIBParts(ref);
  const targetYear = p.year;
  const targetMonth = p.month; // 0-indexed

  const periodName = `${FULL_INDO_MONTHS[targetMonth]} ${targetYear}`;

  // Calculate previous month
  const prevMonth = targetMonth === 0 ? 11 : targetMonth - 1;
  const prevYear = targetMonth === 0 ? targetYear - 1 : targetYear;

  let totalKeluar = 0;
  let totalMasuk = 0;
  let totalTabung = 0;
  let prevTotalKeluar = 0;
  const catExpenseMap = new Map();

  for (const tx of transactions || []) {
    if (!tx || !tx.tanggal) continue;
    const txDate = tx.tanggal instanceof Date ? tx.tanggal : new Date(tx.tanggal);
    if (isNaN(txDate.getTime())) continue;

    const txParts = getWIBParts(txDate);
    const nom = Math.round(Number(tx.nominal)) || 0;

    // Target month
    if (txParts.year === targetYear && txParts.month === targetMonth) {
      if (tx.tipe === 'keluar') {
        totalKeluar += nom;
        const cId = tx.kategori_id || 'lainnya';
        catExpenseMap.set(cId, (catExpenseMap.get(cId) || 0) + nom);
      } else if (tx.tipe === 'masuk') {
        totalMasuk += nom;
      } else if (tx.tipe === 'tabung') {
        totalTabung += nom;
      }
    }

    // Previous month
    if (txParts.year === prevYear && txParts.month === prevMonth) {
      if (tx.tipe === 'keluar') {
        prevTotalKeluar += nom;
      }
    }
  }

  const netSavings = totalMasuk - totalKeluar;
  const savedAmount = Math.max(0, netSavings) || totalTabung;
  const savingsRate = totalMasuk > 0 ? Math.round((savedAmount / totalMasuk) * 100) : 0;

  // Build top categories
  const catMap = new Map();
  for (const c of categories || []) {
    if (c && c.id) catMap.set(c.id, c);
  }

  const topCategories = Array.from(catExpenseMap.entries())
    .map(([id, total]) => {
      const meta = catMap.get(id) || {};
      const persentase = totalKeluar > 0 ? Math.round((total / totalKeluar) * 100) : 0;
      return {
        id,
        nama: meta.nama || meta.name || id,
        ikon: meta.ikon || meta.icon || '🏷️',
        warna: meta.warna || meta.color || id,
        total,
        persentase
      };
    })
    .sort((a, b) => b.total - a.total);

  // Daily average
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate() || 30;
  const dailyAverage = Math.round(totalKeluar / daysInMonth);

  // Previous month comparison
  let prevMonthDiff = 0;
  if (prevTotalKeluar > 0) {
    prevMonthDiff = Math.round(((totalKeluar - prevTotalKeluar) / prevTotalKeluar) * 100);
  } else if (totalKeluar > 0) {
    prevMonthDiff = 100;
  } else {
    prevMonthDiff = 0;
  }

  const catAdvice = getCatRecapAdvice({
    totalKeluar,
    totalMasuk,
    totalTabung,
    netSavings,
    savingsRate,
    topCategories,
    prevMonthDiff
  });

  return {
    periodName,
    totalKeluar,
    totalMasuk,
    totalTabung,
    netSavings,
    savingsRate,
    topCategories,
    dailyAverage,
    prevMonthDiff,
    catAdvice
  };
}
