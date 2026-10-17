/**
 * Neko Dompet — backend Apps Script (v1.1) + Executive Visual Dashboard
 * Selaras dengan PRD.md
 *
 * FITUR LENGKAP:
 * 1. REST API real-time (doGet & doPost) untuk aplikasi Neko Dompet.
 * 2. Inisialisasi otomatis: Transaksi, Budget, Goals, Setting.
 * 3. Dashboard Visual Profesional di Spreadsheet:
 *    - 4 KPI Metrik Card (Saldo Dompet, Total Masuk, Total Keluar, Total Ditabung).
 *    - Tabel Analisis Kategori & Realisasi vs Budget.
 *    - Donut Chart (Proporsi Pengeluaran per Kategori) warna pastel Neko Dompet.
 *    - Line Chart (Tren Pengeluaran Harian Rp).
 *
 * CARA PASANG:
 * 1) Buka Spreadsheet > Extensions > Apps Script > tempel seluruh isi file ini.
 * 2) Di toolbar atas, pilih fungsi "setup" lalu klik tombol "Run" (Izinkan akses Google).
 * 3) Salin TOKEN yang muncul di Log Eksekusi atau klik menu "🐾 Neko Dompet > 🔑 Tampilkan Token" di spreadsheet.
 * 4) Deploy > Manage deployments > Edit > New version (Who has access: Anyone) > Deploy.
 */

const VERSION = '1.1';
const TZ = 'Asia/Jakarta';
const TIPE = ['keluar', 'masuk', 'tabung'];
const MAX_NOMINAL = 10000000;
const MAX_GOALS = 10;
const MAX_BATCH = 20;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;
// ID Kategori & Aturan Warna: terima HEX (#RRGGBB) atau nama tema (jajan, pulsa, bensin, dll)
const COLOR_RE = /^([a-zA-Z0-9_\-]{1,16}|#[0-9A-Fa-f]{6})$/;

const SHEETS = {
  Transaksi: ['id', 'tanggal', 'tipe', 'kategori_id', 'nominal', 'catatan', 'goal_id'],
  Budget:    ['id', 'nama', 'ikon', 'warna', 'limit_mingguan', 'tipe', 'urut'],
  Goals:     ['id', 'nama', 'ikon', 'warna', 'target', 'dibuat'],
  Setting:   ['key', 'value']
};

// Pengaturan yang boleh disimpan beserta aturannya (PRD bagian 13 dan 23)
const NUM_KEYS = ['uang_jajan_mingguan', 'awal_minggu', 'saldo_awal'];
const SETTING_RULES = {
  uang_jajan_mingguan: v => inRange_(v, 0, 100000000),
  awal_minggu:         v => inRange_(v, 1, 7),               // 1 = Senin ... 7 = Minggu
  saldo_awal:          v => inRange_(v, -100000000, 100000000),
  tanpa_jajan:         v => typeof v === 'string' && v.length <= 700 &&
                            (v === '' || /^\d{4}-\d{2}-\d{2}(,\d{4}-\d{2}-\d{2})*$/.test(v))
};

/* ============================ MENU UI ============================ */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🐾 Neko Dompet')
      .addItem('📊 Buat / Perbarui Dashboard & Chart', 'buildDashboard')
      .addItem('🔑 Tampilkan Token API', 'showToken')
      .addItem('🔄 Reset / Jalankan Setup Awal', 'setup')
      .addToUi();
  } catch (e) {
    // Abaikan jika dibuka tanpa UI interaktif
  }
}

