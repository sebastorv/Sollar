/**
 * Pestañas para la versión web: barra superior en pantallas anchas y barra
 * inferior en el celular. Los TabTrigger deben ser hijos directos de TabList,
 * por eso el diseño de la barra va dentro de BarLayout.
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

import { C, MaxContentWidth, Radius, Space } from '@/constants/theme';

import { T } from './ui';

const NARROW = 640;

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const narrow = width < NARROW;

  const list = (
    <TabList asChild>
      <BarLayout narrow={narrow}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton narrow={narrow}>Siguiendo</TabButton>
        </TabTrigger>
        <TabTrigger name="buscar" href="/buscar" asChild>
          <TabButton narrow={narrow}>Buscar</TabButton>
        </TabTrigger>
        <TabTrigger name="lista" href="/lista" asChild>
          <TabButton narrow={narrow}>Mi lista</TabButton>
        </TabTrigger>
        <TabTrigger name="perfil" href="/perfil" asChild>
          <TabButton narrow={narrow}>Perfil</TabButton>
        </TabTrigger>
      </BarLayout>
    </TabList>
  );

  return (
    <Tabs>
      {narrow ? null : list}
      <TabSlot style={{ flex: 1 }} />
      {narrow ? list : null}
    </Tabs>
  );
}

function BarLayout({ narrow, children, ...rest }: TabListProps & { narrow: boolean }) {
  if (narrow) {
    return (
      <View {...rest} style={styles.bottomBar}>
        {children}
      </View>
    );
  }
  return (
    <View {...rest} style={styles.topBar}>
      <View style={styles.topInner}>
        <T variant="heading" style={{ color: C.accent, marginRight: 'auto' }}>
          Butaca
        </T>
        {children}
      </View>
    </View>
  );
}

function TabButton({
  children,
  isFocused,
  narrow,
  ref: _ref,
  ...props
}: TabTriggerSlotProps & { narrow: boolean }) {
  return (
    <Pressable
      {...props}
      style={[narrow ? styles.bottomTab : styles.tab, isFocused && !narrow && styles.tabActive]}>
      <T
        variant="label"
        style={{ color: isFocused ? (narrow ? C.accent : C.onAccent) : C.textMuted, textAlign: 'center' }}>
        {children}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  topInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  tab: { paddingVertical: Space.sm, paddingHorizontal: Space.md, borderRadius: Radius.pill },
  tabActive: { backgroundColor: C.accent },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingBottom: Space.sm,
  },
  bottomTab: { flex: 1, paddingVertical: Space.md, alignItems: 'center' },
});
