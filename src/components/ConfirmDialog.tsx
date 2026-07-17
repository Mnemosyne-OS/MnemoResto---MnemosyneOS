import { useI18n } from '../i18n';

export interface ConfirmRequest {
  message: string;
  danger?: boolean;
  onConfirm: () => void;
}

/**
 * In-app replacement for window.confirm — native dialogs are silently blocked
 * inside the sandboxed cartridge iframe (no `allow-modals`), so a real modal
 * is the only way a destructive action can actually be confirmed.
 */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const { t } = useI18n();
  if (!request) return null;

  return (
    <div className="rest-modal-overlay" onClick={onClose}>
      <div className="rest-card rest-confirm-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="rest-card-title">{t('confirm.title')}</h3>
        <p className="rest-confirm-message">{request.message}</p>
        <div className="rest-confirm-actions">
          <button className="rest-btn rest-btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className={`rest-btn ${request.danger ? 'rest-btn-danger' : 'rest-btn-primary'}`}
            onClick={() => {
              // Close BEFORE confirming so onConfirm may chain a follow-up
              // dialog without this close wiping it out.
              onClose();
              request.onConfirm();
            }}
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
