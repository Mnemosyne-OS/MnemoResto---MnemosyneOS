/**
 * agent.ts — what an agent may do in MnemoResto (doc 149), declared in
 * `mnemo-plugin.json` › agentActions and served by RestoAgentActions while the
 * window is open.
 *
 * Reads of the floor, the clients, the menu and the stock; writes that are the
 * person's own forms (`saveClient` of the CRM, `saveStockEntry` of the
 * inventory, `saveMenuItem` of the menu, the floor plan's status and waiter
 * pickers, the staff form, the settings page) and the navigation, each showing
 * the tab where it landed.
 *
 * A table, a dish, a client or a waiter is taken by the words a person says
 * (agentFind): the voice never reads the room first. An id still works.
 *
 * NOT exposed (doc 124, cash rules): orders, checkout, bills and invoices, and
 * the « billed » status; the copilot's send, which calls a model; VAT and
 * currency. Deleting anything is not exposed either.
 */
import { findNamed, fold, matchNamed, named, type Named } from './agentFind';
import type { Client, Ingredient, MenuItem, Server, Settings, Table, TableStatus, TabId } from './types';

export interface RestoAgentContext {
  tables: readonly Table[];
  clients: readonly Client[];
  menu: readonly MenuItem[];
  ingredients: readonly Ingredient[];
  servers: readonly Server[];
  settings: Settings;
  currency: string;
  activeTab: TabId;
  setTab: (tab: TabId) => void;
  /** The CRM form's save: a new client (editingId null) answers its id. */
  saveClient: (form: Partial<Client>, editingId: string | null) => string | null;
  /** The inventory form's save: adds to an ingredient of that name, or creates it. */
  saveStockEntry: (entry: { name: string; quantity: number; unit: string; minThreshold: number }) => void;
  /** Shows a client's card in the CRM, as a click in the list does. */
  showClient: (id: string) => void;
  /** The menu form's save (App.saveMenuItem): the whole dish, minus its id. */
  saveMenuItem: (item: Omit<MenuItem, 'id'>, editingId: string | null) => void;
  /** The floor plan's own table update (App's setTables). */
  updateTables: (updater: (prev: Table[]) => Table[]) => void;
  /** Selects a table, as a click on the floor plan does (null = none). */
  selectTable: (id: string | null) => void;
  /** Selects a client card in the CRM (null = none). */
  selectClient: (id: string | null) => void;
  /** The staff form's add. */
  addServer: (name: string) => void;
  /** The settings page's update. */
  updateSettings: (patch: Partial<Settings>) => void;
  /** What is open on the screen, so closeView can say what it closed. */
  selectedTableId: string | null;
  selectedClientId: string | null;
  invoiceOpen: boolean;
  closeInvoice: () => void;
  copilotOpen: boolean;
  setCopilot: (open: boolean) => void;
  /** Resolves after the next render, so the answer reads what was saved. */
  rendered: () => Promise<void>;
}

/** The stock form's default alert threshold (components/Inventory.tsx EMPTY_FORM). */
export const NEW_INGREDIENT_THRESHOLD = 2;

/** The tabs of the header, in its order. */
export const TABS: readonly TabId[] = ['dashboard', 'floor', 'crm', 'staff', 'menu', 'inventory', 'billing', 'invoices', 'settings'];

/** The statuses an agent may set: never « billed », which is the till's (doc 124). */
export const AGENT_TABLE_STATUS: readonly TableStatus[] = ['vacant', 'occupied', 'reserved'];

