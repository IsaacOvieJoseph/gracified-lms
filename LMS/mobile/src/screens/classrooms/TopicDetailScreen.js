import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import { canManageClassroom } from '../../utils/roles';
import { getVideoEmbedInfo } from '../../utils/video';

const unwrapTopicResponse = (payload) => payload?.topic || payload?.data?.topic || payload?.data || payload || null;
const asList = (value) => Array.isArray(value) ? value : [];

export default function TopicDetailScreen({ route, navigation }) {
  const { topicId } = route.params || {};
  const { user } = useAuth();
  const { theme } = useTheme();
  const [topic, setTopic] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showVideoUrlInput, setShowVideoUrlInput] = useState(false);
  const [materialForm, setMaterialForm] = useState({ title: '', url: '', content: '', type: 'link' });
  const [videoUrl, setVideoUrl] = useState('');

  const classroomForAccess = classroom || topic?.classroomId || null;
  const canManage = canManageClassroom(user, classroomForAccess);

  const loadTopic = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/topics/${topicId}`);
      const loadedTopic = unwrapTopicResponse(response.data);
      setTopic(loadedTopic);

      const classroomData = loadedTopic?.classroomId && typeof loadedTopic.classroomId === 'object'
        ? loadedTopic.classroomId
        : null;

      if (classroomData) {
        setClassroom(classroomData);
      } else if (loadedTopic?.classroomId) {
        try {
          const classroomResponse = await api.get(`/classrooms/${loadedTopic.classroomId}`);
          setClassroom(classroomResponse.data?.classroom || classroomResponse.data || null);
        } catch (classroomErr) {
          console.log('Unable to fetch classroom for topic access check', classroomErr?.message || classroomErr);
        }
      }
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
      await api.post(`/topics/${topicId}/complete`, { activateNext: true });
      Alert.alert('Success', 'Topic marked as completed!');
      loadTopic();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to complete topic.');
    }
  };

  const handleReset = async () => {
    try {
      await api.post(`/topics/${topicId}/reset`);
      Alert.alert('Success', 'Topic reset to pending.');
      loadTopic();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to reset topic.');
    }
  };

  const handleAddMaterial = async () => {
    const trimmedUrl = materialForm.url.trim();
    if (!trimmedUrl) {
      Alert.alert('Missing link', 'Please provide a material URL before saving.');
      return;
    }

    try {
      const nextMaterials = [
        ...(materials || []),
        {
          title: materialForm.title.trim() || 'Study material',
          url: trimmedUrl,
          content: materialForm.content.trim(),
          type: materialForm.type || 'link',
        },
      ];

      await api.put(`/topics/${topicId}`, { materials: nextMaterials });
      setMaterialForm({ title: '', url: '', content: '', type: 'link' });
      setShowMaterialForm(false);
      loadTopic();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to add material.');
    }
  };

  const handleRemoveMaterial = async (index) => {
    Alert.alert('Remove material?', 'This will delete the material from this topic.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const nextMaterials = (materials || []).filter((_, itemIndex) => itemIndex !== index);
            await api.put(`/topics/${topicId}`, { materials: nextMaterials });
            loadTopic();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to remove material.');
          }
        },
      },
    ]);
  };

  const handleAddVideoUrl = async () => {
    const trimmedUrl = videoUrl.trim();
    if (!trimmedUrl) {
      Alert.alert('Missing URL', 'Please provide a recorded lecture URL.');
      return;
    }

    try {
      await api.post(`/topics/${topicId}/add-video-url`, { url: trimmedUrl });
      setVideoUrl('');
      setShowVideoUrlInput(false);
      loadTopic();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to add recorded lecture.');
    }
  };

  const handleRemoveVideo = async (videoId) => {
    Alert.alert('Remove lecture?', 'This will remove the recorded lecture from this topic.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/topics/${topicId}/videos/${videoId}`);
            loadTopic();
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to remove lecture.');
          }
        },
      },
    ]);
  };

  const openLink = async (url) => {
    if (!url) return;
    try {
      // Direct opening for web/http links is safer on Android 11+ and iOS 9+
      if (url.startsWith('http://') || url.startsWith('https://')) {
        await Linking.openURL(url);
      } else {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Invalid Link', `Cannot open this URL: ${url}`);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open link');
    }
  };

  const materials = asList(topic?.materials);
  const recordedVideos = asList(topic?.recordedVideos);
  const outline = topic?.lessonsOutline || topic?.lessonOutline || topic?.outline;

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

        {outline ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Lesson outline</Text>
            <View style={[styles.outlineCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.outlineText, { color: theme.neutral }]}>{outline}</Text>
            </View>
          </View>
        ) : null}

        {/* Action Controls for Classroom Managers */}
        {canManage && (
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
                <>
                  <Text style={[styles.completedInfo, { color: theme.success }]}>This topic has been successfully completed.</Text>
                  <Pressable style={[styles.actionBtn, { backgroundColor: theme.warning }]} onPress={handleReset}>
                    <Ionicons name="refresh-outline" size={18} color={theme.onPrimary} />
                    <Text style={[styles.actionBtnText, { color: theme.onPrimary }]}>Reset to pending</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}

        {/* Materials */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Topic materials</Text>
            {canManage && (
              <Pressable style={[styles.addActionBtn, { backgroundColor: `${theme.primary}20` }]} onPress={() => setShowMaterialForm((current) => !current)}>
                <Ionicons name="add-outline" size={16} color={theme.primary} />
                <Text style={[styles.addActionText, { color: theme.primary }]}>Add material</Text>
              </Pressable>
            )}
          </View>

          {showMaterialForm && canManage && (
            <View style={[styles.inlineEditor, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="Material title"
                placeholderTextColor={theme.muted}
                value={materialForm.title}
                onChangeText={(text) => setMaterialForm((current) => ({ ...current, title: text }))}
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="URL / link"
                placeholderTextColor={theme.muted}
                value={materialForm.url}
                onChangeText={(text) => setMaterialForm((current) => ({ ...current, url: text }))}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="Short description (optional)"
                placeholderTextColor={theme.muted}
                value={materialForm.content}
                onChangeText={(text) => setMaterialForm((current) => ({ ...current, content: text }))}
                multiline
              />
              <View style={styles.inlineRow}>
                {['link', 'document', 'video'].map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.chip, { borderColor: theme.border }, materialForm.type === type && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => setMaterialForm((current) => ({ ...current, type }))}
                  >
                    <Text style={[styles.chipText, { color: theme.muted }, materialForm.type === type && { color: theme.onPrimary }]}>{type.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }]} onPress={handleAddMaterial}>
                <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>Save material</Text>
              </Pressable>
            </View>
          )}

          {materials.length > 0 ? (
            materials.map((material, idx) => (
              <View key={`${material._id || material.url || idx}`} style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Pressable
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => {
                    if (!material.url) return;
                    const embedInfo = getVideoEmbedInfo(material.url);
                    if (material.type === 'video' || embedInfo) {
                      navigation.navigate('VideoPlayer', {
                        videoUrl: material.url,
                        title: material.title || 'Topic Material'
                      });
                    } else {
                      openLink(material.url);
                    }
                  }}
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
                {canManage && (
                  <Pressable onPress={() => handleRemoveMaterial(idx)} style={styles.deleteMiniBtn}>
                    <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  </Pressable>
                )}
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: theme.muted }]}>No materials posted for this topic yet.</Text>
          )}
        </View>

        {/* Recorded Videos */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recorded lectures</Text>
            {canManage && (
              <Pressable style={[styles.addActionBtn, { backgroundColor: `${theme.primary}20` }]} onPress={() => setShowVideoUrlInput((current) => !current)}>
                <Ionicons name="add-outline" size={16} color={theme.primary} />
                <Text style={[styles.addActionText, { color: theme.primary }]}>Add lecture</Text>
              </Pressable>
            )}
          </View>

          {showVideoUrlInput && canManage && (
            <View style={[styles.inlineEditor, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="Paste recorded lecture URL"
                placeholderTextColor={theme.muted}
                value={videoUrl}
                onChangeText={setVideoUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }]} onPress={handleAddVideoUrl}>
                <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>Save lecture</Text>
              </Pressable>
            </View>
          )}

          {recordedVideos.length > 0 ? (
            recordedVideos.map((video, idx) => (
              <View key={video._id || `${video.url}-${idx}`} style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Pressable
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => {
                    if (video.url) {
                      navigation.navigate('VideoPlayer', {
                        videoUrl: video.url,
                        title: video.label || 'Recorded Lecture'
                      });
                    }
                  }}
                >
                  <View style={[styles.itemIconContainer, { backgroundColor: `${theme.danger}1A` }]}>
                    <Ionicons name="play-circle-outline" size={24} color={theme.danger} />
                  </View>
                  <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>{video.label || 'Recorded Lecture'}</Text>
                    <Text style={[styles.itemSubtitle, { color: theme.muted }]}>
                      Uploaded at {new Date(video.uploadedAt || Date.now()).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={theme.muted} />
                </Pressable>
                {canManage && (
                  <Pressable onPress={() => handleRemoveVideo(video._id)} style={styles.deleteMiniBtn}>
                    <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  </Pressable>
                )}
              </View>
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  outlineCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  outlineText: { fontSize: 14, lineHeight: 20 },
  teacherControls: { marginTop: 24, padding: 16, borderRadius: 18, borderWidth: 1 },
  controlsRow: { marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  actionBtnText: { fontWeight: '700', fontSize: 14 },
  completedInfo: { fontWeight: '600', fontSize: 14, textAlign: 'center' },
  addActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  addActionText: { fontSize: 11, fontWeight: '800' },
  inlineEditor: { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10 },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '800' },
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
  deleteMiniBtn: { padding: 8, marginLeft: 8 },
  emptyText: { fontSize: 14, fontStyle: 'italic', marginTop: 4 },
});
