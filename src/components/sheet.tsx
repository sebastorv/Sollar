/**
 * Ventanas pequeñas como burbujas, al estilo del iOS nuevo: no ocupan toda la pantalla, flotan
 * con márgenes y se abren con un rebote suave (crecen desde el botón que las abrió, si se sabe
 * dónde está). Sirven para elegir algo o cambiar un ajuste rápido.
 *
 * - Sheet: burbuja con título y contenido libre.
 * - BubbleMenu: lista de opciones que sale pegada al botón que la abrió.
 */

import { tr } from '@/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Space } from '@/constants/theme';
import { useColors } from '@/store/theme';

import { Glass } from './glass';
import { Icon, type IconName } from './icons';
import { Touchable } from './touch';
import { T } from './ui';

const native = Platform.OS !== 'web';

/** Abre y cierra con resorte: crece desde un punto y se desvanece al cerrar. */
function usePop(visible: boolean) {
  const [shown, setShown] = useState(visible);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      setShown(true);
      v.setValue(0);
      Animated.spring(v, { toValue: 1, useNativeDriver: native, speed: 16, bounciness: 9 }).start();
    } else if (shown) {
      Animated.timing(v, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: native }).start(() =>
        setShown(false),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  return { shown, v };
}

/**
 * Dónde poner una burbuja junto al botón que la abrió: debajo si cabe, si no encima; alineada
 * con el borde del botón (izquierdo o derecho, según el lado de la pantalla en que esté).
 * Devuelve la posición y el punto desde donde crece (el botón).
 */
function place(a: Anchor, W: number, H: number, screen: { width: number; height: number }, top0: number, bottom0: number) {
  const gap = 8;
  const margin = Space.md;
  const spaceBelow = screen.height - bottom0 - (a.y + a.height) - gap;
  const spaceAbove = a.y - top0 - gap;
  const below = spaceBelow >= Math.min(H, 320) || spaceBelow >= spaceAbove;
  const room = Math.max(160, (below ? spaceBelow : spaceAbove) - margin);
  const center = a.x + a.width / 2;
  let left = center < screen.width / 2 ? a.x : a.x + a.width - W;
  left = Math.min(Math.max(margin, left), screen.width - W - margin);
  const originX = Math.min(Math.max(center - left, 16), W - 16);
  const pos = below ? { top: a.y + a.height + gap } : { bottom: screen.height - a.y + gap };
  return { left, pos, maxHeight: room, origin: `${Math.round(originX)}px ${below ? '0%' : '100%'}` };
}

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  anchor,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Botón que la abrió: la burbuja sale pegada a él. Sin él, flota abajo en el centro. */
  anchor?: Anchor | null;
  children: ReactNode;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const { shown, v } = usePop(visible);
  const last = useRef<Anchor | null>(null);
  if (anchor) last.current = anchor;
  if (!shown) return null;
  const a = anchor === undefined ? null : last.current;

  const inner = (
    <Glass strong radius={28} style={styles.bubble}>
      {title ? (
        <View style={{ gap: 2 }}>
          <T variant="heading">{title}</T>
          {subtitle ? (
            <T variant="small" muted>
              {subtitle}
            </T>
          ) : null}
        </View>
      ) : null}
      {children}
    </Glass>
  );

  if (a) {
    const W = Math.min(400, screen.width - Space.md * 2);
    const p = place(a, W, 360, screen, insets.top, insets.bottom);
    return (
      <Modal visible transparent animationType="none" onRequestClose={onClose}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={tr('Cerrar')}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.14)', opacity: v }]} />
        </Pressable>
        <Animated.View
          style={{
            position: 'absolute',
            left: p.left,
            ...p.pos,
            width: W,
            maxHeight: p.maxHeight,
            transformOrigin: p.origin,
            opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}>
          <ScrollView bounces={false} style={{ maxHeight: p.maxHeight }} contentContainerStyle={{ flexGrow: 0 }}>
            {inner}
          </ScrollView>
        </Animated.View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Space.lg), paddingTop: insets.top + Space.lg }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: v }]}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: C.scrim }]} onPress={onClose} accessibilityLabel={tr('Cerrar')} />
        </Animated.View>
        <Animated.View
          style={[
            styles.bubbleBox,
            {
              opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
              ],
            },
          ]}>
          {inner}
        </Animated.View>
      </View>
    </Modal>
  );
}

