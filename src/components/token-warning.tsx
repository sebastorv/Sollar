import { StyleSheet, View } from 'react-native';

import { Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles } from '@/store/theme';

import { card } from './glass';
import { Icon } from './icons';
import { T } from './ui';

/** Aviso del modo demostración (sin token de TMDB). */
export function TokenWarning() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.warning}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
        <Icon name="sparkle" size={18} color={C.accentInk} filled />
        <T variant="label">Modo demostración</T>
      </View>
      <T variant="small" muted>
        Estás probando la app con 12 títulos de ejemplo. Al conectar TMDB aparece el catálogo completo, con
        carátulas y dónde ver cada título.
      </T>
    </View>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
  warning: {
    ...card(C),
    gap: Space.xs,
    padding: Space.lg,
    borderRadius: Radius.lg,
  },
});
