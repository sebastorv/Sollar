/** Pestaña "Perfil": estadísticas, respaldo de datos y créditos. */

import { useMemo, useState } from 'react';
import { Modal, Platform, Share, StyleSheet, TextInput, View } from 'react-native';

import { Button, Screen, Section, T } from '@/components/ui';
import { C, Radius, Space } from '@/constants/theme';
import { parseBackup } from '@/lib/library-item';
import { computeStats, formatDuration } from '@/lib/progress';
import { useLibrary } from '@/store/library';

export default function ProfileScreen() {
  const { items, exportBackup, importBackup } = useLibrary();
  const stats = useMemo(() => computeStats(items), [items]);
  const [importOpen, setImportOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onExport() {
    const json = JSON.stringify(exportBackup(), null, 2);
    const name = `butaca-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Respaldo descargado.');
    } else {
      await Share.share({ title: name, message: json });
    }
  }

  return (
    <Screen>
      <T variant="title">Perfil</T>

      <Section title="Tus números">
        <View style={styles.statsGrid}>
          <Stat value={String(stats.moviesWatched)} label="películas vistas" />
          <Stat value={String(stats.episodesWatched)} label="episodios vistos" />
          <Stat value={String(stats.showsCompleted)} label="series terminadas" />
          <Stat value={formatDuration(stats.minutesWatched)} label="frente a la pantalla" />
          <Stat value={stats.averageRating != null ? `${stats.averageRating}` : '—'} label="calificación media" />
          <Stat value={String(items.length)} label="títulos en tu lista" />
        </View>
      </Section>

      {stats.topGenres.length > 0 ? (
        <Section title="Tus géneros">
          <View style={{ gap: Space.sm }}>
            {stats.topGenres.map((g) => (
              <View key={g.name} style={styles.genreRow}>
                <T>{g.name}</T>
                <T muted>{g.count}</T>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="Tus datos son tuyos">
        <T variant="small" muted>
          Exporta tu lista cuando quieras como un archivo JSON. Si cambias de teléfono, o si algún día
          dejas Butaca, te llevas todo.
        </T>
        <View style={{ flexDirection: 'row', gap: Space.sm, flexWrap: 'wrap' }}>
          <Button label="Exportar respaldo" onPress={onExport} />
          <Button label="Importar respaldo" kind="secondary" onPress={() => setImportOpen(true)} />
        </View>
        {message ? <T variant="small" style={{ color: C.success }}>{message}</T> : null}
      </Section>

      <Section title="Créditos">
        <T variant="small" muted>
          Esta app usa la API de TMDB, pero no está respaldada ni certificada por TMDB. Los datos de dónde
          ver cada título los aporta JustWatch.
        </T>
        {/* Frase exigida por TMDB, en su idioma original. */}
        <T variant="caption" muted>
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </T>
      </Section>

      <ImportModal
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(text, mode) => {
          const backup = parseBackup(text);
          importBackup(backup, mode);
          setMessage(`Se importaron ${backup.items.length} títulos.`);
          setImportOpen(false);
        }}
      />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <T variant="heading" style={{ color: C.accent }}>
        {value}
      </T>
      <T variant="caption" muted>
        {label}
      </T>
    </View>
  );
}

function ImportModal({
  visible,
  onClose,
  onImport,
}: {
  visible: boolean;
  onClose: () => void;
  onImport: (text: string, mode: 'merge' | 'replace') => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  function run(mode: 'merge' | 'replace') {
    try {
      onImport(text, mode);
      setText('');
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <T variant="heading">Importar respaldo</T>
          <T variant="small" muted>
            Pega aquí el contenido del archivo que exportaste.
          </T>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder='{"app": "butaca", ...}'
            placeholderTextColor={C.textFaint}
            style={styles.textarea}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {error ? <T variant="small" style={{ color: C.danger }}>{error}</T> : null}
          <View style={{ gap: Space.sm }}>
            <Button label="Combinar con mi lista" onPress={() => run('merge')} disabled={!text} />
            <Button label="Reemplazar toda mi lista" kind="danger" onPress={() => run('replace')} disabled={!text} />
            <Button label="Cancelar" kind="secondary" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md },
  stat: {
    flexGrow: 1,
    flexBasis: 140,
    padding: Space.lg,
    gap: Space.xs,
    backgroundColor: C.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  genreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Space.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface,
    padding: Space.xl,
    gap: Space.md,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  textarea: {
    minHeight: 160,
    maxHeight: 280,
    backgroundColor: C.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    padding: Space.md,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    textAlignVertical: 'top',
  },
});
