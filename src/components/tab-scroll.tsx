/**
 * La barra de pestañas se minimiza al bajar y vuelve al subir, como en iOS 26.
 * Cada pantalla con scroll avisa su posición con useTabScroll().onScroll.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type TabScroll = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const Ctx = createContext<TabScroll>({ collapsed: false, setCollapsed: () => {} });

export function TabScrollProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const last = useRef(0);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - last.current;
    last.current = y;
    // Arriba del todo siempre se ve completa; bajando se minimiza, subiendo vuelve.
    if (y < 60) setCollapsed(false);
    else if (dy > 6) setCollapsed(true);
    else if (dy < -10) setCollapsed(false);
  }, []);
  const value = useMemo(() => ({ collapsed, setCollapsed, onScroll }), [collapsed, onScroll]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function useTabScroll() {
  return useContext(Ctx);
}