/* ============================ SETUP ============================ */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    formatHeader_(sh);
  });

  // Teks polos untuk kolom teks, format angka untuk nominal
  const tx = ss.getSheetByName('Transaksi');
  tx.getRange('A:D').setNumberFormat('@');
  tx.getRange('E:E').setNumberFormat('"Rp"#,##0');
  tx.getRange('F:G').setNumberFormat('@');
  
  const bd = ss.getSheetByName('Budget');
  bd.getRange('A:D').setNumberFormat('@');
  bd.getRange('E:E').setNumberFormat('"Rp"#,##0');
  bd.getRange('F:F').setNumberFormat('@');
  
  const gl = ss.getSheetByName('Goals');
  gl.getRange('A:D').setNumberFormat('@');
  gl.getRange('E:E').setNumberFormat('"Rp"#,##0');
  gl.getRange('F:F').setNumberFormat('@');
  
  ss.getSheetByName('Setting').getRange('A:B').setNumberFormat('@');

  if (bd.getLastRow() < 2) {
    bd.getRange(2, 1, 6, 7).setValues([
      ['jajan',   'Jajan & makan', '🍙', '#F2B28C', 72500,  'keluar', 1],
      ['pulsa',   'Pulsa',         '📱', '#9CC5D9', 4000,   'keluar', 2],
      ['bensin',  'Bensin',        '⛽', '#9FC88A', 25000,  'keluar', 3],
      ['jajanin', 'Jajanin',       '🎁', '#C9B0E0', 14500,  'keluar', 4],
      ['nabung',  'Nabung',        '🐷', '#F2B8C6', 29000,  'tabung', 5],
      ['masuk',   'Uang jajan',    '💰', '#F4D58D', 145000, 'masuk',  6]
    ]);
  } else {
    // Migrasi data lama jika masih menggunakan id 'makan' atau 'uang'
    const bdData = bd.getRange(2, 1, Math.min(bd.getLastRow() - 1, 20), 1).getValues();
    for (let i = 0; i < bdData.length; i++) {
      if (bdData[i][0] === 'makan') bd.getRange(i + 2, 1).setValue('jajan');
      if (bdData[i][0] === 'uang') bd.getRange(i + 2, 1).setValue('masuk');
    }
  }

  // Migrasi id transaksi lama di sheet Transaksi
  if (tx.getLastRow() > 1) {
    const txCats = tx.getRange(2, 4, tx.getLastRow() - 1, 1).getValues();
    let txChanged = false;
    for (let i = 0; i < txCats.length; i++) {
      if (txCats[i][0] === 'makan') { txCats[i][0] = 'jajan'; txChanged = true; }
      if (txCats[i][0] === 'uang') { txCats[i][0] = 'masuk'; txChanged = true; }
    }
    if (txChanged) tx.getRange(2, 4, txCats.length, 1).setValues(txCats);
  }
  const st = ss.getSheetByName('Setting');
  if (st.getLastRow() < 2) {
    st.getRange(2, 1, 4, 2).setValues([
      ['uang_jajan_mingguan', 145000],
      ['awal_minggu', 1],
      ['saldo_awal', 0],
      ['tanpa_jajan', '']
    ]);
  }

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN')) props.setProperty('TOKEN', Utilities.getUuid());
  if (!props.getProperty('REV')) props.setProperty('REV', '1');

  // Pemicu: edit manual di Sheet menaikkan rev supaya aplikasi ikut menyegarkan
  const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'handleSheetChange');
  if (!has) ScriptApp.newTrigger('handleSheetChange').forSpreadsheet(ss).onChange().create();

  // Bangun Dashboard Visual
  buildDashboard();

  const token = props.getProperty('TOKEN');
  Logger.log('====================================');
  Logger.log('TOKEN: ' + token);
  Logger.log('====================================');
}

