/**
 * Locale-aware display formatting. All money and dates go through here so the
 * whole cartridge follows the Settings currency and the active language.
 */
import type { LangCode } from './i18n';

const INTL_LOCALE: Record<LangCode, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  es: 'es-ES',
};

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'MXN'] as const;

export function fmtMoney(amount: number, currency: string, lang: LangCode): string {
  try {
    return new Intl.NumberFormat(INTL_LOCALE[lang], {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown currency code in a corrupted settings blob — stay readable.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Short date+time for invoice rows and receipts. */
export function fmtDateTime(iso: string | undefined, fallback: string, lang: LangCode): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

/** Weekday abbreviation for the dashboard chart axis. */
export function fmtWeekday(date: Date, lang: LangCode): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], { weekday: 'short' }).format(date);
}
