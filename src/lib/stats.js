import { formatRp } from './money.js';
import { getWIBParts, createWIBDate, getWeekRange } from './week.js';

export const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const INDO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const CATEGORY_COLORS = {
  jajan: { fill: '#FBE0D3', border: '#F2B28C' },
  pulsa: { fill: '#DCEEF7', border: '#9CC5D9' },
  bensin: { fill: '#E4F2DA', border: '#9FC88A' },
  jajanin: { fill: '#EBE0F5', border: '#C9B0E0' },
  nabung: { fill: '#FBE1E7', border: '#F2B8C6' },
  masuk: { fill: '#FBF0CF', border: '#F4D58D' },
  lainnya: { fill: '#F0EBE1', border: '#D5CBBB' }
};

/**
 * Returns period range with WIB boundaries, label, and isCurrent flag.
 *
 * @param {'minggu' | 'bulan' | Object} mode
 * @param {Date|string|number} [date=new Date()]
 * @param {number} [startDayOfWeek=1]
 * @param {number} [offset=0]
 * @returns {{ start: Date, end: Date, label: string, isCurrent: boolean }}
 */
export function getPeriodRange(mode = 'minggu', date = new Date(), startDayOfWeek = 1, offset = 0) {
  if (typeof mode === 'object' && mode !== null && !Array.isArray(mode)) {
    const opts = mode;
    mode = opts.mode ?? 'minggu';
    date = opts.date ?? new Date();
    startDayOfWeek = opts.startDayOfWeek ?? 1;
    offset = opts.offset ?? 0;
  }

  const refDate = date instanceof Date ? date : new Date(date);
  const isCurrent = offset === 0;

  if (mode === 'minggu') {
    const offsetMs = offset * 7 * 24 * 60 * 60 * 1000;
    const targetDate = new Date(refDate.getTime() + offsetMs);
    const { start, end } = getWeekRange(targetDate, startDayOfWeek);

    const startP = getWIBParts(start);
    const lastDayP = getWIBParts(new Date(end.getTime() - 1000));

    let label = '';
    if (startP.year === lastDayP.year) {
      if (startP.month === lastDayP.month) {
        label = `${startP.date}–${lastDayP.date} ${INDO_MONTHS[startP.month]} ${startP.year}`;
      } else {
        label = `${startP.date} ${INDO_MONTHS[startP.month]} – ${lastDayP.date} ${INDO_MONTHS[lastDayP.month]} ${startP.year}`;
      }
    } else {
      label = `${startP.date} ${INDO_MONTHS[startP.month]} ${startP.year} – ${lastDayP.date} ${INDO_MONTHS[lastDayP.month]} ${lastDayP.year}`;
    }

    return { start, end, label, isCurrent };
  } else {
    // 'bulan'
    const p = getWIBParts(refDate);
    const targetMonth = p.month + offset;
    const start = createWIBDate(p.year, targetMonth, 1);
    const end = createWIBDate(p.year, targetMonth + 1, 1);

    const startP = getWIBParts(start);
    const label = `${INDO_MONTHS[startP.month]} ${startP.year}`;

    return { start, end, label, isCurrent };
  }
}

/**
 * Largest Remainder Method (Hare-Niemeyer / Hamilton) ensuring percentages sum to exactly 100%.
 *
 * @param {Array} items
 * @returns {Array}
 */
export function calculateLargestRemainder(items = []) {
  const total = items.reduce((sum, item) => sum + (Number(item.nominal ?? item.value) || 0), 0);
  if (total <= 0) {
    return items.map((item) => ({ ...item, persen: 0, rawPersen: 0 }));
  }

  const withFloors = items.map((item, index) => {
    const val = Number(item.nominal ?? item.value) || 0;
    const exact = (val / total) * 100;
    const integer = Math.floor(exact);
    const remainder = exact - integer;
    return { item, index, exact, integer, remainder };
  });

  const sumInteger = withFloors.reduce((acc, x) => acc + x.integer, 0);
  const remainingSeats = Math.max(0, 100 - sumInteger);

  const sorted = [...withFloors].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const bonusIndices = new Set(sorted.slice(0, remainingSeats).map((x) => x.index));

  return withFloors.map((x) => ({
    ...x.item,
    persen: bonusIndices.has(x.index) ? x.integer + 1 : x.integer,
    rawPersen: x.exact
  }));
}

