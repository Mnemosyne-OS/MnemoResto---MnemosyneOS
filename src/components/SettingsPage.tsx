import { useRef, useState } from 'react';
import { Database, Download, Globe, Info, Store, Trash2, Upload } from 'lucide-react';
import { LANGUAGES, useI18n, type LangMode } from '../i18n';
import { CURRENCIES } from '../format';
import type { Settings } from '../types';

const APP_VERSION = '2.0.0';

export function SettingsPage({
  settings,
  sandboxVault,
  onUpdateSettings,
  onLoadDemo,
  onWipeAll,
  onExportBackup,
  onImportBackup,
  askConfirm,
}: {
  settings: Settings;
  sandboxVault: string;
  onUpdateSettings: (patch: Partial<Settings>) => void;
  onLoadDemo: () => void;
  onWipeAll: () => void;
  onExportBackup: () => void;
  onImportBackup: (raw: string) => boolean;
  askConfirm: (message: string, onConfirm: () => void, danger?: boolean) => void;
}) {
  const { t, langMode, setLangMode } = useI18n();
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? '');
      askConfirm(t('settings.importConfirm'), () => {
        const ok = onImportBackup(raw);
        flash(ok ? t('settings.imported') : t('settings.importError'));
      });
    };
    reader.readAsText(file);
  };

  const numField = (value: number, patch: (n: number) => Partial<Settings>, min = 0, step = '0.01') => (
    <input
      className="rest-input"
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (isFinite(n) && n >= min) onUpdateSettings(patch(n));
      }}
    />
  );

  return (
    <div className="settings-layout rest-scrollable">
      {notice && <div className="settings-notice">{notice}</div>}

      {/* ── Language ─────────────────────────────────────────────────── */}
      <div className="rest-card">
        <h3 className="rest-card-title"><Globe size={15} /> {t('settings.language')}</h3>
        <div className="settings-lang-row">
          <button
            className={`rest-btn ${langMode === 'auto' ? 'rest-btn-primary' : 'rest-btn-secondary'}`}
            onClick={() => setLangMode('auto')}
          >
            ∞ {t('settings.languageAuto')}
          </button>
          {(Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[]).map((code) => (
            <button
              key={code}
              className={`rest-btn ${langMode === (code as LangMode) ? 'rest-btn-primary' : 'rest-btn-secondary'}`}
              onClick={() => setLangMode(code)}
            >
              {LANGUAGES[code].flag} {LANGUAGES[code].label}
            </button>
          ))}
        </div>
        <p className="settings-hint">{t('settings.languageHint')}</p>
      </div>

      {/* ── Restaurant profile ───────────────────────────────────────── */}
      <div className="rest-card">
        <h3 className="rest-card-title"><Store size={15} /> {t('settings.profile')}</h3>
        <div className="settings-grid">
          <div className="rest-field">
            <label className="rest-field-label">{t('settings.restaurantName')}</label>
            <input
              className="rest-input"
              value={settings.restaurantName}
              onChange={(e) => onUpdateSettings({ restaurantName: e.target.value })}
            />
          </div>
          <div className="rest-field">
            <label className="rest-field-label">{t('settings.currency')}</label>
            <select
              className="rest-select"
              value={settings.currency}
              onChange={(e) => onUpdateSettings({ currency: e.target.value })}
            >
              {CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
            </select>
          </div>
          <div className="rest-field">
            <label className="rest-field-label">{t('settings.vatRate')}</label>
            {numField(settings.vatRate, (n) => ({ vatRate: n }), 0, '0.1')}
          </div>
        </div>
        <p className="settings-hint">{t('settings.autoSaveHint')}</p>
      </div>

      {/* ── Loyalty program ──────────────────────────────────────────── */}
      <div className="rest-card">
        <h3 className="rest-card-title">🎁 {t('settings.loyalty')}</h3>
        <label className="settings-toggle-row">
          <input
            type="checkbox"
            checked={settings.loyaltyEnabled}
            onChange={(e) => onUpdateSettings({ loyaltyEnabled: e.target.checked })}
          />
          <span>{t('settings.loyaltyEnabled')}</span>
        </label>
        {settings.loyaltyEnabled && (
          <div className="settings-grid">
            <div className="rest-field">
              <label className="rest-field-label">{t('settings.earnRate', { currency: settings.currency })}</label>
              {numField(settings.earnRate, (n) => ({ earnRate: n }))}
            </div>
            <div className="rest-field">
              <label className="rest-field-label">{t('settings.redeemThreshold')}</label>
              {numField(settings.redeemThreshold, (n) => ({ redeemThreshold: n }), 0, '1')}
            </div>
            <div className="rest-field">
              <label className="rest-field-label">{t('settings.redeemValue', { currency: settings.currency })}</label>
              {numField(settings.redeemValue, (n) => ({ redeemValue: n }))}
            </div>
          </div>
        )}
        <p className="settings-hint">{t('settings.loyaltyHint')}</p>
      </div>

      {/* ── Data management ──────────────────────────────────────────── */}
      <div className="rest-card">
        <h3 className="rest-card-title"><Database size={15} /> {t('settings.data')}</h3>

        <div className="settings-data-row">
          <div>
            <span className="settings-data-label">{t('settings.loadDemo')}</span>
            <p className="settings-hint">{t('settings.loadDemoHint')}</p>
          </div>
          <button
            className="rest-btn rest-btn-secondary"
            onClick={() =>
              askConfirm(t('settings.loadDemoConfirm'), () => {
                onLoadDemo();
                flash(t('settings.demoLoaded'));
              })
            }
          >
            ✨ {t('settings.loadDemo')}
          </button>
        </div>

        <div className="settings-data-row">
          <div>
            <span className="settings-data-label">{t('settings.export')}</span>
          </div>
          <button className="rest-btn rest-btn-secondary" onClick={onExportBackup}>
            <Download size={13} /> {t('common.export')}
          </button>
        </div>

        <div className="settings-data-row">
          <div>
            <span className="settings-data-label">{t('settings.import')}</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />
          <button className="rest-btn rest-btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} /> {t('common.import')}
          </button>
        </div>

        <div className="settings-data-row settings-danger-row">
          <div>
            <span className="settings-data-label">{t('settings.wipe')}</span>
            <p className="settings-hint">{t('settings.wipeHint')}</p>
          </div>
          <button
            className="rest-btn rest-btn-danger"
            onClick={() =>
              askConfirm(t('settings.wipeConfirm'), () => {
                onWipeAll();
                flash(t('settings.wiped'));
              }, true)
            }
          >
            <Trash2 size={13} /> {t('settings.wipe')}
          </button>
        </div>
      </div>

      {/* ── About ────────────────────────────────────────────────────── */}
      <div className="rest-card">
        <h3 className="rest-card-title"><Info size={15} /> {t('settings.about')}</h3>
        <div className="settings-about-grid">
          <span className="rest-field-label">{t('settings.version')}</span>
          <span>{APP_VERSION}</span>
          <span className="rest-field-label">{t('settings.vault')}</span>
          <span>{sandboxVault || t('settings.vaultNone')}</span>
        </div>
      </div>
    </div>
  );
}
