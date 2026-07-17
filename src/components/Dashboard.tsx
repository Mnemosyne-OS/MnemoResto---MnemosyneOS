import { useMemo } from 'react';
import { AlertTriangle, Award, Sparkles, TrendingUp, Users, UtensilsCrossed } from 'lucide-react';
import { useI18n } from '../i18n';
import { fmtMoney, fmtWeekday } from '../format';
import { tierFor } from '../loyalty';
import type { Client, Ingredient, Invoice, MenuItem, Settings, Table, TabId } from '../types';

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function Dashboard({
  tables,
  clients,
  ingredients,
  menu,
  invoices,
  settings,
  onLoadDemo,
  onGoTab,
}: {
  tables: Table[];
  clients: Client[];
  ingredients: Ingredient[];
  menu: MenuItem[];
  invoices: Invoice[];
  settings: Settings;
  onLoadDemo: () => void;
  onGoTab: (tab: TabId) => void;
}) {
  const { t, lang } = useI18n();
  const money = (n: number) => fmtMoney(n, settings.currency, lang);

  const stats = useMemo(() => {
    const now = new Date();
    const dated = invoices
      .map((inv) => ({ inv, d: inv.dateISO ? new Date(inv.dateISO) : null }))
      .filter((x): x is { inv: Invoice; d: Date } => x.d !== null && !isNaN(x.d.getTime()));

    const today = dated.filter(({ d }) => sameLocalDay(d, now));
    const revenueToday = today.reduce((sum, { inv }) => sum + inv.total, 0);

    // Last 7 local days, oldest first.
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const total = dated
        .filter(({ d }) => sameLocalDay(d, day))
        .reduce((sum, { inv }) => sum + inv.total, 0);
      return { day, total };
    });

    const dishCounts = new Map<string, number>();
    invoices.forEach((inv) => inv.items.forEach((it) => dishCounts.set(it.name, (dishCounts.get(it.name) ?? 0) + it.qty)));
    const topDishes = [...dishCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const topClients = [...clients].sort((a, b) => b.visits - a.visits).slice(0, 5);
    const lowStock = ingredients.filter((i) => i.quantity <= i.minThreshold);
    const occupied = tables.filter((tb) => tb.status === 'occupied').length;

    return {
      revenueToday,
      invoicesToday: today.length,
      avgTicket: today.length > 0 ? revenueToday / today.length : 0,
      days,
      topDishes,
      topClients,
      lowStock,
      occupied,
    };
  }, [invoices, clients, ingredients, tables]);

  const isEmpty = tables.length === 0 && clients.length === 0 && menu.length === 0 && ingredients.length === 0;

  if (isEmpty) {
    return (
      <div className="dashboard-empty">
        <Sparkles size={40} strokeWidth={1} />
        <h2>{t('dashboard.emptyTitle')}</h2>
        <p>{t('dashboard.emptyBody')}</p>
        <div className="dashboard-empty-actions">
          <button className="rest-btn rest-btn-primary" onClick={onLoadDemo}>
            {t('dashboard.loadDemo')}
          </button>
          <button className="rest-btn rest-btn-secondary" onClick={() => onGoTab('settings')}>
            {t('dashboard.goSettings')}
          </button>
        </div>
      </div>
    );
  }

  const maxDay = Math.max(1, ...stats.days.map((d) => d.total));

  return (
    <div className="dashboard-layout rest-scrollable">
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label"><TrendingUp size={13} /> {t('dashboard.revenueToday')}</span>
          <span className="kpi-value kpi-accent">{money(stats.revenueToday)}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">{t('dashboard.invoicesToday')}</span>
          <span className="kpi-value">{stats.invoicesToday}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">{t('dashboard.avgTicket')}</span>
          <span className="kpi-value">{money(stats.avgTicket)}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">{t('dashboard.openTables')}</span>
          <span className="kpi-value">{stats.occupied} / {tables.length}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label"><Users size={13} /> {t('dashboard.clients')}</span>
          <span className="kpi-value">{clients.length}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label"><AlertTriangle size={13} /> {t('dashboard.lowStock')}</span>
          <span className={`kpi-value ${stats.lowStock.length > 0 ? 'stock-warning' : 'stock-safe'}`}>
            {stats.lowStock.length}
          </span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="rest-card dashboard-chart-card">
          <h3 className="rest-card-title">{t('dashboard.revenue7d')}</h3>
          <div className="revenue-chart">
            {stats.days.map(({ day, total }, i) => (
              <div key={i} className="revenue-col" title={money(total)}>
                <span className="revenue-amount">{total > 0 ? money(total) : ''}</span>
                <div className="revenue-bar-track">
                  <div className="revenue-bar" style={{ height: `${Math.max(2, (total / maxDay) * 100)}%` }} />
                </div>
                <span className="revenue-day">{fmtWeekday(day, lang)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rest-card">
          <h3 className="rest-card-title"><UtensilsCrossed size={15} /> {t('dashboard.topDishes')}</h3>
          {stats.topDishes.length > 0 ? (
            <div className="dashboard-list">
              {stats.topDishes.map(([name, qty], i) => (
                <div key={name} className="dashboard-list-row">
                  <span className="dashboard-rank">{i + 1}</span>
                  <span className="dashboard-list-name">{name}</span>
                  <span className="dashboard-list-meta">{t('dashboard.soldCount', { count: qty })}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-muted">{t('dashboard.noSales')}</p>
          )}
        </div>

        <div className="rest-card">
          <h3 className="rest-card-title"><Award size={15} /> {t('dashboard.topClients')}</h3>
          {stats.topClients.length > 0 ? (
            <div className="dashboard-list">
              {stats.topClients.map((c) => {
                const tier = tierFor(c.lifetimePoints);
                return (
                  <div key={c.id} className="dashboard-list-row">
                    <span>{tier.emoji}</span>
                    <span className="dashboard-list-name">{c.name}</span>
                    <span className="dashboard-list-meta">{t('crm.visitsCount', { count: c.visits })}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="dashboard-muted">—</p>
          )}
        </div>

        <div className="rest-card">
          <h3 className="rest-card-title"><AlertTriangle size={15} /> {t('dashboard.stockAlerts')}</h3>
          {stats.lowStock.length > 0 ? (
            <div className="dashboard-list">
              {stats.lowStock.map((ing) => (
                <div key={ing.id} className="dashboard-list-row dashboard-alert-row" onClick={() => onGoTab('inventory')}>
                  <span className="dashboard-list-name">{ing.name}</span>
                  <span className={ing.quantity === 0 ? 'stock-danger' : 'stock-warning'}>
                    {ing.quantity} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-muted stock-safe">✓ {t('dashboard.allGood')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