export const largestRemainderMethod = calculateLargestRemainder;

/**
 * Calculate category breakdown per PRD Section 19.4 & 19.5.
 *
 * @param {Object} options
 * @param {Array} [options.categories=[]]
 * @param {Array} [options.transactions=[]]
 * @param {Object} [options.periodRange={}]
 * @param {'terpakai'|'rencana'} [options.mode='terpakai']
 * @returns {{ items: Array, total: number, maxNominal: number }}
 */
export function calculateCategoryBreakdown({
  categories = [],
  transactions = [],
  periodRange = {},
  mode = 'terpakai'
} = {}) {
  const rangeStartMs = periodRange.start ? new Date(periodRange.start).getTime() : 0;
  const rangeEndMs = periodRange.end ? new Date(periodRange.end).getTime() : Infinity;
  const periodIsMonth = periodRange.isMonth ?? (rangeEndMs - rangeStartMs > 7.5 * 24 * 60 * 60 * 1000);

  // Filter transactions in periodRange where tx.tipe === 'keluar' OR tx.tipe === 'tabung'
  const periodTxs = (transactions || []).filter((tx) => {
    const d = new Date(tx.tanggal).getTime();
    return d >= rangeStartMs && d < rangeEndMs && (tx.tipe === 'keluar' || tx.tipe === 'tabung');
  });

  // PRD 19.4: Semua kategori bertipe 'keluar' dan 'tabung' (pemasukan tidak termasuk)
  const validCategories = (categories || []).filter((c) => c.tipe !== 'masuk');
  const knownCatIds = new Set(validCategories.map((c) => c.id));

  const spentByCatId = new Map();
  let unknownCatSpent = 0;

  for (const tx of periodTxs) {
    const nom = Math.round(Number(tx.nominal)) || 0;
    const cId = tx.kategori_id;
    if (cId && knownCatIds.has(cId)) {
      spentByCatId.set(cId, (spentByCatId.get(cId) || 0) + nom);
    } else {
      // PRD 19.9: Transaksi tanpa kategori atau kategori tak dikenal masuk ke 'Lainnya'
      unknownCatSpent += nom;
    }
  }

  let catItems = validCategories.map((cat) => {
    const limit = Math.round(Number(cat.limit_mingguan ?? cat.limit)) || 0;
    const rencanaNominal = periodIsMonth ? limit * 4 : limit;
    let terpakaiNominal = spentByCatId.get(cat.id) || 0;
    if (cat.id === 'lainnya') {
      terpakaiNominal += unknownCatSpent;
    }
    const nominal = mode === 'rencana' ? rencanaNominal : terpakaiNominal;
    const color = cat.color || CATEGORY_COLORS[cat.warna] || CATEGORY_COLORS[cat.id] || { fill: '#F0EBE1', border: '#D5CBBB' };

    return {
      ...cat,
      urut: cat.urut ?? (cat.id === 'lainnya' ? 9999 : 99),
      limit: rencanaNominal,
      rencanaNominal,
      terpakaiNominal,
      nominal,
      color,
      borderHex: color.border,
      warnaHex: color.fill,
      selisih: rencanaNominal - terpakaiNominal
    };
  });

  // Jika ada transaksi kategori tak dikenal dan belum ada kategori 'lainnya' di daftar
  if (unknownCatSpent > 0 && !validCategories.some((c) => c.id === 'lainnya')) {
    const color = { fill: '#F0EBE1', border: '#D5CBBB' };
    catItems.push({
      id: 'lainnya',
      nama: 'Lainnya',
      ikon: '🏷️',
      color,
      borderHex: color.border,
      warnaHex: color.fill,
      nominal: mode === 'rencana' ? 0 : unknownCatSpent,
      rencanaNominal: 0,
      terpakaiNominal: unknownCatSpent,
      limit: 0,
      selisih: -unknownCatSpent,
      tipe: 'keluar',
      urut: 9999
    });
  }

  // Sort by nominal descending
  catItems.sort((a, b) => b.nominal - a.nominal);

  // If categories count > 8: top 7 kept, rest merged into "Lainnya"
  let slicedItems = catItems;
  if (catItems.length > 8) {
    const top7 = catItems.slice(0, 7);
    const rest = catItems.slice(7);

    const restNominal = rest.reduce((sum, c) => sum + c.nominal, 0);
    const restRencana = rest.reduce((sum, c) => sum + (c.rencanaNominal || 0), 0);
    const restTerpakai = rest.reduce((sum, c) => sum + (c.terpakaiNominal || 0), 0);
    const color = { fill: '#F0EBE1', border: '#D5CBBB' };

    const lainnyaItem = {
      id: 'lainnya',
      nama: 'Lainnya',
      ikon: '🏷️',
      color,
      borderHex: color.border,
      warnaHex: color.fill,
      nominal: restNominal,
      rencanaNominal: restRencana,
      terpakaiNominal: restTerpakai,
      limit: restRencana,
      selisih: restRencana - restTerpakai,
      tipe: 'keluar',
      urut: 9999
    };

    slicedItems = [...top7, lainnyaItem];
  }

  // Calculate percentages using calculateLargestRemainder
  const rawItems = calculateLargestRemainder(slicedItems);
  const total = rawItems.reduce((sum, c) => sum + c.nominal, 0);
  const maxNominal = rawItems.length > 0 ? Math.max(...rawItems.map((c) => c.nominal)) : 0;

  const items = rawItems.map((item) => {
    const selisih = item.rencanaNominal - item.terpakaiNominal;
    const selisihType = selisih >= 0 ? 'hemat' : 'lewat';
    const selisihText = selisih >= 0
      ? `Hemat ${formatRp(selisih)}`
      : `Lewat ${formatRp(Math.abs(selisih))}`;
    const barPercent = maxNominal > 0 ? Math.round((item.nominal / maxNominal) * 100) : 0;
    const color = item.color || CATEGORY_COLORS[item.warna] || CATEGORY_COLORS[item.id] || { fill: '#F0EBE1', border: '#D5CBBB' };

    return {
      ...item,
      urut: item.urut ?? (item.id === 'lainnya' ? 9999 : 99),
      selisih,
      selisihType,
      selisihText,
      barPercent,
      borderHex: color.border,
      warnaHex: color.fill
    };
  });

  // PRD 19.4 & 19.5: Urutkan nominal terbesar dulu, dengan 'lainnya' selalu di posisi terakhir
  items.sort((a, b) => {
    if (a.id === 'lainnya') return 1;
    if (b.id === 'lainnya') return -1;
    return b.nominal - a.nominal;
  });

  return {
    items,
    total,
    maxNominal
  };
}

