import { useState } from 'react';
import { Check, Edit, Plus, Search, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { fmtMoney } from '../format';
import { canRedeem, nextTier, tierFor } from '../loyalty';
import type { Client, Settings, Table } from '../types';

const EMPTY_FORM: Partial<Client> = { name: '', phone: '', email: '', allergies: [], preferences: '', favTable: '' };

function LoyaltyCard({ client, settings }: { client: Client; settings: Settings }) {
  const { t, lang } = useI18n();
  if (!settings.loyaltyEnabled) {
    return <p className="loyalty-disabled-note">{t('loyalty.disabled')}</p>;
  }
  const tier = tierFor(client.lifetimePoints);
  const next = nextTier(client.lifetimePoints);
  const tierLabel = (id: string) => t(`loyalty.tier${id.charAt(0).toUpperCase()}${id.slice(1)}`);
  const redeemable = canRedeem(client.loyaltyPoints, settings);

  return (
    <div className={`loyalty-card loyalty-${tier.id}`}>
      <div className="flex-row-between">
        <span className="loyalty-card-title">{tier.emoji} {t('loyalty.title')} — {tierLabel(tier.id)}</span>
        {redeemable && <span className="loyalty-redeem-hint">🎁 {fmtMoney(settings.redeemValue, settings.currency, lang)}</span>}
      </div>
      <div className="loyalty-card-stats">
        <div>
          <span className="rest-field-label">{t('loyalty.balance')}</span>
          <p className="loyalty-points-value">{t('loyalty.points', { points: client.loyaltyPoints })}</p>
        </div>
        <div>
          <span className="rest-field-label">{t('loyalty.lifetime')}</span>
          <p className="loyalty-points-value">{t('loyalty.points', { points: client.lifetimePoints })}</p>
        </div>
        <div>
          <span className="rest-field-label">{t('loyalty.tier')}</span>
          <p className="loyalty-points-value">
            {next
              ? t('loyalty.nextTier', { points: next.min - client.lifetimePoints, tier: tierLabel(next.id) })
              : t('loyalty.maxTier')}
          </p>
        </div>
      </div>
      {next && (
        <div className="loyalty-progress-track">
          <div
            className="loyalty-progress-fill"
            style={{ width: `${Math.min(100, (client.lifetimePoints / next.min) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function Crm({
  clients,
  tables,
  settings,
  selectedClientId,
  onSelectClient,
  onSaveClient,
  onDeleteClient,
  askConfirm,
}: {
  clients: Client[];
  tables: Table[];
  settings: Settings;
  selectedClientId: string | null;
  onSelectClient: (id: string | null) => void;
  onSaveClient: (form: Partial<Client>, editingId: string | null) => void;
  onDeleteClient: (id: string) => void;
  askConfirm: (message: string, onConfirm: () => void, danger?: boolean) => void;
}) {
  const { t } = useI18n();
  const [clientSearch, setClientSearch] = useState('');
  const [crmForm, setCrmForm] = useState<Partial<Client>>(EMPTY_FORM);
  const [crmEditMode, setCrmEditMode] = useState(false);
  const [allergyDraft, setAllergyDraft] = useState('');

  const activeClient = clients.find((c) => c.id === selectedClientId) || null;

  const saveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!crmForm.name?.trim()) return;
    onSaveClient(crmForm, crmEditMode ? selectedClientId : null);
    setCrmEditMode(false);
    setCrmForm(EMPTY_FORM);
  };

  const startEditClient = (c: Client) => {
    onSelectClient(c.id);
    setCrmForm(c);
    setCrmEditMode(true);
  };

  const addAllergy = () => {
    const allergy = allergyDraft.trim();
    if (!allergy) return;
    setCrmForm((prev) => ({ ...prev, allergies: [...(prev.allergies || []), allergy] }));
    setAllergyDraft('');
  };

  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="crm-layout">
      <div className="crm-list-container">
        <div className="rest-card rest-search-card">
          <Search size={14} color="var(--text-secondary)" />
          <input
            className="rest-input rest-search-input"
            placeholder={t('crm.searchPlaceholder')}
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
        </div>

        <div className="rest-scrollable" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {sortedClients
            .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
            .map((c) => {
              const tier = tierFor(c.lifetimePoints);
              return (
                <div
                  key={c.id}
                  className={`crm-item ${selectedClientId === c.id ? 'active' : ''}`}
                  onClick={() => onSelectClient(c.id)}
                >
                  <span className="crm-item-name">
                    {settings.loyaltyEnabled && <span title={tier.id}>{tier.emoji} </span>}
                    {c.name}
                  </span>
                  <span className="crm-item-meta">{c.phone || c.email}</span>
                  {c.allergies.length > 0 && (
                    <span className="crm-allergy-badge">⚠️ {c.allergies.join(', ')}</span>
                  )}
                </div>
              );
            })}
        </div>

        <button
          className="rest-btn rest-btn-primary"
          onClick={() => {
            onSelectClient(null);
            setCrmForm(EMPTY_FORM);
            setCrmEditMode(false);
          }}
        >
          <Plus size={14} /> {t('crm.newClient')}
        </button>
      </div>

      <div className="crm-details-pane">
        {activeClient && !crmEditMode && (
          <div className="rest-card" style={{ flex: 1 }}>
            <div className="flex-row-between">
              <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>{activeClient.name}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="rest-btn rest-btn-secondary" onClick={() => startEditClient(activeClient)}>
                  <Edit size={14} /> {t('common.edit')}
                </button>
                <button
                  className="rest-btn rest-btn-danger"
                  onClick={() =>
                    askConfirm(t('crm.deleteConfirm', { name: activeClient.name }), () => onDeleteClient(activeClient.id), true)
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <LoyaltyCard client={activeClient} settings={settings} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '4px' }}>
              <div>
                <span className="rest-field-label">{t('crm.phone')}</span>
                <p className="crm-field-value">{activeClient.phone || '--'}</p>
              </div>
              <div>
                <span className="rest-field-label">{t('crm.email')}</span>
                <p className="crm-field-value">{activeClient.email || '--'}</p>
              </div>
              <div>
                <span className="rest-field-label">{t('crm.favTable')}</span>
                <p className="crm-field-value">{activeClient.favTable || '--'}</p>
              </div>
              <div>
                <span className="rest-field-label">{t('crm.visits')}</span>
                <p className="crm-field-value" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                  {t('crm.visitsCount', { count: activeClient.visits })}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <span className="rest-field-label">{t('crm.allergies')}</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {activeClient.allergies.length > 0 ? (
                  activeClient.allergies.map((a, i) => (
                    <span key={i} className="crm-allergy-badge" style={{ fontSize: '11px', padding: '4px 8px' }}>{a}</span>
                  ))
                ) : (
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-success)' }}>{t('crm.noAllergies')}</p>
                )}
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <span className="rest-field-label">{t('crm.prefsNotes')}</span>
              <p className="crm-prefs-box">{activeClient.preferences || t('crm.noPrefs')}</p>
            </div>
          </div>
        )}

        {!activeClient && !crmEditMode && (
          <div className="rest-card" style={{ flex: 0 }}>
            <div className="crm-empty-hint">{t('crm.selectHint')}</div>
          </div>
        )}

        {(crmEditMode || !activeClient) && (
          <form className="rest-card" onSubmit={saveClient}>
            <h3 className="rest-card-title">{crmEditMode ? t('crm.editClient') : t('crm.addClient')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div className="rest-field">
                <label className="rest-field-label">{t('crm.fullName')}</label>
                <input
                  required
                  className="rest-input"
                  value={crmForm.name || ''}
                  onChange={(e) => setCrmForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="rest-field">
                <label className="rest-field-label">{t('crm.phone')}</label>
                <input
                  className="rest-input"
                  value={crmForm.phone || ''}
                  onChange={(e) => setCrmForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="rest-field">
                <label className="rest-field-label">{t('crm.email')}</label>
                <input
                  type="email"
                  className="rest-input"
                  value={crmForm.email || ''}
                  onChange={(e) => setCrmForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="rest-field">
                <label className="rest-field-label">{t('crm.favTable')}</label>
                <select
                  className="rest-select"
                  value={crmForm.favTable || ''}
                  onChange={(e) => setCrmForm((prev) => ({ ...prev, favTable: e.target.value }))}
                >
                  <option value="">{t('common.none')}</option>
                  {[...tables]
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                    .map((tb) => (
                      <option key={tb.id} value={tb.name}>{tb.name}</option>
                    ))}
                  {/* A stored favourite whose table was renamed/deleted stays selectable. */}
                  {crmForm.favTable && !tables.some((tb) => tb.name === crmForm.favTable) && (
                    <option value={crmForm.favTable}>{crmForm.favTable}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="rest-field">
              <label className="rest-field-label">{t('crm.addAllergy')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="rest-input"
                  style={{ flex: 1 }}
                  placeholder={t('crm.allergyPlaceholder')}
                  value={allergyDraft}
                  onChange={(e) => setAllergyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAllergy();
                    }
                  }}
                />
                <button type="button" className="rest-btn rest-btn-secondary" onClick={addAllergy}>
                  {t('common.add')}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {crmForm.allergies?.map((a, i) => (
                  <span key={i} className="crm-allergy-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {a}
                    <button
                      type="button"
                      className="crm-allergy-remove"
                      onClick={() => setCrmForm((prev) => ({ ...prev, allergies: prev.allergies?.filter((item) => item !== a) }))}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="rest-field">
              <label className="rest-field-label">{t('crm.prefsNotes')}</label>
              <textarea
                className="rest-input"
                rows={3}
                value={crmForm.preferences || ''}
                onChange={(e) => setCrmForm((prev) => ({ ...prev, preferences: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              {crmEditMode && (
                <button type="button" className="rest-btn rest-btn-secondary" onClick={() => setCrmEditMode(false)}>
                  {t('common.cancel')}
                </button>
              )}
              <button type="submit" className="rest-btn rest-btn-primary">
                <Check size={14} /> {t('common.save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
