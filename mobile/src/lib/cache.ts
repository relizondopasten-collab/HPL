import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'cache:';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24 h

interface Entry<T> {
  v: T;
  t: number; // timestamp ms
}

async function readEntry<T>(key: string): Promise<Entry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as Entry<T>;
  } catch {
    return null;
  }
}

async function writeEntry<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(
    PREFIX + key,
    JSON.stringify({ v: value, t: Date.now() } satisfies Entry<T>)
  );
}

/**
 * Network-first con fallback a cache. Si el fetcher tira (sin red o servidor caído),
 * sirve el último valor cacheado. Si no hay cache, propaga el error.
 */
export async function cacheRead<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<{ value: T; fromCache: boolean; stale: boolean }> {
  try {
    const fresh = await fetcher();
    await writeEntry(key, fresh);
    return { value: fresh, fromCache: false, stale: false };
  } catch (err) {
    const cached = await readEntry<T>(key);
    if (cached) {
      return {
        value: cached.v,
        fromCache: true,
        stale: Date.now() - cached.t > ttlMs,
      };
    }
    throw err;
  }
}

export async function clearCache(prefix?: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter(
    (k) => k.startsWith(PREFIX) && (!prefix || k.startsWith(PREFIX + prefix))
  );
  if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
}
