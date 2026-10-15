import { formatRp } from './money.js';
import { getWIBParts, createWIBDate, getWeekRange, toWIBISOString } from './week.js';

export const INDO_DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/**
 * 10 Official Badges Definitions per PRD Section 25.2.
 */
export const BADGES_DEFINITION = [
  { id: 'first_tx', icon: '📝', name: 'Catatan pertama', desc: 'Minimal 1 transaksi' },
  { id: 'week_active', icon: '🗓️', name: 'Seminggu rajin', desc: 'Mencatat di 7 hari kalender berbeda berturut-turut' },
  { id: 'streak_3', icon: '🐾', name: 'Hemat 3 hari', desc: 'Hemat 3 hari beruntun' },
  { id: 'streak_7', icon: '🌟', name: 'Hemat 7 hari', desc: 'Hemat 7 hari beruntun' },
  { id: 'streak_30', icon: '🏔️', name: 'Hemat 30 hari', desc: 'Hemat 30 hari beruntun' },
  { id: 'perfect_week', icon: '🍃', name: 'Minggu sempurna', desc: '1 minggu penuh selesai dengan total keluar ≤ A dan 0 kategori lewat limit' },
  { id: 'first_saving', icon: '🐷', name: 'Celengan pertama', desc: 'Setoran tabung pertama' },
  { id: 'goal_reached', icon: '🏁', name: 'Target tercapai', desc: 'Minimal 1 target tercapai' },
  { id: 'savings_100k', icon: '💰', name: 'Penabung 100 ribu', desc: 'Total ditabung mencapai Rp 100.000' },
  { id: 'savings_500k', icon: '🏆', name: 'Penabung 500 ribu', desc: 'Total ditabung mencapai Rp 500.000' }
];

/**
 * Time of Day Resolver per PRD Section 24.2.
 * Uses Asia/Jakarta (WIB) time.
 *
 * - Pagi: 05:00 - 10:59
 * - Siang: 11:00 - 15:59
 * - Senja: 16:00 - 18:29
 * - Malam: 18:30 - 04:59
 *
 * @param {Date|string|number} [date=new Date()]
 * @returns {{ phase: 'pagi'|'siang'|'senja'|'malam', skyTop: string, skyBottom: string, grass: string, celestial: string, creatures: string }}
 */
export function getTimePhase(date = new Date()) {
  const p = getWIBParts(date);
  const totalMinutes = p.hours * 60 + p.minutes;

  // Pagi: 05:00 - 10:59 (300 to 659 mins)
  if (totalMinutes >= 300 && totalMinutes < 660) {
    return {
      phase: 'pagi',
      skyTop: '#BFE3EA',
      skyBottom: '#FFE9C7',
      grass: '#B9D8A2',
      celestial: 'sun',
      creatures: 'birds'
    };
  }

  // Siang: 11:00 - 15:59 (660 to 959 mins)
  if (totalMinutes >= 660 && totalMinutes < 960) {
    return {
      phase: 'siang',
      skyTop: '#9ECFE0',
      skyBottom: '#E3F1E4',
      grass: '#B5D6A0',
      celestial: 'clouds',
      creatures: 'butterflies'
    };
  }

  // Senja: 16:00 - 18:29 (960 to 1109 mins)
  if (totalMinutes >= 960 && totalMinutes < 1110) {
    return {
      phase: 'senja',
      skyTop: '#F6C9A8',
      skyBottom: '#C9A7D6',
      grass: '#A3C28A',
      celestial: 'sun_orange',
      creatures: 'birds_return'
    };
  }

  // Malam: 18:30 - 04:59 (1110 to 1439, or 0 to 299 mins)
  return {
    phase: 'malam',
    skyTop: '#2F3F6B',
    skyBottom: '#5A6A99',
    grass: '#6F8F7A',
    celestial: 'moon_stars',
    creatures: 'fireflies'
  };
}

/**
 * Calculate Streak Hari Hemat per PRD Section 23.
 *
 * @param {Object} options
 * @param {Array} [options.transactions=[]]
 * @param {number} [options.totalWeeklyLimit=116000]
 * @param {string|string[]} [options.tanpaJajan=''] - Comma-separated 'YYYY-MM-DD' or array
 * @param {Date|string|number} [options.now=new Date()]
 * @returns {Object}
 */
