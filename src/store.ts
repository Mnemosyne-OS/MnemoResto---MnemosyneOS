/**
 * localStorage persistence — single place that knows the storage keys, the
 * legacy-data migrations, and the backup format. The vault-side memory
 * (chronicles in APP-RESTAURANT-MANAGER) is intentionally NOT touched by
 * wipe/import: vault deletions belong to the human, from the host Vault Pad.
 */
import type { Client, Combo, Ingredient, Invoice, MenuItem, Server, Settings, Table } from './types';

export const LS_KEYS = {
  tables: 'mnemo_rest_tables',
  clients: 'mnemo_rest_clients',
  ingredients: 'mnemo_rest_ingredients',
  menu: 'mnemo_rest_menu',
  combos: 'mnemo_rest_combos',
  servers: 'mnemo_rest_servers',
  invoices: 'mnemo_rest_invoices',
  settings: 'mnemo_rest_settings',
} as const;

/** Identity colors cycled through when creating servers. */
export const SERVER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16'];

/** Prefix of the per-vault client-sync idempotency maps (see App.tsx). */
export const SYNC_MAP_PREFIX = 'restaurant_synced_v1:';

export const DEFAULT_SETTINGS: Settings = {
  restaurantName: 'MnemoResto',
  currency: 'EUR',
  vatRate: 10,
  loyaltyEnabled: true,
  earnRate: 1,
  redeemThreshold: 100,
  redeemValue: 5,
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.warn(`[RestaurantManager] corrupted localStorage entry "${key}" ignored:`, err);
    return fallback;
  }
}

/** Pre-loyalty clients lack the two point counters — default them to 0. */
function migrateClient(c: Partial<Client> & { id: string; name: string }): Client {
  return {
    phone: '',
    email: '',
    allergies: [],
    preferences: '',
    favTable: '',
    visits: 0,
    ...c,
    loyaltyPoints: typeof c.loyaltyPoints === 'number' ? c.loyaltyPoints : 0,
    lifetimePoints: typeof c.lifetimePoints === 'number' ? c.lifetimePoints : Math.max(0, c.loyaltyPoints ?? 0),
  };
}

export function loadTables(): Table[] {
  return loadJson<Table[]>(LS_KEYS.tables, []);
}

export function loadClients(): Client[] {
  return loadJson<(Partial<Client> & { id: string; name: string })[]>(LS_KEYS.clients, []).map(migrateClient);
}

export function loadIngredients(): Ingredient[] {
  return loadJson<Ingredient[]>(LS_KEYS.ingredients, []);
}

export function loadMenu(): MenuItem[] {
  return loadJson<MenuItem[]>(LS_KEYS.menu, []);
}

export function loadCombos(): Combo[] {
  return loadJson<Combo[]>(LS_KEYS.combos, []);
}

export function loadServers(): Server[] {
  return loadJson<Server[]>(LS_KEYS.servers, []);
}

export function loadInvoices(): Invoice[] {
  return loadJson<Invoice[]>(LS_KEYS.invoices, []);
}

export function loadSettings(): Settings {
  const settings = { ...DEFAULT_SETTINGS, ...loadJson<Partial<Settings>>(LS_KEYS.settings, {}) };
  // Rebrand migration: stored pre-rename default (never customized) follows.
  if (settings.restaurantName === 'Mnemosyne Resto') settings.restaurantName = DEFAULT_SETTINGS.restaurantName;
  return settings;
}

export function save(key: keyof typeof LS_KEYS, value: unknown): void {
  localStorage.setItem(LS_KEYS[key], JSON.stringify(value));
}

/** Removes every cartridge key, including the vault-sync idempotency maps. */
export function clearAllData(): void {
  Object.values(LS_KEYS).forEach((key) => localStorage.removeItem(key));
  const syncKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SYNC_MAP_PREFIX)) syncKeys.push(key);
  }
  syncKeys.forEach((key) => localStorage.removeItem(key));
}

// ── Backup (export / import) ───────────────────────────────────────────────

export interface Backup {
  app: 'restaurant-manager';
  version: 2;
  exportedAt: string;
  tables: Table[];
  clients: Client[];
  ingredients: Ingredient[];
  menu: MenuItem[];
  combos: Combo[];
  servers: Server[];
  invoices: Invoice[];
  settings: Settings;
}

export function buildBackup(data: Omit<Backup, 'app' | 'version' | 'exportedAt'>): Backup {
  return { app: 'restaurant-manager', version: 2, exportedAt: new Date().toISOString(), ...data };
}

/** Parses and validates a backup file. Returns null when the shape is wrong. */
export function parseBackup(raw: string): Backup | null {
  try {
    const data = JSON.parse(raw) as Partial<Backup>;
    if (data?.app !== 'restaurant-manager') return null;
    if (!Array.isArray(data.tables) || !Array.isArray(data.clients) || !Array.isArray(data.menu)) return null;
    return {
      app: 'restaurant-manager',
      version: 2,
      exportedAt: data.exportedAt ?? '',
      tables: data.tables,
      clients: (data.clients as (Partial<Client> & { id: string; name: string })[]).map(migrateClient),
      ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
      menu: data.menu,
      combos: Array.isArray(data.combos) ? data.combos : [],
      servers: Array.isArray(data.servers) ? data.servers : [],
      invoices: Array.isArray(data.invoices) ? data.invoices : [],
      settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    };
  } catch {
    return null;
  }
}
