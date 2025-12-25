import React, { useEffect, useState } from 'react';
import { Calendar, FileText, CheckCircle, Plus, Book, Send, Search } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CreateAssignmentModal from '../components/CreateAssignmentModal';
import GradeAssignmentModal from '../components/GradeAssignmentModal'; // Import the new modal component
import SubmitAssignmentModal from '../components/SubmitAssignmentModal';

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

  useEffect(() => {
    fetchAssignments();
    if (['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role)) {
      fetchClassroomsForCreation();
    }
    // Listen for school selection changes
    const handler = () => {
      fetchAssignments();
      if (['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role)) {
        fetchClassroomsForCreation();
      }
    };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, [user]);

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
      } else if (['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role)) {
        const classroomsRes = await api.get('/classrooms');
        let relevantClassrooms = classroomsRes.data.classrooms;

        if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
          relevantClassrooms = relevantClassrooms.filter(c => c.teacherId?._id === user?._id);
        } else if (user?.role === 'school_admin') {
          relevantClassrooms = relevantClassrooms.filter(c => c.schoolId?._id === user?.schoolId);
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
        filteredClassrooms = filteredClassrooms.filter(c => c.schoolId?._id === user?.schoolId);
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

  const handleSubmitAssignment = async (assignmentId, answers) => {
    try {
      await api.post(`/assignments/${assignmentId}/submit`, { answers });
      setShowSubmitAssignmentModal(false);
      setAssignmentToSubmit(null);
      fetchAssignments();
    } catch (error) {
      alert(error.response?.data?.message || 'Error submitting assignment');
    }
  };

  const handleGradeAssignment = () => {
    // This function will now simply close the modal and refresh assignments,
    // as the API call is handled within GradeAssignmentModal
    setShowGradeModal(false);
    fetchAssignments();
  };

  const canCreateAssignment = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);
  const canGradeAssignment = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);

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
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
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
              
              console.log(`Assignment: ${assignment.title}, isSubmitted: ${isSubmitted}, submission:`, submission, `user._id: ${user?._id}`);
              
              const canViewSubmissions = canGradeAssignment && (assignment.submissions && assignment.submissions.length > 0);

              return (
                <div key={assignment._id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        {assignment.title}
                        {assignment.topicId?.name && (
                          <span className="ml-2 text-sm font-normal text-gray-500">
                            ({assignment.topicId.name})
                          </span>
                        )}
                      </h3>
                      <p className="text-gray-600 mt-1">{assignment.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Show "Graded" only if graded AND (theory OR MCQ with results published) */}
                      {isGraded && (assignment.assignmentType === 'theory' || (assignment.assignmentType === 'mcq' && (!assignment.publishResultsAt || new Date() >= new Date(assignment.publishResultsAt)))) && (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                          Graded
                        </span>
                      )}
                      {/* Show "Submitted" only if submitted AND NOT graded (or MCQ graded but results not published yet) */}
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

                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-1" />
                      Max Score: {assignment.maxScore}
                    </div>
                    {assignment.assignmentType === 'mcq' && assignment.publishResultsAt && (
                      <div className="flex items-center">
                        <Book className="w-4 h-4 mr-1" />
                        Results Publish: {new Date(assignment.publishResultsAt).toLocaleDateString()} {new Date(assignment.publishResultsAt).toLocaleTimeString()}
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
                      onClick={() => {
                        setAssignmentToSubmit(assignment);
                        setShowSubmitAssignmentModal(true);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Submit Assignment
                    </button>
                  )}

                  {/* Teacher/Admin: View and Grade Submissions */}
                  {canGradeAssignment && (user?.role === 'teacher' || user?.role === 'personal_teacher' ? assignment.classroomId?.teacherId?._id === user?._id : true) && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="font-semibold text-gray-700 mb-3">Submissions ({assignment.submissions?.length || 0}):</h4>
                      {assignment.submissions && assignment.submissions.length > 0 ? (
                        assignment.submissions.map(sub => (
                          <div key={sub._id} className="flex justify-between items-center p-3 border rounded-lg mb-2 bg-gray-50">
                            <div>
                              <p className="font-medium text-gray-800">{sub.studentId?.name || 'Unknown Student'}</p>
                              <p className="text-sm text-gray-600">Status: {sub.status}</p>
                              {sub.status === 'graded' && (
                                <p className="text-sm text-gray-600">Score: {sub.score}/{assignment.maxScore}</p>
                              )}
                              {/* Display answers based on type */}
                              {assignment.assignmentType === 'theory' && sub.answers && <p className="text-xs text-gray-500 mt-1">Answer: {sub.answers}</p>}
                              {assignment.assignmentType === 'mcq' && sub.answers && Array.isArray(sub.answers) && (
                                <div className="text-xs text-gray-500 mt-1">
                                  <p>Selected options:</p>
                                  <ul>
                                    {sub.answers.map((ans, ansIdx) => (
                                      <li key={ansIdx}>- {ans}
                                      {assignment.questions[ansIdx].correctOption && (
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
                            {canGradeAssignment && (user?.role === 'teacher' || user?.role === 'personal_teacher' ? sub.studentId?._id === user?._id : true) && (
                              <button
                                onClick={() => {
                                  setSelectedAssignment(assignment);
                                  setSubmissionToGrade(sub);
                                  setShowGradeModal(true);
                                }}
                                className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                              >
                                Grade
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-center py-2">No submissions yet.</p>
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
          onClose={() => setShowCreateAssignmentModal(false)}
          onSubmitSuccess={handleCreateAssignmentSuccess}
          availableTopics={topics}
          availableClassrooms={classrooms}
        />
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
        />
      )}
    </Layout>
  );
};

export default Assignments;