/**
 * Calculate daily or weekly spending bars per PRD Section 19.6.
 *
 * @param {Object} options
 * @param {Array} [options.transactions=[]]
 * @param {Object} [options.periodRange={}]
 * @param {boolean} [options.isMonth=false]
 * @param {number} [options.averageBudget=0]
 * @param {number} [options.startDayOfWeek=1]
 * @param {Date|string|number} [options.todayDate=new Date()]
 * @returns {Array<{ label: string, date: Date, nominal: number, isOverBudget: boolean, isFuture: boolean }> & { averageBudget: number, bars: Array }}
 */
export function calculateDailySpending({
  transactions = [],
  periodRange = {},
  isMonth = false,
  averageBudget = 0,
  startDayOfWeek = 1,
  todayDate = new Date()
} = {}) {
  const today = todayDate instanceof Date ? todayDate : new Date(todayDate);
  const todayParts = getWIBParts(today);
  const todayMidnight = createWIBDate(todayParts.year, todayParts.month, todayParts.date);

  const rangeStart = periodRange.start
    ? periodRange.start instanceof Date
      ? periodRange.start
      : new Date(periodRange.start)
    : new Date();
  const rangeEnd = periodRange.end
    ? periodRange.end instanceof Date
      ? periodRange.end
      : new Date(periodRange.end)
    : new Date();
  const rangeEndMs = rangeEnd.getTime();

  const keluarTxs = (transactions || []).filter((tx) => tx.tipe === 'keluar');
  const bars = [];

  if (!isMonth) {
    // Week: 7 bars (Day 1 to 7 starting from startDayOfWeek)
    const startParts = getWIBParts(rangeStart);

    for (let i = 0; i < 7; i++) {
      const dayStart = createWIBDate(startParts.year, startParts.month, startParts.date + i);
      const dayEnd = createWIBDate(startParts.year, startParts.month, startParts.date + i + 1);
      const dayParts = getWIBParts(dayStart);

      const isFuture = dayStart.getTime() > todayMidnight.getTime();

      let nominal = 0;
      if (!isFuture) {
        nominal = keluarTxs
          .filter((tx) => {
            const d = new Date(tx.tanggal).getTime();
            return d >= dayStart.getTime() && d < dayEnd.getTime();
          })
          .reduce((sum, tx) => sum + (Math.round(Number(tx.nominal)) || 0), 0);
      }

      const isOverBudget = nominal > averageBudget;

      bars.push({
        label: INDO_DAYS[dayParts.day],
        shortLabel: INDO_DAYS[dayParts.day].slice(0, 3),
        date: dayStart,
        nominal,
        value: nominal,
        threshold: averageBudget,
        isOver: isOverBudget,
        isOverBudget,
        isFuture
      });
    }
  } else {
    // Month: 4 week bars (Week 1 to 4)
    const startParts = getWIBParts(rangeStart);
    const weekSlices = [
      { label: 'Minggu 1', shortLabel: 'M1', startDay: 1, endDay: 8 },
      { label: 'Minggu 2', shortLabel: 'M2', startDay: 8, endDay: 15 },
      { label: 'Minggu 3', shortLabel: 'M3', startDay: 15, endDay: 22 },
      { label: 'Minggu 4', shortLabel: 'M4', startDay: 22, endDay: 32 }
    ];

    for (const slice of weekSlices) {
      const sliceStart = createWIBDate(startParts.year, startParts.month, slice.startDay);
      const rawEnd = createWIBDate(startParts.year, startParts.month, slice.endDay);
      const sliceEnd = rawEnd.getTime() > rangeEndMs ? rangeEnd : rawEnd;

      const isFuture = sliceStart.getTime() > todayMidnight.getTime();

      let nominal = 0;
      if (!isFuture && sliceStart.getTime() < rangeEndMs) {
        nominal = keluarTxs
          .filter((tx) => {
            const d = new Date(tx.tanggal).getTime();
            return d >= sliceStart.getTime() && d < sliceEnd.getTime();
          })
          .reduce((sum, tx) => sum + (Math.round(Number(tx.nominal)) || 0), 0);
      }

      const isOverBudget = nominal > averageBudget;

      bars.push({
        label: slice.label,
        shortLabel: slice.shortLabel,
        date: sliceStart,
        nominal,
        value: nominal,
        threshold: averageBudget,
        isOver: isOverBudget,
        isOverBudget,
        isFuture
      });
    }
  }

  bars.averageBudget = averageBudget;
  bars.bars = bars;

  return bars;
}

