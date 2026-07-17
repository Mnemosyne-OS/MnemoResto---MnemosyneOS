import { useState } from 'react';
import { Check, Edit, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useI18n } from '../i18n';
import { fmtMoney } from '../format';
import { comboALaCarteValue } from '../billing';
import type { Combo, ComboCourse, Ingredient, MenuItem, MenuItemIngredient, Settings } from '../types';

/** How many servings the current stock allows (Infinity when no recipe). */
export function servingsAvailable(item: MenuItem, ingredients: Ingredient[]): number {
  if (item.ingredients.length === 0) return Infinity;
  let servings = Infinity;
  for (const recipeIng of item.ingredients) {
    if (recipeIng.quantity <= 0) continue;
    const stock = ingredients.find((i) => i.id === recipeIng.ingredientId);
    // A vanished ingredient no longer constrains the dish (it cannot be deducted).
    if (!stock) continue;
    servings = Math.min(servings, Math.floor(stock.quantity / recipeIng.quantity));
  }
  return servings;
}

interface MenuForm {
  name: string;
  category: string;
  price: string;
  vatRate: string;
  ingredients: MenuItemIngredient[];
}

const EMPTY_FORM: MenuForm = { name: '', category: '', price: '', vatRate: '', ingredients: [] };

interface ComboCourseForm {
  id: string;
  label: string;
  optionIds: string[];
}

interface ComboFormState {
  name: string;
  price: string;
  vatRate: string;
  courses: ComboCourseForm[];
}

const EMPTY_COMBO_FORM: ComboFormState = { name: '', price: '', vatRate: '', courses: [] };

