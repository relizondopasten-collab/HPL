import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export interface CapturedPhoto {
  uri: string;       // ruta local persistente en documentDirectory
  caption: string | null;
}

interface Props {
  photos: CapturedPhoto[];
  onChange: (photos: CapturedPhoto[]) => void;
}

const PHOTO_DIR = `${FileSystem.documentDirectory}photos/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
}

export function PhotoCapture({ photos, onChange }: Props) {
  const [working, setWorking] = useState(false);

  async function pick(source: 'camera' | 'library') {
    if (working) return;
    setWorking(true);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert('Permiso requerido', 'La cámara está bloqueada.');
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return Alert.alert('Permiso requerido', 'La galería está bloqueada.');
      }

      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7, exif: false })
          : await ImagePicker.launchImageLibraryAsync({
              quality: 0.7,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
            });

      if (res.canceled || res.assets.length === 0) return;

      await ensureDir();
      const next = [...photos];
      for (const asset of res.assets) {
        const ext = asset.uri.split('.').pop() || 'jpg';
        const dest = `${PHOTO_DIR}${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        next.push({ uri: dest, caption: null });
      }
      onChange(next);
    } catch (err) {
      Alert.alert('Error con la foto', err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function remove(idx: number) {
    const photo = photos[idx];
    try {
      await FileSystem.deleteAsync(photo.uri, { idempotent: true });
    } catch {
      /* ignore */
    }
    onChange(photos.filter((_, i) => i !== idx));
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.actions}>
        <Pressable style={styles.btn} disabled={working} onPress={() => pick('camera')}>
          <Text style={styles.btnText}>📷 Cámara</Text>
        </Pressable>
        <Pressable style={styles.btnAlt} disabled={working} onPress={() => pick('library')}>
          <Text style={styles.btnAltText}>🖼️ Galería</Text>
        </Pressable>
      </View>
      {photos.length === 0 ? (
        <Text style={styles.empty}>Sin fotos. Tocá Cámara o Galería para añadir evidencia.</Text>
      ) : (
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
          {photos.map((p, i) => (
            <View key={p.uri} style={styles.thumb}>
              <Image source={{ uri: p.uri }} style={styles.img} />
              <Pressable onPress={() => remove(i)} style={styles.del} hitSlop={8}>
                <Text style={styles.delText}>×</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: '#2e7d32',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAlt: {
    flex: 1,
    borderColor: '#2e7d32',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
  btnAltText: { color: '#2e7d32', fontWeight: '600' },
  empty: { color: '#777', fontSize: 12 },
  thumb: { position: 'relative' },
  img: { width: 80, height: 80, borderRadius: 6, backgroundColor: '#eee' },
  del: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#c62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  delText: { color: '#fff', fontWeight: '700', lineHeight: 18 },
});
