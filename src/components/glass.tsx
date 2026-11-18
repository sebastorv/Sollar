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
  // Vidrio líquido: casi transparente, con desenfoque y saturación del fondo, borde de luz
  // arriba, un reflejo suave y un brillo en el borde de abajo, como una gota.
  const tintBg = strong ? C.glassStrong : light ? 'rgba(255,255,255,0.22)' : 'rgba(30,29,38,0.32)';
  const web = Platform.OS === 'web';
  return (
    <View
      style={[
        {
          overflow: 'hidden',
          borderRadius: radius,
          borderWidth: 1,
          borderColor: light ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)',
          borderTopColor: light ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)',
        },
        floating(C),
        style,
      ]}>
      {web ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: tintBg,
              // @ts-expect-error: propiedades de CSS que react-native-web pasa al navegador.
              backdropFilter: `blur(${strong ? 30 : 18}px) saturate(${light ? 190 : 160}%)`,
              WebkitBackdropFilter: `blur(${strong ? 30 : 18}px) saturate(${light ? 190 : 160}%)`,
            },
          ]}
        />
      ) : (
        <>
          <BlurView
            intensity={strong ? 90 : 60}
            tint={light ? 'light' : 'dark'}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tintBg }]} />
        </>
      )}
      {/* Reflejo arriba y brillo en el borde de abajo. */}
      <LinearGradient
        pointerEvents="none"
        colors={
          light
            ? ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.35)']
            : ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.08)']
        }
        locations={[0, 0.4, 0.7, 1]}
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
