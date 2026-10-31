import { StyleSheet, View } from 'react-native';

import { C, Radius, Space } from '@/constants/theme';

import { T } from './ui';

/** Aviso del modo demostración (sin token de TMDB). */
export function TokenWarning() {
  return (
    <View style={styles.warning}>
      <T variant="label">Modo demostración</T>
      <T variant="small" muted>
        Estás probando la app con 12 títulos de ejemplo. Al conectar TMDB aparece el catálogo completo, con
        carátulas y dónde ver cada título.
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
