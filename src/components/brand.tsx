/**
 * Marca de Sollar: el logo (la palomita sonriente sobre el degradado) y la calificación
 * con bolsas de palomitas, de 1 a 10, con una palomita que reacciona a la nota.
 * Todo es plano y redondeado, dibujado con SVG para que se vea nítido en cualquier tamaño.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Space } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { useColors } from '@/store/theme';

import { T } from './ui';
import { Touchable } from './touch';

const INK = '#3B2410';
const CREAM = '#FFF7EA';
const BUTTER = '#FFD27A';
const CHEEK = '#FF8C8C';

function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}

/** Forma de ícono de iOS (supercírculo) en una caja de 100 × 100. */
const SQUIRCLE = (() => {
  const n = 5;
  const pts: string[] = [];
  for (let i = 0; i < 120; i++) {
    const t = (2 * Math.PI * i) / 120;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = 50 + 50 * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = 50 + 50 * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

// --- Logo ---

/** La palomita del logo, en una caja de 100 × 100. */
function LogoPopcorn() {
  return (
    <G>
      <G fill={CREAM}>
        <Circle cx={50} cy={56} r={25} />
        <Circle cx={31} cy={42} r={15} />
        <Circle cx={50} cy={31} r={16.5} />
        <Circle cx={69} cy={42} r={15} />
        <Circle cx={29} cy={63} r={12.5} />
        <Circle cx={71} cy={63} r={12.5} />
      </G>
      <Circle cx={62} cy={27} r={3.4} fill={BUTTER} />
      <Circle cx={36} cy={36} r={2.4} fill={BUTTER} />
      <Ellipse cx={42} cy={53} rx={3.8} ry={4.8} fill={INK} />
      <Ellipse cx={58} cy={53} rx={3.8} ry={4.8} fill={INK} />
      <Circle cx={43.3} cy={51.2} r={1.4} fill="#fff" />
      <Circle cx={59.3} cy={51.2} r={1.4} fill="#fff" />
      <Ellipse cx={35.5} cy={61} rx={4} ry={2.6} fill={CHEEK} opacity={0.6} />
      <Ellipse cx={64.5} cy={61} rx={4} ry={2.6} fill={CHEEK} opacity={0.6} />
      <Path d="M43.5 61.5Q50 68 56.5 61.5" fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
    </G>
  );
}

/**
 * Logo de Sollar. "circle": sobre un círculo con el degradado (barra, encabezados).
 * "icon": con la forma de ícono de iOS. "bare": la palomita sola.
 */
export function SollarLogo({ size = 32, shape = 'circle' }: { size?: number; shape?: 'circle' | 'icon' | 'bare' }) {
  const C = useColors();
  const id = useSvgId('logo');
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Sollar">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={C.g1} />
          <Stop offset="1" stopColor={C.g2} />
        </LinearGradient>
      </Defs>
      {shape === 'circle' ? <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} /> : null}
      {shape === 'icon' ? <Path d={SQUIRCLE} fill={`url(#${id})`} /> : null}
      <G transform={shape === 'bare' ? undefined : 'translate(7 7) scale(0.86)'}>
        <LogoPopcorn />
      </G>
    </Svg>
  );
}

/** Nombre de la app con el degradado de la marca. */
export function Wordmark({ size = 22 }: { size?: number }) {
  const C = useColors();
  return (
    <T
      style={{
        fontSize: size,
        lineHeight: size * 1.15,
        fontWeight: '800',
        letterSpacing: -0.04 * size,
        color: C.text,
      }}>
      Sollar
    </T>
  );
}

// --- Bolsa de palomitas ---

const BAG_SHAPE =
  'M24 62 Q31 55 38 62 Q45 55 52 62 Q60 55 68 62 Q75 55 82 62 Q89 55 96 62 L90 128 Q89 136 81 136 L39 136 Q31 136 30 128 Z';

const STRIPES = [0, 1, 2, 3].map((i) => {
  const t0 = 18 + i * 21 + 4;
  const t1 = t0 + 11;
  const b0 = 30 + i * 15 + 3;
  const b1 = b0 + 8;
  return `M${t0} 50 L${t1} 50 L${b1} 140 L${b0} 140 Z`;
});

const SMALL_CORN: [number, number][] = [
  [34, 52],
  [48, 44],
  [62, 40],
  [76, 45],
  [88, 53],
  [41, 36],
  [56, 30],
  [71, 32],
  [83, 40],
  [63, 20],
  [48, 24],
  [30, 46],
];

/** Una palomita: tres lóbulos redondos con un toque de mantequilla. */
function Kernel({ x, y, rotate = 0, scale = 1 }: { x: number; y: number; rotate?: number; scale?: number }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <Circle cx={0} cy={0} r={9} fill="#FFF6E6" />
      <Circle cx={8} cy={-4} r={7.5} fill="#FFF9EF" />
      <Circle cx={3} cy={7} r={7} fill="#FFF1D9" />
      <Circle cx={3} cy={1} r={3.2} fill={BUTTER} />
    </G>
  );
}

