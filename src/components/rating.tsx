/**
 * Calificación con cinco estrellas (de media en media: la nota se guarda de 1 a 10) y
 * "¿Cómo te sentiste?" con emojis oficiales (Fluent Emoji de Microsoft, licencia MIT).
 */

import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, View, type GestureResponderEvent } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { Space } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { useColors } from '@/store/theme';

import { Touchable } from './touch';
import { T } from './ui';

export const RATING_LABELS = [
  'Sin calificar',
  'Pésima',
  'Muy mala',
  'Mala',
  'Floja',
  'Pasable',
  'Entretenida',
  'Buena',
  'Muy buena',
  'Excelente',
  '¡Imperdible!',
];

// Estrella de puntas redondeadas: el trazo grueso con uniones redondas suaviza cada punta.
const STAR = 'M12 4.2l2.35 4.85 5.3.72-3.86 3.7.96 5.28L12 16.2l-4.75 2.55.96-5.28-3.86-3.7 5.3-.72L12 4.2Z';

let uid = 0;

/** Una estrella: llena, media o vacía (solo el contorno, fino). */
function Star({ fill, size }: { fill: 0 | 0.5 | 1; size: number }) {
  const C = useColors();
  const id = useRef(`half${++uid}`).current;
  const empty = C.mode === 'light' ? 'rgba(22,20,27,0.28)' : 'rgba(255,255,255,0.32)';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <ClipPath id={id}>
          <Rect x="0" y="0" width="12" height="24" />
        </ClipPath>
      </Defs>
      {fill === 1 ? (
        <Path d={STAR} fill={C.accent} stroke={C.accent} strokeWidth={3.2} strokeLinejoin="round" />
      ) : (
        <>
          <Path d={STAR} fill="none" stroke={empty} strokeWidth={1.7} strokeLinejoin="round" />
          {fill === 0.5 ? <Path d={STAR} fill={C.accent} stroke={C.accent} strokeWidth={3.2} strokeLinejoin="round" clipPath={`url(#${id})`} /> : null}
        </>
      )}
    </Svg>
  );
}

/**
 * Cinco estrellas. Tocar la mitad izquierda de una estrella da media; la derecha, la entera.
 * Tocar la misma nota otra vez la quita. compact: en línea, con la nota al lado.
 */
export function Rating({
  value,
  onChange,
  compact = false,
  size,
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  compact?: boolean;
  size?: number;
  prompt?: string;
}) {
  const C = useColors();
  const v = value ?? 0;
  const s = size ?? (compact ? 28 : 40);
  const pops = useRef(Array.from({ length: 5 }, () => new Animated.Value(1))).current;

  function choose(i: number, e: GestureResponderEvent) {
    if (!onChange) return;
    const x = e.nativeEvent.locationX ?? s;
    const n = x < s / 2 ? i * 2 - 1 : i * 2;
    const next = n === v ? null : n;
    onChange(next);
    if (next && next >= 9) haptic('success');
    const p = pops[i - 1];
    p.setValue(0.75);
    Animated.spring(p, { toValue: 1, friction: 3.5, tension: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }

  const row = (
    <View style={{ flexDirection: 'row', gap: compact ? 4 : 8 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Touchable
          key={i}
          haptic="select"
          pressScale={0.85}
          onPress={(e) => choose(i, e)}
          accessibilityRole="button"
          accessibilityLabel={`${i}`}>
          <Animated.View style={{ transform: [{ scale: pops[i - 1] }] }} pointerEvents="none">
            <Star size={s} fill={v >= i * 2 ? 1 : v === i * 2 - 1 ? 0.5 : 0} />
          </Animated.View>
        </Touchable>
      ))}
    </View>
  );

  const label = v ? (
    <T style={{ fontSize: 15, fontWeight: '600', color: C.textMuted }}>
      <T style={{ fontSize: 17, fontWeight: '700', color: C.text }}>{(v / 2).toFixed(v % 2 ? 1 : 0)}</T>
      {'  '}
      {RATING_LABELS[v]}
    </T>
  ) : null;

  if (compact) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, flexWrap: 'wrap' }}>
        {row}
        {label}
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: Space.md, paddingVertical: Space.sm }}>
      {row}
      {label ?? <T muted>Toca una estrella</T>}
    </View>
  );
}

// --- ¿Cómo te sentiste? ---

/**
 * Emojis animados oficiales de Google (Noto Animated Emoji, licencia CC BY 4.0). Quietos se
 * muestran como imagen fija; al tocarlos (o mientras están elegidos) se animan.
 */
