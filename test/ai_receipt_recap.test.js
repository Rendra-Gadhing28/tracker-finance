import assert from 'node:assert/strict';
import {
  parseReceiptText,
  extractNominalCandidates,
  parseNumberFromLine,
  fixOcrNumberTypos
} from '../src/lib/ai/receipt.js';
import {
  extractTextFromImage,
  preprocessReceiptImage,
  isValidImageInput
} from '../src/lib/ai/ocr.js';
import {
  generateMonthlyRecap,
  getMonthlyRecapKey,
  shouldTriggerMonthlyRecap
} from '../src/lib/recap.js';

console.log('--- RUNNING AI RECEIPT & MONTHLY RECAP TESTS ---');

const categories = [
  { id: 'jajan', nama: 'Jajan & makan', ikon: '🍙', warna: 'jajan', limit_mingguan: 72500, tipe: 'keluar', urut: 1 },
  { id: 'pulsa', nama: 'Pulsa & Data', ikon: '📱', warna: 'pulsa', limit_mingguan: 4000, tipe: 'keluar', urut: 2 },
  { id: 'bensin', nama: 'Bensin & Transport', ikon: '⛽', warna: 'bensin', limit_mingguan: 25000, tipe: 'keluar', urut: 3 },
  { id: 'jajanin', nama: 'Jajanin / Donasi', ikon: '🎁', warna: 'jajanin', limit_mingguan: 14500, tipe: 'keluar', urut: 4 },
  { id: 'nabung', nama: 'Tabungan', ikon: '🐷', warna: 'nabung', limit_mingguan: 29000, tipe: 'tabung', urut: 5 },
  { id: 'masuk', nama: 'Pemasukan', ikon: '💰', warna: 'masuk', limit_mingguan: 145000, tipe: 'masuk', urut: 6 }
];

// ==========================================
// 1. PARSE RECEIPT TEXT TESTS
// ==========================================

// 1.1 Format Struk Indomaret
{
  const text = `
    INDOMARET POINT
    JL. SUDIRMAN NO. 10
    01/10/2026 14:30
    ROTI TAWAR 15.000
    TEH BOTOL 5.000
    TOTAL BELANJA: 20.000
    TUNAI: 50.000
    KEMBALIAN: 30.000
  `;
  const res = parseReceiptText(text, categories);

  assert.equal(res.success, true, 'Indomaret receipt harus berhasil diparse');
  assert.equal(res.nominal, 20000, 'Nominal harus 20000 (bukan tunai 50000 atau kembali 30000)');
  assert.equal(res.tanggal, '2026-10-01', 'Tanggal harus 2026-10-01');
  assert.equal(res.tipe, 'keluar', 'Tipe harus keluar');
  assert.equal(res.kategori_id, 'jajan', 'Kategori harus jajan');
  assert.ok(res.catatan.includes('INDOMARET'), `Catatan harus berisi merchant INDOMARET, dapat: "${res.catatan}"`);
  assert.ok(res.confidence >= 0.8, 'Confidence harus tinggi (>= 0.8)');
  console.log('✓ Struk Indomaret berhasil diparse dengan akurat');
}

// 1.2 Format SMS BCA
{
  const text = '01/10 14:20 BCA m-Transfer: m-Transfer Berhasil. Ke 1234567890 AN INDOMARET Rp. 54.000,00';
  const res = parseReceiptText(text, categories);

  assert.equal(res.success, true, 'SMS BCA harus berhasil diparse');
  assert.equal(res.nominal, 54000, 'Nominal SMS BCA harus 54000');
  assert.ok(res.tanggal.endsWith('-10-01'), `Tanggal harus 01 Oktober, dapat: ${res.tanggal}`);
  assert.equal(res.tipe, 'keluar', 'Tipe transaksi harus keluar');
  assert.equal(res.kategori_id, 'jajan', 'Kategori harus jajan');
  assert.ok(res.catatan.includes('INDOMARET'), `Catatan harus berisi merchant INDOMARET, dapat: "${res.catatan}"`);
  console.log('✓ SMS m-Transfer BCA berhasil diparse');
}

