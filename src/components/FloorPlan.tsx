import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { WheelDateTimePicker } from './WheelDateTimePicker';
import type { Client, Server, Table, TableShape, TableStatus } from '../types';

/** Compact initials for the floor-plan server badge ("Jean P" → "JP"). */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

/** Minutes until the reservation (negative = late) and a HH:mm label. */
function resaInfo(table: Table, nowMs: number): { time: string; minutes: number } | null {
  if (table.status !== 'reserved' || !table.reservedAt) return null;
  const d = new Date(table.reservedAt);
  if (isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return { time: `${p(d.getHours())}:${p(d.getMinutes())}`, minutes: Math.round((d.getTime() - nowMs) / 60_000) };
}

export function FloorPlan({
  tables,
  clients,
  servers,
  selectedTableId,
  onSelectTable,
  onUpdateTables,
  onAddTable,
  onDeleteTable,
  onManageOrder,
  askConfirm,
}: {
  tables: Table[];
  clients: Client[];
  servers: Server[];
  selectedTableId: string | null;
  onSelectTable: (id: string | null) => void;
  onUpdateTables: (updater: (prev: Table[]) => Table[]) => void;
  onAddTable: (shape: TableShape) => void;
  onDeleteTable: (id: string) => void;
  onManageOrder: () => void;
  askConfirm: (message: string, onConfirm: () => void, danger?: boolean) => void;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [notice, setNotice] = useState('');

  // Live clock for the reservation countdown badges.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Info banner auto-dismiss (non-blocking counterpart to askConfirm).
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const activeTable = tables.find((tb) => tb.id === selectedTableId) || null;
  const activeClient = activeTable?.clientId ? clients.find((c) => c.id === activeTable.clientId) : undefined;
  const totalSeats = tables.reduce((sum, tb) => sum + tb.capacity, 0);
  const occupied = tables.filter((tb) => tb.status === 'occupied').length;

  const handleTableMouseDown = (e: React.MouseEvent, table: Table) => {
    onSelectTable(table.id);
    setIsDragging(true);
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    if (canvasBounds) {
      setDragOffset({
        x: e.clientX - canvasBounds.left - table.x,
        y: e.clientY - canvasBounds.top - table.y,
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedTableId) return;
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    if (canvasBounds) {
      const newX = Math.max(10, Math.min(canvasBounds.width - 150, e.clientX - canvasBounds.left - dragOffset.x));
      const newY = Math.max(10, Math.min(canvasBounds.height - 150, e.clientY - canvasBounds.top - dragOffset.y));
      onUpdateTables((prev) =>
        prev.map((tb) => (tb.id === selectedTableId ? { ...tb, x: Math.round(newX), y: Math.round(newY) } : tb))
      );
    }
  };

  const updateTableField = <K extends keyof Table>(field: K, value: Table[K]) => {
    if (!selectedTableId) return;
    onUpdateTables((prev) => prev.map((tb) => (tb.id === selectedTableId ? { ...tb, [field]: value } : tb)));
  };

  const setStatus = (status: TableStatus) => {
    if (!selectedTableId) return;
    onUpdateTables((prev) =>
      prev.map((tb) =>
        tb.id === selectedTableId
          ? // The arrival time only makes sense while the table is reserved.
            { ...tb, status, reservedAt: status === 'reserved' ? tb.reservedAt : undefined }
          : tb
      )
    );
  };

  // ── Client assignment rules ─────────────────────────────────────────────
  // One client = one table. On top of that, honour the client's favourite
  // table: offer it when free, offer a reservation swap when another client
  // holds it, and just inform when guests are already seated there.

  // `snapshot` lets a chained call (after a move) evaluate the tables as they
  // will be AFTER that move — the `tables` prop still holds the pre-move state.
  const suggestFavourite = (client: Client, targetId: string, snapshot: Table[] = tables) => {
    if (!client.favTable) return;
    const fav = snapshot.find((tb) => tb.name === client.favTable);
    if (!fav || fav.id === targetId) return;

    if (fav.status === 'vacant') {
      askConfirm(t('floor.favFree', { table: fav.name, client: client.name }), () => {
        onUpdateTables((prev) => {
          const target = prev.find((tb) => tb.id === targetId);
          return prev.map((tb) => {
            if (tb.id === fav.id) return { ...tb, clientId: client.id, status: 'reserved', reservedAt: target?.reservedAt };
            if (tb.id === targetId) return { ...tb, clientId: undefined, status: 'vacant', reservedAt: undefined };
            return tb;
          });
        });
        onSelectTable(fav.id);
      });
    } else if (fav.status === 'reserved' && fav.clientId && fav.clientId !== client.id) {
      const otherClient = clients.find((c) => c.id === fav.clientId);
      askConfirm(
        t('floor.favSwap', { table: fav.name, client: client.name, other: otherClient?.name ?? '—' }),
        () => {
          onUpdateTables((prev) => {
            const target = prev.find((tb) => tb.id === targetId);
            const favNow = prev.find((tb) => tb.id === fav.id);
            if (!target || !favNow) return prev;
            // Reservations (client + expected time) swap; the tables stay put.
            return prev.map((tb) => {
              if (tb.id === fav.id) return { ...tb, clientId: client.id, reservedAt: target.reservedAt };
              if (tb.id === targetId) return { ...tb, clientId: favNow.clientId, reservedAt: favNow.reservedAt };
              return tb;
            });
          });
          onSelectTable(fav.id);
        }
      );
    } else if (fav.status === 'occupied' || fav.status === 'billed') {
      setNotice(t('floor.favBusy', { client: client.name, table: fav.name }));
    }
  };

  const assignClient = (clientId: string) => {
    if (!selectedTableId) return;
    const target = tables.find((tb) => tb.id === selectedTableId);
    if (!target) return;

    if (!clientId) {
      onUpdateTables((prev) =>
        prev.map((tb) =>
          tb.id === target.id ? { ...tb, clientId: undefined, status: 'vacant', reservedAt: undefined } : tb
        )
      );
      return;
    }

    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const other = tables.find((tb) => tb.id !== target.id && tb.clientId === clientId);
    if (other) {
      if (other.status === 'occupied' || other.status === 'billed') {
        setNotice(t('floor.alreadySeated', { client: client.name, table: other.name }));
        return;
      }
      const applyMove = (prev: Table[]): Table[] => {
        const otherNow = prev.find((tb) => tb.id === other.id);
        return prev.map((tb) => {
          if (tb.id === other.id) return { ...tb, clientId: undefined, status: 'vacant', reservedAt: undefined };
          if (tb.id === target.id) return { ...tb, clientId, status: 'reserved', reservedAt: otherNow?.reservedAt };
          return tb;
        });
      };
      askConfirm(
        t('floor.moveReservation', { client: client.name, table: other.name, target: target.name }),
        () => {
          onUpdateTables(applyMove);
          suggestFavourite(client, target.id, applyMove(tables));
        }
      );
      return;
    }

    onUpdateTables((prev) =>
      prev.map((tb) => (tb.id === target.id ? { ...tb, clientId, status: 'reserved' } : tb))
    );
    suggestFavourite(client, target.id);
  };

  const activeResa = activeTable ? resaInfo(activeTable, nowMs) : null;

  return (
    <div className="floor-layout">
      <div className="floor-toolbox">
        <div className="rest-card">
          <h3 className="rest-card-title">{t('floor.addTable')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <button className="rest-btn rest-btn-secondary" onClick={() => onAddTable('circle')}>◯ {t('floor.round')}</button>
            <button className="rest-btn rest-btn-secondary" onClick={() => onAddTable('square')}>☐ {t('floor.square')}</button>
            <button className="rest-btn rest-btn-secondary" onClick={() => onAddTable('rectangle')}>▭ {t('floor.rect')}</button>
          </div>
          <p className="floor-summary-line">
            {t('floor.summary', { tables: tables.length, seats: totalSeats, occupied })}
          </p>
        </div>

        {notice && <div className="floor-notice">{notice}</div>}

        {activeTable ? (
          <div className="rest-card">
            <div className="flex-row-between">
              <h3 className="rest-card-title">{t('floor.tableDetails')}</h3>
              <button
                className="rest-btn rest-btn-danger"
                style={{ padding: '4px 8px' }}
                onClick={() =>
                  askConfirm(t('floor.deleteConfirm', { name: activeTable.name }), () => onDeleteTable(activeTable.id), true)
                }
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="rest-field-label">{t('common.name')}</label>
              <input
                className="rest-input"
                value={activeTable.name}
                onChange={(e) => updateTableField('name', e.target.value)}
              />

              <label className="rest-field-label">{t('floor.capacity')}</label>
              <input
                className="rest-input"
                type="number"
                min={1}
                value={activeTable.capacity}
                onChange={(e) => updateTableField('capacity', Math.max(1, Number(e.target.value)))}
              />

              <label className="rest-field-label">{t('floor.status')}</label>
              <select
                className="rest-select"
                value={activeTable.status}
                onChange={(e) => setStatus(e.target.value as TableStatus)}
              >
                <option value="vacant">{t('status.vacant')}</option>
                <option value="occupied">{t('status.occupied')}</option>
                <option value="reserved">{t('status.reserved')}</option>
                <option value="billed">{t('status.billed')}</option>
              </select>

              <label className="rest-field-label">{t('floor.assignedClient')}</label>
              <select
                className="rest-select"
                value={activeTable.clientId || ''}
                onChange={(e) => assignClient(e.target.value)}
              >
                <option value="">{t('common.none')}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <label className="rest-field-label">{t('floor.server')}</label>
              <select
                className="rest-select"
                value={activeTable.serverId || ''}
                onChange={(e) => updateTableField('serverId', e.target.value || undefined)}
              >
                <option value="">{t('common.none')}</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {activeTable.status === 'reserved' && (
                <>
                  <label className="rest-field-label">{t('floor.reservationTime')}</label>
                  <WheelDateTimePicker
                    value={activeTable.reservedAt}
                    onChange={(iso) => updateTableField('reservedAt', iso)}
                  />
                  {activeResa && (
                    <p className={`floor-resa-line ${activeResa.minutes <= 0 ? 'resa-late' : activeResa.minutes <= 15 ? 'resa-soon' : ''}`}>
                      ⏱ {activeResa.time} ·{' '}
                      {activeResa.minutes <= 0
                        ? t('floor.resaLate', { min: Math.abs(activeResa.minutes) })
                        : t('floor.resaIn', { min: activeResa.minutes })}
                    </p>
                  )}
                </>
              )}

              {activeClient && (
                <div className="floor-client-info">
                  <span className="floor-client-info-title">{t('floor.clientPrefs')}</span>
                  <p>{activeClient.preferences || t('floor.noPrefs')}</p>
                  {activeClient.allergies.length > 0 && (
                    <p className="floor-client-allergies">
                      ⚠️ {t('floor.allergies', { list: activeClient.allergies.join(', ') })}
                    </p>
                  )}
                </div>
              )}

              {activeTable.status === 'occupied' && (
                <button className="rest-btn rest-btn-primary" onClick={onManageOrder}>
                  📝 {t('floor.manageOrder')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rest-card floor-hint-card">
            <p>{t('floor.selectHint')}</p>
          </div>
        )}
      </div>

      <div
        className="floor-canvas-container"
        ref={canvasRef}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        <div className="floor-canvas">
          {tables.map((table) => {
            const client = clients.find((c) => c.id === table.clientId);
            const server = servers.find((s) => s.id === table.serverId);
            const resa = resaInfo(table, nowMs);
            return (
              <div
                key={table.id}
                className={`floor-table shape-${table.shape} status-${table.status} ${selectedTableId === table.id ? 'selected' : ''}`}
                style={{
                  left: `${table.x}px`,
                  top: `${table.y}px`,
                  width: `${table.width}px`,
                  height: `${table.height}px`,
                }}
                onMouseDown={(e) => handleTableMouseDown(e, table)}
              >
                {server && (
                  <span className="table-server-badge" style={{ backgroundColor: server.color }} title={server.name}>
                    {initials(server.name)}
                  </span>
                )}
                <span className="table-label">{table.name}</span>
                <span className="table-capacity">{t('floor.capacityShort', { n: table.capacity })}</span>
                {client && <span className="table-guest-name">{client.name}</span>}
                {resa && (
                  <span
                    className={`table-resa-badge ${resa.minutes <= 0 ? 'resa-late' : resa.minutes <= 15 ? 'resa-soon' : ''}`}
                  >
                    ⏱ {resa.time}
                    {resa.minutes <= 0
                      ? ` · ${t('floor.resaLate', { min: Math.abs(resa.minutes) })}`
                      : resa.minutes <= 60
                        ? ` · ${t('floor.resaIn', { min: resa.minutes })}`
                        : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
