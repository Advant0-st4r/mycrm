import {describe, it, expect} from 'vitest';
import { SKUS, maxTier, perCall, usdToQar, emptyUsage, TIER_ORDER } from '../src/billing'
import { SKUS } from '@/lib/pricing';

describe('billing invariants', () => {
  it('has no DETAILS_AR SKU', () => {
    expect(SKUS).not.toContain('DETAILS_AR')
  });
})

