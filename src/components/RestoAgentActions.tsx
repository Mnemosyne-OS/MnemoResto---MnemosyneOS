/**
 * RestoAgentActions — serves MnemoResto's agent actions (doc 149) while the
 * window is open. A CHILD that renders nothing, never a hook in App: App stays
 * mounted on the person's board, and a hook added to it breaks its hook order
 * under hot reload. The handlers live in agent.ts; this keeps their view of
 * the App fresh (a ref written every render), subscribes ONCE, and tells a
 * handler when a save has been rendered (so its answer reads what was saved).
 */
import { useEffect, useRef } from 'react';
import { MnemoCartridgeSDK } from '../sdk/mnemo-sdk';
import { restoAgentHandlers, type RestoAgentContext } from '../agent';

const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-resto');

/** A save that changes nothing renders nothing: past this the handler goes on. */
const RENDER_WAIT_MS = 1_000;

type Props = Omit<RestoAgentContext, 'rendered'>;

export function RestoAgentActions(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const waiters = useRef<Array<() => void>>([]);

  // After every commit: whoever waited for a render goes on.
  useEffect(() => {
    const ready = waiters.current.splice(0);
    ready.forEach((resolve) => resolve());
  });

  useEffect(() => {
    // Outside the shell nobody calls (a plain tab, the tests).
    if (typeof window === 'undefined' || window.parent === window) return undefined;
    if (typeof sdk.onAgentActions !== 'function') {
      // An iframe served an older SDK build: it must not take the window down.
      console.warn('[RestaurantManager] this SDK build has no onAgentActions; reload the cartridge to serve agent actions');
      return undefined;
    }
    const rendered = () => new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, RENDER_WAIT_MS);
      waiters.current.push(() => { window.clearTimeout(timer); resolve(); });
    });
    const sub = sdk.onAgentActions(restoAgentHandlers(() => ({ ...latest.current, rendered })));
    sub.ready.catch((err: unknown) => console.warn('[RestaurantManager] agent actions not served:', err instanceof Error ? err.message : err));
    return () => {
      sub.off();
      waiters.current.splice(0).forEach((resolve) => resolve());
    };
  }, []);

  return null;
}
