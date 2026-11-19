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
export type Face = {
  eyes: Eyes;
  mouth: Mouth;
  blush?: boolean;
  tear?: boolean;
  sweat?: boolean;
  brows?: 'up' | 'angry' | 'worried' | 'raised';
  /** Detalle alrededor: chispas, corazones, zzz, signo de pregunta o vapor de enojo. */
  extra?: 'sparkles' | 'hearts' | 'zzz' | 'question' | 'steam';
};

/**
 * Caras con brillo y volumen, al estilo de los emojis modernos: ojos grandes y brillantes con
 * dos reflejos, bocas abiertas con fondo oscuro y lengua, cejas gruesas, cachetes difuminados,
 * lágrimas y gotas con luz, y un detalle alrededor según la emoción.
 */
function FaceArt({ face }: { face: Face }) {
  const id = useId('face');
  const ink = '#2B1406';
  const s = { stroke: ink, strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const shine = (x: number, y: number, r = 1.05) => (
    <>
      <Circle cx={x - 0.75} cy={y - 1.05} r={r} fill="#fff" />
      <Circle cx={x + 0.75} cy={y + 0.9} r={r * 0.45} fill="#fff" opacity={0.85} />
    </>
  );
  const eye = (x: number) => {
    const y = 19.8;
    switch (face.eyes) {
      case 'happy':
        return <Path key={x} d={`M${x - 2.6} ${y + 0.9}q2.6-3.4 5.2 0`} {...s} strokeWidth={2.3} />;
      case 'closed':
        return <Path key={x} d={`M${x - 2.6} ${y - 0.3}q2.6 3 5.2 0`} {...s} strokeWidth={2.3} />;
      case 'squint':
        return <Path key={x} d={x < 20 ? `M${x - 2.4} ${y - 2}l4 2.1-4 2.1` : `M${x + 2.4} ${y - 2}l-4 2.1 4 2.1`} {...s} strokeWidth={2.3} />;
      case 'sleepy':
        return (
          <G key={x}>
            <Path d={`M${x - 2.6} ${y}q2.6 1.6 5.2 0`} {...s} />
            <Path d={`M${x - 2.6} ${y}h5.2`} stroke={ink} strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
          </G>
        );
      case 'wide':
        return (
          <G key={x}>
            <Ellipse cx={x} cy={y - 0.3} rx={3.4} ry={3.9} fill={`url(#${id}w)`} stroke={ink} strokeWidth={0.9} />
            <Ellipse cx={x} cy={y} rx={1.55} ry={1.8} fill={`url(#${id}e)`} />
            {shine(x, y, 0.7)}
          </G>
        );
      case 'side':
        return (
          <G key={x}>
            <Ellipse cx={x} cy={y} rx={3} ry={3.3} fill={`url(#${id}w)`} stroke={ink} strokeWidth={0.9} />
            <Ellipse cx={x + 1.2} cy={y + 0.2} rx={1.5} ry={1.8} fill={`url(#${id}e)`} />
            {shine(x + 1.2, y + 0.2, 0.6)}
          </G>
        );
      case 'teary':
        return (
          <G key={x}>
            <Ellipse cx={x} cy={y} rx={2.8} ry={3.4} fill={`url(#${id}e)`} />
            {/* Agua acumulada en el ojo */}
            <Path d={`M${x - 2.7} ${y + 0.6}a2.8 2.6 0 0 0 5.4 0Z`} fill="#6CC4FF" opacity={0.75} />
            {shine(x, y - 0.4, 1.25)}
          </G>
        );
      case 'heart':
        return (
          <G key={x}>
            <Path
              d={`M${x} ${y + 3.4}l-3.4-3.3a2.05 2.05 0 0 1 3.4-2.3 2.05 2.05 0 0 1 3.4 2.3Z`}
              fill={`url(#${id}h)`}
            />
            <Ellipse cx={x - 1.6} cy={y - 1.4} rx={0.9} ry={0.6} fill="#fff" opacity={0.85} />
          </G>
        );
      case 'star':
        return (
          <G key={x}>
            <Path
              d={`M${x} ${y - 3.6}l1.25 2.6 2.85.4-2.07 2 .5 2.85L${x} ${y + 2.5}l-2.53 1.35.5-2.85-2.07-2 2.85-.4Z`}
              fill={`url(#${id}s)`}
              stroke="#B4660E"
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
            <Circle cx={x - 0.8} cy={y - 1} r={0.6} fill="#fff" />
          </G>
        );
      case 'angry':
        return (
          <G key={x}>
            <Ellipse cx={x} cy={y + 0.6} rx={2.3} ry={2.6} fill={`url(#${id}e)`} />
            {shine(x, y + 0.6, 0.8)}
          </G>
        );
      default:
        return (
          <G key={x}>
            <Ellipse cx={x} cy={y} rx={2.5} ry={3.2} fill={`url(#${id}e)`} />
            {shine(x, y)}
          </G>
        );
    }
  };
  const open = (d: string, tongue?: string) => (
    <G>
      <Path d={d} fill={`url(#${id}m)`} stroke={ink} strokeWidth={1.1} strokeLinejoin="round" />
      {tongue ? <Path d={tongue} fill={`url(#${id}t)`} /> : null}
    </G>
  );
  const mouth = () => {
    switch (face.mouth) {
      case 'grin':
        return (
          <G>
            {open('M14.6 24.6h10.8a5.4 5.4 0 0 1-10.8 0Z', 'M17.4 28.6a2.6 2 0 0 1 5.2 0 5.4 3 0 0 1-5.2 0Z')}
            <Path d="M15.4 24.9h9.2v1.3a6 3 0 0 1-9.2 0Z" fill="#fff" />
          </G>
        );
      case 'tongue':
        return open('M15.6 24.6h8.8a4.4 4.4 0 0 1-8.8 0Z', 'M17.6 27.4a2.4 2.2 0 0 1 4.8 0v1.4a2.4 2.4 0 0 1-4.8 0Z');
      case 'o':
        return open('M20 23.4a2.6 3.2 0 1 1 0 6.4 2.6 3.2 0 1 1 0-6.4Z', 'M18.3 28.4a1.7 1.1 0 0 1 3.4 0 1.7 0.9 0 0 1-3.4 0Z');
      case 'frown':
        return <Path d="M16.4 28q3.6-3.6 7.2 0" {...s} />;
      case 'flat':
        return <Path d="M16.8 26.4h6.4" {...s} />;
      case 'wavy':
        return <Path d="M15.8 26.8q1.05-1.4 2.1 0t2.1 0 2.1 0 2.1 0" {...s} strokeWidth={1.9} />;
      case 'teeth':
        return (
          <G>
            <Path d="M15.2 24.2h9.6a1.6 1.6 0 0 1 1.6 1.6v.6a1.6 1.6 0 0 1-1.6 1.6h-9.6a1.6 1.6 0 0 1-1.6-1.6v-.6a1.6 1.6 0 0 1 1.6-1.6Z" fill="#fff" stroke={ink} strokeWidth={1.2} />
            <Path d="M13.8 26.1h12.4M17.4 24.2v3.8M20 24.2v3.8M22.6 24.2v3.8" stroke={ink} strokeWidth={0.8} />
          </G>
        );
      case 'small':
        return <Path d="M17.6 25.4q2.4 2 4.8 0" {...s} />;
      default:
        return <Path d="M16 24.8q4 4 8 0" {...s} strokeWidth={2.3} />;
    }
  };
  const drop = (x: number, y: number, k = 1) => (
    <G>
      <Path d={`M${x} ${y}q${2.2 * k} ${3 * k} 0 ${4.6 * k}q${-2.2 * k} ${-1.6 * k} 0 ${-4.6 * k}Z`} fill={`url(#${id}d)`} />
      <Circle cx={x - 0.5 * k} cy={y + 2.6 * k} r={0.55 * k} fill="#fff" />
    </G>
  );
  return (
    <G>
      <Defs>
        <RadialGradient id={`${id}e`} cx="0.4" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#5B3420" />
          <Stop offset="0.55" stopColor="#24110A" />
          <Stop offset="1" stopColor="#0E0603" />
        </RadialGradient>
        <RadialGradient id={`${id}w`} cx="0.4" cy="0.35" r="0.7">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E9E3DA" />
        </RadialGradient>
        <RadialGradient id={`${id}m`} cx="0.5" cy="0.2" r="0.9">
          <Stop offset="0" stopColor="#8E2A1C" />
          <Stop offset="1" stopColor="#3A0C06" />
        </RadialGradient>
        <RadialGradient id={`${id}t`} cx="0.45" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#FF9AA8" />
          <Stop offset="1" stopColor="#E8506A" />
        </RadialGradient>
        <RadialGradient id={`${id}h`} cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#FF7B95" />
          <Stop offset="1" stopColor="#D8173F" />
        </RadialGradient>
        <RadialGradient id={`${id}s`} cx="0.4" cy="0.35" r="0.8">
          <Stop offset="0" stopColor="#FFF2A6" />
          <Stop offset="1" stopColor="#FFB21E" />
        </RadialGradient>
        <RadialGradient id={`${id}d`} cx="0.4" cy="0.6" r="0.8">
          <Stop offset="0" stopColor="#B8E6FF" />
          <Stop offset="1" stopColor="#3E9BF0" />
        </RadialGradient>
        <RadialGradient id={`${id}b`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FF5C7C" stopOpacity="0.6" />
          <Stop offset="1" stopColor="#FF5C7C" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {face.blush ? (
        <>
          <Ellipse cx={12.2} cy={24.4} rx={3} ry={2} fill={`url(#${id}b)`} />
          <Ellipse cx={27.8} cy={24.4} rx={3} ry={2} fill={`url(#${id}b)`} />
        </>
      ) : null}
      {face.brows === 'angry' ? <Path d="M12 15.2l5 2.2M28 15.2l-5 2.2" {...s} strokeWidth={2.4} /> : null}
      {face.brows === 'worried' ? <Path d="M12.4 16.6l4.6-2M27.6 16.6l-4.6-2" {...s} strokeWidth={2.2} /> : null}
      {face.brows === 'up' ? <Path d="M12.4 14.6q2.6-1.8 5.2 0M22.4 14.6q2.6-1.8 5.2 0" {...s} strokeWidth={2.2} /> : null}
      {face.brows === 'raised' ? <Path d="M12.4 15.8l4.8-.6M22.4 14q2.6-1.8 5.2 0" {...s} strokeWidth={2.2} /> : null}
      {eye(15)}
      {eye(25)}
      {mouth()}
      {face.tear ? drop(27.6, 22.4, 0.9) : null}
      {face.sweat ? drop(30.4, 10.8, 1) : null}
      {face.extra === 'sparkles' ? (
        <>
          <Path d="M5 8l.9 2.1L8 11l-2.1.9L5 14l-.9-2.1L2 11l2.1-.9Z" fill="#FFD84A" />
          <Path d="M34.5 5.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" fill="#FFD84A" />
          <Path d="M36 30l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z" fill="#FFE98A" />
        </>
      ) : null}
      {face.extra === 'hearts' ? (
        <>
          <Path d="M5.5 10.6l-2.2-2.1a1.3 1.3 0 0 1 2.2-1.5 1.3 1.3 0 0 1 2.2 1.5Z" fill={`url(#${id}h)`} />
          <Path d="M35 7.4l-1.6-1.5a.95.95 0 0 1 1.6-1.1.95.95 0 0 1 1.6 1.1Z" fill={`url(#${id}h)`} />
        </>
      ) : null}
      {face.extra === 'zzz' ? (
        <Path d="M31 4.5h3.6l-3.6 3.8h3.6M35.6 9.6h2.4l-2.4 2.6h2.4" stroke="#9C8FD6" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ) : null}
      {face.extra === 'question' ? (
        <Path d="M32.6 6.2a2.2 2.2 0 1 1 3 2c-.8.4-.8.8-.8 1.6M34.8 12.4v.1" stroke="#7D6BE0" strokeWidth={1.5} strokeLinecap="round" fill="none" />
      ) : null}
      {face.extra === 'steam' ? (
        <Path d="M31.4 8.4q1.2-1.2 0-2.4t0-2.4M34.6 9.4q1.2-1.2 0-2.4t0-2.4" stroke="#FF6B5A" strokeWidth={1.4} strokeLinecap="round" fill="none" />
      ) : null}
    </G>
  );
}

/** Cara según la nota: de triste a encantada. */
function faceFor(v: number): Face {
  if (!v) return { eyes: 'dot', mouth: 'small', brows: 'raised' };
  if (v <= 2) return { eyes: 'teary', mouth: 'frown', tear: true, brows: 'worried' };
  if (v <= 4) return { eyes: 'dot', mouth: 'frown', brows: 'worried' };
  if (v <= 5) return { eyes: 'dot', mouth: 'flat' };
  if (v <= 6) return { eyes: 'dot', mouth: 'small' };
  if (v <= 7) return { eyes: 'dot', mouth: 'smile', blush: true };
  if (v <= 8) return { eyes: 'happy', mouth: 'smile', blush: true };
  if (v <= 9) return { eyes: 'star', mouth: 'grin', blush: true, extra: 'sparkles' };
  return { eyes: 'heart', mouth: 'grin', blush: true, extra: 'hearts' };
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
  { id: 'divertido', label: 'Divertido', face: { eyes: 'squint', mouth: 'grin', blush: true, tear: true } },
  { id: 'conmovido', label: 'Conmovido', face: { eyes: 'teary', mouth: 'small', blush: true, tear: true } },
  { id: 'triste', label: 'Triste', face: { eyes: 'dot', mouth: 'frown', tear: true, brows: 'worried' } },
  { id: 'emocionado', label: 'Emocionado', face: { eyes: 'star', mouth: 'grin', blush: true, extra: 'sparkles' } },
  { id: 'asustado', label: 'Asustado', face: { eyes: 'wide', mouth: 'wavy', sweat: true, brows: 'worried' } },
  { id: 'tenso', label: 'Tenso', face: { eyes: 'wide', mouth: 'teeth', sweat: true } },
  { id: 'aburrido', label: 'Aburrido', face: { eyes: 'sleepy', mouth: 'flat', extra: 'zzz' } },
  { id: 'enojado', label: 'Enojado', face: { eyes: 'angry', mouth: 'frown', brows: 'angry', extra: 'steam' } },
  { id: 'confundido', label: 'Confundido', face: { eyes: 'side', mouth: 'wavy', brows: 'raised', extra: 'question' } },
  { id: 'enamorado', label: 'Enamorado', face: { eyes: 'heart', mouth: 'tongue', blush: true, extra: 'hearts' } },
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
        backgroundColor: on ? C.accentSoft : C.mode === 'dark' ? 'rgba(255,255,255,0.05)' : C.surface,
        boxShadow: on ? `inset 0 0 0 2px ${C.accent}` : C.mode === 'dark' ? 'none' : '0 2px 10px rgba(30,16,50,0.06)',
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
