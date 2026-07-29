import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import { getWebBaseUrl } from '../../utils/links';

const normalizeResourceType = (resourceType) => {
  const value = `${resourceType || ''}`.toLowerCase();
  if (['classroom', 'class', 'c'].includes(value)) return 'classroom';
  if (['school', 's'].includes(value)) return 'school';
  if (['exam', 'exam-center'].includes(value)) return 'exam';
  return value;
};

export default function SharedResourceScreen({ route, navigation }) {
  const { resourceType, identifier } = route.params || {};
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [resource, setResource] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSharedResource = async () => {
      if (!identifier) {
        setError('This shared link is missing its target identifier.');
        setLoading(false);
        return;
      }

      const normalizedType = normalizeResourceType(resourceType);
      setLoading(true);
      setError(null);
      try {
        if (normalizedType === 'exam') {
          navigation.replace('ExamCenter', { token: identifier });
          return;
        }

        if (normalizedType === 'classroom') {
          const response = await api.get(`/classrooms/public/${identifier}`);
          setResource({ type: 'classroom', data: response.data?.classroom || null });
        } else if (normalizedType === 'school') {
          const response = await api.get(`/schools/public/${identifier}`);
          setResource({ type: 'school', data: response.data || null });
        } else {
          setError('Unsupported share link type.');
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to open this shared link right now.');
      } finally {
        setLoading(false);
      }
    };

    loadSharedResource();
  }, [identifier, navigation, resourceType]);

  const openInBrowser = async () => {
    const baseUrl = getWebBaseUrl();
    const fallbackPath = resourceType === 'school' || resourceType === 's'
      ? `/s/${identifier}`
      : resourceType === 'classroom' || resourceType === 'class' || resourceType === 'c'
        ? `/c/${identifier}`
        : `/exam-center/${identifier}`;

    const url = `${baseUrl}${fallbackPath}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unavailable', 'This device cannot open the shared link.');
      }
    } catch (err) {
      Alert.alert('Unable to open', 'The shared link could not be opened from this device.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
        <View style={styles.centered}> 
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Opening shared link…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
        <View style={styles.centered}> 
          <Ionicons name="warning-outline" size={48} color={theme.danger} />
          <Text style={[styles.title, { color: theme.text }]}>Could not open link</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>{error}</Text>
          <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => navigation.goBack()}>
            <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (resource?.type === 'classroom') {
    const classroom = resource.data;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
            <Text style={[styles.eyebrow, { color: theme.primary }]}>Classroom preview</Text>
            <Text style={[styles.title, { color: theme.text }]}>{classroom?.name || 'Classroom'}</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>{classroom?.description || 'This classroom is being shared from the Gracified LMS portal.'}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.metaPill, { backgroundColor: theme.surfaceElevated }]}> 
                <Ionicons name="person-outline" size={14} color={theme.muted} />
                <Text style={[styles.metaText, { color: theme.muted }]}>{classroom?.teacherId?.name || 'Instructor details pending'}</Text>
              </View>
              <View style={[styles.metaPill, { backgroundColor: theme.surfaceElevated }]}> 
                <Ionicons name="school-outline" size={14} color={theme.muted} />
                <Text style={[styles.metaText, { color: theme.muted }]}>{classroom?.level || 'General'}</Text>
              </View>
            </View>
            <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={openInBrowser}>
              <Ionicons name="open-outline" size={16} color={theme.onPrimary} />
              <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Open in browser</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (resource?.type === 'school') {
    const school = resource.data?.school;
    const classrooms = resource.data?.classrooms || [];
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
            <Text style={[styles.eyebrow, { color: theme.primary }]}>School portal preview</Text>
            <Text style={[styles.title, { color: theme.text }]}>{school?.name || 'School portal'}</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>{school?.description || 'This school portal is being shared from the Gracified LMS portal.'}</Text>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Published classrooms</Text>
            {classrooms.length === 0 ? (
              <Text style={[styles.subtitle, { color: theme.muted }]}>No published classrooms are available yet.</Text>
            ) : classrooms.map((classroom) => (
              <View key={classroom._id} style={[styles.listItem, { borderColor: theme.border }]}> 
                <Text style={[styles.listTitle, { color: theme.text }]}>{classroom.name}</Text>
                <Text style={[styles.listSubtitle, { color: theme.muted }]}>{classroom.subject || 'General classroom'}</Text>
              </View>
            ))}
            <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={openInBrowser}>
              <Ionicons name="open-outline" size={16} color={theme.onPrimary} />
              <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Open in browser</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { flexGrow: 1, padding: 24 },
  card: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  loadingText: { marginTop: 12, fontSize: 16, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  metaText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  listItem: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 8 },
  listTitle: { fontSize: 15, fontWeight: '700' },
  listSubtitle: { fontSize: 13, marginTop: 2 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 999, marginTop: 6 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