/**
 * Generate max 2 concise insights per PRD Section 19.7 priority rules.
 *
 * Priority:
 * 1. Top keluar category > 50% of total keluar: "Terboros: [Nama] ([X]%)"
 * 2. Any category exceeding limit in 'terpakai': "[Nama] lewat Rp [X] dari rencana"
 * 3. Most wasteful day (if >= 3 days have data): "Hari terboros: [NamaHari]"
 * 4. Total under budget: "Hemat Rp [X] dari rencana"
 *
 * @param {Object} options
 * @param {Object|Array} [options.breakdown={}]
 * @param {Array|Object} [options.dailyBars=[]]
 * @param {Object|number} [options.budgetSummary=null]
 * @param {'terpakai'|'rencana'} [options.mode='terpakai']
 * @returns {string[]} Array of 0, 1, or 2 strings
 */
export function generateInsights({
  breakdown = {},
  dailyBars = [],
  budgetSummary = null,
  mode = 'terpakai'
} = {}) {
  const candidateInsights = [];

  const items = Array.isArray(breakdown) ? breakdown : breakdown?.items || [];
  const bars = Array.isArray(dailyBars) ? dailyBars : dailyBars?.bars || [];

  // 1. Top keluar category > 50% of total keluar
  const keluarItems = items.filter((i) => i.tipe === 'keluar' || (!i.tipe && i.id !== 'nabung'));
  const totalKeluar = keluarItems.reduce((sum, i) => sum + (Number(i.nominal) || 0), 0);

  if (totalKeluar > 0) {
    const sortedKeluar = [...keluarItems].sort((a, b) => (Number(b.nominal) || 0) - (Number(a.nominal) || 0));
    const topCat = sortedKeluar[0];
    if (topCat && (Number(topCat.nominal) || 0) > 0.5 * totalKeluar) {
      const pct = Math.round(((Number(topCat.nominal) || 0) / totalKeluar) * 100);
      candidateInsights.push(`Terboros: ${topCat.nama} (${pct}%)`);
    }
  }

  // 2. Any category exceeding limit in 'terpakai'
  if (mode === 'terpakai') {
    const overCats = [];
    for (const item of items) {
      const terpakai = Number(item.terpakaiNominal ?? item.nominal) || 0;
      const limit = Number(item.rencanaNominal ?? item.limit ?? item.limit_mingguan) || 0;
      if (limit > 0 && terpakai > limit) {
        overCats.push({
          nama: item.nama,
          excess: terpakai - limit
        });
      }
    }

    if (overCats.length > 0) {
      overCats.sort((a, b) => b.excess - a.excess);
      candidateInsights.push(`${overCats[0].nama} lewat ${formatRp(overCats[0].excess)} dari rencana`);
    }
  }

  // 3. Most wasteful day (if >= 3 days have data)
  const daysWithData = bars.filter((b) => !b.isFuture && (Number(b.nominal ?? b.value) || 0) > 0);
  if (daysWithData.length >= 3) {
    const sortedDays = [...daysWithData].sort(
      (a, b) => (Number(b.nominal ?? b.value) || 0) - (Number(a.nominal ?? a.value) || 0)
    );
    const worstDay = sortedDays[0];
    if (worstDay && (Number(worstDay.nominal ?? worstDay.value) || 0) > 0) {
      candidateInsights.push(`Hari terboros: ${worstDay.label}`);
    }
  }

  // 4. Total under budget
  let hemat = 0;
  if (typeof budgetSummary === 'number' && budgetSummary > 0) {
    hemat = budgetSummary;
  } else if (budgetSummary) {
    if (budgetSummary.S !== undefined && budgetSummary.S > 0) {
      hemat = budgetSummary.S;
    } else if (budgetSummary.hemat !== undefined && budgetSummary.hemat > 0) {
      hemat = budgetSummary.hemat;
    } else if (
      budgetSummary.totalBudget !== undefined &&
      budgetSummary.totalSpent !== undefined &&
      budgetSummary.totalBudget > budgetSummary.totalSpent
    ) {
      hemat = budgetSummary.totalBudget - budgetSummary.totalSpent;
    } else if (
      budgetSummary.A !== undefined &&
      budgetSummary.P !== undefined &&
      budgetSummary.A > budgetSummary.P
    ) {
      hemat = budgetSummary.A - budgetSummary.P;
    }
  }

  if (hemat <= 0 && items.length > 0) {
    const totalRencana = items.reduce((sum, c) => sum + (Number(c.rencanaNominal) || 0), 0);
    const totalTerpakai = items.reduce(
      (sum, c) => sum + (Number(c.terpakaiNominal ?? c.nominal) || 0),
      0
    );
    if (totalRencana > totalTerpakai) {
      hemat = totalRencana - totalTerpakai;
    }
  }

  if (hemat > 0) {
    candidateInsights.push(`Hemat ${formatRp(hemat)} dari rencana`);
  }

  return candidateInsights.slice(0, 2);
}

