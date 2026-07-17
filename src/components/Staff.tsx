import { useMemo, useState } from 'react';
import { HandCoins, Plus, Trash2, UserCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { fmtMoney } from '../format';
import type { Invoice, Server, Settings, Table } from '../types';

type Period = 'all' | 'today' | '7d';

function inPeriod(inv: Invoice, period: Period): boolean {
  if (period === 'all') return true;
  if (!inv.dateISO) return false; // legacy invoices have no sortable date
  const d = new Date(inv.dateISO);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  if (period === 'today') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }
  return now.getTime() - d.getTime() <= 7 * 24 * 3600 * 1000;
}

interface ServerStats {
  bills: number;
  revenue: number;
  tips: number;
}

export function Staff({
  servers,
  tables,
  invoices,
  settings,
  onAddServer,
  onDeleteServer,
  askConfirm,
}: {
  servers: Server[];
  tables: Table[];
  invoices: Invoice[];
  settings: Settings;
  onAddServer: (name: string) => void;
  onDeleteServer: (id: string) => void;
  askConfirm: (message: string, onConfirm: () => void, danger?: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const [nameDraft, setNameDraft] = useState('');
  const [period, setPeriod] = useState<Period>('7d');

  const money = (n: number) => fmtMoney(n, settings.currency, lang);

  const { statsByServer, unassigned, byTable, totalTips } = useMemo(() => {
    const filtered = invoices.filter((inv) => inPeriod(inv, period));
    const empty = (): ServerStats => ({ bills: 0, revenue: 0, tips: 0 });

    const statsByServer = new Map<string, ServerStats>(servers.map((s) => [s.id, empty()]));
    const unassigned = empty();
    const byTable = new Map<string, ServerStats>();
    let totalTips = 0;

    for (const inv of filtered) {
      const tip = inv.tip ?? 0;
      totalTips += tip;

      const bucket = (inv.serverId && statsByServer.get(inv.serverId)) || unassigned;
      bucket.bills += 1;
      bucket.revenue += inv.total;
      bucket.tips += tip;

      const tableStats = byTable.get(inv.tableName) ?? empty();
      tableStats.bills += 1;
      tableStats.revenue += inv.total;
      tableStats.tips += tip;
      byTable.set(inv.tableName, tableStats);
    }

    const byTableSorted = [...byTable.entries()].sort((a, b) => b[1].tips - a[1].tips).slice(0, 10);
    return { statsByServer, unassigned, byTable: byTableSorted, totalTips };
  }, [invoices, servers, period]);

  const addServer = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name) return;
    onAddServer(name);
    setNameDraft('');
  };

  const assignedTables = (serverId: string) =>
    tables.filter((tb) => tb.serverId === serverId).map((tb) => tb.name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', flex: 1 }}>
      <div className="flex-row-between">
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={16} /> {t('nav.staff')}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="staff-total-tips">
            <HandCoins size={13} /> {t('staff.tipsTotal')} : <strong>{money(totalTips)}</strong>
          </span>
          <select className="rest-select" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="today">{t('invoices.today')}</option>
            <option value="7d">{t('invoices.last7days')}</option>
            <option value="all">{t('invoices.allDates')}</option>
          </select>
        </div>
      </div>

      <div className="staff-layout rest-scrollable">
        {/* ── Team roster ─────────────────────────────────────────────── */}
        <div className="staff-roster">
          <form className="rest-card rest-search-card" onSubmit={addServer}>
            <input
              className="rest-input rest-search-input"
              placeholder={t('staff.namePlaceholder')}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
            />
            <button type="submit" className="rest-btn rest-btn-primary" style={{ padding: '6px 10px' }}>
              <Plus size={13} /> {t('staff.addServer')}
            </button>
          </form>

          {servers.length === 0 && <div className="rest-empty-hint">{t('staff.empty')}</div>}

          {servers.map((server) => {
            const stats = statsByServer.get(server.id) ?? { bills: 0, revenue: 0, tips: 0 };
            const covered = assignedTables(server.id);
            return (
              <div key={server.id} className="rest-card staff-card">
                <div className="flex-row-between">
                  <span className="staff-name">
                    <span className="staff-color-dot" style={{ backgroundColor: server.color }} />
                    {server.name}
                  </span>
                  <button
                    className="inventory-delete-btn"
                    title={t('common.delete')}
                    onClick={() =>
                      askConfirm(t('staff.deleteConfirm', { name: server.name }), () => onDeleteServer(server.id), true)
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="staff-stats-row">
                  <div>
                    <span className="rest-field-label">{t('staff.tipsTotal')}</span>
                    <p className="staff-stat-value staff-tips-value">{money(stats.tips)}</p>
                  </div>
                  <div>
                    <span className="rest-field-label">{t('staff.revenue')}</span>
                    <p className="staff-stat-value">{money(stats.revenue)}</p>
                  </div>
                  <div>
                    <span className="rest-field-label">{t('staff.avgTip')}</span>
                    <p className="staff-stat-value">{stats.bills > 0 ? money(stats.tips / stats.bills) : '—'}</p>
                  </div>
                </div>
                <span className="dashboard-muted">{t('staff.bills', { count: stats.bills })}</span>

                <div>
                  <span className="rest-field-label">{t('staff.assignedTables')}</span>
                  <div className="staff-table-chips">
                    {covered.length > 0 ? (
                      covered.map((name) => (
                        <span key={name} className="staff-table-chip" style={{ borderColor: server.color }}>
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="dashboard-muted">—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {unassigned.bills > 0 && (
            <div className="rest-card staff-card staff-unassigned">
              <span className="staff-name">{t('staff.unassigned')}</span>
              <div className="staff-stats-row">
                <div>
                  <span className="rest-field-label">{t('staff.tipsTotal')}</span>
                  <p className="staff-stat-value">{money(unassigned.tips)}</p>
                </div>
                <div>
                  <span className="rest-field-label">{t('staff.revenue')}</span>
                  <p className="staff-stat-value">{money(unassigned.revenue)}</p>
                </div>
                <div>
                  <span className="rest-field-label">{t('staff.bills', { count: unassigned.bills })}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Tips by table ───────────────────────────────────────────── */}
        <div className="rest-card staff-bytable-card">
          <h3 className="rest-card-title"><HandCoins size={15} /> {t('staff.byTable')}</h3>
          {byTable.length > 0 ? (
            <div className="dashboard-list">
              {byTable.map(([tableName, stats]) => {
                const server = servers.find((s) => tables.find((tb) => tb.name === tableName)?.serverId === s.id);
                return (
                  <div key={tableName} className="dashboard-list-row">
                    {server && <span className="staff-color-dot" style={{ backgroundColor: server.color }} />}
                    <span className="dashboard-list-name">{tableName}</span>
                    <span className="dashboard-list-meta">{t('staff.bills', { count: stats.bills })}</span>
                    <span className="staff-tips-value">{money(stats.tips)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="dashboard-muted">{t('dashboard.noSales')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