// 1.3 Format SMS Mandiri
{
  const text = 'TRSF E-BANKING DB 15/10/2026 50.000,00 KE 1234567890 SPBU PERTAMINA';
  const res = parseReceiptText(text, categories);

  assert.equal(res.success, true, 'SMS Mandiri harus berhasil diparse');
  assert.equal(res.nominal, 50000, 'Nominal SMS Mandiri harus 50000');
  assert.equal(res.tanggal, '2026-10-15', 'Tanggal harus 2026-10-15');
  assert.equal(res.tipe, 'keluar', 'Tipe harus keluar (DB)');
  assert.equal(res.kategori_id, 'bensin', 'Kategori SPBU harus bensin');
  assert.ok(res.catatan.includes('PERTAMINA') || res.catatan.includes('SPBU'), `Catatan harus merchant SPBU PERTAMINA, dapat: "${res.catatan}"`);
  console.log('✓ SMS Mandiri DB berhasil diparse');
}

// 1.4 Format QRIS
{
  const text = `
    Pembayaran QRIS Berhasil!
    Merchant: Kopi Kenangan
    Total Bayar: Rp 28.000
    Tanggal: 28/10/2026 10:15
  `;
  const res = parseReceiptText(text, categories);

  assert.equal(res.success, true, 'QRIS receipt harus berhasil');
  assert.equal(res.nominal, 28000, 'Nominal QRIS harus 28000');
  assert.equal(res.tanggal, '2026-10-28', 'Tanggal harus 2026-10-28');
  assert.equal(res.tipe, 'keluar', 'Tipe harus keluar');
  assert.equal(res.kategori_id, 'jajan', 'Kopi Kenangan masuk kategori jajan');
  assert.ok(res.catatan.includes('Kopi Kenangan'), `Catatan harus Kopi Kenangan, dapat: "${res.catatan}"`);
  console.log('✓ Notifikasi QRIS berhasil diparse');
}

// 1.5 Format GoPay
{
  const text = 'Kamu berhasil bayar Rp 35.000 ke Bakso Pak Kumis menggunakan GoPay.';
  const res = parseReceiptText(text, categories);

  assert.equal(res.success, true, 'GoPay receipt harus berhasil');
  assert.equal(res.nominal, 35000, 'Nominal GoPay harus 35000');
  assert.equal(res.tipe, 'keluar', 'Tipe harus keluar');
  assert.equal(res.kategori_id, 'jajan', 'Bakso masuk kategori jajan');
  assert.ok(res.catatan.includes('Bakso Pak Kumis'), `Catatan harus Bakso Pak Kumis, dapat: "${res.catatan}"`);
  console.log('✓ Notifikasi GoPay berhasil diparse');
}

// 1.6 Format Masuk & Tabung & Casual
{
  const txMasuk = parseReceiptText('Transfer Masuk Rp 1.500.000 dari PT MAJU JAYA Berhasil pada 25/10/2026', categories);
  assert.equal(txMasuk.success, true);
  assert.equal(txMasuk.tipe, 'masuk');
  assert.equal(txMasuk.nominal, 1500000);
  assert.equal(txMasuk.kategori_id, 'masuk');

  const txTabung = parseReceiptText('Setor tabungan celengan impian sebesar 100.000', categories);
  assert.equal(txTabung.success, true);
  assert.equal(txTabung.tipe, 'tabung');
  assert.equal(txTabung.nominal, 100000);
  assert.equal(txTabung.kategori_id, 'nabung');

  const txCasual = parseReceiptText('makan siang 45k', categories);
  assert.equal(txCasual.nominal, 45000);
  assert.equal(txCasual.kategori_id, 'jajan');
  console.log('✓ Tipe masuk, tabung, dan shorthand nominal (45k) berhasil diparse');
}

