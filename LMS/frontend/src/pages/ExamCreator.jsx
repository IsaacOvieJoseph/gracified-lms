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
import FormFieldHelp from '../components/FormFieldHelp';

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
            setClassrooms(response.data.classrooms || []);
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
            if (exam.title) {
                localStorage.setItem(`bc_${id}`, exam.title);
            }
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
        return <Layout><div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div></Layout>;
    }

    return (
        <Layout>
            <div className="max-w-4xl mx-auto pb-20">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-center justify-between bg-card p-4 md:p-6 rounded-2xl shadow-sm border border-border sticky top-0 z-10 backdrop-blur-md bg-card/90 gap-4">
                        <div className="flex items-center space-x-4">
                            <button
                                type="button"
                                onClick={() => navigate('/exams')}
                                className="p-2 hover:bg-muted rounded-full transition-colors"
                                title="Go Back"
                            >
                                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                            </button>
                            <h1 className="text-lg md:text-2xl font-black text-foreground">
                                {isEditing ? 'Edit Exam' : 'Create Exam'}
                            </h1>
                        </div>
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center bg-muted rounded-xl px-4 py-2 border border-border">
                                <span className="text-sm font-bold text-muted-foreground mr-3">Status:</span>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isPublished: !formData.isPublished })}
                                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${formData.isPublished
                                        ? 'bg-emerald-500/20 text-emerald-500 shadow-sm ring-1 ring-emerald-500/30'
                                        : 'bg-muted-foreground/20 text-muted-foreground'
                                        }`}
                                >
                                    {formData.isPublished ? 'Published' : 'Draft'}
                                </button>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {loading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-5 h-5" />}
                                <span>{isEditing ? 'Update Exam' : 'Create Exam'}</span>
                            </button>
                        </div>
                    </div>

                    {/* General Settings Section */}
                    <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
                        <div className="bg-muted/50 px-8 py-4 border-b border-border flex items-center space-x-2">
                            <LayoutIcon className="w-4 h-4 text-primary" />
                            <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Exam Configuration</h2>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center">
                                        Exam Title <span className="text-rose-500 ml-1 mr-1">*</span>
                                        <FormFieldHelp content="Provide a clear, identifying name for this examination." />
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g., Mid-Term Mathematics Assessment"
                                        className="w-full px-5 py-4 bg-muted border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-foreground font-bold placeholder:text-muted-foreground/30"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center">
                                        Duration (Minutes) <span className="text-rose-500 ml-1 mr-1">*</span>
                                        <FormFieldHelp content="The timer will start as soon as a student begins the exam." />
                                    </label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground/40 w-5 h-5" />
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                                            className="w-full pl-12 pr-4 py-4 bg-muted border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all font-black text-foreground"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Provide instructions for the candidates..."
                                    rows="3"
                                    className="w-full px-5 py-4 bg-muted border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-foreground font-medium leading-relaxed placeholder:text-muted-foreground/30"
                                />
                            </div>

                            <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center">
                                        Class Association (Optional)
                                        <FormFieldHelp content="Linking to a class helps organize results and filter access modes." />
                                    </label>
                                    <select
                                        value={formData.classId || ''}
                                        onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                        className="w-full px-5 py-4 bg-muted border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-foreground font-bold appearance-none cursor-pointer"
                                    >
                                        <option value="">Standalone Exam</option>
                                        {classrooms.map(cls => (
                                            <option key={cls._id} value={cls._id}>{cls.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-muted-foreground/60 font-medium italic">
                                        {formData.classId ? '"Registered" mode will restrict access to enrolled students only.' : 'Standalone exams in "Registered" mode are open to any LMS user.'}
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center">
                                        Due Date (Optional)
                                        <FormFieldHelp content="After this date, students will no longer be able to start the exam." />
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.dueDate ? new Date(formData.dueDate).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                        className="w-full px-5 py-4 bg-muted border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-foreground font-bold"
                                    />
                                    <p className="text-[10px] text-muted-foreground/40 font-medium">Leave empty for no deadline.</p>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col md:flex-row gap-6">
                                <div className="flex-1 space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center">
                                        Access Control
                                        <FormFieldHelp content="Authenticated: Restricted to LMS users. Public: Sharable with anyone in the world." />
                                    </label>
                                    <div className="flex space-x-4">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, accessMode: 'registered' })}
                                            className={`flex-1 flex items-center justify-center p-4 rounded-2xl border-2 transition-all ${formData.accessMode === 'registered'
                                                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                                : 'border-border bg-muted/50 text-muted-foreground/40 hover:border-border/80'
                                                }`}
                                        >
                                            <Lock className="w-5 h-5 mr-3" />
                                            <div className="text-left">
                                                <div className="text-sm font-black">Authenticated</div>
                                                <div className="text-[10px] font-bold opacity-60">LMS Users</div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, accessMode: 'open' })}
                                            className={`flex-1 flex items-center justify-center p-4 rounded-2xl border-2 transition-all ${formData.accessMode === 'open'
                                                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                                : 'border-border bg-muted/50 text-muted-foreground/40 hover:border-border/80'
                                                }`}
                                        >
                                            <Globe className="w-5 h-5 mr-3" />
                                            <div className="text-left">
                                                <div className="text-sm font-black">Public Link</div>
                                                <div className="text-[10px] font-bold opacity-60">Open to World</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center">
                                        Result Publish Time (Optional)
                                        <FormFieldHelp content="Students will only see their scores and correct answers after this specified time." />
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.resultPublishTime ? new Date(formData.resultPublishTime).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setFormData({ ...formData, resultPublishTime: e.target.value })}
                                        className="w-full px-5 py-4 bg-muted border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-foreground font-bold"
                                    />
                                    <p className="text-[10px] text-muted-foreground/40 font-medium">Leave empty to show results immediately.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Questions Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="text-xl font-black text-foreground tracking-tight flex items-center">
                                <HelpCircle className="w-6 h-6 mr-3 text-primary" />
                                Examination Questions
                            </h3>
                            <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                                {formData.questions.length} Items
                            </div>
                        </div>

                        {formData.questions.map((q, qIndex) => (
                            <div key={qIndex} className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden transform transition-all hover:shadow-md">
                                <div className="bg-muted/50 px-8 py-4 border-b border-border flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-[10px] shadow-md">
                                            {qIndex + 1}
                                        </span>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Question Item</h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeQuestion(qIndex)}
                                        className="p-2 text-rose-500/60 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-all"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-8 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                                            <div className="flex-1 space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Question Statement</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="Type your question here..."
                                                    value={q.questionText}
                                                    onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                                                    className="w-full px-0 py-2 bg-transparent border-b-2 border-border focus:border-primary transition-all font-black text-lg text-foreground placeholder:text-muted-foreground/20 outline-none"
                                                />
                                            </div>
                                            <div className="w-full md:w-32 space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center">
                                                    Score
                                                    <FormFieldHelp content="Points awarded for a fully correct answer." />
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={q.maxScore}
                                                    onChange={(e) => handleQuestionChange(qIndex, 'maxScore', parseInt(e.target.value))}
                                                    className="w-full px-4 py-2 bg-muted border-none rounded-xl focus:ring-2 focus:ring-primary font-black text-center text-foreground"
                                                />
                                            </div>
                                            <div className="w-full md:w-48 space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center">
                                                    Type
                                                    <FormFieldHelp content="MCQ items are auto-graded. Theory items require manual verification." />
                                                </label>
                                                <select
                                                    value={q.questionType}
                                                    onChange={(e) => handleQuestionChange(qIndex, 'questionType', e.target.value)}
                                                    className="w-full px-4 py-2 bg-muted border-none rounded-xl focus:ring-2 focus:ring-primary font-black text-foreground appearance-none cursor-pointer"
                                                >
                                                    <option value="mcq">Multiple Choice</option>
                                                    <option value="theory">Theory/Essay</option>
                                                </select>
                                            </div>
                                        </div>

                                        {q.questionType === 'mcq' ? (
                                            <div className="space-y-4 pt-4">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-4">Aswer Options (Select correct ones)</label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {q.options.map((opt, oIndex) => (
                                                        <div
                                                            key={oIndex}
                                                            className={`flex items-center p-3 rounded-2xl transition-all border-2 ${q.correctOptionIndex === oIndex
                                                                ? 'border-emerald-500/50 bg-emerald-500/10 shadow-sm'
                                                                : 'border-muted bg-muted/30 focus-within:bg-card focus-within:border-primary/30'
                                                                }`}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuestionChange(qIndex, 'correctOptionIndex', oIndex)}
                                                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${q.correctOptionIndex === oIndex
                                                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                                                    : 'bg-muted border-2 border-border text-transparent'
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
                                                                className="ml-4 flex-1 bg-transparent border-none outline-none font-bold text-foreground focus:ring-0 placeholder:text-muted-foreground/20"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="pt-4 p-6 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20">
                                                <p className="text-sm font-black text-primary flex items-center">
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
                            className="w-full py-8 border-2 border-dashed border-border rounded-3xl text-muted-foreground/40 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center group"
                        >
                            <div className="bg-card p-4 rounded-2xl shadow-sm mb-4 group-hover:shadow-md transition-all border border-border">
                                <Plus className="w-8 h-8" />
                            </div>
                            <span className="font-black uppercase tracking-[0.2em] text-[10px] md:text-xs text-center">Add Question</span>
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
};

export default ExamCreator;
