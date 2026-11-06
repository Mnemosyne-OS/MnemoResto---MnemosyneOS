/**
 * The agent's moves in MnemoResto (doc 149): reads of the room, writes through
 * the CRM and stock forms' own saves, each showing its tab, and every refusal
 * names what to call instead.
 *
 * MnemoResto installs no vitest yet: run with a sibling's, from this folder:
 *   ../mnemo-ember/node_modules/.bin/vitest run --root . --dir src
 */
import { describe, expect, it, vi } from 'vitest';
import { clientsLimit, findClient, restoAgentHandlers, searchClients, type RestoAgentContext } from './agent';
import type { Client, Ingredient, MenuItem, Server, Settings, Table } from './types';

const client = (id: string, name: string, over: Partial<Client> = {}): Client => ({
  id, name, phone: '', email: '', allergies: [], preferences: '', favTable: '', visits: 0, loyaltyPoints: 0, lifetimePoints: 0, ...over,
});
const table = (id: string, over: Partial<Table> = {}): Table => ({
  id, name: `Table ${id}`, shape: 'square', capacity: 4, x: 0, y: 0, width: 90, height: 90, status: 'vacant', ...over,
});

/** A context whose saves really change the lists, as App's setters do. */
function setup(over: Partial<RestoAgentContext> = {}) {
  let clients: Client[] = [client('c1', 'Zoé Petit', { allergies: ['peanuts'] }), client('c2', 'Ana'), client('c3', 'Ana')];
  let ingredients: Ingredient[] = [{ id: 'i1', name: 'Flour', quantity: 1, unit: 'kg', minThreshold: 2 }, { id: 'i2', name: 'Salt', quantity: 2, unit: 'kg', minThreshold: 2 }, { id: 'i3', name: 'Oil', quantity: 5, unit: 'L', minThreshold: 2 }];
  let tables: Table[] = [
    table('1', { status: 'occupied', clientId: 'c1', serverId: 's1', activeOrder: [{ itemId: 'm1', qty: 2 }] }),
    table('2', { status: 'reserved', reservedAt: '2026-10-12T20:00' }),
    table('10'),
    table('3', { status: 'billed' }),
  ];
  let menu: MenuItem[] = [
    { id: 'm1', name: 'Soup', category: 'Starter', price: 7, ingredients: [{ ingredientId: 'i1', quantity: 0.2 }] },
    { id: 'm2', name: 'Fish soup', category: 'Starter', price: 9, vatRate: 10, ingredients: [] },
    { id: 'm3', name: 'Tiramisu', category: 'Dessert', price: 6, ingredients: [] },
  ];
  let servers: Server[] = [{ id: 's1', name: 'Max', color: '#000' }, { id: 's2', name: 'Léa', color: '#111' }];
  let settings: Settings = { restaurantName: 'Chez Zoé', currency: 'EUR', vatRate: 10, loyaltyEnabled: true, earnRate: 1, redeemThreshold: 100, redeemValue: 10 };
  const ctx: RestoAgentContext = {
    get tables() { return tables; },
    get clients() { return clients; },
    get menu() { return menu; },
    get ingredients() { return ingredients; },
    get servers() { return servers; },
    get settings() { return settings; },
    currency: 'EUR',
    activeTab: 'dashboard',
    setTab: vi.fn(),
    saveClient: vi.fn((form: Partial<Client>, editingId: string | null) => {
      if (editingId) { clients = clients.map((c) => (c.id === editingId ? { ...c, ...form } : c)); return editingId; }
      clients = [...clients, client('c9', form.name ?? '', form)];
      return 'c9';
    }),
    saveStockEntry: vi.fn((e) => {
      const ex = ingredients.find((i) => i.name.toLowerCase() === e.name.toLowerCase());
      ingredients = ex
        ? ingredients.map((i) => (i === ex ? { ...i, quantity: Math.max(0, i.quantity + e.quantity), minThreshold: e.minThreshold || i.minThreshold } : i))
        : [...ingredients, { id: 'i9', name: e.name, quantity: Math.max(0, e.quantity), unit: e.unit, minThreshold: e.minThreshold }];
    }),
    showClient: vi.fn(),
    saveMenuItem: vi.fn((item: Omit<MenuItem, 'id'>, id: string | null) => { menu = menu.map((m) => (m.id === id ? { ...m, ...item } : m)); }),
    updateTables: vi.fn((f: (prev: Table[]) => Table[]) => { tables = f(tables); }),
    selectTable: vi.fn(),
    selectClient: vi.fn(),
    addServer: vi.fn((name: string) => { servers = [...servers, { id: 's9', name, color: '#222' }]; }),
    updateSettings: vi.fn((patch: Partial<Settings>) => { settings = { ...settings, ...patch }; }),
    selectedTableId: null,
    selectedClientId: null,
    invoiceOpen: false,
    closeInvoice: vi.fn(),
    copilotOpen: true,
    setCopilot: vi.fn(),
    rendered: vi.fn(async () => undefined),
    ...over,
  };
  return { ctx, h: restoAgentHandlers(() => ctx) };
}

