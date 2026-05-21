import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const REPORTS_DIR = `${FileSystem.documentDirectory}reports/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(REPORTS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(REPORTS_DIR, { intermediates: true });
}

export async function downloadAndShare(
  url: string,
  filename: string,
  mimeType?: string
): Promise<string> {
  await ensureDir();
  const dest = REPORTS_DIR + filename;
  const result = await FileSystem.downloadAsync(url, dest);
  if (result.status !== 200) {
    throw new Error(`Descarga falló (HTTP ${result.status})`);
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: mimeType ?? (result.headers as Record<string, string> | undefined)?.['content-type'],
      dialogTitle: filename,
    });
  }
  return result.uri;
}
