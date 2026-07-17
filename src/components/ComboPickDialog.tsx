import { useState } from 'react';
import { useI18n } from '../i18n';
import { fmtMoney } from '../format';
import type { Combo, MenuItem, Settings } from '../types';

/**
 * "Compose the set menu" dialog: one radio group per course. Courses with a
 * single option are shown as fixed lines. Confirms with one pick per course.
 */
export function ComboPickDialog({
  combo,
  menu,
  settings,
  onConfirm,
  onClose,
}: {
  combo: Combo;
  menu: MenuItem[];
  settings: Settings;
  onConfirm: (picks: string[]) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [picks, setPicks] = useState<string[]>(() =>
    combo.courses.map((course) => course.optionIds[0] ?? '')
  );

  const dishName = (id: string) => menu.find((m) => m.id === id)?.name ?? '—';

  return (
    <div className="rest-modal-overlay" onClick={onClose}>
      <div className="rest-card rest-confirm-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="rest-card-title">
          {t('combo.choose')} — {combo.name}
          <span className="pos-menu-price" style={{ marginLeft: 'auto' }}>
            {fmtMoney(combo.price, settings.currency, lang)}
          </span>
        </h3>

        <div className="combo-pick-courses rest-scrollable">
          {combo.courses.map((course, courseIndex) => (
            <div key={course.id} className="combo-pick-course">
              <span className="rest-field-label">{course.label}</span>
              {course.optionIds.length <= 1 ? (
                <p className="combo-pick-fixed">{course.optionIds[0] ? dishName(course.optionIds[0]) : '—'}</p>
              ) : (
                course.optionIds.map((optionId) => (
                  <label key={optionId} className="combo-pick-option">
                    <input
                      type="radio"
                      name={`course-${course.id}`}
                      checked={picks[courseIndex] === optionId}
                      onChange={() =>
                        setPicks((prev) => prev.map((p, i) => (i === courseIndex ? optionId : p)))
                      }
                    />
                    <span>{dishName(optionId)}</span>
                  </label>
                ))
              )}
            </div>
          ))}
        </div>

        <div className="rest-confirm-actions">
          <button className="rest-btn rest-btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="rest-btn rest-btn-primary"
            onClick={() => {
              onClose();
              onConfirm(picks.filter(Boolean));
            }}
          >
            {t('common.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
