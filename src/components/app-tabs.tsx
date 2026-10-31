/** Pestañas nativas (iOS y Android). La versión web está en app-tabs.web.tsx. */

import { NativeTabs } from 'expo-router/native-tabs';

import { C } from '@/constants/theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={C.surface}
      indicatorColor={C.accentSoft}
      tintColor={C.accent}
      labelStyle={{ selected: { color: C.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Siguiendo</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="play.tv" md="live_tv" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="buscar">
        <NativeTabs.Trigger.Label>Buscar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="lista">
        <NativeTabs.Trigger.Label>Mi lista</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="rectangle.stack" md="video_library" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
