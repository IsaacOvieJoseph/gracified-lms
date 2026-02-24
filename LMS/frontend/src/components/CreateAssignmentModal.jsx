import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { toLocalISOString } from '../utils/timezone';

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
    questions: [{ questionText: '', options: ['', ''], correctOption: '', markingPreference: 'manual', maxScore: 0 }],
    published: true
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
        dueDate: editAssignment.dueDate ? toLocalISOString(editAssignment.dueDate).split('T')[0] : '',
        maxScore: editAssignment.maxScore || 100,
        assignmentType: editAssignment.assignmentType || 'theory',
        publishResultsAt: editAssignment.publishResultsAt ? toLocalISOString(editAssignment.publishResultsAt) : '',
        questions: editAssignment.questions || [{ questionText: '', options: ['', ''], correctOption: '', markingPreference: 'manual', maxScore: 0 }],
        published: editAssignment.published !== false
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

      const submitData = {
        ...createForm,
        // Convert to UTC before sending
        publishResultsAt: createForm.publishResultsAt ? new Date(createForm.publishResultsAt).toISOString() : '',
        dueDate: createForm.dueDate ? new Date(createForm.dueDate).toISOString() : ''
      };

      if (editAssignment) {
        await api.put(`/assignments/${editAssignment._id}`, submitData, { skipLoader: true });
        toast.success('Assignment updated successfully!');
      } else {
        await api.post('/assignments', submitData, { skipLoader: true });
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
        questions: [{ questionText: '', options: ['', ''], correctOption: '', markingPreference: 'manual', maxScore: 0 }],
        published: true
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] shadow-2xl max-w-4xl w-full p-8 animate-slide-up">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-bold text-slate-900">{editAssignment ? 'Edit Assignment' : 'New Assignment'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={(e) => { setIsSubmitting(true); handleSubmit(e); }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label>Assignment Title</label>
                <input
                  type="text"
                  placeholder="e.g. Mid-term Assessment"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label>Description</label>
                <textarea
                  placeholder="Instructions for students..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full"
                  rows="2"
                />
              </div>

              {!classroomId && (
                <div>
                  <label>Classroom</label>
                  <select
                    value={createForm.classroomId}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, classroomId: e.target.value, topicId: '' });
                    }}
                    className="w-full"
                    required
                  >
                    <option value="">Select a classroom</option>
                    {availableTopics?.length > 0 && availableTopics[0]?.classroomId && (
                      <option value={availableTopics[0].classroomId._id}>
                        {availableTopics[0].classroomId.name}
                      </option>
                    )}
                  </select>
                </div>
              )}

              {availableTopics && availableTopics.length > 0 && (
                <div className={classroomId ? "md:col-span-2" : ""}>
                  <label>Topic (Optional)</label>
                  <select
                    value={createForm.topicId}
                    onChange={(e) => setCreateForm({ ...createForm, topicId: e.target.value })}
                    className="w-full"
                  >
                    <option value="">Select a topic</option>
                    {availableTopics.map(t => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <label>Assignment Type</label>
                <div className="flex gap-4 p-1 bg-slate-100 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, assignmentType: 'theory', questions: [{ questionText: '', markingPreference: 'manual', maxScore: 0 }], publishResultsAt: '' })}
                    className={`px-6 py-2 rounded-lg font-bold transition-all ${createForm.assignmentType === 'theory' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Theory
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, assignmentType: 'mcq', questions: [{ questionText: '', options: ['', ''], correctOption: '' }] })}
                    className={`px-6 py-2 rounded-lg font-bold transition-all ${createForm.assignmentType === 'mcq' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    MCQ
                  </button>
                </div>
              </div>
            </div>

            {/* Questions Section */}
            <div className="space-y-4 border-2 border-gray-200 p-5 rounded-2xl bg-gradient-to-br from-gray-50 to-white">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-gray-800 flex items-center">
                  <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg mr-3 text-sm font-extrabold">
                    {createForm.questions.length}
                  </span>
                  Questions
                </h4>
                {createForm.assignmentType === 'theory' && (
                  <label className="inline-flex items-center bg-white px-3 py-2 rounded-lg border-2 border-gray-200 hover:border-indigo-300 transition-all cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-indigo-600 rounded"
                      checked={isEvenlyDistributed}
                      onChange={(e) => setIsEvenlyDistributed(e.target.checked)}
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Same Weight Per Question</span>
                  </label>
                )}
              </div>
              {createForm.assignmentType === 'theory' && isEvenlyDistributed && (
                <div className="mb-4 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl">
                  <label className="block text-sm font-bold text-indigo-700 mb-2">Overall Max Score (for even distribution)</label>
                  <input
                    type="number"
                    value={overallMaxScoreInput}
                    onChange={(e) => setOverallMaxScoreInput(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-indigo-900"
                    min="1"
                  />
                </div>
              )}
              {createForm.questions.map((question, qIndex) => (
                <div key={qIndex} className="space-y-4 p-5 border-2 border-gray-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                        {qIndex + 1}
                      </span>
                      <h5 className="text-sm font-bold text-gray-700">Question {qIndex + 1}</h5>
                    </div>
                    {createForm.questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(qIndex)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Question Text</label>
                    <input
                      type="text"
                      value={question.questionText}
                      onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                      placeholder="What is alphabet before any cluster of t"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-900 placeholder:text-gray-300"
                      required
                    />
                  </div>

                  {createForm.assignmentType === 'mcq' && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500">Answer Options</label>
                        <span className="text-xs text-gray-400 font-medium italic">Select correct answer</span>
                      </div>
                      <div className="space-y-2">
                        {question.options.map((option, oIndex) => {
                          const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                          const isCorrect = question.correctOption === option;

                          return (
                            <div
                              key={oIndex}
                              className={`flex items-center gap-3 p-3 rounded-xl transition-all border-2 ${isCorrect
                                ? 'border-green-400 bg-green-50'
                                : 'border-gray-200 bg-white hover:border-indigo-200'
                                }`}
                            >
                              {/* Option Label */}
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm transition-all ${isCorrect
                                ? 'bg-green-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600'
                                }`}>
                                {optionLabels[oIndex]}
                              </div>

                              {/* Option Input */}
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                placeholder={optionLabels[oIndex]}
                                className={`flex-1 px-3 py-2 bg-transparent border-none outline-none font-medium focus:ring-0 ${isCorrect ? 'text-green-900' : 'text-gray-800'
                                  }`}
                                required
                              />

                              {/* Correct Radio Button */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correctOption-${qIndex}`}
                                  value={option}
                                  checked={isCorrect}
                                  onChange={() => handleCorrectOptionChange(qIndex, option)}
                                  className="w-5 h-5 text-green-600 focus:ring-green-500"
                                />
                                <label className={`text-sm font-medium ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}>
                                  Correct
                                </label>
                              </div>

                              {/* Remove Option Button */}
                              {question.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeOption(qIndex, oIndex)}
                                  className="text-rose-400 hover:text-rose-600 text-sm font-medium px-2"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => addOption(qIndex)}
                        className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2 font-medium text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Option
                      </button>
                    </div>
                  )}

                  {createForm.assignmentType === 'theory' && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Marking Preference</label>
                        <select
                          value={question.markingPreference}
                          onChange={(e) => handleMarkingPreferenceChange(qIndex, e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium appearance-none cursor-pointer"
                          required
                        >
                          <option value="manual">Manual</option>
                          <option value="ai">AI Marking</option>
                        </select>
                      </div>
                      {!isEvenlyDistributed && (
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Max Score for Q{qIndex + 1}</label>
                          <input
                            type="number"
                            value={question.maxScore}
                            onChange={(e) => handleQuestionMaxScoreChange(qIndex, e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-indigo-700"
                            min="0"
                            required
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addQuestion}
                className="w-full px-4 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center space-x-2 font-bold shadow-lg hover:shadow-xl"
              >
                <Plus className="w-5 h-5" />
                <span>Add Another Question</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div>
                <label>Due Date</label>
                <input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                  className="w-full"
                />
              </div>
              {createForm.assignmentType === 'mcq' && (
                <>
                  <div>
                    <label>Publish Results At</label>
                    <input
                      type="datetime-local"
                      value={createForm.publishResultsAt}
                      onChange={(e) => setCreateForm({ ...createForm, publishResultsAt: e.target.value })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label>Max Score</label>
                    <input
                      type="number"
                      value={createForm.maxScore}
                      onChange={(e) => setCreateForm({ ...createForm, maxScore: parseInt(e.target.value) })}
                      className="w-full"
                      min="1"
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-10 h-6 flex items-center p-1 rounded-full transition-colors ${createForm.published ? 'bg-primary' : 'bg-slate-200'}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={createForm.published}
                      onChange={(e) => setCreateForm({ ...createForm, published: e.target.checked })}
                    />
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${createForm.published ? 'translate-x-4' : ''}`} />
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">Published</span>
                    <p className="text-xs text-slate-400 font-medium">Assignment will be visible to students immediately</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-premium flex-1"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editAssignment ? 'Update Assignment' : 'Create Assignment')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateAssignmentModal;