// 1.7 Format Struk Indomaret/Alfamart Lengkap (Opsi A)
{
  const text = `
    INDOMARET
    01/10/26 14:32
    ROTI COKLAT     12.500
    SUSU KOTAK      15.000
    SNACK KENTANG   20.000
    TOTAL BELANJA   47.500
    PPN 11%          4.700
    TUNAI           50.000
    KEMBALIAN        2.500
    BARCODE: 8991234567890
  `;
  const res = parseReceiptText(text, categories);

  assert.equal(res.success, true, 'Struk Indomaret lengkap harus berhasil diparse');
  assert.equal(res.nominal, 47500, 'Nominal harus 47500 (bukan tunai 50000, kembali 2500, ppn 4700, atau barcode)');
  assert.ok(Array.isArray(res.candidates), 'res.candidates harus berupa array');
  assert.ok(res.candidates.includes(47500), 'candidates harus mencakup nominal 47500');
  assert.equal(res.candidates[0], 47500, 'Kandidat #1 harus nominal total belanja 47500');
  assert.ok(!res.candidates.includes(50000), 'candidates tidak boleh memuat nominal TUNAI 50000');
  assert.ok(!res.candidates.includes(2500), 'candidates tidak boleh memuat nominal KEMBALIAN 2500');
  assert.ok(!res.candidates.includes(4700), 'candidates tidak boleh memuat nominal PPN 4700');
  assert.ok(!res.candidates.some(c => c > 10000000), 'candidates tidak boleh memuat barcode EAN');
  assert.ok(!res.candidates.includes(12500), 'candidates tidak boleh memuat harga item 12500');
  assert.ok(!res.candidates.includes(15000), 'candidates tidak boleh memuat harga item 15000');
  assert.ok(!res.candidates.includes(20000), 'candidates tidak boleh memuat harga item 20000');
  console.log('✓ Struk Indomaret lengkap terurai akurat dengan kandidat logis:', res.candidates);
}

// 1.8 Format Struk dengan TOTAL ITEM / BELANJA
{
  const text = `
    INDOMARET POINT
    01/10/26 14:32
    ROTI COKLAT     12.500
    SUSU KOTAK      15.000
    SNACK KENTANG   20.000
    TOTAL ITEM / BELANJA : 3 / 47.500
    TUNAI           50.000
    KEMBALIAN        2.500
  `;
  const res = parseReceiptText(text, categories);

  assert.equal(res.success, true, 'Struk TOTAL ITEM / BELANJA harus berhasil diparse');
  assert.equal(res.nominal, 47500, 'Nominal harus 47500 dan BUKAN jumlah item 3');
  assert.ok(!res.candidates.includes(3), 'candidates tidak boleh memuat angka item 3');
  assert.ok(!res.candidates.includes(12500), 'candidates tidak boleh memuat harga item satuan');
  assert.ok(!res.candidates.includes(15000), 'candidates tidak boleh memuat harga item satuan');
  assert.ok(!res.candidates.includes(20000), 'candidates tidak boleh memuat harga item satuan');
  console.log('✓ Struk format "TOTAL ITEM / BELANJA : 3 / 47.500" berhasil diparse dengan nominal 47500');
}

// 1.9 OCR Typo Auto-Fix & Candidate Ranking
{
  const typoReceipt = `
    ALFAMART
    TOTAL BELANJA 47.5OO
    TUNAI 50.OOO
  `;
  const fixed = fixOcrNumberTypos(typoReceipt);
  assert.ok(fixed.includes('47.500'), 'Typo "47.5OO" harus diperbaiki menjadi "47.500"');
  const candidates = extractNominalCandidates(typoReceipt);
  assert.equal(candidates[0], 47500, 'Kandidat teratas harus 47500');
  console.log('✓ Heuristik typo OCR dot-matrix (O->0, l->1) terverifikasi');
}

