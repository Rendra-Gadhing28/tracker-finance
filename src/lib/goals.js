import { getWeekRange, isDateInWeek } from './week.js';

/**
 * Calculate progress for each goal per PRD Section 18.2.
 *
 * @param {Array} goals
 * @param {Array} transactions
 * @returns {Array} goals enriched with terkumpul, rawPersen, persen, barPersen, isAchieved, lebih
 */
export function calculateGoalProgress(goals = [], transactions = []) {
  const tabungTxs = (transactions || []).filter((tx) => tx.tipe === 'tabung');
  const sumByGoal = new Map();

  for (const tx of tabungTxs) {
    if (tx.goal_id) {
      sumByGoal.set(
        tx.goal_id,
        (sumByGoal.get(tx.goal_id) || 0) + (Math.round(Number(tx.nominal)) || 0)
      );
    }
  }

  return (goals || []).map((goal) => {
    const target = Math.round(Number(goal.target)) || 0;
    const terkumpul = sumByGoal.get(goal.id) || 0;
    const rawPersen = target > 0 ? (terkumpul / target) * 100 : 0;
    const persen = Math.round(rawPersen);
    const barPersen = Math.min(100, Math.max(0, rawPersen));
    const isAchieved = target > 0 ? terkumpul >= target : false;
    const lebih = isAchieved && terkumpul > target ? terkumpul - target : 0;

    return {
      ...goal,
      target,
      terkumpul,
      rawPersen,
      persen,
      barPersen,
      isAchieved,
      isReached: isAchieved,
      lebih,
      kelebihan: lebih
    };
  });
}

/**
 * Calculate ETA estimation for a goal per PRD Section 18.2.
 *
 * @param {Object} options
 * @param {Object} options.goal
 * @param {Array} [options.transactions=[]]
 * @param {number} [options.budgetNabungLimit=29000]
 * @param {Date|string|number} [options.todayDate=new Date()]
 * @returns {{ laju: number, minggu: number|null, text: string } | null}
 */
export function calculateGoalEta(options = {}) {
  let goal, transactions, budgetNabungLimit, todayDate;

  // Support positional calculateGoalEta(goal, transactions, budgetNabungLimit, todayDate)
  if (options && (options.id !== undefined || options.target !== undefined) && options.goal === undefined) {
    goal = options;
    transactions = arguments[1] || [];
    budgetNabungLimit = arguments[2] ?? 29000;
    todayDate = arguments[3] ?? new Date();
  } else {
    goal = options.goal;
    transactions = options.transactions || [];
    budgetNabungLimit = options.budgetNabungLimit ?? 29000;
    todayDate = options.todayDate ?? new Date();
  }

  if (!goal) return null;

  const target = Math.round(Number(goal.target)) || 0;

  // Compute or reuse terkumpul
  let terkumpul;
  if (goal.terkumpul !== undefined) {
    terkumpul = Math.round(Number(goal.terkumpul)) || 0;
  } else {
    terkumpul = (transactions || [])
      .filter((tx) => tx.tipe === 'tabung' && tx.goal_id === goal.id)
      .reduce((sum, tx) => sum + (Math.round(Number(tx.nominal)) || 0), 0);
  }

  // Jika terkumpul >= goal.target: return null per PRD 18.2
  if (target > 0 && terkumpul >= target) {
    return null;
  }

  const today = todayDate instanceof Date ? todayDate : new Date(todayDate);
  const todayMs = today.getTime();
  const window28DaysMs = 28 * 24 * 60 * 60 * 1000;
  const windowStartMs = todayMs - window28DaysMs;

  const goalDeposits = (transactions || []).filter(
    (tx) => tx.tipe === 'tabung' && tx.goal_id === goal.id
  );

  const recentDeposits = goalDeposits.filter((tx) => {
    const d = new Date(tx.tanggal).getTime();
    return d >= windowStartMs && d <= todayMs;
  });

  let laju;
  if (recentDeposits.length < 2) {
    laju = budgetNabungLimit;
  } else {
    const totalRecent = recentDeposits.reduce(
      (sum, tx) => sum + (Math.round(Number(tx.nominal)) || 0),
      0
    );
    laju = totalRecent / 4;
  }

  if (laju <= 0) {
    return {
      laju: 0,
      minggu: null,
      text: '—',
      estimasiMinggu: null,
      estimasiLabel: '—'
    };
  }

  const sisa = Math.max(0, target - terkumpul);
  const minggu = Math.ceil(sisa / laju);
  const text = `± ${minggu} minggu lagi`;

  return {
    laju,
    minggu,
    text,
    estimasiMinggu: minggu,
    estimasiLabel: text
  };
}