function showToken() {
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN') || 'Belum diatur (jalankan setup())';
  Logger.log('TOKEN: ' + token);
  try {
    SpreadsheetApp.getUi().alert(
      '🔑 Token API Neko Dompet',
      'Salin token ini ke .env di project Anda:\n\n' + token,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // Tanpa UI
  }
}

function rotateToken() {
  const t = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('TOKEN', t);
  Logger.log('TOKEN BARU: ' + t);
  showToken();
}

/**
 * Mereset seluruh data dummy / transaksi / goals di spreadsheet.
 * Mengosongkan sheet Transaksi dan Goals, serta mengembalikan Setting dan Budget ke bawaan.
 */
function resetAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const tx = ss.getSheetByName('Transaksi');
  if (tx && tx.getLastRow() > 1) {
    tx.getRange(2, 1, tx.getLastRow() - 1, tx.getLastColumn()).clearContent();
  }

  const gl = ss.getSheetByName('Goals');
  if (gl && gl.getLastRow() > 1) {
    gl.getRange(2, 1, gl.getLastRow() - 1, gl.getLastColumn()).clearContent();
  }

  const st = ss.getSheetByName('Setting');
  if (st) {
    if (st.getLastRow() > 1) {
      st.getRange(2, 1, st.getLastRow() - 1, st.getLastColumn()).clearContent();
    }
    st.getRange(2, 1, 4, 2).setValues([
      ['uang_jajan_mingguan', 145000],
      ['awal_minggu', 1],
      ['saldo_awal', 0],
      ['tanpa_jajan', '']
    ]);
  }

  const bd = ss.getSheetByName('Budget');
  if (bd) {
    if (bd.getLastRow() > 1) {
      bd.getRange(2, 1, bd.getLastRow() - 1, bd.getLastColumn()).clearContent();
    }
    bd.getRange(2, 1, 6, 7).setValues([
      ['jajan',   'Jajan & makan', '🍙', '#F2B28C', 72500,  'keluar', 1],
      ['pulsa',   'Pulsa',         '📱', '#9CC5D9', 4000,   'keluar', 2],
      ['bensin',  'Bensin',        '⛽', '#9FC88A', 25000,  'keluar', 3],
      ['jajanin', 'Jajanin',       '🎁', '#C9B0E0', 14500,  'keluar', 4],
      ['nabung',  'Nabung',        '🐷', '#F2B8C6', 29000,  'tabung', 5],
      ['masuk',   'Uang jajan',    '💰', '#F4D58D', 145000, 'masuk',  6]
    ]);
  }

  bump_();
  buildDashboard();
  Logger.log('Semua data berhasil direset ke kondisi awal.');
}

function handleSheetChange(e) {
  if (e && e.changeType === 'FORMAT') return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    bump_();
    updateDailyChartData_();
  } finally {
    lock.releaseLock();
  }
}

function getFormulaSep_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const loc = (ss.getSpreadsheetLocale() || '').toLowerCase();
  const isSemi = ['id', 'in', 'fr', 'de', 'es', 'it', 'nl', 'pt', 'ru', 'tr', 'vi']
    .some(l => loc === l || loc.startsWith(l + '_') || loc.startsWith(l + '-'));
  return isSemi ? ';' : ',';
}

function updateDailyChartData_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dbSheet = ss.getSheetByName('Dashboard');
    if (!dbSheet) return;

    dbSheet.getRange('N8:O8').setValues([['Tanggal', 'Pengeluaran']])
      .setBackground('#EADFCB')
      .setFontColor('#4A3B32')
      .setFontWeight('bold');

    const txRows = rows_('Transaksi').filter(t => t.tipe === 'keluar');
    const dailyMap = {};
    txRows.forEach(t => {
      const d = String(t.tanggal || '').slice(0, 10);
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        dailyMap[d] = (dailyMap[d] || 0) + (Number(t.nominal) || 0);
      }
    });

    const dates = Object.keys(dailyMap).sort();
    const output = [];
    if (dates.length === 0) {
      output.push(['Belum ada transaksi', 0]);
    } else {
      dates.forEach(d => output.push([d, dailyMap[d]]));
    }

    while (output.length < 22) output.push(['', '']);
    dbSheet.getRange(9, 14, output.length, 2).setValues(output);
    dbSheet.getRange('N9:N30').setNumberFormat('@');
    dbSheet.getRange('O9:O30').setNumberFormat('"Rp"#,##0');
  } catch (e) {
    Logger.log('updateDailyChartData_ error: ' + e);
  }
}

/* ============================ DASHBOARD VISUAL ============================ */

function buildDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName('Dashboard') || ss.insertSheet('Dashboard', 0);
  
  ss.setActiveSheet(dbSheet);
  ss.moveActiveSheet(1);

  // Bersihkan konten dan grafik lama
  dbSheet.clear();
  dbSheet.getCharts().forEach(c => dbSheet.removeChart(c));
  dbSheet.setHiddenGridlines(false);

  const sep = getFormulaSep_();

  // 1. Banner Header
  dbSheet.getRange('A1:L2').merge()
    .setValue('🐾 NEKO DOMPET — FINANCIAL OVERVIEW & REAL-TIME DASHBOARD')
    .setBackground('#4A3B32')
    .setFontColor('#FFFDF7')
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // 2. KPI Cards (otomatis menyesuaikan pemisah formula sesuai locale spreadsheet)
  createKpiCard_(dbSheet, 'A4:C4', 'A5:C6', '💰 SALDO DOMPET SAAT INI', 
    `=IFERROR(VLOOKUP("saldo_awal"${sep} Setting!A:B${sep} 2${sep} FALSE)${sep} 0) + SUMIFS(Transaksi!E:E${sep} Transaksi!C:C${sep} "masuk") - SUMIFS(Transaksi!E:E${sep} Transaksi!C:C${sep} "keluar") - SUMIFS(Transaksi!E:E${sep} Transaksi!C:C${sep} "tabung")`,
    '#E59A6A', '#FFFDF7');

  createKpiCard_(dbSheet, 'D4:F4', 'D5:F6', '📥 TOTAL UANG MASUK', 
    `=SUMIFS(Transaksi!E:E${sep} Transaksi!C:C${sep} "masuk")`, 
    '#7BA883', '#FFFDF7');

  createKpiCard_(dbSheet, 'G4:I4', 'G5:I6', '💸 TOTAL PENGELUARAN', 
    `=SUMIFS(Transaksi!E:E${sep} Transaksi!C:C${sep} "keluar")`, 
    '#C46A58', '#FFFDF7');

  createKpiCard_(dbSheet, 'J4:L4', 'J5:L6', '🐷 TOTAL DITABUNG', 
    `=SUMIFS(Transaksi!E:E${sep} Transaksi!C:C${sep} "tabung")`, 
    '#5C82A6', '#FFFDF7');

  // 3. Tabel Ringkasan Kategori
  dbSheet.getRange('A8:F8').merge()
    .setValue('📋 STATUS BUDGET & REALISASI PER KATEGORI')
    .setBackground('#352B24')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(11)
    .setVerticalAlignment('middle');

  const catHeaders = ['Kategori', 'Tipe', 'Limit Mingguan', 'Realisasi Terpakai', 'Sisa Budget', '% Terpakai'];
  dbSheet.getRange('A9:F9').setValues([catHeaders])
    .setBackground('#EADFCB')
    .setFontColor('#4A3B32')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  const catDataRows = [
    [`=IFERROR(Budget!B2${sep} "Jajan & makan")`, `=IFERROR(Budget!F2${sep} "keluar")`, `=IFERROR(Budget!E2${sep} 72500)`,  `=SUMIFS(Transaksi!E:E${sep} Transaksi!D:D${sep} Budget!A2)`, '=C10-D10', `=IFERROR(D10/C10${sep} 0)`],
    [`=IFERROR(Budget!B3${sep} "Pulsa")`,         `=IFERROR(Budget!F3${sep} "keluar")`, `=IFERROR(Budget!E3${sep} 4000)`,   `=SUMIFS(Transaksi!E:E${sep} Transaksi!D:D${sep} Budget!A3)`, '=C11-D11', `=IFERROR(D11/C11${sep} 0)`],
    [`=IFERROR(Budget!B4${sep} "Bensin")`,        `=IFERROR(Budget!F4${sep} "keluar")`, `=IFERROR(Budget!E4${sep} 25000)`,  `=SUMIFS(Transaksi!E:E${sep} Transaksi!D:D${sep} Budget!A4)`, '=C12-D12', `=IFERROR(D12/C12${sep} 0)`],
    [`=IFERROR(Budget!B5${sep} "Jajanin")`,       `=IFERROR(Budget!F5${sep} "keluar")`, `=IFERROR(Budget!E5${sep} 14500)`,  `=SUMIFS(Transaksi!E:E${sep} Transaksi!D:D${sep} Budget!A5)`, '=C13-D13', `=IFERROR(D13/C13${sep} 0)`],
    [`=IFERROR(Budget!B6${sep} "Nabung")`,        `=IFERROR(Budget!F6${sep} "tabung")`, `=IFERROR(Budget!E6${sep} 29000)`,  `=SUMIFS(Transaksi!E:E${sep} Transaksi!D:D${sep} Budget!A6)`, '=C14-D14', `=IFERROR(D14/C14${sep} 0)`],
    [`=IFERROR(Budget!B7${sep} "Uang jajan")`,    `=IFERROR(Budget!F7${sep} "masuk")`,  `=IFERROR(Budget!E7${sep} 145000)`, `=SUMIFS(Transaksi!E:E${sep} Transaksi!D:D${sep} Budget!A7)`, '="—"',     '="—"']
  ];

  dbSheet.getRange('A10:F15').setFormulas(catDataRows);
  dbSheet.getRange('A10:F15').setVerticalAlignment('middle');
  dbSheet.getRange('A10:A15').setHorizontalAlignment('left');
  dbSheet.getRange('B10:B15').setHorizontalAlignment('center');
  dbSheet.getRange('C10:E15').setNumberFormat('"Rp"#,##0').setHorizontalAlignment('right');
  dbSheet.getRange('F10:F14').setNumberFormat('0.0%').setHorizontalAlignment('right');
  dbSheet.getRange('A10:F15').setBorder(true, true, true, true, true, true, '#D5C7B2', SpreadsheetApp.BorderStyle.SOLID);

  // 4. Helper Pengeluaran Harian untuk Grafik (Kolom N-O)
  updateDailyChartData_();

  // 5. Donut Chart (Proporsi Pengeluaran)
  const pieChart = dbSheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(dbSheet.getRange('A10:A14'))
    .addRange(dbSheet.getRange('D10:D14'))
    .setPosition(8, 7, 10, 10)
    .setOption('title', '🍩 Proporsi Pengeluaran per Kategori')
    .setOption('titleTextStyle', { color: '#4A3B32', fontSize: 13, bold: true })
    .setOption('pieHole', 0.45)
    .setOption('colors', ['#F2B28C', '#9CC5D9', '#9FC88A', '#C9B0E0', '#F2B8C6'])
    .setOption('legend', { position: 'right', textStyle: { color: '#4A3B32', fontSize: 11 } })
    .setOption('backgroundColor', '#FFFDF7')
    .setOption('width', 460)
    .setOption('height', 280)
    .build();

  dbSheet.insertChart(pieChart);

  // 6. Line Chart (Tren Pengeluaran Harian)
  const lineChart = dbSheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(dbSheet.getRange('N8:N30'))
    .addRange(dbSheet.getRange('O8:O30'))
    .setPosition(18, 1, 10, 10)
    .setOption('title', '📈 Tren Pengeluaran Harian (Rp)')
    .setOption('titleTextStyle', { color: '#4A3B32', fontSize: 13, bold: true })
    .setOption('curveType', 'function')
    .setOption('pointSize', 6)
    .setOption('colors', ['#E59A6A'])
    .setOption('legend', { position: 'none' })
    .setOption('hAxis', { title: 'Tanggal', textStyle: { color: '#4A3B32', fontSize: 10 } })
    .setOption('vAxis', { title: 'Nominal (Rp)', format: 'short', textStyle: { color: '#4A3B32', fontSize: 10 } })
    .setOption('backgroundColor', '#FFFDF7')
    .setOption('width', 920)
    .setOption('height', 300)
    .build();

  dbSheet.insertChart(lineChart);

  // Atur Lebar Kolom
  dbSheet.setColumnWidth(1, 150);
  dbSheet.setColumnWidth(2, 90);
  dbSheet.setColumnWidth(3, 130);
  dbSheet.setColumnWidth(4, 140);
  dbSheet.setColumnWidth(5, 120);
  dbSheet.setColumnWidth(6, 100);
}

