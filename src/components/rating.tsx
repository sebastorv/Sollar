/**
 * Calificación propia de Sollar: "palomitas", granos de maíz reventados con forma de estrella
 * suave. Se califica de 1 a 10; al tocar, el grano revienta con un pequeño salto y suelta
 * granitos. En grande, la palomita tiene cara y reacciona a la nota.
 *
 * También: "¿Cómo te sentiste?", doce reacciones con la palomita poniendo caras.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { Radius, Space } from '@/constants/theme';
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

const LOBES = [-90, -18, 54, 126, 198].map((a) => {
  const r = (a * Math.PI) / 180;
  return { x: 20 + Math.cos(r) * 10, y: 21 + Math.sin(r) * 10 };
});

let uid = 0;
function useId(prefix: string) {
  const ref = useRef<string | null>(null);
  if (!ref.current) ref.current = `${prefix}${++uid}`;
  return ref.current;
}

/** El grano: cinco lóbulos redondos alrededor de un centro, como una estrella inflada. */
export function Puff({ size = 28, filled, children }: { size?: number; filled: boolean; children?: React.ReactNode }) {
  const C = useColors();
  const id = useId('puff');
  const fill = filled ? `url(#${id})` : C.mode === 'dark' ? '#3B3846' : '#DCD8E2';
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <SvgGradient id={id} x1="0.1" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor="#FFC24B" />
          <Stop offset="0.55" stopColor="#FF8A3D" />
          <Stop offset="1" stopColor="#F0306A" />
        </SvgGradient>
      </Defs>
      <G>
        <Circle cx={20} cy={21} r={11} fill={fill} />
        {LOBES.map((l, i) => (
          <Circle key={i} cx={l.x} cy={l.y} r={8} fill={fill} />
        ))}
      </G>
      {filled ? <Ellipse cx={14.5} cy={11.5} rx={4.2} ry={2.6} fill="#fff" opacity={0.55} transform="rotate(-25 14.5 11.5)" /> : null}
      {children}
    </Svg>
  );
}

// --- Caras ---

type Eyes = 'dot' | 'happy' | 'wide' | 'closed' | 'heart' | 'star' | 'sleepy' | 'angry' | 'side' | 'teary' | 'squint';
type Mouth = 'smile' | 'grin' | 'o' | 'frown' | 'flat' | 'wavy' | 'teeth' | 'small' | 'tongue';
export type Face = { eyes: Eyes; mouth: Mouth; blush?: boolean; tear?: boolean; sweat?: boolean; brows?: 'up' | 'angry' | 'worried' | 'raised' };

