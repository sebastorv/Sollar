import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Glass } from '@/components/glass';
import { Icon } from '@/components/icons';

import { C } from '@/constants/theme';
import { LibraryProvider, useLibrary } from '@/store/library';
import { SettingsProvider } from '@/store/settings';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bg,
    card: C.surfaceSolid,
    text: C.text,
    border: C.border,
    primary: C.accent,
  },
};

/** Oculta la pantalla de inicio cuando la biblioteca ya cargó del almacenamiento. */
function HideSplashWhenReady({ children }: { children: ReactNode }) {
  const { ready } = useLibrary();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  return children;
}

function BackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <Glass radius={999} style={{ paddingVertical: 7, paddingLeft: 8, paddingRight: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Icon name="back" size={20} color={C.text} strokeWidth={2.2} />
          <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>Atrás</Text>
        </View>
      </Glass>
    </Pressable>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <SettingsProvider>
      <LibraryProvider>
        <HideSplashWhenReady>
          <StatusBar style="light" />
          <Stack screenOptions={{ contentStyle: { backgroundColor: C.bg } }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="titulo/[tipo]/[id]"
              options={{
                title: '',
                headerTransparent: true,
                headerTintColor: C.text,
                headerLeft: () => <BackButton />,
              }}
            />
          </Stack>
        </HideSplashWhenReady>
      </LibraryProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