function createKpiCard_(sheet, titleRange, valueRange, titleText, formulaValue, colorBg, colorText) {
  sheet.getRange(titleRange).merge()
    .setValue(titleText)
    .setBackground(colorBg)
    .setFontColor(colorText)
    .setFontWeight('bold')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.getRange(valueRange).merge()
    .setFormula(formulaValue)
    .setBackground('#FFFDF7')
    .setFontColor('#4A3B32')
    .setFontWeight('bold')
    .setFontSize(16)
    .setNumberFormat('"Rp"#,##0')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, colorBg, SpreadsheetApp.BorderStyle.MEDIUM);
}

function formatHeader_(sheet) {
  const lastCol = sheet.getLastColumn() || 1;
  const header = sheet.getRange(1, 1, 1, lastCol);
  header.setBackground('#4A3B32')
    .setFontColor('#FFFDF7')
    .setFontWeight('bold')
    .setFontSize(11)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 32);
}

/* ============================ UTIL ============================ */

function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }

function ready_() { return Object.keys(SHEETS).every(n => !!sheet_(n)); }

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, detail) {
  const e = new Error(code);
  e.code = code;
  e.detail = detail === undefined ? '' : detail;
  throw e;
}

function toInt_(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function inRange_(v, min, max) {
  const n = toInt_(v);
  return n !== null && n >= min && n <= max;
}

function auth_(token) {
  const real = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!real || typeof token !== 'string' || token.length !== real.length) return false;
  let diff = 0;
  for (let i = 0; i < real.length; i++) diff |= token.charCodeAt(i) ^ real.charCodeAt(i);
  return diff === 0;
}

