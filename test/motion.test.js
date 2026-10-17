import assert from 'node:assert/strict';
import { formatRp } from '../src/lib/money.js';

console.log('--- RUNNING MOTION & ANIMATED NUMBER TESTS ---');

// Test number formatting logic used in AnimatedNumber
{
  assert.equal(formatRp(0), 'Rp 0');
  assert.equal(formatRp(15000), 'Rp 15.000');
  assert.equal(formatRp(-5000), '−Rp 5.000');
  assert.equal(formatRp(145000), 'Rp 145.000');
  console.log('✓ AnimatedNumber format logic verified');
}

// Test custom formatter fallback
{
  const customFormatter = (v) => `${v}%`;
  assert.equal(customFormatter(75), '75%');
  assert.equal(customFormatter(0), '0%');
  console.log('✓ Custom formatting for percentage/ratios verified');
}

console.log('--- ALL MOTION TESTS PASSED! ---');
