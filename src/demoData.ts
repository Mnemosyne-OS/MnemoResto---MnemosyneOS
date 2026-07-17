/**
 * Localized demo dataset, loaded on demand from Settings (or the first-run
 * dashboard CTA). Dish/ingredient/preference strings follow the active
 * language so the demo reads natively in EN/FR/ES.
 */
import type { Client, Combo, Ingredient, Invoice, MenuItem, PaymentMethod, Server, Table } from './types';
import type { LangCode } from './i18n';

interface DemoStrings {
  table: string;
  ingredients: [string, string, string, string, string, string, string, string, string, string];
  units: { pcs: string; kg: string; l: string; heads: string };
  dishes: [string, string, string, string, string, string, string, string, string, string, string, string, string];
  categories: {
    starters: string;
    mains: string;
    desserts: string;
    hotDrinks: string;
    coldDrinks: string;
    juices: string;
    alcohol: string;
  };
  combos: { lunch: string; full: string };
  clients: {
    prefs1: string;
    prefs2: string;
    prefs3: string;
    allergies1: [string, string];
    allergies2: [string];
  };
}

const STRINGS: Record<LangCode, DemoStrings> = {
  en: {
    table: 'Table',
    ingredients: [
      'Beef Steak', 'Fresh Pasta', 'Tomato Sauce', 'Burger Bun', 'Fresh Salmon',
      'Potatoes', 'Romaine Lettuce', 'Chicken Breast', 'Parmesan Cheese', 'Crème Fraîche',
    ],
    units: { pcs: 'pcs', kg: 'kg', l: 'L', heads: 'heads' },
    dishes: [
      'House Burger & Fries', 'Pasta Carbonara', 'Chicken Caesar Salad',
      'Roasted Salmon & Fries', 'Pasta Napolitana', 'Crème Brûlée',
      'Chocolate Mousse', 'Espresso', 'Green Tea', 'Cola', 'Fresh Orange Juice',
      'Glass of Red Wine', 'Draft Beer',
    ],
    categories: {
      starters: 'Starters', mains: 'Mains', desserts: 'Desserts',
      hotDrinks: 'Hot drinks', coldDrinks: 'Cold drinks', juices: 'Fruit juices', alcohol: 'Alcohol',
    },
    combos: { lunch: 'Lunch Set', full: 'Full Menu' },
    clients: {
      prefs1: 'Prefers sparkling water, does not like raw fish',
      prefs2: 'Vegetarian, prefers tables near the window',
      prefs3: 'Big red-wine drinker, likes his steak well done',
      allergies1: ['Nuts', 'Gluten'],
      allergies2: ['Peanuts'],
    },
  },
  fr: {
    table: 'Table',
    ingredients: [
      'Steak de Bœuf', 'Pâtes Fraîches', 'Sauce Tomate', 'Pain Burger', 'Saumon Frais',
      'Pommes de Terre', 'Salade Romaine', 'Blanc de Poulet', 'Fromage Parmesan', 'Crème Fraîche',
    ],
    units: { pcs: 'pcs', kg: 'kg', l: 'L', heads: 'têtes' },
    dishes: [
      'Burger Maison & Frites', 'Pâtes Carbonara', 'Salade César au Poulet',
      'Saumon Rôti & Frites', 'Pâtes Napolitaine', 'Crème Brûlée',
      'Mousse au Chocolat', 'Espresso', 'Thé Vert', 'Cola', "Jus d'Orange Pressé",
      'Verre de Vin Rouge', 'Bière Pression',
    ],
    categories: {
      starters: 'Entrées', mains: 'Plats', desserts: 'Desserts',
      hotDrinks: 'Boissons chaudes', coldDrinks: 'Boissons froides', juices: 'Jus de fruits', alcohol: 'Alcools',
    },
    combos: { lunch: 'Formule Midi', full: 'Menu Complet' },
    clients: {
      prefs1: "Préfère l'eau pétillante, n'aime pas le poisson cru",
      prefs2: 'Végétarienne, préfère les tables près de la fenêtre',
      prefs3: 'Gros buveur de vin rouge, aime le steak bien cuit',
      allergies1: ['Noix', 'Gluten'],
      allergies2: ['Arachides'],
    },
  },
  es: {
    table: 'Mesa',
    ingredients: [
      'Filete de Ternera', 'Pasta Fresca', 'Salsa de Tomate', 'Pan de Hamburguesa', 'Salmón Fresco',
      'Patatas', 'Lechuga Romana', 'Pechuga de Pollo', 'Queso Parmesano', 'Nata Fresca',
    ],
    units: { pcs: 'uds', kg: 'kg', l: 'L', heads: 'piezas' },
    dishes: [
      'Hamburguesa de la Casa con Patatas', 'Pasta Carbonara', 'Ensalada César con Pollo',
      'Salmón Asado con Patatas', 'Pasta Napolitana', 'Crème Brûlée',
      'Mousse de Chocolate', 'Espresso', 'Té Verde', 'Cola', 'Zumo de Naranja Natural',
      'Copa de Vino Tinto', 'Cerveza de Barril',
    ],
    categories: {
      starters: 'Entrantes', mains: 'Principales', desserts: 'Postres',
      hotDrinks: 'Bebidas calientes', coldDrinks: 'Bebidas frías', juices: 'Zumos', alcohol: 'Alcohol',
    },
    combos: { lunch: 'Menú del Mediodía', full: 'Menú Completo' },
    clients: {
      prefs1: 'Prefiere agua con gas, no le gusta el pescado crudo',
      prefs2: 'Vegetariana, prefiere las mesas junto a la ventana',
      prefs3: 'Gran bebedor de vino tinto, le gusta el filete muy hecho',
      allergies1: ['Frutos secos', 'Gluten'],
      allergies2: ['Cacahuetes'],
    },
  },
};

