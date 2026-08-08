import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function SelectField({
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select an option',
  searchable = false,
  searchPlaceholder = 'Quick search...',
}) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedOptions = options.map((option) =>
    typeof option === 'string' ? { label: option, value: option } : option
  );

  const selected = normalizedOptions.find((option) => option.value === value);

  const filteredOptions = normalizedOptions.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleOpen = () => {
    setSearchQuery('');
    setVisible(true);
  };

  const handleClose = () => {
    setSearchQuery('');
    setVisible(false);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: theme.text }]}>{label}</Text> : null}
      <Pressable
        style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.value, { color: selected ? theme.text : theme.muted }]} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down-outline" size={18} color={theme.muted} />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={[styles.overlay, { backgroundColor: theme.overlay }]} onPress={handleClose}>
          <Pressable
            style={[styles.menu, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.menuHeader}>
              <Text style={[styles.menuTitle, { color: theme.text }]}>{label || 'Select an option'}</Text>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.muted} />
              </Pressable>
            </View>

            {searchable && (
              <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="search-outline" size={18} color={theme.muted} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={theme.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={theme.muted} />
                  </Pressable>
                )}
              </View>
            )}

            <ScrollView contentContainerStyle={styles.optionsList} keyboardShouldPersistTaps="handled">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <Pressable
                      key={String(option.value)}
                      style={[
                        styles.option,
                        { borderColor: theme.border },
                        isSelected && { backgroundColor: `${theme.primary}18`, borderColor: theme.primary },
                      ]}
                      onPress={() => {
                        onChange(option.value);
                        handleClose();
                      }}
                    >
                      <Text style={[styles.optionText, { color: isSelected ? theme.primary : theme.text }]}>
                        {option.label}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, { color: theme.muted }]}>No matching options found</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  field: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: { flex: 1, fontSize: 14, fontWeight: '600', marginRight: 10 },
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  menu: { maxHeight: '80%', borderRadius: 20, borderWidth: 1, padding: 16 },
  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  menuTitle: { fontSize: 17, fontWeight: '800' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  optionsList: { gap: 8 },
  option: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: { fontSize: 14, fontWeight: '600' },
  emptyState: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '500' },
});
