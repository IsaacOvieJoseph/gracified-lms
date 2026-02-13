import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    Timer,
    Send,
    ChevronRight,
    ChevronLeft,
    AlertCircle,
    CheckCircle2,
    GraduationCap,
    Layout,
    Clock,
    User,
    Mail,
    Play,
    LogOut
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import ConfirmationModal from '../components/ConfirmationModal';

const ExamCenter = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [started, setStarted] = useState(false);
    const [submissionId, setSubmissionId] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [finished, setFinished] = useState(false);
    const [score, setScore] = useState(null);
    const [candidateInfo, setCandidateInfo] = useState({ name: '', email: '' });
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    const [submissionStatus, setSubmissionStatus] = useState(null);
    const [showAccessModal, setShowAccessModal] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [accessError, setAccessError] = useState('');
    const timerRef = useRef(null);
    const submissionIdRef = useRef(null);

    // Sync submissionId to ref
    useEffect(() => {
        submissionIdRef.current = submissionId;
    }, [submissionId]);

    useEffect(() => {
        fetchExamInfo();
        return () => clearInterval(timerRef.current);
    }, [token]);

    const fetchExamInfo = async () => {
        try {
            const response = await api.get(`/exams/public/${token}`);
            setExam(response.data);
            setTimeLeft(response.data.duration * 60);
        } catch (error) {
            if (error.response?.status === 410) {
                setExam({ error: 'expired', title: 'Assessment Unavailable' });
            } else {
                toast.error(error.response?.data?.message || 'Failed to fetch exam');
                navigate('/dashboard');
            }
        } finally {
            setLoading(false);
        }
    };

    const startExam = async () => {
        if (exam.accessMode === 'open' && !candidateInfo.name) {
            toast.error('Please enter your name to start');
            return;
        }

        try {
            setLoading(true);
            const payload = exam.accessMode === 'open' ? {
                candidateName: candidateInfo.name,
                candidateEmail: candidateInfo.email
            } : {};

            const response = await api.post(`/exams/public/${token}/start`, payload);
            setSubmissionId(response.data.submissionId);
            setQuestions(response.data.questions);
            setStarted(true);

            // Start Timer
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        submitExam(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

        } catch (error) {
            const message = error.response?.data?.message || 'Failed to start exam';
            if (error.response?.status === 403) {
                setAccessError(message);
                setShowAccessModal(true);
            } else {
                toast.error(message);
            }
        } finally {
            setLoading(false);
        }
    };

    const submitExam = async (isAuto = false) => {
        if (!isAuto && !showSubmitModal) {
            setShowSubmitModal(true);
            return;
        }

        setShowSubmitModal(false);
        setLoading(true);
        clearInterval(timerRef.current);

        try {
            const response = await api.post(`/exams/submissions/${submissionIdRef.current}/submit`, { answers });
            setScore(response.data.score);
            setSubmissionStatus(response.data.status);
            setFinished(true);
            if (isAuto) toast.error('Time expired! Your exam has been auto-submitted.');
            else toast.success('Exam submitted successfully!');
        } catch (error) {
            toast.error('Failed to submit exam. Please contact support.');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    };

    if (loading && !started && !finished) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Authenticating Exam Center...</p>
                </div>
            </div>
        );
    }

    // --- Start Screen ---
    if (!started && !finished) {
        if (exam?.error === 'expired') {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-12 text-center border border-rose-100">
                        <div className="bg-rose-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 text-rose-600 shadow-lg shadow-rose-100">
                            <AlertCircle className="w-12 h-12" />
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 mb-4">Exam Expired</h2>
                        <p className="text-gray-500 font-medium mb-8">This assessment is no longer available as the due date has passed. Please contact your instructor for help.</p>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-[#E5E7EB] relative overflow-hidden flex items-center justify-center p-4 md:p-6 font-sans">
                {/* Mesh Gradient Background Elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[60%] md:w-[40%] h-[40%] bg-indigo-200/50 rounded-full blur-[80px] md:blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] md:w-[40%] h-[40%] bg-blue-200/50 rounded-full blur-[80px] md:blur-[120px]"></div>

                <div className="max-w-2xl w-full bg-white rounded-[2rem] md:rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden transform transition-all relative z-10 border border-white/20">
                    {/* Card Header */}
                    <div className="bg-[#41414E] px-6 py-8 md:px-12 md:py-12 text-white relative">
                        <div className="relative z-10">
                            <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left space-y-4 md:space-y-0 md:space-x-6">
                                <div className="bg-white/10 backdrop-blur-md w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-3xl flex items-center justify-center p-3 md:p-4 shadow-xl border border-white/20">
                                    {exam?.logoUrl ? (
                                        <img src={exam.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                    ) : (
                                        <GraduationCap className="w-10 h-10 md:w-12 md:h-12 text-white" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    {exam?.classroomName && (
                                        <div className="text-gray-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] mb-1 md:mb-2">
                                            {exam.classroomName}
                                        </div>
                                    )}
                                    <h1 className="text-3xl md:text-5xl font-black mb-1 leading-tight tracking-tight">{exam?.title}</h1>
                                    <p className="text-gray-400 text-xs md:text-sm font-medium mt-1 md:mt-2 line-clamp-2 md:line-clamp-none">{exam?.description}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-6 md:p-12 space-y-6 md:space-y-10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                            <div className="bg-[#F9FAFB] p-6 md:p-8 rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-center">
                                <div className="flex items-center text-[#5E5E6E] mb-2 md:mb-3">
                                    <Clock className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3" />
                                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Duration</span>
                                </div>
                                <div className="text-2xl md:text-3xl font-black text-[#1F1F2F]">{exam?.duration} Mins</div>
                            </div>
                            <div className="bg-[#F9FAFB] p-6 md:p-8 rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-center">
                                <div className="flex items-center text-[#5E5E6E] mb-2 md:mb-3">
                                    <Layout className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3" />
                                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Format</span>
                                </div>
                                <div className="text-2xl md:text-3xl font-black text-[#1F1F2F]">Standard</div>
                            </div>
                        </div>

                        {exam?.accessMode === 'open' ? (
                            <div className="space-y-3 md:space-y-4">
                                <div className="relative">
                                    <User className="absolute left-4 md:left-5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                                    <input
                                        type="text"
                                        placeholder="Full Name"
                                        value={candidateInfo.name}
                                        onChange={(e) => setCandidateInfo({ ...candidateInfo, name: e.target.value })}
                                        className="w-full pl-12 md:pl-14 pr-6 py-4 md:py-5 bg-[#F3F4F6] border-none rounded-xl md:rounded-2xl focus:ring-2 focus:ring-[#41414E] transition-all outline-none font-bold text-sm md:text-base text-gray-900"
                                    />
                                </div>
                                <div className="relative">
                                    <Mail className="absolute left-4 md:left-5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                                    <input
                                        type="email"
                                        placeholder="Email (Optional)"
                                        value={candidateInfo.email}
                                        onChange={(e) => setCandidateInfo({ ...candidateInfo, email: e.target.value })}
                                        className="w-full pl-12 md:pl-14 pr-6 py-4 md:py-5 bg-[#F3F4F6] border-none rounded-xl md:rounded-2xl focus:ring-2 focus:ring-[#41414E] transition-all outline-none font-bold text-sm md:text-base text-gray-900"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className={`rounded-2xl md:rounded-3xl p-6 md:p-8 border-l-[8px] md:border-l-[12px] flex items-start ${user && !exam?.isEnrolled && exam?.accessMode === 'registered' ? 'bg-rose-50 border-rose-400' : 'bg-[#FFF9E5] border-[#FFD54F]'}`}>
                                <AlertCircle className={`w-6 h-6 md:w-8 md:h-8 mr-4 md:mr-6 flex-shrink-0 ${user && !exam?.isEnrolled && exam?.accessMode === 'registered' ? 'text-rose-500' : 'text-[#FFA000]'}`} />
                                <div className="flex-1">
                                    <h4 className={`font-black text-lg md:text-xl ${user && !exam?.isEnrolled && exam?.accessMode === 'registered' ? 'text-rose-900' : 'text-[#7A5A00]'}`}>
                                        {user && !exam?.isEnrolled && exam?.accessMode === 'registered' ? 'Access Restricted' : 'Secure Only'}
                                    </h4>
                                    <p className={`text-xs md:text-sm mt-1 md:mt-2 font-bold leading-relaxed ${user && !exam?.isEnrolled && exam?.accessMode === 'registered' ? 'text-rose-700' : 'text-[#927100]'}`}>
                                        {user ? (
                                            exam?.isEnrolled ? (
                                                <>Ready to start, <strong className="text-[#1F1F2F]">{user.name}</strong>.</>
                                            ) : (
                                                <>Not enrolled in this classroom.</>
                                            )
                                        ) : (
                                            <>Sign in required to proceed.</>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}

                        {exam?.accessMode === 'registered' && !user ? (
                            <button
                                onClick={() => navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)}
                                className="w-full py-5 md:py-6 bg-[#1F1F2F] text-white rounded-xl md:rounded-[2rem] font-black md:text-xl hover:bg-black transition-all shadow-2xl flex items-center justify-center space-x-3 md:space-x-4 shadow-gray-300"
                            >
                                <LogOut className="w-5 h-5 md:w-6 md:h-6 rotate-180" />
                                <span>Sign In to Start</span>
                            </button>
                        ) : (
                            <button
                                onClick={startExam}
                                disabled={exam?.accessMode === 'registered' && user && !exam?.isEnrolled}
                                className={`w-full py-5 md:py-6 text-white rounded-xl md:rounded-[2.5rem] font-black text-xl md:text-2xl transition-all shadow-2xl flex items-center justify-center space-x-3 md:space-x-4 ${exam?.accessMode === 'registered' && user && !exam?.isEnrolled
                                    ? 'bg-gray-300 cursor-not-allowed shadow-none'
                                    : 'bg-[#4F4F5B] hover:bg-[#3D3D47] shadow-[#4F4F5B]/20 transform hover:-translate-y-1'
                                    }`}
                            >
                                <span>Start Exam</span>
                                {!(exam?.accessMode === 'registered' && user && !exam?.isEnrolled) && <Play className="w-6 h-6 md:w-8 md:h-8 fill-current" />}
                            </button>
                        )}
                    </div>

                    <div className="bg-[#F9FAFB] px-6 py-6 md:px-12 md:py-8 border-t border-gray-100 flex flex-col items-center justify-center space-y-2 md:space-y-3 opacity-60 hover:opacity-100 transition-all cursor-default text-center">
                        <div className="flex items-center space-x-2">
                            <img src="/logo.jpg" alt="Gracified" className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-sm object-cover" />
                            <span className="text-[9px] md:text-[10px] font-black text-gray-700 tracking-tighter uppercase">Powered by Gracified LMS</span>
                        </div>
                        <div className="text-[8px] md:text-[10px] font-bold text-gray-400">
                            &copy; {new Date().getFullYear()} Gracified LMS. All rights reserved.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- Final/Result Screen ---
    if (finished) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-12 text-center">
                    <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 text-green-600 shadow-lg shadow-green-100">
                        <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h2 className="text-4xl font-black text-gray-900 mb-2">Well Done!</h2>
                    <p className="text-gray-500 font-medium mb-10">Your assessment has been successfully submitted and stored in our secure database.</p>

                    <div className="bg-indigo-50 rounded-[2rem] p-8 mb-10 border-2 border-indigo-100">
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest block mb-2">Final Performance</span>
                        {((!exam?.resultPublishTime || new Date(exam.resultPublishTime) <= new Date()) &&
                            (!questions.some(q => q.questionType === 'theory') || submissionStatus === 'graded')) ? (
                            <>
                                <div className="text-6xl font-black text-indigo-600">
                                    {Math.round((score / questions.reduce((acc, q) => acc + (q.maxScore || 1), 0)) * 100)}%
                                </div>
                                <p className="text-sm font-bold text-indigo-400 mt-4 uppercase tracking-tighter">
                                    {score} Points Earned
                                </p>
                            </>
                        ) : (
                            <div className="py-6">
                                <div className="text-2xl font-black text-indigo-600 mb-2">Review Pending</div>
                                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest leading-relaxed">
                                    {questions.some(q => q.questionType === 'theory') && submissionStatus !== 'graded'
                                        ? "Detailed results will be released after manual grading."
                                        : `Results will be published on ${new Date(exam.resultPublishTime).toLocaleString()}`}
                                </p>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center space-x-2"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Exit Center</span>
                    </button>
                </div>
            </div>
        );
    }

    // --- Active Exam View ---
    const currentQuestion = questions[currentQuestionIndex];

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
            {/* Dynamic Header */}
            <header className="bg-white px-4 md:px-8 py-4 md:py-6 shadow-sm border-b border-gray-100 sticky top-0 z-50 flex items-center justify-between">
                <div className="flex items-center space-x-4 md:space-x-10">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-600 text-white p-2 rounded-lg md:rounded-xl">
                            <GraduationCap className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div className="hidden sm:block">
                            <h2 className="text-xs md:text-base font-black text-gray-900 leading-none truncate max-w-[120px] md:max-w-none">{exam?.title}</h2>
                            <p className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Interactive</p>
                        </div>
                    </div>

                    <div className="h-8 md:h-10 w-px bg-gray-100 hidden sm:block"></div>

                    <div className="flex items-center space-x-3 md:space-x-6">
                        <div className="flex flex-col">
                            <span className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Time</span>
                            <div className={`text-base md:text-xl font-black font-mono transition-colors ${timeLeft < 120 ? 'text-rose-500 animate-pulse' : 'text-gray-900'}`}>
                                {formatTime(timeLeft)}
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => submitExam()}
                    className="flex items-center space-x-1.5 md:space-x-3 px-4 md:px-6 py-2 md:py-2.5 bg-rose-500 text-white rounded-lg md:rounded-xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 text-sm md:text-base"
                >
                    <span className="hidden xs:inline">Submit</span>
                    <span className="xs:hidden">End</span>
                    <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
            </header>

            {/* Main Area */}
            <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-10 flex flex-col">
                {/* Progress Bar */}
                <div className="w-full bg-white rounded-full h-3 mb-10 p-0.5 border border-gray-100 shadow-sm overflow-hidden">
                    <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    ></div>
                </div>

                {/* Question Card Area */}
                <div className="flex-1 flex flex-col lg:flex-row gap-6 md:gap-10">
                    {/* Navigation Sidebar / Question Map */}
                    <div className="w-full lg:w-64 space-y-4">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 lg:mb-6 px-2 lg:px-4">Question Map</h3>
                        <div className="grid grid-cols-5 xs:grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-4 gap-2 md:gap-3 p-3 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
                            {questions.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentQuestionIndex(idx)}
                                    className={`aspect-square rounded-lg md:rounded-2xl flex items-center justify-center text-xs md:text-sm font-black transition-all ${idx === currentQuestionIndex
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110'
                                        : answers[idx] !== undefined
                                            ? 'bg-emerald-50 text-emerald-600'
                                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                        }`}
                                >
                                    {idx + 1}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 space-y-6 md:space-y-8">
                        <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-xl shadow-gray-100 p-6 md:p-12 border border-gray-50 relative overflow-hidden min-h-[400px] md:min-h-[500px] flex flex-col">
                            <div className="relative z-10 flex-1">
                                <div className="flex items-center justify-between mb-10">
                                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-4 py-1.5 rounded-full">Question {currentQuestionIndex + 1} of {questions.length}</span>
                                    <span className="text-xs font-bold text-gray-400 bg-gray-50 px-4 py-1.5 rounded-full uppercase tracking-widest">
                                        {currentQuestion?.questionType === 'theory' ? 'Theory / Essay' : 'Multiple Choice'}
                                    </span>
                                </div>

                                <h3 className="text-3xl font-black text-gray-900 mb-12 leading-snug">
                                    {currentQuestion?.questionText}
                                </h3>

                                {currentQuestion?.questionType === 'mcq' ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        {currentQuestion?.options.map((opt, oIdx) => (
                                            <button
                                                key={oIdx}
                                                onClick={() => setAnswers({ ...answers, [currentQuestionIndex]: opt })}
                                                className={`group p-6 rounded-[1.5rem] border-2 text-left transition-all flex items-center ${answers[currentQuestionIndex] === opt
                                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-md'
                                                    : 'border-gray-50 bg-gray-50/30 hover:bg-white hover:border-indigo-100 hover:shadow-lg'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm mr-6 transition-all ${answers[currentQuestionIndex] === opt
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-white border-2 border-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 group-hover:border-indigo-600'
                                                    }`}>
                                                    {String.fromCharCode(65 + oIdx)}
                                                </div>
                                                <span className={`text-lg font-bold transition-colors ${answers[currentQuestionIndex] === opt ? 'text-indigo-900' : 'text-gray-700'
                                                    }`}>{opt}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Your Answer (Auto-saved)</label>
                                        <textarea
                                            rows="8"
                                            placeholder="Type your essay/answer here..."
                                            value={answers[currentQuestionIndex] || ''}
                                            onChange={(e) => setAnswers({ ...answers, [currentQuestionIndex]: e.target.value })}
                                            className="w-full p-8 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-[2rem] transition-all outline-none font-medium text-gray-800 shadow-inner"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full -mr-48 -mt-48 blur-3xl pointer-events-none opacity-50"></div>
                        </div>

                        {/* Navigation Controls */}
                        <div className="flex items-center justify-between gap-3 md:gap-4">
                            <button
                                disabled={currentQuestionIndex === 0}
                                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                                className="flex items-center space-x-2 md:space-x-3 px-5 md:px-8 py-3 md:py-4 bg-white border border-gray-100 rounded-xl md:rounded-2xl font-black text-gray-900 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm disabled:opacity-0 active:scale-95"
                            >
                                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                                <span className="text-sm md:text-base">Prev</span>
                            </button>

                            <div className="lg:hidden text-sm md:text-lg font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full">
                                {currentQuestionIndex + 1} / {questions.length}
                            </div>

                            {currentQuestionIndex === questions.length - 1 ? (
                                <button
                                    onClick={() => submitExam()}
                                    className="flex items-center space-x-2 md:space-x-3 px-6 md:px-10 py-3 md:py-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl font-black text-base md:text-lg hover:shadow-2xl hover:shadow-indigo-200 transition-all active:scale-95"
                                >
                                    <span className="text-sm md:text-base">Submit</span>
                                    <Send className="w-4 h-4 md:w-5 md:h-5" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                                    className="flex items-center space-x-2 md:space-x-3 px-6 md:px-10 py-3 md:py-4 bg-gray-900 text-white rounded-xl md:rounded-2xl font-black text-base md:text-lg hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-95"
                                >
                                    <span className="text-sm md:text-base">Next</span>
                                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Access Denied Modal */}
            {showAccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-10 text-center border border-gray-100 animate-in slide-in-from-bottom-8 duration-500">
                        <div className="bg-rose-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-600 shadow-inner">
                            <AlertCircle className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">Access Restricted</h3>
                        <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                            {accessError || "You don't have permission to access this assessment. Please check your enrollment status or contact your instructor."}
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center space-x-2"
                            >
                                <LogOut className="w-4 h-4 rotate-180" />
                                <span>Go to Dashboard</span>
                            </button>
                            <button
                                onClick={() => setShowAccessModal(false)}
                                className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Submit Confirmation Modal */}
            <ConfirmationModal
                show={showSubmitModal}
                onClose={() => setShowSubmitModal(false)}
                onConfirm={() => submitExam(false)}
                title="Submit Examination"
                message="Are you sure you want to finalize and submit your assessment? Once submitted, you will not be able to change your answers."
                confirmText="Submit Now"
                confirmButtonColor="bg-indigo-600 hover:bg-indigo-700"
                isLoading={loading}
                icon={Send}
                iconBg="bg-indigo-100"
                iconColor="text-indigo-600"
            />
        </div>
    );
};

export default ExamCenter;