describe('what an agent reads', () => {
  it('tables names guests, waiters and dishes, never raw ids', () => {
    const [t1, t2] = setup().h.tables();
    expect(t1).toMatchObject({ status: 'occupied', client: 'Zoé Petit', server: 'Max', order: [{ dish: 'Soup', qty: 2 }] });
    expect(t2).toMatchObject({ status: 'reserved', reservedAt: '2026-10-12T20:00' });
  });

  it('clients searches every word, accents ignored, and clamps its limit', () => {
    const { h } = setup();
    expect(h.clients({ query: 'zoe peanuts' }).clients.map((c) => c.id)).toEqual(['c1']);
    expect(h.clients({ query: 'ana peanuts' }).clients).toEqual([]);
    expect(h.clients({ limit: -1 }).clients).toHaveLength(1);
    expect(clientsLimit(-1)).toBe(1);
    expect(clientsLimit(5000)).toBe(500);
    expect(searchClients([client('x', 'X')], '  ')).toHaveLength(1);
  });

  it('stock flags what is at or below its threshold, as the stock tab does', () => {
    expect(setup().h.stock()).toMatchObject({ low: ['Flour', 'Salt'] });
  });

  it('a name naming two clients is AMBIGUOUS, never the first', () => {
    expect(() => findClient(setup().ctx.clients, 'Ana')).toThrow('AMBIGUOUS: "Ana" names several clients: Ana (c2), Ana (c3); say which');
    expect(() => findClient(setup().ctx.clients, 'Bob')).toThrow('NO_CLIENT: no client named "Bob"; clients: Zoé Petit, Ana (c2), Ana (c3)');
    expect(findClient(setup().ctx.clients, 'zoe petit').id).toBe('c1');
    // A part of the name, as the person says it; the label of a repair call finds one.
    expect(findClient(setup().ctx.clients, 'Petit').id).toBe('c1');
    expect(findClient(setup().ctx.clients, 'Ana (c3)').id).toBe('c3');
  });
});

describe('what an agent changes', () => {
  it('openTab shows a header tab, and refuses one that does not exist', () => {
    const { ctx, h } = setup();
    expect(h.openTab({ tab: 'inventory' })).toEqual({ tab: 'inventory' });
    expect(ctx.setTab).toHaveBeenCalledWith('inventory');
    expect(() => h.openTab({ tab: 'kitchen' })).toThrow(/^BAD_ARG/);
  });

  it('addClient goes through the CRM form\'s save and shows the Clients tab', async () => {
    const { ctx, h } = setup();
    expect(await h.addClient({ name: 'Nina', allergies: ['gluten', 'gluten', ' '], preferences: 'window seat' })).toEqual({ clientId: 'c9' });
    expect(ctx.saveClient).toHaveBeenCalledWith({ name: 'Nina', allergies: ['gluten'], preferences: 'window seat' }, null);
    expect(ctx.setTab).toHaveBeenCalledWith('crm');
    await expect(h.addClient({ name: ' ' })).rejects.toThrow(/^BAD_ARG/);
  });

  it('a client that did not land is said, never reported added', async () => {
    const { h } = setup({ saveClient: () => 'ghost' });
    await expect(h.addClient({ name: 'Nina' })).rejects.toThrow(/^WRITE_FAILED/);
  });

  it('updateClient changes only what is passed, and shows the card', async () => {
    const { ctx, h } = setup();
    expect(await h.updateClient({ clientId: 'c1', phone: '0600' })).toMatchObject({ phone: '0600', allergies: ['peanuts'] });
    expect(ctx.saveClient).toHaveBeenCalledWith({ phone: '0600' }, 'c1');
    expect(ctx.showClient).toHaveBeenCalledWith('c1');
    await expect(h.updateClient({ clientId: 'c1' })).rejects.toThrow(/^NOTHING_TO_CHANGE/);
  });

  it('restock adds to an ingredient of the same name, any case, with its own unit', async () => {
    const { ctx, h } = setup();
    expect(await h.restock({ name: 'flour', quantity: 5 })).toEqual({ name: 'Flour', quantity: 6, unit: 'kg', low: false });
    expect(ctx.saveStockEntry).toHaveBeenCalledWith({ name: 'Flour', quantity: 5, unit: 'kg', minThreshold: 0 });
    expect(ctx.setTab).toHaveBeenCalledWith('inventory');
    // The unit of an ingredient that exists is the one it has, never a new one.
    expect(await h.restock({ name: 'Flour', quantity: 1, unit: 'g' })).toMatchObject({ unit: 'kg', quantity: 7 });
  });

  it('a new ingredient needs its unit, and a zero or missing quantity is refused', async () => {
    const { ctx, h } = setup();
    await expect(h.restock({ name: 'Basil', quantity: 2 })).rejects.toThrow(/^BAD_ARG.*unit/);
    await expect(h.restock({ name: 'Flour', quantity: 0 })).rejects.toThrow(/^BAD_ARG/);
    await expect(h.restock({ name: 'Flour' })).rejects.toThrow(/^BAD_ARG/);
    expect(ctx.saveStockEntry).not.toHaveBeenCalled();
    expect(await h.restock({ name: 'Basil', quantity: 2, unit: 'bunch', minThreshold: -3 })).toMatchObject({ name: 'Basil', unit: 'bunch' });
    expect(ctx.saveStockEntry).toHaveBeenLastCalledWith({ name: 'Basil', quantity: 2, unit: 'bunch', minThreshold: 0 });
    // No threshold given: a new ingredient gets the form's default, so it can read as low.
    expect(await h.restock({ name: 'Thyme', quantity: 1, unit: 'bunch' })).toMatchObject({ low: true });
    expect(ctx.saveStockEntry).toHaveBeenLastCalledWith({ name: 'Thyme', quantity: 1, unit: 'bunch', minThreshold: 2 });
  });
});