function currentRev_() { return Number(PropertiesService.getScriptProperties().getProperty('REV') || 1); }

function bump_() {
  const n = currentRev_() + 1;
  PropertiesService.getScriptProperties().setProperty('REV', String(n));
  return n;
}

function nowIso_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }

function cell_(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX") : v;
}

function rows_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const v = sh.getRange(1, 1, last, SHEETS[name].length).getValues();
  const head = v.shift();
  return v.filter(r => String(r[0]) !== '').map(r => {
    const o = {};
    head.forEach((h, i) => o[h] = cell_(r[i]));
    return o;
  });
}

function findRow_(name, id) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const col = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) if (String(col[i][0]) === String(id)) return i + 2;
  return -1;
}

function upsert_(name, obj) {
  const cols = SHEETS[name];
  const vals = cols.map(h => (obj[h] === undefined || obj[h] === null) ? '' : obj[h]);
  const row = findRow_(name, obj[cols[0]]);
  const sh = sheet_(name);
  if (row > 0) sh.getRange(row, 1, 1, vals.length).setValues([vals]);
  else sh.appendRow(vals);
}

function remove_(name, id) {
  const row = findRow_(name, id);
  if (row > 0) sheet_(name).deleteRow(row);
}

function countTx_(kategoriId) {
  const sh = sheet_('Transaksi');
  const last = sh.getLastRow();
  if (last < 2) return 0;
  return sh.getRange(2, 4, last - 1, 1).getValues().filter(r => String(r[0]) === String(kategoriId)).length;
}

function idOf_(v) {
  const id = String(v === undefined || v === null ? '' : v);
  if (!ID_RE.test(id)) fail_('id_tidak_valid');
  return id;
}

/* ====== Pembersihan baris saat membaca (baris rusak diabaikan, PRD 11.7) ====== */

function cleanTx_(o) {
  const nominal = Number(o.nominal);
  const tanggal = String(o.tanggal);
  if (!o.id || TIPE.indexOf(o.tipe) < 0 || !isFinite(nominal) || nominal <= 0 || isNaN(Date.parse(tanggal))) return null;
  return { id: String(o.id), tanggal: tanggal, tipe: o.tipe, kategori_id: String(o.kategori_id),
           nominal: nominal, catatan: String(o.catatan || ''), goal_id: String(o.goal_id || '') };
}

function cleanBudget_(o) {
  if (!o.id || !o.nama || TIPE.indexOf(o.tipe) < 0) return null;
  return { id: String(o.id), nama: String(o.nama), ikon: String(o.ikon || ''), warna: String(o.warna || ''),
           limit_mingguan: Number(o.limit_mingguan) || 0, tipe: o.tipe, urut: Number(o.urut) || 0 };
}

function cleanGoal_(o) {
  const target = Number(o.target);
  if (!o.id || !o.nama || !isFinite(target) || target <= 0) return null;
  return { id: String(o.id), nama: String(o.nama), ikon: String(o.ikon || ''), warna: String(o.warna || ''),
           target: target, dibuat: String(o.dibuat || '') };
}