function BagBody({ filled, id, children }: { filled: boolean; id: string; children?: React.ReactNode }) {
  const C = useColors();
  return (
    <>
      <Defs>
        <LinearGradient id={`${id}g`} x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={C.g1} />
          <Stop offset="1" stopColor={C.g2} />
        </LinearGradient>
        <LinearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.14} />
        </LinearGradient>
        <ClipPath id={`${id}c`}>
          <Path d={BAG_SHAPE} />
        </ClipPath>
      </Defs>
      <Ellipse cx={60} cy={137} rx={30} ry={3.5} fill="#000" opacity={0.15} />
      {children}
      <G clipPath={`url(#${id}c)`}>
        <Rect x={0} y={40} width={120} height={100} fill={filled ? '#FFFDFB' : C.emptyB} />
        <G fill={filled ? `url(#${id}g)` : C.emptyA}>
          {STRIPES.map((d) => (
            <Path key={d} d={d} />
          ))}
        </G>
        <Rect x={0} y={40} width={120} height={100} fill={`url(#${id}s)`} />
        <Rect x={0} y={54} width={120} height={13} fill="#000" opacity={0.06} />
      </G>
    </>
  );
}

/** Bolsa pequeña: llena (con palomitas y color) o vacía (gris). */
export function PopcornBag({ filled, size = 32 }: { filled: boolean; size?: number }) {
  const id = useSvgId('bag');
  return (
    <Svg width={size} height={(size * 140) / 120} viewBox="0 0 120 140">
      <BagBody filled={filled} id={id}>
        {filled
          ? SMALL_CORN.map(([x, y], i) => <Kernel key={i} x={x} y={y} rotate={i * 47} scale={0.95 + (i % 3) * 0.12} />)
          : null}
      </BagBody>
    </Svg>
  );
}

// --- Rostros ---

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
  '¡Obra maestra!',
];

function Line({ d, w = 2.6 }: { d: string; w?: number }) {
  return <Path d={d} fill="none" stroke={INK} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}

function Eyes({ closed }: { closed: boolean }) {
  if (closed) {
    return (
      <>
        <Line d="M48 32.5 Q51 34 54 32.5" />
        <Line d="M66 32.5 Q69 34 72 32.5" />
      </>
    );
  }
  return (
    <>
      {[51, 69].map((x) => (
        <G key={x}>
          <Ellipse cx={x} cy={32} rx={3.4} ry={4.4} fill={INK} />
          <Circle cx={x + 1.2} cy={30.4} r={1.3} fill="#fff" />
        </G>
      ))}
    </>
  );
}

function Cheeks() {
  return (
    <>
      <Ellipse cx={45} cy={40} rx={4} ry={2.6} fill={CHEEK} opacity={0.55} />
      <Ellipse cx={75} cy={40} rx={4} ry={2.6} fill={CHEEK} opacity={0.55} />
    </>
  );
}

const SAD_BROWS = (
  <>
    <Line d="M46 25.5 L53 23.5" />
    <Line d="M74 25.5 L67 23.5" />
  </>
);

function OpenMouth({ top, bottom, wide }: { top: number; bottom: number; wide: number }) {
  const l = 60 - wide;
  const r = 60 + wide;
  return (
    <>
      <Path
        d={`M${l} ${top} Q60 ${top + 1.2} ${r} ${top} Q${r - 1.5} ${bottom} 60 ${bottom} Q${l + 1.5} ${bottom} ${l} ${top}Z`}
        fill={INK}
      />
      <Path
        d={`M${l + 3} ${bottom - 3.5} Q60 ${bottom - 6} ${r - 3} ${bottom - 3.5} Q${r - 5} ${bottom - 0.8} 60 ${bottom - 0.8} Q${l + 5} ${bottom - 0.8} ${l + 3} ${bottom - 3.5}Z`}
        fill="#FF6F7D"
      />
    </>
  );
}

