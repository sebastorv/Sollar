/** Piezas de interfaz reutilizables. */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions, type PressableProps, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, RAIL_WIDTH, Radius, Space, TabBarSpace, WIDE, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { sharpImage } from '@/lib/tmdb';

import { Backdrop, card } from './glass';
import { Icon } from './icons';
import { Touchable } from './touch';
import { useTabScroll } from './tab-scroll';

// --- Texto ---

type Variant = 'title' | 'heading' | 'body' | 'small' | 'caption' | 'label';

export function T({
  variant = 'body',
  muted,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean }) {
  const styles = useStyles(makeStyles);
  const C = useColors();
  return <Text style={[styles[variant], muted && { color: C.textMuted }, style]} {...rest} />;
}

// --- Contenedor de pantalla ---

/** Verdadero dentro de las pestañas principales: ahí la barra lateral ocupa el borde izquierdo. */
export const RailContext = createContext(false);

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const wide = useWindowDimensions().width >= WIDE;
  const rail = useContext(RailContext);
  const insets = useSafeAreaInsets();
  const { onScroll } = useTabScroll();
  const C = useColors();
  const styles = useStyles(makeStyles);
  const inner = (
    <View
      style={[
        styles.inner,
        padded && styles.padded,
        // El contenido pasa por debajo de la barra de estado del iPhone, a pantalla completa.
        padded && { paddingTop: insets.top + Space.lg },
        // En pantallas anchas se deja lugar a la barra lateral y se da más aire a los lados.
        padded && wide && { paddingTop: insets.top + Space.xxl, paddingLeft: rail ? RAIL_WIDTH + Space.lg * 2 + Space.md : Space.xxl, paddingRight: Space.xxl },
      ]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <Backdrop />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, wide && { paddingBottom: Space.xxl }]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {/* Borde superior que se desvanece, como en iOS 26: el contenido se pierde bajo la hora. */}
      <LinearGradient
        pointerEvents="none"
        colors={[C.bg, C.mode === 'dark' ? 'rgba(11,11,13,0)' : 'rgba(246,246,247,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 14 }}
      />
    </SafeAreaView>
  );
}

// --- Carátula ---

/** Pares de tonos (arriba, abajo) para las carátulas sin imagen. */
const POSTER_TONES: Record<'light' | 'dark', [string, string][]> = {
  light: [
    ['#FFE3D3', '#FFC9C9'],
    ['#FFE9C7', '#FFD0B5'],
    ['#FFD9E4', '#F8C2D6'],
    ['#E4E2F7', '#D3D0EE'],
    ['#DDEFF0', '#C6E2E4'],
    ['#F3E3D6', '#E7CFBD'],
  ],
  dark: [
    ['#3A2230', '#1E1620'],
    ['#3C2A22', '#1F1714'],
    ['#2C2440', '#17141F'],
    ['#22303A', '#141B20'],
    ['#3A2026', '#1F1316'],
    ['#2E2A36', '#18161D'],
  ],
};

function toneFor(text: string, mode: 'light' | 'dark'): [string, string] {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  const tones = POSTER_TONES[mode];
  return tones[h % tones.length];
}

export function Poster({
  path,
  title,
  width = 110,
  style,
}: {
  path: string | null;
  /** Se muestra sobre un color cuando no hay imagen. */
  title?: string;
  width?: number;
  /** Ya no hace falta: el tamaño se elige solo según la pantalla. Se acepta por compatibilidad. */
  size?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const uri = sharpImage(path, 'poster', width);
  const box = { width, height: Math.round(width * 1.5), borderRadius: Radius.md };
  const small = width < 90;
  // La palabra más larga debe caber en una línea, para no partir "Oppenheimer".
  const longest = title ? Math.max(...title.split(/\s+/).map((w) => w.length)) : 1;
  const fit = Math.floor((width - (small ? 8 : 20)) / (longest * 0.62));
  const fontSize = Math.max(small ? 7 : 9, Math.min(small ? 11 : Math.round(width / 7.5), fit));
  return (
    <View style={[styles.posterBox, box, style]}>
      {!uri && title ? (
        <LinearGradient colors={toneFor(title, C.mode)} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : null}
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={uri} />
      ) : title ? (
        <T
          numberOfLines={small ? 3 : 4}
          style={{
            textAlign: 'center',
            fontWeight: '800',
            color: C.text,
            letterSpacing: -0.2,
            fontSize,
            lineHeight: Math.round(fontSize * 1.25),
            paddingHorizontal: small ? 4 : 10,
          }}>
          {title}
        </T>
      ) : (
        <T variant="caption" muted style={{ textAlign: 'center' }}>
          Sin carátula
        </T>
      )}
    </View>
  );
}

// --- Chip seleccionable ---

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Touchable
      haptic="select"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.75 },
      ]}>
      <T variant="label" style={{ color: selected ? C.onInk : C.text }}>
        {label}
      </T>
    </Touchable>
  );
}