describe('what the voice reaches by the words a person says', () => {
  it('restock finds the one ingredient its words name, refuses several, and a stranger is new', async () => {
    const { ctx, h } = setup();
    const ctx2 = { ...ctx, ingredients: [{ id: 'i4', name: 'Olive oil', quantity: 1, unit: 'L', minThreshold: 1 }, { id: 'i5', name: 'Sunflower oil', quantity: 1, unit: 'L', minThreshold: 1 }] };
    const h2 = restoAgentHandlers(() => ctx2);
    await expect(h2.restock({ name: 'oils', quantity: 1 })).rejects.toThrow('AMBIGUOUS: "oils" names several ingredients: Olive oil, Sunflower oil');
    expect(ctx.saveStockEntry).not.toHaveBeenCalled();
    // A whole name said wins over the ingredients that hold the word.
    expect(await h.restock({ name: 'oils', quantity: 1 })).toMatchObject({ name: 'Oil', quantity: 6 });
    expect(await h.restock({ name: 'the flour', quantity: 1 })).toMatchObject({ name: 'Flour', quantity: 2 });
    expect(ctx.saveStockEntry).toHaveBeenLastCalledWith({ name: 'Flour', quantity: 1, unit: 'kg', minThreshold: 0 });
  });

  it('showTable selects the table on the floor plan by its spoken name, never Table 10 for Table 1', async () => {
    const { ctx, h } = setup();
    expect(await h.showTable({ table: 'la table une' })).toMatchObject({ id: '1', client: 'Zoé Petit', server: 'Max' });
    expect(ctx.selectTable).toHaveBeenCalledWith('1');
    expect(ctx.setTab).toHaveBeenCalledWith('floor');
    await expect(h.showTable({ table: 'table 7' })).rejects.toThrow('NO_TABLE: no table named "table 7"; tables: Table 1, Table 2, Table 10, Table 3');
  });

  it('setTable changes status, waiter and seats as the floor plan does, and keeps billed for the till', async () => {
    const { ctx, h } = setup();
    expect(await h.setTable({ table: 'table deux', status: 'vacant', server: 'lea', capacity: 6 })).toMatchObject({ status: 'vacant', server: 'Léa', capacity: 6 });
    // Leaving « reserved » drops the arrival time.
    expect(ctx.tables.find((tb) => tb.id === '2')?.reservedAt).toBeUndefined();
    await expect(h.setTable({ table: 'table 1', status: 'billed' })).rejects.toThrow(/^BAD_ARG/);
    await expect(h.setTable({ table: 'Table 3', status: 'vacant' })).rejects.toThrow(/^BILLED/);
    await expect(h.setTable({ table: '1' })).rejects.toThrow(/^NOTHING_TO_CHANGE/);
    await expect(h.setTable({ table: 'table 1', server: 'Bob' })).rejects.toThrow('NO_SERVER: no waiter named "Bob"; waiters: Max, Léa');
  });

  it('a table change that did not land is said, never reported done', async () => {
    const { h } = setup({ updateTables: vi.fn() });
    await expect(h.setTable({ table: 'table 1', status: 'vacant' })).rejects.toThrow(/^WRITE_FAILED/);
  });

  it('showDish answers the recipe with ingredient names and stock, on the menu tab', async () => {
    const { ctx, h } = setup();
    expect(await h.showDish({ dish: 'the soup' })).toMatchObject({ id: 'm1', price: 7, recipe: [{ ingredient: 'Flour', quantity: 0.2, unit: 'kg', inStock: 1 }] });
    expect(ctx.setTab).toHaveBeenCalledWith('menu');
    await expect(h.showDish({ dish: 'starter' })).rejects.toThrow('AMBIGUOUS: "starter" names several dishes: Soup, Fish soup; say which');
  });

  it('editDish saves the whole dish through the menu form, recipe and VAT kept', async () => {
    const { ctx, h } = setup();
    expect(await h.editDish({ dish: 'fish soup', price: 10.499 })).toMatchObject({ name: 'Fish soup', price: 10.5, vatRate: 10 });
    expect(ctx.saveMenuItem).toHaveBeenCalledWith({ name: 'Fish soup', category: 'Starter', price: 10.5, vatRate: 10, ingredients: [] }, 'm2');
    await expect(h.editDish({ dish: 'tiramisu', price: 6 })).rejects.toThrow(/^NOTHING_TO_CHANGE/);
    await expect(h.editDish({ dish: 'tiramisu', name: ' ' })).rejects.toThrow(/^BAD_ARG/);
    await expect(h.editDish({ dish: 'tiramisu', price: -1 })).rejects.toThrow(/^BAD_ARG/);
  });

  it('a dish that did not save is said, never reported changed', async () => {
    const { h } = setup({ saveMenuItem: vi.fn() });
    await expect(h.editDish({ dish: 'tiramisu', price: 8 })).rejects.toThrow(/^WRITE_FAILED/);
  });

  it('showClient opens the card by name, and refuses two of one name', async () => {
    const { ctx, h } = setup();
    expect(await h.showClient({ client: 'Petit' })).toMatchObject({ id: 'c1', allergies: ['peanuts'] });
    expect(ctx.showClient).toHaveBeenCalledWith('c1');
    await expect(h.showClient({ client: 'ana' })).rejects.toThrow(/^AMBIGUOUS/);
  });

  it('updateClient takes the client by the words of the name too', async () => {
    const { ctx, h } = setup();
    expect(await h.updateClient({ clientId: 'petit', phone: '0700' })).toMatchObject({ id: 'c1', phone: '0700' });
    expect(ctx.saveClient).toHaveBeenCalledWith({ phone: '0700' }, 'c1');
    await expect(h.updateClient({ clientId: 'Ana', phone: '1' })).rejects.toThrow(/^AMBIGUOUS/);
  });

  it('addServer goes through the staff form and answers once the waiter is there', async () => {
    const { ctx, h } = setup();
    expect(await h.addServer({ name: 'Nina' })).toEqual({ id: 's9', name: 'Nina', staff: ['Max', 'Léa', 'Nina'] });
    expect(ctx.setTab).toHaveBeenCalledWith('staff');
    const failing = setup({ addServer: vi.fn() });
    await expect(failing.h.addServer({ name: 'Nina' })).rejects.toThrow(/^WRITE_FAILED/);
  });

  it('setSettings changes the name and loyalty only, and says a refused save', async () => {
    const { ctx, h } = setup();
    expect(await h.setSettings({ loyaltyEnabled: false })).toEqual({ restaurantName: 'Chez Zoé', loyaltyEnabled: false });
    expect(ctx.updateSettings).toHaveBeenCalledWith({ loyaltyEnabled: false });
    await expect(h.setSettings({ vatRate: 20 })).rejects.toThrow(/^NOTHING_TO_CHANGE/);
    await expect(h.setSettings({ restaurantName: ' ' })).rejects.toThrow(/^BAD_ARG/);
    const failing = setup({ updateSettings: vi.fn() });
    await expect(failing.h.setSettings({ restaurantName: 'Chez Max' })).rejects.toThrow(/^WRITE_FAILED/);
  });

  it('showCopilot shows or hides the panel, nothing else', async () => {
    const { ctx, h } = setup();
    await h.showCopilot({ open: false });
    expect(ctx.setCopilot).toHaveBeenCalledWith(false);
    await expect(h.showCopilot({})).rejects.toThrow(/^BAD_ARG/);
  });

  it('closeView closes the invoice on top first, else the selection, and says when nothing was open', async () => {
    const withInvoice = setup({ invoiceOpen: true, selectedTableId: '1' });
    expect(await withInvoice.h.closeView()).toEqual({ closed: ['invoice'] });
    expect(withInvoice.ctx.selectTable).not.toHaveBeenCalled();
    const selected = setup({ selectedTableId: '1', selectedClientId: 'c1' });
    expect(await selected.h.closeView()).toEqual({ closed: ['table', 'client'] });
    expect(selected.ctx.selectTable).toHaveBeenCalledWith(null);
    expect(await setup().h.closeView()).toEqual({ closed: [], note: 'nothing was open' });
  });
});
