/**
 * Navegación principal, igual en iPhone, Android y web. Siempre visible y solo con íconos.
 *
 * - Celular: abajo, una píldora de vidrio con Siguiendo, Calendario, Mi lista y Perfil, y aparte
 *   una burbuja de vidrio con la lupa, como en iOS 26.
 * - Computador: el logo suelto arriba a la izquierda y, centrada a la izquierda, una píldora
 *   vertical con los íconos, más la burbuja de búsqueda encima.
 *
 * Al cambiar de pestaña, una gota de vidrio se desliza y se estira hasta la nueva.
 */

import { usePathname } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Children, isValidElement, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Space, WIDE, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';

import { SollarLogo } from './brand';
import { Glass } from './glass';
import { Icon, type IconName } from './icons';
import { TabScrollProvider, useTabScroll } from './tab-scroll';
import { Touchable } from './touch';
import { RailContext } from './ui';

/** Las pestañas de la píldora, en orden. Buscar va aparte. */
const PILL = ['/', '/calendario', '/lista', '/perfil'];
const SLOT = 46;
const PAD = 6;
const native = Platform.OS !== 'web';

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
            <TabButton icon="play" label="Siguiendo" />
          </TabTrigger>
          <TabTrigger name="calendario" href="/calendario" asChild>
            <TabButton icon="calendar" label="Calendario" />
          </TabTrigger>
          <TabTrigger name="buscar" href="/buscar" asChild>
            <TabButton icon="search" label="Buscar" round />
          </TabTrigger>
          <TabTrigger name="lista" href="/lista" asChild>
            <TabButton icon="ticket" label="Mi lista" />
          </TabTrigger>
          <TabTrigger name="perfil" href="/perfil" asChild>
            <TabButton icon="person" label="Perfil" />
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
  const vertical0 = !narrow;
  const index = PILL.findIndex((r) => (r === '/' ? pathname === '/' : pathname.startsWith(r)));

  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ name: string; children: ReactNode }>[];
  const search = items.find((c) => c.props.name === 'buscar');
  const pill = items.filter((c) => c.props.name !== 'buscar');

  // La gota: se desliza con resorte y se estira mientras viaja.
  const pos = useRef(new Animated.Value(Math.max(index, 0) * SLOT)).current;
  const stretch = useRef(new Animated.Value(1)).current;
  const show = useRef(new Animated.Value(index >= 0 ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(show, { toValue: index >= 0 ? 1 : 0, duration: 160, useNativeDriver: native }).start();
    if (index < 0) return;
    Animated.parallel([
      Animated.spring(pos, { toValue: index * SLOT, useNativeDriver: native, speed: 14, bounciness: 8 }),
      Animated.sequence([
        Animated.timing(stretch, { toValue: 1.38, duration: 110, useNativeDriver: native }),
        Animated.spring(stretch, { toValue: 1, useNativeDriver: native, speed: 9, bounciness: 16 }),
      ]),
    ]).start();
  }, [index, pos, stretch, show]);

  const { collapsed, setCollapsed } = useTabScroll();
  const fold = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(fold, { toValue: collapsed && !vertical0 ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 5 }).start();
  }, [collapsed, fold, vertical0]);
  // Al cambiar de pestaña se abre otra vez.
  useEffect(() => setCollapsed(false), [pathname, setCollapsed]);

  const dropColor = C.mode === 'light' ? 'rgba(20,18,23,0.08)' : 'rgba(255,255,255,0.14)';
  const vertical = !narrow;
  const drop = (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.drop,
        { backgroundColor: dropColor, opacity: show },
        vertical
          ? { transform: [{ translateY: pos }, { scaleY: stretch }, { scaleX: Animated.divide(1, stretch) }] }
          : { transform: [{ translateX: pos }, { scaleX: stretch }, { scaleY: Animated.divide(1, stretch) }] },
      ]}
    />
  );

  if (vertical) {
    return (
      <View
        {...rest}
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, bottom: 0, left: Space.xl, width: SLOT + PAD * 2, alignItems: 'center' }}>
        {/* Logo suelto, sin caja. */}
        <View style={{ position: 'absolute', top: insets.top + Space.xl, left: PAD }}>
          <SollarLogo size={44} shape="icon" />
        </View>
        <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: Space.md }}>
          <Glass radius={999} style={styles.circle}>
            {search}
          </Glass>
          <Glass radius={999}>
            <View style={{ padding: PAD }}>
              {drop}
              {pill}
            </View>
          </Glass>
        </View>
      </View>
    );
  }

  // Celular: al bajar, la píldora se encoge hasta dejar solo la pestaña actual (como iOS 26);
  // al subir o al tocarla, vuelve a abrirse. La lupa siempre queda aparte, a la derecha.
  const full = PILL.length * SLOT + PAD * 2;
  const small = SLOT + PAD * 2;
  const at = Math.max(index, 0);
  const width = fold.interpolate({ inputRange: [0, 1], outputRange: [full, small] });
  const shift = fold.interpolate({ inputRange: [0, 1], outputRange: [0, -at * SLOT] });
  return (
    <View
      {...rest}
      pointerEvents="box-none"
      style={[styles.bottomWrap, { bottom: Math.max(insets.bottom - 6, Space.md) }]}>
      <View pointerEvents="box-none" style={{ width: full + Space.sm + small, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Animated.View style={{ width, borderRadius: 999 }}>
          <Glass radius={999} style={{ width: '100%' }}>
            <Animated.View style={{ flexDirection: 'row', padding: PAD, width: full, transform: [{ translateX: shift }] }}>
              {drop}
              {pill}
            </Animated.View>
            {collapsed ? (
              <Touchable
                style={StyleSheet.absoluteFill}
                haptic="select"
                accessibilityLabel="Mostrar todas las pestañas"
                onPress={() => setCollapsed(false)}
              />
            ) : null}
          </Glass>
        </Animated.View>
        <Glass radius={999} style={styles.circle}>
          {search}
        </Glass>
      </View>
    </View>
  );
}

function TabButton({
  isFocused,
  icon,
  label,
  round,
  ref: _ref,
  children: _children,
  ...props
}: TabTriggerSlotProps & { icon: IconName; label: string; round?: boolean }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Touchable
      {...props}
      haptic="select"
      pressScale={0.86}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={[round ? styles.roundBtn : styles.slot, round && isFocused && { backgroundColor: C.accentSoft }]}>
      <View>
        <Icon name={icon} size={22} color={isFocused ? C.accentInk : C.text} filled={isFocused && icon !== 'search'} strokeWidth={2} />
      </View>
    </Touchable>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    bottomWrap: {
      position: 'absolute',
      left: Space.lg,
      right: Space.lg,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: Space.md,
    },
    slot: { width: SLOT, height: SLOT, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
    drop: { position: 'absolute', left: PAD, top: PAD, width: SLOT, height: SLOT, borderRadius: Radius.pill },
    circle: { width: SLOT + PAD * 2, height: SLOT + PAD * 2 },
    roundBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  });