export function MenuManager({
  menu,
  combos,
  ingredients,
  settings,
  onSaveItem,
  onDeleteItem,
  onSaveCombo,
  onDeleteCombo,
  askConfirm,
}: {
  menu: MenuItem[];
  combos: Combo[];
  ingredients: Ingredient[];
  settings: Settings;
  onSaveItem: (item: Omit<MenuItem, 'id'>, editingId: string | null) => void;
  onDeleteItem: (id: string) => void;
  onSaveCombo: (combo: Omit<Combo, 'id'>, editingId: string | null) => void;
  onDeleteCombo: (id: string) => void;
  askConfirm: (message: string, onConfirm: () => void, danger?: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState<MenuForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [comboForm, setComboForm] = useState<ComboFormState>(EMPTY_COMBO_FORM);
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [showComboForm, setShowComboForm] = useState(false);

  const money = (n: number) => fmtMoney(n, settings.currency, lang);
  const dishName = (id: string) => menu.find((m) => m.id === id)?.name ?? '—';

  // Indicative summed value of the composition being edited (max option per course).
  const comboFormValue = comboALaCarteValue(
    { id: '', name: '', price: 0, courses: comboForm.courses as ComboCourse[] },
    menu
  );

  const startAddCombo = () => {
    setComboForm(EMPTY_COMBO_FORM);
    setEditingComboId(null);
    setShowComboForm(true);
  };

  const startEditCombo = (combo: Combo) => {
    setComboForm({
      name: combo.name,
      price: String(combo.price),
      vatRate: combo.vatRate !== undefined ? String(combo.vatRate) : '',
      courses: combo.courses.map((course) => ({ ...course, optionIds: [...course.optionIds] })),
    });
    setEditingComboId(combo.id);
    setShowComboForm(true);
  };

  const updateCourse = (index: number, patch: Partial<ComboCourseForm>) => {
    setComboForm((prev) => ({
      ...prev,
      courses: prev.courses.map((course, i) => (i === index ? { ...course, ...patch } : course)),
    }));
  };

  const submitCombo = (e: React.FormEvent) => {
    e.preventDefault();
    const name = comboForm.name.trim();
    const courses = comboForm.courses
      .map((course) => ({ ...course, label: course.label.trim() || '—', optionIds: course.optionIds }))
      .filter((course) => course.optionIds.length > 0);
    if (!name || courses.length === 0) return;
    const price = comboForm.price.trim() === '' ? comboFormValue : Number(comboForm.price);
    if (!isFinite(price) || price < 0) return;
    const vatRaw = comboForm.vatRate.trim();
    const vatNum = Number(vatRaw);
    const vatRate = vatRaw !== '' && isFinite(vatNum) && vatNum >= 0 ? vatNum : undefined;
    onSaveCombo({ name, price, vatRate, courses }, editingComboId);
    setShowComboForm(false);
    setComboForm(EMPTY_COMBO_FORM);
    setEditingComboId(null);
  };

  const startEdit = (item: MenuItem) => {
    setForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
      vatRate: item.vatRate !== undefined ? String(item.vatRate) : '',
      ingredients: item.ingredients.map((ing) => ({ ...ing })),
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name || !isFinite(price) || price < 0) return;
    const vatRaw = form.vatRate.trim();
    const vatNum = Number(vatRaw);
    onSaveItem(
      {
        name,
        category: form.category.trim() || '—',
        price,
        vatRate: vatRaw !== '' && isFinite(vatNum) && vatNum >= 0 ? vatNum : undefined,
        ingredients: form.ingredients.filter((ing) => ing.ingredientId && ing.quantity > 0),
      },
      editingId
    );
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const updateRecipeRow = (index: number, patch: Partial<MenuItemIngredient>) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };

  const categories = [...new Set(menu.map((m) => m.category))].sort((a, b) => a.localeCompare(b));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', flex: 1 }}>
      <div className="flex-row-between">
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UtensilsCrossed size={16} /> {t('nav.menu')}
          <span className="badge-count">{t('menu.itemsCount', { count: menu.length })}</span>
        </h3>
        <button className="rest-btn rest-btn-primary" onClick={startAdd}>
          <Plus size={14} /> {t('menu.addItem')}
        </button>
      </div>

      {showForm && (
        <form className="rest-card" onSubmit={submit}>
          <h3 className="rest-card-title">{editingId ? t('menu.editItem') : t('menu.addItem')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px' }}>
            <div className="rest-field">
              <label className="rest-field-label">{t('menu.itemName')}</label>
              <input
                required
                className="rest-input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="rest-field">
              <label className="rest-field-label">{t('menu.category')}</label>
              <input
                className="rest-input"
                list="menu-categories"
                placeholder={t('menu.categoryPlaceholder')}
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              />
              <datalist id="menu-categories">
                {categories.map((cat) => <option key={cat} value={cat} />)}
              </datalist>
            </div>
            <div className="rest-field">
              <label className="rest-field-label">{t('menu.price')} ({settings.currency})</label>
              <input
                required
                className="rest-input"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              />
            </div>
            <div className="rest-field">
              <label className="rest-field-label">{t('menu.vatRate')}</label>
              <input
                className="rest-input"
                type="number"
                min={0}
                step="0.1"
                placeholder={String(settings.vatRate)}
                value={form.vatRate}
                onChange={(e) => setForm((prev) => ({ ...prev, vatRate: e.target.value }))}
              />
            </div>
          </div>

          <div className="rest-field">
            <label className="rest-field-label">{t('menu.recipe')}</label>
            {form.ingredients.length === 0 && (
              <p className="dashboard-muted" style={{ margin: '2px 0' }}>{t('menu.noIngredients')}</p>
            )}
            {form.ingredients.map((row, index) => {
              const stockIng = ingredients.find((i) => i.id === row.ingredientId);
              return (
                <div key={index} className="menu-recipe-row">
                  <select
                    className="rest-select"
                    style={{ flex: 1 }}
                    value={row.ingredientId}
                    onChange={(e) => updateRecipeRow(index, { ingredientId: e.target.value })}
                  >
                    <option value="">{t('menu.selectIngredient')}</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                    ))}
                  </select>
                  <input
                    className="rest-input"
                    type="number"
                    min={0}
                    step="0.01"
                    style={{ width: '110px' }}
                    placeholder={t('menu.qtyPerServing')}
                    value={row.quantity || ''}
                    onChange={(e) => updateRecipeRow(index, { quantity: Number(e.target.value) })}
                  />
                  <span className="menu-recipe-unit">{stockIng?.unit ?? ''}</span>
                  <button
                    type="button"
                    className="rest-btn rest-btn-danger"
                    style={{ padding: '6px 8px' }}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) }))
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="rest-btn rest-btn-secondary"
              style={{ alignSelf: 'flex-start' }}
              onClick={() =>
                setForm((prev) => ({ ...prev, ingredients: [...prev.ingredients, { ingredientId: '', quantity: 1 }] }))
              }
            >
              <Plus size={12} /> {t('menu.addIngredient')}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="rest-btn rest-btn-secondary" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="rest-btn rest-btn-primary">
              <Check size={14} /> {t('common.save')}
            </button>
          </div>
        </form>
      )}

      <div className="rest-scrollable" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {menu.length === 0 && !showForm && (
          <div className="rest-empty-hint">{t('menu.empty')}</div>
        )}
        {categories.map((cat) => (
          <div key={cat}>
            <h4 className="menu-category-title">{cat}</h4>
            <div className="menu-items-grid">
              {menu
                .filter((m) => m.category === cat)
                .map((item) => {
                  const servings = servingsAvailable(item, ingredients);
                  return (
                    <div key={item.id} className="rest-card menu-item-card">
                      <div className="flex-row-between">
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</span>
                        <span className="pos-menu-price">{money(item.price)}</span>
                      </div>
                      <div className="menu-item-meta">
                        {item.ingredients.length > 0 ? (
                          <span className={servings === 0 ? 'stock-danger' : servings <= 5 ? 'stock-warning' : 'stock-safe'}>
                            {servings === 0
                              ? t('pos.outOfStock')
                              : t('menu.servingsAvailable', { count: servings === Infinity ? '∞' : servings })}
                          </span>
                        ) : (
                          <span className="dashboard-muted">{t('menu.noIngredients')}</span>
                        )}
                        {item.vatRate !== undefined && (
                          <span className="menu-vat-badge">{t('pos.vat', { rate: item.vatRate })}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button className="rest-btn rest-btn-secondary" style={{ flex: 1, padding: '5px' }} onClick={() => startEdit(item)}>
                          <Edit size={12} /> {t('common.edit')}
                        </button>
                        <button
                          className="rest-btn rest-btn-danger"
                          style={{ padding: '5px 10px' }}
                          onClick={() =>
                            askConfirm(t('menu.deleteConfirm', { name: item.name }), () => onDeleteItem(item.id), true)
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        {/* ── Set menus ("formules") ─────────────────────────────────────── */}
        <div className="combo-section">
          <div className="flex-row-between">
            <h4 className="menu-category-title" style={{ margin: 0 }}>★ {t('pos.combos')}</h4>
            <button className="rest-btn rest-btn-secondary" onClick={startAddCombo}>
              <Plus size={13} /> {t('combo.addCombo')}
            </button>
          </div>

          {showComboForm && (
            <form className="rest-card" onSubmit={submitCombo}>
              <h3 className="rest-card-title">{editingComboId ? t('combo.editCombo') : t('combo.addCombo')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                <div className="rest-field">
                  <label className="rest-field-label">{t('combo.name')}</label>
                  <input
                    required
                    className="rest-input"
                    value={comboForm.name}
                    onChange={(e) => setComboForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="rest-field">
                  <label className="rest-field-label">{t('combo.price', { currency: settings.currency })}</label>
                  <input
                    className="rest-input"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={comboFormValue > 0 ? comboFormValue.toFixed(2) : ''}
                    value={comboForm.price}
                    onChange={(e) => setComboForm((prev) => ({ ...prev, price: e.target.value }))}
                  />
                  <span className="settings-hint">{t('combo.priceHint')}</span>
                </div>
                <div className="rest-field">
                  <label className="rest-field-label">{t('menu.vatRate')}</label>
                  <input
                    className="rest-input"
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder={String(settings.vatRate)}
                    value={comboForm.vatRate}
                    onChange={(e) => setComboForm((prev) => ({ ...prev, vatRate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="rest-field">
                <div className="flex-row-between">
                  <label className="rest-field-label">
                    {t('combo.composition')} — {t('combo.alaCarteValue', { value: money(comboFormValue) })}
                  </label>
                </div>
                {comboForm.courses.map((course, index) => (
                  <div key={course.id} className="combo-course-editor">
                    <div className="combo-course-head">
                      <input
                        className="rest-input"
                        style={{ flex: 1 }}
                        placeholder={t('combo.courseLabelPlaceholder')}
                        value={course.label}
                        onChange={(e) => updateCourse(index, { label: e.target.value })}
                      />
                      <button
                        type="button"
                        className="rest-btn rest-btn-danger"
                        style={{ padding: '6px 8px' }}
                        onClick={() =>
                          setComboForm((prev) => ({ ...prev, courses: prev.courses.filter((_, i) => i !== index) }))
                        }
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="combo-option-chips">
                      {course.optionIds.map((optionId) => (
                        <span key={optionId} className="combo-option-chip">
                          {dishName(optionId)}
                          <button
                            type="button"
                            className="crm-allergy-remove"
                            onClick={() =>
                              updateCourse(index, { optionIds: course.optionIds.filter((id) => id !== optionId) })
                            }
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      <select
                        className="rest-select"
                        value=""
                        onChange={(e) => {
                          const id = e.target.value;
                          if (id && !course.optionIds.includes(id)) {
                            updateCourse(index, { optionIds: [...course.optionIds, id] });
                          }
                        }}
                      >
                        <option value="">{t('combo.selectDish')}</option>
                        {menu
                          .filter((item) => !course.optionIds.includes(item.id))
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({money(item.price)})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="rest-btn rest-btn-secondary"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() =>
                    setComboForm((prev) => ({
                      ...prev,
                      courses: [
                        ...prev.courses,
                        { id: 'cc_' + Math.random().toString(36).substring(7), label: '', optionIds: [] },
                      ],
                    }))
                  }
                >
                  <Plus size={12} /> {t('combo.addCourse')}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="rest-btn rest-btn-secondary" onClick={() => setShowComboForm(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="rest-btn rest-btn-primary">
                  <Check size={14} /> {t('common.save')}
                </button>
              </div>
            </form>
          )}

          {combos.length === 0 && !showComboForm ? (
            <p className="dashboard-muted">{t('combo.empty')}</p>
          ) : (
            <div className="menu-items-grid">
              {combos.map((combo) => (
                <div key={combo.id} className="rest-card menu-item-card combo-card">
                  <div className="flex-row-between">
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>★ {combo.name}</span>
                    <span className="pos-menu-price">{money(combo.price)}</span>
                  </div>
                  <div className="combo-card-courses">
                    {combo.courses.map((course) => (
                      <div key={course.id} className="combo-card-course">
                        <span className="combo-card-course-label">{course.label} :</span>{' '}
                        {course.optionIds.map(dishName).join(' / ')}
                      </div>
                    ))}
                  </div>
                  <div className="menu-item-meta dashboard-muted">
                    {t('combo.alaCarteValue', { value: money(comboALaCarteValue(combo, menu)) })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button className="rest-btn rest-btn-secondary" style={{ flex: 1, padding: '5px' }} onClick={() => startEditCombo(combo)}>
                      <Edit size={12} /> {t('common.edit')}
                    </button>
                    <button
                      className="rest-btn rest-btn-danger"
                      style={{ padding: '5px 10px' }}
                      onClick={() =>
                        askConfirm(t('combo.deleteConfirm', { name: combo.name }), () => onDeleteCombo(combo.id), true)
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
