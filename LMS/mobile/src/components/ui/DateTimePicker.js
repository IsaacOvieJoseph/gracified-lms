import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function DateTimePicker({
  label,
  value,
  onChange,
  mode = 'date', // 'date' | 'datetime' | 'time'
  placeholder = 'Select date & time',
}) {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  // Current selected date object
  const initialDate = value ? new Date(value) : new Date();
  const validDate = isNaN(initialDate.getTime()) ? new Date() : initialDate;

  const [viewYear, setViewYear] = useState(validDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(validDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(validDate);

  // Time state
  const [hours, setHours] = useState(validDate.getHours());
  const [minutes, setMinutes] = useState(validDate.getMinutes());

  const handleOpen = () => {
    const d = value ? new Date(value) : new Date();
    const current = isNaN(d.getTime()) ? new Date() : d;
    setViewYear(current.getFullYear());
    setViewMonth(current.getMonth());
    setSelectedDate(current);
    setHours(current.getHours());
    setMinutes(current.getMinutes());
    setModalVisible(true);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (dayNumber) => {
    const newDate = new Date(viewYear, viewMonth, dayNumber, hours, minutes);
    setSelectedDate(newDate);
  };

  const handleQuickPreset = (daysToAdd) => {
    const preset = new Date();
    preset.setDate(preset.getDate() + daysToAdd);
    setViewYear(preset.getFullYear());
    setViewMonth(preset.getMonth());
    setSelectedDate(preset);
  };

  const handleConfirm = () => {
    const finalDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hours,
      minutes
    );

    if (mode === 'date') {
      // YYYY-MM-DD
      const yyyy = finalDate.getFullYear();
      const mm = String(finalDate.getMonth() + 1).padStart(2, '0');
      const dd = String(finalDate.getDate()).padStart(2, '0');
      onChange(`${yyyy}-${mm}-${dd}`);
    } else if (mode === 'time') {
      // HH:mm
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      onChange(`${hh}:${mm}`);
    } else {
      // ISO String
      onChange(finalDate.toISOString());
    }

    setModalVisible(false);
  };

  // Generate days in month
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Display text
  const formatDisplayValue = () => {
    if (!value) return placeholder;
    if (mode === 'date') {
      const d = new Date(value);
      if (isNaN(d.getTime())) return value;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    if (mode === 'time') return value;
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { color: theme.muted }]}>{label}</Text> : null}

      <Pressable
        style={[styles.pickerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={handleOpen}
      >
        <Ionicons
          name={mode === 'time' ? 'time-outline' : 'calendar-outline'}
          size={18}
          color={theme.primary}
        />
        <Text style={[styles.pickerText, { color: value ? theme.text : theme.muted }]}>
          {formatDisplayValue()}
        </Text>
        <Ionicons name="chevron-down-outline" size={16} color={theme.muted} />
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {mode === 'time' ? 'Select Time' : 'Select Date'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={theme.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {mode !== 'time' && (
                <>
                  {/* Presets */}
                  <View style={styles.presetRow}>
                    <Pressable
                      style={[styles.presetChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => handleQuickPreset(0)}
                    >
                      <Text style={[styles.presetChipText, { color: theme.primary }]}>Today</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.presetChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => handleQuickPreset(1)}
                    >
                      <Text style={[styles.presetChipText, { color: theme.primary }]}>Tomorrow</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.presetChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => handleQuickPreset(7)}
                    >
                      <Text style={[styles.presetChipText, { color: theme.primary }]}>+1 Week</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.presetChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => handleQuickPreset(14)}
                    >
                      <Text style={[styles.presetChipText, { color: theme.primary }]}>+2 Weeks</Text>
                    </Pressable>
                  </View>

                  {/* Month/Year Nav */}
                  <View style={styles.monthHeader}>
                    <Pressable onPress={handlePrevMonth} style={styles.navBtn}>
                      <Ionicons name="chevron-back" size={20} color={theme.text} />
                    </Pressable>
                    <Text style={[styles.monthTitle, { color: theme.text }]}>
                      {MONTHS[viewMonth]} {viewYear}
                    </Text>
                    <Pressable onPress={handleNextMonth} style={styles.navBtn}>
                      <Ionicons name="chevron-forward" size={20} color={theme.text} />
                    </Pressable>
                  </View>

                  {/* Days Header */}
                  <View style={styles.daysRow}>
                    {DAYS.map((d) => (
                      <Text key={d} style={[styles.dayHeaderCell, { color: theme.muted }]}>
                        {d}
                      </Text>
                    ))}
                  </View>

                  {/* Calendar Grid */}
                  <View style={styles.grid}>
                    {/* Empty leading cells */}
                    {Array.from({ length: firstDayIndex }).map((_, i) => (
                      <View key={`empty-${i}`} style={styles.gridCell} />
                    ))}

                    {/* Day cells */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const isSelected =
                        selectedDate.getFullYear() === viewYear &&
                        selectedDate.getMonth() === viewMonth &&
                        selectedDate.getDate() === dayNum;

                      return (
                        <Pressable
                          key={dayNum}
                          style={[
                            styles.gridCell,
                            isSelected && { backgroundColor: theme.primary, borderRadius: 12 },
                          ]}
                          onPress={() => handleSelectDay(dayNum)}
                        >
                          <Text
                            style={[
                              styles.dayCellText,
                              { color: theme.text },
                              isSelected && { color: theme.onPrimary, fontWeight: '800' },
                            ]}
                          >
                            {dayNum}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Time selection (for time mode or datetime mode) */}
              {(mode === 'time' || mode === 'datetime') && (
                <View style={styles.timeSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Time Selection</Text>
                  <View style={styles.timeRow}>
                    {/* Hours */}
                    <View style={styles.timeCol}>
                      <Text style={[styles.timeLabel, { color: theme.muted }]}>Hour</Text>
                      <ScrollView style={styles.timeScroll} nestedScrollEnabled>
                        {Array.from({ length: 24 }).map((_, h) => (
                          <Pressable
                            key={h}
                            style={[
                              styles.timeItem,
                              hours === h && { backgroundColor: theme.primary, borderRadius: 8 },
                            ]}
                            onPress={() => setHours(h)}
                          >
                            <Text style={[styles.timeItemText, { color: hours === h ? theme.onPrimary : theme.text }]}>
                              {String(h).padStart(2, '0')}:00
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>

                    {/* Minutes */}
                    <View style={styles.timeCol}>
                      <Text style={[styles.timeLabel, { color: theme.muted }]}>Minute</Text>
                      <ScrollView style={styles.timeScroll} nestedScrollEnabled>
                        {[0, 15, 30, 45].map((m) => (
                          <Pressable
                            key={m}
                            style={[
                              styles.timeItem,
                              minutes === m && { backgroundColor: theme.primary, borderRadius: 8 },
                            ]}
                            onPress={() => setMinutes(m)}
                          >
                            <Text style={[styles.timeItemText, { color: minutes === m ? theme.onPrimary : theme.text }]}>
                              :{String(m).padStart(2, '0')}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </View>
              )}

              {/* Confirm Button */}
              <Pressable style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={handleConfirm}>
                <Text style={[styles.confirmBtnText, { color: theme.onPrimary }]}>Set Selection</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  pickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  navBtn: {
    padding: 6,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayHeaderCell: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeCol: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  timeScroll: {
    maxHeight: 120,
  },
  timeItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginVertical: 2,
  },
  timeItemText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
