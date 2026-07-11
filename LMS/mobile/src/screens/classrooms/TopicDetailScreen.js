import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import { canManageAssignments } from '../../utils/roles';

export default function TopicDetailScreen({ route, navigation }) {
  const { topicId } = route.params || {};
  const { user } = useAuth();
  const { theme } = useTheme();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isTeacher = canManageAssignments(user);

  const loadTopic = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/topics/${topicId}`);
      setTopic(response.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load topic details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (topicId) {
      loadTopic();
    }
  }, [topicId]);

  const handleActivate = async () => {
    try {
      await api.post(`/topics/${topicId}/activate`);
      Alert.alert('Success', 'Topic is now active!');
      loadTopic();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to activate topic.');
    }
  };

  const handleComplete = async () => {
    try {
      await api.post(`/topics/${topicId}/complete`);
      Alert.alert('Success', 'Topic marked as completed!');
      loadTopic();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to complete topic.');
    }
  };

  const openLink = async (url) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Invalid Link', `Cannot open this URL: ${url}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open link');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        <Pressable style={[styles.backButton, { backgroundColor: theme.border }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backButtonText, { color: theme.text }]}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Topic details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.metaRow}>
          <View style={[
            styles.badge,
            topic?.status === 'completed'
              ? { backgroundColor: theme.info }
              : topic?.status === 'active'
              ? { backgroundColor: theme.success }
              : { backgroundColor: theme.neutral },
          ]}>
            <Text style={[styles.badgeText, { color: theme.onPrimary }]}>{topic?.status?.toUpperCase() || 'PENDING'}</Text>
          </View>
          {topic?.isPaid && (
            <View style={[styles.badge, { backgroundColor: theme.warning }]}>
              <Text style={[styles.badgeText, { color: theme.onPrimary }]}>PAID • NGN {topic.price}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: theme.text }]}>{topic?.name}</Text>
        <Text style={[styles.description, { color: theme.muted }]}>{topic?.description || 'No description provided.'}</Text>

        {topic?.lessonsOutline ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Lesson outline</Text>
            <View style={[styles.outlineCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.outlineText, { color: theme.neutral }]}>{topic?.lessonsOutline}</Text>
            </View>
          </View>
        ) : null}

        {/* Action Controls for Teachers */}
        {isTeacher && (
          <View style={[styles.teacherControls, { backgroundColor: theme.surface, borderColor: theme.neutral }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Teacher settings</Text>
            <View style={styles.controlsRow}>
              {topic?.status !== 'active' && topic?.status !== 'completed' && (
                <Pressable style={[styles.actionBtn, { backgroundColor: theme.success }]} onPress={handleActivate}>
                  <Ionicons name="play-outline" size={18} color={theme.onPrimary} />
                  <Text style={[styles.actionBtnText, { color: theme.onPrimary }]}>Activate topic</Text>
                </Pressable>
              )}
              {topic?.status === 'active' && (
                <Pressable style={[styles.actionBtn, { backgroundColor: theme.info }]} onPress={handleComplete}>
                  <Ionicons name="checkmark-done-outline" size={18} color={theme.onPrimary} />
                  <Text style={[styles.actionBtnText, { color: theme.onPrimary }]}>Mark as complete</Text>
                </Pressable>
              )}
              {topic?.status === 'completed' && (
                <Text style={[styles.completedInfo, { color: theme.success }]}>This topic has been successfully completed.</Text>
              )}
            </View>
          </View>
        )}

        {/* Materials */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Topic materials</Text>
          {topic?.materials && topic.materials.length > 0 ? (
            topic.materials.map((material, idx) => (
              <Pressable
                key={material._id || idx}
                style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => material.url && openLink(material.url)}
              >
                <View style={[styles.itemIconContainer, { backgroundColor: theme.surfaceElevated }]}>
                  <Ionicons
                    name={
                      material.type === 'video'
                        ? 'videocam-outline'
                        : material.type === 'document'
                        ? 'document-text-outline'
                        : material.type === 'link'
                        ? 'link-outline'
                        : 'document-outline'
                    }
                    size={22}
                    color={theme.text}
                  />
                </View>
                <View style={styles.itemTextContainer}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{material.title || 'Material file'}</Text>
                  <Text style={[styles.itemSubtitle, { color: theme.muted }]}>
                    {material.type?.toUpperCase()} {material.url ? '• Tap to open' : ''}
                  </Text>
                  {material.content ? <Text style={[styles.itemContent, { color: theme.neutral }]}>{material.content}</Text> : null}
                </View>
                {material.url && <Ionicons name="open-outline" size={18} color={theme.muted} />}
              </Pressable>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: theme.muted }]}>No materials posted for this topic yet.</Text>
          )}
        </View>

        {/* Recorded Videos */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recorded lectures</Text>
          {topic?.recordedVideos && topic.recordedVideos.length > 0 ? (
            topic.recordedVideos.map((video, idx) => (
              <Pressable
                key={video._id || idx}
                style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => openLink(video.url)}
              >
                <View style={[styles.itemIconContainer, { backgroundColor: `${theme.danger}1A` }]}>
                  <Ionicons name="play-circle-outline" size={24} color={theme.danger} />
                </View>
                <View style={styles.itemTextContainer}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{video.label || 'Recorded Lecture'}</Text>
                  <Text style={[styles.itemSubtitle, { color: theme.muted }]}>
                    Uploaded at {new Date(video.uploadedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={18} color={theme.muted} />
              </Pressable>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: theme.muted }]}>No recorded lectures available yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  backButton: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  backButtonText: { fontWeight: '700' },
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
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 10 },
  description: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  outlineCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  outlineText: { fontSize: 14, lineHeight: 20 },
  teacherControls: { marginTop: 24, padding: 16, borderRadius: 18, borderWidth: 1 },
  controlsRow: { marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  actionBtnText: { fontWeight: '700', fontSize: 14 },
  completedInfo: { fontWeight: '600', fontSize: 14, textAlign: 'center' },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  itemIconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemTextContainer: { flex: 1, marginLeft: 12, marginRight: 8 },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  itemSubtitle: { fontSize: 11, marginTop: 2 },
  itemContent: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  emptyText: { fontSize: 14, fontStyle: 'italic', marginTop: 4 },
});