/**
 * Calculate Donut slice angles ensuring minimum 3 degrees per slice for touch targets.
 */
export function calculateDonutAngles(slices = [], total = 0) {
  const nonZeroSlices = (slices || []).filter((s) => (Number(s.nominal) || 0) > 0);
  const n = nonZeroSlices.length;
  if (n === 0 || total <= 0) return [];
  if (n === 1) {
    return [{ ...nonZeroSlices[0], startAngle: 0, endAngle: 360, angle: 360 }];
  }

  const gap = 2; // 2 degree gap per PRD 19.4
  const totalGap = n * gap;
  const availableArc = 360 - totalGap;

  const rawAngles = nonZeroSlices.map((s) => ((Number(s.nominal) || 0) / total) * availableArc);
  let smallCount = 0;
  let largeNominalTotal = 0;

  for (let i = 0; i < n; i++) {
    if (rawAngles[i] < 3) {
      smallCount++;
    } else {
      largeNominalTotal += Number(nonZeroSlices[i].nominal) || 0;
    }
  }

  const remainingArc = availableArc - smallCount * 3;

  let currentAngle = 0;
  return nonZeroSlices.map((s, i) => {
    let angle;
    if (rawAngles[i] < 3) {
      angle = 3;
    } else if (largeNominalTotal > 0) {
      angle = ((Number(s.nominal) || 0) / largeNominalTotal) * remainingArc;
    } else {
      angle = availableArc / n;
    }

    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle += angle + gap;

    return {
      ...s,
      startAngle,
      endAngle,
      angle
    };
  });
}