function collect_(name, cleaner) {
  const raw = rows_(name);
  const ok = raw.map(cleaner).filter(Boolean);
  return { rows: ok, ignored: raw.length - ok.length };
}

function settings_() {
  const out = {};
  rows_('Setting').forEach(r => {
    const k = String(r.key);
    if (NUM_KEYS.indexOf(k) >= 0) out[k] = Number(r.value) || 0;
    else if (k === 'tanpa_jajan') {
      out[k] = String(r.value || '').split(',').map(s => s.trim().slice(0, 10)).filter(Boolean).join(',');
    } else out[k] = r.value;
  });
  return out;
}

/* ============================ API: GET ============================ */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!auth_(p.token)) return json_({ ok: false, error: 'unauthorized' });
  const rev = currentRev_();
  if (p.action === 'rev') return json_({ ok: true, rev: rev, version: VERSION });
  if (!ready_()) return json_({ ok: false, error: 'setup_diperlukan' });

  const tx = collect_('Transaksi', cleanTx_);
  const bd = collect_('Budget', cleanBudget_);
  const gl = collect_('Goals', cleanGoal_);
  return json_({
    ok: true, rev: rev, version: VERSION,
    budget: bd.rows, goals: gl.rows, tx: tx.rows, settings: settings_(),
    ignored: { Transaksi: tx.ignored, Budget: bd.ignored, Goals: gl.ignored,
               total: tx.ignored + bd.ignored + gl.ignored }
  });
}

