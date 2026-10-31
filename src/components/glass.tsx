/**
 * Materiales de Butaca.
 *
 * - Backdrop: el fondo ambiental (resplandor de terciopelo).
 * - Glass: vidrio líquido para lo que flota sobre el contenido. En iPhone con iOS 26
 *   usa el vidrio líquido del sistema; en el resto, desenfoque con tinte y un borde de luz.
 * - Surface: superficie con relieve para lo que contiene información.
 */

import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AURORA_URI } from '@/constants/aurora';
import { C, Radius } from '@/constants/theme';

const nativeLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

export function Backdrop() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} pointerEvents="none">
      <Image source={{ uri: AURORA_URI }} style={StyleSheet.absoluteFill} contentFit="cover" />
    </View>
  );
}

export function Glass({
  children,
  style,
  radius = Radius.lg,
  strong = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Más opaco: para paneles que tapan mucho contenido (filtros, diálogos). */
  strong?: boolean;
}) {
  if (nativeLiquidGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={strong ? 'rgba(28,20,34,0.6)' : undefined}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.glassShell, { borderRadius: radius }, style]}>
      <BlurView
        intensity={strong ? 60 : 40}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: strong ? 'rgba(24,17,30,0.78)' : C.glass }]}
      />
      {/* Brillo especular en el borde superior, el rasgo del vidrio líquido. */}
      <View pointerEvents="none" style={[styles.sheen, { borderRadius: radius }]} />
      {children}
    </View>
  );
}

export function Surface({
  children,
  style,
  radius = Radius.lg,
  highlighted = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Borde de latón, para destacar (por ejemplo "Incluido en tu plan"). */
  highlighted?: boolean;
}) {
  return (
    <View
      style={[
        styles.surface,
        { borderRadius: radius },
        highlighted && { borderColor: C.accentLine, borderTopColor: C.accent, backgroundColor: C.accentSoft },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Relieve: para mezclar en estilos propios de cada pantalla. */
export const relief = {
  backgroundColor: C.surface,
  borderWidth: 1,
  borderColor: C.border,
  borderTopColor: C.edgeLight,
} as const;

const styles = StyleSheet.create({
  glassShell: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopColor: C.glassEdge,
  },
  sheen: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  surface: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderTopColor: C.edgeLight,
  },
});
