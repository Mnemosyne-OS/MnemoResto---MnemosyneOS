import { Brain, Send, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { Markdown } from './Markdown';
import type { Message } from '../types';

export function AiCopilot({
  messages,
  input,
  sending,
  onInputChange,
  onSend,
  onClose,
}: {
  messages: Message[];
  input: string;
  sending: boolean;
  onInputChange: (value: string) => void;
  onSend: (presetPrompt?: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <aside className="ai-companion-drawer">
      <div className="ai-companion-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={18} color="#8b5cf6" />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('ai.title')}</span>
        </div>
        <button className="ai-close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="ai-companion-messages rest-scrollable">
        {messages.map((msg, index) => (
          <div key={index} className={`ai-msg ai-msg-${msg.role}`}>
            {msg.role === 'assistant' ? <Markdown text={msg.content} /> : msg.content}
          </div>
        ))}
        {sending && (
          <div className="ai-msg ai-msg-assistant" style={{ fontStyle: 'italic', opacity: 0.7 }}>
            {t('ai.thinking')}
          </div>
        )}
      </div>

      <div className="ai-presets-row">
        <button className="rest-btn rest-btn-secondary ai-preset-btn" onClick={() => onSend(t('ai.presetStock'))}>
          {t('ai.presetStock')}
        </button>
        <button className="rest-btn rest-btn-secondary ai-preset-btn" onClick={() => onSend(t('ai.presetSales'))}>
          {t('ai.presetSales')}
        </button>
        <button className="rest-btn rest-btn-secondary ai-preset-btn" onClick={() => onSend(t('ai.presetVip'))}>
          {t('ai.presetVip')}
        </button>
      </div>

      <div className="ai-companion-input-container">
        <input
          className="rest-input"
          style={{ flex: 1 }}
          placeholder={t('ai.placeholder')}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend();
          }}
        />
        <button className="rest-btn rest-btn-primary" style={{ padding: '8px' }} onClick={() => onSend()}>
          <Send size={14} />
        </button>
      </div>
    </aside>
  );
}
