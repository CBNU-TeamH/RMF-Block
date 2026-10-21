"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";

/** Which floating window is in front (#144). The chat window and every floating
 *  view share one order, back to front, so the one in use is never under another. */

/** The backmost window's `z-index`. Five views and the chat window end at 39:
 *  over the chat bar (`z-30`), under the shell's menus (`z-40`). */
const BASE = 34;

type Stack = {
  order: Array<string>;
  raise: (key: string) => void;
  drop: (key: string) => void;
};

const StackContext = createContext<Stack>({ order: [], raise: () => undefined, drop: () => undefined });

export function WindowStackProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrder] = useState<Array<string>>([]);
  const raise = useCallback(
    (key: string) =>
      setOrder((current) => (current.at(-1) === key ? current : [...current.filter((k) => k !== key), key])),
    [],
  );
  const drop = useCallback((key: string) => setOrder((current) => current.filter((k) => k !== key)), []);
  const value = useMemo(() => ({ order, raise, drop }), [order, raise, drop]);

  return <StackContext.Provider value={value}>{children}</StackContext.Provider>;
}

/** `key`'s place in the order. It joins in front when it mounts — a window just
 *  opened is the one wanted — and leaves when it unmounts. */
export function useWindowLayer(key: string): { zIndex: number; raise: () => void } {
  const { order, raise, drop } = useContext(StackContext);

  // Before paint, so a new window never shows one frame behind the others.
  useLayoutEffect(() => {
    raise(key);
    return () => drop(key);
  }, [key, raise, drop]);

  const raiseThis = useCallback(() => raise(key), [raise, key]);
  const index = order.indexOf(key);
  return { zIndex: BASE + (index === -1 ? order.length : index), raise: raiseThis };
}
