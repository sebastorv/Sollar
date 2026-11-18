/**
 * Ventanas pequeñas como burbujas, al estilo del iOS nuevo: no ocupan toda la pantalla, flotan
 * con márgenes y se abren con un rebote suave (crecen desde el botón que las abrió, si se sabe
 * dónde está). Sirven para elegir algo o cambiar un ajuste rápido.
 *
 * - Sheet: burbuja con título y contenido libre.
 * - BubbleMenu: lista de opciones que sale pegada al botón que la abrió.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { shown, v } = usePop(visible);
  if (!shown) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, Space.lg), paddingTop: insets.top + Space.lg }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: v }]}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: C.scrim }]} onPress={onClose} accessibilityLabel="Cerrar" />
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
          <Glass strong radius={30} style={styles.bubble}>
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
  const { width, height } = useWindowDimensions();
  const { shown, v } = usePop(!!anchor);
  const last = useRef<Anchor | null>(null);
  if (anchor) last.current = anchor;
  const a = last.current;
  if (!shown || !a) return null;

  const W = Math.min(300, width - Space.lg * 2);
  const rows = items.length;
  const H = rows * 50 + (title ? 44 : 0) + 16;
  const below = a.y + a.height + H + 16 < height;
  const left = Math.min(Math.max(Space.lg, a.x + a.width / 2 - W / 2), width - W - Space.lg);
  const top = below ? a.y + a.height + 8 : Math.max(Space.lg, a.y - H - 8);
  // El punto desde donde crece: el centro del botón.
  const ox = a.x + a.width / 2 - (left + W / 2);
  const oy = below ? -H / 2 : H / 2;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.12)', opacity: v }]} />
      </Pressable>
      <Animated.View
        style={{
          position: 'absolute',
          left,
          top,
          width: W,
          opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [ox, 0] }) },
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [oy, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
          ],
        }}>
        <Glass strong radius={26} style={{ paddingVertical: Space.sm }}>
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
