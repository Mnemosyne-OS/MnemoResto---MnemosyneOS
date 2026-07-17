import React from 'react';

/**
 * Minimal chat-oriented Markdown renderer — covers what LLM answers actually
 * use: **bold**, *italic*, `code`, # headings, bullet/numbered lists and
 * ``` code fences. Builds React elements only (never raw HTML), so model
 * output can't inject markup. Zero dependencies by design: the cartridge
 * avoids pnpm churn on the shared lockfile.
 */

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const token = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const tok = match[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('`')) {
      nodes.push(<code key={key} className="ai-md-code">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = match.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBER_RE = /^\s*\d+[.)]\s+(.*)$/;
const HEADING_RE = /^#{1,4}\s+(.*)$/;

export function Markdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let fence: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      const key = `p-${blocks.length}`;
      blocks.push(<p key={key} className="ai-md-p">{renderInline(paragraph.join(' '), key)}</p>);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list) {
      const key = `l-${blocks.length}`;
      const items = list.items.map((item, i) => <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>);
      blocks.push(list.ordered
        ? <ol key={key} className="ai-md-list">{items}</ol>
        : <ul key={key} className="ai-md-list">{items}</ul>);
      list = null;
    }
  };

  for (const line of lines) {
    if (fence) {
      if (line.trim().startsWith('```')) {
        blocks.push(<pre key={`f-${blocks.length}`} className="ai-md-pre">{fence.join('\n')}</pre>);
        fence = null;
      } else {
        fence.push(line);
      }
      continue;
    }
    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushList();
      fence = [];
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    const numbered = bullet ? null : NUMBER_RE.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const key = `h-${blocks.length}`;
      blocks.push(<p key={key} className="ai-md-heading">{renderInline(heading[1], key)}</p>);
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (fence) blocks.push(<pre key={`f-${blocks.length}`} className="ai-md-pre">{fence.join('\n')}</pre>);
  flushParagraph();
  flushList();

  return <>{blocks}</>;
}
