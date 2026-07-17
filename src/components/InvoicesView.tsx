import { useMemo, useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import { useI18n } from '../i18n';
import { fmtDateTime, fmtMoney } from '../format';
import type { Invoice, Settings } from '../types';

type PeriodFilter = 'all' | 'today' | '7d';
type PaymentFilter = 'all' | 'Cash' | 'Card' | 'Mobile';

function inPeriod(inv: Invoice, period: PeriodFilter): boolean {
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

function csvEscape(value: string): string {
  return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function InvoicesView({
  invoices,
  settings,
  onOpenInvoice,
}: {
  invoices: Invoice[];
  settings: Settings;
  onOpenInvoice: (inv: Invoice) => void;
}) {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState('');
  const [payment, setPayment] = useState<PaymentFilter>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (payment !== 'all' && inv.paymentMethod !== payment) return false;
      if (!inPeriod(inv, period)) return false;
      if (!q) return true;
      return (
        inv.id.toLowerCase().includes(q) ||
        inv.tableName.toLowerCase().includes(q) ||
        (inv.clientName ?? '').toLowerCase().includes(q)
      );
    });
  }, [invoices, search, payment, period]);

  const totalRevenue = filtered.reduce((sum, inv) => sum + inv.total, 0);
  const money = (n: number, inv?: Invoice) => fmtMoney(n, inv?.currency ?? settings.currency, lang);

  const exportCsv = () => {
    const header = ['id', 'date', 'table', 'client', 'payment', 'subtotal', 'tax', 'discount', 'total', 'items'];
    const rows = filtered.map((inv) => [
      inv.id,
      inv.dateISO ?? inv.date,
      inv.tableName,
      inv.clientName ?? '',
      inv.paymentMethod,
      inv.subtotal.toFixed(2),
      inv.tax.toFixed(2),
      inv.discount.toFixed(2),
      inv.total.toFixed(2),
      inv.items.map((it) => `${it.qty}x ${it.name}`).join(' | '),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(';')).join('\n');
    // UTF-8 BOM so Excel opens the file with accents intact.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', flex: 1 }}>
      <div className="flex-row-between">
        <h3 style={{ margin: 0 }}>{t('invoices.title')}</h3>
        <div className="invoices-header-meta">
          <span className="invoices-revenue">
            {t('invoices.totalRevenue')} : <strong>{money(totalRevenue)}</strong>
          </span>
          <span className="badge-count">{t('invoices.countLabel', { count: filtered.length })}</span>
          <button className="rest-btn rest-btn-secondary" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download size={13} /> {t('invoices.exportCsv')}
          </button>
        </div>
      </div>

      <div className="invoices-filters">
        <div className="rest-card rest-search-card" style={{ flex: 1 }}>
          <Search size={14} color="var(--text-secondary)" />
          <input
            className="rest-input rest-search-input"
            placeholder={t('invoices.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="rest-select" value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)}>
          <option value="all">{t('invoices.allDates')}</option>
          <option value="today">{t('invoices.today')}</option>
          <option value="7d">{t('invoices.last7days')}</option>
        </select>
        <select className="rest-select" value={payment} onChange={(e) => setPayment(e.target.value as PaymentFilter)}>
          <option value="all">{t('invoices.allPayments')}</option>
          <option value="Cash">{t('payment.cash')}</option>
          <option value="Card">{t('payment.card')}</option>
          <option value="Mobile">{t('payment.mobile')}</option>
        </select>
      </div>

      <div className="rest-scrollable" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.length > 0 ? (
          filtered.map((inv) => (
            <div key={inv.id} className="rest-card invoice-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>
                  {t('invoices.invoiceNo', { id: inv.id.substring(4, 10), table: inv.tableName })}
                </div>
                <div className="invoice-row-meta">
                  {t('invoices.date')} : {fmtDateTime(inv.dateISO, inv.date, lang)} · {t('invoices.client')} : {inv.clientName || t('pos.walkIn')} · {t('invoices.payment')} : {t(`payment.${inv.paymentMethod.toLowerCase()}`)}
                  {inv.serverName && <> · 👤 {inv.serverName}</>}
                  {(inv.tip ?? 0) > 0 && <> · 💶 {t('pos.tip')} {money(inv.tip ?? 0, inv)}</>}
                  {(inv.loyaltyEarned ?? 0) > 0 && <> · 🎁 +{inv.loyaltyEarned} pts</>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>{money(inv.total, inv)}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('invoices.vatIncl')}</div>
                </div>
                <button className="rest-btn rest-btn-secondary" style={{ padding: '6px' }} onClick={() => onOpenInvoice(inv)}>
                  <Printer size={14} /> {t('invoices.print')}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rest-empty-hint">{t('invoices.empty')}</div>
        )}
      </div>
    </div>
  );
}
