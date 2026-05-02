import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    Plus, X, Loader2, Save, Sparkles, Clock, Globe, Lock, 
    Layout as LayoutIcon, CheckCircle2, AlertCircle, HelpCircle, Trash2 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import FormFieldHelp from './FormFieldHelp';
import AIAssistantPanel from './AIAssistantPanel';

const CreateExamModal = ({ show, onClose, onSubmitSuccess, classroomId, classrooms = [], editExam }) => {
    const [loading, setLoading] = useState(false);
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        duration: 60,
        accessMode: 'registered',
        isPublished: false,
        resultPublishTime: '',
        classId: classroomId || '',
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
        if (editExam) {
            // Map correctOption text back to index for internal state
            const mappedQuestions = editExam.questions.map(q => ({
                ...q,
                correctOptionIndex: q.options.indexOf(q.correctOption)
            }));

            setFormData({
                ...editExam,
                classId: editExam.classId?._id || editExam.classId || classroomId || '',
                questions: mappedQuestions,
                dueDate: editExam.dueDate ? new Date(editExam.dueDate).toISOString().slice(0, 16) : '',
                resultPublishTime: editExam.resultPublishTime ? new Date(editExam.resultPublishTime).toISOString().slice(0, 16) : ''
            });
        } else {
            setFormData(prev => ({ ...prev, classId: classroomId || '' }));
        }
    }, [editExam, classroomId, show]);

    if (!show) return null;

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
            const preparedQuestions = formData.questions.map(q => ({
                ...q,
                correctOption: q.options[q.correctOptionIndex]
            }));

            const submissionData = {
                ...formData,
                questions: preparedQuestions
            };

            if (editExam) {
                await api.put(`/exams/${editExam._id}`, submissionData);
                toast.success('Exam updated successfully');
            } else {
                await api.post('/exams', submissionData);
                toast.success('Exam created successfully');
            }
            onSubmitSuccess();
            onClose();
        } catch (error) {
            let msg = error.response?.data?.message || 'Error saving exam';
            if (msg.includes('Cast to ObjectId failed') || msg.includes('BSONError')) {
                msg = 'Invalid data provided. Please check the classroom or other selected options.';
            } else if (msg.toLowerCase().includes('validation failed')) {
                msg = 'Some required fields are missing or invalid.';
            }
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="bg-card border border-border rounded-[2.5rem] w-full max-w-4xl p-6 md:p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter text-foreground uppercase">
                                {editExam ? 'Edit' : 'Create'} <span className="text-primary not-italic">Examination</span>
                            </h2>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Configure your assessment parameters</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setShowAIPanel(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-all shadow-lg shadow-violet-500/20 dark:shadow-none active:scale-95"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span className="hidden sm:inline">AI Generate</span>
                            </button>
                            <button onClick={onClose} className="p-3 hover:bg-muted rounded-2xl transition text-muted-foreground/60">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Basic Config */}
                        <div className="grid md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-[2rem] border border-border">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center px-1">
                                    Exam Title <span className="text-rose-500 ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. Final Semester Examination"
                                    className="w-full px-5 py-3.5 bg-card border-2 border-border rounded-2xl focus:border-primary transition-all text-foreground font-bold outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center px-1">
                                    Duration (Mins) <span className="text-rose-500 ml-1">*</span>
                                </label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
                                        className="w-full pl-12 pr-4 py-3.5 bg-card border-2 border-border rounded-2xl focus:border-primary transition-all text-foreground font-black outline-none"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Provide candidates with instructions..."
                                    rows="2"
                                    className="w-full px-5 py-3.5 bg-card border-2 border-border rounded-2xl focus:border-primary transition-all text-foreground font-medium outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Class Association</label>
                                <select
                                    value={formData.classId}
                                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                    className="w-full px-5 py-3.5 bg-card border-2 border-border rounded-2xl focus:border-primary transition-all text-foreground font-bold outline-none appearance-none"
                                >
                                    <option value="">Standalone Exam</option>
                                    {classrooms.map(c => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Due Date</label>
                                <input
                                    type="datetime-local"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                    className="w-full px-5 py-3.5 bg-card border-2 border-border rounded-2xl focus:border-primary transition-all text-foreground font-bold outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Access Mode</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, accessMode: 'registered' })}
                                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${formData.accessMode === 'registered' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}
                                    >
                                        <Lock className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Auth Only</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, accessMode: 'open' })}
                                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${formData.accessMode === 'open' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}
                                    >
                                        <Globe className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Public</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Status</label>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, isPublished: !formData.isPublished })}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${formData.isPublished ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-border bg-card text-muted-foreground'}`}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest">{formData.isPublished ? 'Published' : 'Draft'}</span>
                                    <div className={`w-8 h-4 rounded-full relative transition-colors ${formData.isPublished ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}>
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${formData.isPublished ? 'translate-x-4' : ''}`} />
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Questions */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                                    <HelpCircle className="w-5 h-5 text-primary" />
                                    Questions ({formData.questions.length})
                                </h3>
                            </div>

                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {formData.questions.map((q, qIndex) => (
                                    <div key={qIndex} className="bg-card border-2 border-border rounded-3xl overflow-hidden">
                                        <div className="bg-muted/30 px-6 py-3 border-b border-border flex justify-between items-center">
                                            <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black">{qIndex + 1}</span>
                                            <button type="button" onClick={() => removeQuestion(qIndex)} className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <div className="grid md:grid-cols-4 gap-4">
                                                <div className="md:col-span-2 space-y-1">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-1">Question Statement</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={q.questionText}
                                                        onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                                                        placeholder="Type question..."
                                                        className="w-full bg-muted/50 border-none rounded-xl p-3 font-bold text-sm outline-none focus:ring-1 ring-primary"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-1">Type</label>
                                                    <select
                                                        value={q.questionType}
                                                        onChange={(e) => handleQuestionChange(qIndex, 'questionType', e.target.value)}
                                                        className="w-full bg-muted/50 border-none rounded-xl p-3 font-bold text-xs outline-none focus:ring-1 ring-primary"
                                                    >
                                                        <option value="mcq">MCQ</option>
                                                        <option value="theory">Theory</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-1">Points</label>
                                                    <input
                                                        type="number"
                                                        value={q.maxScore}
                                                        onChange={(e) => handleQuestionChange(qIndex, 'maxScore', parseInt(e.target.value) || 1)}
                                                        className="w-full bg-muted/50 border-none rounded-xl p-3 font-bold text-center text-sm outline-none focus:ring-1 ring-primary"
                                                    />
                                                </div>
                                            </div>

                                            {q.questionType === 'mcq' ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                                    {q.options.map((opt, oIndex) => (
                                                        <div key={oIndex} className={`flex items-center gap-3 p-2 rounded-xl border-2 transition-all ${q.correctOptionIndex === oIndex ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-muted'}`}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuestionChange(qIndex, 'correctOptionIndex', oIndex)}
                                                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${q.correctOptionIndex === oIndex ? 'bg-emerald-500 text-white' : 'bg-muted border border-border'}`}
                                                            >
                                                                {q.correctOptionIndex === oIndex && <CheckCircle2 className="w-3 h-3" />}
                                                            </button>
                                                            <input
                                                                type="text"
                                                                required
                                                                value={opt}
                                                                onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                                                placeholder={`Option ${oIndex + 1}`}
                                                                className="bg-transparent border-none outline-none font-bold text-xs flex-1"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-4 bg-primary/5 rounded-xl border border-dashed border-primary/20">
                                                    <p className="text-[10px] font-bold text-primary flex items-center gap-2">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        Manual grading required for theory responses.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addQuestion}
                                className="w-full py-6 border-2 border-dashed border-border rounded-3xl text-muted-foreground/50 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 group"
                            >
                                <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Append New Question</span>
                            </button>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-border sticky bottom-0 bg-card pb-2">
                            <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl border-2 border-border font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition">Cancel</button>
                            <button type="submit" disabled={loading} className="btn-premium flex-1 py-4 flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                <span>{editExam ? 'Update' : 'Launch'} Exam</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <AIAssistantPanel
                isOpen={showAIPanel}
                onClose={() => setShowAIPanel(false)}
                allowedModes={['exam']}
                defaultMode="exam"
                prefill={{
                    className: classrooms.find(c => c._id === formData.classId)?.name || '',
                    topicName: formData.title || '',
                    teacherHint: formData.description || '',
                    examType: formData.examType || 'mcq',
                    duration: formData.duration || 60,
                    questionCount: formData.questions.length || 5
                }}
                onApplyExam={(data) => {
                    setFormData(prev => ({
                        ...prev,
                        title: data.title || prev.title,
                        description: data.description || prev.description,
                        duration: data.duration || prev.duration,
                        questions: (data.questions || []).map(q => ({
                            questionText: q.questionText || '',
                            questionType: q.questionType || 'mcq',
                            options: q.options || (q.questionType === 'theory' ? [] : ['', '', '', '']),
                            correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
                            maxScore: q.maxScore || 1,
                        })),
                    }));
                    setShowAIPanel(false);
                }}
            />
        </div>
    );
};

export default CreateExamModal;
