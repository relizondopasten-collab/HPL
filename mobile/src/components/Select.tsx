import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T extends string> {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Elegir…',
  searchable = false,
  disabled = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const current = options.find((o) => o.value === value);
  const filtered = searchable
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q.toLowerCase()) ||
          o.hint?.toLowerCase().includes(q.toLowerCase())
      )
    : options;

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.field, disabled && styles.fieldDisabled]}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Text style={current ? styles.valueText : styles.placeholderText}>
          {current ? current.label : placeholder}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.closeBtn}>Cerrar</Text>
            </Pressable>
          </View>

          {searchable && (
            <TextInput
              style={styles.search}
              placeholder="Buscar…"
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
            />
          )}

          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.option, item.value === value && styles.optionActive]}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                  setQ('');
                }}
              >
                <Text style={styles.optionLabel}>{item.label}</Text>
                {item.hint && <Text style={styles.optionHint}>{item.hint}</Text>}
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Sin resultados.</Text>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#444' },
  field: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldDisabled: { backgroundColor: '#f3f3f3' },
  valueText: { fontSize: 16 },
  placeholderText: { fontSize: 16, color: '#999' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  closeBtn: { color: '#2e7d32', fontSize: 16 },
  search: {
    margin: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  optionActive: { backgroundColor: '#e8f5e9' },
  optionLabel: { fontSize: 16 },
  optionHint: { fontSize: 12, color: '#777', marginTop: 2 },
  empty: { padding: 24, textAlign: 'center', color: '#777' },
});
