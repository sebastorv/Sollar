import { DarkTheme, DefaultTheme, router, Stack, usePathname, ThemeProvider as NavThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton } from '@/components/glass';
import { Space } from '@/constants/theme';

import { Glass } from '@/components/glass';
import { FONT_FILES } from '@/lib/fonts';
import { FixedInsets } from '@/lib/insets';
import { LanguageProvider } from '@/i18n';
import { useAutoUpdate } from '@/lib/updates';
import { useArtUpgrade } from '@/hooks/use-art-upgrade';
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
const TAB_ROUTES = new Set(['/', '/calendario', '/buscar', '/lista', '/perfil']);

/** Atrás, arriba a la izquierda en todas las pantallas que no son pestañas. */
function FloatingBack() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  if (TAB_ROUTES.has(pathname)) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + Space.sm, left: Space.lg }}>
      <GlassButton icon="back" label="Volver" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  );
}

/** Navegación con los colores del tema elegido. */
function Navigation() {
  const C = useColors();
  useAutoUpdate();
  useArtUpgrade();
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
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: C.bg }, headerShown: false }} />
        {/* Botón atrás flotante: el mismo vidrio que el resto de botones de la app. */}
        <FloatingBack />
      </View>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
      <AuthProvider>
        <SettingsProvider>
          <LibraryProvider>
            <SyncProvider>
              <HideSplashWhenReady>
                <FixedInsets>
                  <Navigation />
                </FixedInsets>
              </HideSplashWhenReady>
            </SyncProvider>
          </LibraryProvider>
        </SettingsProvider>
      </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
