import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { floatView } from '../src/lib/actions/floatView.js';

console.log('--- RUNNING FLOAT VIEW & CHART ANIMATION TESTS ---');

// Test 1: floatView in SSR/Node environment (no window/IntersectionObserver)
{
  const mockNode = {
    classList: {
      classes: new Set(),
      add(cls) { this.classes.add(cls); },
      remove(cls) { this.classes.delete(cls); },
      contains(cls) { return this.classes.has(cls); }
    },
    closest() { return null; }
  };

  const action = floatView(mockNode);
  assert.ok(mockNode.classList.contains('is-visible'), 'Should add is-visible in non-browser env');
  assert.equal(typeof action.destroy, 'function', 'Should return destroy function');
  action.destroy();
  console.log('✓ floatView SSR fallback verified');
}

// Test 2: floatView in simulated browser environment with IntersectionObserver
{
  let observerCallback = null;
  let observerOptions = null;
  let disconnected = false;
  let observedNode = null;

  class MockIntersectionObserver {
    constructor(callback, options) {
      observerCallback = callback;
      observerOptions = options;
    }
    observe(node) {
      observedNode = node;
    }
    disconnect() {
      disconnected = true;
    }
  }

  const mockPanel = { name: 'tab-slide-panel' };
  const mockNode = {
    classList: {
      classes: new Set(),
      add(cls) { this.classes.add(cls); },
      remove(cls) { this.classes.delete(cls); },
      contains(cls) { return this.classes.has(cls); }
    },
    closest(selector) {
      if (selector === '.tab-slide-panel') return mockPanel;
      return null;
    }
  };

  globalThis.window = { IntersectionObserver: MockIntersectionObserver };
  globalThis.IntersectionObserver = MockIntersectionObserver;

  try {
    const action = floatView(mockNode);
    assert.equal(observedNode, mockNode, 'Should observe node');
    assert.equal(observerOptions.root, mockPanel, 'Should detect .tab-slide-panel as root');
    assert.equal(observerOptions.threshold, 0.1, 'Default threshold should be 0.1');
    assert.equal(observerOptions.rootMargin, '0px 0px -40px 0px', 'Default rootMargin should match spec');

    // Simulate intersecting
    observerCallback([{ isIntersecting: true }]);
    assert.ok(mockNode.classList.contains('is-visible'), 'Adds is-visible on enter');

    // Simulate leaving viewport (toggle two-way)
    observerCallback([{ isIntersecting: false }]);
    assert.ok(!mockNode.classList.contains('is-visible'), 'Removes is-visible on leave');

    // Re-enter
    observerCallback([{ isIntersecting: true }]);
    assert.ok(mockNode.classList.contains('is-visible'), 'Re-adds is-visible on re-enter');

    // Destroy
    action.destroy();
    assert.ok(disconnected, 'Calls disconnect on destroy');
    console.log('✓ floatView bidirectional intersection observer behavior verified');
  } finally {
    delete globalThis.window;
    delete globalThis.IntersectionObserver;
  }
}

// Test 3: Verify CSS in src/app.css
{
  const css = fs.readFileSync(path.resolve('src/app.css'), 'utf-8');
  assert.ok(css.includes('.float-item'), 'app.css must contain .float-item');
  assert.ok(css.includes('.float-item.is-visible'), 'app.css must contain .float-item.is-visible');
  assert.ok(css.includes('.float-item:nth-child(8)'), 'app.css must contain stagger rules up to nth-child(8)');
  assert.ok(css.includes('.float-item:nth-child(n+9)'), 'app.css must contain stagger rule for nth-child(n+9)');
  assert.ok(css.includes('prefers-reduced-motion: reduce'), 'app.css must handle prefers-reduced-motion');
  console.log('✓ app.css float-item & stagger animation CSS verified');
}

// Test 4: Verify ExpenseLineChart & DonutChart animations in components
{
  const lineChartSrc = fs.readFileSync(path.resolve('src/lib/components/ExpenseLineChart.svelte'), 'utf-8');
  assert.ok(lineChartSrc.includes('pathLength="1000"'), 'ExpenseLineChart should use pathLength="1000"');
  assert.ok(lineChartSrc.includes('area-fill'), 'ExpenseLineChart should have area-fill gradient');
  assert.ok(lineChartSrc.includes('popPointDot'), 'ExpenseLineChart should have popPointDot dot animation');
  assert.ok(lineChartSrc.includes('prefers-reduced-motion'), 'ExpenseLineChart should support reduced motion');

  const donutSrc = fs.readFileSync(path.resolve('src/lib/components/DonutChart.svelte'), 'utf-8');
  assert.ok(donutSrc.includes('donut-slices-reveal'), 'DonutChart should have donut-slices-reveal class');
  assert.ok(donutSrc.includes('center-text-reveal'), 'DonutChart should have center-text-reveal class');
  assert.ok(donutSrc.includes('donutSlicesEntrance'), 'DonutChart should have donutSlicesEntrance keyframes');
  assert.ok(donutSrc.includes('prefers-reduced-motion'), 'DonutChart should support reduced motion');
  console.log('✓ ExpenseLineChart and DonutChart animation attributes verified');
}

console.log('--- ALL FLOAT VIEW & CHART ANIMATION TESTS PASSED! ---');