// ==========================================
// 1.10 OCR MODULE EXTRACTION TESTS
// ==========================================
{
  assert.equal(typeof extractTextFromImage, 'function', 'extractTextFromImage harus berupa fungsi');
  assert.equal(typeof preprocessReceiptImage, 'function', 'preprocessReceiptImage harus berupa fungsi');
  assert.equal(isValidImageInput(null), false, 'null bukan input valid');
  assert.equal(isValidImageInput(''), false, 'string kosong bukan input valid');
  assert.equal(isValidImageInput('some text'), true, 'string non-kosong adalah input valid');

  await assert.rejects(
    async () => {
      await extractTextFromImage(null);
    },
    /File atau gambar tidak valid/,
    'extractTextFromImage harus melempar error jika input tidak valid'
  );

  const testReceipt = 'INDOMARET TOTAL 20.000';
  const extracted = await extractTextFromImage(testReceipt);
  assert.equal(extracted, testReceipt, 'OCR harus mengembalikan teks di environment test');
  console.log('✓ Modul OCR extractTextFromImage dan preprocessReceiptImage terverifikasi');
}

// ==========================================
// 2. MONTHLY RECAP TESTS
// ==========================================

{
  const sampleTransactions = [
    // Bulan sebelumnya (September 2026)
    { id: 'prev-1', nominal: 100000, tipe: 'keluar', kategori_id: 'jajan', tanggal: '2026-09-15T12:00:00+07:00' },

    // Bulan target (Oktober 2026)
    { id: 'tx-1', nominal: 1000000, tipe: 'masuk', kategori_id: 'masuk', tanggal: '2026-10-01T09:00:00+07:00' },
    { id: 'tx-2', nominal: 60000, tipe: 'keluar', kategori_id: 'jajan', tanggal: '2026-10-05T12:30:00+07:00' },
    { id: 'tx-3', nominal: 40000, tipe: 'keluar', kategori_id: 'bensin', tanggal: '2026-10-10T15:00:00+07:00' },
    { id: 'tx-4', nominal: 200000, tipe: 'tabung', kategori_id: 'nabung', tanggal: '2026-10-15T18:00:00+07:00' }
  ];

  const recap = generateMonthlyRecap(sampleTransactions, categories, new Date('2026-10-20T00:00:00+07:00'));

  assert.equal(recap.periodName, 'Oktober 2026', 'Period name harus "Oktober 2026"');
  assert.equal(recap.totalKeluar, 100000, 'Total keluar harus 100000 (60k + 40k)');
  assert.equal(recap.totalMasuk, 1000000, 'Total masuk harus 1000000');
  assert.equal(recap.totalTabung, 200000, 'Total tabung harus 200000');
  assert.equal(recap.netSavings, 900000, 'Net savings harus 900000 (1jt - 100k)');
  assert.equal(recap.savingsRate, 90, 'Savings rate harus 90%');
  assert.equal(recap.dailyAverage, Math.round(100000 / 31), 'Rata-rata harian keluar di bulan Oktober (31 hari)');
  assert.equal(recap.prevMonthDiff, 0, 'Pengeluaran sama dengan bulan September (100k vs 100k) -> 0%');

  // Top categories
  assert.equal(recap.topCategories.length, 2, 'Top categories harus ada 2 kategori pengeluaran');
  assert.equal(recap.topCategories[0].id, 'jajan');
  assert.equal(recap.topCategories[0].total, 60000);
  assert.equal(recap.topCategories[0].persentase, 60);

  assert.equal(recap.topCategories[1].id, 'bensin');
  assert.equal(recap.topCategories[1].total, 40000);
  assert.equal(recap.topCategories[1].persentase, 40);

  // Cat advice
  assert.ok(typeof recap.catAdvice === 'string' && recap.catAdvice.length > 10, 'Neko advice harus string yang bermakna');
  assert.ok(recap.catAdvice.includes('Nya') || recap.catAdvice.includes('🐾'), 'Advice harus memiliki kepribadian maskot Neko');
  console.log('✓ Kalkulasi statistik bulanan akurat:', recap.periodName);
  console.log('  Advice Neko:', recap.catAdvice);
}

