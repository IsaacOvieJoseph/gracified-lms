import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import DateTimePicker from '../../components/ui/DateTimePicker';
import SelectField from '../../components/ui/SelectField';
import KeyboardAwareScrollView from '../../components/ui/KeyboardAwareScrollView';

const classroomLevels = ['Pre-Primary', 'Primary', 'High School', 'Pre-University', 'Undergraduate', 'Postgraduate', 'Professional', 'Vocational', 'Other'];

const EMPTY_FORM = {
  name: '',
  description: '',
  subject: '',
  level: 'Other',
  pricing: { amount: 0, type: 'one_time' },
  isPaid: false,
  isPrivate: false,
  published: true,
  capacity: 30,
  teacherId: '',
  schoolIds: [],
  schedule: [],
};

export default function CreateClassroomScreen({ navigation, route }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { mode = 'create', classroomId, aiResult, aiAction } = route.params || {};

  const isEditing = mode === 'edit';

  const [formData, setFormData] = useState({
    ...EMPTY_FORM,
    teacherId: user?.role === 'teacher' || user?.role === 'personal_teacher' ? user._id : '',
    schoolIds: user?.schoolId ? (Array.isArray(user.schoolId) ? user.schoolId : [user.schoolId]) : [],
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(isEditing);

  const addScheduleSlot = () => {
    setFormData(prev => ({
      ...prev,
      schedule: [...prev.schedule, { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00' }]
    }));
  };

  const removeScheduleSlot = (index) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== index)
    }));
  };

  const updateScheduleSlot = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      schedule: prev.schedule.map((slot, i) => i === index ? { ...slot, [field]: value } : slot)
    }));
  };

  const fetchTeachers = async () => {
    if (!['root_admin', 'school_admin'].includes(user?.role)) return;
    try {
      const response = await api.get('/users?role=teacher,personal_teacher');
      const teacherList = Array.isArray(response.data?.users) ? response.data.users : response.data;
      setTeachers(teacherList.filter((t) => ['teacher', 'personal_teacher'].includes(t.role)));
    } catch (err) {
      console.log('Could not load teachers', err?.message || err);
    }
  };

  const fetchSchools = async () => {
    if (!['root_admin', 'school_admin'].includes(user?.role)) return;
    try {
      const url = user?.role === 'school_admin' ? `/schools?adminId=${user._id}` : '/schools';
      const response = await api.get(url);
      const schoolList = Array.isArray(response.data?.schools) ? response.data.schools : response.data;
      setSchools(schoolList || []);
    } catch (err) {
      console.log('Could not load schools', err?.message || err);
    }
  };

  useEffect(() => {
    if (isEditing && classroomId) {
      const loadClassroom = async () => {
        try {
          const response = await api.get(`/classrooms/${classroomId}`);
          const classroom = response.data?.classroom || response.data;
          setFormData({
            name: classroom.name || '',
            description: classroom.description || '',
            subject: classroom.subject || '',
            level: classroom.level || 'Other',
            pricing: {
              amount: Number(classroom.pricing?.amount || 0),
              type: classroom.pricing?.type || 'one_time',
            },
            isPaid: !!classroom.isPaid,
            isPrivate: !!classroom.isPrivate,
            published: classroom.published !== false,
            capacity: Number(classroom.capacity || 30),
            teacherId: classroom.teacherId?._id || classroom.teacherId || '',
            schoolIds: [],
            schedule: Array.isArray(classroom.schedule) ? classroom.schedule : [],
          });
        } catch (err) {
          Alert.alert('Load failed', err?.response?.data?.message || 'Unable to load classroom details.');
          navigation.goBack();
        } finally {
          setLoading(false);
        }
      };
      loadClassroom();
    } else {
      fetchTeachers();
      fetchSchools();
      if (aiResult && aiAction === 'classroom') {
        setFormData((prev) => ({
          ...prev,
          name: aiResult.name || prev.name,
          description: aiResult.description || prev.description,
          subject: aiResult.subject || prev.subject,
          level: aiResult.level || prev.level,
        }));
      }
    }
  }, [classroomId, isEditing, navigation]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.name.trim()) {
      Alert.alert('Missing title', 'Please provide a classroom name.');
      return;
    }

    setSaveLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        subject: formData.subject,
        level: formData.level,
        isPaid: formData.isPaid && formData.pricing.amount > 0,
        pricing: { ...formData.pricing },
        isPrivate: formData.isPrivate,
        published: formData.published,
        capacity: Number(formData.capacity) || 30,
        schedule: formData.schedule || [],
      };

      if (isEditing) {
        const response = await api.put(`/classrooms/${classroomId}`, payload);
        const updatedClassroom = response.data?.classroom || response.data;
        Alert.alert('Updated', 'Classroom details saved.');
        if (updatedClassroom) navigation.goBack();
        return;
      }

      if (['teacher', 'personal_teacher'].includes(user.role)) {
        payload.teacherId = user._id;
      } else if (formData.teacherId) {
        payload.teacherId = formData.teacherId;
      }

      if (user.role === 'school_admin') {
        payload.schoolId = formData.schoolIds;
      } else if (user.role === 'root_admin' && formData.schoolIds.length > 0) {
        payload.schoolId = formData.schoolIds;
      }

      const response = await api.post('/classrooms', payload);
      const newClassroom = response.data?.classroom || response.data;
      Alert.alert('Created', 'Classroom successfully created.');
      if (newClassroom) navigation.goBack();
    } catch (err) {
      Alert.alert(isEditing ? 'Update failed' : 'Creation failed', err?.response?.data?.message || (isEditing ? 'Unable to update classroom.' : 'Unable to create classroom.'));
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const adminOrManager = ['root_admin', 'school_admin'].includes(user?.role);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{isEditing ? 'Edit Classroom' : 'Create Classroom'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <View style={styles.introBlock}>
          <Text style={[styles.introTitle, { color: theme.text }]}>
            {isEditing ? 'Update the class details' : 'Add the basics first'}
          </Text>
          <Text style={[styles.introSubtitle, { color: theme.muted }]}>
            {isEditing ? 'You can review the schedule, access settings, and publishing state below.' : 'You can update these details later.'}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.text }]}>Classroom name <Text style={{ color: theme.danger }}>*</Text></Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="e.g. SS2 Mathematics"
          placeholderTextColor={theme.muted}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Description <Text style={[styles.optionalLabel, { color: theme.muted }]}>(optional)</Text></Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="What will students learn in this class?"
          placeholderTextColor={theme.muted}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          multiline
          textAlignVertical="top"
        />
        <Text style={[styles.sectionLabel, { color: theme.text }]}>Subject <Text style={[styles.optionalLabel, { color: theme.muted }]}>(optional)</Text></Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="e.g. Mathematics, Biology"
          placeholderTextColor={theme.muted}
          value={formData.subject}
          onChangeText={(text) => setFormData({ ...formData, subject: text })}
          autoCapitalize="words"
        />

        <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 2 }]}>Grade / academic level</Text>
        <Text style={[styles.helperText, { color: theme.muted, marginBottom: 6 }]}>Choose the level that best matches your learners.</Text>
        <SelectField
          value={formData.level}
          options={classroomLevels}
          onChange={(level) => setFormData({ ...formData, level })}
          placeholder="Select grade / academic level"
        />

        <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 2 }]}>Access and payment</Text>
        <View style={[styles.toggleGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Paid classroom</Text>
              <Text style={[styles.helperText, { color: theme.muted }]}>Require payment before enrollment.</Text>
            </View>
            <Switch value={formData.isPaid} onValueChange={(isPaid) => setFormData({ ...formData, isPaid })} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.onPrimary} />
          </View>
          <View style={[styles.toggleRow, { borderTopColor: theme.border, borderTopWidth: 1 }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Private classroom</Text>
              <Text style={[styles.helperText, { color: theme.muted }]}>Limit access to invited learners.</Text>
            </View>
            <Switch value={formData.isPrivate} onValueChange={(isPrivate) => setFormData({ ...formData, isPrivate })} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.onPrimary} />
          </View>
        </View>

        {formData.isPaid && (
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="Price amount in NGN"
            placeholderTextColor={theme.muted}
            keyboardType="numeric"
            value={String(formData.pricing.amount)}
            onChangeText={(value) => setFormData({ ...formData, pricing: { ...formData.pricing, amount: Number(value) || 0 } })}
          />
        )}

        <Text style={[styles.sectionLabel, { color: theme.text }]}>Student capacity</Text>
        <Text style={[styles.helperText, { color: theme.muted, marginBottom: 6 }]}>Maximum number of students. Default: 30.</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="e.g. 30"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          value={String(formData.capacity)}
          onChangeText={(value) => setFormData({ ...formData, capacity: value === '' ? '' : Number(value) })}
        />

        {/* Weekly Schedule Builder */}
        <View style={[styles.scheduleBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.scheduleHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.sectionLabel, { color: theme.text, marginBottom: 2 }]}>Weekly schedule <Text style={[styles.optionalLabel, { color: theme.muted }]}>(optional)</Text></Text>
              <Text style={[styles.helperText, { color: theme.muted }]}>Add recurring class times.</Text>
            </View>
            <Pressable style={[styles.addSlotBtn, { backgroundColor: `${theme.primary}20` }]} onPress={addScheduleSlot}>
              <Ionicons name="add-outline" size={16} color={theme.primary} />
              <Text style={[styles.addSlotBtnText, { color: theme.primary }]}>Add Slot</Text>
            </Pressable>
          </View>

          {formData.schedule.length === 0 ? (
            <Text style={[styles.helperText, { color: theme.muted, fontStyle: 'italic', marginTop: 6 }]}>No weekly schedule slots configured yet.</Text>
          ) : (
            formData.schedule.map((slot, index) => (
              <View key={index} style={[styles.slotRow, { borderColor: theme.border }]}>
                <View style={styles.slotHeader}>
                  <Text style={[styles.slotTitle, { color: theme.text }]}>Slot {index + 1}</Text>
                  <Pressable onPress={() => removeScheduleSlot(index)}>
                    <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  </Pressable>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 8 }}>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                    <Pressable
                      key={d}
                      style={[styles.miniChip, { backgroundColor: theme.background, borderColor: theme.border }, slot.dayOfWeek === d && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                      onPress={() => updateScheduleSlot(index, 'dayOfWeek', d)}
                    >
                      <Text style={[styles.miniChipText, { color: slot.dayOfWeek === d ? theme.onPrimary : theme.muted }]}>{d.slice(0, 3)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Time pickers */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <DateTimePicker
                      label="Start Time"
                      value={slot.startTime}
                      onChange={(val) => updateScheduleSlot(index, 'startTime', val)}
                      mode="time"
                      placeholder="09:00"
                      compact
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <DateTimePicker
                      label="End Time"
                      value={slot.endTime}
                      onChange={(val) => updateScheduleSlot(index, 'endTime', val)}
                      mode="time"
                      placeholder="10:00"
                      compact
                    />
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {!isEditing && adminOrManager && (
          <View style={styles.cardsWrapper}>
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>Assign teacher</Text>
            {teachers.length === 0 ? (
              <View style={{ gap: 10 }}>
                <Text style={[styles.helperText, { color: theme.muted }]}>No teachers yet for your school.</Text>
                <Pressable
                  style={[styles.addSlotBtn, { backgroundColor: `${theme.primary}20`, alignSelf: 'flex-start' }]}
                  onPress={() => {
                    navigation.goBack();
                    navigation.navigate('ManageTeachers');
                  }}
                >
                  <Ionicons name="person-add-outline" size={16} color={theme.primary} />
                  <Text style={[styles.addSlotBtnText, { color: theme.primary }]}>Create Teacher</Text>
                </Pressable>
              </View>
            ) : (
              <SelectField
                value={formData.teacherId}
                options={teachers.map((teacher) => ({ value: teacher._id, label: teacher.name }))}
                onChange={(teacherId) => setFormData({ ...formData, teacherId })}
                placeholder="Select a teacher"
              />
            )}
          </View>
        )}

        {!isEditing && adminOrManager && (
          <View style={styles.cardsWrapper}>
            <Text style={[styles.sectionLabel, { color: theme.muted }]}>School visibility</Text>
            <View style={styles.chipRow}>
              {schools.length === 0 ? (
                <Text style={[styles.helperText, { color: theme.muted }]}>No school list available.</Text>
              ) : schools.map((school) => (
                <Pressable
                  key={school._id}
                  style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, formData.schoolIds.includes(school._id) && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => {
                    const has = formData.schoolIds.includes(school._id);
                    setFormData({
                      ...formData,
                      schoolIds: has
                        ? formData.schoolIds.filter((id) => id !== school._id)
                        : [...formData.schoolIds, school._id]
                    });
                  }}
                >
                  <Text style={[styles.chipText, { color: formData.schoolIds.includes(school._id) ? theme.onPrimary : theme.muted }]}>{school.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.toggleGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Publish classroom</Text>
              <Text style={[styles.helperText, { color: theme.muted }]}>Make this class visible to learners.</Text>
            </View>
            <Switch value={formData.published} onValueChange={(published) => setFormData({ ...formData, published })} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.onPrimary} />
          </View>
        </View>

        <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }, saveLoading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={saveLoading}>
          {saveLoading ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>{isEditing ? 'Save Changes' : 'Create Classroom'}</Text>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  introBlock: { marginBottom: 16 },
  introTitle: { fontSize: 20, fontWeight: '800' },
  introSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '800', marginBottom: 3 },
  optionalLabel: { fontSize: 11, fontWeight: '500' },
  helperText: { fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, marginBottom: 12 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  toggleGroup: { borderWidth: 1, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  toggleRow: { minHeight: 62, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleCopy: { flex: 1, paddingRight: 12 },
  toggleTitle: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  submitBtn: { borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontWeight: '800', fontSize: 14 },
  scheduleBox: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12 },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addSlotBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  addSlotBtnText: { fontSize: 12, fontWeight: '700' },
  slotRow: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 8 },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  slotTitle: { fontSize: 12, fontWeight: '800' },
  miniChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  miniChipText: { fontSize: 11, fontWeight: '700' },
  cardsWrapper: { marginBottom: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '700' },
});