export interface DemoDataset {
  tables: Table[];
  clients: Client[];
  ingredients: Ingredient[];
  menu: MenuItem[];
  combos: Combo[];
  servers: Server[];
  invoices: Invoice[];
}

const DEMO_SERVERS: Server[] = [
  { id: 's1', name: 'Sophie', color: '#3b82f6' },
  { id: 's2', name: 'Karim', color: '#10b981' },
  { id: 's3', name: 'Léa', color: '#f59e0b' },
];

/**
 * A week of plausible sales so the dashboard chart, top dishes and invoice
 * filters have something to show right after loading the demo.
 */
function buildDemoInvoices(menu: MenuItem[], clients: Client[], tableName: (n: number) => string, vatRate: number): Invoice[] {
  const methods: PaymentMethod[] = ['Card', 'Cash', 'Mobile'];
  const invoices: Invoice[] = [];
  const now = new Date();

  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const count = 1 + ((daysAgo * 7) % 3); // 1–3 bills per day, deterministic
    for (let k = 0; k < count; k++) {
      const item1 = menu[(daysAgo + k) % menu.length];
      const item2 = menu[(daysAgo + k + 2) % menu.length];
      const items = [
        { name: item1.name, price: item1.price, qty: 1 + (k % 2) },
        { name: item2.name, price: item2.price, qty: 1 },
      ];
      const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
      const tax = subtotal * (vatRate / 100);
      const tip = (daysAgo + k) % 4 === 0 ? 0 : 1 + ((daysAgo + k) % 3); // 0–3, deterministic
      const server = DEMO_SERVERS[(daysAgo + k) % DEMO_SERVERS.length];
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12 + k * 4, 15);
      const client = (daysAgo + k) % 3 === 0 ? clients[(daysAgo + k) % clients.length] : undefined;
      invoices.push({
        id: `inv_demo${daysAgo}${k}`,
        date: date.toLocaleString(),
        dateISO: date.toISOString(),
        tableName: tableName(1 + ((daysAgo + k) % 7)),
        clientName: client?.name,
        items,
        subtotal,
        tax,
        discount: 0,
        total: subtotal + tax + tip,
        paymentMethod: methods[(daysAgo + k) % methods.length],
        vatRate,
        tip,
        serverId: server.id,
        serverName: server.name,
      });
    }
  }
  return invoices.reverse(); // newest first, like real checkout inserts
}