export type BubbleItem = {
  label: string;
  icon?: IconName;
  on?: boolean;
  danger?: boolean;
  onPress: () => void;
};

export type Anchor = { x: number; y: number; width: number; height: number };

/** Mide dónde está un botón en la pantalla, para que la burbuja salga de ahí. */
export function measure(node: unknown): Promise<Anchor | null> {
  return new Promise((resolve) => {
    const n = node as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      getBoundingClientRect?: () => DOMRect;
    } | null;
    // En la web llega el elemento del navegador.
    if (n?.getBoundingClientRect) {
      const r = n.getBoundingClientRect();
      return resolve({ x: r.left, y: r.top, width: r.width, height: r.height });
    }
    if (!n?.measureInWindow) return resolve(null);
    n.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

/** Lo que entrega un toque: el elemento tocado, para medirlo. */
export type PressLike = { currentTarget?: unknown; target?: unknown } | undefined;

/** Mide el botón de un toque; si no se puede, usa el centro de la pantalla. */
export async function anchorOf(e: PressLike, fallback: Anchor): Promise<Anchor> {
  return (await measure(e?.currentTarget ?? e?.target)) ?? fallback;
}

/** Menú de opciones pegado al botón que lo abrió; crece desde ese botón. */
export function BubbleMenu({
  anchor,
  title,
  items,
  onClose,
}: {
  anchor: Anchor | null;
  title?: string;
  items: (BubbleItem | 'divider')[];
  onClose: () => void;
}) {
  const C = useColors();
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { shown, v } = usePop(!!anchor);
  const last = useRef<Anchor | null>(null);
  if (anchor) last.current = anchor;
  const a = last.current;
  if (!shown || !a) return null;

  const W = Math.min(290, screen.width - Space.md * 2);
  const H = items.reduce((h, it) => h + (it === 'divider' ? 9 : 48), (title ? 40 : 0) + 16);
  const p = place(a, W, H, screen, insets.top, insets.bottom);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={tr('Cerrar')}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.12)', opacity: v }]} />
      </Pressable>
      <Animated.View
        style={{
          position: 'absolute',
          left: p.left,
          ...p.pos,
          width: W,
          transformOrigin: p.origin,
          opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
        }}>
        <Glass strong radius={24}>
          <ScrollView bounces={false} style={{ maxHeight: p.maxHeight }} contentContainerStyle={{ paddingVertical: Space.sm }}>
            {title ? (
              <T style={{ fontSize: 13, fontWeight: '700', color: C.textMuted, paddingHorizontal: Space.lg, paddingVertical: Space.sm }}>
                {title.toUpperCase()}
              </T>
            ) : null}
            {items.map((it, i) =>
              it === 'divider' ? (
                <View key={i} style={{ height: 1, backgroundColor: C.border, marginVertical: 4, marginHorizontal: Space.lg }} />
              ) : (
                <Touchable
                  key={i}
                  haptic="select"
                  pressScale={0.97}
                  onPress={() => {
                    onClose();
                    it.onPress();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: it.on }}
                  style={styles.item}>
                  {it.icon ? (
                    <View>
                      <Icon name={it.icon} size={20} color={it.danger ? C.danger : C.text} />
                    </View>
                  ) : null}
                  <T style={{ flex: 1, fontSize: 16, fontWeight: it.on ? '700' : '500', color: it.danger ? C.danger : C.text }}>
                    {it.label}
                  </T>
                  {it.on ? (
                    <View>
                      <Icon name="check" size={18} color={C.accentInk} strokeWidth={2.6} />
                    </View>
                  ) : null}
                </Touchable>
              ),
            )}
          </ScrollView>
        </Glass>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: Space.md, justifyContent: 'flex-end' },
  bubbleBox: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  bubble: { padding: Space.xl, gap: Space.lg },
  item: { flexDirection: 'row', alignItems: 'center', gap: Space.md, height: 48, paddingHorizontal: Space.lg },
});
