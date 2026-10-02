import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Input from '../../components/ui/Input';
import { getEntityId } from '../../utils/roles';
import KeyboardAwareScrollView from '../../components/ui/KeyboardAwareScrollView';

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  schoolIds: [],
};

export default function CreateTeacherScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [schools, setSchools] = useState([]);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const url = user?.role === 'school_admin' ? `/schools?adminId=${user._id}` : '/schools';
        const response = await api.get(url);
        const schoolList = Array.isArray(response.data?.schools) ? response.data.schools : response.data;
        const list = schoolList || [];
        setSchools(list);

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
    fetchSchools();
  }, [user?._id, user?.role]);

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
      navigation.goBack();
    } catch (err) {
      Alert.alert('Create failed', err?.response?.data?.message || 'Unable to create teacher.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Create Teacher</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
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