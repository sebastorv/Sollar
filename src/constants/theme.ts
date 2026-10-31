/**
 * Identidad visual de Butaca: "terciopelo y latón".
 *
 * La sala de cine de siempre: butacas de terciopelo, barandas de latón y la luz del
 * proyector en la oscuridad. El fondo es noche ciruela con un resplandor de terciopelo;
 * el acento es latón pálido, cálido pero sin brillo chillón. Lo que flota (barra de
 * navegación, paneles, botones sobre imágenes) es vidrio; lo que contiene información
 * es superficie con relieve y un borde de luz arriba.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const C = {
  /** Noche ciruela: el fondo de todo. */
  bg: '#120D17',
  /** Terciopelo y humo: solo para el resplandor de fondo. */
  velvet: '#6E2443',
  smoke: '#2F2552',

  /** Superficie con relieve sobre el fondo (translúcida para dejar ver el resplandor). */
  surface: 'rgba(255, 240, 248, 0.05)',
  surfaceHigh: 'rgba(255, 240, 248, 0.09)',
  /** Superficie opaca, para lo que necesita tapar el contenido de atrás. */
  surfaceSolid: '#1C1522',
  /** Bordes: el de arriba más claro simula la luz que cae sobre el relieve. */
  border: 'rgba(255, 255, 255, 0.08)',
  edgeLight: 'rgba(255, 255, 255, 0.16)',

  text: '#F4EEF2',
  textMuted: '#B6AABC',
  textFaint: '#7D7287',

  /** Latón: el color de la marca. */
  accent: '#E9C987',
  accentDeep: '#C9A15E',
  accentSoft: 'rgba(233, 201, 135, 0.14)',
  accentLine: 'rgba(233, 201, 135, 0.55)',
  onAccent: '#24170A',

  success: '#9CC9A0',
  danger: '#E58C8C',

  /** Vidrio: tinte que se suma al desenfoque. */
  glass: 'rgba(28, 20, 34, 0.55)',
  glassEdge: 'rgba(255, 255, 255, 0.18)',
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

/** Radios por jerarquía: píldoras para acciones, 14 para carátulas, 22 para paneles. */
export const Radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

/** Ancho máximo del contenido en pantallas grandes (web, tablet, escritorio). */
export const MaxContentWidth = 960;

/** Altura que ocupa la barra flotante de abajo, para que el contenido no quede tapado. */
export const TabBarSpace = 112;