// --- Botón ---
// Principal: tinta sólida (sobria). Secundario: relleno suave. Peligro: texto rojo.

export function Button({
  label,
  kind = 'primary',
  icon,
  style,
  ...rest
}: PressableProps & {
  label: string;
  kind?: 'primary' | 'secondary' | 'danger';
  icon?: React.ComponentProps<typeof Icon>['name'];
  style?: StyleProp<ViewStyle>;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const fg = kind === 'primary' ? C.onInk : kind === 'danger' ? C.danger : C.text;
  return (
    <Touchable
      haptic={kind === 'primary' ? 'medium' : 'light'}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' ? { backgroundColor: C.ink } : styles.buttonOutline,
        pressed && { opacity: 0.9 },
        rest.disabled && { opacity: 0.45 },
        style,
      ]}
      {...rest}>
      {icon ? (
        <View>
          <Icon name={icon} size={18} color={fg} strokeWidth={2.2} />
        </View>
      ) : null}
      <T variant="label" style={{ color: fg }}>
        {label}
      </T>
    </Touchable>
  );
}

// --- Barra de progreso ---

export function ProgressBar({ value }: { value: number }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ now: pct, min: 0, max: 100 }}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: C.accent }]} />
    </View>
  );
}

// --- Estados vacíos y de carga ---

export function Empty({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.empty}>
      <T variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {message ? (
        <T muted style={{ textAlign: 'center' }}>
          {message}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function Loading() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={C.accent} />
    </View>
  );
}

export function Section({
  title,
  children,
  right,
  onPress,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  /** Si se da, el título lleva una flecha y abre la vista completa. */
  onPress?: () => void;
}) {
  const C = useColors();
  return (
    <View style={{ gap: Space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {onPress ? (
          <Touchable onPress={onPress} haptic="select" style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <T variant="heading">{title}</T>
            <View>
              <Icon name="chevronRight" size={20} color={C.text} strokeWidth={2.6} />
            </View>
          </Touchable>
        ) : (
          <T variant="heading">{title}</T>
        )}
        {right}
      </View>
      {children}
    </View>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    title: { color: C.text, fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
    heading: { color: C.text, fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.4 },
    body: { color: C.text, fontSize: 16, lineHeight: 23 },
    small: { color: C.text, fontSize: 14, lineHeight: 20 },
    caption: { color: C.text, fontSize: 12, lineHeight: 16 },
    label: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
    screen: { flex: 1, backgroundColor: C.bg },
    scrollContent: { flexGrow: 1, paddingBottom: TabBarSpace },
    inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Space.xl, flex: 1 },
    padded: { paddingHorizontal: Space.lg, paddingTop: Space.lg },
    posterBox: {
      backgroundColor: C.fill,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    chip: {
      paddingVertical: Space.sm,
      paddingHorizontal: Space.md + 2,
      borderRadius: Radius.pill,
      backgroundColor: C.fill,
      overflow: 'hidden',
    },
    chipSelected: { backgroundColor: C.ink },
    button: {
      flexDirection: 'row',
      gap: Space.sm,
      paddingVertical: Space.md + 1,
      paddingHorizontal: Space.xl,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    buttonOutline: { backgroundColor: C.fill },
    track: { height: 5, borderRadius: 3, backgroundColor: C.fill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.md, padding: Space.xl },
  });

/** Tarjeta plana, para usar en estilos propios. */
export { card };
