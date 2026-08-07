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

/**
 * Every circulating ISO 4217 currency. Fund codes (BOV, CLF, MXV, USN, XSU…),
 * precious metals (XAU, XAG…) and test codes (XTS, XXX) are left out: they are
 * not currencies a restaurant can be paid in.
 */
export const CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
  'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL',
  'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR',
  'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR',
  'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
  'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD',
  'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB',
  'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX',
  'USD', 'UYU', 'UZS', 'VED', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD',
  'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWG',
] as const;

/** The handful most restaurants pick, pinned to the top of the Settings list. */
export const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'MXN'] as const;

/**
 * "EUR — Euro" in the active language. Intl.DisplayNames covers the whole ISO
 * table; when a runtime lacks the entry it echoes the code back, which we drop
 * so the option never reads "EUR — EUR".
 */
export function currencyLabel(code: string, lang: LangCode): string {
  try {
    const name = new Intl.DisplayNames([INTL_LOCALE[lang]], { type: 'currency' }).of(code);
    return name && name !== code ? `${code} — ${name}` : code;
  } catch {
    return code;
  }
}

export function fmtMoney(amount: number, currency: string, lang: LangCode): string {
  try {
    // No forced fraction digits: each currency carries its own (JPY 0, EUR 2,
    // KWD 3), and hardcoding 2 printed "¥1,200.00" for zero-decimal money.
    return new Intl.NumberFormat(INTL_LOCALE[lang], {
      style: 'currency',
      currency,
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
