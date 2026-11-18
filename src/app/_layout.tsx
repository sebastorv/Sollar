import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { Glass } from '@/components/glass';
import { FONT_FILES } from '@/lib/fonts';
import { LoginScreen } from '@/components/login';
import { Icon } from '@/components/icons';
import { AuthProvider, useAuth } from '@/store/auth';
import { LibraryProvider, useLibrary } from '@/store/library';
import { SettingsProvider } from '@/store/settings';
import { SyncProvider } from '@/store/sync';
import { ThemeProvider, useColors } from '@/store/theme';
import { Touchable } from '@/components/touch';

SplashScreen.preventAutoHideAsync();

/** Oculta la pantalla de inicio cuando la biblioteca y la sesión ya cargaron. */
function HideSplashWhenReady({ children }: { children: ReactNode }) {
  const { ready } = useLibrary();
  const auth = useAuth();
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const fonts = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready && auth.ready && fonts) SplashScreen.hideAsync();
  }, [ready, auth.ready, fonts]);
  if (!auth.ready || !fonts) return null;
  // Con servidor configurado, se entra con la cuenta para sincronizar.
  if (auth.cloud && !auth.session) return <LoginScreen />;
  return children;
}

/** Botón redondo de vidrio, separado del borde, como en las apps de iOS 26. */
export function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: 'back' | 'share';
  label: string;
  onPress: () => void;
}) {
  const C = useColors();
  return (
    <Touchable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} pressScale={0.88} haptic="light">
      <Glass radius={999} style={{ width: 44, height: 44 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={22} color={C.text} strokeWidth={2.4} />
        </View>
      </Glass>
    </Touchable>
  );
}

function BackButton() {
  return (
    <View style={{ marginLeft: Platform.OS === 'ios' ? 0 : 14, marginTop: Platform.OS === 'web' ? 6 : 0 }}>
      <RoundButton icon="back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
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
          name="lista/[id]"
          options={{ title: '', headerTransparent: true, headerTintColor: C.text, headerLeft: () => <BackButton /> }}
        />
        <Stack.Screen
          name="persona/[id]"
          options={{ title: '', headerTransparent: true, headerTintColor: C.text, headerLeft: () => <BackButton /> }}
        />
        <Stack.Screen
          name="historial"
          options={{ title: '', headerTransparent: true, headerTintColor: C.text, headerLeft: () => <BackButton /> }}
        />
        <Stack.Screen
          name="estadisticas"
          options={{ title: '', headerTransparent: true, headerTintColor: C.text, headerLeft: () => <BackButton /> }}
        />
        <Stack.Screen
          name="descubrir"
          options={{ title: '', headerTransparent: true, headerTintColor: C.text, headerLeft: () => <BackButton /> }}
        />
        <Stack.Screen
          name="amigos"
          options={{ title: '', headerTransparent: true, headerTintColor: C.text, headerLeft: () => <BackButton /> }}
        />
        <Stack.Screen
          name="importar"
          options={{ title: '', headerTransparent: true, headerTintColor: C.text, headerLeft: () => <BackButton /> }}
        />
        <Stack.Screen
          name="episodio/[id]/[temporada]/[episodio]"
          options={{ title: '', headerTransparent: true, headerTintColor: C.text, headerLeft: () => <BackButton /> }}
        />
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
      <AuthProvider>
        <SettingsProvider>
          <LibraryProvider>
            <SyncProvider>
              <HideSplashWhenReady>
                <Navigation />
              </HideSplashWhenReady>
            </SyncProvider>
          </LibraryProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
