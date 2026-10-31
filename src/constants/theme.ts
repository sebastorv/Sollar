/**
 * Paleta de Butaca. La app usa un solo tema oscuro, pensado para ver carátulas
 * con buen contraste. El acento es un ámbar cálido (la luz de una sala de cine).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const C = {
  bg: '#0E0E11',
  surface: '#18181D',
  surfaceHigh: '#23232A',
  border: '#2E2E37',
  text: '#F4F2EE',
  textMuted: '#A3A1AB',
  textFaint: '#6E6C76',
  accent: '#E8A54B',
  accentSoft: 'rgba(232, 165, 75, 0.16)',
  onAccent: '#1A1206',
  success: '#7FB58A',
  danger: '#D9786A',
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  web: { sans: 'var(--font-display)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

/** Ancho máximo del contenido en pantallas grandes (web, tablet, escritorio). */
export const MaxContentWidth = 960;
