/** Pestaña "Perfil": plataformas, apariencia, estadísticas, respaldo de datos y créditos. */

import { useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import { SollarLogo } from '@/components/brand';
import { Glass, card } from '@/components/glass';
import { PlatformPicker } from '@/components/platforms';
import { Button, Chip, Screen, Section, T } from '@/components/ui';
import { ACCENT_ORDER, ACCENTS, Radius, Space, type Colors } from '@/constants/theme';
import { useColors, useStyles, useThemeSettings, type ModeSetting } from '@/store/theme';
import { parseBackup } from '@/lib/library-item';
import { computeStats, formatDuration } from '@/lib/progress';
import { useAuth } from '@/store/auth';
import { useLibrary } from '@/store/library';
import { useSync } from '@/store/sync';

export default function ProfileScreen() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { items, exportBackup, importBackup } = useLibrary();
  const stats = useMemo(() => computeStats(items), [items]);
  const [importOpen, setImportOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);

  async function onExport() {
    const json = JSON.stringify(exportBackup(), null, 2);
    const name = `sollar-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    if (Platform.OS === 'web') {
      // En web se muestra el texto con botones de copiar y descargar: algunos
      // navegadores (o la vista previa) bloquean las descargas.
      setExportText(json);
    } else {
      await Share.share({ title: name, message: json });
    }
  }

  return (
    <Screen>
      <T variant="title">Perfil</T>

      <Account />

      <Section title="Mis plataformas">
        <T variant="small" muted>
          Marca los servicios que pagas. Con eso, en cada título y en tus listas verás al instante si está
          incluido en tu plan.
        </T>
        <PlatformPicker />
      </Section>

      <Appearance />

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
          dejas Sollar, te llevas todo.
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

      <ExportModal text={exportText} onClose={() => setExportText(null)} onDone={setMessage} />

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

/** Cuenta y estado de la sincronización. Solo aparece si la app usa servidor. */
function Account() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { cloud, email, signOut } = useAuth();
  const { status, lastSync, error, syncNow } = useSync();
  if (!cloud || !email) return null;
  const time = lastSync ? new Date(lastSync).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : null;
  const label =
    status === 'syncing'
      ? 'Sincronizando…'
      : status === 'offline'
        ? 'Sin conexión: se sincroniza al volver'
        : time
          ? `Sincronizado a las ${time}`
          : 'Sincronización activa';
  return (
    <Section title="Tu cuenta">
      <View style={styles.account}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="label" numberOfLines={1}>
            {email}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.xs }}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: status === 'offline' ? C.danger : status === 'syncing' ? C.accent : C.success },
              ]}
            />
            <T variant="caption" muted>
              {label}
            </T>
          </View>
          {status === 'offline' && error ? (
            <T variant="caption" muted numberOfLines={2}>
              {error}
            </T>
          ) : null}
        </View>
        <Button label="Sincronizar" kind="secondary" onPress={syncNow} />
      </View>
      <T variant="small" muted>
        Tu lista, tus episodios vistos, tus calificaciones y tus plataformas se guardan en tu cuenta y
        se actualizan solos en todos los dispositivos donde entres con este correo.
      </T>
      <View style={{ flexDirection: 'row' }}>
        <Button label="Cerrar sesión" kind="danger" onPress={() => signOut()} />
      </View>
    </Section>
  );
}

const MODES: { key: ModeSetting; label: string }[] = [
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Oscuro' },
  { key: 'system', label: 'Como el teléfono' },
];

/** Modo claro u oscuro y color de la marca. Se aplica al instante en toda la app. */
function Appearance() {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const { mode, setMode, accent, setAccent } = useThemeSettings();
  return (
    <Section title="Apariencia">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
        {MODES.map((m) => (
          <Chip key={m.key} label={m.label} selected={mode === m.key} onPress={() => setMode(m.key)} />
        ))}
      </View>
      <View style={styles.accents}>
        {ACCENT_ORDER.map((key) => {
          const a = ACCENTS[key];
          const on = accent === key;
          return (
            <Pressable
              key={key}
              onPress={() => setAccent(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Color ${a.label}`}
              style={({ pressed }) => [styles.accent, on && { borderColor: a.solid }, pressed && { opacity: 0.8 }]}>
              <LinearGradient colors={[a.g1, a.g2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatch} />
              <T variant="label" style={{ color: on ? C.text : C.textMuted }}>
                {a.label}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.preview}>
        <SollarLogo size={44} shape="icon" />
        <T variant="small" muted style={{ flex: 1 }}>
          Así se ve el ícono con este color. El modo claro y Brasa vienen por defecto.
        </T>
      </View>
    </Section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <T variant="heading" style={{ color: C.accentInk }}>
        {value}
      </T>
      <T variant="caption" muted>
        {label}
      </T>
    </View>
  );
}

function ExportModal({
  text,
  onClose,
  onDone,
}: {
  text: string | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const C = useColors();
  const styles = useStyles(makeStyles);
  const [note, setNote] = useState<string | null>(null);
  const inFrame = typeof window !== 'undefined' && window.self !== window.top;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text ?? '');
      setNote('Copiado. Pégalo en una nota o un archivo para guardarlo.');
    } catch {
      setNote('No se pudo copiar automáticamente: selecciona el texto y cópialo.');
    }
  }

  function download() {
    try {
      const url = URL.createObjectURL(new Blob([text ?? ''], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `sollar-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onDone('Respaldo descargado.');
    } catch {
      setNote('Este navegador no permitió la descarga: usa Copiar.');
    }
  }

  return (
    <Modal visible={text != null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Glass strong radius={Radius.lg} style={styles.sheet}>
          <T variant="heading">Tu respaldo</T>
          <T variant="small" muted>
            Este texto contiene toda tu lista. Guárdalo para importarlo después.
          </T>
          <TextInput value={text ?? ''} multiline editable={false} style={styles.textarea} />
          {note ? <T variant="small" style={{ color: C.success }}>{note}</T> : null}
          <View style={{ gap: Space.sm }}>
            <Button label="Copiar" onPress={copy} />
            {/* Dentro de un marco (como la vista previa) las descargas suelen estar bloqueadas. */}
            {inFrame ? null : <Button label="Descargar archivo" kind="secondary" onPress={download} />}
            <Button label="Cerrar" kind="secondary" onPress={() => { setNote(null); onClose(); }} />
          </View>
        </Glass>
      </View>
    </Modal>
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
  const C = useColors();
  const styles = useStyles(makeStyles);
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
        <Glass strong radius={Radius.lg} style={styles.sheet}>
          <T variant="heading">Importar respaldo</T>
          <T variant="small" muted>
            Pega aquí el contenido del archivo que exportaste.
          </T>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder='{"app": "sollar", ...}'
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
        </Glass>
      </View>
    </Modal>
  );
}

const makeStyles = (C: Colors) =>
  StyleSheet.create({
  account: {
    ...card(C),
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radius.lg,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  accents: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  accent: {
    ...card(C),
    flexGrow: 1,
    flexBasis: 100,
    alignItems: 'center',
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radius.lg,
    borderWidth: 2,
  },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md },
  stat: {
    ...card(C),
    flexGrow: 1,
    flexBasis: 140,
    padding: Space.lg,
    gap: Space.xs,
    borderRadius: Radius.lg,
  },
  genreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Space.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backdrop: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end' },
  sheet: {
    padding: Space.xl,
    gap: Space.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  textarea: {
    minHeight: 160,
    maxHeight: 280,
    backgroundColor: C.fill,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    padding: Space.md,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    textAlignVertical: 'top',
  },
});
