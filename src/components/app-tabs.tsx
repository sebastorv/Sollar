/**
 * Navegación principal, igual en iPhone, Android y web.
 *
 * - Celular: una píldora de vidrio flotando abajo, con ícono y nombre en cada pestaña. Al cambiar
 *   de pestaña, una gota de vidrio se desliza y se estira hasta la nueva (como el vidrio líquido
 *   de iOS). Al bajar en una pantalla, la barra se minimiza a la pestaña actual; al subir, vuelve.
 * - Pantallas anchas (computador, tablet): una barra lateral mínima a la izquierda.
 *
 * Los TabTrigger deben ser hijos directos de TabList: el diseño va dentro de BarLayout.
 */

import { usePathname } from 'expo-router';
import {
  Tabs,
  TabList,
  TabSlot,
  TabTrigger,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Space, WIDE, RAIL_WIDTH, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';

import { SollarLogo } from './brand';
import { Glass } from './glass';
import { Icon, type IconName } from './icons';
import { TabScrollProvider, useTabScroll } from './tab-scroll';
import { Touchable } from './touch';
import { RailContext, T } from './ui';

const ROUTES = ['/', '/calendario', '/buscar', '/lista', '/perfil'];
const PAD = 5;
const native = Platform.OS !== 'web';

/** Ancho de cada pestaña, para que la gota sepa adónde ir. */
const TabWidth = createContext(0);

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const narrow = width < WIDE;

  return (
    <TabScrollProvider>
      <Tabs>
        <RailContext value={true}>
          <TabSlot style={{ flex: 1 }} />
        </RailContext>
        <TabList asChild>
          <BarLayout narrow={narrow}>
            <TabTrigger name="index" href="/" asChild>
              <TabButton narrow={narrow} icon="play" label="Siguiendo" />
            </TabTrigger>
            <TabTrigger name="calendario" href="/calendario" asChild>
              <TabButton narrow={narrow} icon="calendar" label="Calendario" />
            </TabTrigger>
            <TabTrigger name="buscar" href="/buscar" asChild>
              <TabButton narrow={narrow} icon="search" label="Buscar" />
            </TabTrigger>
            <TabTrigger name="lista" href="/lista" asChild>
              <TabButton narrow={narrow} icon="ticket" label="Mi lista" />
            </TabTrigger>
            <TabTrigger name="perfil" href="/perfil" asChild>
              <TabButton narrow={narrow} icon="person" label="Perfil" />
            </TabTrigger>
          </BarLayout>
        </TabList>
      </Tabs>
    </TabScrollProvider>
  );
}

function BarLayout({ narrow, children, ...rest }: TabListProps & { narrow: boolean }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const C = useColors();
  const pathname = usePathname();
  const index = Math.max(0, ROUTES.findIndex((r) => (r === '/' ? pathname === '/' : pathname.startsWith(r))));
  const { collapsed, setCollapsed } = useTabScroll();
  const [full, setFull] = useState(0);
  const [wrapW, setWrapW] = useState(0);
  const tabW = full ? (full - PAD * 2) / ROUTES.length : 0;

  // La gota: se desliza con resorte y se estira mientras viaja.
  const x = useRef(new Animated.Value(0)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const fold = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (!tabW) return;
    const to = index * tabW;
    if (first.current) {
      x.setValue(to);
      first.current = false;
      return;
    }
    Animated.parallel([
      Animated.spring(x, { toValue: to, useNativeDriver: native, speed: 14, bounciness: 7 }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1.32, duration: 120, useNativeDriver: native }),
        Animated.spring(stretch, { toValue: 1, useNativeDriver: native, speed: 10, bounciness: 14 }),
      ]),
    ]).start();
  }, [index, tabW, x, stretch]);

  useEffect(() => {
    Animated.spring(fold, { toValue: collapsed ? 1 : 0, useNativeDriver: false, speed: 16, bounciness: 4 }).start();
  }, [collapsed, fold]);

  if (!narrow) {
    return (
      <View {...rest} pointerEvents="box-none" style={[styles.railWrap, { top: insets.top + Space.lg, bottom: Space.lg }]}>
        <Glass radius={28} style={styles.rail}>
          <View style={styles.railInner}>
            <View style={{ marginBottom: Space.lg }}>
              <SollarLogo size={40} shape="icon" />
            </View>
            {children}
          </View>
        </Glass>
      </View>
    );
  }

  // Minimizada: queda solo la pestaña actual, como una burbuja.
  const width = full
    ? fold.interpolate({ inputRange: [0, 1], outputRange: [full, tabW * 0.78 + PAD * 2] })
    : undefined;
  const shift = fold.interpolate({ inputRange: [0, 1], outputRange: [0, -index * tabW - tabW * 0.11] });
  const labels = fold.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <View
      {...rest}
      pointerEvents="box-none"
      style={[styles.bottomWrap, { bottom: Math.max(insets.bottom - 6, Space.md) }]}
      onLayout={(e) => {
        setWrapW(e.nativeEvent.layout.width);
        setFull(Math.min(e.nativeEvent.layout.width, 460));
      }}>
      <Animated.View
        style={{
          width: width ?? '100%',
          maxWidth: 460,
          alignSelf: 'flex-start',
          // Abierta va centrada; minimizada se pega a la izquierda.
          marginLeft: fold.interpolate({ inputRange: [0, 1], outputRange: [Math.max(0, (wrapW - full) / 2), 0] }),
        }}>
        <Glass radius={Radius.pill} style={{ width: '100%' }}>
          <Animated.View style={[styles.bottomRow, { width: full || '100%', transform: [{ translateX: shift }] }]}>
            {tabW ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.drop,
                  {
                    width: tabW,
                    backgroundColor: C.mode === 'light' ? 'rgba(20,18,23,0.07)' : 'rgba(255,255,255,0.12)',
                    transform: [{ translateX: x }, { scaleX: stretch }, { scaleY: Animated.divide(1, stretch) }],
                  },
                ]}
              />
            ) : null}
            <TabWidth value={tabW}>
              <LabelOpacity value={labels}>{children}</LabelOpacity>
            </TabWidth>
          </Animated.View>
          {collapsed ? (
            // Tocar la burbuja la vuelve a abrir.
            <Touchable
              style={StyleSheet.absoluteFill}
              haptic="select"
              accessibilityLabel="Mostrar pestañas"
              onPress={() => setCollapsed(false)}
            />
          ) : null}
        </Glass>
      </Animated.View>
    </View>
  );
}

