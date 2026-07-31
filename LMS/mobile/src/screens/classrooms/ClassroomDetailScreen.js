import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable, Alert, RefreshControl, Linking, TextInput, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import { canManageClassroom, canViewClassroomContent } from '../../utils/roles';
import { shareClassroomLink, shareExamLink } from '../../utils/links';
import DateTimePicker from '../../components/ui/DateTimePicker';
import SelectField from '../../components/ui/SelectField';

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    subject: '',
    level: 'Other',
    pricing: { amount: 0, type: 'one_time' },
    isPaid: false,
    isPrivate: false,
    published: true,
    capacity: 30,
    schedule: [],
  });

  // ── Topic creation ──────────────────────────────────────────
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicForm, setTopicForm] = useState({ name: '', description: '' });
  const [editingTopic, setEditingTopic] = useState(null);
  const [pendingTopicBatch, setPendingTopicBatch] = useState(null);
  const [topicLoading, setTopicLoading] = useState(false);

  // ── Assignment creation ──────────────────────────────────────
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    title: '', description: '', assignmentType: 'mcq', dueDate: '', publishResultsAt: '',
    maxScore: '100', published: true, questions: [{ questionText: '', options: ['', '', '', ''], correctOption: '', maxScore: '1' }]
  });
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [assignLoading, setAssignLoading] = useState(false);

  // ── Exam creation ─────────────────────────────────────────────
  const [showExamModal, setShowExamModal] = useState(false);
  const [examForm, setExamForm] = useState({
    title: '', description: '', duration: '60', accessMode: 'registered', dueDate: '', resultPublishTime: ''
  });
  const [examQuestions, setExamQuestions] = useState([{ questionText: '', questionType: 'mcq', options: ['', '', '', ''], correctOption: '', maxScore: '1' }]);
  const [examLoading, setExamLoading] = useState(false);
  const [editingExam, setEditingExam] = useState(null);

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

    if (aiAction === 'topic') {
      setTopicForm({
        name: aiResult.name || '',
        description: aiResult.description || '',
      });
      setShowTopicModal(true);
    } else if (aiAction === 'assignment') {
      setAssignForm((prev) => ({
        ...prev,
        title: aiResult.title || prev.title,
        description: aiResult.description || prev.description,
        maxScore: String(aiResult.maxScore || prev.maxScore),
        assignmentType: aiResult.questions?.[0]?.options?.length ? 'mcq' : 'theory',
        questions: aiResult.questions?.length ? aiResult.questions.map((question) => ({
          questionText: question.questionText || '',
          options: question.options || ['', '', '', ''],
          correctOption: question.correctOption || (typeof question.correctOptionIndex === 'number' ? question.options?.[question.correctOptionIndex] || '' : ''),
          maxScore: String(question.maxScore || '1'),
        })) : prev.questions,
      }));
      setShowAssignmentModal(true);
    } else if (aiAction === 'exam') {
      setExamForm((prev) => ({
        ...prev,
        title: aiResult.title || prev.title,
        description: aiResult.description || prev.description,
        duration: String(aiResult.duration || prev.duration),
      }));
      setExamQuestions((prev) => aiResult.questions?.length ? aiResult.questions.map((question) => ({
        questionText: question.questionText || '',
        questionType: question.questionType || (question.options?.length ? 'mcq' : 'theory'),
        options: question.options || ['', '', '', ''],
        correctOption: question.correctOption || (typeof question.correctOptionIndex === 'number' ? question.options?.[question.correctOptionIndex] || '' : ''),
        maxScore: String(question.maxScore || '1'),
      })) : prev);
      setShowExamModal(true);
    } else if (aiAction === 'syllabus') {
      const topicsToCreate = (aiResult.topics || []).filter((topic) => topic?.name);
      const firstTopic = topicsToCreate[0];
      if (firstTopic) {
        setPendingTopicBatch(topicsToCreate);
        setTopicForm({ name: firstTopic.name || '', description: firstTopic.description || '' });
        setShowTopicModal(true);
      }
    }
    navigation.setParams({ aiAction: undefined, aiResult: undefined });
  }, [classroom, navigation, route?.params?.aiAction, route?.params?.aiResult]);

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
    const defaultAmount = Number(classroom?.pricing?.amount || 0);
    if (classroom?.pricing?.type === 'per_lecture' && defaultAmount > 0) {
      Alert.alert(
        'Start lecture',
        `Start this lecture as paid access for NGN ${defaultAmount.toLocaleString()} or free access?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Free', onPress: () => startLecture(false, 0) },
          { text: 'Paid', onPress: () => startLecture(true, defaultAmount) },
        ]
      );
      return;
    }
    startLecture(false, 0);
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
          `This lecture costs NGN ${Number(callData.amount || 0).toLocaleString()}.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Pay',
              onPress: async () => {
                try {
                  const payRes = await api.post('/payments/paystack/initiate', {
                    amount: callData.amount || 0,
                    classroomId,
                    callSessionId: callData.callId,
                    type: 'lecture_access',
                  });
                  const { authorization_url, reference } = payRes.data || {};
                  if (authorization_url) {
                    navigation.navigate('PaystackWebView', {
                      authorizationUrl: authorization_url,
                      reference,
                      classroomId,
                      callSessionId: callData.callId,
                      type: 'lecture_access',
                    });
                  } else {
                    Alert.alert('Checkout Error', 'Payment initiation failed: authorization URL missing.');
                  }
                } catch (payErr) {
                  Alert.alert('Checkout Error', payErr?.response?.data?.message || 'Unable to start lecture payment.');
                }
              }
            }
          ]
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
    setEditFormData({
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
      schedule: Array.isArray(classroom.schedule) ? classroom.schedule : [],
    });
    setShowEditModal(true);
  };

  const addEditScheduleSlot = () => {
    setEditFormData((prev) => ({
      ...prev,
      schedule: [...(prev.schedule || []), { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00' }],
    }));
  };

  const removeEditScheduleSlot = (index) => {
    setEditFormData((prev) => ({
      ...prev,
      schedule: (prev.schedule || []).filter((_, i) => i !== index),
    }));
  };

  const updateEditScheduleSlot = (index, field, value) => {
    setEditFormData((prev) => ({
      ...prev,
      schedule: (prev.schedule || []).map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)),
    }));
  };

  const handleUpdateClassroom = async () => {
    if (!classroom?._id) return;
    if (!editFormData.name.trim()) {
      Alert.alert('Missing title', 'Please provide a classroom name.');
      return;
    }

    setEditLoading(true);
    try {
      const payload = {
        name: editFormData.name,
        description: editFormData.description,
        subject: editFormData.subject,
        level: editFormData.level,
        isPaid: editFormData.isPaid && editFormData.pricing.amount > 0,
        pricing: { ...editFormData.pricing },
        isPrivate: editFormData.isPrivate,
        published: editFormData.published,
        capacity: Number(editFormData.capacity) || 30,
        schedule: editFormData.schedule || [],
      };

      const response = await api.put(`/classrooms/${classroom._id}`, payload);
      const updatedClassroom = response.data?.classroom || response.data;
      setClassroom((current) => ({ ...current, ...updatedClassroom }));
      setShowEditModal(false);
      Alert.alert('Updated', 'Classroom details saved.');
    } catch (err) {
      Alert.alert('Update failed', err?.response?.data?.message || 'Unable to update classroom.');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Create Topic ─────────────────────────────────────────────
  const handleCreateTopic = async () => {
    if (!topicForm.name.trim()) {
      Alert.alert('Missing name', 'Please enter a topic name.');
      return;
    }
    setTopicLoading(true);
    try {
      if (editingTopic) {
        const response = await api.put(`/topics/${editingTopic._id}`, {
          name: topicForm.name.trim(),
          description: topicForm.description.trim(),
        });
        const updatedTopic = response.data?.topic || response.data;
        setTopics(prev => prev.map(topic => topic._id === editingTopic._id ? { ...topic, ...updatedTopic } : topic));
        setShowTopicModal(false);
        setEditingTopic(null);
        setTopicForm({ name: '', description: '' });
        Alert.alert('Updated', 'Topic details saved.');
        return;
      }

      const batch = pendingTopicBatch?.length
        ? [{ name: topicForm.name, description: topicForm.description }, ...pendingTopicBatch.slice(1)]
        : [{ name: topicForm.name, description: topicForm.description }];
      const created = await Promise.all(batch.map((topic, index) => api.post('/topics', {
        name: topic.name,
        description: topic.description || '',
        classroomId,
        order: topics.length + index,
      })));
      setTopics(prev => [...prev, ...created.map((res) => res.data?.topic || res.data)]);
      setShowTopicModal(false);
      setEditingTopic(null);
      setTopicForm({ name: '', description: '' });
      setPendingTopicBatch(null);
      Alert.alert('Created!', `${created.length} topic${created.length === 1 ? '' : 's'} added to curriculum.`);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create topic.');
    } finally {
      setTopicLoading(false);
    }
  };

  const openTopicEditor = (topic) => {
    setPendingTopicBatch(null);
    setEditingTopic(topic);
    setTopicForm({ name: topic.name || '', description: topic.description || '' });
    setShowTopicModal(true);
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

  // ── Create Assignment helpers ────────────────────────────────
  const updateAssignQuestion = (idx, field, value) => {
    setAssignForm(prev => ({ ...prev, questions: prev.questions.map((q, i) => i === idx ? { ...q, [field]: value } : q) }));
  };
  const updateAssignOption = (qIdx, oIdx, value) => {
    setAssignForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = [...q.options]; const wasCorrect = q.correctOption === opts[oIdx]; opts[oIdx] = value; return { ...q, options: opts, correctOption: wasCorrect ? value : q.correctOption };
      })
    }));
  };
  const addAssignQuestion = () => setAssignForm(prev => ({ ...prev, questions: [...prev.questions, { questionText: '', options: ['', '', '', ''], correctOption: '', maxScore: '1' }] }));
  const removeAssignQuestion = (idx) => setAssignForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }));

  const openAssignmentEditor = (assignment) => {
    setEditingAssignment(assignment);
    setAssignForm({
      title: assignment.title || '',
      description: assignment.description || '',
      assignmentType: assignment.assignmentType || 'mcq',
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 10) : '',
      publishResultsAt: assignment.publishResultsAt || '',
      maxScore: String(assignment.maxScore || 100),
      published: assignment.published !== false,
      questions: (assignment.questions || []).map((q) => ({
        questionText: q.questionText || '',
        options: q.options?.length ? q.options : ['', '', '', ''],
        correctOption: q.correctOption || '',
        maxScore: String(q.maxScore || 1),
      })),
    });
    setShowAssignmentModal(true);
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

  const handleCreateAssignment = async () => {
    if (!assignForm.title.trim()) { Alert.alert('Missing title', 'Please enter assignment title.'); return; }
    if (assignForm.questions.length === 0) { Alert.alert('No Questions', 'Add at least one question.'); return; }
    for (let i = 0; i < assignForm.questions.length; i++) {
      const q = assignForm.questions[i];
      if (!q.questionText.trim()) { Alert.alert('Error', `Question ${i + 1} has no text.`); return; }
      if (assignForm.assignmentType === 'mcq') {
        const opts = q.options.filter(o => o.trim());
        if (opts.length < 2) { Alert.alert('Error', `Question ${i + 1} needs at least 2 options.`); return; }
        if (!opts.includes(q.correctOption)) { Alert.alert('Error', `Question ${i + 1} correct option must match one of the options.`); return; }
      }
    }
    setAssignLoading(true);
    try {
      const payload = {
        title: assignForm.title,
        description: assignForm.description,
        assignmentType: assignForm.assignmentType,
        classroomId,
        maxScore: Number(assignForm.maxScore) || 100,
        dueDate: assignForm.dueDate || undefined,
        publishResultsAt: assignForm.assignmentType === 'mcq' ? (assignForm.publishResultsAt || undefined) : undefined,
        questions: assignForm.questions.map(q => ({
          questionText: q.questionText,
          options: assignForm.assignmentType === 'mcq' ? q.options.filter(o => o.trim()) : [],
          correctOption: assignForm.assignmentType === 'mcq' ? q.correctOption : undefined,
          maxScore: Number(q.maxScore) || 1,
        }))
      };
      payload.published = assignForm.published;
      const res = editingAssignment
        ? await api.put(`/assignments/${editingAssignment._id}`, payload)
        : await api.post('/assignments', payload);
      const saved = res.data?.assignment || res.data;
      setAssignments(prev => editingAssignment ? prev.map((item) => item._id === editingAssignment._id ? saved : item) : [...prev, saved]);
      setShowAssignmentModal(false);
      setEditingAssignment(null);
      setAssignForm({ title: '', description: '', assignmentType: 'mcq', dueDate: '', publishResultsAt: '', maxScore: '100', published: true, questions: [{ questionText: '', options: ['', '', '', ''], correctOption: '', maxScore: '1' }] });
      Alert.alert(editingAssignment ? 'Updated!' : 'Created!', editingAssignment ? 'Assignment updated.' : 'Assignment posted to classroom.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create assignment.');
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Create Exam helpers ──────────────────────────────────────
  const updateExamQuestion = (idx, field, value) => setExamQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  const updateExamOption = (qIdx, oIdx, value) => setExamQuestions(prev => prev.map((q, i) => {
    if (i !== qIdx) return q;
    const opts = [...q.options]; const wasCorrect = q.correctOption === opts[oIdx]; opts[oIdx] = value; return { ...q, options: opts, correctOption: wasCorrect ? value : q.correctOption };
  }));
  const addExamQuestion = () => setExamQuestions(prev => [...prev, { questionText: '', questionType: 'mcq', options: ['', '', '', ''], correctOption: '', maxScore: '1' }]);
  const removeExamQuestion = (idx) => setExamQuestions(prev => prev.filter((_, i) => i !== idx));

  const openExamEditor = (exam) => {
    setEditingExam(exam);
    setExamForm({ title: exam.title || '', description: exam.description || '', duration: String(exam.duration || 60), accessMode: exam.accessMode || 'registered', dueDate: exam.dueDate ? new Date(exam.dueDate).toISOString().slice(0, 16) : '', resultPublishTime: exam.resultPublishTime ? new Date(exam.resultPublishTime).toISOString().slice(0, 16) : '' });
    setExamQuestions((exam.questions || []).map((q) => ({ questionText: q.questionText || '', questionType: q.questionType || 'mcq', options: q.options?.length ? q.options : ['', '', '', ''], correctOption: q.correctOption || '', maxScore: String(q.maxScore || 1) })));
    setShowExamModal(true);
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

  const handleCreateExam = async () => {
    if (!examForm.title.trim()) { Alert.alert('Missing title', 'Enter exam title.'); return; }
    if (!examForm.duration || isNaN(Number(examForm.duration))) { Alert.alert('Invalid duration', 'Enter a valid duration.'); return; }
    if (examQuestions.length === 0) { Alert.alert('No Questions', 'Add at least one question.'); return; }
    for (let i = 0; i < examQuestions.length; i++) {
      const q = examQuestions[i];
      if (!q.questionText.trim()) { Alert.alert('Error', `Question ${i + 1} has no text.`); return; }
      if (q.questionType === 'mcq') {
        const opts = q.options.filter(o => o.trim());
        if (opts.length < 2) { Alert.alert('Error', `Q${i + 1} needs ≥2 options.`); return; }
        if (!opts.includes(q.correctOption)) { Alert.alert('Error', `Q${i + 1} correct option must match one of the options.`); return; }
      }
    }
    setExamLoading(true);
    try {
      const isEditing = Boolean(editingExam);
      const payload = {
        title: examForm.title,
        description: examForm.description,
        duration: Number(examForm.duration),
        accessMode: examForm.accessMode,
        dueDate: examForm.dueDate || undefined,
        resultPublishTime: examForm.resultPublishTime || undefined,
        classId: classroomId,
        questions: examQuestions.map(q => ({
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.questionType === 'mcq' ? q.options.filter(o => o.trim()) : [],
          correctOption: q.questionType === 'mcq' ? q.correctOption : undefined,
          maxScore: Number(q.maxScore) || 1,
        }))
      };
      const res = isEditing ? await api.put(`/exams/${editingExam._id}`, payload) : await api.post('/exams', payload);
      const saved = res.data?.exam || res.data;
      setExams(prev => isEditing ? prev.map((item) => item._id === editingExam._id ? saved : item) : [...prev, saved]);
      setShowExamModal(false);
      setEditingExam(null);
      setExamForm({ title: '', description: '', duration: '60', accessMode: 'registered', dueDate: '', resultPublishTime: '' });
      setExamQuestions([{ questionText: '', questionType: 'mcq', options: ['', '', '', ''], correctOption: '', maxScore: '1' }]);
      Alert.alert(isEditing ? 'Updated!' : 'Created!', isEditing ? 'Exam updated.' : 'Exam scheduled for this classroom.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create exam.');
    } finally {
      setExamLoading(false);
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

              <Pressable style={[styles.liveBtn, { backgroundColor: theme.success }]} onPress={handleJoinQnA}>
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
                      • {student?.name || student?.email || 'Student'}</Text>
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
                    <Pressable style={[styles.tabAddBtn, { backgroundColor: `${theme.primary}20` }]} onPress={() => { setPendingTopicBatch(null); setEditingTopic(null); setTopicForm({ name: '', description: '' }); setShowTopicModal(true); }}>
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
                          {t.status?.toUpperCase() || 'PENDING'} {t.recordedVideos?.length > 0 ? `• ${t.recordedVideos.length} recordings` : ''}
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
                    <Pressable style={[styles.tabAddBtn, { backgroundColor: `${theme.primary}20` }]} onPress={() => { setEditingAssignment(null); setShowAssignmentModal(true); }}>
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
                          Max Score: {a.maxScore || 100} • {a.assignmentType?.toUpperCase()}
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
                    <Pressable style={[styles.tabAddBtn, { backgroundColor: `${theme.primary}20` }]} onPress={() => { setEditingExam(null); setShowExamModal(true); }}>
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
                          Duration: {e.duration || 60} mins · {e.accessMode?.toUpperCase()}
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

      {/* ── Create Topic Modal ── */}
      <Modal visible={showTopicModal} animationType="slide" transparent onRequestClose={() => { setShowTopicModal(false); setEditingTopic(null); setPendingTopicBatch(null); }}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <View style={[styles.modalContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{editingTopic ? 'Edit Topic' : 'Add Topic'}</Text>
                <Pressable onPress={() => { setShowTopicModal(false); setEditingTopic(null); setPendingTopicBatch(null); }} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={24} color={theme.muted} />
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Topic name *"
                placeholderTextColor={theme.muted}
                value={topicForm.name}
                onChangeText={t => setTopicForm({ ...topicForm, name: t })}
              />
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Description (optional)"
                placeholderTextColor={theme.muted}
                value={topicForm.description}
                onChangeText={t => setTopicForm({ ...topicForm, description: t })}
                multiline
              />
              <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }, topicLoading && { opacity: 0.7 }]} onPress={handleCreateTopic} disabled={topicLoading}>
                <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>{topicLoading ? (editingTopic ? 'Saving...' : 'Creating...') : (editingTopic ? 'Save Topic' : 'Add Topic')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Create Assignment Modal ── */}
      <Modal visible={showAssignmentModal} animationType="slide" transparent onRequestClose={() => setShowAssignmentModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <View style={[styles.modalContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{editingAssignment ? 'Edit Assignment' : 'New Assignment'}</Text>
                <Pressable onPress={() => setShowAssignmentModal(false)} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={24} color={theme.muted} />
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Title *"
                placeholderTextColor={theme.muted}
                value={assignForm.title}
                onChangeText={t => setAssignForm({ ...assignForm, title: t })}
              />
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Description (optional)"
                placeholderTextColor={theme.muted}
                value={assignForm.description}
                onChangeText={t => setAssignForm({ ...assignForm, description: t })}
                multiline
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Max Score (default 100)"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                value={assignForm.maxScore}
                onChangeText={t => setAssignForm({ ...assignForm, maxScore: t })}
              />
              <DateTimePicker
                label="Due Date"
                value={assignForm.dueDate}
                onChange={t => setAssignForm({ ...assignForm, dueDate: t })}
                mode="date"
                placeholder="Select due date (optional)"
              />
              <View style={styles.inlineRow}>
                {['mcq', 'theory'].map(type => (
                  <Pressable
                    key={type}
                    style={[styles.chip, { borderColor: theme.border }, assignForm.assignmentType === type && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => setAssignForm({ ...assignForm, assignmentType: type, publishResultsAt: type === 'theory' ? '' : assignForm.publishResultsAt })}
                  >
                    <Text style={[styles.chipText, { color: theme.muted }, assignForm.assignmentType === type && { color: theme.onPrimary }]}>{type.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              {assignForm.assignmentType === 'mcq' && (
                <DateTimePicker
                  label="Release Results At (optional)"
                  value={assignForm.publishResultsAt}
                  onChange={t => setAssignForm({ ...assignForm, publishResultsAt: t })}
                  mode="datetime"
                  placeholder="Release results immediately"
                />
              )}
              <View style={styles.questionSectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Questions</Text>
                <Pressable style={[styles.addQBtn, { backgroundColor: `${theme.primary}20` }]} onPress={addAssignQuestion}>
                  <Ionicons name="add-outline" size={16} color={theme.primary} />
                  <Text style={[styles.addQBtnText, { color: theme.primary }]}>Add</Text>
                </Pressable>
              </View>
              {assignForm.questions.map((q, qIdx) => (
                <View key={qIdx} style={[styles.questionBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.questionBlockHeader}>
                    <Text style={[styles.questionBlockNum, { color: theme.text }]}>Q{qIdx + 1}</Text>
                    <Pressable onPress={() => removeAssignQuestion(qIdx)} disabled={assignForm.questions.length === 1}>
                      <Ionicons name="trash-outline" size={16} color={assignForm.questions.length === 1 ? theme.border : theme.danger} />
                    </Pressable>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, minHeight: 70 }]}
                    placeholder="Question text *"
                    placeholderTextColor={theme.muted}
                    value={q.questionText}
                    onChangeText={v => updateAssignQuestion(qIdx, 'questionText', v)}
                    multiline
                  />
                  {assignForm.assignmentType === 'mcq' && (
                    <>
                      {q.options.map((opt, oIdx) => (
                        <View
                          key={oIdx}
                          style={[styles.optionEditor, { backgroundColor: theme.background, borderColor: q.correctOption === opt && opt.trim() ? theme.success : theme.border }]}
                        >
                          <TextInput style={[styles.optionInput, { color: theme.text }]} placeholder={`Option ${oIdx + 1}`} placeholderTextColor={theme.muted} value={opt} onChangeText={v => updateAssignOption(qIdx, oIdx, v)} />
                          <Pressable onPress={() => opt.trim() && updateAssignQuestion(qIdx, 'correctOption', opt)} hitSlop={8} accessibilityRole="radio" accessibilityState={{ selected: q.correctOption === opt && !!opt.trim() }}>
                            <Ionicons name={q.correctOption === opt && opt.trim() ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={q.correctOption === opt && opt.trim() ? theme.success : theme.muted} />
                          </Pressable>
                        </View>
                      ))}
                      <Text style={[styles.helperText, { color: theme.muted }]}>Tap the check icon to mark the correct answer.</Text>
                    </>
                  )}
                  <View style={styles.scoreRow}>
                    <Text style={[styles.fieldLabel, { color: theme.muted }]}>Max Score:</Text>
                    <TextInput
                      style={[styles.scoreInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      keyboardType="numeric"
                      value={q.maxScore}
                      onChangeText={v => updateAssignQuestion(qIdx, 'maxScore', v)}
                    />
                  </View>
                </View>
              ))}
              <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }, assignLoading && { opacity: 0.7 }]} onPress={handleCreateAssignment} disabled={assignLoading}>
                <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>{assignLoading ? 'Saving...' : editingAssignment ? 'Save Assignment' : 'Create Assignment'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Create Exam Modal ── */}
      <Modal visible={showExamModal} animationType="slide" transparent onRequestClose={() => setShowExamModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <View style={[styles.modalContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{editingExam ? 'Edit Exam' : 'Schedule Exam'}</Text>
                <Pressable onPress={() => setShowExamModal(false)} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={24} color={theme.muted} />
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Exam title *"
                placeholderTextColor={theme.muted}
                value={examForm.title}
                onChangeText={t => setExamForm({ ...examForm, title: t })}
              />
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Description (optional)"
                placeholderTextColor={theme.muted}
                value={examForm.description}
                onChangeText={t => setExamForm({ ...examForm, description: t })}
                multiline
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Duration (minutes) *"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                value={examForm.duration}
                onChangeText={t => setExamForm({ ...examForm, duration: t })}
              />
              <DateTimePicker
                label="Due Date (optional)"
                value={examForm.dueDate}
                onChange={t => setExamForm({ ...examForm, dueDate: t })}
                mode="datetime"
                placeholder="Select exam due date"
              />
              <DateTimePicker
                label="Release Results At (optional)"
                value={examForm.resultPublishTime}
                onChange={t => setExamForm({ ...examForm, resultPublishTime: t })}
                mode="datetime"
                placeholder="Release results immediately"
              />
              <View style={styles.inlineRow}>
                {['registered', 'open'].map(mode => (
                  <Pressable
                    key={mode}
                    style={[styles.chip, { borderColor: theme.border }, examForm.accessMode === mode && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => setExamForm({ ...examForm, accessMode: mode })}
                  >
                    <Text style={[styles.chipText, { color: theme.muted }, examForm.accessMode === mode && { color: theme.onPrimary }]}>{mode.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.questionSectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Questions</Text>
                <Pressable style={[styles.addQBtn, { backgroundColor: `${theme.primary}20` }]} onPress={addExamQuestion}>
                  <Ionicons name="add-outline" size={16} color={theme.primary} />
                  <Text style={[styles.addQBtnText, { color: theme.primary }]}>Add</Text>
                </Pressable>
              </View>
              {examQuestions.map((q, qIdx) => (
                <View key={qIdx} style={[styles.questionBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.questionBlockHeader}>
                    <Text style={[styles.questionBlockNum, { color: theme.text }]}>Q{qIdx + 1}</Text>
                    <Pressable onPress={() => removeExamQuestion(qIdx)} disabled={examQuestions.length === 1}>
                      <Ionicons name="trash-outline" size={16} color={examQuestions.length === 1 ? theme.border : theme.danger} />
                    </Pressable>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, minHeight: 70 }]}
                    placeholder="Question text *"
                    placeholderTextColor={theme.muted}
                    value={q.questionText}
                    onChangeText={v => updateExamQuestion(qIdx, 'questionText', v)}
                    multiline
                  />
                  <View style={styles.inlineRow}>
                    {['mcq', 'theory'].map(type => (
                      <Pressable
                        key={type}
                        style={[styles.chip, { borderColor: theme.border }, q.questionType === type && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                        onPress={() => updateExamQuestion(qIdx, 'questionType', type)}
                      >
                        <Text style={[styles.chipText, { color: theme.muted }, q.questionType === type && { color: theme.onPrimary }]}>{type.toUpperCase()}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {q.questionType === 'mcq' && (
                    <>
                      {q.options.map((opt, oIdx) => (
                        <View
                          key={oIdx}
                          style={[styles.optionEditor, { backgroundColor: theme.background, borderColor: q.correctOption === opt && opt.trim() ? theme.success : theme.border }]}
                        >
                          <TextInput style={[styles.optionInput, { color: theme.text }]} placeholder={`Option ${oIdx + 1}`} placeholderTextColor={theme.muted} value={opt} onChangeText={v => updateExamOption(qIdx, oIdx, v)} />
                          <Pressable onPress={() => opt.trim() && updateExamQuestion(qIdx, 'correctOption', opt)} hitSlop={8} accessibilityRole="radio" accessibilityState={{ selected: q.correctOption === opt && !!opt.trim() }}>
                            <Ionicons name={q.correctOption === opt && opt.trim() ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={q.correctOption === opt && opt.trim() ? theme.success : theme.muted} />
                          </Pressable>
                        </View>
                      ))}
                      <Text style={[styles.helperText, { color: theme.muted }]}>Tap the check icon to mark the correct answer.</Text>
                    </>
                  )}
                  <View style={styles.scoreRow}>
                    <Text style={[styles.fieldLabel, { color: theme.muted }]}>Max Score:</Text>
                    <TextInput
                      style={[styles.scoreInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      keyboardType="numeric"
                      value={q.maxScore}
                      onChangeText={v => updateExamQuestion(qIdx, 'maxScore', v)}
                    />
                  </View>
                </View>
              ))}
              <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }, examLoading && { opacity: 0.7 }]} onPress={handleCreateExam} disabled={examLoading}>
                <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>{examLoading ? 'Saving...' : editingExam ? 'Save Exam' : 'Schedule Exam'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showEditModal && (
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Edit classroom</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.muted }]}>Update the class details, access settings, or schedule.</Text>
                </View>
                <Pressable onPress={() => setShowEditModal(false)} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={24} color={theme.muted} />
                </Pressable>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Classroom name <Text style={{ color: theme.danger }}>*</Text></Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g. SS2 Mathematics"
                placeholderTextColor={theme.muted}
                value={editFormData.name}
                onChangeText={(text) => setEditFormData({ ...editFormData, name: text })}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Description <Text style={[styles.optionalLabel, { color: theme.muted }]}>(optional)</Text></Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="What will students learn in this class?"
                placeholderTextColor={theme.muted}
                value={editFormData.description}
                onChangeText={(text) => setEditFormData({ ...editFormData, description: text })}
                multiline
                textAlignVertical="top"
              />
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Subject <Text style={[styles.optionalLabel, { color: theme.muted }]}>(optional)</Text></Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g. Mathematics, Biology"
                placeholderTextColor={theme.muted}
                value={editFormData.subject}
                onChangeText={(text) => setEditFormData({ ...editFormData, subject: text })}
                autoCapitalize="words"
              />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 2 }]}>Grade / academic level</Text>
              <Text style={[styles.helperText, { color: theme.muted, marginBottom: 6 }]}>Choose the level that best matches your learners.</Text>
              <SelectField
                value={editFormData.level}
                options={['Pre-Primary', 'Primary', 'High School', 'Pre-University', 'Undergraduate', 'Postgraduate', 'Professional', 'Vocational', 'Other']}
                onChange={(level) => setEditFormData({ ...editFormData, level })}
                placeholder="Select grade / academic level"
              />

              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 2 }]}>Access and payment</Text>
              <View style={[styles.toggleGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleCopy}><Text style={[styles.toggleTitle, { color: theme.text }]}>Paid classroom</Text><Text style={[styles.helperText, { color: theme.muted }]}>Require payment before enrollment.</Text></View>
                  <Switch value={editFormData.isPaid} onValueChange={(isPaid) => setEditFormData({ ...editFormData, isPaid })} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.onPrimary} />
                </View>
                <View style={[styles.toggleRow, { borderTopColor: theme.border, borderTopWidth: 1 }]}>
                  <View style={styles.toggleCopy}><Text style={[styles.toggleTitle, { color: theme.text }]}>Private classroom</Text><Text style={[styles.helperText, { color: theme.muted }]}>Limit access to invited learners.</Text></View>
                  <Switch value={editFormData.isPrivate} onValueChange={(isPrivate) => setEditFormData({ ...editFormData, isPrivate })} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.onPrimary} />
                </View>
                <View style={[styles.toggleRow, { borderTopColor: theme.border, borderTopWidth: 1 }]}>
                  <View style={styles.toggleCopy}><Text style={[styles.toggleTitle, { color: theme.text }]}>Published</Text><Text style={[styles.helperText, { color: theme.muted }]}>Make this class visible to learners.</Text></View>
                  <Switch value={editFormData.published} onValueChange={(published) => setEditFormData({ ...editFormData, published })} trackColor={{ false: theme.border, true: theme.primary }} thumbColor={theme.onPrimary} />
                </View>
              </View>

              {editFormData.isPaid && (
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                  placeholder="Price amount in NGN"
                  placeholderTextColor={theme.muted}
                  keyboardType="numeric"
                  value={String(editFormData.pricing.amount)}
                  onChangeText={(value) => setEditFormData({ ...editFormData, pricing: { ...editFormData.pricing, amount: Number(value) || 0 } })}
                />
              )}

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Student capacity</Text>
              <Text style={[styles.helperText, { color: theme.muted, marginBottom: 6 }]}>Maximum number of students. Default: 30.</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g. 30"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                value={String(editFormData.capacity)}
                onChangeText={(value) => setEditFormData({ ...editFormData, capacity: value === '' ? '' : Number(value) })}
              />

              <View style={[styles.scheduleBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.scheduleHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.fieldLabel, { color: theme.text, marginBottom: 2 }]}>Weekly schedule <Text style={[styles.optionalLabel, { color: theme.muted }]}>(optional)</Text></Text>
                    <Text style={[styles.helperText, { color: theme.muted }]}>Add recurring class times.</Text>
                  </View>
                  <Pressable style={[styles.addSlotBtn, { backgroundColor: `${theme.primary}20` }]} onPress={addEditScheduleSlot}>
                    <Ionicons name="add-outline" size={16} color={theme.primary} />
                    <Text style={[styles.addSlotBtnText, { color: theme.primary }]}>Add Slot</Text>
                  </Pressable>
                </View>

                {(editFormData.schedule || []).length === 0 ? (
                  <Text style={[styles.helperText, { color: theme.muted, fontStyle: 'italic', marginTop: 6 }]}>No weekly schedule slots configured yet.</Text>
                ) : (
                  (editFormData.schedule || []).map((slot, index) => (
                    <View key={index} style={[styles.slotRow, { borderColor: theme.border }]}>
                      <View style={styles.slotHeader}>
                        <Text style={[styles.slotTitle, { color: theme.text }]}>Slot {index + 1}</Text>
                        <Pressable onPress={() => removeEditScheduleSlot(index)}>
                          <Ionicons name="trash-outline" size={16} color={theme.danger} />
                        </Pressable>
                      </View>

                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 8 }}>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                          <Pressable
                            key={day}
                            style={[styles.miniChip, { backgroundColor: theme.background, borderColor: theme.border }, slot.dayOfWeek === day && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                            onPress={() => updateEditScheduleSlot(index, 'dayOfWeek', day)}
                          >
                            <Text style={[styles.miniChipText, { color: slot.dayOfWeek === day ? theme.onPrimary : theme.muted }]}>{day.slice(0, 3)}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <DateTimePicker
                            label="Start Time"
                            value={slot.startTime}
                            onChange={(value) => updateEditScheduleSlot(index, 'startTime', value)}
                            mode="time"
                            placeholder="09:00"
                            compact
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <DateTimePicker
                            label="End Time"
                            value={slot.endTime}
                            onChange={(value) => updateEditScheduleSlot(index, 'endTime', value)}
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

              <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }, editLoading && { opacity: 0.7 }]} onPress={handleUpdateClassroom} disabled={editLoading}>
                <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>{editLoading ? 'Saving...' : 'Save Changes'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}
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
  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContainer: { width: '100%', maxHeight: '90%', borderRadius: 28, borderWidth: 1 },
  modalContent: { padding: 20, gap: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  modalCloseButton: { padding: 6 },
  input: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, marginBottom: 12 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '700' },
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
  helperText: { fontSize: 12 },
  toggleGroup: { borderWidth: 1, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  toggleRow: { minHeight: 62, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleCopy: { flex: 1, paddingRight: 12 },
  toggleTitle: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  tabSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tabAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  tabAddBtnText: { fontSize: 12, fontWeight: '700' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  questionSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addQBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  addQBtnText: { fontSize: 12, fontWeight: '700' },
  questionBlock: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 16 },
  questionBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  questionBlockNum: { fontSize: 14, fontWeight: '800' },
  optionEditor: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, marginBottom: 8, paddingLeft: 10, paddingRight: 12 },
  optionInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 0, fontSize: 14 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  scoreInput: { borderWidth: 1, borderRadius: 10, width: 60, paddingVertical: 6, paddingHorizontal: 10, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  optionalLabel: { fontSize: 11, fontWeight: '500' },
  examRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  examShareBtn: { padding: 4 },
  miniStatusBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  miniStatusText: { fontSize: 10, fontWeight: '800' },
});