export function buildDemoData(lang: LangCode): DemoDataset {
  const s = STRINGS[lang];
  const tn = (n: number) => `${s.table} ${n}`;

  const tables: Table[] = [
    { id: 't1', name: tn(1), shape: 'circle', capacity: 2, x: 80, y: 80, width: 80, height: 80, status: 'vacant' },
    { id: 't2', name: tn(2), shape: 'square', capacity: 4, x: 250, y: 80, width: 90, height: 90, status: 'vacant' },
    // Reservation expected in 90 minutes so the countdown badge has something to show.
    { id: 't3', name: tn(3), shape: 'rectangle', capacity: 6, x: 450, y: 80, width: 140, height: 90, status: 'reserved', clientId: 'c2', serverId: 's2', reservedAt: new Date(Date.now() + 90 * 60_000).toISOString() },
    { id: 't4', name: tn(4), shape: 'circle', capacity: 2, x: 80, y: 250, width: 80, height: 80, status: 'occupied', clientId: 'c1', serverId: 's1', activeOrder: [{ itemId: 'm1', qty: 2 }, { itemId: 'm3', qty: 1 }] },
    { id: 't5', name: tn(5), shape: 'square', capacity: 4, x: 250, y: 250, width: 90, height: 90, status: 'vacant', serverId: 's1' },
    { id: 't6', name: tn(6), shape: 'circle', capacity: 4, x: 80, y: 420, width: 90, height: 90, status: 'vacant', serverId: 's3' },
    { id: 't7', name: tn(7), shape: 'rectangle', capacity: 8, x: 450, y: 420, width: 160, height: 90, status: 'vacant', serverId: 's3' },
  ];

  const clients: Client[] = [
    {
      id: 'c1', name: 'Jean Dupont', phone: '06 12 34 56 78', email: 'jean.dupont@email.com',
      allergies: [...s.clients.allergies1], preferences: s.clients.prefs1, favTable: tn(4),
      visits: 12, loyaltyPoints: 140, lifetimePoints: 540,
    },
    {
      id: 'c2', name: 'Marie Martin', phone: '07 98 76 54 32', email: 'marie.martin@email.com',
      allergies: [...s.clients.allergies2], preferences: s.clients.prefs2, favTable: tn(3),
      visits: 8, loyaltyPoints: 75, lifetimePoints: 310,
    },
    {
      id: 'c3', name: 'Pierre Leroi', phone: '06 11 22 33 44', email: 'pierre.leroi@email.com',
      allergies: [], preferences: s.clients.prefs3, favTable: tn(7),
      visits: 22, loyaltyPoints: 420, lifetimePoints: 1720,
    },
  ];

  const i = s.ingredients;
  const u = s.units;
  const ingredients: Ingredient[] = [
    { id: 'i1', name: i[0], quantity: 24, unit: u.pcs, minThreshold: 5 },
    { id: 'i2', name: i[1], quantity: 15, unit: u.kg, minThreshold: 3 },
    { id: 'i3', name: i[2], quantity: 8, unit: u.l, minThreshold: 2 },
    { id: 'i4', name: i[3], quantity: 40, unit: u.pcs, minThreshold: 10 },
    { id: 'i5', name: i[4], quantity: 12, unit: u.pcs, minThreshold: 4 },
    { id: 'i6', name: i[5], quantity: 50, unit: u.kg, minThreshold: 15 },
    { id: 'i7', name: i[6], quantity: 18, unit: u.heads, minThreshold: 5 },
    { id: 'i8', name: i[7], quantity: 20, unit: u.pcs, minThreshold: 6 },
    { id: 'i9', name: i[8], quantity: 5, unit: u.kg, minThreshold: 1 },
    { id: 'i10', name: i[9], quantity: 10, unit: u.l, minThreshold: 3 },
  ];

  const d = s.dishes;
  const c = s.categories;
  const menu: MenuItem[] = [
    { id: 'm1', name: d[0], category: c.mains, price: 16.5, ingredients: [{ ingredientId: 'i1', quantity: 1 }, { ingredientId: 'i4', quantity: 1 }, { ingredientId: 'i6', quantity: 0.35 }] },
    { id: 'm2', name: d[1], category: c.mains, price: 14.0, ingredients: [{ ingredientId: 'i2', quantity: 0.25 }, { ingredientId: 'i10', quantity: 0.1 }, { ingredientId: 'i9', quantity: 0.05 }] },
    { id: 'm3', name: d[2], category: c.starters, price: 12.5, ingredients: [{ ingredientId: 'i7', quantity: 0.5 }, { ingredientId: 'i8', quantity: 1 }, { ingredientId: 'i9', quantity: 0.03 }] },
    { id: 'm4', name: d[3], category: c.mains, price: 21.0, ingredients: [{ ingredientId: 'i5', quantity: 1 }, { ingredientId: 'i6', quantity: 0.35 }] },
    { id: 'm5', name: d[4], category: c.mains, price: 11.5, ingredients: [{ ingredientId: 'i2', quantity: 0.25 }, { ingredientId: 'i3', quantity: 0.15 }, { ingredientId: 'i9', quantity: 0.02 }] },
    { id: 'm6', name: d[5], category: c.desserts, price: 7.5, ingredients: [{ ingredientId: 'i10', quantity: 0.15 }] },
    { id: 'm7', name: d[6], category: c.desserts, price: 6.5, ingredients: [] },
    { id: 'm8', name: d[7], category: c.hotDrinks, price: 2.5, ingredients: [] },
    { id: 'm9', name: d[8], category: c.hotDrinks, price: 3.5, ingredients: [] },
    { id: 'm10', name: d[9], category: c.coldDrinks, price: 3.5, ingredients: [] },
    { id: 'm11', name: d[10], category: c.juices, price: 4.5, ingredients: [] },
    // Alcohol is taxed at the full rate (20%) — showcases per-dish VAT.
    { id: 'm12', name: d[11], category: c.alcohol, price: 5.5, vatRate: 20, ingredients: [] },
    { id: 'm13', name: d[12], category: c.alcohol, price: 6.0, vatRate: 20, ingredients: [] },
  ];

  // Two set menus, incl. multi-choice courses (à la carte: 29.00 / 44.00).
  const combos: Combo[] = [
    {
      id: 'f1',
      name: s.combos.lunch,
      price: 24.0,
      courses: [
        { id: 'f1c1', label: c.starters, optionIds: ['m3'] },
        { id: 'f1c2', label: c.mains, optionIds: ['m1', 'm2', 'm5'] },
      ],
    },
    {
      id: 'f2',
      name: s.combos.full,
      price: 32.0,
      courses: [
        { id: 'f2c1', label: c.starters, optionIds: ['m3'] },
        { id: 'f2c2', label: c.mains, optionIds: ['m1', 'm4'] },
        { id: 'f2c3', label: c.desserts, optionIds: ['m6', 'm7'] },
      ],
    },
  ];

  const invoices = buildDemoInvoices(menu, clients, tn, 10);

  return { tables, clients, ingredients, menu, combos, servers: DEMO_SERVERS.map((s) => ({ ...s })), invoices };
}
