import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

interface Props {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  mode?: 'date' | 'datetime' | 'time';
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

function formatLabel(d: Date | null, mode: 'date' | 'datetime' | 'time', placeholder: string): string {
  if (!d) return placeholder;
  if (mode === 'date') {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    });
  }
  if (mode === 'time') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  placeholder = 'Tocar para elegir',
  minimumDate,
  maximumDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tempValue, setTempValue] = useState<Date | null>(null);

  function openPicker() {
    setTempValue(value ?? new Date());
    setOpen(true);
  }

  function handleChange(_e: DateTimePickerEvent, date?: Date) {
    if (!date) return;
    if (Platform.OS === 'android') {
      // Android cierra el modal automáticamente tras elegir
      onChange(date);
      setOpen(false);
    } else {
      // iOS: vamos acumulando el valor hasta que toquen "Listo"
      setTempValue(date);
    }
  }

  function confirm() {
    if (tempValue) onChange(tempValue);
    setOpen(false);
  }

  function clear() {
    setOpen(false);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={value ? styles.value : styles.placeholder}>
          {formatLabel(value, mode, placeholder)}
        </Text>
      </Pressable>

      {/* iOS: modal con sheet inferior */}
      {Platform.OS === 'ios' && (
        <Modal visible={open} animationType="slide" transparent onRequestClose={clear}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Pressable onPress={clear} hitSlop={10}>
                  <Text style={styles.cancel}>Cancelar</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempValue ?? new Date()}
                mode={mode}
                display="inline"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                locale="es-ES"
              />
              <Pressable style={styles.confirmBtn} onPress={confirm}>
                <Text style={styles.confirmText}>Listo</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Android: picker nativo, sin modal propio */}
      {Platform.OS === 'android' && open && (
        <DateTimePicker
          value={tempValue ?? new Date()}
          mode={mode === 'datetime' ? 'date' : mode}
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
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
    backgroundColor: '#fff',
  },
  value: { fontSize: 16 },
  placeholder: { fontSize: 16, color: '#999' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  cancel: { color: '#888', fontSize: 14 },
  confirmBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmText: { color: '#fff', fontWeight: '700' },
});
