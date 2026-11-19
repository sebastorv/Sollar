import { DarkTheme, DefaultTheme, router, Stack, usePathname, ThemeProvider as NavThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
/**
 * Volver sin botón: deslizando el dedo desde el borde izquierdo hacia la derecha (como en iOS),
 * o con la tecla Esc y el botón "atrás" del mouse en el computador. Mientras se desliza aparece
 * una flecha suave que avisa que al soltar se vuelve.
 */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function EdgeSwipeBack() {
  const pathname = usePathname();
  const C = useColors();
  const insets = useSafeAreaInsets();
  const dx = useRef(new Animated.Value(0)).current;
  const where = useRef(pathname);
  where.current = pathname;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => g.dx > 8 && Math.abs(g.dy) < g.dx,
        onPanResponderMove: (_, g) => dx.setValue(Math.max(0, Math.min(g.dx, 140))),
        onPanResponderRelease: (_, g) => {
          if (g.dx > 80 || g.vx > 0.6) goBack();
          Animated.timing(dx, { toValue: 0, duration: 160, useNativeDriver: false }).start();
        },
        onPanResponderTerminate: () => Animated.timing(dx, { toValue: 0, duration: 160, useNativeDriver: false }).start(),
      }),
    [dx],
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const modal = document.querySelector('[aria-modal="true"]');
      if (e.key === 'Escape' && !modal && !TAB_ROUTES.has(where.current) && !(t && /input|textarea/i.test(t.tagName))) goBack();
    };
    const mouse = (e: MouseEvent) => {
      if (e.button === 3) goBack();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('mouseup', mouse);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('mouseup', mouse);
    };
  }, []);
  if (TAB_ROUTES.has(pathname)) return null;
  return (
    <>
      <View {...pan.panHandlers} style={{ position: 'absolute', left: 0, top: insets.top + 60, bottom: 0, width: 22 }} />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '45%',
          left: 0,
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: C.mode === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(40,38,48,0.9)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          opacity: dx.interpolate({ inputRange: [0, 30, 80], outputRange: [0, 0.6, 1] }),
          transform: [{ translateX: dx.interpolate({ inputRange: [0, 140], outputRange: [-44, 20] }) }],
        }}>
        <Icon name="chevronLeft" size={20} color={C.text} strokeWidth={2.2} />
      </Animated.View>
    </>
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
        {/* Sin botón atrás: se vuelve deslizando desde el borde izquierdo (o con Esc). */}
        <EdgeSwipeBack />
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
