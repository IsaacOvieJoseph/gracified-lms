import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    ArrowLeft,
    Save,
    CheckCircle2,
    AlertCircle,
    User,
    Mail,
    Clock,
    Award,
    ChevronRight,
    FileText
} from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';

const ExamSubmissionDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [theoryGrades, setTheoryGrades] = useState({});

    useEffect(() => {
        fetchSubmission();
    }, [id]);

    const fetchSubmission = async () => {
        try {
            const response = await api.get(`/exams/submissions/detail/${id}`);
            setSubmission(response.data);

            // Initialize theory grades state
            const initialGrades = {};
            response.data.answers.forEach(ans => {
                const question = response.data.examId.questions[ans.questionIndex];
                if (question?.questionType === 'theory') {
                    initialGrades[ans.questionIndex] = ans.score;
                }
            });
            setTheoryGrades(initialGrades);
        } catch (error) {
            toast.error('Failed to fetch submission details');
            navigate('/exams');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGrades = async () => {
        setSaving(true);
        try {
            const questionGrades = Object.entries(theoryGrades).map(([index, score]) => ({
                index: parseInt(index),
                score: parseFloat(score)
            }));

            await api.patch(`/exams/submissions/detail/${id}/grade`, { questionGrades });
            toast.success('Grades updated and student notified');
            fetchSubmission();
        } catch (error) {
            toast.error('Failed to update grades');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </Layout>
        );
    }

    if (!submission) return null;

    const exam = submission.examId;
    const maxScore = exam.questions.reduce((acc, q) => acc + (q.maxScore || 1), 0);
    const percentage = Math.round((submission.totalScore / maxScore) * 100);

    return (
        <Layout>
            <div className="max-w-5xl mx-auto space-y-8 pb-20">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => navigate(`/exams/${exam._id}/submissions`)}
                            className="p-2 hover:bg-muted/60 rounded-full transition-colors font-bold"
                        >
                            <ArrowLeft className="w-6 h-6 text-muted-foreground" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-foreground leading-tight">Candidate Submission</h1>
                            <p className="text-muted-foreground font-medium">Assessing: {exam.title}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveGrades}
                        disabled={saving}
                        className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-50"
                    >
                        {saving ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Save className="w-5 h-5" />}
                        <span>Save Changes & Notify</span>
                    </button>
                </div>

                {/* Candidate Info Card */}
                <div className="bg-card rounded-[2rem] shadow-sm border border-border p-8 flex flex-col md:flex-row gap-10">
                    <div className="flex-1 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Full Name</label>
                                <div className="flex items-center text-lg font-bold text-foreground">
                                    <User className="w-5 h-5 mr-3 text-indigo-500" />
                                    {submission.studentId?.name || submission.candidateName}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Email Address</label>
                                <div className="flex items-center text-lg font-bold text-foreground">
                                    <Mail className="w-5 h-5 mr-3 text-indigo-500" />
                                    {submission.studentId?.email || submission.candidateEmail || 'No email shared'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Submission Status</label>
                                <div className="flex items-center pt-1">
                                    {submission.status === 'graded' ? (
                                        <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center">
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Graded & Published
                                        </span>
                                    ) : exam.questions.some(q => q.questionType === 'theory') ? (
                                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center">
                                            <AlertCircle className="w-3 h-3 mr-1" /> Pending Review
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center">
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Finalized
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="w-full md:w-64 bg-muted/30 rounded-3xl p-6 flex flex-col items-center justify-center text-center border border-border">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Final Performance</span>
                        <div className="text-5xl font-black text-primary mb-1">{percentage}%</div>
                        <div className="text-sm font-bold text-muted-foreground">{submission.totalScore} / {maxScore} pts</div>
                    </div>
                </div>

                {/* Question List */}
                <div className="space-y-6">
                    <h3 className="text-xl font-black text-foreground tracking-tight flex items-center">
                        <FileText className="w-6 h-6 mr-3 text-indigo-500" />
                        Response Analysis
                    </h3>

                    {submission.answers.map((ans, idx) => {
                        const question = exam.questions[ans.questionIndex];
                        if (!question) return null;

                        const isTheory = question.questionType === 'theory';
                        const isCorrect = !isTheory && ans.answer === question.correctOption;

                        return (
                            <div key={idx} className={`bg-card rounded-3xl shadow-sm border ${isTheory ? 'border-primary/20' : 'border-border'} overflow-hidden`}>
                                <div className={`${isTheory ? 'bg-primary/10' : 'bg-muted/30'} px-8 py-4 border-b border-border flex items-center justify-between`}>
                                    <div className="flex items-center space-x-3">
                                        <span className="w-8 h-8 rounded-full bg-background border border-border text-foreground flex items-center justify-center font-black text-sm shadow-sm">
                                            {idx + 1}
                                        </span>
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                            {isTheory ? 'Theory Question' : 'Multiple Choice'}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        {isTheory ? (
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="number"
                                                    max={question.maxScore}
                                                    min="0"
                                                    step="0.5"
                                                    value={theoryGrades[ans.questionIndex] || 0}
                                                    onChange={(e) => setTheoryGrades({
                                                        ...theoryGrades,
                                                        [ans.questionIndex]: e.target.value
                                                    })}
                                                    className="w-20 px-3 py-1 bg-background border border-border rounded-lg font-black text-primary focus:ring-2 focus:ring-primary/40 outline-none"
                                                />
                                                <span className="text-sm font-bold text-muted-foreground text-nowrap">/ {question.maxScore} Score</span>
                                            </div>
                                        ) : (
                                            <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isCorrect ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'}`}>
                                                {isCorrect ? `Correct (+${ans.score})` : 'Incorrect (0)'}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-8 space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Question Statement</label>
                                        <p className="text-lg font-bold text-foreground leading-snug">{question.questionText}</p>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Candidate Answer</label>
                                        {isTheory ? (
                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border italic font-medium text-foreground leading-relaxed">
                                                {ans.answer || 'No answer provided'}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4">
                                                <div className={`px-6 py-3 rounded-xl font-bold flex items-center ${isCorrect ? 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20' : 'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/20'}`}>
                                                    {ans.answer || 'No Choice Selected'}
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-muted-foreground/40" />
                                                <div className="px-6 py-3 bg-primary/10 text-primary rounded-xl font-bold flex items-center ring-1 ring-primary/20">
                                                    Correct: {question.correctOption}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Layout>
    );
};

export default ExamSubmissionDetail;
