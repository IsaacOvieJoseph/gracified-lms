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
    return <Layout><div className="text-center py-8">Loading...</div></Layout>;
  }
  if (!user || !user._id) {
    return <Layout><div className="text-center py-8 text-red-600">User session invalid. Please log in again.</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">My Assignments</h2>
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by title, description, topic, or classroom..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <div key={assignment._id} className="card-premium overflow-hidden">
                  <div
                    className="flex justify-between items-start p-6 cursor-pointer hover:bg-gray-50 transition"
                    onClick={toggleAssignmentExpanded}
                  >
                    <div className="flex items-start space-x-3 flex-1">
                      {isAssignmentExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-600 mt-1 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600 mt-1 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800">
                          {assignment.title}
                          {assignment.topicId?.name && (
                            <span className="ml-2 text-sm font-normal text-gray-500">
                              ({assignment.topicId.name})
                            </span>
                          )}
                        </h3>
                        {!isAssignmentExpanded && (
                          <p className="text-gray-600 mt-1 line-clamp-2">{assignment.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {/* Show "Graded" only if graded AND (theory OR MCQ with results published) */}
                      {isGraded && (assignment.assignmentType === 'theory' || (assignment.assignmentType === 'mcq' && (!assignment.publishResultsAt || new Date() >= new Date(assignment.publishResultsAt)))) && (
                        <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                          Graded
                        </span>
                      )}
                      {/* Show "Submitted" only if submitted AND NOT graded (or MCQ graded but results not published yet) */}
                      {isSubmitted && !isGraded && (
                        <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                          Submitted
                        </span>
                      )}
                      {/* Show "Submitted" for MCQ that is graded but results not published yet */}
                      {isSubmitted && isGraded && assignment.assignmentType === 'mcq' && assignment.publishResultsAt && new Date() < new Date(assignment.publishResultsAt) && (
                        <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
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
                        <p className="text-gray-600 mb-4">{assignment.description}</p>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Due: {formatDisplayDate(assignment.dueDate)}
                        </div>
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          Max Score: {assignment.maxScore}
                        </div>
                        {assignment.assignmentType === 'mcq' && assignment.publishResultsAt && (
                          <div className="flex items-center">
                            <Book className="w-4 h-4 mr-1" />
                            Results Publish: {formatDisplayDate(assignment.publishResultsAt)}
                            {/* Only show "Pending" if results not published AND student hasn't submitted yet */}
                            {new Date() < new Date(assignment.publishResultsAt) && !isSubmitted && (
                              <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                                Pending
                              </span>
                            )}
                          </div>
                        )}
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
                              ? `Results for this MCQ assignment will be published on ${formatDisplayDate(assignment.publishResultsAt)}.`
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
                                    {canGradeAssignment && (user?.role === 'teacher' || user?.role === 'personal_teacher' ? sub.studentId?._id === user?._id : true) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAssignment(assignment);
                                          setSubmissionToGrade(sub);
                                          setShowGradeModal(true);
                                        }}
                                        className="btn-premium py-1.5 px-4 text-sm"
                                      >
                                        Grade
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
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">
                {searchQuery.trim() !== ''
                  ? 'No assignments found matching your search'
                  : 'No assignments available'}
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Assignment?</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this assignment? All student submissions and grades will be permanently removed.</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAssignment}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:bg-red-400 flex items-center justify-center"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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