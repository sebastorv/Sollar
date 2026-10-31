import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';

import { C } from '@/constants/theme';
import { LibraryProvider, useLibrary } from '@/store/library';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bg,
    card: C.surface,
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

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
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
                headerBackTitle: 'Atrás',
              }}
            />
          </Stack>
        </HideSplashWhenReady>
      </LibraryProvider>
    </ThemeProvider>
  );
}
