import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Glass } from '@/components/glass';
import { Icon } from '@/components/icons';
import { LibraryProvider, useLibrary } from '@/store/library';
import { SettingsProvider } from '@/store/settings';
import { ThemeProvider, useColors } from '@/store/theme';

SplashScreen.preventAutoHideAsync();

/** Oculta la pantalla de inicio cuando la biblioteca ya cargó del almacenamiento. */
function HideSplashWhenReady({ children }: { children: ReactNode }) {
  const { ready } = useLibrary();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  return children;
}

function BackButton() {
  const C = useColors();
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

/** Navegación con los colores del tema elegido. */
function Navigation() {
  const C = useColors();
  const navTheme = useMemo(() => {
    const base = C.mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: C.bg, card: C.surfaceSolid, text: C.text, border: C.border, primary: C.accent },
    };
  }, [C]);
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={C.mode === 'dark' ? 'light' : 'dark'} />
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
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <LibraryProvider>
          <HideSplashWhenReady>
            <Navigation />
          </HideSplashWhenReady>
        </LibraryProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
