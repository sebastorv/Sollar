/**
 * Márgenes seguros corregidos. En la app de la pantalla de inicio del iPhone (iOS 26), Safari a
 * veces informa 0 en la zona de la hora y del indicador de inicio, y el contenido queda debajo
 * de ellos. Aquí se reemplaza ese 0 por la medida real del modelo de iPhone.
 */

import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

function iosHomeScreenApp() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  // En iOS 26 la app de la pantalla de inicio siempre dibuja por debajo de la hora (con
  // cualquier estilo de barra) y a veces informa 0 de margen: se corrige en ambos modos.
  return standalone && ios;
}

export function FixedInsets({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  if (!iosHomeScreenApp()) return children;
  const h = Math.max(window.screen.height, window.screen.width);
  // Isla dinámica (852 o más), muesca (812 o más) o botón de inicio.
  const top = h >= 852 ? 59 : h >= 812 ? 47 : 20;
  const bottom = h >= 812 ? 28 : 0;
  const value = {
    ...insets,
    top: insets.top >= 20 ? insets.top : top,
    bottom: insets.bottom >= 10 ? insets.bottom : bottom,
  };
  return <SafeAreaInsetsContext.Provider value={value}>{children}</SafeAreaInsetsContext.Provider>;
}
