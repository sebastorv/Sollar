/** Piezas de interfaz reutilizables. */

import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, MaxContentWidth, Radius, Space } from '@/constants/theme';
import { imageUrl, type ImageSize } from '@/lib/tmdb';

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
  const inner = <View style={[styles.inner, padded && styles.padded]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

// --- Carátula ---

export function Poster({
  path,
  width = 110,
  size = 'w342',
  style,
}: {
  path: string | null;
  width?: number;
  size?: ImageSize;
  style?: StyleProp<ViewStyle>;
}) {
  const uri = imageUrl(path, size);
  const box = { width, height: Math.round(width * 1.5), borderRadius: Radius.md };
  return (
    <View style={[styles.posterBox, box, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
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

export function Button({
  label,
  kind = 'primary',
  style,
  ...rest
}: PressableProps & { label: string; kind?: 'primary' | 'secondary' | 'danger'; style?: StyleProp<ViewStyle> }) {
  const bg = kind === 'primary' ? C.accent : C.surfaceHigh;
  const fg = kind === 'primary' ? C.onAccent : kind === 'danger' ? C.danger : C.text;
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { backgroundColor: bg }, pressed && { opacity: 0.8 }, style]}
      {...rest}>
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
      <View style={[styles.fill, { width: `${pct}%` }]} />
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
            {/* La media estrella se muestra en ámbar atenuado, para no depender de glifos raros. */}
            <T style={{ fontSize: 26, color: full ? C.accent : half ? 'rgba(232,165,75,0.45)' : C.border }}>
              ★
            </T>
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
  title: { color: C.text, fontSize: 30, lineHeight: 36, fontWeight: '700' },
  heading: { color: C.text, fontSize: 19, lineHeight: 25, fontWeight: '700' },
  body: { color: C.text, fontSize: 16, lineHeight: 23 },
  small: { color: C.text, fontSize: 14, lineHeight: 20 },
  caption: { color: C.text, fontSize: 12, lineHeight: 16 },
  label: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  screen: { flex: 1, backgroundColor: C.bg },
  scrollContent: { flexGrow: 1, paddingBottom: 120 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Space.xl, flex: 1 },
  padded: { paddingHorizontal: Space.lg, paddingTop: Space.lg },
  posterBox: {
    backgroundColor: C.surfaceHigh,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipSelected: { backgroundColor: C.accent, borderColor: C.accent },
  button: {
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 6, borderRadius: 3, backgroundColor: C.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.accent, borderRadius: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.md, padding: Space.xl },
});