function Heart({ x }: { x: number }) {
  return (
    <Path
      transform={`translate(${x} 31)`}
      d="M0 4C-6-1-5-6-2.4-6C-1-6 0-5 0-3.8C0-5 1-6 2.4-6C5-6 6-1 0 4Z"
      fill="#FF3B5C"
    />
  );
}

function Star({ x }: { x: number }) {
  return (
    <Path
      transform={`translate(${x} 31.5) scale(0.95)`}
      d="M0-5.5L1.6-1.8L5.5-1.5L2.5 1L3.4 5L0 2.9L-3.4 5L-2.5 1L-5.5-1.5L-1.6-1.8Z"
      fill="#FFB000"
      stroke="#FFB000"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

/** Rostro de la palomita principal, centrado cerca de (60, 34). Cambia con la nota. */
function Face({ value, blink }: { value: number; blink: boolean }) {
  switch (value) {
    case 0:
      return (
        <>
          <Eyes closed />
          <Line d="M56 42 Q60 43 64 42" />
        </>
      );
    case 1:
      return (
        <>
          <Line d="M47 31 Q51 28 55 31" />
          <Line d="M65 31 Q69 28 73 31" />
          {SAD_BROWS}
          <Path d="M53 46 Q60 37 67 46 Z" fill={INK} />
          <Path d="M48 35 q-2.5 4 0 5.5 q2.5 -1.5 0 -5.5Z" fill="#6EC6FF" />
          <Path d="M72 35 q-2.5 4 0 5.5 q2.5 -1.5 0 -5.5Z" fill="#6EC6FF" />
        </>
      );
    case 2:
      return (
        <>
          <Eyes closed={blink} />
          {SAD_BROWS}
          <Path d="M54 45 Q60 39 66 45 Z" fill={INK} />
        </>
      );
    case 3:
      return (
        <>
          <Eyes closed={blink} />
          {SAD_BROWS}
          <Line d="M54 44 Q60 39.5 66 44" />
        </>
      );
    case 4:
      return (
        <>
          <Eyes closed={blink} />
          <Line d="M46.5 27.5 L55 27.5" w={2.2} />
          <Line d="M65 27.5 L73.5 27.5" w={2.2} />
          <Line d="M55 43 L65 43" />
        </>
      );
    case 5:
      return (
        <>
          <Eyes closed={blink} />
          <Line d="M54 43 Q57 41.5 60 43 T66 43" />
        </>
      );
    case 6:
      return (
        <>
          <Eyes closed={blink} />
          <Line d="M54.5 41.5 Q60 45 65.5 41.5" />
        </>
      );
    case 7:
      return (
        <>
          <Eyes closed={blink} />
          <Cheeks />
          <Line d="M53 41 Q60 47.5 67 41" />
        </>
      );
    case 8:
      return (
        <>
          <Eyes closed={blink} />
          <Cheeks />
          <OpenMouth top={40.5} bottom={50} wide={7.5} />
        </>
      );
    case 9:
      return (
        <>
          <Star x={51} />
          <Star x={69} />
          <Cheeks />
          <OpenMouth top={40} bottom={51} wide={8} />
        </>
      );
    default:
      return (
        <>
          <Heart x={51} />
          <Heart x={69} />
          <Cheeks />
          <OpenMouth top={39} bottom={53} wide={9.5} />
        </>
      );
  }
}

/** Bolsa grande con la palomita que reacciona. */
function HeroBag({ value, size }: { value: number; size: number }) {
  const id = useSvgId('hero');
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    // Parpadea cada pocos segundos, para que se sienta viva.
    const t = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 4200);
    return () => clearInterval(t);
  }, []);
  const side: [number, number][] = [
    [30, 50],
    [40, 40],
    [82, 42],
    [92, 52],
    [36, 56],
    [86, 58],
    [24, 58],
    [96, 60],
  ];
  return (
    <Svg width={size} height={(size * 160) / 120} viewBox="0 -14 120 160">
      <BagBody filled={value > 0} id={id}>
        {side.map(([x, y], i) => (
          <Kernel key={i} x={x} y={y} rotate={i * 61} scale={1.05} />
        ))}
        <G>
          <Circle cx={60} cy={36} r={22} fill="#FFF6E6" />
          <Circle cx={44} cy={24} r={12} fill="#FFF9EF" />
          <Circle cx={77} cy={23} r={12.5} fill="#FFF4E0" />
          <Circle cx={60} cy={16} r={12} fill="#FFF9EF" />
          <Circle cx={41} cy={44} r={11} fill="#FFF1D9" />
          <Circle cx={80} cy={45} r={11} fill="#FFF1D9" />
          <Circle cx={60} cy={38} r={19} fill="#FFF8EC" />
          <Circle cx={70} cy={18} r={3} fill={BUTTER} />
          <Circle cx={46} cy={19} r={2.2} fill={BUTTER} />
        </G>
        <Face value={value} blink={blink} />
      </BagBody>
    </Svg>
  );
}