export function calculateStreak({
  transactions = [],
  totalWeeklyLimit = 116000,
  tanpaJajan = '',
  now = new Date()
} = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowParts = getWIBParts(nowDate);
  const pad = (n) => String(n).padStart(2, '0');
  const todayISO = `${nowParts.year}-${pad(nowParts.month + 1)}-${pad(nowParts.date)}`;

  // Batas harian = A ÷ 7, dibulatkan ke bawah kelipatan Rp 100 (PRD 23.2)
  const batasHarian = Math.floor(totalWeeklyLimit / 7 / 100) * 100;

  // Parse tanpaJajan string / array into a Set of YYYY-MM-DD
  let tanpaJajanSet = new Set();
  if (typeof tanpaJajan === 'string' && tanpaJajan.trim()) {
    tanpaJajanSet = new Set(
      tanpaJajan
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  } else if (Array.isArray(tanpaJajan)) {
    tanpaJajanSet = new Set(tanpaJajan.map((s) => String(s).trim()).filter(Boolean));
  }

  // Group transactions by calendar day in WIB
  const txsByDate = new Map();
  for (const tx of transactions || []) {
    if (!tx.tanggal) continue;
    const d = new Date(tx.tanggal);
    const p = getWIBParts(d);
    const dateStr = `${p.year}-${pad(p.month + 1)}-${pad(p.date)}`;
    if (!txsByDate.has(dateStr)) {
      txsByDate.set(dateStr, []);
    }
    txsByDate.get(dateStr).push(tx);
  }

  /**
   * Helper to evaluate classification of any completed calendar day
   * @param {string} dateStr YYYY-MM-DD
   * @returns {{ type: 'hemat'|'lewat'|'kosong', keluar: number, symbol: '🐾'|'✕'|'·' }}
   */
  function evaluateDay(dateStr) {
    const dayTxs = txsByDate.get(dateStr) || [];
    const keluar = dayTxs
      .filter((t) => t.tipe === 'keluar')
      .reduce((sum, t) => sum + (Math.round(Number(t.nominal)) || 0), 0);
    const hasAnyTx = dayTxs.length > 0;
    const isTanpaJajan = tanpaJajanSet.has(dateStr);

    if (keluar > batasHarian) {
      return { type: 'lewat', keluar, symbol: '✕' };
    }
    if (keluar <= batasHarian && (hasAnyTx || isTanpaJajan)) {
      return { type: 'hemat', keluar, symbol: '🐾' };
    }
    return { type: 'kosong', keluar: 0, symbol: '·' };
  }

  // Find all dates with activity (transactions or marked tanpaJajan) before today
  const allActiveDates = [...new Set([...txsByDate.keys(), ...tanpaJajanSet])]
    .filter((d) => d < todayISO)
    .sort();

  let currentStreak = 0;
  let bestStreak = 0;

  if (allActiveDates.length > 0) {
    const earliestISO = allActiveDates[0];

    // 1. Calculate currentStreak: count backward starting from yesterday
    let dayOffset = 1;
    while (true) {
      const d = createWIBDate(nowParts.year, nowParts.month, nowParts.date - dayOffset);
      const p = getWIBParts(d);
      const dateStr = `${p.year}-${pad(p.month + 1)}-${pad(p.date)}`;

      if (dateStr < earliestISO) {
        break;
      }

      const res = evaluateDay(dateStr);
      if (res.type === 'hemat') {
        currentStreak++;
      } else if (res.type === 'lewat') {
        // Lewat breaks the streak
        break;
      }
      // 'kosong' is neutral: skipped without breaking or incrementing

      dayOffset++;
      if (dayOffset > 730) break; // safety guard (2 years)
    }

    // 2. Calculate bestStreak across all history from earliestISO up to yesterday
    const [y0, m0, d0] = earliestISO.split('-').map(Number);
    const startDate = createWIBDate(y0, m0 - 1, d0);
    const yesterdayDate = createWIBDate(nowParts.year, nowParts.month, nowParts.date - 1);
    const totalDays = Math.round((yesterdayDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    let running = 0;
    for (let i = 0; i <= totalDays; i++) {
      const curDate = createWIBDate(y0, m0 - 1, d0 + i);
      const p = getWIBParts(curDate);
      const dateStr = `${p.year}-${pad(p.month + 1)}-${pad(p.date)}`;

      const res = evaluateDay(dateStr);
      if (res.type === 'hemat') {
        running++;
        if (running > bestStreak) {
          bestStreak = running;
        }
      } else if (res.type === 'lewat') {
        running = 0;
      }
      // 'kosong' is neutral: keep running unchanged
    }

    bestStreak = Math.max(bestStreak, currentStreak);
  }

  // 3. Build last7Days ending with today
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = createWIBDate(nowParts.year, nowParts.month, nowParts.date - i);
    const p = getWIBParts(d);
    const dateStr = `${p.year}-${pad(p.month + 1)}-${pad(p.date)}`;
    const dayLabel = INDO_DAYS_SHORT[p.day];

    if (i === 0) {
      // Today (running)
      last7Days.push({
        dateStr,
        dayLabel,
        symbol: '◌',
        type: 'today'
      });
    } else {
      const res = evaluateDay(dateStr);
      last7Days.push({
        dateStr,
        dayLabel,
        symbol: res.symbol,
        type: res.type
      });
    }
  }

  // 4. canMarkTanpaJajanToday (PRD 23.3: mulai 18:00 WIB, 0 keluar txs, belum ditandai)
  const todayTxs = txsByDate.get(todayISO) || [];
  const todayKeluarCount = todayTxs.filter((t) => t.tipe === 'keluar').length;
  const canMarkTanpaJajanToday =
    nowParts.hours >= 18 && todayKeluarCount === 0 && !tanpaJajanSet.has(todayISO);

  // 5. streakTitle (PRD 23.5)
  const streakTitle =
    currentStreak > 0 ? `${currentStreak} hari hemat` : 'Ayo mulai hari hemat pertama';

  return {
    currentStreak,
    bestStreak,
    last7Days,
    batasHarian,
    canMarkTanpaJajanToday,
    streakTitle,
    todayISO
  };
}

/**
 * Calculate Badges Engine per PRD Section 25.
 *
 * @param {Object} options
 * @param {Array} [options.transactions=[]]
 * @param {Array} [options.budgets=[]]
 * @param {Array} [options.goals=[]]
 * @param {Object|number|null} [options.streak=null]
 * @param {number} [options.totalWeeklyLimit=116000]
 * @param {number} [options.startDayOfWeek=1]
 * @param {Date|string|number} [options.now=new Date()]
 * @returns {{ badges: Array, unlockedCount: number, totalBadges: number }}
 */
export function calculateBadges({
  transactions = [],
  budgets = [],
  goals = [],
  streak = null,
  totalWeeklyLimit = 116000,
  startDayOfWeek = 1,
  now = new Date()
} = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();

  // If streak is not passed as an object with bestStreak, compute it
  let effectiveBestStreak = 0;
  if (typeof streak === 'number') {
    effectiveBestStreak = streak;
  } else if (streak && typeof streak.bestStreak === 'number') {
    effectiveBestStreak = streak.bestStreak;
  } else {
    const computedStreak = calculateStreak({
      transactions,
      totalWeeklyLimit,
      now: nowDate
    });
    effectiveBestStreak = computedStreak.bestStreak;
  }

  // Pre-sort transactions ascending by date for unlockedAt lookups
  const sortedTxsAsc = [...(transactions || [])].sort((a, b) => {
    return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
  });

  const pad = (n) => String(n).padStart(2, '0');

  // 1. first_tx: Minimal 1 transaksi
  const hasFirstTx = sortedTxsAsc.length >= 1;
  const firstTxUnlockedAt = hasFirstTx ? sortedTxsAsc[0].tanggal : null;

  // 2. week_active: Mencatat di 7 hari kalender berbeda berturut-turut
  const activeDatesSet = new Set();
  for (const tx of sortedTxsAsc) {
    if (!tx.tanggal) continue;
    const p = getWIBParts(new Date(tx.tanggal));
    activeDatesSet.add(`${p.year}-${pad(p.month + 1)}-${pad(p.date)}`);
  }
  const uniqueDatesSorted = [...activeDatesSet].sort();

  let maxConsecutiveActive = 0;
  let runningConsecutive = 0;
  let prevDayIndex = null;
  let weekActiveUnlockedAt = null;

  for (const dateStr of uniqueDatesSorted) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayIndex = Math.round(createWIBDate(y, m - 1, d).getTime() / (24 * 60 * 60 * 1000));
    if (prevDayIndex === null || dayIndex === prevDayIndex + 1) {
      runningConsecutive++;
    } else {
      runningConsecutive = 1;
    }
    prevDayIndex = dayIndex;

    if (runningConsecutive >= 7 && !weekActiveUnlockedAt) {
      weekActiveUnlockedAt = dateStr;
    }
    if (runningConsecutive > maxConsecutiveActive) {
      maxConsecutiveActive = runningConsecutive;
    }
  }
  const isWeekActive = maxConsecutiveActive >= 7;

  // 3. streak_3: Streak >= 3
  const isStreak3 = effectiveBestStreak >= 3;

  // 4. streak_7: Streak >= 7
  const isStreak7 = effectiveBestStreak >= 7;

  // 5. streak_30: Streak >= 30
  const isStreak30 = effectiveBestStreak >= 30;

  // 6. perfect_week: 1 minggu penuh selesai dengan total keluar <= A dan 0 kategori lewat limit
  // Group keluar transactions by completed week
  const keluarBudgetCats = (budgets || []).filter((b) => b.tipe === 'keluar');
  const weekGroups = new Map();

  for (const tx of sortedTxsAsc) {
    if (tx.tipe !== 'keluar' || !tx.tanggal) continue;
    const txDate = new Date(tx.tanggal);
    const week = getWeekRange(txDate, startDayOfWeek);

    // Only consider weeks that are fully completed before now
    if (week.end.getTime() > nowMs) continue;

    const weekKey = week.start.getTime();
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, {
        range: week,
        txs: []
      });
    }
    weekGroups.get(weekKey).txs.push(tx);
  }

  let isPerfectWeek = false;
  let perfectWeekUnlockedAt = null;

  for (const group of weekGroups.values()) {
    const totalKeluar = group.txs.reduce((sum, t) => sum + (Math.round(Number(t.nominal)) || 0), 0);
    if (totalKeluar <= totalWeeklyLimit) {
      let anyCatOver = false;
      for (const cat of keluarBudgetCats) {
        const catLimit = Math.round(Number(cat.limit_mingguan ?? cat.limit)) || 0;
        if (catLimit > 0) {
          const catSpent = group.txs
            .filter((t) => t.kategori_id === cat.id)
            .reduce((sum, t) => sum + (Math.round(Number(t.nominal)) || 0), 0);
          if (catSpent > catLimit) {
            anyCatOver = true;
            break;
          }
        }
      }

      if (!anyCatOver) {
        isPerfectWeek = true;
        perfectWeekUnlockedAt = toWIBISOString(group.range.end);
        break;
      }
    }
  }

  // 7. first_saving: Setoran tabung pertama
  const tabungTxs = sortedTxsAsc.filter((t) => t.tipe === 'tabung');
  const hasFirstSaving = tabungTxs.length > 0;
  const firstSavingUnlockedAt = hasFirstSaving ? tabungTxs[0].tanggal : null;

  // 8. goal_reached: Minimal 1 target tercapai
  let isGoalReached = false;
  let goalReachedUnlockedAt = null;

  for (const g of goals || []) {
    const target = Math.round(Number(g.target)) || 0;
    if (target > 0) {
      let terkumpul = Math.round(Number(g.terkumpul)) || 0;
      for (const t of tabungTxs) {
        if (t.goal_id === g.id) {
          terkumpul += Math.round(Number(t.nominal)) || 0;
          if (terkumpul >= target) {
            isGoalReached = true;
            if (!goalReachedUnlockedAt) {
              goalReachedUnlockedAt = t.tanggal;
            }
            break;
          }
        }
      }
      if (terkumpul >= target || g.isAchieved || g.isReached) {
        isGoalReached = true;
        if (!goalReachedUnlockedAt) {
          goalReachedUnlockedAt = g.updated_at || g.created_at || new Date().toISOString();
        }
      }
      if (isGoalReached) break;
    }
  }

  // 9. savings_100k: Total ditabung >= 100.000
  // 10. savings_500k: Total ditabung >= 500.000
  let cumulativeSavings = 0;
  let savings100kUnlockedAt = null;
  let savings500kUnlockedAt = null;

  for (const t of tabungTxs) {
    cumulativeSavings += Math.round(Number(t.nominal)) || 0;
    if (cumulativeSavings >= 100000 && !savings100kUnlockedAt) {
      savings100kUnlockedAt = t.tanggal;
    }
    if (cumulativeSavings >= 500000 && !savings500kUnlockedAt) {
      savings500kUnlockedAt = t.tanggal;
    }
  }

  const isSavings100k = cumulativeSavings >= 100000;
  const isSavings500k = cumulativeSavings >= 500000;

  // Build the 10 badges array
  const badges = [
    {
      ...BADGES_DEFINITION[0],
      unlocked: hasFirstTx,
      progressText: hasFirstTx ? 'Selesai' : '0/1 transaksi',
      unlockedAt: firstTxUnlockedAt
    },
    {
      ...BADGES_DEFINITION[1],
      unlocked: isWeekActive,
      progressText: isWeekActive ? 'Selesai' : `${maxConsecutiveActive}/7 hari`,
      unlockedAt: weekActiveUnlockedAt
    },
    {
      ...BADGES_DEFINITION[2],
      unlocked: isStreak3,
      progressText: isStreak3 ? 'Selesai' : `${Math.min(3, effectiveBestStreak)}/3 hari`,
      unlockedAt: isStreak3 ? 'Streak 3 terpenuhi' : null
    },
    {
      ...BADGES_DEFINITION[3],
      unlocked: isStreak7,
      progressText: isStreak7 ? 'Selesai' : `${Math.min(7, effectiveBestStreak)}/7 hari`,
      unlockedAt: isStreak7 ? 'Streak 7 terpenuhi' : null
    },
    {
      ...BADGES_DEFINITION[4],
      unlocked: isStreak30,
      progressText: isStreak30 ? 'Selesai' : `${Math.min(30, effectiveBestStreak)}/30 hari`,
      unlockedAt: isStreak30 ? 'Streak 30 terpenuhi' : null
    },
    {
      ...BADGES_DEFINITION[5],
      unlocked: isPerfectWeek,
      progressText: isPerfectWeek ? 'Selesai' : '0/1 minggu sempurna',
      unlockedAt: perfectWeekUnlockedAt
    },
    {
      ...BADGES_DEFINITION[6],
      unlocked: hasFirstSaving,
      progressText: hasFirstSaving ? 'Selesai' : '0/1 setoran',
      unlockedAt: firstSavingUnlockedAt
    },
    {
      ...BADGES_DEFINITION[7],
      unlocked: isGoalReached,
      progressText: isGoalReached ? 'Selesai' : '0/1 target',
      unlockedAt: goalReachedUnlockedAt
    },
    {
      ...BADGES_DEFINITION[8],
      unlocked: isSavings100k,
      progressText: isSavings100k ? 'Selesai' : `${formatRp(cumulativeSavings)} / Rp 100.000`,
      unlockedAt: savings100kUnlockedAt
    },
    {
      ...BADGES_DEFINITION[9],
      unlocked: isSavings500k,
      progressText: isSavings500k ? 'Selesai' : `${formatRp(cumulativeSavings)} / Rp 500.000`,
      unlockedAt: savings500kUnlockedAt
    }
  ];

  badges.unlockedCount = badges.filter((b) => b.unlocked).length;
  badges.totalBadges = badges.length;
  badges.badges = badges;

  return badges;
}