/**
 * Comprehensive stats calculation wrapper.
 */
export function calculateStats({
  transactions = [],
  budgets = [],
  period = 'minggu',
  mode = 'terpakai',
  weekOffset = 0,
  monthOffset = 0,
  startDayOfWeek = 1,
  weeklyAllowance,
  now = new Date()
} = {}) {
  // Ambang batas jatah rata-rata menggunakan A (kategori keluar saja, default 116000 jika kosong)
  let allowance = weeklyAllowance;
  if (allowance === undefined || allowance === null) {
    const keluarCats = (budgets || []).filter((b) => b.tipe === 'keluar');
    allowance = keluarCats.length > 0
      ? keluarCats.reduce((sum, b) => sum + (Number(b.limit_mingguan) || 0), 0)
      : 116000;
  }

  const offset = period === 'minggu' ? weekOffset : monthOffset;
  const periodRange = getPeriodRange(period, now, startDayOfWeek, offset);
  const isMonth = period === 'bulan';

  const breakdown = calculateCategoryBreakdown({
    categories: budgets,
    transactions,
    periodRange,
    mode
  });

  const averageBudget = isMonth ? allowance : Math.round(allowance / 7);
  const dailyBars = calculateDailySpending({
    transactions,
    periodRange,
    isMonth,
    averageBudget,
    startDayOfWeek,
    todayDate: now
  });

  const insights = generateInsights({
    breakdown,
    dailyBars,
    budgetSummary: null,
    mode
  });

  // PRD 19.4: Donut irisan disaring hanya nominal > 0 dan diurutkan berdasarkan 'urut' (Lainnya di akhir)
  const positiveItems = breakdown.items.filter((item) => (Number(item.nominal) || 0) > 0);
  const sliceCandidates = [...positiveItems].sort((a, b) => {
    const urutA = a.id === 'lainnya' ? 9999 : (a.urut ?? 99);
    const urutB = b.id === 'lainnya' ? 9999 : (b.urut ?? 99);
    return urutA - urutB;
  });

  const slices = calculateDonutAngles(sliceCandidates, breakdown.total);

  return {
    period,
    mode,
    range: { start: periodRange.start, end: periodRange.end },
    totalAmount: breakdown.total,
    slices,
    categoryList: breakdown.items,
    dailyBars,
    dailySpending: dailyBars,
    insights,
    hasData: breakdown.total > 0
  };
}

/**
 * Calculates daily spending for the last 7 calendar days up to todayDate (WIB).
 *
 * @param {Object} options
 * @param {Array} [options.transactions=[]]
 * @param {Date|string|number} [options.todayDate=new Date()]
 * @returns {{ days: Array<{ date: Date, label: string, shortLabel: string, nominal: number, value: number, isToday: boolean }>, total: number, average: number }}
 */
export function calculateLast7DaysSpending({
  transactions = [],
  todayDate = new Date()
} = {}) {
  const today = todayDate instanceof Date ? todayDate : new Date(todayDate);
  const todayParts = getWIBParts(today);
  const keluarTxs = (transactions || []).filter((tx) => tx.tipe === 'keluar');
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = createWIBDate(todayParts.year, todayParts.month, todayParts.date - i);
    const dayEnd = createWIBDate(todayParts.year, todayParts.month, todayParts.date - i + 1);
    const dayParts = getWIBParts(dayStart);

    const nominal = keluarTxs
      .filter((tx) => {
        const d = new Date(tx.tanggal).getTime();
        return d >= dayStart.getTime() && d < dayEnd.getTime();
      })
      .reduce((sum, tx) => sum + (Math.round(Number(tx.nominal)) || 0), 0);

    days.push({
      date: dayStart,
      label: INDO_DAYS[dayParts.day],
      shortLabel: INDO_DAYS[dayParts.day].slice(0, 3),
      nominal,
      value: nominal,
      isToday: i === 0
    });
  }

  const total = days.reduce((sum, d) => sum + d.nominal, 0);
  const average = Math.round(total / 7);

  return {
    days,
    total,
    average
  };
}

