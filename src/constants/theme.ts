/**
 * Identidad visual de Sollar.
 *
 * Diseño plano y limpio, al estilo de Trakt: superficies lisas, formas redondeadas y un
 * degradado vivo como firma de la marca. Hay tres degradados para elegir (Brasa, que es el
 * predeterminado, Atardecer y Cereza) y dos modos (claro, el predeterminado, y oscuro).
 *
 * Los colores no se importan directamente: se piden con useColors() o useStyles(), para que
 * toda la app cambie al instante cuando la persona elige otro color o modo en Ajustes.
 */

import '@/global.css';

import { Platform } from 'react-native';

export type AccentName = 'brasa' | 'atardecer' | 'cereza';
export type ModeName = 'light' | 'dark';

type Accent = {
  label: string;
  /** Degradado de la marca: de g1 a g2. */
  g1: string;
  g2: string;
  /** Color sólido para iconos y selección. */
  solid: string;
  /** Texto con el color de la marca, legible sobre el fondo de cada modo. */
  inkLight: string;
  inkDark: string;
};

export const ACCENTS: Record<AccentName, Accent> = {
  brasa: { label: 'Brasa', g1: '#FF8A3D', g2: '#F0306A', solid: '#F5534F', inkLight: '#D0234F', inkDark: '#FF7A66' },
  atardecer: { label: 'Atardecer', g1: '#FFBE45', g2: '#FF5A5F', solid: '#FF7F50', inkLight: '#C2410C', inkDark: '#FFB061' },
  cereza: { label: 'Cereza', g1: '#FF4D4D', g2: '#E3197F', solid: '#F0306A', inkLight: '#C8136E', inkDark: '#FF6B9A' },
};

export const ACCENT_ORDER: AccentName[] = ['brasa', 'atardecer', 'cereza'];

const BASE = {
  light: {
    bg: '#F6F6F7',
    surface: '#FFFFFF',
    surfaceHigh: '#FFFFFF',
    surfaceSolid: '#FFFFFF',
    /** Relleno suave para chips, campos y estados vacíos. */
    fill: '#EFEDF2',
    border: 'rgba(22, 12, 40, 0.08)',
    text: '#16141B',
    textMuted: '#615D6A',
    textFaint: '#9A96A3',
    success: '#1F8A4C',
    danger: '#D12C3D',
    glass: 'rgba(255, 255, 255, 0.55)',
    glassStrong: 'rgba(255, 255, 255, 0.94)',
    glassEdge: 'rgba(22, 12, 40, 0.06)',
    scrim: 'rgba(16, 12, 24, 0.35)',
    shadow: 'rgba(30, 16, 50, 0.10)',
    /** Bolsa de palomitas sin calificar. */
    emptyA: '#E6E3EA',
    emptyB: '#F3F1F5',
  },
  dark: {
    bg: '#0B0B0D',
    surface: '#151518',
    surfaceHigh: '#1F1D26',
    surfaceSolid: '#17161D',
    fill: '#24222C',
    border: 'rgba(255, 255, 255, 0.07)',
    text: '#F5F3F8',
    textMuted: '#A9A5B2',
    textFaint: '#6E6A78',
    success: '#4CC38A',
    danger: '#FF6B6B',
    glass: 'rgba(23, 22, 29, 0.55)',
    glassStrong: 'rgba(23, 22, 29, 0.94)',
    glassEdge: 'rgba(255, 255, 255, 0.08)',
    scrim: 'rgba(0, 0, 0, 0.55)',
    shadow: 'rgba(0, 0, 0, 0.4)',
    emptyA: '#2A2832',
    emptyB: '#36333F',
  },
} as const;

export type Colors = {
  mode: ModeName;
  accentName: AccentName;
  bg: string;
  surface: string;
  surfaceHigh: string;
  surfaceSolid: string;
  fill: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  success: string;
  danger: string;
  glass: string;
  glassStrong: string;
  glassEdge: string;
  scrim: string;
  shadow: string;
  emptyA: string;
  emptyB: string;
  /** Extremos del degradado de la marca. */
  g1: string;
  g2: string;
  /** Color sólido de la marca (iconos activos, selección). */
  accent: string;
  /** Texto en el color de la marca, con buen contraste en este modo. */
  accentInk: string;
  /** Fondo tenue con el color de la marca (selección, destacados). */
  accentSoft: string;
  accentLine: string;
  /** Resplandor del fondo, muy tenue. */
  glow: string;
  /** Texto sobre el degradado. */
  onAccent: string;
  /** Tinte de la marca para las imágenes de fondo, como el morado de Trakt. */
  tint: string;
  /** Tinta: botones y selección principales, sobrios (negro en claro, blanco en oscuro). */
  ink: string;
  onInk: string;
};

/** Un color del tema con transparencia (para degradados sobre imágenes). */
export function withAlpha(hex: string, a: number) {
  return alpha(hex, a);
}

function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function makeColors(mode: ModeName, accentName: AccentName): Colors {
  const a = ACCENTS[accentName];
  return {
    mode,
    accentName,
    ...BASE[mode],
    g1: a.g1,
    g2: a.g2,
    accent: a.solid,
    accentInk: mode === 'light' ? a.inkLight : a.inkDark,
    // Toques de marca: suaves, para destacar sin teñir toda la pantalla.
    accentSoft: alpha(a.solid, mode === 'light' ? 0.1 : 0.16),
    accentLine: alpha(a.solid, 0.45),
    glow: alpha(a.solid, mode === 'light' ? 0.07 : 0.09),
    onAccent: '#FFFFFF',
    tint: alpha(a.g2, mode === 'light' ? 0.28 : 0.38),
    ink: mode === 'light' ? '#141217' : '#F4F2F6',
    onInk: mode === 'light' ? '#FFFFFF' : '#0E0D12',
  };
}

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

/** Radios por jerarquía: píldoras para acciones, 14 para carátulas, 22 para tarjetas. */
export const Radius = {
  sm: 10,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

/** Ancho máximo del contenido: amplio, para aprovechar monitores grandes sin estirar de más. */
export const MaxContentWidth = 1480;

/** Desde este ancho se usa la barra lateral en lugar de la píldora de abajo. */
export const WIDE = 720;
/** Ancho de la barra lateral. */
export const RAIL_WIDTH = 84;

/** Altura que ocupa la barra flotante de abajo, para que el contenido no quede tapado. */
export const TabBarSpace = 120;
