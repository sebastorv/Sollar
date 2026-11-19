/**
 * Desplazamiento horizontal con flechas. En el computador (o en pantallas anchas) no siempre se
 * puede deslizar con el dedo: aparecen dos botones de vidrio, a la izquierda y a la derecha, que
 * avanzan una pantalla. Solo se ven cuando hay más contenido hacia ese lado.
 */

import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type FlatListProps,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';

type ScrollViewInstance = React.ComponentRef<typeof ScrollView>;

import { Space, WIDE } from '@/constants/theme';

import { LinearGradient } from 'expo-linear-gradient';

import { withAlpha } from '@/constants/theme';
import { useColors } from '@/store/theme';

import { Icon } from './icons';
import { Touchable } from './touch';

function useArrows() {
  const wide = useWindowDimensions().width >= WIDE;
  const [x, setX] = useState(0);
  const [view, setView] = useState(0);
  const [content, setContent] = useState(0);
  return {
    wide,
    x,
    view,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => setX(e.nativeEvent.contentOffset.x),
    onLayout: (e: LayoutChangeEvent) => setView(e.nativeEvent.layout.width),
    onContentSizeChange: (w: number) => setContent(w),
    canLeft: x > 8,
    canRight: x + view < content - 8,
  };
}

function Arrows({
  a,
  go,
  hover,
  height,
  textBelow,
}: {
  a: ReturnType<typeof useArrows>;
  go: (to: number) => void;
  hover: boolean;
  height: number;
  textBelow: number;
}) {
  const C = useColors();
  const page = Math.max(200, a.view * 0.85);
  const fadeW = a.wide ? 56 : 24;
  // Las flechas van centradas en la imagen (no en la fila con el texto).
  const top = Math.max(0, (height - textBelow) / 2 - 18);
  const fade = (side: 'left' | 'right', on: boolean) => (
    <LinearGradient
      pointerEvents="none"
      colors={[withAlpha(C.bg, 0.92), withAlpha(C.bg, 0)]}
      start={{ x: side === 'left' ? 0 : 1, y: 0 }}
      end={{ x: side === 'left' ? 1 : 0, y: 0 }}
      style={[styles.fade, { [side]: 0, width: fadeW, opacity: on ? 1 : 0 }]}
    />
  );
  return (
    <>
      {/* Un degradado suave donde la fila queda cortada, para que no se vea mocha. */}
      {fade('left', a.canLeft)}
      {fade('right', a.canRight)}
      {a.wide && a.canLeft ? (
        <View pointerEvents="box-none" style={[styles.side, { left: 8, top, opacity: hover ? 1 : 0 }]}>
          <Arrow icon="chevronLeft" label="Anterior" onPress={() => go(Math.max(0, a.x - page))} />
        </View>
      ) : null}
      {a.wide && a.canRight ? (
        <View pointerEvents="box-none" style={[styles.side, { right: 8, top, opacity: hover ? 1 : 0 }]}>
          <Arrow icon="chevronRight" label="Siguiente" onPress={() => go(a.x + page)} />
        </View>
      ) : null}
    </>
  );
}

function Arrow({ icon, label, onPress }: { icon: 'chevronLeft' | 'chevronRight'; label: string; onPress: () => void }) {
  const C = useColors();
  return (
    <Touchable
      haptic="light"
      pressScale={0.9}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.mode === 'light' ? 'rgba(255,255,255,0.72)' : 'rgba(30,29,36,0.6)',
        backdropFilter: 'blur(14px) saturate(180%)',
      } as object}>
      <Icon name={icon} size={17} color={C.text} strokeWidth={1.8} />
    </Touchable>
  );
}

/** Si el puntero está encima de la fila (solo computador). */
function useHover() {
  const [hover, setHover] = useState(false);
  return { hover, bind: { onPointerEnter: () => setHover(true), onPointerLeave: () => setHover(false) } };
}

/**
 * Las filas que llegan al borde de la pantalla usan márgenes negativos: el margen se pasa al
 * contenedor, para que el degradado y las flechas queden en el borde real.
 */
function splitMargin(style: unknown) {
  const flat = (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
  const { marginHorizontal, marginLeft, marginRight, ...rest } = flat;
  return { outer: { marginHorizontal, marginLeft, marginRight } as ViewStyle, inner: rest as ViewStyle };
}

export function HScroll({
  children,
  onScroll,
  innerRef,
  textBelow = 56,
  ...props
}: ComponentProps<typeof ScrollView> & {
  children?: ReactNode;
  innerRef?: { current: ScrollViewInstance | null };
  /** Alto del texto bajo cada tarjeta, para centrar las flechas en la imagen. */
  textBelow?: number;
}) {
  const own = useRef<ScrollViewInstance>(null);
  const ref = innerRef ?? own;
  const a = useArrows();
  const h = useHover();
  const [height, setHeight] = useState(0);
  const { outer, inner } = splitMargin(props.style);
  return (
    <View {...h.bind} style={outer} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <ScrollView
        {...props}
        style={inner}
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          a.onScroll(e);
          onScroll?.(e);
        }}
        onLayout={a.onLayout}
        onContentSizeChange={a.onContentSizeChange}>
        {children}
      </ScrollView>
      <Arrows a={a} hover={h.hover} height={height} textBelow={textBelow} go={(to) => ref.current?.scrollTo({ x: to, animated: true })} />
    </View>
  );
}

export function HList<T>({ onScroll, textBelow = 56, ...props }: FlatListProps<T> & { textBelow?: number }) {
  const ref = useRef<FlatList<T>>(null);
  const a = useArrows();
  const h = useHover();
  const [height, setHeight] = useState(0);
  const { outer, inner } = splitMargin(props.style);
  return (
    <View {...h.bind} style={outer} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <FlatList
        {...props}
        style={inner}
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => {
          a.onScroll(e);
          onScroll?.(e);
        }}
        onLayout={a.onLayout}
        onContentSizeChange={a.onContentSizeChange}
      />
      <Arrows a={a} hover={h.hover} height={height} textBelow={textBelow} go={(to) => ref.current?.scrollToOffset({ offset: to, animated: true })} />
    </View>
  );
}

const styles = StyleSheet.create({
  side: { position: 'absolute', zIndex: 5 },
  fade: { position: 'absolute', top: 0, bottom: 0, zIndex: 4 },
});
