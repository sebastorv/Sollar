/**
 * Materiales de Sollar.
 *
 * - Backdrop: el fondo de cada pantalla, liso con un resplandor suave del color de la marca.
 * - Glass: vidrio líquido para lo que flota (la barra de navegación, los paneles). En iPhone
 *   con iOS 26 usa el vidrio del sistema; en el resto, desenfoque con tinte.
 * - Surface y card(): superficies planas para lo que contiene información.
 */

import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, type Colors } from '@/constants/theme';
import { useColors } from '@/store/theme';

const nativeLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

export function Backdrop() {
  const C = useColors();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} pointerEvents="none">
      <LinearGradient
        colors={[C.glow, 'transparent']}
        start={{ x: 0.8, y: 0 }}
        end={{ x: 0.3, y: 0.45 }}
        style={StyleSheet.absoluteFill}
      />
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
  const C = useColors();
  if (nativeLiquidGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={strong ? C.glassStrong : undefined}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
        {children}
      </GlassView>
    );
  }
  const light = C.mode === 'light';
  return (
    <View
      style={[
        {
          overflow: 'hidden',
          borderRadius: radius,
          borderWidth: 1,
          borderColor: C.glassEdge,
          // Borde de luz arriba: la luz cae sobre el vidrio.
          borderTopColor: light ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.18)',
        },
        floating(C),
        style,
      ]}>
      <BlurView
        intensity={strong ? 90 : 70}
        tint={light ? 'light' : 'dark'}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: strong ? C.glassStrong : C.glass }]} />
      {/* Reflejo: brillo suave en la mitad de arriba, como la luz sobre una gota. */}
      <LinearGradient
        pointerEvents="none"
        colors={light ? ['rgba(255,255,255,0.75)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Un toque del color de la marca refractado en el borde de abajo. */}
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', C.glow]}
        start={{ x: 0.5, y: 0.55 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/** Sombra de lo que flota: más amplia que la de las tarjetas. */
function floating(C: Colors) {
  return C.mode === 'light'
    ? { shadowColor: '#1E1032', shadowOpacity: 0.14, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 8 }
    : { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 8 };
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
  /** Borde con el color de la marca, para destacar (por ejemplo "Incluido en tu plan"). */
  highlighted?: boolean;
}) {
  const C = useColors();
  return (
    <View
      style={[
        card(C),
        { borderRadius: radius },
        highlighted && { borderColor: C.accentLine, backgroundColor: C.accentSoft },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Sombra muy suave: solo se nota en modo claro. */
export function shadow(C: Colors) {
  return C.mode === 'light'
    ? { shadowColor: '#1E1032', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 }
    : {};
}

/** Tarjeta plana: para mezclar en los estilos de cada pantalla. */
export function card(C: Colors) {
  return {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    ...shadow(C),
  } as const;
}
