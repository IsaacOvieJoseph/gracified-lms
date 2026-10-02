import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, Alert, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import { canManageClassroom, canViewClassroomContent } from '../../utils/roles';
import { shareClassroomLink, shareExamLink } from '../../utils/links';

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
  const [activeCall, setActiveCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('syllabus'); // 'syllabus', 'assignments', 'exams'
  const [actionLoading, setActionLoading] = useState(false);
  const [lectureLoading, setLectureLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const canManage = canManageClassroom(user, classroom);
  const canViewStaffContent = canViewClassroomContent(user, classroom);

  // Check enrollment
  const isEnrolled = canViewStaffContent || classroom?.students?.some(
    studentId => (studentId?._id || studentId) === user?._id
  );

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const classroomRes = await api.get(`/classrooms/${classroomId}`);
      const loadedClassroom = classroomRes.data?.classroom || classroomRes.data;
      setClassroom(loadedClassroom);
      const loadedCanManage = canManageClassroom(user, loadedClassroom);

      if (classroomRes.data) {
        // Fetch topics, assignments and exams in parallel
        const [topicsRes, assignmentsRes, examsRes] = await Promise.all([
          api.get(`/topics/classroom/${classroomId}`),
          api.get(`/assignments/classroom/${classroomId}`),
          api.get(`/exams/class/${classroomId}`)
        ]);

        setTopics(normalizeListResponse(topicsRes.data));
        const loadedAssignments = normalizeListResponse(assignmentsRes.data);
        const loadedExams = normalizeListResponse(examsRes.data);
        setAssignments(loadedCanManage ? loadedAssignments : loadedAssignments.filter((item) => item.published !== false));
        setExams(loadedCanManage ? loadedExams : loadedExams.filter((item) => item.isPublished === true));

        try {
          const callRes = await api.get(`/classrooms/${classroomId}/call`);
          setActiveCall(callRes.data || null);
        } catch (callErr) {
          setActiveCall(null);
        }
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

  // AI results can be routed directly into the matching classroom action,
  // mirroring the web assistant's "Apply to form" behavior.
  useEffect(() => {
    const aiResult = route?.params?.aiResult;
    const aiAction = route?.params?.aiAction;
    if (!aiResult || !aiAction || !classroom) return;

    if (aiAction === 'topic' || aiAction === 'syllabus') {
      navigation.navigate('TopicForm', { classroomId, aiResult, aiAction });
    } else if (aiAction === 'assignment') {
      navigation.navigate('AssignmentForm', { classroomId, aiResult, aiAction });
    } else if (aiAction === 'exam') {
      navigation.navigate('ExamForm', { classId: classroomId, aiResult, aiAction });
    }
    navigation.setParams({ aiAction: undefined, aiResult: undefined });
  }, [classroom, navigation, route?.params?.aiAction, route?.params?.aiResult, classroomId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleEnrollOrPay = async () => {
    if (classroom?.isPaid) {
      Alert.alert(
        'Paid enrollment',
        'This classroom requires paid enrollment. Complete payment on the Gracified website and your access will appear here automatically.'
      );
      return;
    }
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
  };

  const handleJoinWhiteboard = () => {
    navigation.navigate('Whiteboard', { classroomId });
  };

  const openQnABoard = (token) => {
    if (!token) {
      Alert.alert('Q&A Board Unavailable', 'Could not open the Q&A board.');
      return;
    }
    // Everyone enters the question board. Authorized staff can switch to
    // presentation mode from the board's role-gated web control.
    navigation.navigate('QnACenter', { token });
  };

  const createQnABoard = async () => {
    const response = await api.post('/qna/board', {
      title: `${classroom?.name || 'Class'} Q&A`,
      description: 'Live Q&A board for this classroom',
      classroomId,
      isPublic: false,
      allowAnonymous: false,
    });
    const board = response.data;
    return board?.shareableLink || board?._id;
  };

  const handleJoinQnA = async () => {
    try {
      const res = await api.get(`/qna/classroom/${classroomId}`);
      const boards = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      const activeBoard = boards.find((b) => b?.isActive !== false) || boards[0];
      const qnaToken = activeBoard?.shareableLink || activeBoard?._id || activeBoard?.token;

      if (qnaToken) {
        openQnABoard(qnaToken);
        return;
      }

      if (!canManage) {
        Alert.alert('Q&A Board Unavailable', 'The Q&A Board has not been initialized for this classroom.');
        return;
      }

      Alert.alert(
        'Start Q&A',
        'No Q&A board exists yet. Create one for this classroom?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create & Open',
            onPress: async () => {
              try {
                const token = await createQnABoard();
                openQnABoard(token);
              } catch (err) {
                Alert.alert('Q&A Error', err?.response?.data?.message || 'Failed to create Q&A board.');
              }
            },
          },
        ]
      );
    } catch (err) {
      if (canManage) {
        Alert.alert(
          'Start Q&A',
          'Could not load existing boards. Create a new Q&A board?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Create & Open',
              onPress: async () => {
                try {
                  const token = await createQnABoard();
                  openQnABoard(token);
                } catch (createErr) {
                  Alert.alert('Q&A Error', createErr?.response?.data?.message || 'Failed to create Q&A board.');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Q&A Board Info', 'No active Q&A board found for this classroom.');
      }
    }
  };

  const openLectureLink = async (link) => {
    if (!link) {
      Alert.alert('Lecture unavailable', 'No lecture link is available yet.');
      return;
    }
    try {
      // Direct opening for web/http links is safer on Android 11+ and iOS 9+
      if (link.startsWith('http://') || link.startsWith('https://')) {
        await Linking.openURL(link);
      } else {
        const supported = await Linking.canOpenURL(link);
        if (supported) {
          await Linking.openURL(link);
        } else {
          Alert.alert('Cannot open lecture', 'The lecture link is invalid.');
        }
      }
    } catch (err) {
      Alert.alert('Cannot open lecture', 'Unable to open the lecture link.');
    }
  };

  const startLecture = async (isPaid = false, amount = 0) => {
    setLectureLoading(true);
    try {
      const response = await api.post(`/classrooms/${classroomId}/call/start`, { isPaid, amount });
      const callData = response.data || {};
      setActiveCall(callData);
      await openLectureLink(callData.link);
    } catch (err) {
      if (err?.response?.data?.googleAuthRequired) {
        Alert.alert('Google authorization required', 'Please authorize Google Meet from the web dashboard before starting a lecture.');
      } else {
        Alert.alert('Lecture Error', err?.response?.data?.message || 'Unable to start lecture.');
      }
    } finally {
      setLectureLoading(false);
    }
  };

  const handleStartLecture = () => {
    startLecture(!!classroom?.isPaid, Number(classroom?.pricing?.amount || 0));
  };

  const handleAttendLecture = async () => {
    setLectureLoading(true);
    try {
      const response = await api.get(`/classrooms/${classroomId}/call`);
      const callData = response.data || {};
      setActiveCall(callData);

      if (callData.isPaid && !callData.hasPaid && user?.role === 'student') {
        Alert.alert(
          'Paid lecture',
          'This lecture requires paid access. Complete payment on the Gracified website, then try joining again.'
        );
        return;
      }

      if (user?.role === 'student') {
        try {
          await api.post(`/classrooms/${classroomId}/call/attend`);
        } catch (attendErr) {
          console.log('Failed to mark attendance:', attendErr?.message || attendErr);
        }
      }
      await openLectureLink(callData.link);
    } catch (err) {
      Alert.alert('Lecture unavailable', err?.response?.data?.message || 'No active lecture found.');
    } finally {
      setLectureLoading(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!classroom?._id) return;
    setShowActions(false);
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
    setShowActions(false);
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

  const openEditClassroom = () => {
    if (!classroom) return;
    setShowActions(false);
    navigation.navigate('CreateClassroom', { mode: 'edit', classroomId });
  };

  // â”€â”€ Create Topic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openTopicEditor = (topic) => {
    navigation.navigate('TopicForm', { classroomId, topic });
  };

  const moveTopic = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= topics.length) return;

    const previousTopics = topics;
    const reorderedTopics = [...topics];
    [reorderedTopics[index], reorderedTopics[targetIndex]] = [reorderedTopics[targetIndex], reorderedTopics[index]];
    setTopics(reorderedTopics);

    try {
      await api.put('/topics/reorder', { orderedIds: reorderedTopics.map(topic => topic._id) });
    } catch (err) {
      setTopics(previousTopics);
      Alert.alert('Reorder failed', err?.response?.data?.message || 'Unable to save the topic order.');
    }
  };

  const deleteTopic = (topic) => {
    Alert.alert(
      'Delete topic?',
      `This will permanently delete "${topic.name}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/topics/${topic._id}`);
              setTopics(prev => prev.filter(item => item._id !== topic._id));
              Alert.alert('Deleted', 'Topic deleted successfully.');
            } catch (err) {
              Alert.alert('Delete failed', err?.response?.data?.message || 'Unable to delete this topic.');
            }
          },
        },
      ]
    );
  };

  // â”€â”€ Assignment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openAssignmentEditor = (assignment) => {
    navigation.navigate('AssignmentForm', { classroomId, assignment });
  };

  const toggleAssignmentPublished = async (assignment) => {
    try {
      const published = assignment.published === false;
      const res = await api.put(`/assignments/${assignment._id}/publish`, { published });
      setAssignments((prev) => prev.map((item) => item._id === assignment._id ? (res.data?.assignment || { ...item, published }) : item));
    } catch (err) {
      Alert.alert('Update failed', err?.response?.data?.message || 'Unable to update assignment status.');
    }
  };

  const deleteAssignment = (assignment) => Alert.alert('Delete assignment?', 'This will permanently remove the assignment.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api.delete(`/assignments/${assignment._id}`); setAssignments((prev) => prev.filter((item) => item._id !== assignment._id)); }
      catch (err) { Alert.alert('Delete failed', err?.response?.data?.message || 'Unable to delete assignment.'); }
    } },
  ]);

  // â”€â”€ Exam â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openExamEditor = (exam) => {
    navigation.navigate('ExamForm', { classId: classroomId, exam });
  };

  const toggleExamPublished = async (exam) => {
    try {
      const isPublished = exam.isPublished === false;
      const res = await api.put(`/exams/${exam._id}`, { isPublished });
      setExams((prev) => prev.map((item) => item._id === exam._id ? (res.data?.exam || { ...item, isPublished }) : item));
    } catch (err) { Alert.alert('Update failed', err?.response?.data?.message || 'Unable to update exam status.'); }
  };

  const deleteExam = (exam) => Alert.alert('Delete exam?', 'This will permanently remove the exam.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.delete(`/exams/${exam._id}`); setExams((prev) => prev.filter((item) => item._id !== exam._id)); } catch (err) { Alert.alert('Delete failed', err?.response?.data?.message || 'Unable to delete exam.'); } } },
  ]);

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
        {canManage ? (
          <Pressable onPress={() => setShowActions((current) => !current)} style={styles.iconButton}>
            <Ionicons name="ellipsis-vertical" size={22} color={theme.text} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {canManage && showActions && (
        <View style={[styles.actionMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            style={styles.actionMenuItem}
            onPress={() => {
              setShowActions(false);
              shareClassroomLink(classroom);
            }}
          >
            <Ionicons name="share-outline" size={18} color={theme.text} />
            <Text style={[styles.actionMenuText, { color: theme.text }]}>Share Class Link</Text>
          </Pressable>
          <Pressable style={styles.actionMenuItem} onPress={openEditClassroom}>
            <Ionicons name="create-outline" size={18} color={theme.text} />
            <Text style={[styles.actionMenuText, { color: theme.text }]}>Edit</Text>
          </Pressable>
          <Pressable style={styles.actionMenuItem} onPress={handlePublishToggle} disabled={publishing}>
            <Ionicons name={classroom?.published ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.text} />
            <Text style={[styles.actionMenuText, { color: theme.text }]}>{publishing ? 'Updating...' : classroom?.published ? 'Unpublish' : 'Publish'}</Text>
          </Pressable>
          <Pressable style={styles.actionMenuItem} onPress={handleDeleteClassroom} disabled={deleting}>
            <Ionicons name="trash-outline" size={18} color={theme.danger} />
            <Text style={[styles.actionMenuText, { color: theme.danger }]}>{deleting ? 'Deleting...' : 'Delete'}</Text>
          </Pressable>
        </View>
      )}

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
              onPress={() => {
                navigation.navigate('VideoPlayer', {
                  videoUrl: classroom.introVideo,
                  title: (classroom.name || 'Classroom') + ' - Intro Video'
                });
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

          {false && canManage && (
            <View style={styles.managementRow}>
              <Pressable
                style={[styles.manageBtn, { backgroundColor: theme.primary }]}
                onPress={handlePublishToggle}
                disabled={publishing}
              >
                <Text style={[styles.manageBtnText, { color: theme.onPrimary }]}>{publishing ? 'Updatingâ€¦' : classroom?.published ? 'Unpublish' : 'Publish'}</Text>
              </Pressable>
              <Pressable
                style={[styles.manageBtn, { backgroundColor: theme.danger }]}
                onPress={handleDeleteClassroom}
                disabled={deleting}
              >
                <Text style={[styles.manageBtnText, { color: theme.onPrimary }]}>{deleting ? 'Deletingâ€¦' : 'Delete class'}</Text>
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
                ? 'This classroom requires paid enrollment. Complete payment on the Gracified website and your access will appear here automatically.'
                : 'This is a free classroom. Enroll now to access learning materials.'}
            </Text>

            {!classroom?.isPaid && (
              <Pressable
                style={[styles.enrollBtn, { backgroundColor: theme.primary }, actionLoading && { opacity: 0.7 }]}
                onPress={handleEnrollOrPay}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <Text style={[styles.enrollBtnText, { color: theme.onPrimary }]}>
                    Enroll in Class
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        ) : (
          // Enrolled features
          <View style={{ marginTop: 8 }}>
            <View style={[styles.lectureCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.lectureHeader}>
                <View style={[styles.lectureIcon, { backgroundColor: `${theme.info}1A` }]}>
                  <Ionicons name="videocam-outline" size={22} color={theme.info} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.lectureTitle, { color: theme.text }]}>{activeCall?.link ? 'Lecture is live' : 'Live lecture'}</Text>
                  <Text style={[styles.lectureSub, { color: theme.muted }]}>
                    {activeCall?.startedAt
                      ? `Started ${new Date(activeCall.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : canManage
                        ? 'Start a Google Meet lecture for this class.'
                        : 'Join once your instructor starts the lecture.'}
                  </Text>
                </View>
              </View>

              <Pressable
                style={[styles.lectureBtn, { backgroundColor: theme.primary }, lectureLoading && { opacity: 0.7 }]}
                onPress={canManage ? handleStartLecture : handleAttendLecture}
                disabled={lectureLoading}
              >
                {lectureLoading ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <>
                    <Ionicons name={canManage ? 'radio-outline' : 'enter-outline'} size={18} color={theme.onPrimary} />
                    <Text style={[styles.lectureBtnText, { color: theme.onPrimary }]}>
                      {canManage ? (activeCall?.link ? 'Open / Restart Lecture' : 'Start Lecture') : 'Attend Lecture'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Live Session Links */}
            <View style={styles.liveLinksRow}>
              <Pressable style={[styles.liveBtn, { backgroundColor: theme.primary }]} onPress={handleJoinWhiteboard}>
                <Ionicons name="easel-outline" size={20} color={theme.onPrimary} />
                <Text style={[styles.liveBtnText, { color: theme.onPrimary }]}>Whiteboard</Text>
              </Pressable>

              <Pressable style={[styles.liveBtn, { backgroundColor: theme.primary }]} onPress={handleJoinQnA}>
                <Ionicons name="chatbubbles-outline" size={20} color={theme.onPrimary} />
                <Text style={[styles.liveBtnText, { color: theme.onPrimary }]}>
                  {canManage ? 'Start / Open Q&A' : 'Q&A Board'}
                </Text>
              </Pressable>
            </View>

            {canManage && classroom?.students?.length > 0 && (
              <View style={[styles.enrolledSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Enrolled students</Text>
                <View style={styles.studentList}>
                  {classroom.students.slice(0, 5).map((student, index) => (
                    <Text key={student?._id || index} style={[styles.studentItem, { color: theme.neutral }]}>
                      â€¢ {student?.name || student?.email || 'Student'}</Text>
                  ))}
                  {classroom.students.length > 5 && (
                    <Text style={[styles.studentItem, { color: theme.neutral }]}>+ {classroom.students.length - 5} more students</Text>
                  )}
                </View>
              </View>
            )}

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              {['syllabus', 'assignments', 'exams'].map(t => (
                <Pressable
                  key={t}
                  style={[
                    styles.tabButton,
                    activeTab === t && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setActiveTab(t)}
                >
                  <Text style={[
                    styles.tabText,
                    { color: theme.muted },
                    activeTab === t && { color: theme.onPrimary },
                  ]}>
                    {t === 'syllabus' ? 'Topics' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* TAB CONTENTS */}
            {activeTab === 'syllabus' && (
              <View style={styles.tabContent}>
                <View style={styles.tabSectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Curriculum timeline</Text>
                  {canManage && (
                    <Pressable style={[styles.tabAddBtn, { backgroundColor: `${theme.primary}20` }]} onPress={() => navigation.navigate('TopicForm', { classroomId })}>
                      <Ionicons name="add-outline" size={16} color={theme.primary} />
                      <Text style={[styles.tabAddBtnText, { color: theme.primary }]}>Add Topic</Text>
                    </Pressable>
                  )}
                </View>
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
                          ? { backgroundColor: theme.primary }
                          : t.status === 'active'
                          ? { backgroundColor: theme.success }
                          : { backgroundColor: theme.border }
                      ]}>
                        <Text style={[
                          styles.orderText,
                          {
                            color: t.status === 'completed'
                              ? theme.onPrimary
                              : t.status === 'active'
                                ? theme.onPrimary
                                : theme.muted,
                          },
                        ]}>{idx + 1}</Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.topicName, { color: theme.text }]}>{t.name}</Text>
                        <Text style={[styles.topicStatus, { color: theme.muted }]} numberOfLines={1}>
                          {t.status?.toUpperCase() || 'PENDING'} {t.recordedVideos?.length > 0 ? `â€¢ ${t.recordedVideos.length} recordings` : ''}
                        </Text>
                      </View>
                      {canManage && (
                        <View style={styles.topicActions}>
                          <Pressable
                            style={styles.topicActionButton}
                            onPress={(event) => { event.stopPropagation?.(); openTopicEditor(t); }}
                            hitSlop={6}
                          >
                            <Ionicons name="create-outline" size={17} color={theme.primary} />
                          </Pressable>
                          <Pressable
                            style={styles.topicActionButton}
                            onPress={(event) => { event.stopPropagation?.(); moveTopic(idx, -1); }}
                            disabled={idx === 0}
                            hitSlop={6}
                          >
                            <Ionicons name="chevron-up-outline" size={17} color={idx === 0 ? theme.border : theme.muted} />
                          </Pressable>
                          <Pressable
                            style={styles.topicActionButton}
                            onPress={(event) => { event.stopPropagation?.(); moveTopic(idx, 1); }}
                            disabled={idx === topics.length - 1}
                            hitSlop={6}
                          >
                            <Ionicons name="chevron-down-outline" size={17} color={idx === topics.length - 1 ? theme.border : theme.muted} />
                          </Pressable>
                          <Pressable
                            style={styles.topicActionButton}
                            onPress={(event) => { event.stopPropagation?.(); deleteTopic(t); }}
                            hitSlop={6}
                          >
                            <Ionicons name="trash-outline" size={17} color={theme.danger} />
                          </Pressable>
                        </View>
                      )}
                      <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {activeTab === 'assignments' && (
              <View style={styles.tabContent}>
                <View style={styles.tabSectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Class assignments</Text>
                  {canManage && (
                    <Pressable style={[styles.tabAddBtn, { backgroundColor: `${theme.primary}20` }]} onPress={() => navigation.navigate('AssignmentForm', { classroomId })}>
                      <Ionicons name="add-outline" size={16} color={theme.primary} />
                      <Text style={[styles.tabAddBtnText, { color: theme.primary }]}>Add Assignment</Text>
                    </Pressable>
                  )}
                </View>
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
                          Max Score: {a.maxScore || 100} â€¢ {a.assignmentType?.toUpperCase()}
                        </Text>
                      </View>
                      {canManage ? <View style={styles.examRowRight}>
                        <Pressable style={styles.examShareBtn} onPress={(event) => { event.stopPropagation?.(); openAssignmentEditor(a); }}><Ionicons name="create-outline" size={17} color={theme.primary} /></Pressable>
                        <Pressable style={styles.examShareBtn} onPress={(event) => { event.stopPropagation?.(); toggleAssignmentPublished(a); }}><Ionicons name={a.published === false ? 'eye-outline' : 'eye-off-outline'} size={17} color={a.published === false ? theme.warning : theme.success} /></Pressable>
                        <Pressable style={styles.examShareBtn} onPress={(event) => { event.stopPropagation?.(); deleteAssignment(a); }}><Ionicons name="trash-outline" size={17} color={theme.danger} /></Pressable>
                      </View> : <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />}
                    </Pressable>
                  ))
                )}
              </View>
            )}

            {activeTab === 'exams' && (
              <View style={styles.tabContent}>
                <View style={styles.tabSectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Scheduled exams</Text>
                  {canManage && (
                    <Pressable style={[styles.tabAddBtn, { backgroundColor: `${theme.primary}20` }]} onPress={() => navigation.navigate('ExamForm', { classId: classroomId })}>
                      <Ionicons name="add-outline" size={16} color={theme.primary} />
                      <Text style={[styles.tabAddBtnText, { color: theme.primary }]}>Add Exam</Text>
                    </Pressable>
                  )}
                </View>
                {exams.length === 0 ? (
                  <Text style={[styles.emptyText, { color: theme.muted }]}>No exams scheduled for this classroom.</Text>
                ) : (
                  exams.map((e, idx) => (
                    <Pressable
                      key={e._id || idx}
                      style={[styles.assignmentRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => {
                        if (canManage) {
                          navigation.navigate('ExamDetail', { examId: e._id });
                        } else if (e.linkToken) {
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
                          Duration: {e.duration || 60} mins Â· {e.accessMode?.toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.examRowRight}>
                        {canManage && (
                          <>
                            <Pressable
                              style={styles.examShareBtn}
                              onPress={(event) => {
                                event.stopPropagation?.();
                                shareExamLink(e);
                              }}
                            >
                              <Ionicons name="share-outline" size={16} color={theme.primary} />
                            </Pressable>
                            <Pressable style={styles.examShareBtn} onPress={(event) => { event.stopPropagation?.(); openExamEditor(e); }}><Ionicons name="create-outline" size={16} color={theme.primary} /></Pressable>
                            <Pressable style={styles.examShareBtn} onPress={(event) => { event.stopPropagation?.(); toggleExamPublished(e); }}><Ionicons name={e.isPublished ? 'eye-off-outline' : 'eye-outline'} size={16} color={e.isPublished ? theme.success : theme.warning} /></Pressable>
                            <Pressable style={styles.examShareBtn} onPress={(event) => { event.stopPropagation?.(); deleteExam(e); }}><Ionicons name="trash-outline" size={16} color={theme.danger} /></Pressable>
                            <View style={[styles.miniStatusBadge, { backgroundColor: e.isPublished ? `${theme.success}20` : `${theme.warning}20` }]}>
                              <Text style={[styles.miniStatusText, { color: e.isPublished ? theme.success : theme.warning }]}>
                                {e.isPublished ? 'Live' : 'Draft'}
                              </Text>
                            </View>
                          </>
                        )}
                        <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
                      </View>
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
  actionMenu: { marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderRadius: 16, paddingVertical: 6 },
  actionMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  actionMenuText: { fontSize: 13, fontWeight: '800' },
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
  lectureCard: { borderRadius: 20, padding: 16, borderWidth: 1, marginTop: 8, marginBottom: 10 },
  lectureHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  lectureIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  lectureTitle: { fontSize: 15, fontWeight: '800' },
  lectureSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  lectureBtn: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  lectureBtnText: { fontSize: 13, fontWeight: '800' },
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
  topicActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 6 },
  topicActionButton: { padding: 5 },
  videoCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, marginTop: 16 },
  videoIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  videoTitle: { fontSize: 14, fontWeight: '700' },
  videoSubtitle: { fontSize: 12, marginTop: 4 },
  assignmentRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, marginBottom: 10, borderWidth: 1 },
  assignIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, fontStyle: 'italic', paddingLeft: 4 },
  tabSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tabAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  tabAddBtnText: { fontSize: 12, fontWeight: '700' },
  examRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  examShareBtn: { padding: 4 },
  miniStatusBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  miniStatusText: { fontSize: 10, fontWeight: '800' },
});
