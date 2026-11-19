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
} from 'react-native';

type ScrollViewInstance = React.ComponentRef<typeof ScrollView>;

import { Space, WIDE } from '@/constants/theme';

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
}: {
  a: ReturnType<typeof useArrows>;
  go: (to: number) => void;
  hover: boolean;
}) {
  if (!a.wide) return null;
  const page = Math.max(200, a.view * 0.85);
  // Discretas: solo aparecen al pasar el puntero por la fila.
  return (
    <>
      {a.canLeft ? (
        <View pointerEvents="box-none" style={[styles.side, { left: 6, opacity: hover ? 1 : 0 }]}>
          <Arrow icon="chevronLeft" label="Anterior" onPress={() => go(Math.max(0, a.x - page))} />
        </View>
      ) : null}
      {a.canRight ? (
        <View pointerEvents="box-none" style={[styles.side, { right: 6, opacity: hover ? 1 : 0 }]}>
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
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.mode === 'light' ? 'rgba(255,255,255,0.88)' : 'rgba(40,38,48,0.88)',
        boxShadow: C.mode === 'light' ? '0 4px 14px rgba(30,16,50,0.16)' : '0 4px 14px rgba(0,0,0,0.5)',
      }}>
      <Icon name={icon} size={18} color={C.text} strokeWidth={2} />
    </Touchable>
  );
}

/** Si el puntero está encima de la fila (solo computador). */
function useHover() {
  const [hover, setHover] = useState(false);
  return { hover, bind: { onPointerEnter: () => setHover(true), onPointerLeave: () => setHover(false) } };
}

export function HScroll({
  children,
  onScroll,
  innerRef,
  ...props
}: ComponentProps<typeof ScrollView> & { children?: ReactNode; innerRef?: { current: ScrollViewInstance | null } }) {
  const own = useRef<ScrollViewInstance>(null);
  const ref = innerRef ?? own;
  const a = useArrows();
  const h = useHover();
  return (
    <View {...h.bind}>
      <ScrollView
        {...props}
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
      <Arrows a={a} hover={h.hover} go={(to) => ref.current?.scrollTo({ x: to, animated: true })} />
    </View>
  );
}

export function HList<T>({ onScroll, ...props }: FlatListProps<T>) {
  const ref = useRef<FlatList<T>>(null);
  const a = useArrows();
  const h = useHover();
  return (
    <View {...h.bind}>
      <FlatList
        {...props}
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
      <Arrows a={a} hover={h.hover} go={(to) => ref.current?.scrollToOffset({ offset: to, animated: true })} />
    </View>
  );
}

const styles = StyleSheet.create({
  side: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center', zIndex: 5 },
});