/* ============================ API: POST ============================ */

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'body_tidak_valid' }); }
  if (!body || !auth_(body.token)) return json_({ ok: false, error: 'unauthorized' });
  if (!ready_()) return json_({ ok: false, error: 'setup_diperlukan' });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return json_({ ok: false, error: 'sibuk' });
  try {
    if (body.action === 'batch') {
      const ops = body.data && Array.isArray(body.data.ops) ? body.data.ops : [];
      if (!ops.length || ops.length > MAX_BATCH) return json_({ ok: false, error: 'batch_tidak_valid' });
      const results = ops.map(op => run_(op && op.action, op && op.data));
      const rev = results.some(r => r.ok) ? bump_() : currentRev_();
      return json_({ ok: true, rev: rev, results: results });
    }
    const r = run_(body.action, body.data || body.payload || body);
    if (!r.ok) return json_(r);
    return json_({ ok: true, rev: bump_() });
  } catch (err) {
    return json_({ ok: false, error: 'galat', detail: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function run_(action, data) {
  const fn = HANDLERS[action];
  if (!fn) return { ok: false, error: 'aksi_tidak_dikenal' };
  try {
    fn(data || {});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.code || 'galat', detail: err.detail !== undefined ? err.detail : String(err.message) };
  }
}

/* ============================ HANDLER ============================ */

function saveTx_(d) {
  const id = idOf_(d.id);
  const tipe = String(d.tipe);
  if (TIPE.indexOf(tipe) < 0) fail_('tipe_tidak_valid');

  const nominal = toInt_(d.nominal);
  if (nominal === null || nominal < 1 || nominal > MAX_NOMINAL) fail_('nominal_tidak_valid');

  const tanggal = String(d.tanggal || '');
  const ms = Date.parse(tanggal);
  if (!ISO_RE.test(tanggal) || isNaN(ms)) fail_('tanggal_tidak_valid');
  if (ms > Date.now() + 10 * 60 * 1000) fail_('tanggal_masa_depan');

  const reqCatId = String(d.kategori_id || '');
  let kat = rows_('Budget').filter(r => String(r.id) === reqCatId)[0];
  // Toleransi alias id (jajan <-> makan, masuk <-> uang)
  if (!kat && reqCatId === 'jajan') kat = rows_('Budget').filter(r => String(r.id) === 'makan')[0];
  if (!kat && reqCatId === 'makan') kat = rows_('Budget').filter(r => String(r.id) === 'jajan')[0];
  if (!kat && reqCatId === 'masuk') kat = rows_('Budget').filter(r => String(r.id) === 'uang')[0];
  if (!kat && reqCatId === 'uang') kat = rows_('Budget').filter(r => String(r.id) === 'masuk')[0];

  if (!kat) fail_('kategori_tidak_ada');
  if (kat.tipe !== tipe) fail_('tipe_tidak_cocok');

  upsert_('Transaksi', {
    id: id, tanggal: tanggal, tipe: tipe, kategori_id: String(kat.id), nominal: nominal,
    catatan: String(d.catatan || '').slice(0, 60),
    goal_id: tipe === 'tabung' ? String(d.goal_id || '') : ''
  });
  updateDailyChartData_();
}

function delTx_(d) {
  remove_('Transaksi', idOf_(d.id));
  updateDailyChartData_();
}

function saveBudget_(d) {
  const id = idOf_(d.id);
  const nama = String(d.nama || '').trim();
  if (nama.length < 1 || nama.length > 20) fail_('nama_tidak_valid');
  const kembar = rows_('Budget').some(r => String(r.id) !== id && String(r.nama).toLowerCase() === nama.toLowerCase());
  if (kembar) fail_('nama_kembar');

  const tipe = String(d.tipe);
  if (TIPE.indexOf(tipe) < 0) fail_('tipe_tidak_valid');
  const warna = String(d.warna || '');
  if (!COLOR_RE.test(warna)) fail_('warna_tidak_valid');
  const ikon = String(d.ikon || '').trim();
  if (ikon.length < 1 || ikon.length > 8) fail_('ikon_tidak_valid');
  const limit = toInt_(d.limit_mingguan);
  if (limit === null || limit < 0 || limit > MAX_NOMINAL) fail_('limit_tidak_valid');

  const old = rows_('Budget').filter(r => String(r.id) === id)[0];
  if (old && old.tipe !== tipe && countTx_(id) > 0) fail_('tipe_terkunci');

  let urut = toInt_(d.urut);
  if (urut === null || urut < 0) urut = old ? Number(old.urut) || 0 : rows_('Budget').length + 1;

  upsert_('Budget', { id: id, nama: nama, ikon: ikon, warna: warna, limit_mingguan: limit, tipe: tipe, urut: urut });
}

function delBudget_(d) {
  const id = idOf_(d.id);
  const n = countTx_(id);
  if (n > 0) fail_('kategori_dipakai', n);
  remove_('Budget', id);
}

function saveGoal_(d) {
  const id = idOf_(d.id);
  const nama = String(d.nama || '').trim();
  if (nama.length < 1 || nama.length > 24) fail_('nama_tidak_valid');
  const warna = String(d.warna || '');
  if (!COLOR_RE.test(warna)) fail_('warna_tidak_valid');
  const ikon = String(d.ikon || '').trim();
  if (ikon.length < 1 || ikon.length > 8) fail_('ikon_tidak_valid');
  const target = toInt_(d.target);
  if (target === null || target < 1000 || target > 100000000) fail_('target_tidak_valid');

  const all = rows_('Goals');
  const old = all.filter(r => String(r.id) === id)[0];
  if (!old && all.length >= MAX_GOALS) fail_('batas_target');
  let dibuat = old ? String(old.dibuat) : String(d.dibuat || '');
  if (!ISO_RE.test(dibuat)) dibuat = nowIso_();

  upsert_('Goals', { id: id, nama: nama, ikon: ikon, warna: warna, target: target, dibuat: dibuat });
}

function delGoal_(d) { remove_('Goals', idOf_(d.id)); }

function saveSetting_(d) {
  const key = String(d.key || '');
  const rule = SETTING_RULES[key];
  if (!rule) fail_('kunci_tidak_dikenal');
  const v = NUM_KEYS.indexOf(key) >= 0 ? d.value : String(d.value === undefined || d.value === null ? '' : d.value);
  if (!rule(v)) fail_('nilai_tidak_valid');
  upsert_('Setting', { key: key, value: NUM_KEYS.indexOf(key) >= 0 ? Number(v) : v });
}

const HANDLERS = {
  saveTx: saveTx_, delTx: delTx_,
  saveBudget: saveBudget_, delBudget: delBudget_,
  saveGoal: saveGoal_, delGoal: delGoal_,
  saveSetting: saveSetting_,
  resetAll: function() { resetAllData(); }
};
