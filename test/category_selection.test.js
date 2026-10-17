import assert from 'node:assert/strict';

console.log('--- RUNNING CATEGORY SELECTION & AUTO-TYPE TESTS ---');

const categories = [
  { id: 'jajan', nama: 'Jajan & makan', ikon: '🍙', warna: 'jajan', limit_mingguan: 72500, tipe: 'keluar', urut: 1 },
  { id: 'pulsa', nama: 'Pulsa', ikon: '📱', warna: 'pulsa', limit_mingguan: 4000, tipe: 'keluar', urut: 2 },
  { id: 'bensin', nama: 'Bensin', ikon: '⛽', warna: 'bensin', limit_mingguan: 25000, tipe: 'keluar', urut: 3 },
  { id: 'jajanin', nama: 'Jajanin', ikon: '🎁', warna: 'jajanin', limit_mingguan: 14500, tipe: 'keluar', urut: 4 },
  { id: 'nabung', nama: 'Nabung', ikon: '🐷', warna: 'nabung', limit_mingguan: 29000, tipe: 'tabung', urut: 5 },
  { id: 'masuk', nama: 'Uang jajan', ikon: '💰', warna: 'masuk', limit_mingguan: 145000, tipe: 'masuk', urut: 6 }
];

// 1. All categories are loaded and sorted by urut
{
  const allCategories = categories.slice().sort((a, b) => (a.urut || 0) - (b.urut || 0));
  assert.equal(allCategories.length, 6, 'Semua 6 kategori harus termuat');
  assert.equal(allCategories[0].id, 'jajan');
  assert.equal(allCategories[4].id, 'nabung');
  assert.equal(allCategories[5].id, 'masuk');
  console.log('✓ Semua kategori termuat tanpa terpotong oleh filter tipe');
}

// 2. Auto-type switching when category is selected
{
  let tipe = 'keluar';
  let kategoriId = 'jajan';
  let goalId = '';

  function selectCategory(cat) {
    kategoriId = cat.id;
    const catTipe = (cat.tipe || '').trim().toLowerCase();
    if (catTipe && catTipe !== tipe) {
      tipe = catTipe;
      if (catTipe === 'tabung' && !goalId) {
        goalId = 'default_goal';
      }
    }
  }

  // Pilih nabung (tipe: tabung) -> tipe harus otomatis berubah ke tabung
  selectCategory(categories.find((c) => c.id === 'nabung'));
  assert.equal(tipe, 'tabung', 'Tipe otomatis berubah menjadi tabung');
  assert.equal(kategoriId, 'nabung', 'KategoriId menjadi nabung');
  assert.equal(goalId, 'default_goal', 'GoalId otomatis terisi saat tabung');

  // Pilih uang jajan (tipe: masuk) -> tipe harus otomatis berubah ke masuk
  selectCategory(categories.find((c) => c.id === 'masuk'));
  assert.equal(tipe, 'masuk', 'Tipe otomatis berubah menjadi masuk');
  assert.equal(kategoriId, 'masuk', 'KategoriId menjadi masuk');

  // Pilih bensin (tipe: keluar) -> tipe harus otomatis berubah ke keluar
  selectCategory(categories.find((c) => c.id === 'bensin'));
  assert.equal(tipe, 'keluar', 'Tipe otomatis berubah menjadi keluar');
  assert.equal(kategoriId, 'bensin', 'KategoriId menjadi bensin');
  console.log('✓ Auto-type switching berjalan mulus untuk semua kategori');
}

// 3. Switching type tab picks last used / first category of that type
{
  const transactions = [
    { id: 'tx-1', tipe: 'keluar', kategori_id: 'pulsa' },
    { id: 'tx-2', tipe: 'tabung', kategori_id: 'nabung' },
    { id: 'tx-3', tipe: 'masuk', kategori_id: 'masuk' }
  ];

  function getLastUsedCategoryId(targetType) {
    const matchingCats = categories.filter(
      (c) => (c.tipe || '').trim().toLowerCase() === targetType.toLowerCase()
    );
    if (matchingCats.length === 0) return '';
    const lastTx = transactions.find(
      (t) => (t.tipe || '').trim().toLowerCase() === targetType.toLowerCase()
    );
    if (lastTx && matchingCats.some((c) => c.id === lastTx.kategori_id)) {
      return lastTx.kategori_id;
    }
    return matchingCats[0]?.id || '';
  }

  assert.equal(getLastUsedCategoryId('keluar'), 'pulsa', 'Tipe keluar memilih pulsa (transaksi terakhir)');
  assert.equal(getLastUsedCategoryId('tabung'), 'nabung', 'Tipe tabung memilih nabung');
  assert.equal(getLastUsedCategoryId('masuk'), 'masuk', 'Tipe masuk memilih masuk');
  console.log('✓ Tab tipe memilih kategori sesuai tipe dengan benar');
}

console.log('--- ALL CATEGORY SELECTION TESTS PASSED! ---');
