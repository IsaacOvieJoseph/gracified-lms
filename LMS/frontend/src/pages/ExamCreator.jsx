import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    Save,
    ArrowLeft,
    Plus,
    Trash2,
    Clock,
    Globe,
    Lock,
    Layout as LayoutIcon,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    AlertCircle,
    HelpCircle
} from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';

const ExamCreator = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;

    const [loading, setLoading] = useState(false);
    const [classrooms, setClassrooms] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        duration: 60,
        accessMode: 'registered',
        isPublished: false,
        resultPublishTime: '',
        classId: '',
        dueDate: '',
        questions: [
            {
                questionText: '',
                questionType: 'mcq',
                options: ['', '', '', ''],
                correctOptionIndex: 0,
                maxScore: 1
            }
        ]
    });

    useEffect(() => {
        fetchClassrooms();
        if (isEditing) {
            fetchExam();
        }
    }, [id]);

    const fetchClassrooms = async () => {
        try {
            const response = await api.get('/classrooms');
            setClassrooms(response.data);
        } catch (error) {
            console.error('Failed to fetch classrooms');
        }
    };

    const fetchExam = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/exams/${id}`);
            const exam = response.data;

            // Map correctOption text back to index for internal state
            const mappedQuestions = exam.questions.map(q => ({
                ...q,
                correctOptionIndex: q.options.indexOf(q.correctOption)
            }));

            setFormData({
                ...exam,
                questions: mappedQuestions
            });
        } catch (error) {
            toast.error('Failed to fetch exam details');
            navigate('/exams');
        } finally {
            setLoading(false);
        }
    };

    const addQuestion = () => {
        setFormData({
            ...formData,
            questions: [
                ...formData.questions,
                {
                    questionText: '',
                    questionType: 'mcq',
                    options: ['', '', '', ''],
                    correctOptionIndex: 0,
                    maxScore: 1
                }
            ]
        });
    };

    const removeQuestion = (index) => {
        if (formData.questions.length === 1) {
            toast.error('At least one question is required');
            return;
        }
        const newQuestions = [...formData.questions];
        newQuestions.splice(index, 1);
        setFormData({ ...formData, questions: newQuestions });
    };

    const handleQuestionChange = (index, field, value) => {
        const newQuestions = [...formData.questions];
        newQuestions[index][field] = value;
        setFormData({ ...formData, questions: newQuestions });
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const newQuestions = [...formData.questions];
        newQuestions[qIndex].options[oIndex] = value;
        setFormData({ ...formData, questions: newQuestions });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Prepare questions for backend (convert index to text)
            const preparedQuestions = formData.questions.map(q => ({
                ...q,
                correctOption: q.options[q.correctOptionIndex]
            }));

            const submissionData = {
                ...formData,
                questions: preparedQuestions
            };

            if (isEditing) {
                await api.put(`/exams/${id}`, submissionData);
                toast.success('Exam updated successfully');
            } else {
                await api.post('/exams', submissionData);
                toast.success('Exam created successfully');
            }
            navigate('/exams');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save exam');
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEditing) {
        return <Layout><div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div></Layout>;
    }

    return (
        <Layout>
            <div className="max-w-4xl mx-auto pb-20">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Header */}
                    <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-0 z-10 backdrop-blur-md bg-white/90">
                        <div className="flex items-center space-x-4">
                            <button
                                type="button"
                                onClick={() => navigate('/exams')}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                title="Go Back"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {isEditing ? 'Edit Exam' : 'Create Standard Exam'}
                            </h1>
                        </div>
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center bg-gray-50 rounded-xl px-4 py-2 border border-gray-100">
                                <span className="text-sm font-medium text-gray-500 mr-3">Status:</span>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isPublished: !formData.isPublished })}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${formData.isPublished
                                        ? 'bg-green-100 text-green-700 shadow-sm ring-1 ring-green-200'
                                        : 'bg-gray-200 text-gray-600'
                                        }`}
                                >
                                    {formData.isPublished ? 'Published' : 'Draft'}
                                </button>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-50"
                            >
                                {loading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-5 h-5" />}
                                <span>{isEditing ? 'Update Exam' : 'Create Exam'}</span>
                            </button>
                        </div>
                    </div>

                    {/* General Settings Section */}
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50/50 px-8 py-4 border-b border-gray-100 flex items-center space-x-2">
                            <LayoutIcon className="w-4 h-4 text-indigo-500" />
                            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Exam Configuration</h2>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 flex items-center">
                                        Exam Title <span className="text-red-400 ml-1">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g., Mid-Term Mathematics Assessment"
                                        className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-gray-900 font-medium placeholder:text-gray-400"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 flex items-center">
                                        Duration (Minutes) <span className="text-red-400 ml-1">*</span>
                                    </label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-gray-900"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Provide instructions for the candidates..."
                                    rows="3"
                                    className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-gray-700 leading-relaxed"
                                />
                            </div>

                            <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700">Class Association (Optional)</label>
                                    <select
                                        value={formData.classId || ''}
                                        onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-gray-700 font-bold appearance-none"
                                    >
                                        <option value="">Standalone Exam</option>
                                        {classrooms.map(cls => (
                                            <option key={cls._id} value={cls._id}>{cls.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-gray-400 font-medium italic">
                                        {formData.classId ? '"Registered" mode will restrict access to enrolled students only.' : 'Standalone exams in "Registered" mode are open to any LMS user.'}
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-gray-700">Due Date (Optional)</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.dueDate ? new Date(formData.dueDate).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-gray-700"
                                    />
                                    <p className="text-[10px] text-gray-400 font-medium">Leave empty for no deadline.</p>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col md:flex-row gap-6">
                                <div className="flex-1 space-y-3">
                                    <label className="text-sm font-bold text-gray-700">Access Control</label>
                                    <div className="flex space-x-4">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, accessMode: 'registered' })}
                                            className={`flex-1 flex items-center justify-center p-4 rounded-2xl border-2 transition-all ${formData.accessMode === 'registered'
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                                                }`}
                                        >
                                            <Lock className="w-5 h-5 mr-3" />
                                            <div className="text-left">
                                                <div className="text-sm font-bold">Authenticated</div>
                                                <div className="text-[10px] opacity-70">Enrolled/LMS users</div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, accessMode: 'open' })}
                                            className={`flex-1 flex items-center justify-center p-4 rounded-2xl border-2 transition-all ${formData.accessMode === 'open'
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                                                }`}
                                        >
                                            <Globe className="w-5 h-5 mr-3" />
                                            <div className="text-left">
                                                <div className="text-sm font-bold">Public Link</div>
                                                <div className="text-[10px] opacity-70">Anyone can take</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-3">
                                    <label className="text-sm font-bold text-gray-700">Result Publish Time (Optional)</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.resultPublishTime ? new Date(formData.resultPublishTime).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setFormData({ ...formData, resultPublishTime: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-gray-700"
                                    />
                                    <p className="text-[10px] text-gray-400 font-medium">Leave empty to show results immediately.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Questions Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center">
                                <HelpCircle className="w-6 h-6 mr-3 text-indigo-500" />
                                Examination Questions
                            </h3>
                            <div className="bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-extrabold shadow-sm">
                                {formData.questions.length} Items
                            </div>
                        </div>

                        {formData.questions.map((q, qIndex) => (
                            <div key={qIndex} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden transform transition-all hover:shadow-md">
                                <div className="bg-gray-50/50 px-8 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                                            {qIndex + 1}
                                        </span>
                                        <h4 className="text-sm font-bold text-gray-600">Question Item</h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeQuestion(qIndex)}
                                        className="p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-8 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Question Statement</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Type your question here..."
                                                    value={q.questionText}
                                                    onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                                                    className="w-full px-0 py-2 bg-transparent border-b-2 border-gray-100 focus:border-indigo-500 transition-all font-bold text-lg text-gray-900 placeholder:text-gray-200 outline-none"
                                                />
                                            </div>
                                            <div className="w-full md:w-32 space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Score</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={q.maxScore}
                                                    onChange={(e) => handleQuestionChange(qIndex, 'maxScore', parseInt(e.target.value))}
                                                    className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-center"
                                                />
                                            </div>
                                            <div className="w-full md:w-48 space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Type</label>
                                                <select
                                                    value={q.questionType}
                                                    onChange={(e) => handleQuestionChange(qIndex, 'questionType', e.target.value)}
                                                    className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold appearance-none cursor-pointer"
                                                >
                                                    <option value="mcq">Multiple Choice</option>
                                                    <option value="theory">Theory/Essay</option>
                                                </select>
                                            </div>
                                        </div>

                                        {q.questionType === 'mcq' ? (
                                            <div className="space-y-4 pt-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-4">Aswer Options (Select correct ones)</label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {q.options.map((opt, oIndex) => (
                                                        <div
                                                            key={oIndex}
                                                            className={`flex items-center p-3 rounded-2xl transition-all border-2 ${q.correctOptionIndex === oIndex
                                                                ? 'border-green-500 bg-green-50 shadow-sm'
                                                                : 'border-gray-50 bg-gray-50/50 focus-within:bg-white focus-within:border-indigo-100'
                                                                }`}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuestionChange(qIndex, 'correctOptionIndex', oIndex)}
                                                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${q.correctOptionIndex === oIndex
                                                                    ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                                                                    : 'bg-white border-2 border-gray-200 text-transparent'
                                                                    }`}
                                                            >
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </button>
                                                            <input
                                                                type="text"
                                                                required
                                                                placeholder={`Option ${oIndex + 1}`}
                                                                value={opt}
                                                                onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                                                className="ml-4 flex-1 bg-transparent border-none outline-none font-medium text-gray-800 focus:ring-0"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="pt-4 p-6 bg-indigo-50/50 rounded-2xl border-2 border-dashed border-indigo-100">
                                                <p className="text-sm font-bold text-indigo-700 flex items-center">
                                                    <AlertCircle className="w-4 h-4 mr-2" />
                                                    Theory questions require manual grading by the teacher.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addQuestion}
                            className="w-full py-8 border-2 border-dashed border-gray-200 rounded-3xl text-gray-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center group"
                        >
                            <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 group-hover:shadow-md transition-all">
                                <Plus className="w-8 h-8" />
                            </div>
                            <span className="font-black uppercase tracking-widest text-xs">Append New Question Item</span>
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
};

export default ExamCreator;
