/**
 * Materiales de Sollar.
 *
 * - Backdrop: el fondo de cada pantalla, liso con un resplandor suave del color de la marca.
 * - Glass: vidrio líquido para lo que flota (la barra de navegación, los paneles). En iPhone
 *   con iOS 26 usa el vidrio del sistema; en el resto, desenfoque con tinte.
 * - Surface y card(): superficies planas para lo que contiene información.
 */

import { tr } from '@/i18n';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, type Colors } from '@/constants/theme';
import { useColors } from '@/store/theme';

import { Icon, type IconName } from './icons';
import { Touchable } from './touch';

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
  // Vidrio líquido: casi transparente, con desenfoque y saturación del fondo. El borde no es una
  // línea: es un brillo interno (arriba más fuerte), como el canto de una gota de vidrio.
  const tintBg = strong ? C.glassStrong : light ? 'rgba(255,255,255,0.24)' : 'rgba(30,29,36,0.30)';
  const web = Platform.OS === 'web';
  return (
    <View
      style={[
        { overflow: 'hidden', borderRadius: radius },
        web ? ({ boxShadow: glassEdge(C, true) } as ViewStyle) : { ...floating(C), borderWidth: StyleSheet.hairlineWidth, borderColor: light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)' },
        style,
      ]}>
      {web ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              // El mismo redondeo que la caja: dentro de otro vidrio, Chrome no recorta el desenfoque.
              borderRadius: radius,
              backgroundColor: tintBg,
              // @ts-expect-error: propiedades de CSS que react-native-web pasa al navegador.
              backdropFilter: `blur(${strong ? 28 : 16}px) saturate(180%)`,
              WebkitBackdropFilter: `blur(${strong ? 28 : 16}px) saturate(180%)`,
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
            ? ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']
        }
        locations={[0, 0.4, 0.7, 1]}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {children}
    </View>
  );
}

/**
 * Relleno de vidrio para superficies que se tocan (botones de la ficha, filas, pestañas): deja
 * ver lo de atrás desenfocado. En la web usa el desenfoque real del navegador.
 */
export function glassFill(C: Colors) {
  const light = C.mode === 'light';
  if (Platform.OS === 'web') {
    return {
      backgroundColor: light ? 'rgba(255,255,255,0.66)' : 'rgba(255,255,255,0.075)',
      borderWidth: 0,
      boxShadow: glassEdge(C, false),
      backdropFilter: 'blur(20px) saturate(170%)',
      WebkitBackdropFilter: 'blur(20px) saturate(170%)',
    } as const;
  }
  return {
    backgroundColor: light ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.075)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
    ...shadow(C),
  } as const;
}

/**
 * El canto del vidrio (solo web): un brillo interno arriba, un reflejo tenue abajo y una sombra
 * suave afuera. Reemplaza al borde, que se notaba como una línea.
 */
export function glassEdge(C: Colors, floats: boolean) {
  const light = C.mode === 'light';
  const inner = light
    ? 'inset 0 1px 0.5px rgba(255,255,255,0.75)'
    : 'inset 0 1px 0.5px rgba(255,255,255,0.09)';
  const outer = floats
    ? light
      ? '0 10px 30px rgba(30,16,50,0.14), 0 1px 3px rgba(30,16,50,0.08)'
      : '0 10px 30px rgba(0,0,0,0.5)'
    : light
      ? '0 4px 16px rgba(30,16,50,0.07), 0 1px 2px rgba(30,16,50,0.05)'
      : '0 4px 16px rgba(0,0,0,0.25)';
  return `${inner}, ${outer}`;
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
    // Sin línea de borde: la tarjeta se separa del fondo por su tono y una sombra suave.
    borderWidth: 1,
    borderColor: 'transparent',
    ...shadow(C),
  } as const;
}

/**
 * Botón redondo de vidrio: el mismo en toda la app (atrás, compartir, ajustes, cerrar), para que
 * todos se vean iguales sobre cualquier fondo.
 */
export function GlassButton({
  icon,
  label,
  onPress,
  size = 44,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
}) {
  const C = useColors();
  return (
    <Touchable haptic="light" pressScale={0.88} hitSlop={8} onPress={onPress} accessibilityLabel={tr(label)} accessibilityRole="button">
      <Glass radius={999} style={{ width: size, height: size }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={Math.round(size * 0.46)} color={C.text} strokeWidth={2.3} />
        </View>
      </Glass>
    </Touchable>
  );
}