/**
 * Calculate general savings (tabungan umum) per PRD Section 18.2:
 * Sum of tx.nominal where tx.tipe === 'tabung' AND (!tx.goal_id OR goal_id does not exist in active goals).
 *
 * @param {Array} goals
 * @param {Array} transactions
 * @returns {number}
 */
export function calculateGeneralSavings(goals = [], transactions = []) {
  const activeGoalIds = new Set((goals || []).map((g) => g.id));
  return (transactions || [])
    .filter((tx) => tx.tipe === 'tabung' && (!tx.goal_id || !activeGoalIds.has(tx.goal_id)))
    .reduce((sum, tx) => sum + (Math.round(Number(tx.nominal)) || 0), 0);
}

/**
 * Calculate total savings and weekly progress per PRD Section 18.2 & 18.3.
 *
 * @param {Array|Object} transactions
 * @param {Date|string|number} [currentWeekStart]
 * @param {Date|string|number} [currentWeekEnd]
 * @param {number} [budgetNabungLimit=29000]
 * @returns {{ totalAllTime: number, totalMingguIni: number, budgetNabungLimit: number, persenMingguIni: number }}
 */
export function calculateTotalSavings(
  transactions = [],
  currentWeekStart,
  currentWeekEnd,
  budgetNabungLimit = 29000
) {
  let txList = transactions;
  let start = currentWeekStart;
  let end = currentWeekEnd;
  let limit = budgetNabungLimit;

  // Support options object
  if (transactions && !Array.isArray(transactions) && typeof transactions === 'object') {
    txList = transactions.transactions || [];
    start = transactions.currentWeekStart;
    end = transactions.currentWeekEnd;
    limit = transactions.budgetNabungLimit ?? 29000;
  }

  let startMs;
  let endMs;

  if (start && end) {
    startMs = (start instanceof Date ? start : new Date(start)).getTime();
    endMs = (end instanceof Date ? end : new Date(end)).getTime();
  } else {
    const currentWeek = getWeekRange(new Date(), 1);
    startMs = currentWeek.start.getTime();
    endMs = currentWeek.end.getTime();
  }

  let totalAllTime = 0;
  let totalMingguIni = 0;

  for (const tx of txList || []) {
    if (tx.tipe === 'tabung') {
      const nominal = Math.round(Number(tx.nominal)) || 0;
      totalAllTime += nominal;
      const txMs = new Date(tx.tanggal).getTime();
      if (txMs >= startMs && txMs < endMs) {
        totalMingguIni += nominal;
      }
    }
  }

  const persenMingguIni = limit > 0 ? Math.round((totalMingguIni / limit) * 100) : 0;

  return {
    totalAllTime,
    totalMingguIni,
    budgetNabungLimit: limit,
    persenMingguIni
  };
}

/**
 * Backward compatibility wrapper for full goal metrics.
 */
export function calculateGoalMetrics({
  goals = [],
  transactions = [],
  weeklyNabungLimit = 29000,
  startDayOfWeek = 1,
  now = new Date()
} = {}) {
  const progressList = calculateGoalProgress(goals, transactions);
  const currentWeek = getWeekRange(now, startDayOfWeek);

  const goalsWithMetrics = progressList.map((g) => {
    const eta = calculateGoalEta({
      goal: g,
      transactions,
      budgetNabungLimit: weeklyNabungLimit,
      todayDate: now
    });

    const goalDeposits = (transactions || [])
      .filter((t) => t.tipe === 'tabung' && t.goal_id === g.id)
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    return {
      ...g,
      estimasiMinggu: eta ? eta.minggu : null,
      estimasiLabel: eta ? eta.text : null,
      history: goalDeposits
    };
  });

  // Sort unreached first, then older created first
  goalsWithMetrics.sort((a, b) => {
    if (a.isAchieved !== b.isAchieved) {
      return a.isAchieved ? 1 : -1;
    }
    const timeA = a.dibuat ? new Date(a.dibuat).getTime() : 0;
    const timeB = b.dibuat ? new Date(b.dibuat).getTime() : 0;
    return timeA - timeB;
  });

  const tabunganUmum = calculateGeneralSavings(goals, transactions);
  const totalSavings = calculateTotalSavings(
    transactions,
    currentWeek.start,
    currentWeek.end,
    weeklyNabungLimit
  );

  return {
    goalsWithMetrics,
    tabunganUmum,
    totalDitabung: totalSavings.totalAllTime,
    mingguIniDitabung: totalSavings.totalMingguIni,
    persenMingguIni: totalSavings.persenMingguIni,
    isMaxGoalsReached: (goals || []).length >= 10
  };
}
