/**
 * Navegación principal, igual en iPhone, Android y web: una barra de vidrio que flota.
 * En el celular va abajo, como una píldora; en pantallas anchas, arriba con la marca.
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
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, MaxContentWidth, Radius, Space } from '@/constants/theme';

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
            <TabButton narrow={narrow} icon="seat">
              Siguiendo
            </TabButton>
          </TabTrigger>
          <TabTrigger name="buscar" href="/buscar" asChild>
            <TabButton narrow={narrow} icon="search">
              Buscar
            </TabButton>
          </TabTrigger>
          <TabTrigger name="lista" href="/lista" asChild>
            <TabButton narrow={narrow} icon="ticket">
              Mi lista
            </TabButton>
          </TabTrigger>
          <TabTrigger name="perfil" href="/perfil" asChild>
            <TabButton narrow={narrow} icon="person">
              Perfil
            </TabButton>
          </TabTrigger>
        </BarLayout>
      </TabList>
    </Tabs>
  );
}

function BarLayout({ narrow, children, ...rest }: TabListProps & { narrow: boolean }) {
  const insets = useSafeAreaInsets();
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
    <View {...rest} pointerEvents="box-none" style={[styles.topWrap, { top: insets.top + Space.md }]}>
      <Glass radius={Radius.pill} style={styles.topBar}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Icon name="seat" size={22} color={C.accent} filled />
            <T variant="heading" style={{ color: C.accent }}>
              Butaca
            </T>
          </View>
          {children}
        </View>
      </Glass>
    </View>
  );
}

function TabButton({
  children,
  isFocused,
  narrow,
  icon,
  ref: _ref,
  ...props
}: TabTriggerSlotProps & { narrow: boolean; icon: IconName }) {
  const color = isFocused ? C.accent : C.textMuted;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [
        narrow ? styles.bottomTab : styles.topTab,
        isFocused && (narrow ? styles.bottomTabOn : styles.topTabOn),
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size={narrow ? 24 : 18} color={color} filled={isFocused} />
      <T
        style={{
          color: isFocused ? C.text : C.textMuted,
          fontSize: narrow ? 11 : 14,
          fontWeight: isFocused ? '700' : '600',
        }}>
        {children}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bottomWrap: { position: 'absolute', left: Space.lg, right: Space.lg, alignItems: 'center' },
  bottomBar: { width: '100%', maxWidth: 440 },
  bottomRow: { flexDirection: 'row', padding: Space.xs + 2 },
  bottomTab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Space.sm, borderRadius: Radius.pill },
  bottomTabOn: { backgroundColor: 'rgba(233, 201, 135, 0.12)' },
  topWrap: { position: 'absolute', left: Space.lg, right: Space.lg, alignItems: 'center' },
  topBar: { width: '100%', maxWidth: MaxContentWidth },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, padding: Space.sm, paddingLeft: Space.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginRight: 'auto' },
  topTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.pill,
  },
  topTabOn: { backgroundColor: 'rgba(233, 201, 135, 0.14)' },
});
