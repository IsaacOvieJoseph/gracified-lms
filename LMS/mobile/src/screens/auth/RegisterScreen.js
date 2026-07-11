import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, StyleSheet, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const accountTypes = [
  { role: 'student', title: 'Student', subtitle: 'Join classes, submit assignments, and take exams.' },
  { role: 'school_admin', title: 'School Admin', subtitle: 'Register a school and manage classrooms.' },
  { role: 'personal_teacher', title: 'Personal Teacher', subtitle: 'Create an independent tutorial center.' },
];

export default function RegisterScreen({ navigation }) {
  const { register, setUser, setToken } = useAuth();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student');
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [tutorialName, setTutorialName] = useState('');
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const response = await api.get('/schools/public');
        setSchools(response.data?.schools || []);
      } catch (error) {
        setSchools([]);
      }
    };
    fetchSchools();
  }, []);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Please fill in all the fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match');
      return;
    }
    if (role === 'school_admin' && !schoolName.trim()) {
      Alert.alert('School name required', 'Please enter the school name.');
      return;
    }
    if (role === 'personal_teacher' && !tutorialName.trim()) {
      Alert.alert('Tutorial name required', 'Please enter your tutorial or academy name.');
      return;
    }
    setLoading(true);
    try {
      const payload = { name, email, password, confirmPassword, role };
      if (role === 'student' && schoolId && schoolId !== 'none') payload.schoolId = schoolId;
      if (role === 'school_admin') payload.schoolName = schoolName.trim();
      if (role === 'personal_teacher') payload.tutorialName = tutorialName.trim();

      const response = await register(payload);
      const nextToken = response.data?.token;
      const nextUser = response.data?.user;

      if (nextToken && nextUser) {
        await AsyncStorage.setItem('token', nextToken);
        setToken(nextToken);
        setUser(nextUser);
        return;
      }

      Alert.alert('Account created', 'Please verify your email with the OTP sent to your inbox.');
      navigation.navigate('VerifyEmail', { email });
    } catch (error) {
      Alert.alert('Registration failed', error?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Create your account</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Choose the same account type available on the web app.</Text>

        <View style={styles.accountList}>
          {accountTypes.map((type) => {
            const selected = role === type.role;
            return (
              <Pressable
                key={type.role}
                style={[
                  styles.accountCard,
                  { backgroundColor: theme.background, borderColor: theme.border },
                  selected && { borderColor: theme.primary, backgroundColor: theme.surfaceElevated },
                ]}
                onPress={() => setRole(type.role)}
              >
                <View style={[styles.radio, { borderColor: selected ? theme.primary : theme.border }]}>
                  {selected && <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.accountTitle, { color: theme.text }]}>{type.title}</Text>
                  <Text style={[styles.accountSub, { color: theme.muted }]}>{type.subtitle}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Input placeholder="Full name" value={name} onChangeText={setName} />
        <Input placeholder="Email" value={email} onChangeText={setEmail} />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Input placeholder="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

        {role === 'student' && (
          <View style={styles.selectorBlock}>
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>School / Tutorial Center</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, { backgroundColor: theme.background, borderColor: theme.border }, schoolId === 'none' && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => setSchoolId('none')}
              >
                <Text style={[styles.chipText, { color: schoolId === 'none' ? theme.onPrimary : theme.text }]}>None</Text>
              </Pressable>
              {schools.map((school) => (
                <Pressable
                  key={school._id}
                  style={[styles.chip, { backgroundColor: theme.background, borderColor: theme.border }, schoolId === school._id && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => setSchoolId(school._id)}
                >
                  <Text style={[styles.chipText, { color: schoolId === school._id ? theme.onPrimary : theme.text }]}>{school.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {role === 'school_admin' && (
          <Input placeholder="School name" value={schoolName} onChangeText={setSchoolName} />
        )}

        {role === 'personal_teacher' && (
          <Input placeholder="Tutorial / academy name" value={tutorialName} onChangeText={setTutorialName} />
        )}

        <Button title={loading ? 'Creating account...' : 'Continue'} onPress={handleRegister} />
        <Button title="Back to login" onPress={() => navigation.goBack()} variant="secondary" />
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  card: { borderRadius: 24, padding: 18, marginTop: 24 },
  title: { fontSize: 25, fontWeight: '800' },
  subtitle: { marginBottom: 16, marginTop: 8 },
  accountList: { gap: 10, marginBottom: 16 },
  accountCard: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  accountTitle: { fontSize: 14, fontWeight: '800' },
  accountSub: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  selectorBlock: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  chipText: { fontSize: 12, fontWeight: '700' },
});
