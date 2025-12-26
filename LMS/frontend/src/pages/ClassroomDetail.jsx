import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, Edit, Plus, Calendar, Users, Book, DollarSign, X, UserPlus, FileText, CheckCircle, Send, ChevronDown, ChevronUp } from 'lucide-react'; // Added FileText, CheckCircle, Send icons
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import GradeAssignmentModal from '../components/GradeAssignmentModal';
import SubmitAssignmentModal from '../components/SubmitAssignmentModal';
// import SubscriptionBlockModal from '../components/SubscriptionBlockModal';
  // Subscription block modal state (REMOVED)

const ClassroomDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: userLoading } = useAuth();
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', capacity: 30, pricingType: 'per_class', pricingAmount: 0 });
    // Open edit modal and prefill form
    const handleOpenEdit = () => {
      setEditForm({
        name: classroom.name || '',
        description: classroom.description || '',
        capacity: classroom.capacity || 30,
        pricingType: classroom.pricing?.type || 'per_class',
        pricingAmount: classroom.pricing?.amount || 0,
        teacherId: classroom.teacherId?._id || ''
      });
      if ((user?.role === 'root_admin' || user?.role === 'school_admin') && classroom.schoolId && classroom.teacherId?.role !== 'personal_teacher') {
        fetchAvailableTeachers();
      }
      setShowEditModal(true);
    };

    // Handle edit form submit
    const handleEditClassroom = async (e) => {
      e.preventDefault();
      try {
        const updateData = {
          name: editForm.name,
          description: editForm.description,
          capacity: editForm.capacity,
          pricing: { type: editForm.pricingType, amount: editForm.pricingAmount }
        };
        // Only allow teacher change if permitted
        if ((user?.role === 'root_admin' || user?.role === 'school_admin') && classroom.schoolId && classroom.teacherId?.role !== 'personal_teacher' && editForm.teacherId && editForm.teacherId !== classroom.teacherId?._id) {
          updateData.teacherId = editForm.teacherId;
        }
        await api.put(`/classrooms/${id}`, updateData);
        setShowEditModal(false);
        fetchClassroom();
      } catch (error) {
        alert(error.response?.data?.message || 'Error updating classroom');
      }
    };
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showChangeTeacherModal, setShowChangeTeacherModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [topicForm, setTopicForm] = useState({ name: '', description: '', order: 0 });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  
  // New states for Assignment Management
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false);
  const [availableTopicsForAssignment, setAvailableTopicsForAssignment] = useState([]); // For topic dropdown in create assignment modal
  const [showSubmitAssignmentModal, setShowSubmitAssignmentModal] = useState(false); // New state for submit modal
  const [assignmentToSubmit, setAssignmentToSubmit] = useState(null); // New state for assignment to submit
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedAssignmentForGrading, setSelectedAssignmentForGrading] = useState(null);
  const [submissionToGrade, setSubmissionToGrade] = useState(null);
  const [expandedSubmissions, setExpandedSubmissions] = useState(new Set()); // Track which submissions are expanded
  const [expandedAssignments, setExpandedAssignments] = useState(new Set()); // Track which assignments are expanded


  useEffect(() => {
    fetchClassroom();
    // Listen for school selection changes
    const handler = () => fetchClassroom();
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, [id]);

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

  const fetchClassroom = async () => {
    try {
      // Also populate assignments to display them
      const response = await api.get(`/classrooms/${id}`);
      setClassroom(response.data.classroom);
    } catch (error) {
      console.error('Error fetching classroom:', error);
    } finally {
      setLoading(false);
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

  const handleEnroll = async () => {
    try {
      if (classroom.isPaid) {
        // Redirect to payment
        navigate(`/payments?classroomId=${id}`);
      } else {
        await api.post(`/classrooms/${id}/enroll`);
        alert('Enrolled successfully!');
        fetchClassroom();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error enrolling');
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    try {
      await api.post('/topics', {
        ...topicForm,
        classroomId: id
      });
      setShowTopicModal(false);
      setTopicForm({ name: '', description: '', order: 0 });
      fetchClassroom();
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating topic');
    }
  };

  const handleCreateAssignment = async () => {
    setShowCreateAssignmentModal(false);
    fetchClassroom();
  };

  const handleSubmitAssignment = async (assignmentId, answers) => {
    try {
      await api.post(`/assignments/${assignmentId}/submit`, { answers });
      setShowSubmitAssignmentModal(false);
      setAssignmentToSubmit(null);
      fetchClassroom(); // Refresh classroom to update submission status
    } catch (error) {
      alert(error.response?.data?.message || 'Error submitting assignment');
    }
  };

  const handleGradeSubmission = async () => {
    // This function will now simply close the modal and refresh assignments,
    // as the API call is handled within GradeAssignmentModal
    setShowGradeModal(false);
    fetchClassroom(); // Refresh classroom to update grades
  };

  const handleStartZoom = async () => {
    try {
      const response = await api.post(`/zoom/create-meeting/${id}`);
      alert(`Zoom Meeting Created!\nMeeting ID: ${response.data.meetingId}\nPassword: ${response.data.password}\n\nJoin URL: ${response.data.joinUrl}`);
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating Zoom meeting');
    }
  };

  const handleOpenWhiteboard = async () => {
    try {
      const response = await api.get(`/whiteboard/${id}`);
      window.open(response.data.whiteboardUrl, '_blank');
    } catch (error) {
      alert(error.response?.data?.message || 'Error opening whiteboard');
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

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/classrooms/${id}/students`, { studentId: selectedStudentId });
      alert('Student added successfully!');
      setShowAddStudentModal(false);
      setSelectedStudentId(''); // Reset selected student ID
      fetchClassroom();
      fetchAvailableStudents();
    } catch (error) {
      alert(error.response?.data?.message || 'Error adding student');
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to remove this student?')) return;
    
    try {
      await api.delete(`/classrooms/${id}/students/${studentId}`);
      alert('Student removed successfully!');
      fetchClassroom();
      fetchAvailableStudents();
    } catch (error) {
      alert(error.response?.data?.message || 'Error removing student');
    }
  };

  const handleChangeTeacher = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/classrooms/${id}/teacher`, { teacherId: selectedTeacherId });
      alert('Teacher updated successfully!');
      setShowChangeTeacherModal(false);
      setSelectedTeacherId('');
      fetchClassroom();
    } catch (error) {
      alert(error.response?.data?.message || 'Error changing teacher');
    }
  };

  const isEnrolled = classroom?.students?.some(s => s._id === user?._id) ||
    user?.enrolledClasses?.includes(id);
  
  // Unpublished classes can be edited by teacher, personal teacher, school admin, and root admin
  // Published classes can only be edited by their teacher or admins
  const canEdit = 
    user?.role === 'root_admin' ||
    user?.role === 'school_admin' ||
    (user?.role === 'teacher' && classroom?.teacherId?._id === user?._id) ||
    (user?.role === 'personal_teacher' && classroom?.teacherId?._id === user?._id) ||
    (!classroom?.published && ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role));

  // Can manage students (add/remove)
  const canManageStudents = 
    user?.role === 'root_admin' ||
    (user?.role === 'school_admin' && classroom?.schoolId?.toString() === user?.schoolId?.toString()) ||
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
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">{classroom.name}</h2>
              <p className="text-gray-600 mt-2">{classroom.description}</p>
            </div>
            {canEdit && (
              <button
                onClick={handleOpenEdit}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition ml-2"
                title="Edit Classroom"
              >
                <Edit className="w-5 h-5" />
                <span>Edit</span>
              </button>
            )}
                  {/* Edit Classroom Modal */}
                  {showEditModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold mb-4">Edit Classroom</h3>
                        <form onSubmit={handleEditClassroom} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-4 py-2 border rounded-lg"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                              value={editForm.description}
                              onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                              className="w-full px-4 py-2 border rounded-lg"
                              rows="3"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                            <input
                              type="number"
                              value={editForm.capacity}
                              onChange={e => setEditForm({ ...editForm, capacity: parseInt(e.target.value) })}
                              className="w-full px-4 py-2 border rounded-lg"
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Type</label>
                            <select
                              value={editForm.pricingType}
                              onChange={e => setEditForm({ ...editForm, pricingType: e.target.value })}
                              className="w-full px-4 py-2 border rounded-lg"
                            >
                              <option value="per_class">Per Class</option>
                              <option value="per_topic">Per Topic</option>
                              <option value="per_subject">Per Subject</option>
                              <option value="free">Free</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Amount</label>
                            <input
                              type="number"
                              value={editForm.pricingAmount}
                              onChange={e => setEditForm({ ...editForm, pricingAmount: parseFloat(e.target.value) })}
                              className="w-full px-4 py-2 border rounded-lg"
                              min="0"
                              step="0.01"
                              disabled={editForm.pricingType === 'free'}
                            />
                          </div>
                          {/* Only show teacher select for admins if allowed */}
                          {(user?.role === 'root_admin' || user?.role === 'school_admin') && classroom.schoolId && classroom.teacherId?.role !== 'personal_teacher' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                              <select
                                value={editForm.teacherId}
                                onChange={e => setEditForm({ ...editForm, teacherId: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg"
                              >
                                <option value="">Select a teacher</option>
                                {availableTeachers.map(teacher => (
                                  <option key={teacher._id} value={teacher._id}>{teacher.name} ({teacher.email})</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              onClick={() => setShowEditModal(false)}
                              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                            >
                              Save Changes
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
            {classroom.isPaid && classroom.pricing?.amount > 0 ? (
              <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold">
                ${classroom.pricing?.amount || 0}
              </span>
            ) : (
              <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold">
                Free
              </span>
            )}
            {!classroom.schoolId && classroom.teacherId?.role === 'personal_teacher' && (
              <span className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full font-semibold ml-2">
                Personal Teacher
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-gray-600">
              <Calendar className="w-5 h-5" />
              {/* Displaying schedule - iterate over the array */}
              {classroom.schedule && classroom.schedule.length > 0 ? (
                classroom.schedule.map((session, index) => (
                  <span key={index} className="mr-1">
                    {session.dayOfWeek ? session.dayOfWeek.substring(0, 3) : 'N/A'} {session.startTime}-{session.endTime}
                    {index < classroom.schedule.length - 1 ? ',' : ''}
                  </span>
                ))
              ) : (
                <span>No schedule available</span>
              )}
            </div>
            {user?.role !== 'student' && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Users className="w-5 h-5" />
                <span>{classroom.students?.length || 0} students</span>
              </div>
            )}
            <div className="flex items-center space-x-2 text-gray-600">
              <Book className="w-5 h-5" />
              <span>{classroom.topics?.length || 0} topics</span>
            </div>
          </div>

          <div className="flex space-x-3">
            {!isEnrolled && user?.role === 'student' && classroom.published && (
              <button
                onClick={handleEnroll}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                {classroom.isPaid ? `Enroll - $${classroom.pricing?.amount || 0}` : 'Enroll (Free)'}
              </button>
            )}
            {!isEnrolled && user?.role === 'student' && !classroom.published && (
              <span className="px-6 py-2 bg-gray-300 text-gray-600 rounded-lg font-semibold">
                Not Available for Enrollment
              </span>
            )}
            {(isEnrolled || canEdit) && (
              <>
                <button
                  onClick={handleStartZoom}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  <Video className="w-5 h-5" />
                  <span>Start Zoom</span>
                </button>
                <button
                  onClick={handleOpenWhiteboard}
                  className="flex items-center space-x-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  <Edit className="w-5 h-5" />
                  <span>Whiteboard</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Topic Management Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Topics</h3>
            {canEdit && ( // 'canEdit' already includes teacher roles, so this is good
              <button
                onClick={() => setShowTopicModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Topic</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {classroom.topics && classroom.topics.length > 0 ? (
              classroom.topics.map((topic) => (
                <div key={topic._id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                  <h4 className="font-semibold text-gray-800">{topic.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{topic.description}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No topics added yet</p>
            )}
          </div>
        </div>

        {/* Assignment Management Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Assignments</h3>
            {canCreateAssignment && (
              <button
                onClick={() => setShowCreateAssignmentModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Assignment</span>
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
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {assignment.dueDate ? (
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-semibold">
                            Due: {new Date(assignment.dueDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-semibold">
                            No Due Date
                          </span>
                        )}
                        {assignment.assignmentType === 'mcq' && assignment.publishResultsAt && (
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-semibold">
                            Results: {new Date(assignment.publishResultsAt).toLocaleDateString()}
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
                                        <strong>Q{qIndex + 1}:</strong> {q.questionText}<br/>
                                        Your Answer: <span className="whitespace-pre-wrap">{submission.answers[qIndex]}</span><br/>
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
                                      <strong>Q{qIndex + 1}:</strong> {q.questionText}<br/>
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
                                      <strong>Q{qIndex + 1}:</strong> {q.questionText}<br/>
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
                                      <strong>Q{qIndex + 1}:</strong> {q.questionText}<br/>
                                      Your Answer: {submission.answers[qIndex]}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}

                        {user?.role === 'student' && !isSubmitted && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssignmentToSubmit(assignment);
                              setShowSubmitAssignmentModal(true);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          >
                            Submit Assignment
                          </button>
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

        {/* Enrolled Students Section */}
        {canViewStudents && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Enrolled Students ({classroom.students?.length || 0}/{classroom.capacity})</h3>
              {canManageStudents && (
                <button
                  onClick={() => {
                    setSelectedStudentId(''); // Ensure selectedStudentId is reset
                    fetchAvailableStudents();
                    setShowAddStudentModal(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Student</span>
                </button>
              )}
            </div>
            <div className="space-y-2">
              {classroom.students && classroom.students.length > 0 ? (
                classroom.students.map((student) => (
                  <div key={student._id || student} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-800">
                        {typeof student === 'object' ? student.name : 'Loading...'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {typeof student === 'object' ? student.email : ''}
                      </p>
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
        )}

        {/* Teacher Management (Root Admin only) */}
        {user?.role === 'root_admin' && classroom?.schoolId && (
          <div className="bg-white rounded-lg shadow-md p-6">
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
      </div>

      {/* Add Topic Modal */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Add Topic</h3>
            <form onSubmit={handleCreateTopic} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={topicForm.name}
                  onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={topicForm.description}
                  onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <input
                  type="number"
                  value={topicForm.order}
                  onChange={(e) => setTopicForm({ ...topicForm, order: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                  min="0"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateAssignmentModal && (
        <CreateAssignmentModal
          show={showCreateAssignmentModal}
          onClose={() => setShowCreateAssignmentModal(false)}
          onSubmitSuccess={handleCreateAssignment} // Pass the success callback
          classroomId={id} // Pass the current classroom ID
          availableTopics={availableTopicsForAssignment}
        />
      )}

      {/* Grade Assignment Modal */}
      {showGradeModal && (
        <GradeAssignmentModal
          show={showGradeModal}
          onClose={() => setShowGradeModal(false)}
          onSubmitSuccess={handleGradeSubmission}
          selectedAssignment={selectedAssignmentForGrading}
          submissionToGrade={submissionToGrade}
        />
      )}

      {/* Submit Assignment Modal */}
      {showSubmitAssignmentModal && assignmentToSubmit && (
        <SubmitAssignmentModal
          assignment={assignmentToSubmit}
          onClose={() => setShowSubmitAssignmentModal(false)}
          onSubmit={handleSubmitAssignment}
        />
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Add Student to "{classroom.name}"</h3>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select a student to add</option>
                  {availableStudents.map(student => (
                    <option key={student._id} value={student._id}>{student.name} ({student.email})</option>
                  ))}
                </select>
                {availableStudents.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">No available students to add at this time.</p>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedStudentId || availableStudents.length === 0} // Disable if no student selected or no available students
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Teacher Modal */}
      {showChangeTeacherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Change Teacher for "{classroom.name}"</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select New Teacher</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Select a teacher</option>
                  {availableTeachers.map(teacher => (
                    <option key={teacher._id} value={teacher._id}>{teacher.name} ({teacher.email})</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowChangeTeacherModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleChangeTeacher}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Change Teacher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ClassroomDetail;