// --- Calificación ---

/** Palomitas que saltan de una bolsa al calificar. */
function Burst({ trigger, count }: { trigger: number; count: number }) {
  const anims = useRef(Array.from({ length: 9 }, () => new Animated.Value(0))).current;
  const dirs = useRef(Array.from({ length: 9 }, () => ({ x: 0, y: 0, r: 0 }))).current;
  useEffect(() => {
    if (!trigger) return;
    anims.forEach((a, i) => {
      dirs[i] = { x: Math.random() * 70 - 35, y: -40 - Math.random() * 50, r: Math.random() * 540 - 270 };
      a.setValue(0);
    });
    Animated.stagger(
      25,
      anims
        .slice(0, count)
        .map((a) =>
          Animated.timing(a, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ),
    ).start();
  }, [trigger, count, anims, dirs]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {anims.slice(0, count).map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.kernel,
            {
              opacity: a.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, dirs[i].x] }) },
                { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, dirs[i].y] }) },
                { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${dirs[i].r}deg`] }) },
                { scale: a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1, 0.9] }) },
              ],
            },
          ]}>
          <Svg width={16} height={16} viewBox="-14 -14 28 28">
            <Kernel x={0} y={0} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

function MiniBag({ n, on, onPress, burst }: { n: number; on: boolean; onPress: () => void; burst: number }) {
  const C = useColors();
  const hop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!burst || !on) return;
    hop.setValue(0);
    Animated.sequence([
      Animated.delay(n * 30),
      Animated.spring(hop, { toValue: 1, friction: 3.5, tension: 220, useNativeDriver: true }),
      Animated.timing(hop, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [burst, on, n, hop]);
  return (
    <Touchable
      haptic="select"
      pressScale={0.88}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n} de 10`}
      accessibilityState={{ selected: on }}
      hitSlop={4}
      style={styles.mini}>
      <Animated.View
        style={{
          transform: [
            { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
            { scale: hop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
          ],
        }}>
        <PopcornBag filled={on} size={26} />
      </Animated.View>
      <T style={{ fontSize: 11, fontWeight: '700', color: on ? C.text : C.textFaint, marginTop: 2 }}>{n}</T>
    </Touchable>
  );
}

/**
 * Calificación de 1 a 10 con bolsas de palomitas. Tocar una bolsa pone esa nota;
 * tocar otra vez la misma la quita. La palomita grande reacciona a la nota.
 */
export function PopcornRating({ value, onChange }: { value: number | null; onChange?: (v: number | null) => void }) {
  const C = useColors();
  const v = value ?? 0;
  const [burst, setBurst] = useState(0);
  const bounce = useRef(new Animated.Value(0)).current;

  function choose(n: number) {
    if (!onChange) return;
    const next = n === v ? null : n;
    onChange(next);
    if (next) {
      // Las notas altas se celebran con una vibración doble.
      if (next >= 9) haptic('success');
      setBurst((b) => b + 1);
      bounce.setValue(0);
      Animated.spring(bounce, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start(() =>
        bounce.setValue(0),
      );
    }
  }

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={{
          transform: [
            { scaleX: bounce.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [1, 1.08, 0.97, 1] }) },
            { scaleY: bounce.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [1, 0.9, 1.06, 1] }) },
          ],
        }}>
        <HeroBag value={v} size={150} />
      </Animated.View>
      <View style={{ alignItems: 'center' }}>
        <T
          style={{
            fontSize: 22,
            lineHeight: 28,
            fontWeight: '800',
            letterSpacing: -0.6,
            color: v ? C.accentInk : C.textMuted,
          }}>
          {RATING_LABELS[v]}
        </T>
        <T variant="small" muted>
          {v ? `${v}/10` : onChange ? 'Toca una bolsa para calificar' : ''}
        </T>
      </View>
      <View style={styles.row}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <View key={n}>
            <MiniBag n={n} on={v >= n} onPress={() => choose(n)} burst={burst} />
            {n === v ? <Burst trigger={burst} count={v >= 9 ? 9 : 3 + Math.round(v / 3)} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Space.sm },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 4, flexWrap: 'nowrap' },
  mini: { alignItems: 'center', paddingHorizontal: 1 },
  kernel: { position: 'absolute', left: 6, top: 6 },
});
