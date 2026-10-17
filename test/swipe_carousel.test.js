import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

console.log('--- RUNNING SWIPE CAROUSEL VERIFICATION TESTS ---');

// 1. Verify src/routes/+layout.svelte
{
  const layoutSrc = readFileSync('src/routes/+layout.svelte', 'utf8');

  // Verify 4 main tabs imported into carousel
  assert.ok(layoutSrc.includes("import BerandaPage from './+page.svelte';"), 'Layout imports Beranda');
  assert.ok(layoutSrc.includes("import StatistikPage from './statistik/+page.svelte';"), 'Layout imports Statistik');
  assert.ok(layoutSrc.includes("import TabunganPage from './tabungan/+page.svelte';"), 'Layout imports Tabungan');
  assert.ok(layoutSrc.includes("import PengaturanPage from './pengaturan/+page.svelte';"), 'Layout imports Pengaturan');

  // Verify CSS scroll snap track
  assert.ok(layoutSrc.includes('scroll-snap-type: x mandatory;'), 'Track has scroll-snap-type: x mandatory');
  assert.ok(layoutSrc.includes('overscroll-behavior-x: contain;'), 'Track has overscroll-behavior-x: contain');
  assert.ok(layoutSrc.includes('overflow-x: auto;'), 'Track has overflow-x: auto');
  assert.ok(layoutSrc.includes('scrollbar-width: none;'), 'Track has scrollbar-width: none');

  // Verify Slide Panels
  assert.ok(layoutSrc.includes('scroll-snap-align: start;'), 'Panel has scroll-snap-align: start');
  assert.ok(layoutSrc.includes('scroll-snap-stop: always;'), 'Panel has scroll-snap-stop: always');
  assert.ok(layoutSrc.includes('overflow-y: auto;'), 'Panel has overflow-y: auto');
  assert.ok(layoutSrc.includes('calc(96px + env(safe-area-inset-bottom, 12px))'), 'Panel has safe bottom clearance');

  // Verify realtime finger-drag dock sync (Math.round)
  assert.ok(layoutSrc.includes('Math.round(carouselTrackEl.scrollLeft / width)'), 'Live drag syncs active tab via Math.round');

  // Verify dock tab click smooth scroll
  assert.ok(layoutSrc.includes("behavior: 'smooth'"), 'Dock click triggers smooth scrollTo');

  // Verify URL sync on snap end
  assert.ok(layoutSrc.includes('history.replaceState(null, \'\', targetTab.path)'), 'URL synced with replaceState without DOM reload');

  // Verify initial route mount instant scroll
  assert.ok(layoutSrc.includes("behavior: 'instant'"), 'Initial mount uses instant scroll behavior');

  // Verify sub-route exclusion
  assert.ok(layoutSrc.includes('isMainTabRoute'), 'Distinguishes main tab route from sub-routes');
  assert.ok(layoutSrc.includes('{@render children?.()}'), 'Standalone sub-routes render via children snippet');

  console.log('✓ Layout swipe carousel architecture verified');
}

// 2. Verify src/routes/tabungan/+page.svelte remains intact
{
  const tabunganPageSrc = readFileSync('src/routes/tabungan/+page.svelte', 'utf8');
  assert.ok(tabunganPageSrc.length > 500, 'src/routes/tabungan/+page.svelte is not empty');
  assert.ok(tabunganPageSrc.includes('calculateTotalSavings'), 'tabungan/+page retains calculateTotalSavings');
  assert.ok(tabunganPageSrc.includes('calculateGeneralSavings'), 'tabungan/+page retains calculateGeneralSavings');
  assert.ok(tabunganPageSrc.includes('calculateGoalEta'), 'tabungan/+page retains calculateGoalEta');
  console.log('✓ src/routes/tabungan/+page.svelte intact and verified');
}

// 3. Verify horizontal gesture isolation in child scroll containers
{
  const txSheetSrc = readFileSync('src/lib/components/TransactionSheet.svelte', 'utf8');
  assert.ok(txSheetSrc.includes('overscroll-behavior-x: contain;'), 'TransactionSheet has overscroll-behavior-x');
  assert.ok(txSheetSrc.includes('touch-action: pan-x pan-y;'), 'TransactionSheet has touch-action pan-x pan-y');

  const goalSheetSrc = readFileSync('src/lib/components/GoalSheet.svelte', 'utf8');
  assert.ok(goalSheetSrc.includes('overscroll-behavior-x: contain;'), 'GoalSheet has overscroll-behavior-x');

  const detailPageSrc = readFileSync('src/routes/tabungan/[id]/+page.svelte', 'utf8');
  assert.ok(detailPageSrc.includes('overscroll-behavior-x: contain;'), 'Goal detail page has overscroll-behavior-x');

  console.log('✓ Horizontal gesture isolation verified');
}

console.log('--- ALL SWIPE CAROUSEL VERIFICATION TESTS PASSED! ---');
