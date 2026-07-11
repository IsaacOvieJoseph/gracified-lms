import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, Alert, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';

const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.topics)) return payload.topics;
    if (Array.isArray(payload.assignments)) return payload.assignments;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
  }

  return [];
};

export default function ClassroomDetailScreen({ route, navigation }) {
  const { classroomId } = route.params || {};
  const { user, setUser } = useAuth();
  const { theme } = useTheme();

  const [classroom, setClassroom] = useState(null);
  const [topics, setTopics] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('syllabus'); // 'syllabus', 'assignments', 'exams'
  const [actionLoading, setActionLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isTeacher = user?.role === 'teacher' || user?.role === 'personal_teacher' || user?.role === 'school_admin' || user?.role === 'root_admin';
  const canManageClassroom = () => {
    if (['root_admin', 'school_admin'].includes(user?.role)) return true;
    const teacherId = classroom?.teacherId?._id || classroom?.teacherId;
    return teacherId?.toString() === user?._id?.toString();
  };

  // Check enrollment
  const isEnrolled = isTeacher || classroom?.students?.some(
    studentId => (studentId?._id || studentId) === user?._id
  );

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const classroomRes = await api.get(`/classrooms/${classroomId}`);
      setClassroom(classroomRes.data?.classroom || classroomRes.data);

      if (classroomRes.data) {
        // Fetch topics, assignments and exams in parallel
        const [topicsRes, assignmentsRes, examsRes] = await Promise.all([
          api.get(`/topics/classroom/${classroomId}`),
          api.get(`/assignments/classroom/${classroomId}`),
          api.get(`/exams/class/${classroomId}`)
        ]);

        setTopics(normalizeListResponse(topicsRes.data));
        setAssignments(normalizeListResponse(assignmentsRes.data));
        setExams(normalizeListResponse(examsRes.data));
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load classroom details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (classroomId) {
      loadData();
    }
  }, [classroomId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (classroomId) {
        loadData(false);
      }
    });
    return unsubscribe;
  }, [navigation, classroomId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleEnrollOrPay = async () => {
    if (classroom?.isPaid) {
      // Initiate Paystack checkout
      setActionLoading(true);
      try {
        const amount = classroom.pricing?.amount || 0;
        const response = await api.post('/payments/paystack/initiate', {
          amount,
          classroomId: classroom._id,
          type: 'class_enrollment'
        });

        const { authorization_url, reference } = response.data;
        if (authorization_url) {
          navigation.navigate('PaystackWebView', {
            authorizationUrl: authorization_url,
            reference,
            classroomId: classroom._id
          });
        } else {
          Alert.alert('Checkout Error', 'Payment initiation failed: authorization URL missing.');
        }
      } catch (err) {
        Alert.alert('Checkout Error', err?.response?.data?.message || 'Failed to initiate payment.');
      } finally {
        setActionLoading(false);
      }
    } else {
      // Free classroom enrollment
      setActionLoading(true);
      try {
        await api.post(`/classrooms/${classroomId}/enroll`);
        setUser((currentUser) => ({
          ...currentUser,
          enrolledClasses: [...(currentUser?.enrolledClasses || []), classroomId],
        }));
        Alert.alert('Enrolled', 'You have successfully enrolled in this classroom!');
        loadData(false);
      } catch (err) {
        Alert.alert('Enrollment failed', err?.response?.data?.message || 'Failed to enroll.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleJoinWhiteboard = () => {
    navigation.navigate('Whiteboard', { classroomId });
  };

  const handleJoinQnA = () => {
    api.get(`/qna/classroom/${classroomId}`).then(res => {
      const qnaToken = res.data?.token || res.data?.[0]?.token || res.data?.board?.shareableLink;
      if (qnaToken) {
        navigation.navigate('QnACenter', { token: qnaToken, isPresenter: isTeacher });
      } else {
        Alert.alert('Q&A Board Unavailable', 'The Q&A Board has not been initialized for this classroom.');
      }
    }).catch(err => {
      Alert.alert('Q&A Board Info', 'No active Q&A board found for this classroom.');
    });
  };

  const handlePublishToggle = async () => {
    if (!classroom?._id) return;
    setPublishing(true);
    try {
      await api.put(`/classrooms/${classroom._id}/publish`, { published: !classroom.published });
      setClassroom((current) => ({ ...current, published: !current.published }));
      Alert.alert('Updated', `Classroom has been ${classroom.published ? 'unpublished' : 'published'}.`);
    } catch (err) {
      Alert.alert('Update failed', err?.response?.data?.message || 'Unable to update classroom status.');
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteClassroom = () => {
    if (!classroom?._id) return;
    Alert.alert(
      'Delete classroom',
      'Are you sure you want to delete this classroom? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete(`/classrooms/${classroom._id}`);
              Alert.alert('Deleted', 'Classroom has been removed.');
              navigation.goBack();
            } catch (err) {
              Alert.alert('Delete failed', err?.response?.data?.message || 'Unable to delete classroom.');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
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
        <Pressable style={[styles.backBtn, { backgroundColor: theme.border }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtnText, { color: theme.text }]}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{classroom?.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.subjectText, { color: theme.muted }]}>{classroom?.subject || 'Curriculum Subject'}</Text>
          <Text style={[styles.title, { color: theme.text }]}>{classroom?.name}</Text>
          <Text style={[styles.description, { color: theme.neutral }]}>{classroom?.description || 'No description provided.'}</Text>

          {classroom?.introVideo ? (
            <Pressable
              style={[styles.videoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={async () => {
                try {
                  const supported = await Linking.canOpenURL(classroom.introVideo);
                  if (supported) {
                    await Linking.openURL(classroom.introVideo);
                  } else {
                    Alert.alert('Cannot open video', 'This introductory video URL is invalid.');
                  }
                } catch (err) {
                  Alert.alert('Error', 'Unable to open the introductory video.');
                }
              }}
            >
              <View style={[styles.videoIconBox, { backgroundColor: theme.surfaceElevated }]}>
                <Ionicons name="play-circle-outline" size={24} color={theme.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.videoTitle, { color: theme.text }]}>Introductory video</Text>
                <Text style={[styles.videoSubtitle, { color: theme.muted }]}>Tap to watch the classroom intro</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={theme.muted} />
            </Pressable>
          ) : null}

          <View style={styles.metaRow}>
            <View style={[styles.metaBadge, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Ionicons name="ribbon-outline" size={14} color={theme.muted} />
              <Text style={[styles.metaBadgeText, { color: theme.muted }]}>{classroom?.level || 'All levels'}</Text>
            </View>
            <View style={[styles.metaBadge, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Ionicons name="people-outline" size={14} color={theme.muted} />
              <Text style={[styles.metaBadgeText, { color: theme.muted }]}>{classroom?.students?.length ?? 0} Enrolled</Text>
            </View>
            {classroom?.published !== undefined && (
              <View style={[
                styles.metaBadge,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                classroom.published
                  ? { backgroundColor: `${theme.success}1A`, borderColor: theme.success }
                  : { backgroundColor: `${theme.warning}1A`, borderColor: theme.warning }
              ]}>
                <Text style={[styles.metaBadgeText, { color: theme.muted }]}>{classroom.published ? 'Published' : 'Draft'}</Text>
              </View>
            )}
            {classroom?.isPrivate && (
              <View style={[styles.metaBadge, { backgroundColor: `${theme.warning}1A`, borderColor: theme.warning }]}>
                <Text style={[styles.metaBadgeText, { color: theme.muted }]}>Private</Text>
              </View>
            )}
          </View>

          {canManageClassroom() && (
            <View style={styles.managementRow}>
              <Pressable
                style={[styles.manageBtn, { backgroundColor: theme.primary }]}
                onPress={handlePublishToggle}
                disabled={publishing}
              >
                <Text style={[styles.manageBtnText, { color: theme.onPrimary }]}>{publishing ? 'Updating…' : classroom?.published ? 'Unpublish' : 'Publish'}</Text>
              </Pressable>
              <Pressable
                style={[styles.manageBtn, { backgroundColor: theme.danger }]}
                onPress={handleDeleteClassroom}
                disabled={deleting}
              >
                <Text style={[styles.manageBtnText, { color: theme.onPrimary }]}>{deleting ? 'Deleting…' : 'Delete class'}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Enrollment Gate */}
        {!isEnrolled ? (
          <View style={[styles.enrollGateCard, { backgroundColor: theme.surface, borderColor: theme.warning }]}>
            <Ionicons name="lock-closed-outline" size={40} color={theme.warning} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[styles.gateTitle, { color: theme.text }]}>Unlock learning space</Text>
            <Text style={[styles.gateSub, { color: theme.muted }]}>
              {classroom?.isPaid
                ? `This is a paid classroom. Secure payments are supported via Paystack.`
                : 'This is a free classroom. Enroll now to access learning materials.'}
            </Text>

            <Pressable
              style={[styles.enrollBtn, { backgroundColor: theme.primary }, actionLoading && { opacity: 0.7 }]}
              onPress={handleEnrollOrPay}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={[styles.enrollBtnText, { color: theme.onPrimary }]}>
                  {classroom?.isPaid
                    ? `Pay and enroll (NGN ${classroom.pricing?.amount?.toLocaleString()})`
                    : 'Enroll in Class'}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          // Enrolled features
          <View style={{ marginTop: 8 }}>
            {/* Live Session Links */}
            <View style={styles.liveLinksRow}>
              <Pressable style={[styles.liveBtn, { backgroundColor: theme.primary }]} onPress={handleJoinWhiteboard}>
                <Ionicons name="easel-outline" size={20} color={theme.onPrimary} />
                <Text style={[styles.liveBtnText, { color: theme.onPrimary }]}>Whiteboard</Text>
              </Pressable>

              <Pressable style={[styles.liveBtn, { backgroundColor: theme.success }]} onPress={handleJoinQnA}>
                <Ionicons name="chatbubbles-outline" size={20} color={theme.onPrimary} />
                <Text style={[styles.liveBtnText, { color: theme.onPrimary }]}>Q&A Board</Text>
              </Pressable>
            </View>

            {classroom?.students?.length > 0 && (
              <View style={[styles.enrolledSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Enrolled students</Text>
                <View style={styles.studentList}>
                  {classroom.students.slice(0, 5).map((student, index) => (
                    <Text key={student?._id || index} style={[styles.studentItem, { color: theme.neutral }]}>
                      • {student?.name || student?.email || 'Student'}</Text>
                  ))}
                  {classroom.students.length > 5 && (
                    <Text style={[styles.studentItem, { color: theme.neutral }]}>+ {classroom.students.length - 5} more students</Text>
                  )}
                </View>
              </View>
            )}

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {['syllabus', 'assignments', 'exams'].map(t => (
                <Pressable
                  key={t}
                  style={[styles.tabButton, activeTab === t && { backgroundColor: theme.text }]}
                  onPress={() => setActiveTab(t)}
                >
                  <Text style={[styles.tabText, { color: theme.muted }, activeTab === t && { color: theme.onPrimary }]}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* TAB CONTENTS */}
            {activeTab === 'syllabus' && (
              <View style={styles.tabContent}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Curriculum timeline</Text>
                {topics.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.muted }]}>No curriculum topics added yet.</Text>
                ) : (
                  topics.map((t, idx) => (
                    <Pressable
                      key={t._id || idx}
                      style={[styles.topicRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => navigation.navigate('TopicDetail', { topicId: t._id })}
                    >
                      <View style={[
                        styles.orderBadge,
                        t.status === 'completed'
                          ? { backgroundColor: theme.text }
                          : t.status === 'active'
                          ? { backgroundColor: theme.success }
                          : { backgroundColor: theme.border }
                      ]}>
                        <Text style={[styles.orderText, { color: theme.onPrimary }]}>{idx + 1}</Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.topicName, { color: theme.text }]}>{t.name}</Text>
                        <Text style={[styles.topicStatus, { color: theme.muted }]} numberOfLines={1}>
                          {t.status?.toUpperCase() || 'PENDING'} {t.recordedVideos?.length > 0 ? `• ${t.recordedVideos.length} recordings` : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {activeTab === 'assignments' && (
              <View style={styles.tabContent}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Class assignments</Text>
                {assignments.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.muted }]}>No assignments posted for this classroom.</Text>
                ) : (
                  assignments.map((a, idx) => (
                    <Pressable
                      key={a._id || idx}
                      style={[styles.assignmentRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => navigation.navigate('AssignmentDetail', { assignmentId: a._id })}
                    >
                      <View style={[styles.assignIconBox, { backgroundColor: theme.surfaceElevated }]}>
                        <Ionicons name="clipboard-outline" size={20} color={theme.text} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.topicName, { color: theme.text }]}>{a.title}</Text>
                        <Text style={[styles.topicStatus, { color: theme.muted }]}>
                          Max Score: {a.maxScore || 100} • {a.assignmentType?.toUpperCase()}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {activeTab === 'exams' && (
              <View style={styles.tabContent}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Scheduled exams</Text>
                {exams.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.muted }]}>No exams scheduled for this classroom.</Text>
                ) : (
                  exams.map((e, idx) => (
                    <Pressable
                      key={e._id || idx}
                      style={[styles.assignmentRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => {
                        if (e.linkToken) {
                          navigation.navigate('ExamCenter', { token: e.linkToken });
                        } else {
                          Alert.alert('Draft Exam', 'This exam is not active yet.');
                        }
                      }}
                    >
                      <View style={[styles.assignIconBox, { backgroundColor: `${theme.success}1A` }]}>
                        <Ionicons name="journal-outline" size={20} color={theme.success} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.topicName, { color: theme.text }]}>{e.title}</Text>
                        <Text style={[styles.topicStatus, { color: theme.muted }]}>
                          Duration: {e.duration || 60} mins • {e.accessMode?.toUpperCase()}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  backBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText: { fontWeight: '700' },
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
  heroCard: { borderRadius: 24, padding: 20, borderWidth: 1, marginBottom: 16 },
  subjectText: { fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '850', marginTop: 8, marginBottom: 12 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  metaRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  metaBadgeText: { fontSize: 12, fontWeight: '700' },
  managementRow: { flexDirection: 'row', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  manageBtn: { flex: 1, minWidth: 120, paddingVertical: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  manageBtnText: { fontSize: 13, fontWeight: '800' },
  enrolledSection: { marginTop: 14, borderRadius: 20, padding: 16, borderWidth: 1 },
  studentList: { marginTop: 10 },
  studentItem: { fontSize: 13, lineHeight: 20, marginBottom: 4 },
  enrollGateCard: { borderRadius: 24, padding: 24, borderStyle: 'dashed', borderWidth: 1.5, marginTop: 8 },
  gateTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  gateSub: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  enrollBtn: { borderRadius: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  enrollBtnText: { fontWeight: '800', fontSize: 14 },
  liveLinksRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  liveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 16 },
  liveBtnText: { fontWeight: '700', fontSize: 13 },
  tabContainer: { flexDirection: 'row', padding: 4, borderRadius: 14, marginTop: 16, borderWidth: 1 },
  tabButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, minWidth: 80, borderRadius: 11, alignItems: 'center' },
  tabText: { fontSize: 11, fontWeight: '800' },
  tabContent: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  topicRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, marginBottom: 10, borderWidth: 1 },
  orderBadge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  orderText: { fontSize: 14, fontWeight: '800' },
  topicName: { fontSize: 14, fontWeight: '750' },
  topicStatus: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  videoCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, marginTop: 16 },
  videoIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  videoTitle: { fontSize: 14, fontWeight: '700' },
  videoSubtitle: { fontSize: 12, marginTop: 4 },
  assignmentRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, marginBottom: 10, borderWidth: 1 },
  assignIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, fontStyle: 'italic', paddingLeft: 4 },
});
