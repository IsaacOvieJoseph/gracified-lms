import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, Edit, Plus, Calendar, Users, User, Book, DollarSign, X, UserPlus, FileText, CheckCircle, Send, ChevronDown, ChevronUp, GripVertical, Trash2, Loader2, Clock, ExternalLink, Globe, Share2, Facebook, Twitter, Linkedin, Copy, Play, Circle, FastForward, Eye, EyeOff, Megaphone, Flag, CreditCard, School, GraduationCap, Layers, Sparkles } from 'lucide-react';
import { convertLocalToUTC, convertUTCToLocal, formatDisplayDate } from '../utils/timezone';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import GradeAssignmentModal from '../components/GradeAssignmentModal';
import SubmitAssignmentModal from '../components/SubmitAssignmentModal';
import TopicManagementModal from '../components/TopicManagementModal';
import TopicDisplay from '../components/TopicDisplay';
import GoogleMeetAuth from '../components/GoogleMeetAuth';
import PaymentRequiredModal from '../components/PaymentRequiredModal';
import ConfirmationModal from '../components/ConfirmationModal';

// subjectOptions converted to dynamic state inside component


const levelOptions = [
  { value: 'Pre-Primary', label: 'Pre-Primary' },
  { value: 'Primary', label: 'Primary' },
  { value: 'High School', label: 'High School' },
  { value: 'Pre-University', label: 'Pre-University' },
  { value: 'Undergraduate', label: 'Undergraduate' },
  { value: 'Postgraduate', label: 'Postgraduate' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Vocational', label: 'Vocational' },
  { value: 'Other', label: 'Other' },
];

const defaultSubjects = [
  'Mathematics', 'English', 'Physics', 'Chemistry', 'Biology',
  'Computer Science', 'History', 'Geography', 'Economics',
  'Literature', 'Art', 'Music', 'Physical Education'
];

const ClassroomDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuth();
  const [classroom, setClassroom] = useState(null);
  const [whiteboardInfo, setWhiteboardInfo] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState(defaultSubjects.map(s => ({ value: s, label: s }))); // Dynamic subjects
  const [editForm, setEditForm] = useState({ name: '', description: '', learningOutcomes: '', subject: '', level: 'Other', capacity: 30, pricingType: 'per_lecture', pricingAmount: 0, schedule: [], isPrivate: false, isPaid: false, teacherId: '', schoolIds: [] });
  const [schools, setSchools] = useState([]);
  useEffect(() => {
    if (user?.role === 'school_admin') {
      api.get('/schools?adminId=' + user._id).then(res => setSchools(res.data.schools || []));
    }
  }, [user]);
  const [showGoogleAuth, setShowGoogleAuth] = useState(false);

  useEffect(() => {
    // Fetch dynamic subjects
    const fetchSubjects = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data && res.data.subjects) {
          // Merge default subjects with fetched subjects and remove duplicates
          const uniqueSubjects = Array.from(new Set([...defaultSubjects, ...res.data.subjects]));
          // Sort alphabetically
          uniqueSubjects.sort();
          setSubjectOptions(uniqueSubjects.map(s => ({ value: s, label: s })));
        }
      } catch (err) {
        console.error('Error fetching subjects:', err);
      }
    };
    fetchSubjects();
  }, []);

  // Open edit modal and prefill form
  const handleOpenEdit = () => {
    setEditForm({
      name: classroom.name || '',
      description: classroom.description || '',
      learningOutcomes: classroom.learningOutcomes || '',
      subject: classroom.subject || '',
      level: classroom.level || 'Other',
      capacity: classroom.capacity || 30,
      pricingType: classroom.pricing?.type || 'per_lecture',
      pricingAmount: classroom.pricing?.amount || 0,
      isPaid: classroom.isPaid || false,
      schedule: (classroom.schedule || []).map(s => {
        const local = convertUTCToLocal(s.dayOfWeek, s.startTime);
        const localEnd = convertUTCToLocal(s.dayOfWeek, s.endTime);
        return {
          dayOfWeek: local.dayOfWeek,
          startTime: local.hhmm,
          endTime: localEnd.hhmm
        };
      }),
      teacherId: classroom.teacherId?._id || '',
      schoolIds: Array.isArray(classroom.schoolId) ? classroom.schoolId.map(s => s._id || s) : [classroom.schoolId?._id || classroom.schoolId].filter(Boolean),
      isPrivate: classroom.isPrivate || false
    });
    if (['root_admin', 'school_admin'].includes(user?.role)) {
      fetchAvailableTeachers();
    }
    setShowEditModal(true);
  };

  // Handle edit form submit
  const handleEditClassroom = async (e) => {
    e.preventDefault();
    setIsEditing(true);
    try {
      const updateData = {
        name: editForm.name,
        description: editForm.description,
        learningOutcomes: editForm.learningOutcomes,
        subject: editForm.subject,
        level: editForm.level,
        capacity: editForm.capacity,
        pricing: { type: editForm.pricingType, amount: editForm.pricingAmount },
        isPaid: editForm.isPaid,
        isPrivate: editForm.isPrivate,
        schedule: editForm.schedule.map(s => {
          const utc = convertLocalToUTC(s.dayOfWeek, s.startTime);
          const utcEnd = convertLocalToUTC(s.dayOfWeek, s.endTime);
          return {
            dayOfWeek: utc.dayOfWeek,
            startTime: utc.time,
            endTime: utcEnd.time
          };
        })
      };

      if (user?.role === 'school_admin') {
        const sel = editForm.schoolIds?.includes('ALL') ? schools.map(s => s._id) : editForm.schoolIds;
        updateData.schoolId = sel;
      }

      // Only allow teacher change if permitted
      if (['root_admin', 'school_admin'].includes(user?.role) && editForm.teacherId) {
        updateData.teacherId = editForm.teacherId;
      }

      await api.put(`/classrooms/${id}`, updateData, { skipLoader: true });
      setShowEditModal(false);
      toast.success('Classroom updated successfully');
      fetchClassroom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating classroom');
    } finally {
      setIsEditing(false);
    }
  };
  const [isEditing, setIsEditing] = useState(false); // Added loading state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showChangeTeacherModal, setShowChangeTeacherModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [topicForm, setTopicForm] = useState({ name: '', description: '' });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // New states for Assignment Management
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false);
  const [availableTopicsForAssignment, setAvailableTopicsForAssignment] = useState([]); // For topic dropdown in create assignment modal
  const [showSubmitAssignmentModal, setShowSubmitAssignmentModal] = useState(false); // New state for submit modal
  const [assignmentToSubmit, setAssignmentToSubmit] = useState(null); // New state for assignment to submit
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showDeleteTopicModal, setShowDeleteTopicModal] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState(null);
  const [showLeaveClassModal, setShowLeaveClassModal] = useState(false);
  const [selectedAssignmentForGrading, setSelectedAssignmentForGrading] = useState(null);
  const [submissionToGrade, setSubmissionToGrade] = useState(null);
  const [expandedSubmissions, setExpandedSubmissions] = useState(new Set()); // Track which submissions are expanded
  const [expandedAssignments, setExpandedAssignments] = useState(new Set()); // Track which assignments are expanded
  const [showDeleteAssignmentModal, setShowDeleteAssignmentModal] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [notifyingAssignmentId, setNotifyingAssignmentId] = useState(null);
  const [showRemoveStudentModal, setShowRemoveStudentModal] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [isRemovingStudent, setIsRemovingStudent] = useState(false);

  // Payment Check Logic
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [blockedTopic, setBlockedTopic] = useState(null);
  const [paidTopicIds, setPaidTopicIds] = useState(new Set()); // IDs of topics user has paid for
  const [exams, setExams] = useState([]);
  const [activeTab, setActiveTab] = useState('topics'); // Default tab

  useEffect(() => {
    fetchClassroom();
    fetchWhiteboardState();
    if (user?.role === 'student') {
      fetchTopicStatus();
    }
    // Listen for school selection changes
    const handler = () => fetchClassroom();
    window.addEventListener('schoolSelectionChanged', handler);
    const wbInterval = setInterval(() => fetchWhiteboardState(), 5000);
    return () => { window.removeEventListener('schoolSelectionChanged', handler); clearInterval(wbInterval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTopicStatus = async () => {
    try {
      const resp = await api.get(`/payments/topic-status/${id}`);
      if (resp.data.paidTopics) {
        const paidIds = new Set(resp.data.paidTopics.map(t => t._id));
        setPaidTopicIds(paidIds);
      }
    } catch (err) {
      console.error('Error fetching topic status', err);
    }
  };

  const handlePublishToggle = async () => {
    setPublishing(true);
    try {
      await api.put(`/classrooms/${id}/publish`, { published: !classroom.published });
      fetchClassroom();
      toast.success(classroom.published ? 'Classroom unpublished' : 'Classroom published');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating publish status');
    } finally {
      setPublishing(false);
    }
  };

  const handleNotifyStudents = async (assignmentId) => {
    setNotifyingAssignmentId(assignmentId);
    try {
      await api.post(`/assignments/${assignmentId}/notify`);
      toast.success('Students notified successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error notifying students');
    } finally {
      setNotifyingAssignmentId(null);
    }
  };

  const [publishingAssignmentId, setPublishingAssignmentId] = useState(null);
  const handleAssignmentPublishToggle = async (assignment) => {
    setPublishingAssignmentId(assignment._id);
    try {
      const newStatus = !assignment.published;
      await api.put(`/assignments/${assignment._id}/publish`, { published: newStatus });
      fetchClassroom();
      toast.success(newStatus ? 'Assignment published' : 'Assignment unpublished');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating assignment publish status');
    } finally {
      setPublishingAssignmentId(null);
    }
  };

  const [showEndClassModal, setShowEndClassModal] = useState(false);
  const [isEndingClass, setIsEndingClass] = useState(false);

  const confirmEndClassroom = async () => {
    setIsEndingClass(true);
    try {
      await api.post(`/classrooms/${id}/end`, {});
      toast.success('Classroom ended successfully');
      setShowEndClassModal(false);
      navigate('/classrooms'); // proper redirect
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error ending classroom');
    } finally {
      setIsEndingClass(false);
    }
  };

  // Check if user has access to the current topic (or specific topic)
  const checkTopicAccess = (targetTopicId = null) => {
    // Only apply to students
    if (user?.role !== 'student') return true;

    // Only apply if pricing type is per_topic
    if (classroom?.pricing?.type !== 'per_topic') return true;

    if (!classroom || !classroom.topics) return true;

    // Determine effective topic ID (prefer explicit target, then current topic field, then status fallback)
    let topicToProtect = targetTopicId || classroom.currentTopicId;
    if (!topicToProtect) {
      const activeTopic = classroom.topics.find(t => t.status === 'active');
      if (activeTopic) topicToProtect = activeTopic._id;
    }

    if (!topicToProtect) return true;

    const topicIdStr = (typeof topicToProtect === 'object' ? topicToProtect._id : topicToProtect).toString();

    // Find the topic object in classroom.topics to get its latest price/isPaid status
    const topic = classroom.topics.find(t => t._id === topicIdStr);
    if (!topic) return true;

    // Check if topic is paid (teacher might have made it free)
    if (topic.isPaid && topic.price > 0) {
      // Check if user paid (we use the set of paid IDs)
      if (!paidTopicIds.has(topicIdStr)) {
        setBlockedTopic(topic);
        setShowPaymentModal(true);
        return false;
      }
    }
    return true;
  };

  // fetch whiteboard availability/session info
  const fetchWhiteboardState = async () => {
    try {
      const resp = await api.get(`/whiteboard/${id}`);
      setWhiteboardInfo(resp.data || null);
    } catch (err) {
      // ignore errors silently
      setWhiteboardInfo(null);
    }
  };

  useEffect(() => {
    if (classroom) {
      if (['root_admin', 'school_admin', 'personal_teacher'].includes(user?.role)) {
        fetchAvailableStudents();
      }
      if (user?.role === 'root_admin') {
        fetchAvailableTeachers();
      }
      // Fetch topics for assignment creation if creating assignments in this classroom
      if (['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role)) {
        fetchTopicsForAssignmentCreation(classroom._id);
      }
    }
  }, [classroom, user]);

  // Fetch latest call info (if user can view/start)
  useEffect(() => {
    const fetchCall = async () => {
      if (!classroom || !user) return;

      // determine basic starter permission (teacher owner, personal teacher owner, school_admin of class, root_admin)
      const teacherIdStr = classroom.teacherId?._id ? classroom.teacherId._id.toString() : (classroom.teacherId ? classroom.teacherId.toString() : null);
      const isTeacherOwner = teacherIdStr && user._id.toString() === teacherIdStr;
      const isRoot = user.role === 'root_admin';
      const classroomSchoolIds = (Array.isArray(classroom.schoolId) ? classroom.schoolId : [classroom.schoolId]).filter(Boolean);
      const isSchoolAdminOfClass = user.role === 'school_admin' && classroomSchoolIds.some(s => {
        const adminId = s?.adminId?._id || s?.adminId;
        return adminId?.toString() === user?._id?.toString();
      });

      const canViewCall = isTeacherOwner || isRoot || isSchoolAdminOfClass || (classroom.students || []).some(s => (s._id ? s._id.toString() : s.toString()) === user._id.toString()) || (user.enrolledClasses || []).some(cid => cid.toString() === classroom._id.toString());
      if (!canViewCall) {
        setCurrentCall(null);
        return;
      }

      try {
        const resp = await api.get(`/classrooms/${classroom._id}/call`);
        setCurrentCall(resp.data || null);
      } catch (err) {
        // 404 -> no call yet, 403 -> not allowed, treat as no call for labeling
        setCurrentCall(null);
      }
    };
    fetchCall();
  }, [classroom, user]);

  const fetchClassroom = async () => {
    try {
      if (!classroom) setLoading(true); // Only show global loader on initial fetch
      // Also populate assignments to display them
      const response = await api.get(`/classrooms/${id}`);
      setClassroom(response.data.classroom);
      fetchExams(); // Fetch exams after classroom is loaded
    } catch (error) {
      console.error('Error fetching classroom:', error);
    } finally {
      if (!classroom) setLoading(false);
    }
  };

  const fetchExams = async () => {
    try {
      const response = await api.get(`/exams/class/${id}`);
      setExams(response.data);
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  const fetchTopicsForAssignmentCreation = async (classroomId) => {
    try {
      const response = await api.get(`/classrooms/${classroomId}`); // Assuming topics are populated in classroom detail
      setAvailableTopicsForAssignment(response.data.classroom.topics || []);
    } catch (error) {
      console.error('Error fetching topics for assignment creation:', error);
      setAvailableTopicsForAssignment([]);
    }
  };

  // Payment Logic for Enrollment
  const [showEnrollmentPaymentModal, setShowEnrollmentPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const loadPaystackScript = () => {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) return resolve();
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Paystack script'));
      document.body.appendChild(script);
    });
  };

  const handleEnrollmentPayment = async () => {
    setIsProcessingPayment(true);
    try {
      const amount = classroom.pricing?.amount || 0;
      // 1. Initialize logic
      const resp = await api.post('/payments/paystack/initiate', {
        amount,
        classroomId: id,
        type: 'class_enrollment',
        returnUrl: window.location.href // Fallback
      });

      if (resp.data.reference) {
        await loadPaystackScript();
        const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
        // Paystack expects amount in kobo if currency is NGN
        const payAmount = (import.meta.env.VITE_PAYSTACK_CURRENCY || 'NGN').toLowerCase() === 'ngn'
          ? Math.round(amount * 100)
          : Math.round(amount * 100);

        if (!user || !user.email) {
          throw new Error('User email not available.');
        }

        const handleCallback = (response) => {
          (async () => {
            try {
              await api.get(`/payments/paystack/verify?reference=${encodeURIComponent(response.reference)}`);
              toast.success('Payment successful! You are now enrolled.');
              setShowEnrollmentPaymentModal(false);
              fetchClassroom(); // Refresh to update enrollment status
            } catch (err) {
              toast.error(err.response?.data?.message || 'Payment verification failed');
            } finally {
              setIsProcessingPayment(false);
            }
          })();
        };

        const handler = window.PaystackPop.setup({
          key: pubKey,
          email: user.email,
          amount: payAmount,
          ref: resp.data.reference,
          callback: handleCallback,
          onClose: () => setIsProcessingPayment(false)
        });

        if (handler && typeof handler.openIframe === 'function') {
          handler.openIframe();
        } else if (handler && typeof handler.open === 'function') {
          handler.open();
        } else {
          throw new Error('Paystack handler not available');
        }
      } else {
        throw new Error('Failed to initiate payment');
      }
    } catch (error) {
      console.error('Enrollment payment error:', error);
      toast.error(error.response?.data?.message || 'Error processing payment');
      setIsProcessingPayment(false);
    }
  };

  const handleEnroll = async () => {
    try {
      if (classroom.isPaid && classroom.pricing?.amount > 0) {
        // Show local payment modal instead of navigating
        setShowEnrollmentPaymentModal(true);
      } else {
        await api.post(`/classrooms/${id}/enroll`);
        toast.success('Enrolled successfully!');
        fetchClassroom();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error enrolling');
    }
  };

  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const handleCreateTopic = async (e) => {
    e.preventDefault();
    setIsCreatingTopic(true);
    try {
      await api.post('/topics', {
        ...topicForm,
        classroomId: id
      }, { skipLoader: true });
      toast.success('Topic created successfully');
      setShowTopicModal(false);
      setTopicForm({ name: '', description: '' });
      fetchClassroom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating topic');
    } finally {
      setIsCreatingTopic(false);
    }
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDrop = async (e, dropIndex) => {
    const dragIndex = Number(e.dataTransfer.getData('text/plain'));
    if (dragIndex === dropIndex) return;

    const newTopics = [...classroom.topics];
    const [draggedItem] = newTopics.splice(dragIndex, 1);
    newTopics.splice(dropIndex, 0, draggedItem);

    // Update local state immediately
    const updatedClassroom = { ...classroom, topics: newTopics };
    setClassroom(updatedClassroom);

    // Update backend
    try {
      const orderedIds = newTopics.map(t => t._id);
      await api.put('/topics/reorder', { orderedIds });
      toast.success('Topics reordered');
    } catch (error) {
      toast.error('Failed to save topic order');
      fetchClassroom(); // Revert on error
    }
  };

  const handleDeleteTopic = (topicId) => {
    setTopicToDelete(topicId);
    setShowDeleteTopicModal(true);
  };

  const confirmDeleteTopic = async () => {
    if (!topicToDelete) return;
    try {
      await api.delete(`/topics/${topicToDelete}`);
      toast.success('Topic deleted successfully');
      setShowDeleteTopicModal(false);
      setTopicToDelete(null);
      fetchClassroom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting topic');
    }
  };

  const handleLeaveClass = async () => {
    try {
      await api.post(`/classrooms/${id}/leave`);
      toast.success('Successfully left the class');
      setShowLeaveClassModal(false);
      navigate('/classrooms');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error leaving class');
    }
  };

  const handleCreateAssignment = async () => {
    setShowCreateAssignmentModal(false);
    fetchClassroom();
  };

  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  const handleSubmitAssignment = async (assignmentId, answers) => {
    setIsSubmittingAssignment(true);
    try {
      await api.post(`/assignments/${assignmentId}/submit`, { answers }, { skipLoader: true });
      setShowSubmitAssignmentModal(false);
      setAssignmentToSubmit(null);
      toast.success('Assignment submitted successfully');
      fetchClassroom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting assignment');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const handleGradeSubmission = async () => {
    // This function will now simply close the modal and refresh assignments,
    // as the API call is handled within GradeAssignmentModal
    setShowGradeModal(false);
    fetchClassroom(); // Refresh classroom to update grades
  };

  const handleDeleteAssignment = (assignmentId) => {
    setAssignmentToDelete(assignmentId);
    setShowDeleteAssignmentModal(true);
  };

  const confirmDeleteAssignment = async () => {
    if (!assignmentToDelete) return;
    setIsDeletingAssignment(true);
    try {
      await api.delete(`/assignments/${assignmentToDelete}`);
      toast.success('Assignment deleted successfully');
      setShowDeleteAssignmentModal(false);
      setAssignmentToDelete(null);
      fetchClassroom();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting assignment');
    } finally {
      setIsDeletingAssignment(false);
    }
  };

  const handleOpenEditAssignment = (assignment) => {
    setAssignmentToEdit(assignment);
    setShowCreateAssignmentModal(true);
  };

  const handleStartZoom = async () => {
    try {
      // Start or get current Google Meet link for this class
      const response = await api.post(`/classrooms/${id}/call/start`);
      const link = response.data.link;
      if (link) {
        const w = window.open(link, '_blank');
        if (w) w.opener = null;
      } else {
        toast.error('Could not create lecture link');
      }
    } catch (error) {
      if (error.response?.data?.googleAuthRequired) {
        // Redirect user to backend Google consent flow using full backend URL
        const apiBase = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '';
        window.location.href = `${apiBase}/api/google-auth/start-consent?userId=${user?._id}&classroomId=${id}`;
      } else {
        toast.error(error.response?.data?.message || 'Error starting lecture');
      }
    }
  };

  const handleJoinCall = async () => {
    if (!checkTopicAccess()) return;

    try {
      const resp = await api.get(`/classrooms/${id}/call`);
      const link = resp.data.link;
      if (link) {
        // Mark attendance silently
        try {
          if (user?.role === 'student') {
            await api.post(`/classrooms/${id}/call/attend`, {}, { skipLoader: true });
          }
        } catch (attendErr) {
          console.error('Failed to mark attendance:', attendErr);
        }

        const w = window.open(link, '_blank');
        if (w) w.opener = null;
      } else {
        toast.error('No active lecture found');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error joining lecture');
    }
  };

  const handleOpenWhiteboard = async () => {
    if (!checkTopicAccess()) return;

    try {
      // if server provided a published whiteboard URL, open that first
      if (whiteboardInfo && whiteboardInfo.whiteboardUrl) {
        const w = window.open(whiteboardInfo.whiteboardUrl, '_blank');
        if (w) w.opener = null;
        return;
      }
      // otherwise open the built-in whiteboard route for this class in a new tab
      const url = `${window.location.origin}/classrooms/${id}/whiteboard`;
      const w = window.open(url, '_blank');
      if (w) w.opener = null; // security: prevent access to opener
    } catch (err) {
      console.error('Error opening whiteboard', err);
    }
  };

  const fetchAvailableStudents = async () => {
    try {
      // Backend already filters students by schoolId for school admins
      const response = await api.get('/users');
      // Filter to get only students (backend may have already filtered by schoolId for school admins)
      let students = response.data.users.filter(u => u.role === 'student');

      // Filter out already enrolled students
      if (classroom) {
        const enrolledIds = classroom.students?.map(s => (typeof s === 'object' ? s._id?.toString() : s?.toString())) || [];
        const available = students.filter(s => !enrolledIds.includes(s._id?.toString()));
        setAvailableStudents(available);
      } else {
        setAvailableStudents(students);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAvailableTeachers = async () => {
    try {
      const response = await api.get('/users');
      const teachers = response.data.users.filter(u =>
        ['teacher', 'personal_teacher'].includes(u.role)
      );
      setAvailableTeachers(teachers);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const [isAddingStudent, setIsAddingStudent] = useState(false);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setIsAddingStudent(true);
    try {
      await api.post(`/classrooms/${id}/students`, { studentId: selectedStudentId }, { skipLoader: true });
      toast.success('Student added successfully!');
      setShowAddStudentModal(false);
      setSelectedStudentId(''); // Reset selected student ID
      fetchClassroom();
      fetchAvailableStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error adding student');
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleRemoveStudent = (studentId) => {
    setStudentToRemove(studentId);
    setShowRemoveStudentModal(true);
  };

  const confirmRemoveStudent = async () => {
    if (!studentToRemove) return;
    setIsRemovingStudent(true);
    try {
      await api.delete(`/classrooms/${id}/students/${studentToRemove}`);
      toast.success('Student removed successfully!');
      setShowRemoveStudentModal(false);
      setStudentToRemove(null);
      fetchClassroom();
      fetchAvailableStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error removing student');
    } finally {
      setIsRemovingStudent(false);
    }
  };

  const [isChangingTeacher, setIsChangingTeacher] = useState(false);

  const handleChangeTeacher = async (e) => {
    e.preventDefault();
    setIsChangingTeacher(true);
    try {
      await api.put(`/classrooms/${id}/teacher`, { teacherId: selectedTeacherId }, { skipLoader: true });
      toast.success('Teacher updated successfully!');
      setShowChangeTeacherModal(false);
      setSelectedTeacherId('');
      fetchClassroom();
      toast.error(error.response?.data?.message || 'Error changing teacher');
    } finally {
      setIsChangingTeacher(false);
    }
  };

  const [showDeleteClassModal, setShowDeleteClassModal] = useState(false);
  const [isDeletingClass, setIsDeletingClass] = useState(false);

  const handleDeleteClassroomClick = () => {
    setShowDeleteClassModal(true);
  };

  const confirmDeleteClassroom = async () => {
    setIsDeletingClass(true);
    try {
      await api.delete(`/classrooms/${id}`);
      toast.success('Classroom deleted successfully');
      navigate('/classrooms');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting classroom');
      setIsDeletingClass(false);
    }
  };

  const isEnrolled = classroom?.students?.some(s => s._id === user?._id) ||
    user?.enrolledClasses?.includes(id);

  // Can manage school access
  const classroomSchoolIds = (Array.isArray(classroom?.schoolId) ? classroom.schoolId : [classroom?.schoolId]).filter(Boolean);
  const isSchoolAdminOfClass = user?.role === 'school_admin' && classroomSchoolIds.some(s => {
    const adminId = s?.adminId?._id || s?.adminId;
    return adminId?.toString() === user?._id?.toString();
  });

  // Unpublished classes can be edited by teacher, personal teacher, school admin, and root admin
  // Published classes can only be edited by their teacher or admins
  const canEdit =
    user?.role === 'root_admin' ||
    isSchoolAdminOfClass ||
    (user?.role === 'teacher' && classroom?.teacherId?._id === user?._id) ||
    (user?.role === 'personal_teacher' && classroom?.teacherId?._id === user?._id) ||
    (!classroom?.published && (user?.role === 'root_admin' || isSchoolAdminOfClass || (classroom?.teacherId?._id === user?._id)));

  const canManageStudents =
    user?.role === 'root_admin' ||
    isSchoolAdminOfClass ||
    (user?.role === 'personal_teacher' && classroom?.teacherId?._id === user?._id);

  // Can change teacher (root admin only, for non-personal teacher classes)
  const canChangeTeacher =
    user?.role === 'root_admin' &&
    classroom?.schoolId &&
    classroom?.teacherId?.role !== 'personal_teacher';

  // Can view students (teachers can see their students)
  const canViewStudents =
    user?.role === 'teacher' && classroom?.teacherId?._id === user?._id ||
    user?.role === 'personal_teacher' && classroom?.teacherId?._id === user?._id ||
    canManageStudents ||
    user?.role === 'root_admin';

  // Can create assignments (same as canEdit for now)
  const canCreateAssignment = canEdit;
  // Can grade assignments (same as canEdit for now)
  const canGradeAssignment = canEdit;

  if (loading || userLoading) {
    return <Layout><div className="text-center py-8">Loading...</div></Layout>;
  }
  if (!user || !user._id) {
    return <Layout><div className="text-center py-8 text-red-600">User session invalid. Please log in again.</div></Layout>;
  }

  if (!classroom) {
    return <Layout><div className="text-center py-8">Classroom not found</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header Row: Title, Tags, Edit Button */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800">{classroom.name}</h2>
                {classroom.isPaid && classroom.pricing?.amount > 0 ? (
                  <div className="flex flex-col">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}
                    </span>
                    {classroom.pricing?.type && classroom.pricing.type !== 'free' && (
                      <span className="text-[10px] text-gray-500 font-medium uppercase mt-1 text-center">
                        {classroom.pricing.type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                    Free
                  </span>
                )}
              </div>
              {classroom.description && (
                <p className="text-gray-600 text-sm md:text-base">{classroom.description}</p>
              )}
              {classroom.learningOutcomes && (
                <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <h4 className="font-semibold text-indigo-900 mb-2">Expected Learning Outcomes</h4>
                  <p className="text-gray-700 text-sm md:text-base whitespace-pre-wrap">{classroom.learningOutcomes}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-4 mt-2">
                {classroom.subject && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Book className="w-4 h-4 mr-2" />
                    <span className="font-medium">Subject:</span> <span className="ml-1">{classroom.subject}</span>
                  </div>
                )}
                {classroom.level && (
                  <div className="flex items-center text-sm text-gray-600">
                    <GraduationCap className="w-4 h-4 mr-2" />
                    <span className="font-medium">Level:</span> <span className="ml-1">{classroom.level}</span>
                  </div>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2 mt-2 lg:mt-0">
                <button
                  onClick={handlePublishToggle}
                  disabled={publishing}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition font-medium ${classroom.published
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  title={classroom.published ? 'Published - Click to unpublish' : 'Unpublished - Click to publish'}
                >
                  {publishing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : classroom.published ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4 opacity-50" />
                  )}
                  <span className="hidden md:inline">{classroom.published ? 'Published' : 'Unpublished'}</span>
                </button>
                <button
                  onClick={handleOpenEdit}
                  className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition shrink-0 self-start"
                  title="Edit Classroom"
                >
                  <Edit className="w-4 h-4" />
                  <span className="hidden md:inline">Edit</span>
                </button>
                {/* End Class Button */}
                <button
                  onClick={() => setShowEndClassModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shrink-0 self-start"
                  title="End Classroom (Reset)"
                >
                  <Flag className="w-4 h-4" />
                  <span className="hidden md:inline">End Class</span>
                </button>
                {/* Delete Button (Only for admins or personal teacher owners) */}
                {(user?.role === 'root_admin' || isSchoolAdminOfClass || (user?.role === 'personal_teacher' && user?._id === classroom.teacherId?._id)) && (
                  <button
                    onClick={handleDeleteClassroomClick}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shrink-0 self-start"
                    title="Delete Classroom"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden md:inline">Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Edit Classroom Modal */}
          {showEditModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl animate-slide-up">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Edit Classroom</h2>
                  <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleEditClassroom} className="space-y-8 pb-4">
                  {/* Basic Info */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Class Title</label>
                      <input
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="e.g. Advanced Mathematics Masterclass"
                        className="w-full"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Academic Level</label>
                      <Select
                        options={levelOptions}
                        value={levelOptions.find(opt => opt.value === editForm.level)}
                        onChange={sel => setEditForm({ ...editForm, level: sel?.value })}
                        className="modern-select"
                        menuPortalTarget={document.body}
                        styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Subject</label>
                      <CreatableSelect
                        options={subjectOptions}
                        value={editForm.subject ? { value: editForm.subject, label: editForm.subject } : null}
                        onChange={sel => setEditForm({ ...editForm, subject: sel?.value || '' })}
                        className="modern-select"
                        menuPortalTarget={document.body}
                        styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Description</label>
                      <textarea
                        value={editForm.description}
                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Tell students what this class is about..."
                        className="w-full min-h-[100px]"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Learning Outcomes</label>
                      <textarea
                        value={editForm.learningOutcomes}
                        onChange={e => setEditForm({ ...editForm, learningOutcomes: e.target.value })}
                        placeholder="List what students will achieve (comma separated)..."
                        className="w-full min-h-[80px]"
                      />
                    </div>
                  </div>

                  {/* Roles & Visibility */}
                  <div className="grid md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    {(user?.role === 'root_admin' || user?.role === 'school_admin') && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Assign Teacher</label>
                        <Select
                          options={availableTeachers.map(t => ({ value: t._id, label: `${t.name} (${t.email})` }))}
                          value={availableTeachers.find(t => t._id === editForm.teacherId) ? { value: editForm.teacherId, label: availableTeachers.find(t => t._id === editForm.teacherId).name } : null}
                          onChange={sel => setEditForm({ ...editForm, teacherId: sel?.value })}
                          placeholder="Select a teacher..."
                          className="modern-select"
                          menuPortalTarget={document.body}
                          styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                        />
                      </div>
                    )}

                    {user?.role === 'school_admin' && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Assign to Schools</label>
                        <Select
                          isMulti
                          options={[{ _id: 'ALL', name: 'ALL SCHOOLS' }, ...schools].map(s => ({ value: s._id, label: s.name }))}
                          value={editForm.schoolIds?.map(id => {
                            const s = [{ _id: 'ALL', name: 'ALL SCHOOLS' }, ...schools].find(sch => sch._id === id);
                            return { value: id, label: s?.name || id };
                          })}
                          onChange={sels => setEditForm({ ...editForm, schoolIds: sels ? sels.map(s => s.value) : [] })}
                          className="modern-select"
                          menuPortalTarget={document.body}
                          styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Max Capacity</label>
                      <input
                        type="number"
                        value={editForm.capacity}
                        onChange={e => setEditForm({ ...editForm, capacity: parseInt(e.target.value) || 30 })}
                        className="w-full"
                        min="1"
                      />
                    </div>

                    <div className="flex items-center gap-6 pt-4">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div
                          className={`w-10 h-6 rounded-full transition-colors relative ${editForm.isPrivate ? 'bg-indigo-600' : 'bg-slate-300'}`}
                          onClick={() => setEditForm({ ...editForm, isPrivate: !editForm.isPrivate })}
                        >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${editForm.isPrivate ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 uppercase">Private</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div
                          className={`w-10 h-6 rounded-full transition-colors relative ${editForm.isPaid ? 'bg-indigo-600' : 'bg-slate-300'}`}
                          onClick={() => setEditForm({ ...editForm, isPaid: !editForm.isPaid })}
                        >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${editForm.isPaid ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 uppercase">Paid Class</span>
                      </label>
                    </div>
                  </div>

                  {/* Pricing details if paid */}
                  {editForm.isPaid && (
                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 animate-slide-up">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                          <label className="text-sm font-bold text-primary uppercase tracking-wider">Billing Cycle</label>
                          <Select
                            options={[
                              { value: 'per_lecture', label: 'Per Lecture' },
                              { value: 'per_topic', label: 'Per Topic' },
                              { value: 'weekly', label: 'Weekly' },
                              { value: 'monthly', label: 'Monthly' }
                            ]}
                            value={{ value: editForm.pricingType, label: editForm.pricingType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) }}
                            onChange={sel => setEditForm({ ...editForm, pricingType: sel?.value })}
                            className="modern-select"
                            menuPortalTarget={document.body}
                            styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-bold text-primary uppercase tracking-wider">Amount (NGN)</label>
                          <input
                            type="number"
                            value={editForm.pricingAmount}
                            onChange={e => setEditForm({ ...editForm, pricingAmount: parseFloat(e.target.value) || 0 })}
                            className="w-full border-primary/20 focus:ring-primary/20"
                            placeholder="0.00"
                            required={editForm.isPaid}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Schedule Builder */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Weekly Schedule</label>
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, schedule: [...editForm.schedule, { dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00' }] })}
                        className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Session
                      </button>
                    </div>

                    <div className="space-y-3">
                      {editForm.schedule.map((s, idx) => (
                        <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-slide-up">
                          <select
                            value={s.dayOfWeek}
                            onChange={e => {
                              const newSched = [...editForm.schedule];
                              newSched[idx].dayOfWeek = e.target.value;
                              setEditForm({ ...editForm, schedule: newSched });
                            }}
                            className="flex-1 min-w-[120px] bg-white border-slate-200 rounded-lg text-sm"
                          >
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d}>{d}</option>)}
                          </select>
                          <input
                            type="time"
                            value={s.startTime}
                            onChange={e => {
                              const newSched = [...editForm.schedule];
                              newSched[idx].startTime = e.target.value;
                              setEditForm({ ...editForm, schedule: newSched });
                            }}
                            className="w-32 bg-white border-slate-200 rounded-lg text-sm"
                          />
                          <span className="text-slate-400">to</span>
                          <input
                            type="time"
                            value={s.endTime}
                            onChange={e => {
                              const newSched = [...editForm.schedule];
                              newSched[idx].endTime = e.target.value;
                              setEditForm({ ...editForm, schedule: newSched });
                            }}
                            className="w-32 bg-white border-slate-200 rounded-lg text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newSched = editForm.schedule.filter((_, i) => i !== idx);
                              setEditForm({ ...editForm, schedule: newSched });
                            }}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {editForm.schedule.length === 0 && (
                        <p className="text-sm text-slate-400 italic text-center py-4">No sessions scheduled yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-8 flex gap-4 sticky bottom-0 bg-white pb-2 border-t border-slate-50">
                    <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition">Discard</button>
                    <button type="submit" disabled={isEditing} className="btn-premium flex-1">
                      {isEditing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4 border-t border-b border-gray-100 mb-6">
            <div className="flex items-center space-x-3 text-gray-600">
              <User className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="text-sm">
                <span className="block font-medium text-gray-900">Teacher</span>
                <span>{classroom.teacherId?.name || 'Unknown Teacher'}</span>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-gray-600">
              <School className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="text-sm">
                <span className="block font-medium text-gray-900">School / Tutorial</span>
                <span className="truncate max-w-[200px] block" title={(Array.isArray(classroom.schoolId) ? classroom.schoolId.map(s => s?.name || s).join(', ') : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}>
                  {(Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}
                  {Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 && ` +${classroom.schoolId.length - 1}`}
                </span>
              </div>
            </div>
            <div className="flex items-start space-x-3 text-gray-600">
              <Calendar className="w-5 h-5 mt-0.5 text-gray-400 shrink-0" />
              <div className="text-sm">
                {classroom.schedule && classroom.schedule.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {classroom.schedule.map((session, index) => {
                      const local = convertUTCToLocal(session.dayOfWeek, session.startTime);
                      const localEnd = convertUTCToLocal(session.dayOfWeek, session.endTime);
                      return (
                        <span key={index} className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                          {local.dayOfWeek ? local.dayOfWeek.substring(0, 3) : 'N/A'} {local.hhmm}-{localEnd.hhmm} ({local.timezone})
                        </span>
                      );
                    })}
                    <div className="w-full mt-1 text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                      (Weekly Recurring Sessions)
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400">No schedule</span>
                )}
              </div>
            </div>
            {user?.role !== 'student' && (
              <div className="flex items-center space-x-3 text-gray-600">
                <Users className="w-5 h-5 text-gray-400 shrink-0" />
                <span className="text-sm">{classroom.students?.length || 0} students</span>
              </div>
            )}
            <div className="flex items-center space-x-3 text-gray-600">
              <Book className="w-5 h-5 text-gray-400 shrink-0" />
              <span className="text-sm">{classroom.topics?.length || 0} topics</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isEnrolled && user?.role === 'student' && classroom.published && (
              <button
                onClick={handleEnroll}
                className="btn-premium"
              >
                {classroom.isPaid && classroom.pricing?.amount > 0 ? `Enroll - ${formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}` : 'Enroll (Free)'}
              </button>
            )}
            {!isEnrolled && user?.role === 'student' && !classroom.published && (
              <span className="px-6 py-2 bg-gray-300 text-gray-600 rounded-lg font-semibold">
                Not Available for Enrollment
              </span>
            )}
            {isEnrolled && user?.role === 'student' && (
              <button
                onClick={() => setShowLeaveClassModal(true)}
                className="btn-danger"
              >
                Leave Class
              </button>
            )}
            {(isEnrolled || canEdit) && (
              <>
                {/* Determine starter permission clearly */}
                {(() => {
                  const teacherIdStr = classroom.teacherId?._id ? classroom.teacherId._id.toString() : (classroom.teacherId ? classroom.teacherId.toString() : null);
                  const isTeacherOwner = teacherIdStr && user._id.toString() === teacherIdStr;
                  const isRoot = user.role === 'root_admin';
                  const classroomSchoolIdsForMeeting = (Array.isArray(classroom.schoolId) ? classroom.schoolId : [classroom.schoolId]).filter(Boolean);
                  const isSchoolAdminOfClass = user.role === 'school_admin' && classroomSchoolIdsForMeeting.some(s => {
                    const adminId = s?.adminId?._id || s?.adminId;
                    return adminId?.toString() === user?._id?.toString();
                  });
                  const canStartCall = isTeacherOwner || isRoot || isSchoolAdminOfClass;

                  if (canStartCall) {
                    // For starters show a single CTA: 'Start Lecture' when no current call exists, otherwise 'Attend Lecture'
                    const label = currentCall && currentCall.link ? 'Attend Lecture' : 'Start Lecture';
                    return (
                      <button
                        onClick={handleStartZoom}
                        className="btn-premium flex-1 sm:flex-none shadow-indigo-200"
                      >
                        <Video className="w-5 h-5" />
                        <span>{label}</span>
                      </button>
                    );
                  }

                  // Not a starter: fall back to attend button for enrolled students
                  if (isEnrolled) {
                    return (
                      <button
                        onClick={handleJoinCall}
                        className="btn-premium flex-1 sm:flex-none shadow-indigo-200"
                      >
                        <Video className="w-5 h-5" />
                        <span>Attend Lecture</span>
                      </button>
                    );
                  }

                  return null;
                })()}

                {
                  (() => {
                    const isTeacherUser = (user?.role === 'teacher' || user?.role === 'personal_teacher') && classroom?.teacherId?._id === user?._id;
                    const isAdmin = user?.role === 'root_admin' || user?.role === 'school_admin';
                    const wbAvailable = whiteboardInfo && (whiteboardInfo.sessionId || whiteboardInfo.whiteboardUrl);
                    const enabled = isTeacherUser || isAdmin || !!wbAvailable;
                    return (
                      <button
                        onClick={handleOpenWhiteboard}
                        disabled={!enabled}
                        title={!enabled ? 'Whiteboard not launched yet by the teacher' : 'Open whiteboard'}
                        className={`flex-1 sm:flex-none ${enabled ? 'btn-success' : 'btn-secondary opacity-50 cursor-not-allowed'}`}
                      >
                        <Edit className="w-5 h-5" />
                        <span>Whiteboard</span>
                      </button>
                    );
                  })()
                }
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-x-auto mt-6 no-scrollbar">
          {[
            { id: 'topics', label: 'Topics', icon: Book },
            ...((isEnrolled || canEdit) ? [
              { id: 'assignments', label: 'Assignments', icon: FileText },
              { id: 'exams', label: 'Exams', icon: GraduationCap }
            ] : []),
            ...(canViewStudents ? [{ id: 'students', label: 'Students', icon: Users }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === 'exams' && exams.length > 0 && (
                <span className="ml-2 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{exams.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'topics' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Current Topic Display */}
            {
              (isEnrolled || canEdit) && classroom.currentTopicId && (
                <TopicDisplay classroomId={id} />
              )
            }

            {/* Topic Management Section */}
            {
              (isEnrolled || canEdit || (!isEnrolled && user?.role === 'student')) && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">Topics</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {classroom.topics?.length || 0} topic{classroom.topics?.length !== 1 ? 's' : ''} created
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => setShowTopicModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition shadow-md"
                      >
                        <Book className="w-4 h-4" />
                        <span>Manage Topics</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {classroom.topics && classroom.topics.length > 0 ? (
                      (() => {
                        const sortedTopics = [...classroom.topics].sort((a, b) => (a.order || 0) - (b.order || 0));
                        const activeIndex = sortedTopics.findIndex(t => t.status === 'active');
                        let nextId = null;
                        if (activeIndex !== -1) {
                          const nextTopic = sortedTopics.find((t, i) => i > activeIndex && t.status === 'pending');
                          if (nextTopic) nextId = nextTopic._id;
                        } else {
                          const firstPending = sortedTopics.find(t => t.status === 'pending');
                          if (firstPending) nextId = firstPending._id;
                        }

                        return sortedTopics.map((topic, index) => {
                          const isNext = topic._id === nextId;
                          const isCurrent = topic.status === 'active';
                          const isDone = topic.status === 'completed';
                          const isPending = topic.status === 'pending' && !isNext;

                          return (
                            <div
                              key={topic._id}
                              className={`border-2 rounded-lg p-4 transition ${isCurrent ? 'border-blue-400 bg-blue-50' :
                                isDone ? 'border-green-200 bg-green-50 opacity-75' :
                                  isNext ? 'border-indigo-300 bg-indigo-50 shadow-sm' :
                                    'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-1">
                                  {isDone ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                  ) : isCurrent ? (
                                    <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
                                  ) : isNext ? (
                                    <Play className="w-5 h-5 text-indigo-600" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h4 className="font-semibold text-gray-800">{topic.name}</h4>
                                    {isCurrent && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                        Current
                                      </span>
                                    )}
                                    {isDone && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                        Done
                                      </span>
                                    )}
                                    {isNext && (
                                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-semibold">
                                        Next
                                      </span>
                                    )}
                                    {isPending && (
                                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  {topic.description && (
                                    <p className="text-sm text-gray-600 line-clamp-2">{topic.description}</p>
                                  )}
                                  {topic.lessonsOutline && (
                                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                      <p className="font-medium text-gray-700 mb-1">Lesson Outline:</p>
                                      <p className="line-clamp-3 whitespace-pre-wrap">{topic.lessonsOutline}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Book className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No topics added yet</p>
                        {canEdit && (
                          <p className="text-sm mt-1">Click "Manage Topics" to create your first topic</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            }</div>
        )}

        {activeTab === 'assignments' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Assignment Management Section */}
            {
              (isEnrolled || canEdit) && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Assignments</h3>
                    {canCreateAssignment && (
                      <button
                        onClick={() => setShowCreateAssignmentModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden md:inline">Create Assignment</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {classroom.assignments && classroom.assignments.length > 0 ? (
                      classroom.assignments.map((assignment) => {
                        const submission = assignment.submissions?.find(
                          s => s.studentId?._id === user?._id
                        );
                        const isSubmitted = !!submission;
                        const isGraded = submission?.status === 'graded';

                        const isAssignmentExpanded = expandedAssignments.has(assignment._id);
                        const toggleAssignmentExpanded = () => {
                          setExpandedAssignments(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(assignment._id)) {
                              newSet.delete(assignment._id);
                            } else {
                              newSet.add(assignment._id);
                            }
                            return newSet;
                          });
                        };

                        return (
                          <div key={assignment._id} className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div
                              className="flex flex-col md:flex-row justify-between items-start p-6 cursor-pointer hover:bg-gray-50 transition"
                              onClick={toggleAssignmentExpanded}
                            >
                              <div className="flex items-start space-x-3 flex-1 mb-4 md:mb-0">
                                {isAssignmentExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-gray-600 mt-1 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-600 mt-1 flex-shrink-0" />
                                )}
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-800">
                                    {assignment.title}
                                    {assignment.topicId?.name && (
                                      <span className="ml-2 text-sm font-normal text-gray-500">
                                        ({assignment.topicId.name})
                                      </span>
                                    )}
                                  </h4>
                                  {!isAssignmentExpanded && (
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{assignment.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 items-center md:justify-end flex-shrink-0 w-full md:w-auto ml-8 md:ml-0">
                                {assignment.dueDate ? (
                                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-semibold">
                                    Due: {formatDisplayDate(assignment.dueDate)}
                                  </span>
                                ) : (
                                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-semibold">
                                    No Due Date
                                  </span>
                                )}
                                {assignment.assignmentType === 'mcq' && assignment.publishResultsAt && (
                                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-semibold">
                                    Results: {formatDisplayDate(assignment.publishResultsAt)}
                                    {/* Only show "Pending" if results not published AND student hasn't submitted yet */}
                                    {new Date() < new Date(assignment.publishResultsAt) && !isSubmitted && (
                                      <span className="ml-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold">Pending</span>
                                    )}
                                  </span>
                                )}
                                {/* Show "Graded" only if graded AND (theory OR MCQ with results published) */}
                                {isGraded && (assignment.assignmentType === 'theory' || (assignment.assignmentType === 'mcq' && (!assignment.publishResultsAt || new Date() >= new Date(assignment.publishResultsAt)))) && (
                                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                                    Graded
                                  </span>
                                )}
                                {/* Show "Submitted" only if submitted AND NOT graded */}
                                {isSubmitted && !isGraded && (
                                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                                    Submitted
                                  </span>
                                )}
                                {/* Show "Submitted" for MCQ that is graded but results not published yet */}
                                {isSubmitted && isGraded && assignment.assignmentType === 'mcq' && assignment.publishResultsAt && new Date() < new Date(assignment.publishResultsAt) && (
                                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                                    Submitted
                                  </span>
                                )}
                                {canEdit && (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAssignmentPublishToggle(assignment);
                                      }}
                                      disabled={publishingAssignmentId === assignment._id}
                                      className={`p-1 transition-colors ${assignment.published !== false ? 'text-green-500 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                      title={assignment.published !== false ? 'Published - Click to unpublish' : 'Unpublished - Click to publish'}
                                    >
                                      {publishingAssignmentId === assignment._id ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                      ) : assignment.published !== false ? (
                                        <Eye className="w-5 h-5" />
                                      ) : (
                                        <EyeOff className="w-5 h-5" />
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleNotifyStudents(assignment._id);
                                      }}
                                      disabled={notifyingAssignmentId === assignment._id}
                                      className="text-blue-500 hover:text-blue-700 p-1 disabled:opacity-50"
                                      title="Notify students (re-publish)"
                                    >
                                      {notifyingAssignmentId === assignment._id ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                      ) : (
                                        <Megaphone className="w-5 h-5 transition-colors" />
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenEditAssignment(assignment);
                                      }}
                                      className="text-yellow-500 hover:text-yellow-700 p-1"
                                      title="Edit assignment"
                                    >
                                      <Edit className="w-5 h-5 transition-colors" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAssignment(assignment._id);
                                      }}
                                      className="text-red-500 hover:text-red-700 p-1"
                                      title="Delete assignment"
                                    >
                                      <X className="w-5 h-5 transition-colors" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {isAssignmentExpanded && (
                              <div className="px-6 pb-6 border-t">
                                <div className="pt-4">
                                  <p className="text-sm text-gray-600 mb-4">{assignment.description}</p>
                                </div>

                                {user?.role === 'student' && isGraded && submission && (assignment.assignmentType === 'theory' || (assignment.assignmentType === 'mcq' && (!assignment.publishResultsAt || new Date() >= new Date(assignment.publishResultsAt)))) && (
                                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                    <div className="flex items-center space-x-2 mb-2">
                                      <CheckCircle className="w-5 h-5 text-green-600" />
                                      <span className="font-semibold">
                                        Score: {submission.score}/{assignment.maxScore}
                                      </span>
                                    </div>
                                    {submission.feedback && (
                                      <p className="text-gray-700 mt-2">Feedback: {submission.feedback}</p>
                                    )}
                                    <div className="mt-4 border-t pt-4">
                                      <h5 className="font-semibold text-gray-700 mb-2">Your Submission:</h5>
                                      {assignment.assignmentType === 'theory' && submission.answers && Array.isArray(submission.answers) && (
                                        <ul className="list-disc list-inside text-gray-700">
                                          {assignment.questions.map((q, qIndex) => {
                                            const questionGrade = submission.questionScores?.find(qs => qs.questionIndex === qIndex);
                                            return (
                                              <li key={qIndex}>
                                                <strong>Q{qIndex + 1}:</strong> {q.questionText}<br />
                                                Your Answer: <span className="whitespace-pre-wrap">{submission.answers[qIndex]}</span><br />
                                                {questionGrade && (
                                                  <span className="ml-2 text-sm font-medium text-green-600">
                                                    Score: {questionGrade.score}/{q.maxScore}
                                                    {questionGrade.feedback && ` - Feedback: ${questionGrade.feedback}`}
                                                  </span>
                                                )}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                      {assignment.assignmentType === 'mcq' && submission.answers && Array.isArray(submission.answers) && (
                                        <ul className="list-disc list-inside text-gray-700">
                                          {assignment.questions.map((q, qIndex) => (
                                            <li key={qIndex}>
                                              <strong>Q{qIndex + 1}:</strong> {q.questionText}<br />
                                              Your Answer: {submission.answers[qIndex]}
                                              {q.correctOption && (
                                                <span className={`ml-2 text-sm font-medium ${submission.answers[qIndex] === q.correctOption ? 'text-green-600' : 'text-red-600'}`}>
                                                  ({submission.answers[qIndex] === q.correctOption ? 'Correct' : `Incorrect, Correct: ${q.correctOption}`})
                                                </span>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Student View: Submitted but not graded, or MCQ graded but results not published yet */}
                                {user?.role === 'student' && isSubmitted && (!isGraded || (assignment.assignmentType === 'mcq' && assignment.publishResultsAt && new Date() < new Date(assignment.publishResultsAt))) && (
                                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                    <p className="font-semibold text-blue-600">
                                      {isGraded && assignment.assignmentType === 'mcq' && assignment.publishResultsAt && new Date() < new Date(assignment.publishResultsAt)
                                        ? `Results for this MCQ assignment will be published on ${new Date(assignment.publishResultsAt).toLocaleString()}.`
                                        : 'Your assignment has been submitted and is awaiting grading.'
                                      }
                                    </p>
                                    <div className="mt-4 border-t pt-4">
                                      <h5 className="font-semibold text-gray-700 mb-2">Your Submission:</h5>
                                      {assignment.assignmentType === 'theory' && submission.answers && Array.isArray(submission.answers) && (
                                        <ul className="list-disc list-inside text-gray-700">
                                          {assignment.questions.map((q, qIndex) => (
                                            <li key={qIndex}>
                                              <strong>Q{qIndex + 1}:</strong> {q.questionText}<br />
                                              Your Answer: <span className="whitespace-pre-wrap">{submission.answers[qIndex]}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                      {assignment.assignmentType === 'theory' && submission.answers && !Array.isArray(submission.answers) && (
                                        <p className="text-gray-700">{submission.answers}</p>
                                      )}
                                      {assignment.assignmentType === 'mcq' && submission.answers && Array.isArray(submission.answers) && (
                                        <ul className="list-disc list-inside text-gray-700">
                                          {assignment.questions.map((q, qIndex) => (
                                            <li key={qIndex}>
                                              <strong>Q{qIndex + 1}:</strong> {q.questionText}<br />
                                              Your Answer: {submission.answers[qIndex]}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {user?.role === 'student' && !isSubmitted && (
                                  (() => {
                                    const isPastDue = assignment.dueDate && new Date() > new Date(assignment.dueDate);
                                    return (
                                      <button
                                        onClick={(e) => {
                                          if (isPastDue) return;
                                          e.stopPropagation();

                                          // Check topic access before opening submit modal
                                          // assignment.topicId might be populated or just ID
                                          const topicId = assignment.topicId?._id || assignment.topicId;
                                          if (!checkTopicAccess(topicId)) return;

                                          setAssignmentToSubmit(assignment);
                                          setShowSubmitAssignmentModal(true);
                                        }}
                                        disabled={isPastDue}
                                        className={`px-4 py-2 rounded-lg transition ${isPastDue
                                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                          : 'bg-blue-600 text-white hover:bg-blue-700'
                                          }`}
                                      >
                                        {isPastDue ? 'Deadline Passed' : 'Submit Assignment'}
                                      </button>
                                    );
                                  })()
                                )}

                                {/* Teacher/Admin: View and Grade Submissions */}
                                {canGradeAssignment && (user?.role === 'teacher' || user?.role === 'personal_teacher' ? classroom.teacherId?._id === user?._id : true) && (
                                  <div className="mt-4 border-t pt-4">
                                    <h4 className="font-semibold text-gray-700 mb-3">Submissions ({assignment.submissions?.length || 0}):</h4>
                                    {assignment.submissions && assignment.submissions.length > 0 ? (
                                      assignment.submissions.map(sub => {
                                        const isExpanded = expandedSubmissions.has(sub._id);
                                        const toggleExpanded = () => {
                                          setExpandedSubmissions(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(sub._id)) {
                                              newSet.delete(sub._id);
                                            } else {
                                              newSet.add(sub._id);
                                            }
                                            return newSet;
                                          });
                                        };

                                        return (
                                          <div key={sub._id} className="border rounded-lg mb-2 bg-gray-50 overflow-hidden">
                                            <div
                                              className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-100 transition"
                                              onClick={toggleExpanded}
                                            >
                                              <div className="flex items-center space-x-2 flex-1">
                                                {isExpanded ? (
                                                  <ChevronUp className="w-4 h-4 text-gray-600" />
                                                ) : (
                                                  <ChevronDown className="w-4 h-4 text-gray-600" />
                                                )}
                                                <div className="flex-1">
                                                  <p className="font-medium text-gray-800">{sub.studentId?.name || 'Unknown Student'}</p>
                                                  <p className="text-sm text-gray-600">Status: {sub.status}</p>
                                                  {sub.status === 'graded' && (
                                                    <p className="text-sm text-gray-600">Score: {sub.score}/{assignment.maxScore}</p>
                                                  )}
                                                </div>
                                              </div>
                                              {sub.status !== 'graded' ? (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedAssignmentForGrading(assignment);
                                                    setSubmissionToGrade(sub);
                                                    setShowGradeModal(true);
                                                  }}
                                                  className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                                                >
                                                  Grade
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedAssignmentForGrading(assignment);
                                                    setSubmissionToGrade(sub);
                                                    setShowGradeModal(true);
                                                  }}
                                                  className="px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition text-sm"
                                                >
                                                  Edit Grade
                                                </button>
                                              )}
                                            </div>
                                            {isExpanded && (
                                              <div className="px-3 pb-3 pt-0 border-t bg-white">
                                                {/* Display answers based on type */}
                                                {assignment.assignmentType === 'theory' && sub.answers && (
                                                  <div className="mt-2">
                                                    <p className="text-sm font-medium text-gray-700 mb-1">Answer:</p>
                                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{Array.isArray(sub.answers) ? sub.answers.join('\n') : sub.answers}</p>
                                                  </div>
                                                )}
                                                {assignment.assignmentType === 'mcq' && sub.answers && Array.isArray(sub.answers) && (
                                                  <div className="mt-2">
                                                    <p className="text-sm font-medium text-gray-700 mb-1">Selected options:</p>
                                                    <ul className="list-disc list-inside text-sm text-gray-600">
                                                      {sub.answers.map((ans, ansIdx) => (
                                                        <li key={ansIdx}>
                                                          {ans}
                                                          {assignment.questions[ansIdx]?.correctOption && (
                                                            <span className={`ml-2 text-sm font-medium ${ans === assignment.questions[ansIdx].correctOption ? 'text-green-600' : 'text-red-600'}`}>
                                                              ({ans === assignment.questions[ansIdx].correctOption ? 'Correct' : `Incorrect, Correct: ${assignment.questions[ansIdx].correctOption}`})
                                                            </span>
                                                          )}
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                )}
                                                {/* Add display for files if available in sub.files */}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-gray-500 text-center py-2">No submissions yet.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-4">No assignments for this classroom yet</p>
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Class Examinations</h3>
                  <p className="text-sm text-gray-500 mt-1">Access scheduled assessments and final exams.</p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => navigate(`/exams/create?classId=${id}`)}
                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Exam</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {exams.length > 0 ? (
                  exams.map(exam => {
                    const isPastDue = exam.dueDate && new Date() > new Date(exam.dueDate);
                    return (
                      <div key={exam._id} className="group bg-gray-50 hover:bg-white rounded-2xl p-6 border border-transparent hover:border-indigo-100 hover:shadow-xl transition-all duration-300">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-start space-x-4">
                            <div className={`p-4 rounded-xl ${isPastDue ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-600'}`}>
                              <GraduationCap className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-lg font-black text-gray-900 leading-tight mb-1 group-hover:text-indigo-600 transition-colors">{exam.title}</h4>
                              <p className="text-sm text-gray-500 font-medium line-clamp-1">{exam.description || 'No description provided.'}</p>

                              <div className="flex flex-wrap gap-4 mt-3">
                                <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                                  {exam.duration} Minutes
                                </div>
                                {exam.dueDate && (
                                  <div className={`flex items-center text-[10px] font-black uppercase tracking-widest ${isPastDue ? 'text-rose-500' : 'text-gray-400'}`}>
                                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                    Due: {new Date(exam.dueDate).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 self-end md:self-center">
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => navigate(`/exams/${exam._id}/submissions`)}
                                  className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
                                >
                                  Submissions
                                </button>
                                <button
                                  onClick={() => navigate(`/exams/edit/${exam._id}`)}
                                  className="p-2.5 bg-yellow-50 text-yellow-600 border border-yellow-100 rounded-xl hover:bg-yellow-100 transition"
                                  title="Edit Exam"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {user?.role === 'student' && (
                              <button
                                onClick={() => navigate(`/exam-center/${exam.linkToken}`)}
                                disabled={isPastDue || !exam.isPublished}
                                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${isPastDue || !exam.isPublished
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                                  }`}
                              >
                                {isPastDue ? 'Expired' : !exam.isPublished ? 'Unpublished' : (
                                  <>
                                    <span>Take Exam</span>
                                    <Play className="w-4 h-4 fill-current" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100">
                    <GraduationCap className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                    <h5 className="text-gray-900 font-bold">No Exams Scheduled</h5>
                    <p className="text-sm text-gray-400">There are currently no examinations assigned to this class.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && canViewStudents && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Enrolled Students ({classroom.students?.length || 0}/{classroom.capacity})</h3>
                {canManageStudents && (
                  <button
                    onClick={() => {
                      setSelectedStudentId('');
                      fetchAvailableStudents();
                      setShowAddStudentModal(true);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden md:inline">Add Student</span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {classroom.students && classroom.students.length > 0 ? (
                  classroom.students.map((student) => (
                    <div key={student._id || student} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div>
                        <p className="font-medium text-gray-800">{typeof student === 'object' ? student.name : 'Loading...'}</p>
                        <p className="text-sm text-gray-600">{typeof student === 'object' ? student.email : ''}</p>
                      </div>
                      {canManageStudents && (
                        <button
                          onClick={() => handleRemoveStudent(student._id || student)}
                          className="text-red-600 hover:text-red-800 p-2"
                          title="Remove student"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No students enrolled yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {user?.role === 'root_admin' && classroom?.schoolId && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            {/* Teacher Management (Root Admin only - Always visible regardless of tab) */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-semibold">Class Management</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Teacher:</span> {classroom.teacherId?.name} ({classroom.teacherId?.email})
                  </p>
                  {classroom.schoolId?.adminId && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">School Admin:</span> {classroom.schoolId.adminId.name} ({classroom.schoolId.adminId.email})
                    </p>
                  )}
                </div>
              </div>
              {canChangeTeacher && (
                <button
                  onClick={() => {
                    fetchAvailableTeachers();
                    setShowChangeTeacherModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Change Teacher
                </button>
              )}
            </div>
          </div>
        )}

        {/* Topic Management Modal */}
        {
          showTopicModal && (
            <TopicManagementModal
              show={showTopicModal}
              onClose={() => setShowTopicModal(false)}
              classroomId={id}
              onSuccess={fetchClassroom}
            />
          )
        }

        {/* Create Assignment Modal */}
        {
          showCreateAssignmentModal && (
            <CreateAssignmentModal
              show={showCreateAssignmentModal}
              onClose={() => {
                setShowCreateAssignmentModal(false);
                setAssignmentToEdit(null);
              }}
              onSubmitSuccess={handleCreateAssignment} // Pass the success callback
              classroomId={id} // Pass the current classroom ID
              availableTopics={availableTopicsForAssignment}
              editAssignment={assignmentToEdit}
            />
          )
        }

        {/* Grade Assignment Modal */}
        {
          showGradeModal && (
            <GradeAssignmentModal
              show={showGradeModal}
              onClose={() => setShowGradeModal(false)}
              onSubmitSuccess={handleGradeSubmission}
              selectedAssignment={selectedAssignmentForGrading}
              submissionToGrade={submissionToGrade}
            />
          )
        }

        {/* Submit Assignment Modal */}
        {
          showSubmitAssignmentModal && assignmentToSubmit && (
            <SubmitAssignmentModal
              assignment={assignmentToSubmit}
              onClose={() => setShowSubmitAssignmentModal(false)}
              onSubmit={handleSubmitAssignment}
              isSubmitting={isSubmittingAssignment}
            />
          )
        }

        {/* Add Student Modal */}
        {
          showAddStudentModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">Add Student</h3>
                  <button onClick={() => setShowAddStudentModal(false)} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <form onSubmit={handleAddStudent} className="space-y-8">
                  <div>
                    <label>Select Student</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full"
                    >
                      <option value="">Select a student to add</option>
                      {availableStudents.map(student => (
                        <option key={student._id} value={student._id}>{student.name} ({student.email})</option>
                      ))}
                    </select>
                    {availableStudents.length === 0 && (
                      <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                        <p className="text-sm text-slate-500">No available students to add at this time.</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddStudentModal(false)}
                      className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedStudentId || availableStudents.length === 0 || isAddingStudent}
                      className="btn-premium flex-1"
                    >
                      {isAddingStudent ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enroll Student'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        }

        {/* Assign Teacher Modal */}
        {
          showChangeTeacherModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">Assign Teacher</h3>
                  <button onClick={() => setShowChangeTeacherModal(false)} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="space-y-8">
                  <div>
                    <label>Select New Teacher</label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full"
                    >
                      <option value="">Select a teacher</option>
                      {availableTeachers.map(teacher => (
                        <option key={teacher._id} value={teacher._id}>{teacher.name} ({teacher.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowChangeTeacherModal(false)}
                      className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      disabled={!selectedTeacherId || isChangingTeacher}
                      onClick={handleChangeTeacher}
                      className="btn-premium flex-1"
                    >
                      {isChangingTeacher ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Assign Teacher'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Payment Required Modal */}
        <PaymentRequiredModal
          show={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          topic={blockedTopic}
          classroomId={id}
          onSuccess={fetchTopicStatus}
        />

        {/* Enrollment Payment Modal */}
        {
          showEnrollmentPaymentModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
                <div className="p-8 pb-0 flex justify-between items-center">
                  <div className="bg-blue-50 p-3 rounded-2xl">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                  </div>
                  <button
                    onClick={() => setShowEnrollmentPaymentModal(false)}
                    className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400"
                    disabled={isProcessingPayment}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-8 pt-6 text-center">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Join Classroom</h3>
                  <p className="text-slate-500 mb-8 px-4">Complete your payment to gain full access to <span className="font-bold text-slate-700">"{classroom.name}"</span>.</p>

                  <div className="bg-slate-50 rounded-[2rem] p-8 mb-8 border border-slate-100">
                    <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Total Amount</div>
                    <div className="text-4xl font-black text-slate-900">
                      {formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowEnrollmentPaymentModal(false)}
                      disabled={isProcessingPayment}
                      className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleEnrollmentPayment}
                      disabled={isProcessingPayment}
                      className="btn-premium flex-1"
                    >
                      {isProcessingPayment ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Secure Checkout'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }


        {/* Delete Topic Confirmation Modal */}
        <ConfirmationModal
          show={showDeleteTopicModal}
          onClose={() => {
            setShowDeleteTopicModal(false);
            setTopicToDelete(null);
          }}
          onConfirm={confirmDeleteTopic}
          title="Delete Topic?"
          message="Are you sure you want to delete this topic? This action cannot be undone."
          confirmText="Delete"
        />

        {/* Leave Class Confirmation Modal */}
        <ConfirmationModal
          show={showLeaveClassModal}
          onClose={() => setShowLeaveClassModal(false)}
          onConfirm={handleLeaveClass}
          title="Leave Class"
          message="Are you sure you want to leave this class? You will need to enroll again to rejoin."
          confirmText="Leave"
        />
        {/* Delete Assignment Modal */}
        <ConfirmationModal
          show={showDeleteAssignmentModal}
          onClose={() => setShowDeleteAssignmentModal(false)}
          onConfirm={confirmDeleteAssignment}
          title="Delete Assignment?"
          message="Are you sure you want to delete this assignment? All student submissions and grades will be permanently removed. This action cannot be undone."
          confirmText="Delete"
          isLoading={isDeletingAssignment}
        />

        {/* Delete Classroom Modal */}
        <ConfirmationModal
          show={showDeleteClassModal}
          onClose={() => setShowDeleteClassModal(false)}
          onConfirm={confirmDeleteClassroom}
          title="Delete Classroom?"
          message="Are you sure you want to delete this classroom? This action cannot be undone."
          confirmText="Delete"
          isLoading={isDeletingClass}
        />

        {/* End Classroom Confirmation Modal */}
        <ConfirmationModal
          show={showEndClassModal}
          onClose={() => setShowEndClassModal(false)}
          onConfirm={confirmEndClassroom}
          title="End Classroom?"
          message={
            <div>
              <p className="text-gray-500 text-center mb-4 text-sm">
                Are you sure? This action will:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-500 mb-2 space-y-1 text-left">
                <li>Remove all students</li>
                <li>Unpublish assignments & clear deadlines</li>
                <li>Reset all topic progress</li>
                <li>Notify students and request feedback</li>
              </ul>
            </div>
          }
          confirmText="End Class"
          confirmButtonColor="bg-indigo-600 hover:bg-indigo-700"
          icon={Flag}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
          isLoading={isEndingClass}
        />


        {
          showGoogleAuth && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', padding: 24, borderRadius: 8, minWidth: 320, maxWidth: 400 }}>
                <GoogleMeetAuth userId={user?._id} />
                <button style={{ marginTop: 16 }} onClick={() => setShowGoogleAuth(false)}>Cancel</button>
              </div>
            </div>
          )
        }

        <ConfirmationModal
          show={showRemoveStudentModal}
          onClose={() => setShowRemoveStudentModal(false)}
          onConfirm={confirmRemoveStudent}
          title="Remove Student"
          message="Are you sure you want to remove this student from the classroom? They will lose access to all course materials."
          confirmText="Remove"
          isLoading={isRemovingStudent}
        />
      </div>
    </Layout>
  );
};

export default ClassroomDetail;
