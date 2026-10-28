<script>
  import '../app.css';
  import '@fontsource-variable/fraunces';
  import '@fontsource-variable/dm-sans';
  import '@fontsource-variable/unbounded';
  import '@fontsource-variable/plus-jakarta-sans';
  import '@fontsource-variable/jetbrains-mono';
  import { setContext, onMount } from 'svelte';
  import { page } from '$app/state';
  import { onNavigate } from '$app/navigation';
  import SyncBadge from '$lib/components/SyncBadge.svelte';
  import TransactionSheet from '$lib/components/TransactionSheet.svelte';
  import Snackbar from '$lib/components/Snackbar.svelte';
  import BerandaPage from './+page.svelte';
  import StatistikPage from './statistik/+page.svelte';
  import TabunganPage from './tabungan/+page.svelte';
  import PengaturanPage from './pengaturan/+page.svelte';
  import {
    initData,
    budgets,
    transactions,
    transactionsThisWeek,
    goals,
    settings,
    budgetSummary,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } from '$lib/stores/data.js';
  import { sync } from '$lib/stores/sync.js';
  import { formatRp } from '$lib/money.js';
  import { getWeekRange, isDateInWeek } from '$lib/week.js';

  /**
   * @typedef {Object} Props
   * @property {import('svelte').Snippet} [children]
   */
  let { children } = $props();

  const MAIN_TABS = [
    { index: 0, path: '/', id: 'beranda', label: 'Beranda' },
    { index: 1, path: '/statistik', id: 'statistik', label: 'Statistik' },
    { index: 2, path: '/tabungan', id: 'tabungan', label: 'Tabungan' },
    { index: 3, path: '/pengaturan', id: 'pengaturan', label: 'Atur' }
  ];

  function normalizePath(pathname) {
    if (!pathname) return '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
      return pathname.slice(0, -1);
    }
    return pathname;
  }

  function isMainTab(pathname) {
    const norm = normalizePath(pathname);
    return MAIN_TABS.some((tab) => tab.path === norm);
  }

  function getTabByPath(pathname) {
    const norm = normalizePath(pathname);
    return MAIN_TABS.find((tab) => tab.path === norm) || null;
  }

  // Carousel & Navigation state
  let carouselTrackEl = $state(null);
  let activeTabIndex = $state(0);
  let isProgrammaticScroll = false;
  let scrollTimeout = null;
  let scrollRafId = null;
  let lastInitializedPath = $state('');

  const currentPath = $derived(normalizePath(page.url.pathname));
  const isMainTabRoute = $derived(isMainTab(currentPath));

  // Transaction Sheet state
  let isTxSheetOpen = $state(false);
  let txSheetMode = $state('create'); // 'create' | 'edit'
  let activeTx = $state(null);
  let lastUsedNominal = $state(0);
  let highlightedTxId = $state(null);
  let activeWeekDate = $state(null);

  // Snackbar state
  let isSnackbarOpen = $state(false);
  let snackbarMessage = $state('');
  let snackbarUndoFn = $state(null);

  // View transitions for smooth page switching (sub-routes only; main tabs use swipe carousel)
  onNavigate((navigation) => {
    if (!document.startViewTransition) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (isMainTab(navigation.from?.url?.pathname) && isMainTab(navigation.to?.url?.pathname)) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  function scrollToTab(index, behavior = 'smooth') {
    if (!carouselTrackEl) return;
    const clampedIndex = Math.min(MAIN_TABS.length - 1, Math.max(0, index));
    activeTabIndex = clampedIndex;
    const width = carouselTrackEl.clientWidth || 0;
    if (width > 0) {
      if (behavior === 'smooth') {
        isProgrammaticScroll = true;
      }
      carouselTrackEl.scrollTo({
        left: clampedIndex * width,
        behavior
      });
    }
    if (behavior === 'instant') {
      const tab = MAIN_TABS[clampedIndex];
      if (tab && typeof window !== 'undefined' && normalizePath(window.location.pathname) !== tab.path) {
        history.replaceState(null, '', tab.path);
      }
    }
  }

  function syncUrlAfterScroll() {
    if (!carouselTrackEl) return;
    const width = carouselTrackEl.clientWidth || 0;
    if (width <= 0) return;
    const finalIndex = Math.min(MAIN_TABS.length - 1, Math.max(0, Math.round(carouselTrackEl.scrollLeft / width)));
    activeTabIndex = finalIndex;
    const targetTab = MAIN_TABS[finalIndex];
    if (targetTab && typeof window !== 'undefined') {
      const currentWindowPath = normalizePath(window.location.pathname);
      if (currentWindowPath !== targetTab.path) {
        history.replaceState(null, '', targetTab.path);
      }
    }
    isProgrammaticScroll = false;
  }

  function handleCarouselScroll() {
    if (!carouselTrackEl) return;
    if (scrollRafId) cancelAnimationFrame(scrollRafId);
    scrollRafId = requestAnimationFrame(() => {
      if (!carouselTrackEl) return;
      const width = carouselTrackEl.clientWidth || 0;
      if (width > 0) {
        const liveIndex = Math.min(MAIN_TABS.length - 1, Math.max(0, Math.round(carouselTrackEl.scrollLeft / width)));
        if (activeTabIndex !== liveIndex) {
          activeTabIndex = liveIndex;
        }
      }
    });

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      syncUrlAfterScroll();
    }, 120);
  }

  function handleCarouselScrollEnd() {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    syncUrlAfterScroll();
  }

  $effect(() => {
    if (isMainTabRoute && carouselTrackEl) {
      const navPath = currentPath;
      if (lastInitializedPath !== navPath) {
        lastInitializedPath = navPath;
        const targetTab = getTabByPath(navPath) || MAIN_TABS[0];
        activeTabIndex = targetTab.index;
        if (targetTab.index > 0) {
          carouselTrackEl.scrollTo({
            left: targetTab.index * carouselTrackEl.clientWidth,
            behavior: 'instant'
          });
          requestAnimationFrame(() => {
            if (carouselTrackEl) {
              carouselTrackEl.scrollTo({
                left: targetTab.index * carouselTrackEl.clientWidth,
                behavior: 'instant'
              });
            }
          });
        }
      }
    } else if (!isMainTabRoute) {
      lastInitializedPath = '';
    }
  });

  onMount(() => {
    let cleanUp = null;
    let lenisInstance = null;
    let rafId = null;

    initData().then((res) => {
      cleanUp = res;
    });

    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const norm = normalizePath(window.location.pathname);
      const targetTab = getTabByPath(norm);
      if (targetTab && carouselTrackEl) {
        scrollToTab(targetTab.index, 'smooth');
      }
    };
    window.addEventListener('popstate', handlePopState);

    const handleWindowResize = () => {
      if (carouselTrackEl && isMainTabRoute) {
        const width = carouselTrackEl.clientWidth || 0;
        if (width > 0 && !isProgrammaticScroll) {
          carouselTrackEl.scrollTo({
            left: activeTabIndex * width,
            behavior: 'instant'
          });
        }
      }
    };
    window.addEventListener('resize', handleWindowResize);

    // Capture coordinates of clicked navigation links for circular reveal origin
    const handlePointerDown = (e) => {
      const link = e.target.closest('a[href]');
      if (link) {
        document.documentElement.style.setProperty('--nav-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--nav-y', `${e.clientY}px`);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });

    // Conditional Lenis smooth scrolling (desktop pointer devices only; 0 lag on mobile touch)
    const isPointerFine = window.matchMedia('(pointer: fine)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isPointerFine && !prefersReduced) {
      import('lenis').then(({ default: Lenis }) => {
        lenisInstance = new Lenis({
          duration: 1.4,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          orientation: 'vertical',
          smoothWheel: true,
          wheelMultiplier: 0.9,
          touchMultiplier: 0
        });

        function raf(time) {
          lenisInstance?.raf(time);
          rafId = requestAnimationFrame(raf);
        }
        rafId = requestAnimationFrame(raf);
      });
    }

    return () => {
      cleanUp?.destroy?.();
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('resize', handleWindowResize);
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (rafId) cancelAnimationFrame(rafId);
      lenisInstance?.destroy();
    };
  });

  function openCreate(preset = null) {
    txSheetMode = 'create';
    if (preset) {
      activeTx = activeWeekDate && !preset.tanggal
        ? { ...preset, tanggal: activeWeekDate }
        : { ...preset };
    } else if (activeWeekDate) {
      activeTx = { tanggal: activeWeekDate };
    } else {
      activeTx = null;
    }
    isTxSheetOpen = true;
  }

  function openEdit(tx) {
    txSheetMode = 'edit';
    activeTx = tx;
    isTxSheetOpen = true;
  }

  function showToast(message, onUndo) {
    snackbarMessage = message;
    snackbarUndoFn = onUndo || null;
    isSnackbarOpen = true;
  }

  // Cat reaction trigger
  let catReactionCallback = null;

  function registerCatReaction(fn) {
    catReactionCallback = fn;
  }

  function triggerCatReaction(actionType, detail = {}) {
    catReactionCallback?.(actionType, detail);
  }

  // Provide to child pages via Svelte context
  setContext('txManager', {
    openCreate,
    openEdit,
    showToast,
    setActiveWeekDate: (d) => {
      activeWeekDate = d;
    },
    getHighlightedTxId: () => highlightedTxId,
    registerCatReaction,
    triggerCatReaction
  });

  // Active transactions for TransactionSheet (scoped to active week, resets each week)
  const activeWeekTransactions = $derived.by(() => {
    if (activeWeekDate) {
      const startDay = $settings?.awal_minggu ?? 1;
      const range = getWeekRange(new Date(activeWeekDate), startDay);
      return ($transactions || []).filter((tx) =>
        isDateInWeek(tx.tanggal, range.start, range.end)
      );
    }
    return $transactionsThisWeek || [];
  });

  // Calculate category spent map for warning pills (scoped to active week)
  const categorySpentMap = $derived.by(() => {
    const map = {};
    for (const tx of activeWeekTransactions) {
      if (tx.tipe === 'keluar' && tx.kategori_id) {
        map[tx.kategori_id] = (map[tx.kategori_id] || 0) + (Number(tx.nominal) || 0);
      }
    }
    return map;
  });

  async function handleSaveTransaction(txData) {
    const meta = ($budgets || []).find((b) => b.id === txData.kategori_id);
    const spentBefore = categorySpentMap[txData.kategori_id] || 0;
    const catLimit = Number(meta?.limit_mingguan) || Infinity;

    if (txSheetMode === 'edit') {
      const originalTx = { ...activeTx };
      await updateTransaction(txData);
      triggerCatReaction(
        txData.tipe === 'tabung' ? 'tabung' : txData.tipe === 'masuk' ? 'masuk' : 'keluar_lain',
        { icon: meta?.ikon || '💸' }
      );
      showToast(`Diperbarui ${formatRp(txData.nominal)}`, async () => {
        await updateTransaction(originalTx);
        triggerCatReaction('undo');
      });
    } else {
      const created = await addTransaction(txData);
      lastUsedNominal = created.nominal;
      highlightedTxId = created.id;
      setTimeout(() => {
        if (highlightedTxId === created.id) {
          highlightedTxId = null;
        }
      }, 1200); // 1.2s flash per PRD 12.4

      if (txData.tipe === 'keluar') {
        const isOver = spentBefore + Number(txData.nominal) > catLimit;
        if (isOver) {
          triggerCatReaction('over_limit');
        } else if (
          txData.kategori_id === 'makan' ||
          meta?.ikon === '🍙' ||
          meta?.nama?.toLowerCase().includes('makan')
        ) {
          triggerCatReaction('keluar_makan');
        } else {
          triggerCatReaction('keluar_lain', { icon: meta?.ikon || '💸' });
        }
      } else if (txData.tipe === 'masuk') {
        triggerCatReaction('masuk');
      } else if (txData.tipe === 'tabung') {
        triggerCatReaction('tabung');
      }

      showToast(`Dicatat ${formatRp(created.nominal)}`, async () => {
        await deleteTransaction(created.id);
        triggerCatReaction('undo');
      });
    }
  }

  async function handleDeleteTransaction(txId) {
    const deletedTx = { ...activeTx };
    await deleteTransaction(txId);
    showToast(`Dihapus`, async () => {
      await addTransaction(deletedTx);
      triggerCatReaction('undo');
    });
  }

  const navItems = [
    { href: '/', label: 'Beranda', id: 'beranda' },
    { href: '/statistik', label: 'Insight', id: 'statistik' },
    { href: '/tabungan', label: 'Anggaran', id: 'tabungan' },
    { href: '/pengaturan', label: 'Pengaturan', id: 'pengaturan' }
  ];

  const tabIndexMap = {
    beranda: 0,
    statistik: 1,
    tabungan: 2,
    pengaturan: 3
  };

  function isActive(href) {
    if (!href) return false;
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  }

  function isDockActive(item) {
    if (item.action === 'tambah') return false;
    if (isMainTabRoute) {
      return tabIndexMap[item.id] === activeTabIndex;
    }
    return isActive(item.href);
  }

  function handleDockTabClick(e, item) {
    if (isMainTabRoute && tabIndexMap[item.id] !== undefined) {
      e.preventDefault();
      const targetIndex = tabIndexMap[item.id];
      if (activeTabIndex === targetIndex && carouselTrackEl) {
        const panels = carouselTrackEl.querySelectorAll('.tab-slide-panel');
        if (panels[targetIndex]) {
          panels[targetIndex].scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        scrollToTab(targetIndex, 'smooth');
      }
    }
  }

  const TAB_WIDTHS = {
    beranda: 116,
    statistik: 110,
    tabungan: 120,
    pengaturan: 136
  };

  const activeDockIndex = $derived.by(() => {
    if (isMainTabRoute) return activeTabIndex;
    const found = navItems.findIndex((item) => isActive(item.href));
    return found !== -1 ? found : 0;
  });

  const activeDockItem = $derived(navItems[activeDockIndex] || navItems[0]);
  const runnerWidth = $derived(TAB_WIDTHS[activeDockItem.id] || 116);
  const runnerX = $derived(activeDockIndex * 50);

  let liquidEl = $state(null);
  let liquidAnimation = null;
  let prevDockIndex = $state(null);

  function triggerLiquidSqueeze(fromIndex, toIndex) {
    if (!liquidEl || fromIndex === toIndex) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const dist = Math.abs(toIndex - fromIndex);
    const peakScaleX = Number((1 + dist * 0.18).toFixed(2));
    const peakScaleY = Number(Math.max(0.65, 0.8 - dist * 0.05).toFixed(2));

    liquidAnimation?.cancel();
    liquidAnimation = liquidEl.animate(
      [
        { transform: 'scale(1, 1)', offset: 0 },
        { transform: `scale(${peakScaleX}, ${peakScaleY})`, offset: 0.35 },
        { transform: 'scale(0.98, 1.05)', offset: 0.72 },
        { transform: 'scale(1, 1)', offset: 1 }
      ],
      {
        duration: 420,
        easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
        fill: 'none'
      }
    );
  }

  $effect(() => {
    const current = activeDockIndex;
    if (prevDockIndex !== null && prevDockIndex !== current) {
      triggerLiquidSqueeze(prevDockIndex, current);
    }
    prevDockIndex = current;
  });

  const syncStatus = $derived.by(() => {
    if ($sync.status === 'offline') return 'offline';
    if ($sync.pendingCount > 0) return 'saving';
    return 'ok';
  });

  const syncLabel = $derived.by(() => {
    if ($sync.status === 'offline') return 'Offline';
    if ($sync.pendingCount > 0) return `${$sync.pendingCount} antre`;
    return 'Tersinkron';
  });
</script>

<div class="app-viewport">
  <div class="mobile-shell">
    <!-- Top Header -->
    <header class="app-header">
      <div class="header-left">
        <SyncBadge status={syncStatus} label={syncLabel} />
      </div>
      <div class="header-right">
        <h1 class="header-title">
          <span class="cat-paw" aria-hidden="true">🐾</span>
          <span>Neko Dompet</span>
        </h1>
      </div>
    </header>

    {#if isMainTabRoute}
      <!-- 1:1 Realtime Swipe Carousel Track across 4 Main Tabs -->
      <main
        bind:this={carouselTrackEl}
        class="tab-carousel-track"
        onscroll={handleCarouselScroll}
        onscrollend={handleCarouselScrollEnd}
        data-lenis-prevent
      >
        <div class="tab-slide-panel" data-tab-index="0" data-tab-id="beranda" data-lenis-prevent>
          <BerandaPage />
        </div>
        <div class="tab-slide-panel" data-tab-index="1" data-tab-id="statistik" data-lenis-prevent>
          <StatistikPage />
        </div>
        <div class="tab-slide-panel" data-tab-index="2" data-tab-id="tabungan" data-lenis-prevent>
          <TabunganPage />
        </div>
        <div class="tab-slide-panel" data-tab-index="3" data-tab-id="pengaturan" data-lenis-prevent>
          <PengaturanPage />
        </div>
      </main>
    {:else}
      <!-- Standalone Sub-routes Content (Detail pages) -->
      <main class="app-content standalone-page" data-lenis-prevent>
        {@render children?.()}
      </main>
    {/if}

    <!-- Floating Action Button (FAB) Tambah (+) di atas nav -->
    <button
      type="button"
      class="fab-tambah"
      onclick={() => openCreate(null)}
      aria-label="Tambah Transaksi"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span class="fab-label">Tambah</span>
    </button>

    <!-- Bottom Nav 4 item -->
    <nav class="bottom-dock" aria-label="Navigasi Utama">
      <div class="dock-inner">
        <!-- Single Liquid Bubble Runner -->
        <div
          class="dock-bubble-runner"
          style="transform: translate3d({runnerX}px, 0, 0); width: {runnerWidth}px;"
        >
          <div class="dock-bubble-liquid" bind:this={liquidEl}></div>
        </div>

        {#each navItems as item}
          <a
            href={item.href}
            class="dock-tab interactive-tap {isDockActive(item) ? 'active' : ''}"
            data-tab-id={item.id}
            aria-current={isDockActive(item) ? 'page' : undefined}
            onclick={(e) => handleDockTabClick(e, item)}
          >
            <span class="dock-tab-icon">
              {#if item.id === 'beranda'}
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              {:else if item.id === 'statistik'}
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                  <line x1="2" y1="20" x2="22" y2="20" />
                </svg>
              {:else if item.id === 'tabungan'}
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              {:else if item.id === 'pengaturan'}
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              {/if}
            </span>
            <span class="dock-tab-label">{item.label}</span>
          </a>
        {/each}
      </div>
    </nav>

    <!-- Global Transaction Bottom Sheet -->
    <TransactionSheet
      bind:open={isTxSheetOpen}
      mode={txSheetMode}
      initialTx={activeTx}
      categories={$budgets}
      transactions={$transactions}
      goals={$goals}
      totalBudgetA={$budgetSummary.A}
      totalSpentP={$budgetSummary.P}
      {categorySpentMap}
      lastNominal={lastUsedNominal}
      onsave={handleSaveTransaction}
      ondelete={handleDeleteTransaction}
    />

    <!-- Global Floating Snackbar -->
    <Snackbar
      bind:open={isSnackbarOpen}
      message={snackbarMessage}
      onaction={() => snackbarUndoFn?.()}
    />
  </div>
</div>

<style>
  .app-viewport {
    display: flex;
    justify-content: center;
    align-items: stretch;
    height: 100vh;
    height: 100dvh;
    background: var(--bg);
    overflow: hidden;
  }

  .mobile-shell {
    position: relative;
    width: 100%;
    max-width: 720px;
    height: 100vh;
    height: 100dvh;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    margin: 0 auto;
  }

  /* Header */
  .app-header {
    flex: 0 0 auto;
    position: relative;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
    min-height: 56px;
    box-sizing: border-box;
  }

  @media (min-width: 640px) {
    .app-header {
      padding: 12px 32px;
    }
  }

  .header-left {
    display: flex;
    align-items: center;
  }

  .header-right {
    display: flex;
    align-items: center;
  }

  .header-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 500;
    color: var(--fg);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cat-paw {
    font-size: 16px;
  }

  /* Carousel Track */
  .tab-carousel-track {
    flex: 1;
    min-height: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    touch-action: pan-x pan-y;
  }

  .tab-carousel-track::-webkit-scrollbar {
    display: none;
  }

  /* Slide Panels */
  .tab-slide-panel {
    flex: 0 0 100%;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-snap-align: start;
    scroll-snap-stop: always;
    box-sizing: border-box;
    padding: 24px 24px calc(96px + env(safe-area-inset-bottom, 12px));
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    touch-action: pan-x pan-y;
  }

  @media (min-width: 640px) {
    .tab-slide-panel {
      padding: 32px 32px calc(96px + env(safe-area-inset-bottom, 12px));
    }
  }

  .tab-slide-panel::-webkit-scrollbar {
    display: none;
  }

  /* Standalone Sub-routes Content */
  .app-content.standalone-page {
    flex: 1;
    min-height: 0;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    padding: 24px 24px calc(96px + env(safe-area-inset-bottom, 12px));
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }

  @media (min-width: 640px) {
    .app-content.standalone-page {
      padding: 32px 32px calc(96px + env(safe-area-inset-bottom, 12px));
    }
  }

  .app-content.standalone-page::-webkit-scrollbar {
    display: none;
  }

  /* Floating Action Button (FAB) Tambah (+) di atas nav */
  .fab-tambah {
    position: fixed;
    bottom: calc(88px + env(safe-area-inset-bottom, 12px));
    right: max(24px, calc(50% - 360px + 24px));
    height: 52px;
    padding: 0 18px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--accent);
    color: var(--on-accent);
    border-radius: var(--r, 10px);
    border: none;
    box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.12);
    font-family: var(--font-ui);
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    z-index: 70;
    transition: opacity 120ms var(--ease), transform 120ms var(--ease);
  }

  .fab-tambah:active {
    opacity: 0.85;
    transform: scale(0.96);
  }

  .fab-label {
    line-height: 1;
  }

  /* Floating Dock Kapsul (iPhone style rounded 50%) */
  .bottom-dock {
    position: fixed;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    width: fit-content;
    max-width: min(calc(100vw - 32px), 420px);
    background: var(--bg-raised);
    border: 1px solid var(--line);
    border-radius: 9999px;
    box-shadow: 0 10px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    z-index: 60;
    box-sizing: border-box;
    padding: 6px;
  }

  .dock-inner {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    width: fit-content;
    box-sizing: border-box;
  }

  /* Single Liquid Bubble Runner */
  .dock-bubble-runner {
    position: absolute;
    top: 0;
    left: 0;
    height: 44px;
    border-radius: 9999px;
    z-index: 0;
    pointer-events: none;
    transition: transform 0.42s cubic-bezier(0.2, 0.9, 0.3, 1),
                width 0.42s cubic-bezier(0.2, 0.9, 0.3, 1);
    will-change: transform, width;
  }

  .dock-bubble-liquid {
    width: 100%;
    height: 100%;
    border-radius: 9999px;
    background: var(--accent);
    box-shadow: 0 4px 14px -2px rgba(0, 0, 0, 0.2);
    transform-origin: center center;
    will-change: transform;
  }

  /* Dock Tabs: Inactive (compact round icon-only) vs Active (pill width) */
  .dock-tab {
    position: relative;
    z-index: 1;
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0;
    height: 44px;
    width: 44px;
    min-width: 44px;
    padding: 0;
    border-radius: 9999px;
    text-decoration: none;
    color: var(--fg-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: width 0.42s cubic-bezier(0.2, 0.9, 0.3, 1),
                color 0.25s ease,
                padding 0.42s cubic-bezier(0.2, 0.9, 0.3, 1),
                gap 0.42s cubic-bezier(0.2, 0.9, 0.3, 1);
  }

  @media (hover: hover) {
    .dock-tab:not(.active):hover {
      color: var(--fg);
      background: rgba(0, 0, 0, 0.04);
    }
  }

  .dock-tab:active {
    transform: scale(0.95);
  }

  /* Tab Aktif (lebar menyesuaikan konten, teks putih) */
  .dock-tab.active {
    gap: 8px;
    padding: 0 16px 0 14px;
    color: var(--on-accent);
  }

  .dock-tab[data-tab-id='beranda'].active {
    width: 116px;
  }
  .dock-tab[data-tab-id='statistik'].active {
    width: 110px;
  }
  .dock-tab[data-tab-id='tabungan'].active {
    width: 120px;
  }
  .dock-tab[data-tab-id='pengaturan'].active {
    width: 136px;
  }

  /* Icon & Wave Ring Animation */
  .dock-tab-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    line-height: 1;
    flex-shrink: 0;
    z-index: 1;
  }

  .dock-tab-icon svg {
    display: block;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .dock-tab.active .dock-tab-icon::before {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: radial-gradient(circle, currentColor 0%, transparent 70%);
    opacity: 0.2;
    pointer-events: none;
    z-index: -1;
  }

  .dock-tab.active .dock-tab-icon::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
    animation: dock-icon-wave 2.2s cubic-bezier(0.25, 1, 0.5, 1) infinite;
  }

  @keyframes dock-icon-wave {
    0% {
      transform: scale(0.8);
      opacity: 0.7;
      box-shadow: 0 0 0 0 currentColor;
    }
    50% {
      transform: scale(1.35);
      opacity: 0;
      box-shadow: 0 0 4px 1px currentColor;
    }
    100% {
      transform: scale(1.5);
      opacity: 0;
      box-shadow: 0 0 0 0 transparent;
    }
  }

  /* Label Text: Collapsed when inactive, expands when active */
  .dock-tab-label {
    font-size: var(--fs-cap, 13px);
    font-family: var(--font-ui);
    line-height: 1;
    font-weight: 600;
    max-width: 0;
    width: 0;
    opacity: 0;
    overflow: hidden;
    white-space: nowrap;
    pointer-events: none;
    margin: 0;
    transform: translateX(-4px);
    transition: max-width 0.42s cubic-bezier(0.2, 0.9, 0.3, 1),
                opacity 0.25s ease,
                transform 0.42s cubic-bezier(0.2, 0.9, 0.3, 1);
  }

  .dock-tab.active .dock-tab-label {
    max-width: 120px;
    width: auto;
    opacity: 1;
    margin-left: 0;
    transform: translateX(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .dock-bubble-runner,
    .dock-tab,
    .dock-tab-label {
      transition: none;
    }
    .dock-tab.active .dock-tab-icon::after {
      animation: none;
    }
  }
</style>
