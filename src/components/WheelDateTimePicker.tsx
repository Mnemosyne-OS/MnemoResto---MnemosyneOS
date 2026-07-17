import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useI18n, type LangCode } from '../i18n';

const ITEM_H = 28;
const DAYS_AHEAD = 30;

const INTL_LOCALE: Record<LangCode, string> = { en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** One iOS-style drum: scroll-snapped column with a highlighted centre row. */
function Wheel({
  items,
  selectedIndex,
  onSelect,
  grow,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  grow?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);

  // Keep the drum aligned with the value whenever it changes from outside.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = selectedIndex * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTo({ top: target });
  }, [selectedIndex, items.length]);

  useEffect(() => () => {
    if (settleTimer.current !== undefined) window.clearTimeout(settleTimer.current);
  }, []);

  // Report the row the drum settles on (CSS snap does the physical snapping).
  const handleScroll = () => {
    if (settleTimer.current !== undefined) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
      if (idx !== selectedIndex) onSelect(idx);
    }, 140);
  };

  return (
    <div className={`wheel-col ${grow ? 'wheel-col-grow' : ''}`}>
      <div className="wheel-scroll" ref={ref} onScroll={handleScroll}>
        {items.map((label, i) => (
          <div
            key={i}
            className={`wheel-item ${i === selectedIndex ? 'wheel-item-active' : ''}`}
            onClick={() => {
              ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
              onSelect(i);
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="wheel-highlight" />
    </div>
  );
}

/**
 * iPhone-style day / hour / minute drum picker for the reservation time.
 * Collapsed it shows the formatted value; the drums expand on demand.
 */
export function WheelDateTimePicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (iso: string | undefined) => void;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);

  const current = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  // Day drum: today → +30 days, plus the stored day when out of range.
  const days = useMemo(() => {
    const today = atMidnight(new Date());
    const list: Date[] = [];
    if (current && atMidnight(current).getTime() < today.getTime()) list.push(atMidnight(current));
    for (let i = 0; i <= DAYS_AHEAD; i++) {
      list.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
    }
    if (current && atMidnight(current).getTime() > list[list.length - 1].getTime()) {
      list.push(atMidnight(current));
    }
    return list;
  }, [current]);

  const dayLabel = (d: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (sameDay(d, today)) return t('invoices.today');
    if (sameDay(d, tomorrow)) return t('floor.tomorrow');
    return new Intl.DateTimeFormat(INTL_LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  };

  // Minute drum in 5-min steps, keeping an off-grid stored minute selectable.
  const minutes = useMemo(() => {
    const list = Array.from({ length: 12 }, (_, i) => i * 5);
    if (current && !list.includes(current.getMinutes())) {
      list.push(current.getMinutes());
      list.sort((a, b) => a - b);
    }
    return list;
  }, [current]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const dayIndex = current ? Math.max(0, days.findIndex((d) => sameDay(d, current))) : 0;
  const hourIndex = current ? current.getHours() : 0;
  const minuteIndex = current ? Math.max(0, minutes.indexOf(current.getMinutes())) : 0;

  const compose = (day: Date, hour: number, minute: number) => {
    onChange(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute).toISOString());
  };

  const openPicker = () => {
    if (!current) {
      // Sensible default: next full 5 minutes one hour from now.
      const d = new Date(Date.now() + 60 * 60_000);
      d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
      onChange(d.toISOString());
    }
    setOpen(true);
  };

  return (
    <div className="wheel-picker">
      <div className="wheel-trigger-row">
        <button type="button" className="wheel-trigger" onClick={() => (open ? setOpen(false) : openPicker())}>
          <span>
            {current
              ? `${dayLabel(current)} · ${p2(current.getHours())}:${p2(current.getMinutes())}`
              : `⏱ ${t('floor.reservationTime')}`}
          </span>
          <ChevronDown size={14} className={`wheel-chevron ${open ? 'open' : ''}`} />
        </button>
        {current && (
          <button
            type="button"
            className="wheel-clear"
            title={t('common.delete')}
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && current && (
        <div className="wheel-drums">
          <Wheel
            grow
            items={days.map(dayLabel)}
            selectedIndex={dayIndex}
            onSelect={(i) => compose(days[i], current.getHours(), current.getMinutes())}
          />
          <Wheel
            items={hours.map(p2)}
            selectedIndex={hourIndex}
            onSelect={(i) => compose(days[dayIndex], hours[i], current.getMinutes())}
          />
          <Wheel
            items={minutes.map(p2)}
            selectedIndex={minuteIndex}
            onSelect={(i) => compose(days[dayIndex], current.getHours(), minutes[i])}
          />
        </div>
      )}
    </div>
  );
}
