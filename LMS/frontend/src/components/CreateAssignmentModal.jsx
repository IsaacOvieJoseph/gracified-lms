import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const CreateAssignmentModal = ({ show, onClose, onSubmitSuccess, classroomId, availableTopics, editAssignment }) => {
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    classroomId: classroomId || '', // Use prop if provided, otherwise empty
    topicId: '',
    dueDate: '',
    maxScore: 100,
    assignmentType: 'theory',
    publishResultsAt: '', // New field for MCQ result release time
    questions: [{ questionText: '', options: ['', ''], correctOption: '', markingPreference: 'manual', maxScore: 0 }]
  });

  const [isEvenlyDistributed, setIsEvenlyDistributed] = useState(false); // New state for checkbox
  const [overallMaxScoreInput, setOverallMaxScoreInput] = useState(100); // For even distribution input

  useEffect(() => {
    if (editAssignment) {
      setCreateForm({
        title: editAssignment.title || '',
        description: editAssignment.description || '',
        classroomId: editAssignment.classroomId?._id || editAssignment.classroomId || classroomId || '',
        topicId: editAssignment.topicId?._id || editAssignment.topicId || '',
        dueDate: editAssignment.dueDate ? new Date(editAssignment.dueDate).toISOString().split('T')[0] : '',
        maxScore: editAssignment.maxScore || 100,
        assignmentType: editAssignment.assignmentType || 'theory',
        publishResultsAt: editAssignment.publishResultsAt ? new Date(editAssignment.publishResultsAt).toISOString().slice(0, 16) : '',
        questions: editAssignment.questions || [{ questionText: '', options: ['', ''], correctOption: '', markingPreference: 'manual', maxScore: 0 }]
      });
      setOverallMaxScoreInput(editAssignment.maxScore || 100);
    } else if (classroomId) {
      setCreateForm(prevForm => ({ ...prevForm, classroomId }));
    }
  }, [classroomId, editAssignment]);

  if (!show) {
    return null;
  }

  const handleQuestionTextChange = (qIndex, value) => {
    const newQuestions = [...createForm.questions];
    newQuestions[qIndex].questionText = value;
    setCreateForm({ ...createForm, questions: newQuestions });
  };

  const handleQuestionMaxScoreChange = (qIndex, value) => {
    const newQuestions = [...createForm.questions];
    newQuestions[qIndex].maxScore = parseInt(value) || 0;
    setCreateForm({ ...createForm, questions: newQuestions });
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const newQuestions = [...createForm.questions];
    newQuestions[qIndex].options[oIndex] = value;
    setCreateForm({ ...createForm, questions: newQuestions });
  };

  const handleCorrectOptionChange = (qIndex, option) => {
    const newQuestions = [...createForm.questions];
    newQuestions[qIndex].correctOption = option;
    setCreateForm({ ...createForm, questions: newQuestions });
  };

  const handleMarkingPreferenceChange = (qIndex, value) => {
    const newQuestions = [...createForm.questions];
    newQuestions[qIndex].markingPreference = value;
    setCreateForm({ ...createForm, questions: newQuestions });
  };

  const addOption = (qIndex) => {
    const newQuestions = [...createForm.questions];
    newQuestions[qIndex].options.push('');
    setCreateForm({ ...createForm, questions: newQuestions });
  };

  const removeOption = (qIndex, oIndex) => {
    const newQuestions = [...createForm.questions];
    newQuestions[qIndex].options.splice(oIndex, 1);
    setCreateForm({ ...createForm, questions: newQuestions });
  };

  const addQuestion = () => {
    const newQuestionTemplate = createForm.assignmentType === 'mcq'
      ? { questionText: '', options: ['', ''], correctOption: '' }
      : { questionText: '', markingPreference: 'manual', maxScore: 0 };
    setCreateForm({ ...createForm, questions: [...createForm.questions, newQuestionTemplate] });
  };

  const removeQuestion = (qIndex) => {
    const newQuestions = [...createForm.questions];
    newQuestions.splice(qIndex, 1);
    setCreateForm({ ...createForm, questions: newQuestions });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Basic validation based on assignmentType
      if (createForm.assignmentType === 'mcq') {
        for (const q of createForm.questions) {
          if (!q.questionText || !Array.isArray(q.options) || q.options.length < 2 || !q.correctOption) {
            toast.error('MCQ questions must have text, at least two options, and a correct option.');
            return;
          }
          if (!q.options.includes(q.correctOption)) {
            toast.error('Correct option must be one of the provided options for MCQ.');
            return;
          }
        }
        // Validate publishResultsAt for MCQ assignments
        if (createForm.publishResultsAt && isNaN(new Date(createForm.publishResultsAt).getTime())) {
          toast.error('Invalid publish results date and time.');
          return;
        }
      } else if (createForm.assignmentType === 'theory') {
        for (const q of createForm.questions) {
          if (!q.questionText || !q.markingPreference || !['ai', 'manual'].includes(q.markingPreference)) {
            toast.error('Theory questions must have text and a valid marking preference.');
            return;
          }
        }
        if (createForm.publishResultsAt) {
          toast.error('Publish results date is only applicable for MCQ assignments.');
          return;
        }
      }

      // Handle maxScore for theory assignments
      if (createForm.assignmentType === 'theory') {
        let newQuestions = [...createForm.questions];
        let calculatedOverallMaxScore = 0;

        if (isEvenlyDistributed) {
          if (overallMaxScoreInput <= 0) {
            toast.error('Overall Max Score must be greater than 0 for even distribution.');
            return;
          }
          const questionsCount = newQuestions.length;
          const scorePerQuestion = Math.floor(overallMaxScoreInput / questionsCount);
          let remainder = overallMaxScoreInput % questionsCount;

          for (let i = 0; i < newQuestions.length; i++) {
            newQuestions[i].maxScore = scorePerQuestion + (remainder > 0 ? 1 : 0);
            if (remainder > 0) remainder--;
          }
          calculatedOverallMaxScore = overallMaxScoreInput;
        } else { // per_question
          for (const q of newQuestions) {
            if (q.maxScore <= 0) {
              toast.error('Each theory question must have a max score greater than 0.');
              return;
            }
            calculatedOverallMaxScore += q.maxScore;
          }
        }

        setCreateForm(prevForm => ({
          ...prevForm,
          questions: newQuestions,
          maxScore: calculatedOverallMaxScore // Set the overall maxScore for the assignment
        }));
      }

      if (editAssignment) {
        await api.put(`/assignments/${editAssignment._id}`, createForm, { skipLoader: true });
        toast.success('Assignment updated successfully!');
      } else {
        await api.post('/assignments', createForm, { skipLoader: true });
        toast.success('Assignment created successfully!');
      }
      onClose();
      onSubmitSuccess(); // Callback to refresh assignments in parent component
      setCreateForm({ // Reset form after successful submission
        title: '',
        description: '',
        classroomId: classroomId || '',
        topicId: '',
        dueDate: '',
        maxScore: 100,
        assignmentType: 'theory',
        publishResultsAt: '',
        questions: [{ questionText: '', options: ['', ''], correctOption: '', markingPreference: 'manual', maxScore: 0 }]
      });
      setIsEvenlyDistributed(false); // Reset checkbox state
      setOverallMaxScoreInput(100); // Reset overall max score input
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 overflow-y-auto max-h-[90vh]">
        <h3 className="text-xl font-bold mb-4">{editAssignment ? 'Edit Assignment' : 'Create New Assignment'}</h3>
        <form onSubmit={(e) => { setIsSubmitting(true); handleSubmit(e); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              rows="3"
            />
          </div>
          {/* Classroom selection is only shown if classroomId prop is NOT provided */}
          {!classroomId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classroom</label>
              <select
                value={createForm.classroomId}
                onChange={(e) => {
                  setCreateForm({ ...createForm, classroomId: e.target.value, topicId: '' });
                }}
                className="w-full px-4 py-2 border rounded-lg"
                required
              >
                <option value="">Select a classroom</option>
                {/* Assuming availableTopics has classroom info or we need a separate prop for classrooms */}
                {/* For now, just show a placeholder, actual classroom fetching needs to be passed down or handled here */}
                {/* This will be handled in Assignments.jsx, for ClassroomDetail.jsx, classroomId is already passed */}
                {availableTopics?.length > 0 && availableTopics[0]?.classroomId && (
                  <option value={availableTopics[0].classroomId._id}>
                    {availableTopics[0].classroomId.name}
                  </option>
                )}
              </select>
            </div>
          )}

          {availableTopics && availableTopics.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic (Optional)</label>
              <select
                value={createForm.topicId}
                onChange={(e) => setCreateForm({ ...createForm, topicId: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Select a topic</option>
                {availableTopics.map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Type</label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="assignmentType"
                  value="theory"
                  checked={createForm.assignmentType === 'theory'}
                  onChange={(e) => setCreateForm({ ...createForm, assignmentType: e.target.value, questions: [{ questionText: '', markingPreference: 'manual', maxScore: 0 }], publishResultsAt: '' })}
                />
                <span className="ml-2">Theory</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="assignmentType"
                  value="mcq"
                  checked={createForm.assignmentType === 'mcq'}
                  onChange={(e) => setCreateForm({ ...createForm, assignmentType: e.target.value, questions: [{ questionText: '', options: ['', ''], correctOption: '' }] })}
                />
                <span className="ml-2">MCQ</span>
              </label>
            </div>
          </div>

          {/* Questions Section */}
          <div className="space-y-4 border p-4 rounded-lg bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-gray-800">Questions</h4>
              {createForm.assignmentType === 'theory' && (
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={isEvenlyDistributed}
                    onChange={(e) => setIsEvenlyDistributed(e.target.checked)}
                  />
                  <span className="ml-2">Same Weight Per Question</span>
                </label>
              )}
            </div>
            {createForm.assignmentType === 'theory' && isEvenlyDistributed && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Overall Max Score (for even distribution)</label>
                <input
                  type="number"
                  value={overallMaxScoreInput}
                  onChange={(e) => setOverallMaxScoreInput(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border rounded-lg"
                  min="1"
                />
              </div>
            )}
            {createForm.questions.map((question, qIndex) => (
              <div key={qIndex} className="space-y-3 p-4 border rounded-lg bg-white shadow-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question {qIndex + 1} Text</label>
                  <input
                    type="text"
                    value={question.questionText}
                    onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>

                {createForm.assignmentType === 'mcq' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Options</label>
                    {question.options.map((option, oIndex) => (
                      <div key={oIndex} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                          className="flex-1 px-4 py-2 border rounded-lg"
                          required
                        />
                        <input
                          type="radio"
                          name={`correctOption-${qIndex}`}
                          value={option}
                          checked={question.correctOption === option}
                          onChange={() => handleCorrectOptionChange(qIndex, option)}
                          className="form-radio text-green-600"
                        />
                        <label className="text-sm text-gray-600">Correct</label>
                        {question.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(qIndex, oIndex)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOption(qIndex)}
                      className="mt-2 px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                    >
                      Add Option
                    </button>
                  </div>
                )}

                {createForm.assignmentType === 'theory' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marking Preference</label>
                    <select
                      value={question.markingPreference}
                      onChange={(e) => handleMarkingPreferenceChange(qIndex, e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg"
                      required
                    >
                      <option value="manual">Manual</option>
                      <option value="ai">AI Marking</option>
                    </select>
                    {!isEvenlyDistributed && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Score for Q{qIndex + 1}</label>
                        <input
                          type="number"
                          value={question.maxScore}
                          onChange={(e) => handleQuestionMaxScoreChange(qIndex, e.target.value)}
                          className="w-full px-4 py-2 border rounded-lg"
                          min="0"
                          required
                        />
                      </div>
                    )}
                  </div>
                )}

                {createForm.questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove Question
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addQuestion}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Question</span>
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (Optional)</label>
            <input
              type="date"
              value={createForm.dueDate}
              onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
          {createForm.assignmentType === 'mcq' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Publish Results At (Optional for MCQ)</label>
              <input
                type="datetime-local"
                value={createForm.publishResultsAt}
                onChange={(e) => setCreateForm({ ...createForm, publishResultsAt: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          )}
          {createForm.assignmentType === 'mcq' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Score</label>
              <input
                type="number"
                value={createForm.maxScore}
                onChange={(e) => setCreateForm({ ...createForm, maxScore: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg"
                min="1"
              />
            </div>
          )}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center"
            >
              {editAssignment ? 'Update Assignment' : 'Create Assignment'}
              {isSubmitting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAssignmentModal;
