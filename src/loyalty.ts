/**
 * Loyalty program — pure functions only, no React and no storage.
 * Points accrue on lifetimePoints (tier driver, never decreases) and on
 * loyaltyPoints (spendable balance, decremented on redemption).
 */
import type { Settings } from './types';

export type TierId = 'bronze' | 'silver' | 'gold';

/** Lifetime-point floors for each tier, ascending. */
export const TIERS: { id: TierId; min: number; emoji: string }[] = [
  { id: 'bronze', min: 0, emoji: '🥉' },
  { id: 'silver', min: 500, emoji: '🥈' },
  { id: 'gold', min: 1500, emoji: '🥇' },
];

export function tierFor(lifetimePoints: number): { id: TierId; min: number; emoji: string } {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (lifetimePoints >= tier.min) current = tier;
  }
  return current;
}

/** The next tier above the given lifetime balance, or null at the top. */
export function nextTier(lifetimePoints: number): { id: TierId; min: number; emoji: string } | null {
  for (const tier of TIERS) {
    if (lifetimePoints < tier.min) return tier;
  }
  return null;
}

/** Points earned for a bill of `total` money units (floored, never negative). */
export function earnedPoints(total: number, settings: Settings): number {
  if (!settings.loyaltyEnabled || settings.earnRate <= 0) return 0;
  return Math.max(0, Math.floor(total * settings.earnRate));
}

/** Can this balance claim one reward right now? */
export function canRedeem(loyaltyPoints: number, settings: Settings): boolean {
  return (
    settings.loyaltyEnabled &&
    settings.redeemThreshold > 0 &&
    settings.redeemValue > 0 &&
    loyaltyPoints >= settings.redeemThreshold
  );
}
