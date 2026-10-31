/** Piezas de interfaz reutilizables. */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, MaxContentWidth, Radius, Space, TabBarSpace } from '@/constants/theme';
import { imageUrl, type ImageSize } from '@/lib/tmdb';

import { Backdrop } from './glass';
import { Icon } from './icons';

// --- Texto ---

type Variant = 'title' | 'heading' | 'body' | 'small' | 'caption' | 'label';

export function T({
  variant = 'body',
  muted,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean }) {
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

/** Pares de tonos (arriba, abajo) para las carátulas sin imagen, todos dentro de la paleta. */
const POSTER_TONES: [string, string][] = [
  ['#5A2140', '#1D1224'],
  ['#3A2C66', '#16111F'],
  ['#4B2A55', '#1A1220'],
  ['#2F3558', '#14111C'],
  ['#5E2B33', '#1C1218'],
  ['#41305A', '#17111E'],
];

function toneFor(text: string): [string, string] {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return POSTER_TONES[h % POSTER_TONES.length];
}

export function Poster({
  path,
  title,
  width = 110,
  size = 'w342',
  style,
}: {
  path: string | null;
  /** Se muestra sobre un color cuando no hay imagen. */
  title?: string;
  width?: number;
  size?: ImageSize;
  style?: StyleProp<ViewStyle>;
}) {
  const uri = imageUrl(path, size);
  const box = { width, height: Math.round(width * 1.5), borderRadius: Radius.md };
  const small = width < 90;
  // La palabra más larga debe caber en una línea, para no partir "Oppenheimer".
  const longest = title ? Math.max(...title.split(/\s+/).map((w) => w.length)) : 1;
  const fit = Math.floor((width - (small ? 8 : 20)) / (longest * 0.62));
  const fontSize = Math.max(9, Math.min(small ? 11 : Math.round(width / 7.5), fit));
  return (
    <View style={[styles.posterBox, box, style]}>
      {!uri && title ? (
        <LinearGradient colors={toneFor(title)} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : null}
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : title ? (
        <T
          numberOfLines={small ? 3 : 4}
          style={{
            textAlign: 'center',
            fontWeight: '800',
            color: C.accent,
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.75 },
      ]}>
      <T variant="label" style={{ color: selected ? C.onAccent : C.text }}>
        {label}
      </T>
    </Pressable>
  );
}

// --- Botón ---
// Principal: latón con degradado. Secundario: contorno de luz. Peligro: texto rojo suave.

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
  const fg = kind === 'primary' ? C.onAccent : kind === 'danger' ? C.danger : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        kind !== 'primary' && styles.buttonOutline,
        pressed && { opacity: 0.82, transform: [{ scale: 0.985 }] },
        rest.disabled && { opacity: 0.45 },
        style,
      ]}
      {...rest}>
      {kind === 'primary' ? (
        <LinearGradient
          colors={[C.accent, C.accentDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.pill }]}
        />
      ) : null}
      {icon ? <Icon name={icon} size={18} color={fg} strokeWidth={2.2} /> : null}
      <T variant="label" style={{ color: fg }}>
        {label}
      </T>
    </Pressable>
  );
}

// --- Barra de progreso ---

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ now: pct, min: 0, max: 100 }}>
      <LinearGradient
        colors={[C.accentDeep, C.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fill, { width: `${pct}%` }]}
      />
    </View>
  );
}

// --- Calificación: 5 estrellas que guardan un valor de 1 a 10 ---

export function Stars({ value, onChange }: { value: number | null; onChange?: (v: number | null) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: Space.xs }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const full = (value ?? 0) >= n * 2;
        const half = !full && (value ?? 0) >= n * 2 - 1;
        return (
          <Pressable
            key={n}
            disabled={!onChange}
            accessibilityLabel={`${n} estrellas`}
            // Toque: estrella completa. Si ya estaba completa, pasa a media. Si era media, se borra.
            onPress={() => {
              if (!onChange) return;
              if (value === n * 2) onChange(n * 2 - 1);
              else if (value === n * 2 - 1) onChange(n === 1 ? null : (n - 1) * 2);
              else onChange(n * 2);
            }}
            hitSlop={6}>
            <Icon
              name={half ? 'starHalf' : 'star'}
              filled={full}
              size={30}
              color={full || half ? C.accent : C.textFaint}
              strokeWidth={1.6}
            />
          </Pressable>
        );
      })}
      {value != null ? (
        <T variant="small" muted style={{ alignSelf: 'center', marginLeft: Space.sm }}>
          {value}/10
        </T>
      ) : null}
    </View>
  );
}

// --- Estados vacíos y de carga ---

export function Empty({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
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
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={C.accent} />
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ gap: Space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="heading">{title}</T>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: C.text, fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8 },
  heading: { color: C.text, fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  body: { color: C.text, fontSize: 16, lineHeight: 23 },
  small: { color: C.text, fontSize: 14, lineHeight: 20 },
  caption: { color: C.text, fontSize: 12, lineHeight: 16 },
  label: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  screen: { flex: 1, backgroundColor: C.bg },
  scrollContent: { flexGrow: 1, paddingBottom: TabBarSpace },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Space.xl, flex: 1 },
  padded: { paddingHorizontal: Space.lg, paddingTop: Space.lg },
  posterBox: {
    backgroundColor: C.surfaceSolid,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  chip: {
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(255,255,255,0.2)',
    backgroundColor: C.surface,
  },
  chipSelected: { backgroundColor: C.accent, borderColor: C.accent, borderTopColor: '#F6E2B6' },
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
  buttonOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderTopColor: 'rgba(255,255,255,0.24)',
    backgroundColor: C.surface,
  },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.md, padding: Space.xl },
});
