/**
 * Calificación propia de Sollar: "palomitas", granos de maíz reventados con forma de estrella
 * suave. Se califica de 1 a 10; al tocar, el grano revienta con un pequeño salto y suelta
 * granitos. En grande, la palomita tiene cara y reacciona a la nota.
 *
 * También: "¿Cómo te sentiste?", doce reacciones con la palomita poniendo caras.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgGradient, Path, RadialGradient, Stop } from 'react-native-svg';

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

let uid = 0;
function useId(prefix: string) {
  const ref = useRef<string | null>(null);
  if (!ref.current) ref.current = `${prefix}${++uid}`;
  return ref.current;
}

/** Los lóbulos de la palomita, de atrás hacia adelante: el de enfrente lleva la cara. */
const LOBES = [
  { cx: 20, cy: 11.2, r: 7 },
  { cx: 12.2, cy: 15.6, r: 7.4 },
  { cx: 27.6, cy: 15, r: 7.6 },
  { cx: 10.4, cy: 24.6, r: 7.4 },
  { cx: 29.6, cy: 24.4, r: 7.4 },
  { cx: 20, cy: 24.4, r: 10.6 },
];

/**
 * La palomita de Sollar, con volumen: cada lóbulo tiene su propia luz (arriba a la izquierda),
 * su sombra en el borde y un brillo; manchitas de mantequilla y la cascarita abajo. Sin
 * calificar, es una palomita gris apagada (sin reventar), con el mismo volumen.
 */
export function Puff({ size = 28, filled, children }: { size?: number; filled: boolean; children?: React.ReactNode }) {
  const C = useColors();
  const id = useId('pop');
  const dark = C.mode === 'dark';
  const lobe = filled
    ? ['#FFFFFF', '#FFF6E2', '#F7DFAE', '#E0AE68']
    : dark
      ? ['#6E6B78', '#55525E', '#423F4A', '#302E37']
      : ['#FFFFFF', '#ECE9F0', '#D9D5DF', '#BEB9C6'];
  return (
    <Svg width={size} height={size} viewBox="0 0 40 41">
      <Defs>
        <RadialGradient id={`${id}l`} cx="0.36" cy="0.3" r="0.78">
          <Stop offset="0" stopColor={lobe[0]} />
          <Stop offset="0.35" stopColor={lobe[1]} />
          <Stop offset="0.75" stopColor={lobe[2]} />
          <Stop offset="1" stopColor={lobe[3]} />
        </RadialGradient>
        <RadialGradient id={`${id}b`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFC83A" stopOpacity="0.75" />
          <Stop offset="1" stopColor="#FFC83A" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`${id}h`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`${id}k`} cx="0.4" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#E9A160" />
          <Stop offset="1" stopColor="#8A4518" />
        </RadialGradient>
      </Defs>
      {filled ? <Ellipse cx={20} cy={35.6} rx={4.6} ry={2.6} fill={`url(#${id}k)`} /> : null}
      {LOBES.map((l, i) => (
        <G key={i}>
          <Circle
            cx={l.cx}
            cy={l.cy}
            r={l.r}
            fill={`url(#${id}l)`}
            stroke={filled ? '#C98C45' : dark ? '#24222A' : '#ABA6B5'}
            strokeOpacity={0.45}
            strokeWidth={0.7}
          />
          <Ellipse
            cx={l.cx - l.r * 0.32}
            cy={l.cy - l.r * 0.38}
            rx={l.r * 0.42}
            ry={l.r * 0.26}
            fill={`url(#${id}h)`}
            opacity={filled ? 1 : 0.5}
            transform={`rotate(-30 ${l.cx - l.r * 0.32} ${l.cy - l.r * 0.38})`}
          />
        </G>
      ))}
      {filled ? (
        <>
          {/* Mantequilla */}
          <Ellipse cx={27.5} cy={13.5} rx={4} ry={3} fill={`url(#${id}b)`} />
          <Ellipse cx={11} cy={26.5} rx={3.6} ry={2.8} fill={`url(#${id}b)`} />
          <Ellipse cx={26} cy={31} rx={3.4} ry={2.2} fill={`url(#${id}b)`} />
        </>
      ) : null}
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
        return (
          <G key={x}>
            <Ellipse cx={x} cy={20.6} rx={1.7} ry={1.9} fill={ink} />
            <Circle cx={x - 0.5} cy={20} r={0.6} fill="#fff" />
          </G>
        );
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
        return (
          <G key={x}>
            <Ellipse cx={x} cy={20} rx={1.9} ry={2.4} fill={ink} />
            <Circle cx={x - 0.6} cy={19.1} r={0.75} fill="#fff" />
          </G>
        );
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
  const spin = useRef(new Animated.Value(0)).current;
  const prev = useRef(on);
  useEffect(() => {
    // Al encenderse, cada sol salta y gira sus rayos.
    if (on && !prev.current) {
      scale.setValue(0.55);
      spin.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 3.5, tension: 220, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(spin, { toValue: 1, duration: 520, easing: Easing.out(Easing.back(2)), useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
    prev.current = on;
  }, [on, scale, spin]);
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
      <Animated.View
        style={{ transform: [{ scale }, { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) }] }}>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <Reacting value={shown} size={34} />
          {label}
        </View>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: Space.md }}>
      <Reacting value={shown} size={110} />
      {label}
      {row}
    </View>
  );
}

/** El sol con cara: cambia de gesto con la nota y da un salto cada vez que cambia. */
function Reacting({ value, size }: { value: number; size: number }) {
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.setValue(0.8);
    Animated.spring(pop, { toValue: 1, friction: 3.2, tension: 200, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [value, pop]);
  return (
    <Animated.View
      style={{
        transform: [
          { scale: pop },
          { rotate: pop.interpolate({ inputRange: [0.8, 1], outputRange: ['-12deg', '0deg'] }) },
        ],
      }}>
      <View style={{ opacity: value > 0 ? 1 : 0.45 }}>
        <PuffMascot size={size} face={faceFor(value)} />
      </View>
    </Animated.View>
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
  useEffect(() => {
    // Al elegirla, la carita salta y se ladea un poco.
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
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={r.label}
      accessibilityState={{ checked: on }}
      style={{
        flexBasis: '30%',
        flexGrow: 1,
        maxWidth: 150,
        paddingTop: Space.md,
        paddingBottom: Space.md,
        alignItems: 'center',
        gap: 6,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: on ? C.accent : C.border,
        backgroundColor: on ? C.accentSoft : C.mode === 'dark' ? 'rgba(255,255,255,0.04)' : C.surface,
      }}>
      <Animated.View
        style={{
          transform: [{ scale: pop }, { rotate: pop.interpolate({ inputRange: [0.7, 1], outputRange: ['-14deg', '0deg'] }) }],
          opacity: on ? 1 : 0.92,
        }}>
        <PuffMascot size={60} face={r.face} />
      </Animated.View>
      {/* Sombrita bajo la carita. */}
      <View style={{ width: 30, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.22)', marginTop: -6 }} />
      <T style={{ fontSize: 14, fontWeight: on ? '800' : '600', color: on ? C.accentInk : C.text }}>{r.label}</T>
    </Touchable>
  );
}