function FaceArt({ face }: { face: Face }) {
  const ink = '#2A1508';
  const s = { stroke: ink, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const eye = (x: number) => {
    switch (face.eyes) {
      case 'happy':
        return <Path key={x} d={`M${x - 2.4} 20.5q2.4-2.8 4.8 0`} {...s} />;
      case 'closed':
        return <Path key={x} d={`M${x - 2.4} 19.5q2.4 2.6 4.8 0`} {...s} />;
      case 'wide':
        return (
          <G key={x}>
            <Circle cx={x} cy={19.5} r={2.9} fill="#fff" stroke={ink} strokeWidth={1.2} />
            <Circle cx={x} cy={19.8} r={1.4} fill={ink} />
          </G>
        );
      case 'heart':
        return <Path key={x} d={`M${x} 22.2l-2.6-2.6a1.5 1.5 0 0 1 2.6-1.7 1.5 1.5 0 0 1 2.6 1.7Z`} fill="#E3194F" />;
      case 'star':
        return <Path key={x} d={`M${x} 16.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3Z`} fill="#fff" stroke={ink} strokeWidth={0.9} />;
      case 'sleepy':
        return <Path key={x} d={`M${x - 2.4} 20h4.8`} {...s} />;
      case 'angry':
        return <Circle key={x} cx={x} cy={20.4} r={1.5} fill={ink} />;
      case 'side':
        return (
          <G key={x}>
            <Circle cx={x} cy={19.8} r={2.4} fill="#fff" stroke={ink} strokeWidth={1.1} />
            <Circle cx={x + 1} cy={19.8} r={1.1} fill={ink} />
          </G>
        );
      case 'teary':
        return (
          <G key={x}>
            <Circle cx={x} cy={19.8} r={2.6} fill="#fff" stroke={ink} strokeWidth={1.1} />
            <Circle cx={x} cy={20.4} r={1.5} fill={ink} />
            <Circle cx={x - 0.6} cy={19.4} r={0.6} fill="#fff" />
          </G>
        );
      case 'squint':
        return <Path key={x} d={x < 20 ? `M${x - 2.2} 18.4l3.6 1.8-3.6 1.8` : `M${x + 2.2} 18.4l-3.6 1.8 3.6 1.8`} {...s} />;
      default:
        return <Circle key={x} cx={x} cy={20} r={1.6} fill={ink} />;
    }
  };
  const mouth = () => {
    switch (face.mouth) {
      case 'grin':
        return <Path d="M15.6 24.2h8.8a4.4 4.4 0 0 1-8.8 0Z" fill={ink} />;
      case 'o':
        return <Ellipse cx={20} cy={26.2} rx={2} ry={2.6} fill={ink} />;
      case 'frown':
        return <Path d="M16.8 27.4q3.2-3 6.4 0" {...s} />;
      case 'flat':
        return <Path d="M17.2 26h5.6" {...s} />;
      case 'wavy':
        return <Path d="M16.2 26.4q1-1.2 1.9 0t1.9 0 1.9 0 1.9 0" {...s} />;
      case 'teeth':
        return (
          <G>
            <Path d="M16 24.6h8v2.6h-8Z" fill="#fff" stroke={ink} strokeWidth={1.3} strokeLinejoin="round" />
            <Path d="M18.7 24.6v2.6M21.3 24.6v2.6" stroke={ink} strokeWidth={0.9} />
          </G>
        );
      case 'small':
        return <Path d="M18.4 25.2q1.6 1.3 3.2 0" {...s} />;
      case 'tongue':
        return (
          <G>
            <Path d="M16 24.2h8a4 4 0 0 1-8 0Z" fill={ink} />
            <Path d="M18.2 26.6a1.8 1.6 0 0 0 3.6 0Z" fill="#FF7A8A" />
          </G>
        );
      default:
        return <Path d="M16.6 24.6q3.4 3 6.8 0" {...s} />;
    }
  };
  return (
    <G>
      {face.brows === 'angry' ? <Path d="M12.6 15.6l4.4 1.8M27.4 15.6l-4.4 1.8" {...s} /> : null}
      {face.brows === 'worried' ? <Path d="M12.8 16.8l4.2-1.6M27.2 16.8l-4.2-1.6" {...s} /> : null}
      {face.brows === 'up' ? <Path d="M12.8 15.4q2.2-1.4 4.4 0M22.8 15.4q2.2-1.4 4.4 0" {...s} /> : null}
      {face.brows === 'raised' ? <Path d="M12.8 16.2l4.2-.4M22.8 14.6q2.2-1.4 4.4 0" {...s} /> : null}
      {eye(15)}
      {eye(25)}
      {face.blush ? (
        <>
          <Ellipse cx={12.6} cy={24} rx={2} ry={1.2} fill="#FF5A7A" opacity={0.45} />
          <Ellipse cx={27.4} cy={24} rx={2} ry={1.2} fill="#FF5A7A" opacity={0.45} />
        </>
      ) : null}
      {mouth()}
      {face.tear ? <Path d="M27.2 22.6q1.6 2.4 0 3.6-1.6-1.2 0-3.6Z" fill="#5AB4FF" /> : null}
      {face.sweat ? <Path d="M30 12.6q1.8 2.6 0 4-1.8-1.4 0-4Z" fill="#5AB4FF" /> : null}
    </G>
  );
}

/** Cara según la nota: de triste a encantada. */
function faceFor(v: number): Face {
  if (!v) return { eyes: 'sleepy', mouth: 'flat' };
  if (v <= 2) return { eyes: 'teary', mouth: 'frown', tear: true, brows: 'worried' };
  if (v <= 4) return { eyes: 'dot', mouth: 'frown', brows: 'worried' };
  if (v <= 5) return { eyes: 'dot', mouth: 'flat' };
  if (v <= 6) return { eyes: 'dot', mouth: 'small' };
  if (v <= 7) return { eyes: 'dot', mouth: 'smile', blush: true };
  if (v <= 8) return { eyes: 'happy', mouth: 'smile', blush: true };
  if (v <= 9) return { eyes: 'happy', mouth: 'grin', blush: true };
  return { eyes: 'heart', mouth: 'grin', blush: true };
}

/** La palomita con cara. */
export function PuffMascot({ size = 64, face, filled = true }: { size?: number; face: Face; filled?: boolean }) {
  return (
    <Puff size={size} filled={filled}>
      <FaceArt face={face} />
    </Puff>
  );
}

// --- Granitos que saltan al calificar ---

function Sparks({ trigger, count }: { trigger: number; count: number }) {
  const anims = useRef(Array.from({ length: 8 }, () => new Animated.Value(0))).current;
  const dirs = useRef(Array.from({ length: 8 }, () => ({ x: 0, y: 0 }))).current;
  useEffect(() => {
    if (!trigger) return;
    anims.forEach((a, i) => {
      const ang = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const d = 18 + Math.random() * 16;
      dirs[i] = { x: Math.cos(ang) * d, y: Math.sin(ang) * d - 6 };
      a.setValue(0);
    });
    Animated.parallel(
      anims.slice(0, count).map((a) =>
        Animated.timing(a, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      ),
    ).start();
  }, [trigger, count, anims, dirs]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {anims.slice(0, count).map((a, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i % 2 ? '#FFC24B' : '#FF8A3D',
            opacity: a.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, dirs[i].x] }) },
              { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, dirs[i].y] }) },
              { scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

function PuffButton({
  n,
  on,
  size,
  onPress,
  onHover,
  trigger,
}: {
  n: number;
  on: boolean;
  size: number;
  onPress: () => void;
  onHover: (n: number | null) => void;
  trigger: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(on);
  useEffect(() => {
    // Al encenderse, cada grano revienta con un saltito.
    if (on && !prev.current) {
      scale.setValue(0.6);
      Animated.spring(scale, { toValue: 1, friction: 3.5, tension: 220, useNativeDriver: Platform.OS !== 'web' }).start();
    }
    prev.current = on;
  }, [on, scale]);
  return (
    <Touchable
      haptic="light"
      pressScale={0.8}
      onPress={onPress}
      onHoverIn={() => onHover(n)}
      onHoverOut={() => onHover(null)}
      accessibilityRole="button"
      accessibilityLabel={`${n} de 10`}
      style={{ padding: 1 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Puff size={size} filled={on} />
      </Animated.View>
      {trigger ? <Sparks trigger={trigger} count={n >= 9 ? 8 : 5} /> : null}
    </Touchable>
  );
}

/**
 * Calificación de 1 a 10. Tocar el mismo grano otra vez quita la nota.
 * compact: en línea, con la nota y su nombre al lado (para la ficha).
 */
export function Rating({
  value,
  onChange,
  compact = false,
  size,
  prompt = '¿Qué tal estuvo?',
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  compact?: boolean;
  size?: number;
  prompt?: string;
}) {
  const C = useColors();
  const v = value ?? 0;
  const [hover, setHover] = useState<number | null>(null);
  const [burst, setBurst] = useState<{ n: number; t: number }>({ n: 0, t: 0 });
  const shown = hover ?? v;
  const s = size ?? (compact ? 26 : 30);

  function choose(n: number) {
    if (!onChange) return;
    const next = n === v ? null : n;
    onChange(next);
    if (next) {
      if (next >= 9) haptic('success');
      setBurst({ n: next, t: Date.now() });
    }
  }

  const row = (
    <View style={{ flexDirection: 'row', gap: compact ? 2 : 4, flexWrap: 'nowrap' }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <PuffButton
          key={n}
          n={n}
          on={shown >= n}
          size={s}
          onPress={() => choose(n)}
          onHover={setHover}
          trigger={burst.n === n ? burst.t : 0}
        />
      ))}
    </View>
  );

  const label = shown ? (
    <T style={{ fontSize: 16, fontWeight: '700' }}>
      <T style={{ fontSize: 20, fontWeight: '800', color: C.accentInk }}>{shown}</T>
      <T style={{ fontSize: 13, color: C.textFaint }}>/10 </T> {RATING_LABELS[shown]}
    </T>
  ) : (
    <T muted style={{ fontSize: 15 }}>
      {prompt}
    </T>
  );

  if (compact) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, flexWrap: 'wrap' }}>
        {row}
        {label}
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: Space.md }}>
      <PuffMascot size={110} face={faceFor(shown)} filled={shown > 0} />
      {label}
      {row}
    </View>
  );
}

