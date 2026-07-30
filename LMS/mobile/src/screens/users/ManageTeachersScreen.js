import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { canCreateTeachers, getEntityId } from '../../utils/roles';

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  schoolIds: [],
};

export default function ManageTeachersScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const allowed = canCreateTeachers(user);

  const fetchSchools = async () => {
    try {
      const url = user?.role === 'school_admin' ? `/schools?adminId=${user._id}` : '/schools';
      const response = await api.get(url);
      const schoolList = Array.isArray(response.data?.schools) ? response.data.schools : response.data;
      const list = schoolList || [];
      setSchools(list);

      // Default-select the only school for school admins
      if (user?.role === 'school_admin' && list.length === 1) {
        setFormData((prev) => ({
          ...prev,
          schoolIds: prev.schoolIds.length ? prev.schoolIds : [getEntityId(list[0])],
        }));
      }
    } catch (err) {
      console.log('Could not load schools', err?.message || err);
    }
  };

  const fetchTeachers = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const response = await api.get('/users?role=teacher,personal_teacher');
      const list = Array.isArray(response.data?.users) ? response.data.users : response.data;
      setTeachers((list || []).filter((t) => ['teacher', 'personal_teacher'].includes(t.role)));
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load teachers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      fetchSchools();
      fetchTeachers();
    }, [allowed, user?._id, user?.role])
  );

  useEffect(() => {
    if (!allowed) {
      Alert.alert('Access denied', 'Only school admins can manage teachers.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [allowed]);

  const toggleSchool = (schoolId) => {
    setFormData((prev) => {
      const exists = prev.schoolIds.includes(schoolId);
      return {
        ...prev,
        schoolIds: exists
          ? prev.schoolIds.filter((id) => id !== schoolId)
          : [...prev.schoolIds, schoolId],
      };
    });
  };

  const openCreateModal = () => {
    const defaultSchoolIds =
      user?.role === 'school_admin' && schools.length === 1
        ? [getEntityId(schools[0])]
        : [];
    setFormData({ ...EMPTY_FORM, schoolIds: defaultSchoolIds });
    setShowCreateModal(true);
  };

  const handleCreateTeacher = async () => {
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (!name || !email || !password) {
      Alert.alert('Missing fields', 'Name, email, and password are required.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (user?.role === 'school_admin' && formData.schoolIds.length === 0) {
      Alert.alert('School required', 'Select at least one school for this teacher.');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name,
        email,
        password,
        role: 'teacher',
      };
      if (formData.schoolIds.length > 0) {
        payload.schoolId = formData.schoolIds;
      }

      await api.post('/users', payload);
      Alert.alert('Teacher created', `${name} can now sign in with the password you set.`);
      setShowCreateModal(false);
      setFormData(EMPTY_FORM);
      fetchTeachers(false);
    } catch (err) {
      Alert.alert('Create failed', err?.response?.data?.message || 'Unable to create teacher.');
    } finally {
      setCreating(false);
    }
  };

  const renderTeacher = ({ item }) => (
    <View style={[styles.teacherCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.avatar, { backgroundColor: theme.surfaceElevated }]}>
        <Ionicons name="person-outline" size={20} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.teacherName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.teacherEmail, { color: theme.muted }]}>{item.email}</Text>
        <Text style={[styles.teacherRole, { color: theme.info }]}>
          {item.role === 'personal_teacher' ? 'Personal Teacher' : 'School Teacher'}
        </Text>
      </View>
    </View>
  );

  if (!allowed) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Teachers</Text>
        <Pressable onPress={openCreateModal} style={styles.iconButton}>
          <Ionicons name="person-add-outline" size={24} color={theme.primary} />
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Create school teachers and assign them to your schools.
        </Text>
        <Pressable
          style={[styles.createBtn, { backgroundColor: theme.primary }]}
          onPress={openCreateModal}
        >
          <Ionicons name="add-circle-outline" size={18} color={theme.onPrimary} />
          <Text style={[styles.createBtnText, { color: theme.onPrimary }]}>Create Teacher</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Button title="Retry" onPress={() => fetchTeachers()} />
        </View>
      ) : (
        <FlatList
          data={teachers}
          keyExtractor={(item) => item._id}
          renderItem={renderTeacher}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchTeachers(false);
              }}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="people-outline" size={40} color={theme.muted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No teachers yet</Text>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                Create a teacher account to assign them to classrooms.
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Create Teacher</Text>
              <Pressable onPress={() => setShowCreateModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={theme.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Full name</Text>
              <Input
                placeholder="Teacher full name"
                value={formData.name}
                onChangeText={(name) => setFormData((prev) => ({ ...prev, name }))}
                autoCapitalize="words"
              />

              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Email</Text>
              <Input
                placeholder="teacher@school.com"
                value={formData.email}
                onChangeText={(email) => setFormData((prev) => ({ ...prev, email }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Initial password</Text>
              <Input
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChangeText={(password) => setFormData((prev) => ({ ...prev, password }))}
                secureTextEntry
              />

              <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                Assign to school{user?.role === 'school_admin' ? ' (required)' : ' (optional)'}
              </Text>
              {schools.length === 0 ? (
                <Text style={[styles.helperText, { color: theme.muted }]}>
                  No schools available to assign.
                </Text>
              ) : (
                <View style={styles.chipRow}>
                  {schools.map((school) => {
                    const id = getEntityId(school);
                    const selected = formData.schoolIds.includes(id);
                    return (
                      <Pressable
                        key={id}
                        style={[
                          styles.chip,
                          { backgroundColor: theme.background, borderColor: theme.border },
                          selected && { backgroundColor: theme.primary, borderColor: theme.primary },
                        ]}
                        onPress={() => toggleSchool(id)}
                      >
                        <Text style={[styles.chipText, { color: selected ? theme.onPrimary : theme.muted }]}>
                          {school.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Pressable
                style={[styles.submitBtn, { backgroundColor: theme.primary }, creating && { opacity: 0.7 }]}
                onPress={handleCreateTeacher}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>Create Teacher Account</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  iconButton: { padding: 4, width: 36 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  toolbar: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 12 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  createBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  createBtnText: { fontWeight: '800', fontSize: 13 },
  list: { padding: 20, paddingBottom: 40 },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherName: { fontSize: 15, fontWeight: '800' },
  teacherEmail: { fontSize: 12, marginTop: 2 },
  teacherRole: { fontSize: 11, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  centered: { padding: 24, alignItems: 'center', gap: 12 },
  errorText: { textAlign: 'center', marginBottom: 8 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContainer: {
    maxHeight: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalCloseButton: { padding: 6 },
  modalContent: { padding: 20, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  helperText: { fontSize: 12, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '700' },
  submitBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: { fontWeight: '800', fontSize: 14 },
});
