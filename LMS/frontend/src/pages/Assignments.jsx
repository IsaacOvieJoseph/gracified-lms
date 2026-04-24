import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Calendar, FileText, CheckCircle, Plus, Book, Send, Search, ChevronDown, ChevronUp, Eye, EyeOff, Megaphone } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import GradeAssignmentModal from '../components/GradeAssignmentModal'; // Import the new modal component
import SubmitAssignmentModal from '../components/SubmitAssignmentModal';
import PaymentRequiredModal from '../components/PaymentRequiredModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { Edit, Trash2, X, Loader2 } from 'lucide-react';
import { formatDisplayDate } from '../utils/timezone';

const Assignments = () => {
  const { user, loading: userLoading } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [filteredAssignments, setFilteredAssignments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false);
  const [showSubmitAssignmentModal, setShowSubmitAssignmentModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [assignmentToSubmit, setAssignmentToSubmit] = useState(null);
  const [submissionToGrade, setSubmissionToGrade] = useState(null);
  const [classrooms, setClassrooms] = useState([]); // To populate classroom dropdown for assignment creation
  const [topics, setTopics] = useState([]); // To populate topic dropdown for assignment creation
  const [expandedSubmissions, setExpandedSubmissions] = useState(new Set()); // Track which submissions are expanded
  const [expandedAssignments, setExpandedAssignments] = useState(new Set()); // Track which assignments are expanded
  const [assignmentToEdit, setAssignmentToEdit] = useState(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Topic Payment Access states
  const [classroomsTopicStatus, setClassroomsTopicStatus] = useState({}); // { classroomId: topicStatus }
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [blockedTopic, setBlockedTopic] = useState(null);
  const [blockedClassroomId, setBlockedClassroomId] = useState(null);
  const [selectedSchools, setSelectedSchools] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedSchools')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    fetchAssignments();
    if (['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role)) {
      fetchClassroomsForCreation();
    }
    // Listen for school selection changes
    const handler = () => {
      const newSelectedSchools = JSON.parse(localStorage.getItem('selectedSchools') || '[]');
      setSelectedSchools(newSelectedSchools);
      fetchAssignments();
      if (['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role)) {
        fetchClassroomsForCreation();
      }
    };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, [user, selectedSchools]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredAssignments(assignments);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = assignments.filter(a =>
        a.title?.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query) ||
        a.topicId?.name?.toLowerCase().includes(query) ||
        a.classroomId?.name?.toLowerCase().includes(query)
      );
      setFilteredAssignments(filtered);
    }
  }, [searchQuery, assignments]);

  const fetchAssignments = async () => {
    try {
      let allAssignments = [];

      if (user?.role === 'student') {
        const classroomsRes = await api.get('/classrooms');
        const enrolledClassrooms = classroomsRes.data.classrooms.filter(c =>
          c.students?.some(s => s._id === user?._id) || user?.enrolledClasses?.includes(c._id)
        );
        const assignmentPromises = enrolledClassrooms.map(c =>
          api.get(`/assignments/classroom/${c._id}`)
        );
        const assignmentResponses = await Promise.all(assignmentPromises);
        allAssignments = assignmentResponses.flatMap(res => res.data.assignments);

        // Fetch topic status for each enrolled classroom to enforce payment checks
        const statusPromises = enrolledClassrooms.map(c =>
          api.get(`/payments/topic-status/${c._id}`).catch(() => null)
        );
        const statusResponses = await Promise.all(statusPromises);
        const statusMap = {};
        enrolledClassrooms.forEach((c, index) => {
          if (statusResponses[index]) {
            statusMap[c._id] = statusResponses[index].data;
          }
        });
        setClassroomsTopicStatus(statusMap);

      } else if (['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role)) {
        const classroomsRes = await api.get('/classrooms');
        let relevantClassrooms = classroomsRes.data.classrooms;

        if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
          relevantClassrooms = relevantClassrooms.filter(c => c.teacherId?._id === user?._id);
        } else if (user?.role === 'school_admin') {
          // Filter by selected school from dropdown, or all schools if none selected
          if (selectedSchools.length > 0) {
            relevantClassrooms = relevantClassrooms.filter(c => {
              const classroomSchoolIds = Array.isArray(c.schoolId)
                ? c.schoolId.map(sid => (sid?._id || sid)?.toString())
                : [c.schoolId?._id?.toString() || c.schoolId?.toString()];
              return selectedSchools.some(selectedId => classroomSchoolIds.includes(selectedId));
            });
          } else {
            // If no school selected, show all classrooms from admin's schools
            const adminSchoolIds = Array.isArray(user?.schoolId)
              ? user.schoolId.map(id => id.toString())
              : [user?.schoolId?.toString()];
            relevantClassrooms = relevantClassrooms.filter(c => {
              const classroomSchoolIds = Array.isArray(c.schoolId)
                ? c.schoolId.map(sid => (sid?._id || sid)?.toString())
                : [c.schoolId?._id?.toString() || c.schoolId?.toString()];
              return classroomSchoolIds.some(sid => adminSchoolIds.includes(sid));
            });
          }
        }

        const assignmentPromises = relevantClassrooms.map(c =>
          api.get(`/assignments/classroom/${c._id}`)
        );
        const assignmentResponses = await Promise.all(assignmentPromises);
        allAssignments = assignmentResponses.flatMap(res => res.data.assignments);

      }

      setAssignments(allAssignments);
      setFilteredAssignments(allAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassroomsForCreation = async () => {
    try {
      const response = await api.get('/classrooms');
      let filteredClassrooms = response.data.classrooms;

      if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
        filteredClassrooms = filteredClassrooms.filter(c => c.teacherId?._id === user?._id);
      } else if (user?.role === 'school_admin') {
        // Filter by selected school from dropdown, or all schools if none selected
        if (selectedSchools.length > 0) {
          filteredClassrooms = filteredClassrooms.filter(c =>
            selectedSchools.includes(c.schoolId?._id?.toString() || c.schoolId?.toString())
          );
        } else {
          // If no school selected, show all classrooms from admin's schools
          const adminSchoolIds = Array.isArray(user?.schoolId)
            ? user.schoolId.map(id => id.toString())
            : [user?.schoolId?.toString()];
          filteredClassrooms = filteredClassrooms.filter(c =>
            adminSchoolIds.includes(c.schoolId?._id?.toString() || c.schoolId?.toString())
          );
        }
      }
      setClassrooms(filteredClassrooms);
    } catch (error) {
      console.error('Error fetching classrooms for creation:', error);
    }
  };

  const fetchTopicsForClassroom = async (classroomId) => {
    try {
      const response = await api.get(`/classrooms/${classroomId}`);
      setTopics(response.data.classroom.topics || []);
    } catch (error) {
      console.error('Error fetching topics for classroom:', error);
      setTopics([]);
    }
  };

  const handleCreateAssignmentSuccess = () => {
    setShowCreateAssignmentModal(false);
    fetchAssignments();
  };

  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  const handleSubmitAssignment = async (assignmentId, answers) => {
    setIsSubmittingAssignment(true);
    try {
      await api.post(`/assignments/${assignmentId}/submit`, { answers }, { skipLoader: true });
      setShowSubmitAssignmentModal(false);
      setAssignmentToSubmit(null);
      toast.success('Assignment submitted successfully');
      fetchAssignments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting assignment');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const handleGradeAssignment = () => {
    // This function will now simply close the modal and refresh assignments,
    // as the API call is handled within GradeAssignmentModal
    setShowGradeModal(false);
    fetchAssignments();
  };

  const checkTopicAccess = (assignment) => {
    if (user?.role !== 'student') return true;

    const classroom = assignment.classroomId;
    const topic = assignment.topicId;

    if (!classroom || !topic) return true;
    if (classroom.pricing?.type !== 'per_topic') return true;

    const topicStatus = classroomsTopicStatus[classroom._id];
    if (!topicStatus) return true; // Fallback to allow if not loaded or error

    const isPaid = topicStatus.paidTopics.some(t => String(t._id) === String(topic._id));

    if (!isPaid) {
      setBlockedTopic(topic);
      setBlockedClassroomId(classroom._id);
      setShowPaymentModal(true);
      return false;
    }
    return true;
  };

  const canCreateAssignment = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);
  const canGradeAssignment = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);

  const canManageAssignment = (assignment) => {
    if (user?.role === 'root_admin') return true;
    if (user?.role === 'school_admin') {
      const classroomSchoolIds = Array.isArray(assignment.classroomId?.schoolId)
        ? assignment.classroomId.schoolId.map(id => (id._id || id)?.toString())
        : [assignment.classroomId?.schoolId?._id?.toString() || assignment.classroomId?.schoolId?.toString()];
      const userSchoolIds = Array.isArray(user.schoolId)
        ? user.schoolId.map(id => (id._id || id)?.toString())
        : [user.schoolId?.toString()];
      return userSchoolIds.some(id => id && classroomSchoolIds.includes(id));
    }
    if (['teacher', 'personal_teacher'].includes(user?.role)) {
      const teacherId = assignment.classroomId?.teacherId?._id || assignment.classroomId?.teacherId;
      return teacherId?.toString() === user?._id?.toString();
    }
    return false;
  };

  const handleOpenEditAssignment = (assignment) => {
    setAssignmentToEdit(assignment);
    setShowCreateAssignmentModal(true);
  };

  const handleDeleteAssignment = (assignmentId) => {
    setAssignmentToDelete(assignmentId);
    setShowDeleteModal(true);
  };

  const confirmDeleteAssignment = async () => {
    if (!assignmentToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/assignments/${assignmentToDelete}`);
      toast.success('Assignment deleted successfully');
      setShowDeleteModal(false);
      setAssignmentToDelete(null);
      fetchAssignments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting assignment');
    } finally {
      setIsDeleting(false);
    }
  };

  const [publishingAssignmentId, setPublishingAssignmentId] = useState(null);
  const handleAssignmentPublishToggle = async (assignment) => {
    setPublishingAssignmentId(assignment._id);
    try {
      const newStatus = !assignment.published;
      await api.put(`/assignments/${assignment._id}/publish`, { published: newStatus });
      fetchAssignments();
      toast.success(newStatus ? 'Assignment published' : 'Assignment unpublished');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating assignment publish status');
    } finally {
      setPublishingAssignmentId(null);
    }
  };

  const [notifyingAssignmentId, setNotifyingAssignmentId] = useState(null);
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

  if (loading || userLoading) {
    return <Layout><div className="flex flex-col items-center justify-center min-h-[400px] gap-4"><div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Loading...</p></div></Layout>;
  }
  if (!user || !user._id) {
    return <Layout><div className="text-center py-8 text-red-600">User session invalid. Please log in again.</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center gap-4">
             <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                <FileText className="w-8 h-8" />
             </div>
             <div>
                <h1 className="text-2xl sm:text-3xl font-black text-foreground italic">Academy <span className="text-primary not-italic">Assignments</span></h1>
                <p className="text-muted-foreground font-black text-[10px] uppercase tracking-[0.2em] mt-1 opacity-60">Objective Tracking & Assessment</p>
             </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex-1"></div>
          {canCreateAssignment && (
            <button
              onClick={() => setShowCreateAssignmentModal(true)}
              className="btn-premium"
            >
              <Plus className="w-5 h-5" />
              <span>Create Assignment</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground/30 group-focus-within:text-primary transition-colors w-5 h-5" />
          <input
            type="text"
            placeholder="Filter objectives by title, topic, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-muted border border-border rounded-2xl focus:border-primary outline-none transition-all text-foreground font-bold"
          />
        </div>

        <div className="space-y-4">
          {filteredAssignments.length > 0 ? (
            filteredAssignments.map((assignment) => {
              const submission = assignment.submissions?.find(
                s => s.studentId?._id === user?._id
              );
              const isSubmitted = !!submission;
              const isGraded = submission?.status === 'graded';


              const canViewSubmissions = canGradeAssignment && (assignment.submissions && assignment.submissions.length > 0);

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
                <div key={assignment._id} className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-xl hover:shadow-2xl transition-all">
                  <div
                    className="flex justify-between items-start p-6 cursor-pointer hover:bg-muted/30 transition shadow-inner"
                    onClick={toggleAssignmentExpanded}
                  >
                    <div className="flex items-start space-x-4 flex-1">
                      {isAssignmentExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground/60 mt-1 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground/60 mt-1 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-black text-foreground tracking-tight underline-offset-4 decoration-primary/30">
                          {assignment.title}
                          {assignment.topicId?.name && (
                            <span className="ml-3 text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                              {assignment.topicId.name}
                            </span>
                          )}
                        </h3>
                        {!isAssignmentExpanded && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-1 opacity-80 font-medium">{assignment.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      {/* Show "Graded" only if graded AND (theory OR MCQ with results published) */}
                      {isGraded && (assignment.assignmentType === 'theory' || (assignment.assignmentType === 'mcq' && (!assignment.publishResultsAt || new Date() >= new Date(assignment.publishResultsAt)))) && (
                        <span className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border border-emerald-500/20 shadow-sm">
                          Graded
                        </span>
                      )}
                      {/* Show "Submitted" only if submitted AND NOT graded (or MCQ graded but results not published yet) */}
                      {isSubmitted && !isGraded && (
                        <span className="bg-amber-500/10 text-amber-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border border-amber-500/20 shadow-sm">
                          Submitted
                        </span>
                      )}
                      {/* Show "Submitted" for MCQ that is graded but results not published yet */}
                      {isSubmitted && isGraded && assignment.assignmentType === 'mcq' && assignment.publishResultsAt && new Date() < new Date(assignment.publishResultsAt) && (
                        <span className="bg-amber-500/10 text-amber-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border border-amber-500/20 shadow-sm">
                          Submitted
                        </span>
                      )}
                      {canManageAssignment(assignment) && (
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
                            className="text-muted-foreground/30 hover:text-red-500 p-1 transition-colors"
                            title="Delete assignment"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isAssignmentExpanded && (
                    <div className="px-8 pb-8 border-t border-border bg-muted/20">
                      <div className="pt-6">
                        <p className="text-foreground/70 leading-relaxed font-medium mb-6 text-sm italic border-l-4 border-primary/10 pl-4">{assignment.description}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-6 bg-muted/40 p-4 rounded-2xl border border-border/10">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary opacity-40" />
                          <span className="opacity-40">Deadline:</span>
                          <span className="text-foreground">{formatDisplayDate(assignment.dueDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary opacity-40" />
                          <span className="opacity-40">Operational Max:</span>
                          <span className="text-foreground">{assignment.maxScore} Pts</span>
                        </div>
                        {assignment.assignmentType === 'mcq' && assignment.publishResultsAt && (
                          <div className="flex items-center gap-2">
                            <Book className="w-4 h-4 text-primary opacity-40" />
                            <span className="opacity-40">Results Intel:</span>
                            <span className="text-foreground">{formatDisplayDate(assignment.publishResultsAt)}</span>
                            {/* Only show "Pending" if results not published AND student hasn't submitted yet */}
                            {new Date() < new Date(assignment.publishResultsAt) && !isSubmitted && (
                              <span className="ml-2 bg-indigo-500/10 text-indigo-500 px-2.5 py-0.5 rounded-full text-[8px] font-black border border-indigo-500/20">
                                Pending
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {user?.role === 'student' && isGraded && submission && (assignment.assignmentType === 'theory' || (assignment.assignmentType === 'mcq' && (!assignment.publishResultsAt || new Date() >= new Date(assignment.publishResultsAt)))) && (
                        <div className="bg-muted/40 rounded-2xl p-6 mb-6 shadow-inner border border-border">
                          <div className="flex items-center space-x-3 mb-4">
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                            <span className="text-sm font-black text-foreground uppercase tracking-widest italic">
                              Resolved Intel: {submission.score}/{assignment.maxScore}
                            </span>
                          </div>
                          {submission.feedback && (
                            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wider mb-6 pb-6 border-b border-border/10 italic opacity-80">Evaluator Note: <span className="text-foreground">{submission.feedback}</span></p>
                          )}
                          <div className="space-y-6">
                            <h5 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Operational Payload Details:</h5>
                            {assignment.assignmentType === 'theory' && submission.answers && Array.isArray(submission.answers) && (
                              <div className="space-y-4">
                                {assignment.questions.map((q, qIndex) => {
                                  const questionGrade = submission.questionScores?.find(qs => qs.questionIndex === qIndex);
                                  return (
                                    <div key={qIndex} className="bg-card p-4 rounded-xl border border-border/5">
                                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 opacity-40">Question {qIndex + 1}</p>
                                      <p className="text-sm font-bold text-foreground mb-3">{q.questionText}</p>
                                      <div className="p-4 bg-muted rounded-xl border border-border mb-3">
                                         <p className="text-sm text-foreground/70 italic whitespace-pre-wrap">{submission.answers[qIndex]}</p>
                                      </div>
                                      {questionGrade && (
                                        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                                          <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-lg border border-emerald-500/20">
                                            Score: {questionGrade.score}/{q.maxScore}
                                          </span>
                                          {questionGrade.feedback && <span className="text-muted-foreground italic opacity-60">Intel Note: {questionGrade.feedback}</span>}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {assignment.assignmentType === 'mcq' && submission.answers && Array.isArray(submission.answers) && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {assignment.questions.map((q, qIndex) => (
                                  <div key={qIndex} className="bg-card p-4 rounded-xl border border-border/5">
                                    <p className="text-xs font-bold text-foreground mb-3">{q.questionText}</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                       <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">Input: {submission.answers[qIndex]}</span>
                                       {q.correctOption && (
                                         <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${submission.answers[qIndex] === q.correctOption ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                                            {submission.answers[qIndex] === q.correctOption ? 'Valid' : `Invalid - Protocol: ${q.correctOption}`}
                                         </span>
                                       )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Student View: Submitted but not graded, or MCQ graded but results not published yet */}
                      {user?.role === 'student' && isSubmitted && (!isGraded || (assignment.assignmentType === 'mcq' && assignment.publishResultsAt && new Date() < new Date(assignment.publishResultsAt))) && (
                        <div className="bg-muted rounded-2xl p-6 mb-4 border border-border shadow-inner">
                          <p className="font-black text-xs uppercase tracking-widest text-indigo-500 mb-4">
                            {isGraded && assignment.assignmentType === 'mcq' && assignment.publishResultsAt && new Date() < new Date(assignment.publishResultsAt)
                              ? `Operational results for this assessment will be published on ${formatDisplayDate(assignment.publishResultsAt)}.`
                              : 'Deployment successful. Awaiting command evaluation.'
                            }
                          </p>
                          <div className="mt-4 border-t border-border/10 pt-4">
                            <h5 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Your Intel Payload:</h5>
                            <div className="space-y-4">
                              {assignment.assignmentType === 'theory' && submission.answers && Array.isArray(submission.answers) && (
                                <div className="space-y-4">
                                  {assignment.questions.map((q, qIndex) => (
                                    <div key={qIndex} className="bg-card p-4 rounded-xl border border-border/5">
                                      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-40">Objective {qIndex + 1}</p>
                                      <p className="text-sm font-bold text-foreground mb-2">{q.questionText}</p>
                                      <div className="p-3 bg-muted rounded-lg border border-border/10">
                                         <p className="text-sm text-foreground/70 italic whitespace-pre-wrap">{submission.answers[qIndex]}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {assignment.assignmentType === 'theory' && submission.answers && !Array.isArray(submission.answers) && (
                                <p className="text-sm text-foreground/70 italic bg-card p-4 rounded-xl border border-border/5 whitespace-pre-wrap">{submission.answers}</p>
                              )}
                              {assignment.assignmentType === 'mcq' && submission.answers && Array.isArray(submission.answers) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {assignment.questions.map((q, qIndex) => (
                                    <div key={qIndex} className="bg-card p-4 rounded-xl border border-border/5 flex items-center justify-between">
                                      <span className="text-xs font-bold text-foreground truncate mr-2">{q.questionText}</span>
                                      <span className="text-xs font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/5 px-3 py-1 rounded-full border border-indigo-500/10 whitespace-nowrap">Opt {submission.answers[qIndex]}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {user?.role === 'student' && !isSubmitted && (
                        (() => {
                          const isPastDue = assignment.dueDate && new Date() > new Date(assignment.dueDate);
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isPastDue) return;
                                if (!checkTopicAccess(assignment)) return;
                                setAssignmentToSubmit(assignment);
                                setShowSubmitAssignmentModal(true);
                              }}
                              disabled={isPastDue}
                              className={isPastDue ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-premium'}
                            >
                              {isPastDue ? 'Deadline Passed' : 'Submit Assignment'}
                            </button>
                          );
                        })()
                      )}

                      {/* Teacher/Admin: View and Grade Submissions */}
                      {canGradeAssignment && (user?.role === 'teacher' || user?.role === 'personal_teacher' ? assignment.classroomId?.teacherId?._id === user?._id : true) && (
                        <div className="mt-8 border-t border-border pt-6">
                          <h4 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 opacity-40">Deployed Submissions ({assignment.submissions?.length || 0})</h4>
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
                                <div key={sub._id} className="border border-border/10 rounded-2xl mb-3 bg-muted/40 overflow-hidden shadow-sm group/sub hover:border-primary/20 transition-all">
                                  <div
                                    className="flex justify-between items-center p-4 cursor-pointer hover:bg-muted/60 transition"
                                    onClick={toggleExpanded}
                                  >
                                    <div className="flex items-center space-x-3 flex-1">
                                      {isExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-muted-foreground/30" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground/30" />
                                      )}
                                      <div className="flex-1">
                                        <p className="font-bold text-foreground">{sub.studentId?.name || 'Unknown Intel'}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Status: {sub.status}</span>
                                          {sub.status === 'graded' && (
                                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">Score: {sub.score}/{assignment.maxScore}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {canGradeAssignment && (user?.role === 'teacher' || user?.role === 'personal_teacher' ? sub.studentId?._id === user?._id : true) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAssignment(assignment);
                                          setSubmissionToGrade(sub);
                                          setShowGradeModal(true);
                                        }}
                                        className="text-[10px] font-black text-primary uppercase tracking-widest hover:scale-105 active:scale-95 transition-all bg-card px-5 py-2 rounded-xl border border-border shadow-sm group-hover/sub:bg-primary group-hover/sub:text-white"
                                      >
                                        Evaluate
                                      </button>
                                    )}
                                  </div>
                                  {isExpanded && (
                                    <div className="px-6 pb-6 pt-2 border-t border-border/10 bg-muted/20">
                                      {/* Display answers based on type */}
                                      {assignment.assignmentType === 'theory' && sub.answers && (
                                        <div className="mt-4">
                                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 opacity-40">Intel Payload:</p>
                                          <div className="p-4 bg-card rounded-xl border border-border shadow-inner">
                                            <p className="text-sm text-foreground/70 italic whitespace-pre-wrap leading-relaxed">{Array.isArray(sub.answers) ? sub.answers.join('\n\n') : sub.answers}</p>
                                          </div>
                                        </div>
                                      )}
                                      {assignment.assignmentType === 'mcq' && sub.answers && Array.isArray(sub.answers) && (
                                        <div className="mt-4">
                                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 opacity-40">Student Answers:</p>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {sub.answers.map((ans, ansIdx) => (
                                              <div key={ansIdx} className="p-3 bg-card rounded-xl border border-border flex items-center justify-between">
                                                <span className="text-xs font-bold text-foreground">Objective {ansIdx + 1}</span>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">{ans}</span>
                                                  {assignment.questions[ansIdx]?.correctOption && (
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${ans === assignment.questions[ansIdx].correctOption ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                                                      {ans === assignment.questions[ansIdx].correctOption ? 'Valid' : 'Invalid'}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
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
            <div className="text-center py-20 bg-card rounded-[2.5rem] border border-border shadow-inner">
               <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 border border-border/10">
                  <FileText className="w-8 h-8 text-muted-foreground/20" />
               </div>
              <p className="text-muted-foreground/30 font-black text-xs uppercase tracking-widest italic">
                {searchQuery.trim() !== ''
                  ? 'No intel found matching search protocol'
                  : 'Objective registry is currently empty'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Assignment Modal */}
      {showCreateAssignmentModal && (
        <CreateAssignmentModal
          show={showCreateAssignmentModal}
          onClose={() => {
            setShowCreateAssignmentModal(false);
            setAssignmentToEdit(null);
          }}
          onSubmitSuccess={handleCreateAssignmentSuccess}
          availableTopics={topics}
          availableClassrooms={classrooms}
          editAssignment={assignmentToEdit}
        />
      )}

      <ConfirmationModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteAssignment}
        title="Delete Assignment"
        message="Are you sure you want to delete this assignment? All student submissions and grades will be permanently removed."
        confirmText="Delete"
        isLoading={isDeleting}
      />

      {/* Grade Assignment Modal */}
      {showGradeModal && (
        <GradeAssignmentModal
          show={showGradeModal}
          onClose={() => setShowGradeModal(false)}
          onSubmitSuccess={handleGradeAssignment}
          selectedAssignment={selectedAssignment}
          submissionToGrade={submissionToGrade}
        />
      )}

      {/* Submit Assignment Modal */}
      {showSubmitAssignmentModal && assignmentToSubmit && (
        <SubmitAssignmentModal
          assignment={assignmentToSubmit}
          onClose={() => setShowSubmitAssignmentModal(false)}
          onSubmit={handleSubmitAssignment}
          isSubmitting={isSubmittingAssignment}
        />
      )}

      {/* Payment Required Modal */}
      {showPaymentModal && (
        <PaymentRequiredModal
          show={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          topic={blockedTopic}
          classroomId={blockedClassroomId}
          onSuccess={() => {
            fetchAssignments(); // Refresh both assignments and topic statuses
          }}
        />
      )}
    </Layout>
  );
};

export default Assignments;