/**
 * Pantalla de entrada: crear cuenta o iniciar sesión con correo y contraseña.
 * Con la cuenta, la lista se sincroniza entre el celular, el computador y el navegador.
 */

import { tr } from '@/i18n';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Space, type Colors } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import { useColors, useStyles } from '@/store/theme';

import { SollarLogo } from './brand';
import { Backdrop, card } from './glass';
import { Button, Chip, T } from './ui';

type Mode = 'signup' | 'signin';

export function LoginScreen() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password);
        if (result === 'confirm-email') {
          setNotice('Te enviamos un correo para confirmar la cuenta. Ábrelo y luego entra con "Ya tengo cuenta".');
          setMode('signin');
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Backdrop />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <SollarLogo size={88} shape="icon" />
            <T style={styles.brand}>Sollar</T>
            <T muted style={{ textAlign: 'center' }}>
              Tus series y películas, al día en el celular, el computador y el navegador.
            </T>
          </View>

          <View style={styles.card}>
            <View style={{ flexDirection: 'row', gap: Space.sm }}>
              <Chip label="Crear cuenta" selected={mode === 'signup'} onPress={() => setMode('signup')} />
              <Chip label="Ya tengo cuenta" selected={mode === 'signin'} onPress={() => setMode('signin')} />
            </View>

            <View style={{ gap: Space.xs }}>
              <T variant="label">Correo</T>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={tr("tucorreo@ejemplo.com")}
                placeholderTextColor={C.textFaint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                style={styles.input}
                accessibilityLabel="Correo"
              />
            </View>
            <View style={{ gap: Space.xs }}>
              <T variant="label">Contraseña</T>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={tr(mode === 'signup' ? 'Mínimo 6 caracteres' : 'Tu contraseña')}
                placeholderTextColor={C.textFaint}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                onSubmitEditing={submit}
                style={styles.input}
                accessibilityLabel="Contraseña"
              />
            </View>

            {error ? <T variant="small" style={{ color: C.danger }}>{error}</T> : null}
            {notice ? <T variant="small" style={{ color: C.success }}>{notice}</T> : null}

            <Button
              label={busy ? 'Un momento…' : mode === 'signup' ? 'Crear mi cuenta' : 'Entrar'}
              onPress={submit}
              disabled={!valid || busy}
            />
            <T variant="caption" muted style={{ textAlign: 'center' }}>
              {mode === 'signup'
                ? 'Usa el mismo correo y contraseña en todos tus dispositivos.'
                : 'Lo que ya tengas en este dispositivo se une a tu cuenta.'}
            </T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: Space.lg,
      gap: Space.xl,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    hero: { alignItems: 'center', gap: Space.sm },
    brand: { fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -1.4, color: C.text, marginTop: Space.sm },
    card: { ...card(C), borderRadius: Radius.lg, padding: Space.xl, gap: Space.lg },
    input: {
      backgroundColor: C.fill,
      borderRadius: Radius.md,
      paddingHorizontal: Space.md,
      paddingVertical: Space.md,
      fontSize: 16,
      color: C.text,
    },
  });
