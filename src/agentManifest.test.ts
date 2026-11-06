/**
 * MnemoResto's agent actions (doc 149): the manifest's declaration passes the
 * HOST's own check, and every declared action has its handler (a declared
 * action without one would be offered to agents and fail).
 *
 * MnemoResto installs no vitest yet: run with a sibling's, from this folder:
 *   ../mnemo-ember/node_modules/.bin/vitest run --root . --dir src
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentActionsFromManifest } from '../../infinity-edition/src/main/plugins/cartridgeAgentActions';
import { restoAgentHandlers, TABS } from './agent';

const root = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'mnemo-plugin.json'), 'utf8')) as unknown;
const source = readFileSync(join(root, 'src', 'agent.ts'), 'utf8');
const block = source.slice(source.indexOf('// agent-actions:begin'), source.indexOf('// agent-actions:end'));
const handlers = [...block.matchAll(/^ {4}(\w+): (?:async )?\(/gm)].map((m) => m[1]);

function declared() {
  const r = agentActionsFromManifest(manifest);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe("MnemoResto's agent actions", () => {
  it("pass the host's check of the manifest", () => {
    const r = agentActionsFromManifest(manifest);
    expect(r.ok ? 'ok' : r.error).toBe('ok');
  });

  it('every declared action has its handler, and no handler is undeclared', () => {
    expect(handlers.length).toBeGreaterThan(5);
    expect([...handlers].sort()).toEqual(declared().map((a) => a.id).sort());
    expect(Object.keys(restoAgentHandlers(() => { throw new Error('unused'); })).sort()).toEqual([...handlers].sort());
  });

  it('nothing spends credits (the copilot stays out), and the four lists are the reads', () => {
    expect(declared().filter((a) => a.effect === 'spend')).toEqual([]);
    expect(declared().filter((a) => a.effect === 'read').map((a) => a.id).sort()).toEqual(['clients', 'menu', 'stock', 'tables']);
  });

  it('no action touches orders, the till or invoices (doc 124)', () => {
    expect(declared().map((a) => a.id).filter((id) => /order|cart|bill|checkout|invoice|pay/i.test(id))).toEqual([]);
  });

  it("the tabs it offers are the header's own", () => {
    const p = declared().find((a) => a.id === 'openTab')!.params.tab;
    expect(p?.type === 'string' ? p.enum : null).toEqual([...TABS]);
  });
});
