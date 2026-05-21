import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { pendingCount, processQueue, subscribe } from '@/lib/outbox';

export function SyncBanner() {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function refresh() {
    setCount(await pendingCount());
  }

  async function sync() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await processQueue();
      if (r.failed > 0) {
        setLastResult(`${r.ok} subidos, ${r.failed} pendientes`);
      } else if (r.ok > 0) {
        setLastResult(`${r.ok} subidos`);
        setTimeout(() => setLastResult(null), 3000);
      }
    } finally {
      setBusy(false);
      refresh();
    }
  }

  useEffect(() => {
    refresh();
    const unsub = subscribe(refresh);
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void processQueue().finally(refresh);
      }
    });
    void processQueue().finally(refresh);
    return () => {
      unsub();
      appSub.remove();
    };
  }, []);

  if (count === 0 && !lastResult) return null;

  return (
    <View style={styles.banner}>
      {busy ? <ActivityIndicator color="#fff" /> : null}
      <Text style={styles.text}>
        {count > 0
          ? `${count} ${count === 1 ? 'cambio pendiente' : 'cambios pendientes'} de sincronizar`
          : lastResult}
      </Text>
      {count > 0 && (
        <Pressable onPress={sync} disabled={busy} hitSlop={10}>
          <Text style={styles.action}>{busy ? '…' : 'Sincronizar'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1565c0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: { color: '#fff', flex: 1, fontSize: 13 },
  action: { color: '#fff', fontWeight: '700' },
});
