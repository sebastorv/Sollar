import { StyleSheet, View } from 'react-native';

import { C, Radius, Space } from '@/constants/theme';

import { relief } from './glass';
import { Icon } from './icons';
import { T } from './ui';

/** Aviso del modo demostración (sin token de TMDB). */
export function TokenWarning() {
  return (
    <View style={styles.warning}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <Icon name="sparkle" size={18} color={C.accent} filled />
        <T variant="label">Modo demostración</T>
      </View>
      <T variant="small" muted>
        Estás probando la app con 12 títulos de ejemplo. Al conectar TMDB aparece el catálogo completo, con
        carátulas y dónde ver cada título.
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    ...relief,
    gap: Space.xs,
    padding: Space.lg,
    borderRadius: Radius.lg,
    borderTopColor: C.accentLine,
  },
});
