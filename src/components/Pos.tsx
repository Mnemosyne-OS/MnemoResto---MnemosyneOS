import { useEffect, useMemo, useState } from 'react';
import { Gift, HandCoins, Receipt, Search } from 'lucide-react';
import { useI18n } from '../i18n';
import { fmtMoney } from '../format';
import { canRedeem, earnedPoints } from '../loyalty';
import { cartFromTable, comboLinesFromTable, computeBill } from '../billing';
import { servingsAvailable } from './MenuManager';
import { ComboPickDialog } from './ComboPickDialog';
import type { Client, Combo, Ingredient, MenuItem, PaymentMethod, Server, Settings, Table } from '../types';

type CategoryFilter = 'all' | 'combos' | string;

function tableOrderCount(table: Table): number {
  const dishes = table.activeOrder?.reduce((sum, line) => sum + line.qty, 0) ?? 0;
  const combos = table.comboOrder?.reduce((sum, line) => sum + line.qty, 0) ?? 0;
  return dishes + combos;
}

export function Pos({
  tables,
  clients,
  servers,
  menu,
  combos,
  ingredients,
  settings,
  selectedTableId,
  onSelectTable,
  onAddToCart,
  onAddCombo,
  onUpdateCartQty,
  onUpdateComboQty,
  onCheckout,
  onGoFloor,
}: {
  tables: Table[];
  clients: Client[];
  servers: Server[];
  menu: MenuItem[];
  combos: Combo[];
  ingredients: Ingredient[];
  settings: Settings;
  selectedTableId: string | null;
  onSelectTable: (id: string) => void;
  onAddToCart: (menuItemId: string) => void;
  onAddCombo: (comboId: string, picks: string[]) => void;
  onUpdateCartQty: (menuItemId: string, amount: number) => void;
  onUpdateComboQty: (picksKey: string, amount: number) => void;
  onCheckout: (paymentMethod: PaymentMethod, redeem: boolean, tip: number) => void;
  onGoFloor: () => void;
}) {
  const { t, lang } = useI18n();
  const [redeem, setRedeem] = useState(false);
  const [tip, setTip] = useState(0);
  const [catFilter, setCatFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [pendingCombo, setPendingCombo] = useState<Combo | null>(null);

  const activeTable = tables.find((tb) => tb.id === selectedTableId) || null;
  const client = activeTable?.clientId ? clients.find((c) => c.id === activeTable.clientId) : undefined;
  const server = activeTable?.serverId ? servers.find((s) => s.id === activeTable.serverId) : undefined;
  const cart = cartFromTable(activeTable, menu);
  const comboLines = comboLinesFromTable(activeTable, combos, menu);
  const cartEmpty = cart.length === 0 && comboLines.length === 0;

  const redeemAllowed = !!client && canRedeem(client.loyaltyPoints, settings);
  const effectiveRedeem = redeem && redeemAllowed;
  const bill = computeBill(cart, comboLines, settings, effectiveRedeem);
  const earnPreview = client ? earnedPoints(bill.total, settings) : 0;

  // A table/client switch invalidates the reward toggle and the tip draft.
  useEffect(() => {
    setRedeem(false);
    setTip(0);
  }, [selectedTableId, activeTable?.clientId]);

  const grandTotal = bill.total + tip;

  const money = (n: number) => fmtMoney(n, settings.currency, lang);

  const categories = useMemo(
    () => [...new Set(menu.map((m) => m.category))].sort((a, b) => a.localeCompare(b)),
    [menu]
  );

  const q = search.trim().toLowerCase();
  const visibleDishes =
    catFilter === 'combos'
      ? []
      : menu.filter(
          (item) =>
            (catFilter === 'all' || item.category === catFilter) &&
            (!q || item.name.toLowerCase().includes(q))
        );
  const visibleCombos =
    catFilter === 'all' || catFilter === 'combos'
      ? combos.filter((combo) => !q || combo.name.toLowerCase().includes(q))
      : [];

  const orderCombo = (combo: Combo) => {
    if (combo.courses.some((course) => course.optionIds.length > 1)) {
      setPendingCombo(combo);
    } else {
      onAddCombo(combo.id, combo.courses.map((course) => course.optionIds[0]).filter(Boolean));
    }
  };

  const sortedTables = [...tables].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const tableChips = (
    <div className="pos-table-chips">
      {sortedTables.map((tb) => {
        const count = tableOrderCount(tb);
        return (
          <button
            key={tb.id}
            className={`pos-table-chip chip-${tb.status} ${tb.id === selectedTableId ? 'active' : ''}`}
            onClick={() => onSelectTable(tb.id)}
          >
            {tb.name}
            {count > 0 && <span className="pos-chip-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );

  if (!activeTable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflow: 'hidden' }}>
        {tables.length > 0 && tableChips}
        <div className="pos-empty-state">
          <Receipt size={40} strokeWidth={1} />
          <p style={{ margin: 0, fontSize: '13px' }}>{t('pos.selectTableHint')}</p>
          <button className="rest-btn rest-btn-secondary" onClick={onGoFloor}>{t('pos.goToFloor')}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflow: 'hidden' }}>
      {tableChips}

      <div className="pos-layout">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
          <div className="flex-row-between">
            <h3 style={{ margin: 0 }}>
              {t('pos.checkoutFor', { table: activeTable.name })}{' '}
              <span className="pos-seats-hint">({t('pos.seats', { count: activeTable.capacity })})</span>
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {server && (
                <span className="pos-server-chip" style={{ borderColor: server.color }}>
                  <span className="staff-color-dot" style={{ backgroundColor: server.color }} />
                  {server.name}
                </span>
              )}
              {client && <span className="pos-client-chip">{t('pos.client', { name: client.name })}</span>}
            </div>
          </div>

          <div className="pos-filter-row">
            <div className="pos-cat-chips">
              <button
                className={`pos-cat-chip ${catFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCatFilter('all')}
              >
                {t('pos.allCategories')}
              </button>
              {combos.length > 0 && (
                <button
                  className={`pos-cat-chip pos-combo-chip ${catFilter === 'combos' ? 'active' : ''}`}
                  onClick={() => setCatFilter('combos')}
                >
                  ★ {t('pos.combos')}
                </button>
              )}
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`pos-cat-chip ${catFilter === cat ? 'active' : ''}`}
                  onClick={() => setCatFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="pos-search">
              <Search size={13} color="var(--text-secondary)" />
              <input
                className="rest-input rest-search-input"
                placeholder={t('pos.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="pos-menu-grid rest-scrollable">
            {visibleCombos.map((combo) => (
              <div key={combo.id} className="pos-menu-item pos-combo-card" onClick={() => orderCombo(combo)}>
                <span className="pos-combo-tag">★ {t('pos.combos')}</span>
                <span className="pos-menu-name">{combo.name}</span>
                <span className="pos-combo-courses">
                  {combo.courses.map((course) => course.label).join(' · ')}
                </span>
                <span className="pos-menu-price">{money(combo.price)}</span>
              </div>
            ))}
            {visibleDishes.map((item) => {
              const servings = servingsAvailable(item, ingredients);
              const isOut = servings === 0;
              return (
                <div
                  key={item.id}
                  className={`pos-menu-item ${isOut ? 'pos-menu-item-out' : ''}`}
                  onClick={() => onAddToCart(item.id)}
                >
                  <span className="pos-menu-cat">{item.category}</span>
                  <span className="pos-menu-name">{item.name}</span>
                  <span className="pos-menu-price">{money(item.price)}</span>
                  {isOut ? (
                    <span className="pos-stock-badge stock-danger">{t('pos.outOfStock')}</span>
                  ) : servings !== Infinity && servings <= 5 ? (
                    <span className="pos-stock-badge stock-warning">{t('pos.lowStockFor', { count: servings })}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pos-cart">
          <h3 style={{ margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            {t('pos.orderDetails')}
          </h3>
          <div className="cart-items-list rest-scrollable">
            {cartEmpty && <div className="pos-cart-empty">{t('pos.emptyCart')}</div>}
            {cart.map((line, index) => (
              <div key={index} className="cart-item">
                <div className="cart-item-info">
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{line.menuItem.name}</span>
                  <span style={{ fontSize: '11px', color: '#60a5fa' }}>{money(line.menuItem.price)}</span>
                  <div className="cart-item-qty">
                    <button className="rest-btn rest-btn-secondary cart-qty-btn" onClick={() => onUpdateCartQty(line.menuItem.id, -1)}>-</button>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{line.qty}</span>
                    <button className="rest-btn rest-btn-secondary cart-qty-btn" onClick={() => onUpdateCartQty(line.menuItem.id, 1)}>+</button>
                  </div>
                </div>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{money(line.menuItem.price * line.qty)}</span>
              </div>
            ))}
            {comboLines.map((line) => (
              <div key={line.picksKey} className="cart-item cart-combo-item">
                <div className="cart-item-info">
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>★ {line.combo.name}</span>
                  <span className="cart-combo-picks">{line.picks.map((p) => p.name).join(', ')}</span>
                  <span style={{ fontSize: '11px', color: '#c4b5fd' }}>{money(line.combo.price)}</span>
                  <div className="cart-item-qty">
                    <button className="rest-btn rest-btn-secondary cart-qty-btn" onClick={() => onUpdateComboQty(line.picksKey, -1)}>-</button>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{line.qty}</span>
                    <button className="rest-btn rest-btn-secondary cart-qty-btn" onClick={() => onUpdateComboQty(line.picksKey, 1)}>+</button>
                  </div>
                </div>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{money(line.combo.price * line.qty)}</span>
              </div>
            ))}
          </div>

          {!cartEmpty && (
            <div className="pos-totals">
              {settings.loyaltyEnabled && client && (
                <div className="pos-loyalty-box">
                  <div className="flex-row-between">
                    <span className="pos-loyalty-balance">
                      <Gift size={12} /> {t('pos.loyaltyBalance', { points: client.loyaltyPoints })}
                    </span>
                    <span className="pos-loyalty-earn">{t('pos.loyaltyEarnPreview', { points: earnPreview })}</span>
                  </div>
                  {redeemAllowed && (
                    <label className="pos-redeem-toggle">
                      <input type="checkbox" checked={effectiveRedeem} onChange={(e) => setRedeem(e.target.checked)} />
                      <span>
                        {effectiveRedeem
                          ? t('pos.redeemApplied', { value: money(bill.discount) })
                          : t('pos.redeemReward', { points: settings.redeemThreshold, value: money(settings.redeemValue) })}
                      </span>
                    </label>
                  )}
                </div>
              )}

              <div className="flex-row-between pos-total-line">
                <span>{t('pos.subtotal')}</span>
                <span>{money(bill.subtotal)}</span>
              </div>
              {bill.taxBreakdown.map((entry) => (
                <div key={entry.rate} className="flex-row-between pos-total-line">
                  <span>{t('pos.vat', { rate: entry.rate })}</span>
                  <span>{money(entry.amount)}</span>
                </div>
              ))}
              {bill.discount > 0 && (
                <div className="flex-row-between pos-total-line pos-discount-line">
                  <span>{t('pos.discount')}</span>
                  <span>−{money(bill.discount)}</span>
                </div>
              )}

              <div className="pos-tip-row">
                <span className="pos-tip-label"><HandCoins size={12} /> {t('pos.tip')}</span>
                {[5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    className={`pos-cat-chip ${tip > 0 && Math.abs(tip - Math.round(bill.total * pct) / 100) < 0.005 ? 'active' : ''}`}
                    onClick={() => setTip(Math.round(bill.total * pct) / 100)}
                  >
                    {pct}%
                  </button>
                ))}
                <input
                  className="rest-input pos-tip-input"
                  type="number"
                  min={0}
                  step="0.5"
                  value={tip || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setTip(isFinite(n) && n >= 0 ? n : 0);
                  }}
                />
              </div>

              <div className="flex-row-between pos-grand-total">
                <span>{t('pos.total')}</span>
                <span style={{ color: '#60a5fa' }}>{money(grandTotal)}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '10px' }}>
                <button className="rest-btn rest-btn-secondary pos-pay-btn" onClick={() => onCheckout('Cash', effectiveRedeem, tip)}>
                  💵 {t('payment.cash')}
                </button>
                <button className="rest-btn rest-btn-secondary pos-pay-btn" onClick={() => onCheckout('Card', effectiveRedeem, tip)}>
                  💳 {t('payment.card')}
                </button>
                <button className="rest-btn rest-btn-primary pos-pay-btn" onClick={() => onCheckout('Mobile', effectiveRedeem, tip)}>
                  📱 {t('payment.mobile')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {pendingCombo && (
        <ComboPickDialog
          combo={pendingCombo}
          menu={menu}
          settings={settings}
          onConfirm={(picks) => onAddCombo(pendingCombo.id, picks)}
          onClose={() => setPendingCombo(null)}
        />
      )}
    </div>
  );
}