// 2.2 Recap Overspending Scenario
{
  const overspendTxs = [
    { id: 'o-1', nominal: 50000, tipe: 'masuk', kategori_id: 'masuk', tanggal: '2026-10-01' },
    { id: 'o-2', nominal: 150000, tipe: 'keluar', kategori_id: 'jajan', tanggal: '2026-10-02' }
  ];

  const recap = generateMonthlyRecap(overspendTxs, categories, new Date('2026-10-15'));
  assert.equal(recap.netSavings, -100000);
  assert.ok(recap.catAdvice.includes('melebihi pemasukan'), 'Advice harus memperingatkan pengeluaran berlebih');
  console.log('✓ Neko advice memberi peringatan saat pengeluaran melebihi pemasukan');
}

// 2.3 Trigger Recap Helpers
{
  assert.equal(getMonthlyRecapKey(new Date('2026-10-15T12:00:00+07:00')), '2026-10');
  assert.equal(shouldTriggerMonthlyRecap('2026-09', new Date('2026-10-01T00:00:00+07:00')), true);
  assert.equal(shouldTriggerMonthlyRecap('2026-10', new Date('2026-10-15T00:00:00+07:00')), false);
  assert.equal(shouldTriggerMonthlyRecap(null), true);
  assert.equal(shouldTriggerMonthlyRecap(''), true);
  console.log('✓ Helper getMonthlyRecapKey dan shouldTriggerMonthlyRecap berfungsi benar');
}

// ==========================================
// 3. ICON.SVELTE VERIFICATION
// ==========================================
import { readFileSync } from 'node:fs';

{
  const iconSrc = readFileSync('src/lib/components/Icon.svelte', 'utf8');

  // SVG attributes
  assert.ok(iconSrc.includes('viewBox="0 0 24 24"'), 'viewBox="0 0 24 24"');
  assert.ok(iconSrc.includes('fill="none"'), 'fill="none"');
  assert.ok(iconSrc.includes('stroke="currentColor"'), 'stroke="currentColor"');
  assert.ok(iconSrc.includes('stroke-width="2"'), 'stroke-width="2"');
  assert.ok(iconSrc.includes('stroke-linecap="round"'), 'stroke-linecap="round"');
  assert.ok(iconSrc.includes('stroke-linejoin="round"'), 'stroke-linejoin="round"');
  assert.ok(iconSrc.includes('width={size}') || iconSrc.includes('width="{size}"'), 'width dynamic size');
  assert.ok(iconSrc.includes('height={size}') || iconSrc.includes('height="{size}"'), 'height dynamic size');

  // Default props
  assert.ok(iconSrc.includes('size = 18'), 'default size = 18');

  // Check required alias mappings
  const requiredAliases = [
    '🍙', 'jajan', 'food',
    '📱', 'pulsa', 'phone',
    '⛽', 'bensin', 'fuel',
    '🎁', 'jajanin', 'gift',
    '🐷', 'nabung', 'piggy',
    '💰', 'masuk', 'wallet', 'money',
    '🏷️', 'lainnya', 'tag',
    '🔥', 'fire', 'streak',
    '🔒', 'lock',
    '⚠️', 'warning', 'alert',
    '📝', 'note', 'first_tx',
    '🗓️', 'calendar', 'week_active',
    '🌟', 'star', 'streak_7',
    '🏔️', 'mountain', 'streak_30',
    '🍃', 'leaf', 'perfect_week',
    '🏁', 'flag', 'goal_reached',
    '🏆', 'trophy', 'award',
    '🐾', 'paw',
    '🎯', 'target', 'goal',
    '💸', 'flying_money',
    'sparkles', 'ai',
    'receipt', 'scan',
    'camera', 'image', 'upload',
    'check',
    'chevron-right', 'arrow-right',
    'chevron-down', 'arrow-down',
    'close', 'x'
  ];

  for (const alias of requiredAliases) {
    assert.ok(iconSrc.includes(alias), `Icon component harus memetakan "${alias}"`);
  }

  // Check specific SVG icons
  assert.ok(iconSrc.includes('camera:'), 'Icon component harus memiliki icon camera');
  assert.ok(iconSrc.includes('image:'), 'Icon component harus memiliki icon image');
  assert.ok(iconSrc.includes('upload:'), 'Icon component harus memiliki icon upload');

  // Fallback rendering
  assert.ok(iconSrc.includes('{name}</span>'), 'Fallback harus merender <span>{name}</span>');

  console.log('✓ Icon.svelte memenuhi semua spesifikasi SVG, alias mappings, dan fallback emoji');
}

