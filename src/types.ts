/**
 * Shared domain types for the Restaurant & Client Manager cartridge.
 * Everything persisted to localStorage flows through these shapes —
 * see store.ts for the persistence keys and migrations.
 */

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minThreshold: number;
}

export interface MenuItemIngredient {
  ingredientId: string;
  quantity: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  /** Overrides the default Settings VAT for this dish (e.g. 20 for alcohol). */
  vatRate?: number;
  ingredients: MenuItemIngredient[];
}

/** One course slot of a set menu — the guest picks ONE of the options. */
export interface ComboCourse {
  id: string;
  /** Free label shown to staff, e.g. "Starter" / "Entrée". */
  label: string;
  /** Menu item ids the guest can choose from (1 = fixed course). */
  optionIds: string[];
}

/** Set menu ("formule"): fixed price for a pick across each course. */
export interface Combo {
  id: string;
  name: string;
  price: number;
  /** Overrides the default Settings VAT for the whole set menu. */
  vatRate?: number;
  courses: ComboCourse[];
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  allergies: string[];
  preferences: string;
  favTable: string;
  visits: number;
  /** Redeemable loyalty balance (spent when a reward is claimed). */
  loyaltyPoints: number;
  /** Lifetime earned points — drives the tier, never decreases. */
  lifetimePoints: number;
}

/** A member of the floor staff — tables and tips are attributed to them. */
export interface Server {
  id: string;
  name: string;
  /** Identity color used on floor-plan badges and reports. */
  color: string;
}

export type TableShape = 'circle' | 'square' | 'rectangle';
export type TableStatus = 'vacant' | 'occupied' | 'reserved' | 'billed';

export interface Table {
  id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  status: TableStatus;
  clientId?: string;
  /** Waiter covering this table — persists across checkouts (section duty). */
  serverId?: string;
  /** ISO timestamp of the expected arrival while status is 'reserved'. */
  reservedAt?: string;
  activeOrder?: { itemId: string; qty: number }[];
  /** Ordered set menus; picks[i] = chosen item id for courses[i]. */
  comboOrder?: { comboId: string; picks: string[]; qty: number }[];
}

export type PaymentMethod = 'Cash' | 'Card' | 'Mobile';

export interface Invoice {
  id: string;
  /** Pre-rework invoices only carry a fr-FR display string here. */
  date: string;
  /** ISO timestamp — source of truth for filtering/stats since v2. */
  dateISO?: string;
  tableName: string;
  clientName?: string;
  items: { name: string; price: number; qty: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  /** Snapshot of the settings the bill was issued under. */
  currency?: string;
  vatRate?: number;
  /** Per-rate tax split when dishes carry different VAT rates. */
  taxBreakdown?: { rate: number; amount: number }[];
  /** Loyalty movement attached to this bill, if any. */
  loyaltyEarned?: number;
  loyaltyRedeemed?: number;
  /** Gratuity added on top of the taxed total (not taxed itself). */
  tip?: number;
  /** Waiter credited with the bill (name kept for history if deleted). */
  serverId?: string;
  serverName?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Settings {
  restaurantName: string;
  /** ISO 4217 code used by Intl.NumberFormat (EUR, USD, …). */
  currency: string;
  /** VAT percentage applied at checkout (e.g. 10 = 10%). */
  vatRate: number;
  loyaltyEnabled: boolean;
  /** Points earned per 1 unit of currency spent. */
  earnRate: number;
  /** Points needed to claim one reward. */
  redeemThreshold: number;
  /** Money value (in `currency`) of one claimed reward. */
  redeemValue: number;
}

export type TabId =
  | 'dashboard'
  | 'floor'
  | 'crm'
  | 'staff'
  | 'menu'
  | 'inventory'
  | 'billing'
  | 'invoices'
  | 'settings';
