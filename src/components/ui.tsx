/** Piezas de interfaz reutilizables. */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions, type PressableProps, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Space, TabBarSpace, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';
import { sharpImage } from '@/lib/tmdb';

import { Backdrop, card } from './glass';
import { Icon } from './icons';
import { Touchable } from './touch';

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

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  // En pantallas anchas la barra de navegación flota arriba; en el celular, abajo.
  const wide = useWindowDimensions().width >= 720;
  const styles = useStyles(makeStyles);
  const inner = (
    <View style={[styles.inner, padded && styles.padded, padded && wide && { paddingTop: 96 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <Backdrop />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, wide && { paddingBottom: Space.xxl }]}
          keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
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
      {selected ? (
        <LinearGradient
          colors={[C.g1, C.g2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.pill }]}
        />
      ) : null}
      <T variant="label" style={{ color: selected ? C.onAccent : C.text }}>
        {label}
      </T>
    </Touchable>
  );
}

// --- Botón ---
// Principal: el degradado de la marca. Secundario: relleno suave. Peligro: texto rojo.

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
  const fg = kind === 'primary' ? C.onAccent : kind === 'danger' ? C.danger : C.text;
  return (
    <Touchable
      haptic={kind === 'primary' ? 'medium' : 'light'}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        kind !== 'primary' && styles.buttonOutline,
        pressed && { opacity: 0.9 },
        rest.disabled && { opacity: 0.45 },
        style,
      ]}
      {...rest}>
      {kind === 'primary' ? (
        <LinearGradient
          colors={[C.g1, C.g2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.pill }]}
        />
      ) : null}
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
      <LinearGradient
        colors={[C.g1, C.g2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fill, { width: `${pct}%` }]}
      />
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
    chipSelected: { backgroundColor: C.g2 },
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
