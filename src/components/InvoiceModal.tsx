import { useI18n } from '../i18n';
import { fmtDateTime, fmtMoney } from '../format';
import type { Invoice, Settings } from '../types';

/** Printable receipt preview for a finalized invoice. */
export function InvoiceModal({
  invoice,
  settings,
  onClose,
}: {
  invoice: Invoice | null;
  settings: Settings;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  if (!invoice) return null;

  // Old invoices carry their own currency/rate snapshot when available.
  const currency = invoice.currency ?? settings.currency;
  const vatRate = invoice.vatRate ?? settings.vatRate;
  const money = (n: number) => fmtMoney(n, currency, lang);
  const methodLabel = t(`payment.${invoice.paymentMethod.toLowerCase()}`);

  return (
    <div className="rest-modal-overlay">
      <div className="receipt-card">
        <div className="receipt-header">
          <h2>{settings.restaurantName.toUpperCase()}</h2>
          <p>{t('receipt.tagline')}</p>
          <p>{t('receipt.invoiceNo', { id: invoice.id.substring(4, 12).toUpperCase() })}</p>
          <p>{t('receipt.date', { date: fmtDateTime(invoice.dateISO, invoice.date, lang) })}</p>
        </div>

        <div className="receipt-section">
          <div className="flex-row-between">
            <span>{t('receipt.table', { name: invoice.tableName })}</span>
            <span>{t('receipt.client', { name: invoice.clientName || t('pos.walkIn') })}</span>
          </div>
        </div>

        <div className="receipt-section">
          {invoice.items.map((item, index) => (
            <div key={index} className="flex-row-between">
              <span>{item.qty}x {item.name}</span>
              <span>{money(item.price * item.qty)}</span>
            </div>
          ))}
        </div>

        <div className="receipt-totals">
          <div className="flex-row-between">
            <span>{t('receipt.subtotal')}</span>
            <span>{money(invoice.subtotal)}</span>
          </div>
          {invoice.taxBreakdown && invoice.taxBreakdown.length > 0 ? (
            invoice.taxBreakdown.map((entry) => (
              <div key={entry.rate} className="flex-row-between">
                <span>{t('receipt.vat', { rate: entry.rate })}</span>
                <span>{money(entry.amount)}</span>
              </div>
            ))
          ) : (
            <div className="flex-row-between">
              <span>{t('receipt.vat', { rate: vatRate })}</span>
              <span>{money(invoice.tax)}</span>
            </div>
          )}
          {invoice.discount > 0 && (
            <div className="flex-row-between">
              <span>{t('receipt.discount')}</span>
              <span>−{money(invoice.discount)}</span>
            </div>
          )}
          {(invoice.tip ?? 0) > 0 && (
            <div className="flex-row-between">
              <span>{t('receipt.tip')}</span>
              <span>{money(invoice.tip ?? 0)}</span>
            </div>
          )}
          <div className="flex-row-between receipt-grand-total">
            <span>{t('receipt.total')}</span>
            <span>{money(invoice.total)}</span>
          </div>
          {invoice.serverName && (
            <div className="flex-row-between receipt-muted">
              <span>{t('receipt.server', { name: invoice.serverName })}</span>
            </div>
          )}
          {(invoice.loyaltyEarned ?? 0) > 0 && (
            <div className="flex-row-between receipt-muted">
              <span>{t('receipt.loyalty', { earned: invoice.loyaltyEarned ?? 0 })}</span>
            </div>
          )}
          <div className="flex-row-between receipt-muted">
            <span>{t('receipt.paidBy', { method: methodLabel })}</span>
            <span>{t('receipt.paid')}</span>
          </div>
        </div>

        <div className="receipt-actions">
          <button className="rest-btn receipt-print-btn" onClick={() => window.print()}>
            {t('invoices.print')}
          </button>
          <button className="rest-btn rest-btn-primary" style={{ flex: 1 }} onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