// ==========================================
// 4. COMPONENT INTEGRATION TESTS
// ==========================================
{
  // 4.1 DonutChart checks
  const donutSrc = readFileSync('src/lib/components/DonutChart.svelte', 'utf8');
  const earTwitchCount = (donutSrc.match(/@keyframes earTwitchLeft/g) || []).length;
  assert.equal(earTwitchCount, 1, 'DonutChart tidak boleh memiliki duplikasi CSS rules @keyframes earTwitchLeft');
  assert.ok(donutSrc.includes('foreignObject'), 'DonutChart harus menggunakan foreignObject di tengah');
  assert.ok(donutSrc.includes('0.75s cubic-bezier(0.16, 1, 0.3, 1)'), 'DonutChart animasi sweep dan entrance harus 0.75s');
  console.log('✓ DonutChart CSS bersih, durasi 0.75s, dan foreignObject icon terverifikasi');

  // 4.2 MonthlyRecapSheet checks
  const recapSheetSrc = readFileSync('src/lib/components/MonthlyRecapSheet.svelte', 'utf8');
  assert.ok(recapSheetSrc.includes('BottomSheet'), 'MonthlyRecapSheet harus menggunakan BottomSheet');
  assert.ok(recapSheetSrc.includes('generateMonthlyRecap'), 'MonthlyRecapSheet harus menggunakan generateMonthlyRecap');
  assert.ok(recapSheetSrc.includes('Icon'), 'MonthlyRecapSheet harus menggunakan Icon');
  assert.ok(recapSheetSrc.includes('recap-month-badge'), 'MonthlyRecapSheet harus memiliki badge bulan');
  assert.ok(recapSheetSrc.includes('neko-advice-box'), 'MonthlyRecapSheet harus memiliki neko advice box');
  assert.ok(recapSheetSrc.includes('stats-grid'), 'MonthlyRecapSheet harus memiliki stats grid');
  assert.ok(recapSheetSrc.includes('prev-month-indicator'), 'MonthlyRecapSheet harus memiliki indikator bulan lalu');
  assert.ok(recapSheetSrc.includes('top-categories-section'), 'MonthlyRecapSheet harus memiliki top categories section');
  console.log('✓ MonthlyRecapSheet komponen dan struktur UI terverifikasi');

  // 4.3 TransactionSheet AI Scan & OCR checks
  const txSheetSrc = readFileSync('src/lib/components/TransactionSheet.svelte', 'utf8');
  assert.ok(txSheetSrc.includes('parseReceiptText'), 'TransactionSheet harus mengimpor parseReceiptText');
  assert.ok(txSheetSrc.includes('extractTextFromImage'), 'TransactionSheet harus mengimpor extractTextFromImage');
  assert.ok(txSheetSrc.includes('cameraInputRef'), 'TransactionSheet harus memiliki referensi cameraInputRef');
  assert.ok(txSheetSrc.includes('fileInputRef'), 'TransactionSheet harus memiliki referensi fileInputRef');
  assert.ok(txSheetSrc.includes('capture="environment"'), 'Input kamera harus memiliki capture="environment"');
  assert.ok(txSheetSrc.includes('scan-method-btn'), 'TransactionSheet harus memiliki scan-method-btn');
  assert.ok(txSheetSrc.includes('receipt-image-preview'), 'TransactionSheet harus memiliki preview gambar');
  assert.ok(txSheetSrc.includes('isOcrLoading'), 'TransactionSheet harus memiliki state isOcrLoading');
  assert.ok(txSheetSrc.includes('scan-receipt-toggle-btn') || txSheetSrc.includes('scan-receipt-btn'), 'TransactionSheet harus memiliki tombol trigger Scan Struk');
  assert.ok(txSheetSrc.includes('scan-receipt-input') || txSheetSrc.includes('scan-receipt-textarea'), 'TransactionSheet harus memiliki textarea struk');
  assert.ok(txSheetSrc.includes('scanCandidates'), 'TransactionSheet harus memiliki state scanCandidates');
  assert.ok(txSheetSrc.includes('candidate-chips-wrap'), 'TransactionSheet harus memiliki candidate-chips-wrap');
  assert.ok(txSheetSrc.includes('<Icon name={cat.ikon}'), 'TransactionSheet harus menggunakan Icon untuk cat.ikon');
  console.log('✓ TransactionSheet integrasi AI Scan, kamera, galeri, OCR, candidate chips, dan Icon SVG terverifikasi');

  // 4.4 Statistik Page checks
  const statsSrc = readFileSync('src/routes/statistik/+page.svelte', 'utf8');
  assert.ok(statsSrc.includes('MonthlyRecapSheet'), 'Statistik harus mengintegrasikan MonthlyRecapSheet');
  assert.ok(statsSrc.includes('shouldTriggerMonthlyRecap'), 'Statistik harus menggunakan shouldTriggerMonthlyRecap');
  assert.ok(statsSrc.includes('getMonthlyRecapKey'), 'Statistik harus menggunakan getMonthlyRecapKey');
  assert.ok(statsSrc.includes('Rekap Bulanan'), 'Statistik harus memiliki tombol Rekap Bulanan');
  assert.ok(statsSrc.includes('<Icon name={cat.ikon}'), 'Statistik harus merender Icon SVG untuk kategori');
  console.log('✓ Statistik auto-trigger rekap bulanan dan tombol pemicu terverifikasi');

  // 4.5 Component emoji replacements
  const achieveSrc = readFileSync('src/lib/components/AchievementSheet.svelte', 'utf8');
  assert.ok(achieveSrc.includes('Icon name="fire"'), 'AchievementSheet harus menggunakan Icon fire');
  assert.ok(achieveSrc.includes('Icon name="lock"'), 'AchievementSheet harus menggunakan Icon lock');

  const goalSrc = readFileSync('src/lib/components/GoalSheet.svelte', 'utf8');
  assert.ok(goalSrc.includes('Icon name="warning"'), 'GoalSheet harus menggunakan Icon warning');
  console.log('✓ Emoji replacement di AchievementSheet dan GoalSheet terverifikasi');
}

