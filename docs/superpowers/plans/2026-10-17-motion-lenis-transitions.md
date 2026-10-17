# Motion, Lenis, and Page Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Circular Mask Reveal page transitions, Lenis smooth scrolling (desktop only with 120Hz native mobile momentum), and in-page motions (stagger entrance, micro-spring taps, animated number counter).

**Architecture:** SvelteKit `onNavigate` coupled with native browser View Transitions API for GPU-composited circular reveal transitions. Lightweight `lenis` smooth scroll initialized strictly on desktop pointer devices (`(pointer: fine)`). CSS utility classes for staggered reveals and micro-spring touch interactions, plus a Svelte 5 AnimatedNumber component using `svelte/motion` tweening.

**Tech Stack:** Svelte 5, SvelteKit 2, `lenis` (~3.5 KB gzip), CSS View Transitions API, `svelte/motion`.

**Spec:** In-chat approved architectural design (Circular Mask Reveal, Desktop-only Lenis, Stagger + Micro-Spring + Counter).

## Global Constraints

- Bundle impact minimal (< 5 KB total).
- Mobile scroll must remain 100% native 120Hz momentum without touch interception or lag.
- Reduced-motion preference (`prefers-reduced-motion: reduce`) must disable view transitions and animations.
- Touch targets and sheet gestures must not be blocked or desynced.

## Review Focus

- View Transitions fallback for unsupported browsers (must navigate without throwing errors).
- Touch devices must not trigger Lenis rAF loop or touch interception.
- Fast tab-switching must not stack or break active view transitions.
- High number of transaction items must not cause frame drops during staggered entrance.
- Screen readers / reduced-motion users must receive instant state updates without transitions.

---

### Task 1: Install Lenis and Configure CSS View Transitions & Motion Utilities

**Files:**
- Modify: `package.json`
- Modify: `src/app.css`

**Interfaces:**
- Consumes: Native View Transitions API, CSS Custom Properties (`--nav-x`, `--nav-y`, `--i`).
- Produces: CSS classes `.animate-stagger`, `.interactive-tap`, `@keyframes circleReveal`, `::view-transition-*` rules.

- [x] **Step 1: Install `lenis`**
- [x] **Step 2: Add View Transition & Motion CSS in `src/app.css`**
- [x] **Step 3: Verify build passes**
- [x] **Step 4: Commit**

---

### Task 2: Implement Circular Mask View Transitions & Desktop-only Lenis in `+layout.svelte`

**Files:**
- Modify: `src/routes/+layout.svelte`

**Interfaces:**
- Consumes: `$app/navigation.onNavigate`, `lenis`, `--nav-x`/`--nav-y` CSS vars.
- Produces: Seamless page transitions with click-coordinate circular reveal, desktop-only smooth scroll with automatic cleanup and route change reset.

- [x] **Step 1: Wire `onNavigate` with View Transitions & Click Coordinates**
- [x] **Step 2: Initialize Lenis only on `(pointer: fine)` devices**
- [x] **Step 3: Verify build & tests**
- [x] **Step 4: Commit**

---

### Task 3: Create `AnimatedNumber.svelte` Component

**Files:**
- Create: `src/lib/components/AnimatedNumber.svelte`

**Interfaces:**
- Consumes: `svelte/motion.tweened`, `svelte/easing.cubicOut`, `$lib/money.formatRp`.
- Produces: `<AnimatedNumber value={number} format={optionalFormatter} />` snippet.

- [x] **Step 1: Create `src/lib/components/AnimatedNumber.svelte`**
- [x] **Step 2: Integrate `AnimatedNumber` in Home page summary metrics**
- [x] **Step 3: Verify test suite and build**
- [x] **Step 4: Commit**

---

### Task 4: Apply Stagger Entrance and Micro-Spring Taps Across Pages

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/statistik/+page.svelte`
- Modify: `src/routes/tabungan/+page.svelte`
- Modify: `src/lib/components/Card.svelte`

**Interfaces:**
- Consumes: `.animate-stagger`, `.interactive-tap` CSS classes.
- Produces: Fluid tactile micro-animations on interactive cards, staggered cascading lists.

- [x] **Step 1: Add `.interactive-tap` to Card and quick action buttons**
- [x] **Step 2: Add `.animate-stagger` to daily transaction items and goal cards with indexed `--i`**
- [x] **Step 3: Verify build, tests, and responsiveness**
- [x] **Step 4: Commit**
