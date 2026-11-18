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

import { GlassButton } from './glass';

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
}: {
  a: ReturnType<typeof useArrows>;
  go: (to: number) => void;
}) {
  if (!a.wide) return null;
  const page = Math.max(200, a.view * 0.85);
  return (
    <>
      {a.canLeft ? (
        <View pointerEvents="box-none" style={[styles.side, { left: -Space.sm }]}>
          <GlassButton icon="back" label="Anterior" onPress={() => go(Math.max(0, a.x - page))} />
        </View>
      ) : null}
      {a.canRight ? (
        <View pointerEvents="box-none" style={[styles.side, { right: -Space.sm }]}>
          <GlassButton icon="chevronRight" label="Siguiente" onPress={() => go(a.x + page)} />
        </View>
      ) : null}
    </>
  );
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
  return (
    <View>
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
      <Arrows a={a} go={(to) => ref.current?.scrollTo({ x: to, animated: true })} />
    </View>
  );
}

export function HList<T>({ onScroll, ...props }: FlatListProps<T>) {
  const ref = useRef<FlatList<T>>(null);
  const a = useArrows();
  return (
    <View>
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
      <Arrows a={a} go={(to) => ref.current?.scrollToOffset({ offset: to, animated: true })} />
    </View>
  );
}

const styles = StyleSheet.create({
  side: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center', zIndex: 5 },
});
