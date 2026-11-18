/**
 * Navegación principal, igual en iPhone, Android y web.
 *
 * - Celular: una píldora de vidrio flotando abajo. Los botones muestran solo su ícono y el activo
 *   se expande con su nombre.
 * - Pantallas anchas (computador, tablet): una barra lateral mínima a la izquierda, con el logo
 *   arriba, las secciones al centro y Perfil abajo. Deja todo el ancho para el contenido.
 *
 * Los TabTrigger deben ser hijos directos de TabList: el diseño va dentro de BarLayout.
 */

import {
  Tabs,
  TabList,
  TabSlot,
  TabTrigger,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { useEffect, useRef } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Space, WIDE, RAIL_WIDTH, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';

import { SollarLogo } from './brand';
import { Glass } from './glass';
import { Icon, type IconName } from './icons';
import { Touchable } from './touch';
import { RailContext, T } from './ui';

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const narrow = width < WIDE;

  return (
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
  );
}

function BarLayout({ narrow, children, ...rest }: TabListProps & { narrow: boolean }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  if (narrow) {
    return (
      <View {...rest} pointerEvents="box-none" style={[styles.bottomWrap, { bottom: Math.max(insets.bottom, Space.md) }]}>
        <Glass radius={Radius.pill} style={styles.bottomBar}>
          <View style={styles.bottomRow}>{children}</View>
        </Glass>
      </View>
    );
  }
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
  const appear = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    if (narrow && Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    Animated.timing(appear, {
      toValue: isFocused ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isFocused, appear, narrow]);

  if (!narrow) {
    // Barra lateral: ícono con su nombre pequeño debajo; Perfil se va al fondo.
    return (
      <Touchable
        {...props}
        haptic="select"
        pressScale={0.9}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
        style={[styles.railBtn, label === 'Perfil' && { marginTop: 'auto' }]}>
        <View style={[styles.railIcon, isFocused && { backgroundColor: C.ink }]}>
          <Icon name={icon} size={22} color={isFocused ? C.onInk : C.textMuted} filled={isFocused} strokeWidth={2} />
        </View>
        <T style={[styles.railLabel, { color: isFocused ? C.text : C.textFaint }]} numberOfLines={1}>
          {label}
        </T>
      </Touchable>
    );
  }

  return (
    <Touchable
      {...props}
      haptic="select"
      pressScale={0.92}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={[styles.tab, isFocused ? styles.tabGrow : styles.tabIcon, isFocused && { backgroundColor: C.ink }]}>
      <View>
        <Icon name={icon} size={22} color={isFocused ? C.onInk : C.textMuted} filled={isFocused} strokeWidth={2} />
      </View>
      {isFocused ? (
        <Animated.View
          style={{
            opacity: appear,
            transform: [{ translateX: appear.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
          }}>
          <T numberOfLines={1} style={{ color: C.onInk, fontSize: 14, fontWeight: '700' }}>
            {label}
          </T>
        </Animated.View>
      ) : null}
    </Touchable>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    bottomWrap: { position: 'absolute', left: Space.lg, right: Space.lg, alignItems: 'center' },
    bottomBar: { width: '100%', maxWidth: 440 },
    bottomRow: { flexDirection: 'row', alignItems: 'center', padding: Space.xs + 2, gap: Space.xs },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Space.sm,
      height: 48,
      paddingHorizontal: Space.md + 2,
      borderRadius: Radius.pill,
      overflow: 'hidden',
    },
    tabGrow: { flexGrow: 1 },
    tabIcon: { flexGrow: 0, width: 52, paddingHorizontal: 0 },
    railWrap: { position: 'absolute', left: Space.lg, width: RAIL_WIDTH },
    rail: { flex: 1 },
    railInner: { flex: 1, alignItems: 'center', paddingVertical: Space.lg, gap: Space.md },
    railBtn: { alignItems: 'center', gap: 3, width: RAIL_WIDTH - 8 },
    railIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    railLabel: { fontSize: 10.5, lineHeight: 13, fontWeight: '600' },
  });
