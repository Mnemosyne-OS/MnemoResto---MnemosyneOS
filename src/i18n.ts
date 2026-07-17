/**
 * Cartridge-local i18n, following the sovereign-bi pattern.
 *
 * Language resolution (first match wins):
 *   1. Manual override chosen in the cartridge Settings page ('mnemo_rest_lang_mode')
 *   2. Host language — `?lang=` query param set by the Infinity PluginWidget,
 *      then live `MNEMO_CONFIG_UPDATE` postMessages when the host switches
 *   3. Browser navigator.language prefix
 *   4. 'en'
 *
 * The default mode is 'auto' so the cartridge always follows Infinity unless
 * the user explicitly pins a language.
 */
import { useState, useEffect } from 'react';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';

export type LangCode = 'en' | 'fr' | 'es';
export type LangMode = 'auto' | LangCode;

export const LANGUAGES: Record<LangCode, { label: string; flag: string }> = {
  en: { label: 'English', flag: '🇬🇧' },
  fr: { label: 'Français', flag: '🇫🇷' },
  es: { label: 'Español', flag: '🇪🇸' },
};

const DICTIONARY: Record<LangCode, Record<string, string>> = {
  en: en as Record<string, string>,
  fr: fr as Record<string, string>,
  es: es as Record<string, string>,
};

const MODE_KEY = 'mnemo_rest_lang_mode';

function isLangCode(v: string | null | undefined): v is LangCode {
  return !!v && v in DICTIONARY;
}

function hostLangFromUrl(): LangCode | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlLang = (params.get('lang') || params.get('locale') || '').slice(0, 2);
    return isLangCode(urlLang) ? urlLang : null;
  } catch {
    return null;
  }
}

function browserLang(): LangCode {
  const nav = navigator.language.slice(0, 2);
  return isLangCode(nav) ? nav : 'en';
}

function loadMode(): LangMode {
  const saved = localStorage.getItem(MODE_KEY);
  if (saved === 'auto' || isLangCode(saved)) return saved;
  return 'auto';
}

let currentMode: LangMode = loadMode();
// Host language last seen — seeded from the iframe URL, refreshed by events.
let hostLang: LangCode | null = hostLangFromUrl();

const listeners = new Set<() => void>();
function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function getLanguage(): LangCode {
  if (currentMode !== 'auto') return currentMode;
  return hostLang ?? browserLang();
}

export function getLangMode(): LangMode {
  return currentMode;
}

/** 'auto' follows Infinity; a concrete code pins the cartridge language. */
export function setLangMode(mode: LangMode) {
  currentMode = mode;
  localStorage.setItem(MODE_KEY, mode);
  notifyListeners();
}

// Live host language pushes from the Infinity PluginWidget wrapper.
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'MNEMO_CONFIG_UPDATE' && event.data.lang) {
      const parentLang = String(event.data.lang).slice(0, 2);
      if (isLangCode(parentLang) && parentLang !== hostLang) {
        hostLang = parentLang;
        notifyListeners();
      }
    }
  });
}

/** Translate a key with optional {{var}} interpolation, outside React. */
export function translate(key: string, variables?: Record<string, string | number>): string {
  const lang = getLanguage();
  let text = DICTIONARY[lang][key] || DICTIONARY.en[key] || key;
  if (variables) {
    Object.entries(variables).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    });
  }
  return text;
}

/** Primary translation hook for components. */
export function useI18n() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const handleUpdate = () => forceRender((n) => n + 1);
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  return {
    t: translate,
    lang: getLanguage(),
    langMode: getLangMode(),
    setLangMode,
  };
}
