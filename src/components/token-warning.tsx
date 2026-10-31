import { StyleSheet, View } from 'react-native';

import { C, Radius, Space } from '@/constants/theme';

import { T } from './ui';

/** Aviso que aparece mientras no se haya configurado el token de TMDB. */
export function TokenWarning() {
  return (
    <View style={styles.warning}>
      <T variant="label">Falta conectar TMDB</T>
      <T variant="small" muted>
        Copia el archivo .env.example como .env, pega tu token de lectura de TMDB y reinicia con
        &quot;npx expo start --clear&quot;. Los pasos están en el README.
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    gap: Space.xs,
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.accent,
    backgroundColor: C.accentSoft,
  },
});