// ==========================================
// 5. PWA SHARE TARGET & PRIVACY TESTS
// ==========================================
{
  // 5.1 vite.config.js PWA Share Target
  const viteConfigSrc = readFileSync('vite.config.js', 'utf8');
  assert.ok(viteConfigSrc.includes('share_target'), 'vite.config.js harus mendefinisikan share_target');
  assert.ok(viteConfigSrc.includes("action: '/'"), "share_target action harus '/'");
  assert.ok(viteConfigSrc.includes('params:'), 'share_target harus memiliki params');
  assert.ok(viteConfigSrc.includes("title: 'title'"), "params harus memuat title: 'title'");
  assert.ok(viteConfigSrc.includes("text: 'text'"), "params harus memuat text: 'text'");
  assert.ok(viteConfigSrc.includes("url: 'url'"), "params harus memuat url: 'url'");
  console.log('✓ vite.config.js PWA Web Share Target API terkonfigurasi dengan benar');

  // 5.2 src/routes/+layout.svelte URL scrubbing and in-memory parsing
  const layoutSrc = readFileSync('src/routes/+layout.svelte', 'utf8');
  assert.ok(layoutSrc.includes('history.replaceState'), 'Layout harus memuat history.replaceState untuk scrubbing URL');
  assert.ok(layoutSrc.includes('parseReceiptText'), 'Layout harus memanggil parseReceiptText untuk parsing in-memory');
  console.log('✓ Penanganan share target & privasi in-memory di +layout.svelte terverifikasi');

  // 5.3 Generic QRIS share text parsing
  const text = 'BCA: Pembayaran QRIS berhasil ke KOPI SOE sebesar Rp 24.000 pada 31/10/2026';
  const res = parseReceiptText(text, categories);
  assert.equal(res.success, true, 'Share QRIS generic harus berhasil diparse');
  assert.equal(res.nominal, 24000, 'Nominal harus 24000');
  assert.equal(res.tipe, 'keluar', 'Tipe harus keluar');
  assert.equal(res.kategori_id, 'jajan', 'Kategori KOPI SOE harus jajan');
  assert.ok(res.catatan.includes('KOPI SOE'), `Catatan harus memuat KOPI SOE, dapat: "${res.catatan}"`);
  console.log('✓ Format teks share QRIS generic berhasil diparse');

  // 5.4 Mutasi dengan tanda minus
  const minusText = '- Rp 35.000 pada 31/10/2026 ke WARUNG MAKAN MASUK JAYA';
  const minusRes = parseReceiptText(minusText, categories);
  assert.equal(minusRes.success, true, 'Mutasi minus harus berhasil diparse');
  assert.equal(minusRes.tipe, 'keluar', 'Tipe harus keluar meski ada kata MASUK JAYA di merchant');
  assert.equal(minusRes.nominal, 35000, 'Nominal harus 35000');
  assert.ok(minusRes.catatan.includes('WARUNG MAKAN MASUK JAYA'), `Catatan harus memuat WARUNG MAKAN MASUK JAYA, dapat: "${minusRes.catatan}"`);
  console.log('✓ Notifikasi mutasi bertanda minus berhasil diparse sebagai pengeluaran');

  // 5.5 Notifikasi dengan kata pembayaran
  const bayarText = 'Pembayaran QRIS Berhasil ke Toko Gaji Komputer Rp 45.000 pada 31/10/2026';
  const bayarRes = parseReceiptText(bayarText, categories);
  assert.equal(bayarRes.success, true, 'Notifikasi pembayaran harus berhasil diparse');
  assert.equal(bayarRes.tipe, 'keluar', 'Tipe harus keluar meski ada kata Gaji');
  assert.equal(bayarRes.nominal, 45000, 'Nominal harus 45000');
  console.log('✓ Notifikasi pembayaran berhasil diparse sebagai pengeluaran');

  // 5.6 Helper parseNumberFromLine minus patterns
  assert.equal(parseNumberFromLine('Rp -25.000'), 25000, 'Rp -25.000 harus 25000');
  assert.equal(parseNumberFromLine('-Rp 25.000'), 25000, '-Rp 25.000 harus 25000');
  assert.equal(parseNumberFromLine('- 25.000'), 25000, '- 25.000 harus 25000');
  console.log('✓ Helper parseNumberFromLine dengan pola minus diverifikasi');
}

console.log('\n--- ALL AI RECEIPT & MONTHLY RECAP TESTS PASSED ---');