const NOTO = 'https://fonts.gstatic.com/s/e/notoemoji/latest';
export const REACTIONS: { id: string; label: string; cp: string; fallback: number }[] = [
  { id: 'impactado', label: 'Impactado', cp: '1f632', fallback: require('../../assets/emoji/impactado.png') },
  { id: 'divertido', label: 'Divertido', cp: '1f606', fallback: require('../../assets/emoji/divertido.png') },
  { id: 'conmovido', label: 'Conmovido', cp: '1f979', fallback: require('../../assets/emoji/conmovido.png') },
  { id: 'triste', label: 'Triste', cp: '1f622', fallback: require('../../assets/emoji/triste.png') },
  { id: 'emocionado', label: 'Emocionado', cp: '1f929', fallback: require('../../assets/emoji/emocionado.png') },
  { id: 'asustado', label: 'Asustado', cp: '1f628', fallback: require('../../assets/emoji/asustado.png') },
  { id: 'tenso', label: 'Tenso', cp: '1f62c', fallback: require('../../assets/emoji/tenso.png') },
  { id: 'aburrido', label: 'Aburrido', cp: '1f971', fallback: require('../../assets/emoji/aburrido.png') },
  { id: 'enojado', label: 'Enojado', cp: '1f621', fallback: require('../../assets/emoji/enojado.png') },
  { id: 'confundido', label: 'Confundido', cp: '1f914', fallback: require('../../assets/emoji/confundido.png') },
  { id: 'enamorado', label: 'Enamorado', cp: '1f60d', fallback: require('../../assets/emoji/enamorado.png') },
  { id: 'feliz', label: 'Feliz', cp: '1f601', fallback: require('../../assets/emoji/feliz.png') },
];

let prefetched = false;
function prefetchEmoji() {
  if (prefetched) return;
  prefetched = true;
  Image.prefetch(REACTIONS.flatMap((r) => [`${NOTO}/${r.cp}/emoji.svg`, `${NOTO}/${r.cp}/512.webp`]), 'memory-disk').catch(() => {});
}

/** Un emoji: fijo o animado. Si no carga (sin conexión), se usa la versión guardada en la app. */
function Emoji({ r, animated, size }: { r: (typeof REACTIONS)[number]; animated: boolean; size: number }) {
  const [failed, setFailed] = useState(false);
  const uri = `${NOTO}/${r.cp}/${animated ? '512.webp' : 'emoji.svg'}`;
  return (
    <Image
      source={failed ? r.fallback : { uri }}
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      contentFit="contain"
      cachePolicy="memory-disk"
      transition={0}
      accessibilityIgnoresInvertColors
    />
  );
}

/** Hasta tres reacciones por episodio o título. */
export function Reactions({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  useEffect(prefetchEmoji, []);
  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id].slice(-3));
  }
  return (
    <View style={{ gap: Space.md }}>
      <View>
        <T variant="heading">¿Cómo te sentiste?</T>
        <T variant="small" muted>
          Elige hasta tres
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
        {REACTIONS.map((r) => (
          <ReactionTile key={r.id} r={r} on={value.includes(r.id)} onPress={() => toggle(r.id)} />
        ))}
      </View>
    </View>
  );
}

function ReactionTile({ r, on, onPress }: { r: (typeof REACTIONS)[number]; on: boolean; onPress: () => void }) {
  const C = useColors();
  const pop = useRef(new Animated.Value(1)).current;
  const prev = useRef(on);
  const [hover, setHover] = useState(false);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    // Al elegirla, el emoji salta un poco.
    if (on && !prev.current) {
      pop.setValue(0.7);
      Animated.spring(pop, { toValue: 1, friction: 3, tension: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    }
    prev.current = on;
  }, [on, pop]);
  return (
    <Touchable
      haptic={on ? 'light' : 'success'}
      pressScale={0.92}
      onPress={() => {
        onPress();
        // Al tocarlo se anima un momento (y sigue animado si quedó elegido).
        setBurst(true);
        setTimeout(() => setBurst(false), 2600);
      }}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      accessibilityRole="checkbox"
      accessibilityLabel={r.label}
      accessibilityState={{ checked: on }}
      style={{
        flexBasis: '22%',
        flexGrow: 1,
        maxWidth: 120,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 6,
        borderRadius: 20,
        backgroundColor: on ? C.accentSoft : C.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(22,20,27,0.04)',
      }}>
      <Animated.View style={{ transform: [{ scale: pop }], opacity: on || hover ? 1 : 0.9 }}>
        <Emoji r={r} animated={on || burst || hover} size={40} />
      </Animated.View>
      <T numberOfLines={1} style={{ fontSize: 13, fontWeight: on ? '700' : '500', color: on ? C.accentInk : C.text }}>
        {r.label}
      </T>
    </Touchable>
  );
}
