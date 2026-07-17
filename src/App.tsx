import { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  LayoutDashboard,
  MapPin,
  Package,
  Printer,
  Receipt,
  Settings as SettingsIcon,
  UserCheck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { MnemoCartridgeSDK } from './sdk/mnemo-sdk';
import { translate, useI18n, LANGUAGES } from './i18n';
import type { Client, Combo, Ingredient, Invoice, MenuItem, Message, PaymentMethod, Server, Settings, Table, TableShape, TabId } from './types';
import {
  DEFAULT_SETTINGS,
  buildBackup,
  clearAllData,
  loadClients,
  loadCombos,
  loadIngredients,
  loadInvoices,
  loadMenu,
  loadServers,
  loadSettings,
  loadTables,
  parseBackup,
  save,
  SERVER_COLORS,
} from './store';
import { buildDemoData } from './demoData';
import { canRedeem, earnedPoints, tierFor } from './loyalty';
import { cartFromTable, comboKey, comboLinesFromTable, computeBill, expandDishLines } from './billing';
import { ConfirmDialog, type ConfirmRequest } from './components/ConfirmDialog';
import { MnemoRestoLogo } from './components/Logo';
import { Staff } from './components/Staff';
import { Dashboard } from './components/Dashboard';
import { FloorPlan } from './components/FloorPlan';
import { Crm } from './components/Crm';
import { MenuManager } from './components/MenuManager';
import { Inventory } from './components/Inventory';
import { Pos } from './components/Pos';
import { InvoicesView } from './components/InvoicesView';
import { SettingsPage } from './components/SettingsPage';
import { AiCopilot } from './components/AiCopilot';
import { InvoiceModal } from './components/InvoiceModal';
import './RestaurantManager.css';

// Initialize the SDK with the unique cartridge ID
const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-resto');

/** Stable DJB2 hash — keys the per-vault idempotency map for client sync. */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function newId(prefix: string): string {
  return prefix + Math.random().toString(36).substring(7);
}

export default function App() {
  const { t, lang } = useI18n();

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [showAICopilot, setShowAICopilot] = useState(true);

  // Persistent state, hydrated once from localStorage (with legacy migration).
  const [tables, setTables] = useState<Table[]>(loadTables);
  const [clients, setClients] = useState<Client[]>(loadClients);
  const [ingredients, setIngredients] = useState<Ingredient[]>(loadIngredients);
  const [menu, setMenu] = useState<MenuItem[]>(loadMenu);
  const [combos, setCombos] = useState<Combo[]>(loadCombos);
  const [servers, setServers] = useState<Server[]>(loadServers);
  const [invoices, setInvoices] = useState<Invoice[]>(loadInvoices);
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const [hostRestricted, setHostRestricted] = useState(false);
  // Name of this app's walled-off sandbox vault (`APP-RESTAURANT-MANAGER`).
  const [sandboxVault, setSandboxVault] = useState<string>('');

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);

  // AI Assistant chat state
  const [chatMessages, setChatMessages] = useState<Message[]>(() => [
    { role: 'assistant', content: translate('ai.greeting') },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // localStorage synchronization
  useEffect(() => { save('tables', tables); }, [tables]);
  useEffect(() => { save('clients', clients); }, [clients]);
  useEffect(() => { save('ingredients', ingredients); }, [ingredients]);
  useEffect(() => { save('menu', menu); }, [menu]);
  useEffect(() => { save('combos', combos); }, [combos]);
  useEffect(() => { save('servers', servers); }, [servers]);
  useEffect(() => { save('invoices', invoices); }, [invoices]);
  useEffect(() => { save('settings', settings); }, [settings]);

  const askConfirm = (message: string, onConfirm: () => void, danger = false) => {
    setConfirmRequest({ message, onConfirm, danger });
  };

  // Fetch host model info on load
  useEffect(() => {
    sdk.getModelConfig()
      .then((cfg) => {
        console.log('Host model configuration:', cfg);
      })
      .catch((err) => {
        console.warn('Host SDK model.getConfig not available or failed:', err);
        setHostRestricted(true);
      });
  }, []);

  // ── App sandbox vault (doc 58) ────────────────────────────────────────────
  // Ensure the walled-off `APP-RESTAURANT-MANAGER` vault and declare its tile.
  // The client roster (who dines here, their allergies & preferences) is the
  // memory-worthy layer — tables/stock/invoices stay operational and local.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = await sdk.ensureSandbox();
        if (cancelled || !sb?.vault) return;
        setSandboxVault(sb.vault);
        await sdk.describeVaultTile({
          icon: '🛎️',
          metrics: [
            { label: translate('nav.crm'), spine: 'SOCIAL_CONTACT' },
            { label: translate('crm.prefsNotes'), spine: 'SOCIAL_NODE' },
          ],
        });
      } catch (err) {
        console.warn('[RestaurantManager] sandbox vault ensure failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Client sync — one SOCIAL_CONTACT chronicle per client (the roster) plus one
  // SOCIAL_NODE per client carrying allergies/preferences so Mnemosyne can
  // recall dietary needs and tastes. Idempotent via a per-vault hash map;
  // re-fires on every add/edit and on visit/loyalty changes at checkout.
  useEffect(() => {
    if (!sandboxVault.startsWith('APP-') || clients.length === 0) return;
    let cancelled = false;
    (async () => {
      const key = `restaurant_synced_v1:${sandboxVault}`;
      let synced: Record<string, string> = {};
      try { synced = JSON.parse(localStorage.getItem(key) || '{}'); } catch { synced = {}; }
      let pushed = 0;
      for (const c of clients) {
        const profileParts = [`Client: ${c.name}.`];
        if (c.phone) profileParts.push(`Phone: ${c.phone}.`);
        if (c.email) profileParts.push(`Email: ${c.email}.`);
        if (c.favTable) profileParts.push(`Favourite table: ${c.favTable}.`);
        profileParts.push(`Visits: ${c.visits ?? 0}.`);
        profileParts.push(`Loyalty tier: ${tierFor(c.lifetimePoints).id} (${c.lifetimePoints} lifetime pts).`);
        const profile = profileParts.join(' ');

        const prefs: string[] = [];
        if (c.allergies?.length) prefs.push(`Allergies: ${c.allergies.join(', ')}.`);
        if (c.preferences?.trim()) prefs.push(`Preferences: ${c.preferences.trim()}.`);
        const prefNote = prefs.length ? `Client ${c.name} — ${prefs.join(' ')}` : '';

        const h = hashString(profile + '::' + prefNote);
        if (synced[c.id] === h) continue;
        try {
          await sdk.socialIngest(sandboxVault, profile, 'SOCIAL_CONTACT');
          if (prefNote) await sdk.socialIngest(sandboxVault, prefNote, 'SOCIAL_NODE');
          if (cancelled) return;
          synced[c.id] = h;
          pushed++;
        } catch (err) {
          console.warn(`[RestaurantManager] client sync failed for "${c.name}"`, err);
        }
      }
      if (pushed > 0 && !cancelled) {
        localStorage.setItem(key, JSON.stringify(synced));
        console.log(`[RestaurantManager] ${pushed} client(s) anchored into ${sandboxVault}`);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sandboxVault, clients]);

  const activeTable = useMemo(() => tables.find((tb) => tb.id === selectedTableId) || null, [tables, selectedTableId]);

  // ── FLOOR PLAN ACTIONS ──────────────────────────────────────────────────
  const addNewTable = (shape: TableShape) => {
    const id = newId('t_');
    const newTable: Table = {
      id,
      name: t('floor.newTableName', { num: tables.length + 1 }),
      shape,
      capacity: shape === 'rectangle' ? 6 : 4,
      x: 150,
      y: 150,
      width: shape === 'rectangle' ? 140 : 90,
      height: 90,
      status: 'vacant',
    };
    setTables((prev) => [...prev, newTable]);
    setSelectedTableId(id);
  };

  const deleteTable = (id: string) => {
    setTables((prev) => prev.filter((tb) => tb.id !== id));
    setSelectedTableId(null);
  };

  // ── CRM ACTIONS ─────────────────────────────────────────────────────────
  const saveClient = (form: Partial<Client>, editingId: string | null) => {
    if (editingId) {
      setClients((prev) => prev.map((c) => (c.id === editingId ? ({ ...c, ...form } as Client) : c)));
    } else {
      const newClient: Client = {
        id: newId('c_'),
        name: form.name || '',
        phone: form.phone || '',
        email: form.email || '',
        allergies: form.allergies || [],
        preferences: form.preferences || '',
        favTable: form.favTable || '',
        visits: 0,
        loyaltyPoints: 0,
        lifetimePoints: 0,
      };
      setClients((prev) => [...prev, newClient]);
      setSelectedClientId(newClient.id);
    }
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    setSelectedClientId(null);
  };

  // ── MENU ACTIONS ────────────────────────────────────────────────────────
  const saveMenuItem = (item: Omit<MenuItem, 'id'>, editingId: string | null) => {
    if (editingId) {
      setMenu((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...item } : m)));
    } else {
      setMenu((prev) => [...prev, { ...item, id: newId('m_') }]);
    }
  };

  const deleteMenuItem = (id: string) => {
    setMenu((prev) => prev.filter((m) => m.id !== id));
    // Drop the dish everywhere it is referenced so nothing points at ghosts:
    // open orders, set-menu options, and ordered set menus that picked it.
    setCombos((prev) =>
      prev.map((combo) => ({
        ...combo,
        courses: combo.courses.map((course) => ({
          ...course,
          optionIds: course.optionIds.filter((optionId) => optionId !== id),
        })),
      }))
    );
    setTables((prev) =>
      prev.map((tb) => ({
        ...tb,
        activeOrder: tb.activeOrder?.filter((line) => line.itemId !== id),
        comboOrder: tb.comboOrder?.filter((line) => !line.picks.includes(id)),
      }))
    );
  };

  // ── SET MENU ("formule") ACTIONS ────────────────────────────────────────
  const saveCombo = (combo: Omit<Combo, 'id'>, editingId: string | null) => {
    if (editingId) {
      setCombos((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...combo } : c)));
    } else {
      setCombos((prev) => [...prev, { ...combo, id: newId('f_') }]);
    }
  };

  const deleteCombo = (id: string) => {
    setCombos((prev) => prev.filter((c) => c.id !== id));
    setTables((prev) =>
      prev.map((tb) => ({ ...tb, comboOrder: tb.comboOrder?.filter((line) => line.comboId !== id) }))
    );
  };

  // ── STAFF ACTIONS ───────────────────────────────────────────────────────
  const addServer = (name: string) => {
    setServers((prev) => [
      ...prev,
      { id: newId('s_'), name, color: SERVER_COLORS[prev.length % SERVER_COLORS.length] },
    ]);
  };

  const deleteServer = (id: string) => {
    // Past invoices keep the serverName snapshot — only live assignments clear.
    setServers((prev) => prev.filter((s) => s.id !== id));
    setTables((prev) => prev.map((tb) => (tb.serverId === id ? { ...tb, serverId: undefined } : tb)));
  };

  // ── INVENTORY ACTIONS ───────────────────────────────────────────────────
  const saveStockEntry = (entry: { name: string; quantity: number; unit: string; minThreshold: number }) => {
    const existing = ingredients.find((i) => i.name.toLowerCase() === entry.name.toLowerCase());
    if (existing) {
      setIngredients((prev) =>
        prev.map((i) =>
          i.id === existing.id
            ? {
                ...i,
                quantity: Math.max(0, i.quantity + entry.quantity),
                minThreshold: entry.minThreshold || i.minThreshold,
              }
            : i
        )
      );
    } else {
      setIngredients((prev) => [
        ...prev,
        { id: newId('i_'), name: entry.name, quantity: Math.max(0, entry.quantity), unit: entry.unit, minThreshold: entry.minThreshold },
      ]);
    }
  };

  const adjustStock = (id: string, amount: number) => {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + amount) } : i)));
  };

  const deleteIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  // ── POS / CHECKOUT ──────────────────────────────────────────────────────
  const addToCart = (menuItemId: string) => {
    if (!selectedTableId) return;
    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id !== selectedTableId) return tb;
        const currentOrder = tb.activeOrder || [];
        const existing = currentOrder.find((line) => line.itemId === menuItemId);
        const newOrder = existing
          ? currentOrder.map((line) => (line.itemId === menuItemId ? { ...line, qty: line.qty + 1 } : line))
          : [...currentOrder, { itemId: menuItemId, qty: 1 }];
        return {
          ...tb,
          activeOrder: newOrder,
          status: tb.status === 'vacant' || tb.status === 'reserved' ? 'occupied' : tb.status,
        };
      })
    );
  };

  const updateCartQty = (menuItemId: string, amount: number) => {
    if (!selectedTableId) return;
    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id !== selectedTableId || !tb.activeOrder) return tb;
        const newOrder = tb.activeOrder
          .map((line) => (line.itemId === menuItemId ? { ...line, qty: Math.max(0, line.qty + amount) } : line))
          .filter((line) => line.qty > 0);
        return { ...tb, activeOrder: newOrder.length > 0 ? newOrder : undefined };
      })
    );
  };

  const addComboToCart = (comboId: string, picks: string[]) => {
    if (!selectedTableId) return;
    const key = comboKey(comboId, picks);
    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id !== selectedTableId) return tb;
        const currentOrder = tb.comboOrder || [];
        const existing = currentOrder.find((line) => comboKey(line.comboId, line.picks) === key);
        const newOrder = existing
          ? currentOrder.map((line) =>
              comboKey(line.comboId, line.picks) === key ? { ...line, qty: line.qty + 1 } : line
            )
          : [...currentOrder, { comboId, picks, qty: 1 }];
        return {
          ...tb,
          comboOrder: newOrder,
          status: tb.status === 'vacant' || tb.status === 'reserved' ? 'occupied' : tb.status,
        };
      })
    );
  };

  const updateComboQty = (picksKey: string, amount: number) => {
    if (!selectedTableId) return;
    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id !== selectedTableId || !tb.comboOrder) return tb;
        const newOrder = tb.comboOrder
          .map((line) =>
            comboKey(line.comboId, line.picks) === picksKey
              ? { ...line, qty: Math.max(0, line.qty + amount) }
              : line
          )
          .filter((line) => line.qty > 0);
        return { ...tb, comboOrder: newOrder.length > 0 ? newOrder : undefined };
      })
    );
  };

  const finalizeCheckout = (paymentMethod: PaymentMethod, redeem: boolean, tip: number) => {
    if (!activeTable) return;
    const cart = cartFromTable(activeTable, menu);
    const comboLines = comboLinesFromTable(activeTable, combos, menu);
    if (cart.length === 0 && comboLines.length === 0) return;

    const client = clients.find((c) => c.id === activeTable.clientId);
    const server = servers.find((s) => s.id === activeTable.serverId);
    const effectiveRedeem = redeem && !!client && canRedeem(client.loyaltyPoints, settings);
    const bill = computeBill(cart, comboLines, settings, effectiveRedeem);
    const safeTip = isFinite(tip) && tip > 0 ? Math.round(tip * 100) / 100 : 0;
    // Loyalty accrues on the house revenue — the tip goes to the server.
    const earned = client ? earnedPoints(bill.total, settings) : 0;

    // Deduct recipe ingredients from stock — à la carte AND combo picks.
    const kitchenLines = expandDishLines(activeTable, menu, combos);
    setIngredients((prev) => {
      const next = prev.map((i) => ({ ...i }));
      kitchenLines.forEach((line) => {
        line.menuItem.ingredients.forEach((recipeIng) => {
          const match = next.find((i) => i.id === recipeIng.ingredientId);
          if (match) match.quantity = Math.max(0, match.quantity - recipeIng.quantity * line.qty);
        });
      });
      return next;
    });

    const now = new Date();
    const newInvoice: Invoice = {
      id: newId('inv_'),
      date: now.toLocaleString(),
      dateISO: now.toISOString(),
      tableName: activeTable.name,
      clientName: client?.name || t('pos.walkIn'),
      items: [
        ...cart.map((line) => ({ name: line.menuItem.name, price: line.menuItem.price, qty: line.qty })),
        ...comboLines.map((line) => ({
          name: `${line.combo.name} (${line.picks.map((p) => p.name).join(', ')})`,
          price: line.combo.price,
          qty: line.qty,
        })),
      ],
      subtotal: bill.subtotal,
      tax: bill.tax,
      discount: bill.discount,
      total: bill.total + safeTip,
      paymentMethod,
      currency: settings.currency,
      vatRate: settings.vatRate,
      taxBreakdown: bill.taxBreakdown,
      loyaltyEarned: earned,
      loyaltyRedeemed: effectiveRedeem ? settings.redeemThreshold : 0,
      tip: safeTip,
      serverId: server?.id,
      serverName: server?.name,
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    // Update client metrics: visit count + loyalty movement.
    if (client) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === client.id
            ? {
                ...c,
                visits: c.visits + 1,
                loyaltyPoints: Math.max(0, c.loyaltyPoints + earned - (effectiveRedeem ? settings.redeemThreshold : 0)),
                lifetimePoints: c.lifetimePoints + earned,
              }
            : c
        )
      );
    }

    // Clean table state
    setTables((prev) =>
      prev.map((tb) =>
        tb.id === activeTable.id
          ? { ...tb, status: 'vacant', clientId: undefined, reservedAt: undefined, activeOrder: undefined, comboOrder: undefined }
          : tb
      )
    );

    setActiveInvoice(newInvoice);

    // Optional: sync the dining transaction into the host memory logs.
    sdk.invoke('conversation.save', {
      convId: `rest-bill-${newInvoice.id}`,
      title: `Invoice ${newInvoice.id} - ${newInvoice.tableName}`,
      messages: [
        { role: 'user', content: 'Record the table transaction.' },
        {
          role: 'assistant',
          content: `Invoice details: Client: ${newInvoice.clientName}, Total: ${newInvoice.total.toFixed(2)} ${settings.currency}, Method: ${newInvoice.paymentMethod}, Table: ${newInvoice.tableName}${server ? `, Server: ${server.name}` : ''}${safeTip > 0 ? `, Tip: ${safeTip.toFixed(2)} ${settings.currency}` : ''}, Loyalty: +${earned} pts${effectiveRedeem ? ` / -${settings.redeemThreshold} pts redeemed` : ''}, Items: ${JSON.stringify(newInvoice.items)}`,
        },
      ],
    }).catch((err) => console.warn('Could not save invoice in host memory:', err));
  };

  const checkoutTable = (paymentMethod: PaymentMethod, redeem: boolean, tip: number) => {
    if (!activeTable) return;
    const cart = expandDishLines(activeTable, menu, combos);
    if (cart.length === 0 && (activeTable.comboOrder?.length ?? 0) === 0) return;

    // Stock feasibility check before committing the sale.
    const missing: string[] = [];
    const simulated = ingredients.map((i) => ({ ...i }));
    cart.forEach((line) => {
      line.menuItem.ingredients.forEach((recipeIng) => {
        const match = simulated.find((i) => i.id === recipeIng.ingredientId);
        if (match) {
          const needed = recipeIng.quantity * line.qty;
          if (match.quantity < needed) {
            missing.push(`${match.name} (−${(needed - match.quantity).toFixed(2)} ${match.unit})`);
          } else {
            match.quantity -= needed;
          }
        }
      });
    });

    if (missing.length > 0) {
      askConfirm(t('pos.stockWarning', { list: missing.join(', ') }), () => finalizeCheckout(paymentMethod, redeem, tip), true);
      return;
    }
    finalizeCheckout(paymentMethod, redeem, tip);
  };

  // ── DATA MANAGEMENT (Settings) ──────────────────────────────────────────
  const loadDemo = () => {
    const demo = buildDemoData(lang);
    setTables(demo.tables);
    setClients(demo.clients);
    setIngredients(demo.ingredients);
    setMenu(demo.menu);
    setCombos(demo.combos);
    setServers(demo.servers);
    setInvoices(demo.invoices);
    setSelectedTableId(null);
    setSelectedClientId(null);
  };

  const wipeAll = () => {
    clearAllData();
    setTables([]);
    setClients([]);
    setIngredients([]);
    setMenu([]);
    setCombos([]);
    setServers([]);
    setInvoices([]);
    setSettings(DEFAULT_SETTINGS);
    setSelectedTableId(null);
    setSelectedClientId(null);
    setActiveInvoice(null);
  };

  const exportBackup = () => {
    const backup = buildBackup({ tables, clients, ingredients, menu, combos, servers, invoices, settings });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restaurant-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (raw: string): boolean => {
    const backup = parseBackup(raw);
    if (!backup) return false;
    setTables(backup.tables);
    setClients(backup.clients);
    setIngredients(backup.ingredients);
    setMenu(backup.menu);
    setCombos(backup.combos);
    setServers(backup.servers);
    setInvoices(backup.invoices);
    setSettings(backup.settings);
    setSelectedTableId(null);
    setSelectedClientId(null);
    return true;
  };

  // ── AI ASSISTANT / HOST INTEGRATION ─────────────────────────────────────
  const handleSendChat = async (presetPrompt?: string) => {
    const textToSend = presetPrompt || chatInput;
    if (!textToSend.trim() || sendingChat) return;

    setChatMessages((prev) => [...prev, { role: 'user', content: textToSend }]);
    setChatInput('');
    setSendingChat(true);

    // Live restaurant state, dumped in English for the model; the reply
    // language is pinned to the cartridge UI language.
    const lowStock = ingredients
      .filter((i) => i.quantity <= i.minThreshold)
      .map((i) => `${i.name} (${i.quantity} ${i.unit} left, threshold: ${i.minThreshold})`);
    const clientLines = clients.map((c) => {
      const tier = tierFor(c.lifetimePoints);
      return `- ${c.name}: allergies [${c.allergies.join(', ')}], preferences: ${c.preferences || 'none'}, visits: ${c.visits}, loyalty: ${tier.id} (${c.loyaltyPoints} pts)`;
    });
    const tableStates = tables.map(
      (tb) => `- ${tb.name} (capacity ${tb.capacity}): ${tb.status}${tb.clientId ? ` (client: ${clients.find((c) => c.id === tb.clientId)?.name})` : ''}`
    );
    const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);

    const systemPrompt = `You are the Mnemosyne OS management assistant embedded in the Restaurant cartridge.
Live state of the restaurant:
- Total recorded sales: ${totalSales.toFixed(2)} ${settings.currency} (${invoices.length} invoices)
- Tables:
${tableStates.join('\n') || '(none)'}
- Registered clients:
${clientLines.join('\n') || '(none)'}
- Ingredients at or below their alert threshold:
${lowStock.length > 0 ? lowStock.join('\n') : 'None (stock is healthy)'}
- Loyalty program: ${settings.loyaltyEnabled ? `enabled (${settings.earnRate} pt per ${settings.currency}, reward ${settings.redeemValue} ${settings.currency} per ${settings.redeemThreshold} pts)` : 'disabled'}

Give concise, professional answers focused on efficient restaurant management.
Format your answers in Markdown: use **bold** for names and key figures, and
put list items on their own line ("- item" or "1. item") — never inline.
Always answer in ${LANGUAGES[lang].label}.`;

    try {
      const response = await sdk.inferModel({ prompt: textToSend, systemPrompt, temperature: 0.7 });
      const responseText = response.text || response.response || t('ai.noResponse');
      setChatMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
    } catch (err) {
      console.error('Inference error:', err);
      const message = err instanceof Error ? err.message : t('ai.hostUnavailable');
      setChatMessages((prev) => [...prev, { role: 'assistant', content: t('ai.error', { message }) }]);
    } finally {
      setSendingChat(false);
    }
  };

  const navItems: { id: TabId; icon: React.ReactNode; label: string }[] = [
    { id: 'dashboard', icon: <LayoutDashboard size={16} />, label: t('nav.dashboard') },
    { id: 'floor', icon: <MapPin size={16} />, label: t('nav.floor') },
    { id: 'crm', icon: <Users size={16} />, label: t('nav.crm') },
    { id: 'staff', icon: <UserCheck size={16} />, label: t('nav.staff') },
    { id: 'menu', icon: <UtensilsCrossed size={16} />, label: t('nav.menu') },
    { id: 'inventory', icon: <Package size={16} />, label: t('nav.inventory') },
    { id: 'billing', icon: <Receipt size={16} />, label: t('nav.pos') },
    { id: 'invoices', icon: <Printer size={16} />, label: t('nav.invoices') },
    { id: 'settings', icon: <SettingsIcon size={16} />, label: t('nav.settings') },
  ];

  return (
    <div className="rest-container">
      {/* HEADER */}
      <header className="rest-header">
        <div className="rest-logo-group">
          <div className="rest-logo-badge"><MnemoRestoLogo size={26} /></div>
          <div>
            <h1 className="rest-title">{t('app.title')}</h1>
            <p className="rest-subtitle">{t('app.subtitle')}</p>
          </div>
        </div>

        <nav className="rest-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`rest-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <div className="rest-header-actions">
          <div className="rest-ai-badge">
            <span className="dot"></span>
            <span>{t('app.aiReady')}</span>
          </div>
          <button
            className="rest-nav-item"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => setShowAICopilot(!showAICopilot)}
          >
            <Brain size={16} color="#8b5cf6" /> {showAICopilot ? t('app.copilotHide') : t('app.copilotShow')}
          </button>
        </div>
      </header>

      {/* WORKSPACE */}
      <div className="rest-workspace">
        <div className="rest-content-pane rest-scrollable">
          {hostRestricted && (
            <div className="rest-host-warning">⚠️ {t('app.hostRestricted')}</div>
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              tables={tables}
              clients={clients}
              ingredients={ingredients}
              menu={menu}
              invoices={invoices}
              settings={settings}
              onLoadDemo={loadDemo}
              onGoTab={setActiveTab}
            />
          )}

          {activeTab === 'floor' && (
            <FloorPlan
              tables={tables}
              clients={clients}
              servers={servers}
              selectedTableId={selectedTableId}
              onSelectTable={setSelectedTableId}
              onUpdateTables={setTables}
              onAddTable={addNewTable}
              onDeleteTable={deleteTable}
              onManageOrder={() => setActiveTab('billing')}
              askConfirm={askConfirm}
            />
          )}

          {activeTab === 'crm' && (
            <Crm
              clients={clients}
              tables={tables}
              settings={settings}
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
              onSaveClient={saveClient}
              onDeleteClient={deleteClient}
              askConfirm={askConfirm}
            />
          )}

          {activeTab === 'staff' && (
            <Staff
              servers={servers}
              tables={tables}
              invoices={invoices}
              settings={settings}
              onAddServer={addServer}
              onDeleteServer={deleteServer}
              askConfirm={askConfirm}
            />
          )}

          {activeTab === 'menu' && (
            <MenuManager
              menu={menu}
              combos={combos}
              ingredients={ingredients}
              settings={settings}
              onSaveItem={saveMenuItem}
              onDeleteItem={deleteMenuItem}
              onSaveCombo={saveCombo}
              onDeleteCombo={deleteCombo}
              askConfirm={askConfirm}
            />
          )}

          {activeTab === 'inventory' && (
            <Inventory
              ingredients={ingredients}
              menu={menu}
              onSaveEntry={saveStockEntry}
              onAdjustStock={adjustStock}
              onDeleteIngredient={deleteIngredient}
              askConfirm={askConfirm}
            />
          )}

          {activeTab === 'billing' && (
            <Pos
              tables={tables}
              clients={clients}
              servers={servers}
              menu={menu}
              combos={combos}
              ingredients={ingredients}
              settings={settings}
              selectedTableId={selectedTableId}
              onSelectTable={setSelectedTableId}
              onAddToCart={addToCart}
              onAddCombo={addComboToCart}
              onUpdateCartQty={updateCartQty}
              onUpdateComboQty={updateComboQty}
              onCheckout={checkoutTable}
              onGoFloor={() => setActiveTab('floor')}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesView invoices={invoices} settings={settings} onOpenInvoice={setActiveInvoice} />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              settings={settings}
              sandboxVault={sandboxVault}
              onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
              onLoadDemo={loadDemo}
              onWipeAll={wipeAll}
              onExportBackup={exportBackup}
              onImportBackup={importBackup}
              askConfirm={askConfirm}
            />
          )}
        </div>

        {showAICopilot && (
          <AiCopilot
            messages={chatMessages}
            input={chatInput}
            sending={sendingChat}
            onInputChange={setChatInput}
            onSend={handleSendChat}
            onClose={() => setShowAICopilot(false)}
          />
        )}
      </div>

      <InvoiceModal invoice={activeInvoice} settings={settings} onClose={() => setActiveInvoice(null)} />
      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </div>
  );
}