const LabelCtx = createContext<Animated.AnimatedInterpolation<number> | number>(1);
function LabelOpacity({ value, children }: { value: Animated.AnimatedInterpolation<number>; children: React.ReactNode }) {
  return <LabelCtx value={value}>{children}</LabelCtx>;
}

function TabButton({
  isFocused,
  narrow,
  icon,
  label,
  ref: _ref,
  children: _children,
  ...props
}: TabTriggerSlotProps & { narrow: boolean; icon: IconName; label: string }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const tabW = useContext(TabWidth);
  const labelOpacity = useContext(LabelCtx);
  const color = isFocused ? C.accentInk : C.text;

  if (!narrow) {
    return (
      <Touchable
        {...props}
        haptic="select"
        pressScale={0.9}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
        style={[styles.railBtn, label === 'Perfil' && { marginTop: 'auto' }]}>
        <View style={[styles.railIcon, isFocused && { backgroundColor: C.accentSoft }]}>
          <Icon name={icon} size={22} color={isFocused ? C.accentInk : C.textMuted} filled={isFocused} strokeWidth={2} />
        </View>
        <T style={[styles.railLabel, { color: isFocused ? C.accentInk : C.textFaint }]} numberOfLines={1}>
          {label}
        </T>
      </Touchable>
    );
  }

  return (
    <Touchable
      {...props}
      haptic="select"
      pressScale={0.88}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={[styles.tab, { width: tabW || undefined, flex: tabW ? undefined : 1 }]}>
      <View>
        <Icon name={icon} size={23} color={color} filled={isFocused} strokeWidth={2} />
      </View>
      <Animated.View style={{ opacity: labelOpacity }}>
        <T numberOfLines={1} style={{ color, fontSize: 10.5, lineHeight: 13, fontWeight: isFocused ? '700' : '600' }}>
          {label}
        </T>
      </Animated.View>
    </Touchable>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    bottomWrap: { position: 'absolute', left: Space.lg, right: Space.lg, alignItems: 'center' },
    bottomRow: { flexDirection: 'row', alignItems: 'center', padding: PAD },
    drop: { position: 'absolute', left: PAD, top: PAD, bottom: PAD, borderRadius: Radius.pill },
    tab: { alignItems: 'center', justifyContent: 'center', gap: 2, height: 54, borderRadius: Radius.pill },
    railWrap: { position: 'absolute', left: Space.lg, width: RAIL_WIDTH },
    rail: { flex: 1 },
    railInner: { flex: 1, alignItems: 'center', paddingVertical: Space.lg, gap: Space.md },
    railBtn: { alignItems: 'center', gap: 3, width: RAIL_WIDTH - 8 },
    railIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    railLabel: { fontSize: 10.5, lineHeight: 13, fontWeight: '600' },
  });