export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** A whole number inside the manifest's bounds, or the default. Clamped, never trusted. */
export function boundedInt(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

/** `clients` › limit: 1..500, default 50 (mnemo-plugin.json). */
export const clientsLimit = (v: unknown): number => boundedInt(v, 50, 1, 500);

/** Every word of the query in the client's name, phone, email, allergies or preferences. */
export function searchClients(clients: readonly Client[], query: string): Client[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...clients];
  return clients.filter((c) => {
    const hay = fold([c.name, c.phone, c.email, ...c.allergies, c.preferences].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

export function clientLine(c: Client) {
  return {
    id: c.id,
    name: c.name,
    ...(c.phone ? { phone: c.phone } : {}),
    ...(c.email ? { email: c.email } : {}),
    ...(c.allergies.length ? { allergies: c.allergies } : {}),
    ...(c.preferences ? { preferences: c.preferences } : {}),
    ...(c.favTable ? { favTable: c.favTable } : {}),
    visits: c.visits,
    loyaltyPoints: c.loyaltyPoints,
  };
}

/** The client an agent named: by id or by the words of the name, never the first of several. */
export function findClient(clients: readonly Client[], ref: string): Client {
  return findNamed(named(clients, (c) => c.id, (c) => c.name, (c) => c.phone), ref, { code: 'NO_CLIENT', noun: 'client' });
}

export function findTable(tables: readonly Table[], ref: string): Table {
  return findNamed(named(tables, (tb) => tb.id, (tb) => tb.name), ref, { code: 'NO_TABLE', noun: 'table' });
}

export function findDish(menu: readonly MenuItem[], ref: string): MenuItem {
  // A dish is also found by its name with its category (« le tiramisu dessert »).
  const entries: Array<Named<MenuItem>> = named(menu, (m) => m.id, (m) => m.name)
    .map((e) => ({ ...e, names: [...e.names, `${e.item.name} ${e.item.category}`] }));
  return findNamed(entries, ref, { code: 'NO_DISH', noun: 'dish', plural: 'dishes' });
}

export function findServer(servers: readonly Server[], ref: string): Server {
  return findNamed(named(servers, (s) => s.id, (s) => s.name), ref, { code: 'NO_SERVER', noun: 'waiter' });
}

/**
 * The ingredient a restock names: the same name (any case) first, else the one
 * ingredient its words name; several are refused; none = a new ingredient.
 */
export function findIngredient(ingredients: readonly Ingredient[], ref: string): Ingredient | null {
  const exact = ingredients.find((i) => i.name.toLowerCase() === ref.toLowerCase());
  if (exact) return exact;
  const m = matchNamed(named(ingredients, (i) => i.id, (i) => i.name), ref);
  if ('one' in m) return m.one;
  if ('several' in m) throw new Error(`AMBIGUOUS: "${ref}" names several ingredients: ${m.several.map((e) => e.label).join(', ')}; say which (or a new name for a new ingredient)`);
  return null;
}

/** A list argument as clean strings (allergies). */
function strList(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.map(str).filter(Boolean))] : [];
}

const CLIENT_TEXT = ['phone', 'email', 'preferences', 'favTable'] as const;

/** One table as the agent reads it: names for ids. */
function tableLine(tb: Table, ctx: Pick<RestoAgentContext, 'clients' | 'servers' | 'menu'>) {
  const client = tb.clientId ? ctx.clients.find((c) => c.id === tb.clientId) : undefined;
  const server = tb.serverId ? ctx.servers.find((s) => s.id === tb.serverId) : undefined;
  const dish = new Map(ctx.menu.map((m) => [m.id, m.name]));
  return {
    id: tb.id,
    name: tb.name,
    status: tb.status,
    capacity: tb.capacity,
    ...(client ? { client: client.name } : {}),
    ...(server ? { server: server.name } : {}),
    ...(tb.status === 'reserved' && tb.reservedAt ? { reservedAt: tb.reservedAt } : {}),
    ...(tb.activeOrder?.length ? { order: tb.activeOrder.map((l) => ({ dish: dish.get(l.itemId) ?? l.itemId, qty: l.qty })) } : {}),
    ...(tb.comboOrder?.length ? { setMenus: tb.comboOrder.reduce((n, l) => n + l.qty, 0) } : {}),
  };
}

/** One dish with its recipe, ingredients by name and what is in stock. */
function dishLine(m: MenuItem, ingredients: readonly Ingredient[], currency: string) {
  const ing = new Map(ingredients.map((i) => [i.id, i]));
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    price: m.price,
    currency,
    ...(m.vatRate !== undefined ? { vatRate: m.vatRate } : {}),
    recipe: m.ingredients.map((r) => {
      const i = ing.get(r.ingredientId);
      return i ? { ingredient: i.name, quantity: r.quantity, unit: i.unit, inStock: i.quantity } : { ingredient: r.ingredientId, quantity: r.quantity };
    }),
  };
}

const NOT_SAVED = (what: string) => new Error(`WRITE_FAILED: ${what} was not saved; the reason is on the person's screen`);

export function restoAgentHandlers(get: () => RestoAgentContext) {
  return {
    // agent-actions:begin
    tables: () => {
      const ctx = get();
      return ctx.tables.map((tb) => tableLine(tb, ctx));
    },

    clients: (args: Record<string, unknown>) => {
      const { clients } = get();
      const found = searchClients(clients, str(args.query)).sort((a, b) => a.name.localeCompare(b.name));
      return { total: clients.length, matching: found.length, clients: found.slice(0, clientsLimit(args.limit)).map(clientLine) };
    },

    menu: () => {
      const { menu, currency } = get();
      return { currency, dishes: menu.map((m) => ({ id: m.id, name: m.name, category: m.category, price: m.price })) };
    },

    stock: () => {
      const { ingredients } = get();
      const lines = ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, minThreshold: i.minThreshold, low: i.quantity <= i.minThreshold }));
      return { low: lines.filter((l) => l.low).map((l) => l.name), ingredients: lines };
    },

    openTab: (args: Record<string, unknown>) => {
      const ctx = get();
      const tab = str(args.tab) as TabId;
      if (!TABS.includes(tab)) throw new Error(`BAD_ARG: tab is one of ${TABS.join(', ')}`);
      ctx.setTab(tab);
      return { tab };
    },

    addClient: async (args: Record<string, unknown>) => {
      const ctx = get();
      const name = str(args.name);
      if (!name) throw new Error('BAD_ARG: name is empty');
      const form: Partial<Client> = { name, allergies: strList(args.allergies) };
      for (const k of CLIENT_TEXT) if (str(args[k])) form[k] = str(args[k]);
      const id = ctx.saveClient(form, null);
      ctx.setTab('crm');
      await ctx.rendered();
      if (!id || !get().clients.some((c) => c.id === id)) throw NOT_SAVED('the client');
      return { clientId: id };
    },

    updateClient: async (args: Record<string, unknown>) => {
      const ctx = get();
      const c = findClient(ctx.clients, str(args.clientId));
      const form: Partial<Client> = {};
      for (const k of CLIENT_TEXT) if (typeof args[k] === 'string') form[k] = str(args[k]);
      if (args.allergies !== undefined) form.allergies = strList(args.allergies);
      if (Object.keys(form).length === 0) throw new Error('NOTHING_TO_CHANGE: pass at least one field to change');
      ctx.saveClient(form, c.id);
      ctx.showClient(c.id);
      await ctx.rendered();
      const after = get().clients.find((x) => x.id === c.id);
      if (!after) throw new Error('WRITE_FAILED: the client is no longer in the list; call clients');
      return clientLine(after);
    },

    restock: async (args: Record<string, unknown>) => {
      const ctx = get();
      const name = str(args.name);
      if (!name) throw new Error('BAD_ARG: name is empty');
      const quantity = typeof args.quantity === 'number' && Number.isFinite(args.quantity) ? args.quantity : NaN;
      if (Number.isNaN(quantity) || quantity === 0) throw new Error('BAD_ARG: quantity is a number other than 0 (negative takes stock out)');
      const existing = findIngredient(ctx.ingredients, name);
      const unit = str(args.unit);
      if (!existing && !unit) throw new Error(`BAD_ARG: "${name}" is a new ingredient; pass its unit (pcs, kg, L...)`);
      // Unset: 0 keeps an existing threshold (the form's rule); a new ingredient gets the form's default.
      const minThreshold = typeof args.minThreshold === 'number' && Number.isFinite(args.minThreshold)
        ? Math.max(0, args.minThreshold)
        : existing ? 0 : NEW_INGREDIENT_THRESHOLD;
      const savedName = existing?.name ?? name;
      ctx.saveStockEntry({ name: savedName, quantity, unit: existing?.unit ?? unit, minThreshold });
      ctx.setTab('inventory');
      await ctx.rendered();
      const after = get().ingredients.find((i) => i.name.toLowerCase() === savedName.toLowerCase());
      if (!after) throw NOT_SAVED('the stock');
      return { name: after.name, quantity: after.quantity, unit: after.unit, low: after.quantity <= after.minThreshold };
    },

    showTable: async (args: Record<string, unknown>) => {
      const ctx = get();
      const tb = findTable(ctx.tables, str(args.table));
      ctx.selectTable(tb.id);
      ctx.setTab('floor');
      await ctx.rendered();
      return tableLine(get().tables.find((x) => x.id === tb.id) ?? tb, get());
    },

    setTable: async (args: Record<string, unknown>) => {
      const ctx = get();
      const tb = findTable(ctx.tables, str(args.table));
      const status = str(args.status) as TableStatus | '';
      if (status && !AGENT_TABLE_STATUS.includes(status)) throw new Error(`BAD_ARG: status is one of ${AGENT_TABLE_STATUS.join(', ')} (billed belongs to the till)`);
      const server = str(args.server) ? findServer(ctx.servers, str(args.server)) : null;
      const capacity = typeof args.capacity === 'number' && Number.isFinite(args.capacity) ? Math.max(1, Math.floor(args.capacity)) : null;
      if (!status && !server && capacity === null) throw new Error('NOTHING_TO_CHANGE: pass status, server or capacity');
      if (status && tb.status === 'billed') throw new Error(`BILLED: ${tb.name} is waiting for its bill at the till; its status changes there`);
      // The floor plan's own rule: the arrival time only lives while the table is reserved.
      ctx.updateTables((prev) => prev.map((x) => (x.id !== tb.id ? x : {
        ...x,
        ...(status ? { status, reservedAt: status === 'reserved' ? x.reservedAt : undefined } : {}),
        ...(server ? { serverId: server.id } : {}),
        ...(capacity !== null ? { capacity } : {}),
      })));
      ctx.selectTable(tb.id);
      ctx.setTab('floor');
      await ctx.rendered();
      const after = get().tables.find((x) => x.id === tb.id);
      if (!after || (status && after.status !== status) || (server && after.serverId !== server.id) || (capacity !== null && after.capacity !== capacity)) {
        throw NOT_SAVED('the table');
      }
      return tableLine(after, get());
    },

    showDish: async (args: Record<string, unknown>) => {
      const ctx = get();
      const m = findDish(ctx.menu, str(args.dish));
      ctx.setTab('menu');
      await ctx.rendered();
      const now = get();
      return dishLine(now.menu.find((x) => x.id === m.id) ?? m, now.ingredients, now.currency);
    },

    editDish: async (args: Record<string, unknown>) => {
      const ctx = get();
      const m = findDish(ctx.menu, str(args.dish));
      const name = typeof args.name === 'string' ? str(args.name) : m.name;
      const category = typeof args.category === 'string' ? str(args.category) || '—' : m.category;
      const price = args.price === undefined
        ? m.price
        : typeof args.price === 'number' && Number.isFinite(args.price) ? Math.round(args.price * 100) / 100 : NaN;
      if (!name) throw new Error('BAD_ARG: name is empty');
      if (!Number.isFinite(price) || price < 0) throw new Error('BAD_ARG: price is a number of 0 or more');
      if (name === m.name && category === m.category && price === m.price) throw new Error('NOTHING_TO_CHANGE: pass a new price, name or category');
      // The whole dish, as the menu form saves it: its recipe and its VAT stay.
      ctx.saveMenuItem({ name, category, price, vatRate: m.vatRate, ingredients: m.ingredients }, m.id);
      ctx.setTab('menu');
      await ctx.rendered();
      const now = get();
      const after = now.menu.find((x) => x.id === m.id);
      if (!after || after.name !== name || after.price !== price || after.category !== category) throw NOT_SAVED('the dish');
      return dishLine(after, now.ingredients, now.currency);
    },

    showClient: async (args: Record<string, unknown>) => {
      const ctx = get();
      const c = findClient(ctx.clients, str(args.client));
      ctx.showClient(c.id);
      await ctx.rendered();
      return clientLine(get().clients.find((x) => x.id === c.id) ?? c);
    },

    addServer: async (args: Record<string, unknown>) => {
      const ctx = get();
      const name = str(args.name);
      if (!name) throw new Error('BAD_ARG: name is empty');
      const before = new Set(ctx.servers.map((s) => s.id));
      ctx.addServer(name);
      ctx.setTab('staff');
      await ctx.rendered();
      const added = get().servers.find((s) => !before.has(s.id) && s.name === name);
      if (!added) throw NOT_SAVED('the waiter');
      return { id: added.id, name: added.name, staff: get().servers.map((s) => s.name) };
    },

    setSettings: async (args: Record<string, unknown>) => {
      const ctx = get();
      const patch: Partial<Settings> = {};
      if (args.restaurantName !== undefined) {
        if (!str(args.restaurantName)) throw new Error('BAD_ARG: restaurantName is empty');
        patch.restaurantName = str(args.restaurantName);
      }
      if (typeof args.loyaltyEnabled === 'boolean') patch.loyaltyEnabled = args.loyaltyEnabled;
      if (Object.keys(patch).length === 0) throw new Error('NOTHING_TO_CHANGE: pass restaurantName or loyaltyEnabled');
      ctx.updateSettings(patch);
      ctx.setTab('settings');
      await ctx.rendered();
      const after = get().settings;
      if ((patch.restaurantName !== undefined && after.restaurantName !== patch.restaurantName)
        || (patch.loyaltyEnabled !== undefined && after.loyaltyEnabled !== patch.loyaltyEnabled)) {
        throw NOT_SAVED('the settings');
      }
      return { restaurantName: after.restaurantName, loyaltyEnabled: after.loyaltyEnabled };
    },

    showCopilot: async (args: Record<string, unknown>) => {
      const ctx = get();
      if (typeof args.open !== 'boolean') throw new Error('BAD_ARG: open is true or false');
      ctx.setCopilot(args.open);
      await ctx.rendered();
      return { copilotOpen: get().copilotOpen };
    },

    closeView: async () => {
      const ctx = get();
      // The invoice on top first; else what is selected. A confirmation stays open: it is the person's to answer.
      const closed: string[] = [];
      if (ctx.invoiceOpen) {
        ctx.closeInvoice();
        closed.push('invoice');
      } else {
        if (ctx.selectedTableId) { ctx.selectTable(null); closed.push('table'); }
        if (ctx.selectedClientId) { ctx.selectClient(null); closed.push('client'); }
      }
      await ctx.rendered();
      return closed.length ? { closed } : { closed, note: 'nothing was open' };
    },
    // agent-actions:end
  };
}