// --- ¿Cómo te sentiste? ---

export const REACTIONS: { id: string; label: string; face: Face }[] = [
  { id: 'impactado', label: 'Impactado', face: { eyes: 'wide', mouth: 'o', brows: 'up' } },
  { id: 'divertido', label: 'Divertido', face: { eyes: 'squint', mouth: 'grin', blush: true } },
  { id: 'conmovido', label: 'Conmovido', face: { eyes: 'teary', mouth: 'small', blush: true, tear: true } },
  { id: 'triste', label: 'Triste', face: { eyes: 'dot', mouth: 'frown', tear: true, brows: 'worried' } },
  { id: 'emocionado', label: 'Emocionado', face: { eyes: 'star', mouth: 'grin', blush: true } },
  { id: 'asustado', label: 'Asustado', face: { eyes: 'wide', mouth: 'wavy', sweat: true, brows: 'worried' } },
  { id: 'tenso', label: 'Tenso', face: { eyes: 'wide', mouth: 'teeth', sweat: true } },
  { id: 'aburrido', label: 'Aburrido', face: { eyes: 'sleepy', mouth: 'flat' } },
  { id: 'enojado', label: 'Enojado', face: { eyes: 'angry', mouth: 'frown', brows: 'angry' } },
  { id: 'confundido', label: 'Confundido', face: { eyes: 'side', mouth: 'wavy', brows: 'raised' } },
  { id: 'enamorado', label: 'Enamorado', face: { eyes: 'heart', mouth: 'smile', blush: true } },
  { id: 'feliz', label: 'Feliz', face: { eyes: 'happy', mouth: 'tongue', blush: true } },
];

/** Hasta tres reacciones por episodio o título. */
export function Reactions({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const C = useColors();
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
        {REACTIONS.map((r) => {
          const on = value.includes(r.id);
          return (
            <Touchable
              key={r.id}
              haptic={on ? 'light' : 'success'}
              pressScale={0.92}
              onPress={() => toggle(r.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{
                width: 104,
                paddingVertical: Space.md,
                alignItems: 'center',
                gap: 4,
                borderRadius: Radius.lg,
                borderWidth: 1.5,
                borderColor: on ? C.accent : C.border,
                backgroundColor: on ? C.accentSoft : C.surface,
              }}>
              <PuffMascot size={50} face={r.face} />
              <T style={{ fontSize: 13, fontWeight: on ? '700' : '600', color: on ? C.accentInk : C.text }}>{r.label}</T>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}
