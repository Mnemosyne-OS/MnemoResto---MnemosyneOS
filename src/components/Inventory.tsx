import { useState } from 'react';
import { AlertTriangle, Plus, Search, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Ingredient, MenuItem } from '../types';

interface IngredientForm {
  name: string;
  quantity: string;
  unit: string;
  minThreshold: string;
}

const EMPTY_FORM: IngredientForm = { name: '', quantity: '', unit: 'pcs', minThreshold: '2' };

export function Inventory({
  ingredients,
  menu,
  onSaveEntry,
  onAdjustStock,
  onDeleteIngredient,
  askConfirm,
}: {
  ingredients: Ingredient[];
  menu: MenuItem[];
  onSaveEntry: (entry: { name: string; quantity: number; unit: string; minThreshold: number }) => void;
  onAdjustStock: (id: string, amount: number) => void;
  onDeleteIngredient: (id: string) => void;
  askConfirm: (message: string, onConfirm: () => void, danger?: boolean) => void;
}) {
  const { t } = useI18n();
  const [ingForm, setIngForm] = useState<IngredientForm>(EMPTY_FORM);
  const [ingSearch, setIngSearch] = useState('');

  const saveIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingForm.name.trim()) return;
    onSaveEntry({
      name: ingForm.name.trim(),
      quantity: Number(ingForm.quantity) || 0,
      unit: ingForm.unit.trim() || 'pcs',
      minThreshold: Number(ingForm.minThreshold) || 0,
    });
    setIngForm(EMPTY_FORM);
  };

  const usageCount = (id: string) =>
    menu.filter((m) => m.ingredients.some((ing) => ing.ingredientId === id)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden', flex: 1 }}>
      <form className="rest-card inventory-entry-form" onSubmit={saveIngredient}>
        <h3 className="rest-card-title" style={{ flexShrink: 0 }}><Plus size={16} /> {t('inventory.stockEntry')}</h3>
        <input
          required
          className="rest-input"
          style={{ flex: 1, minWidth: '140px' }}
          placeholder={t('inventory.ingredientName')}
          value={ingForm.name}
          onChange={(e) => setIngForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <input
          className="rest-input"
          type="number"
          step="0.01"
          style={{ width: '110px' }}
          placeholder={t('inventory.qtyToAdd')}
          value={ingForm.quantity}
          onChange={(e) => setIngForm((prev) => ({ ...prev, quantity: e.target.value }))}
        />
        <input
          className="rest-input"
          style={{ width: '90px' }}
          placeholder={t('inventory.unit')}
          value={ingForm.unit}
          onChange={(e) => setIngForm((prev) => ({ ...prev, unit: e.target.value }))}
        />
        <input
          className="rest-input"
          type="number"
          step="0.01"
          style={{ width: '110px' }}
          placeholder={t('inventory.threshold')}
          value={ingForm.minThreshold}
          onChange={(e) => setIngForm((prev) => ({ ...prev, minThreshold: e.target.value }))}
        />
        <button type="submit" className="rest-btn rest-btn-primary">{t('common.save')}</button>
      </form>

      <div className="rest-card rest-search-card">
        <Search size={14} color="var(--text-secondary)" />
        <input
          className="rest-input rest-search-input"
          placeholder={t('inventory.searchPlaceholder')}
          value={ingSearch}
          onChange={(e) => setIngSearch(e.target.value)}
        />
      </div>

      <div className="rest-scrollable" style={{ flex: 1 }}>
        {ingredients.length === 0 ? (
          <div className="rest-empty-hint">{t('inventory.empty')}</div>
        ) : (
          <div className="inventory-grid">
            {ingredients
              .filter((i) => i.name.toLowerCase().includes(ingSearch.toLowerCase()))
              .map((ing) => {
                const isLow = ing.quantity <= ing.minThreshold;
                const isOut = ing.quantity === 0;
                const levelClass = isOut ? 'stock-danger' : isLow ? 'stock-warning' : 'stock-safe';
                const usedIn = usageCount(ing.id);

                return (
                  <div key={ing.id} className="inventory-card">
                    <div className="flex-row-between">
                      <span style={{ fontWeight: 600 }}>{ing.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isLow && <AlertTriangle size={14} className={levelClass} />}
                        <button
                          className="inventory-delete-btn"
                          title={t('common.delete')}
                          onClick={() =>
                            askConfirm(t('inventory.deleteConfirm', { name: ing.name }), () => onDeleteIngredient(ing.id), true)
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 700 }} className={levelClass}>{ing.quantity}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{ing.unit}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {t('inventory.alertThreshold', { n: ing.minThreshold, unit: ing.unit })}
                      {usedIn > 0 && <> · {t('inventory.usedIn', { count: usedIn })}</>}
                    </div>
                    <div className="inventory-level-bar">
                      <div
                        className="inventory-level-fill"
                        style={{
                          width: `${Math.min(100, (ing.quantity / (ing.minThreshold * 3 || 1)) * 100)}%`,
                          backgroundColor: isOut ? 'var(--color-error)' : isLow ? 'var(--color-warning)' : 'var(--color-success)',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <button className="rest-btn rest-btn-secondary" style={{ flex: 1, padding: '4px' }} onClick={() => onAdjustStock(ing.id, -1)}>-</button>
                      <button className="rest-btn rest-btn-secondary" style={{ flex: 1, padding: '4px' }} onClick={() => onAdjustStock(ing.id, 1)}>+</button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
