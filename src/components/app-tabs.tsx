/**
 * Navegación principal, igual en iPhone, Android y web: una barra de vidrio que flota.
 * En el celular va abajo, como una píldora; en pantallas anchas, arriba con la marca.
 *
 * Los botones se contraen: los inactivos muestran solo su ícono y el activo se expande con
 * su nombre, para que la barra quede limpia sin perder la referencia de dónde estás.
 * Cada botón conserva su nombre para lectores de pantalla.
 *
 * Los TabTrigger deben ser hijos directos de TabList: el diseño va dentro de BarLayout.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, TabList, TabSlot, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';

import { SollarLogo, Wordmark } from './brand';
import { Glass } from './glass';
import { Icon, type IconName } from './icons';
import { T } from './ui';

const NARROW = 720;

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const narrow = width < NARROW;

  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
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
      <View
        {...rest}
        pointerEvents="box-none"
        style={[styles.bottomWrap, { bottom: Math.max(insets.bottom, Space.md) }]}>
        <Glass radius={Radius.pill} style={styles.bottomBar}>
          <View style={styles.bottomRow}>{children}</View>
        </Glass>
      </View>
    );
  }
  return (
    <View {...rest} pointerEvents="box-none" style={[styles.topWrap, { top: insets.top + Space.md }]}>
      <Glass radius={Radius.pill} style={styles.topBar}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <SollarLogo size={30} />
            <Wordmark size={21} />
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
    // En el teléfono, el cambio de ancho se anima; en web basta con el desvanecido del nombre.
    if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
    Animated.timing(appear, {
      toValue: isFocused ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isFocused, appear]);

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [
        styles.tab,
        narrow && (isFocused ? styles.tabGrow : styles.tabIcon),
        pressed && { opacity: 0.7 },
      ]}>
      {isFocused ? (
        <LinearGradient
          colors={[C.g1, C.g2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.pill }]}
        />
      ) : null}
      {/* Envuelto en View para que en web quede por encima del degradado. */}
      <View>
        <Icon name={icon} size={22} color={isFocused ? C.onAccent : C.textMuted} filled={isFocused} strokeWidth={2} />
      </View>
      {isFocused ? (
        <Animated.View
          style={{
            opacity: appear,
            transform: [{ translateX: appear.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
          }}>
          <T numberOfLines={1} style={{ color: C.onAccent, fontSize: 14, fontWeight: '700' }}>
            {label}
          </T>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    bottomWrap: { position: 'absolute', left: Space.lg, right: Space.lg, alignItems: 'center' },
    bottomBar: { width: '100%', maxWidth: 440 },
    bottomRow: { flexDirection: 'row', alignItems: 'center', padding: Space.xs + 2, gap: Space.xs },
    topWrap: { position: 'absolute', left: Space.lg, right: Space.lg, alignItems: 'center' },
    topBar: { width: '100%', maxWidth: MaxContentWidth },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, padding: Space.sm, paddingLeft: Space.md },
    brand: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginRight: 'auto' },
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
    /** El activo ocupa el espacio que sobra; los demás, solo el de su ícono. */
    tabGrow: { flexGrow: 1 },
    tabIcon: { flexGrow: 0, width: 52, paddingHorizontal: 0 },
  });
