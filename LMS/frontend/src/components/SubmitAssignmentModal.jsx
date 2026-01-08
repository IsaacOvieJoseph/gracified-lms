import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const SubmitAssignmentModal = ({ assignment, onClose, onSubmit, isSubmitting }) => {
  const [studentAnswers, setStudentAnswers] = useState(() => {
    if (assignment.assignmentType === 'mcq') {
      return Array(assignment.questions.length).fill('');
    } else if (assignment.assignmentType === 'theory') {
      return Array(assignment.questions.length).fill('');
    }
    return [];
  });

  const handleAnswerChange = (qIndex, value) => {
    setStudentAnswers(prevAnswers => {
      const newAnswers = [...prevAnswers];
      newAnswers[qIndex] = value;
      return newAnswers;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const allAnswered = studentAnswers.every(answer => {
      if (assignment.assignmentType === 'mcq') {
        return typeof answer === 'string' && answer.trim() !== '';
      } else if (assignment.assignmentType === 'theory') {
        return typeof answer === 'string' && answer.trim() !== '';
      }
      return false;
    });

    if (!allAnswered) {
      toast.error('Please answer all questions before submitting.');
      return;
    }

    onSubmit(assignment._id, studentAnswers);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 space-y-4 overflow-y-auto max-h-[90vh]">
        <h3 className="text-xl font-bold mb-4">Submit Assignment: {assignment.title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {assignment.questions.map((question, qIndex) => (
            <div key={qIndex} className="border p-4 rounded-lg bg-gray-50">
              <p className="font-medium text-gray-800 mb-2">Question {qIndex + 1}: {question.questionText}</p>
              {assignment.assignmentType === 'mcq' && (
                <div className="space-y-2">
                  {question.options.map((option, oIndex) => (
                    <label key={oIndex} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name={`mcq-question-${qIndex}`}
                        value={option}
                        checked={studentAnswers[qIndex] === option}
                        onChange={() => handleAnswerChange(qIndex, option)}
                        className="form-radio text-blue-600"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              )}
              {assignment.assignmentType === 'theory' && (
                <div>
                  <textarea
                    value={studentAnswers[qIndex]}
                    onChange={(e) => handleAnswerChange(qIndex, e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                    rows="4"
                    required
                  ></textarea>
                </div>
              )}
            </div>
          ))}

          <div className="flex space-x-3 mt-6">
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
              Submit Answers
              {isSubmitting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitAssignmentModal;
