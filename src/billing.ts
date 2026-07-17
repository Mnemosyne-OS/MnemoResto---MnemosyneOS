/**
 * Bill math shared by the POS display and the checkout handler — one source
 * of truth so the preview always matches what lands on the invoice.
 * Covers both à-la-carte dish lines and set-menu ("formule") lines.
 */
import type { Combo, MenuItem, Settings, Table } from './types';

export interface CartLine {
  menuItem: MenuItem;
  qty: number;
}

export function cartFromTable(table: Table | null, menu: MenuItem[]): CartLine[] {
  if (!table?.activeOrder) return [];
  return table.activeOrder
    .map((line) => ({ menuItem: menu.find((m) => m.id === line.itemId), qty: line.qty }))
    .filter((line): line is CartLine => line.menuItem !== undefined);
}

export interface ComboLine {
  combo: Combo;
  /** Resolved picked dishes (vanished menu items are dropped). */
  picks: MenuItem[];
  /** Merge key: same combo + same picks = one cart line. */
  picksKey: string;
  qty: number;
}

export function comboKey(comboId: string, picks: string[]): string {
  return `${comboId}::${picks.join('+')}`;
}

export function comboLinesFromTable(table: Table | null, combos: Combo[], menu: MenuItem[]): ComboLine[] {
  if (!table?.comboOrder) return [];
  return table.comboOrder
    .map((line) => {
      const combo = combos.find((c) => c.id === line.comboId);
      if (!combo) return null;
      const picks = line.picks
        .map((id) => menu.find((m) => m.id === id))
        .filter((m): m is MenuItem => m !== undefined);
      return { combo, picks, picksKey: comboKey(line.comboId, line.picks), qty: line.qty };
    })
    .filter((line): line is ComboLine => line !== null);
}

/** Indicative à-la-carte value: most expensive option of every course. */
export function comboALaCarteValue(combo: Combo, menu: MenuItem[]): number {
  return combo.courses.reduce((sum, course) => {
    const prices = course.optionIds
      .map((id) => menu.find((m) => m.id === id)?.price)
      .filter((price): price is number => typeof price === 'number');
    return sum + (prices.length > 0 ? Math.max(...prices) : 0);
  }, 0);
}

/** Every dish leaving the kitchen (à la carte + combo picks) — for stock. */
export function expandDishLines(table: Table | null, menu: MenuItem[], combos: Combo[]): CartLine[] {
  const lines: CartLine[] = cartFromTable(table, menu).map((line) => ({ ...line }));
  for (const comboLine of comboLinesFromTable(table, combos, menu)) {
    for (const item of comboLine.picks) {
      lines.push({ menuItem: item, qty: comboLine.qty });
    }
  }
  return lines;
}

export interface BillTotals {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  /** Tax split per VAT rate, ascending — one entry per distinct rate billed. */
  taxBreakdown: { rate: number; amount: number }[];
}

/**
 * `redeem` applies one loyalty reward as a discount (capped at the bill).
 * VAT is computed PER LINE: each dish/set menu may override the default
 * Settings rate (e.g. alcohol at 20%), and the breakdown keeps one entry
 * per distinct rate for the receipt.
 */
export function computeBill(cart: CartLine[], comboLines: ComboLine[], settings: Settings, redeem: boolean): BillTotals {
  const taxByRate = new Map<number, number>();
  let subtotal = 0;

  const addLine = (amount: number, rate: number) => {
    subtotal += amount;
    taxByRate.set(rate, (taxByRate.get(rate) ?? 0) + amount * (rate / 100));
  };

  cart.forEach((line) => addLine(line.menuItem.price * line.qty, line.menuItem.vatRate ?? settings.vatRate));
  comboLines.forEach((line) => addLine(line.combo.price * line.qty, line.combo.vatRate ?? settings.vatRate));

  const taxBreakdown = [...taxByRate.entries()]
    .map(([rate, amount]) => ({ rate, amount }))
    .sort((a, b) => a.rate - b.rate);
  const tax = taxBreakdown.reduce((sum, entry) => sum + entry.amount, 0);
  const gross = subtotal + tax;
  const discount = redeem ? Math.min(settings.redeemValue, gross) : 0;
  return { subtotal, tax, discount, total: gross - discount, taxBreakdown };
}
