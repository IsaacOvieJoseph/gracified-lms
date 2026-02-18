import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    Timer,
    Send,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    CheckCircle2,
    Layout,
    Clock,
    User,
    Mail,
    Play,
    LogOut,
    CheckCircle,
    XCircle,
    HelpCircle,
    ShieldCheck,
    Zap,
    Monitor,
    Info,
    ListChecks,
    Wifi
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import ConfirmationModal from '../components/ConfirmationModal';
import gracifiedLogo from '../assets/logo.jpg';

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
    const [onPrepStep, setOnPrepStep] = useState(1);

    const [submissionStatus, setSubmissionStatus] = useState(null);
    const [showAccessModal, setShowAccessModal] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [mobileMapExpanded, setMobileMapExpanded] = useState(false);
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
            const data = response.data;
            setExam(data);
            setTimeLeft(data.duration * 60);

            if (data.resultData) {
                setScore(data.resultData.score);
                setSubmissionStatus(data.resultData.status);
                setSubmissionId(data.existingSubmissionId);
                setQuestions(data.questions);
                setFinished(true);
            }
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
            <div className="min-h-screen bg-[#0F172A] relative overflow-hidden flex items-stretch md:items-center md:justify-center p-0 md:p-8 font-sans">
                {/* Dynamic Mesh Background - Pure Indigo/Blue */}
                <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-[20%] right-[-5%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

                <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden md:rounded-[2.5rem] md:shadow-[0_0_80px_rgba(0,0,0,0.4)] relative z-10 md:border border-white/10 glass-dark">

                    {/* Left Sidebar: Briefing & Prep */}
                    <div className={`lg:col-span-5 bg-white/5 p-6 md:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10 min-h-screen md:min-h-0 ${onPrepStep === 1 ? 'flex' : 'hidden lg:flex'}`}>
                        <div>
                            {/* School/Tutorial branding - top left */}
                            {exam?.logoUrl && (
                                <div className="flex items-center gap-2 md:gap-3 mb-6 md:mb-8">
                                    <img src={exam.logoUrl} alt="" className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-contain flex-shrink-0 border border-white/10" onError={(e) => { e.target.style.display = 'none'; }} />
                                    <div>
                                        <span className="text-sm md:text-base font-black text-white uppercase tracking-wide block leading-tight">{exam?.classroomName || 'Assessment'}</span>
                                        <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Powered by Gracified</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center space-x-3 mb-6 md:mb-8">
                                <div className="p-1.5 md:p-2 bg-indigo-500/20 rounded-lg md:rounded-xl border border-indigo-500/30">
                                    <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                                </div>
                                <span className="text-[8px] md:text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] md:tracking-[0.3em]">Authorized Entry Only</span>
                            </div>

                            <h2 className="text-xl md:text-2xl font-black text-white mb-6 md:mb-8 flex items-center">
                                <ListChecks className="w-5 h-5 md:w-6 md:h-6 mr-2 md:mr-3 text-indigo-400" />
                                Preparation
                            </h2>

                            <div className="space-y-4 md:space-y-6">
                                <div className="flex items-start space-x-3 md:space-x-4 group">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-all border border-white/5">
                                        <Wifi className="w-4 h-4 md:w-5 md:h-5 text-gray-400 group-hover:text-indigo-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs md:text-sm font-bold text-white mb-1">Stable Connection</h4>
                                        <p className="text-[10px] md:text-xs text-gray-400 leading-relaxed">Ensure you have a reliable internet source before starting the session.</p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 md:space-x-4 group">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-all border border-white/5">
                                        <Clock className="w-4 h-4 md:w-5 md:h-5 text-gray-400 group-hover:text-indigo-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs md:text-sm font-bold text-white mb-1">Duration Check</h4>
                                        <p className="text-[10px] md:text-xs text-gray-400 leading-relaxed">The timer starts immediately. It will auto-submit when the window closes.</p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 md:space-x-4 group">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-all border border-white/5">
                                        <Monitor className="w-4 h-4 md:w-5 md:h-5 text-gray-400 group-hover:text-indigo-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs md:text-sm font-bold text-white mb-1">Device Ready</h4>
                                        <p className="text-[10px] md:text-xs text-gray-400 leading-relaxed">Stay on this tab. Frequent tab switching may be flagged as suspicious activity.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Proceed Button */}
                            <div className="lg:hidden mt-8">
                                <button
                                    onClick={() => setOnPrepStep(2)}
                                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3 active:scale-95"
                                >
                                    <span>Proceed to Portal</span>
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 lg:mt-8 md:mt-12 pt-4 lg:pt-6 md:pt-8 border-t border-white/10 flex items-center space-x-3 grayscale opacity-30 flex-shrink-0">
                            <img src={gracifiedLogo} alt="Gracified" className="w-5 h-5 md:w-6 md:h-6 rounded-md object-cover flex-shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-[8px] md:text-[9px] font-black text-white tracking-widest uppercase leading-none mb-1">Gracified LMS</span>
                                <span className="text-[7px] md:text-[8px] font-bold text-gray-500 leading-none">Security Deployment</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Content: Main Entry */}
                    <div className={`lg:col-span-7 bg-white p-6 md:p-12 flex flex-col justify-center relative min-h-screen md:min-h-0 ${onPrepStep === 2 ? 'flex' : 'hidden lg:flex'}`}>
                        {/* Mobile Back Button */}
                        <button
                            onClick={() => setOnPrepStep(1)}
                            className="lg:hidden absolute top-6 left-6 p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="mb-6 md:mb-10">
                            <div className="flex items-center justify-between mb-2 md:mb-4">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <img src={exam?.logoUrl || gracifiedLogo} alt="Institution" className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-contain flex-shrink-0 border border-gray-100" onError={(e) => { e.target.src = gracifiedLogo; }} />
                                    <div className="px-2 py-0.5 md:px-3 md:py-1 bg-indigo-50 text-indigo-600 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest leading-none">
                                        {exam?.classroomName || 'Portal'}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-1 text-gray-300">
                                    <Zap className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-wider">Live</span>
                                </div>
                            </div>
                            <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-3 md:mb-4 tracking-tight leading-tight">
                                {exam?.title}
                            </h1>
                            <p className="text-xs md:text-sm text-gray-500 font-medium leading-relaxed italic border-l-4 border-indigo-100 pl-3 md:pl-4 py-0.5">
                                {exam?.description}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-10">
                            <div className="p-4 md:p-5 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100">
                                <div className="flex items-center text-gray-400 mb-1 md:mb-2">
                                    <Timer className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Limit</span>
                                </div>
                                <div className="text-lg md:text-2xl font-black text-gray-900 uppercase leading-none">
                                    {exam?.duration} <span className="text-[10px] md:text-sm font-bold text-gray-400">MINS</span>
                                </div>
                            </div>
                            <div className="p-4 md:p-5 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100">
                                <div className="flex items-center text-gray-400 mb-1 md:mb-2">
                                    <ShieldCheck className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Protocol</span>
                                </div>
                                <div className="text-lg md:text-2xl font-black text-gray-900 uppercase leading-none">SECURE</div>
                            </div>
                        </div>

                        {exam?.accessMode === 'open' ? (
                            <div className="space-y-3 md:space-y-4 mb-6 md:mb-8">
                                <div className="relative group">
                                    <User className="absolute left-4 md:left-5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Full Name"
                                        value={candidateInfo.name}
                                        onChange={(e) => setCandidateInfo({ ...candidateInfo, name: e.target.value })}
                                        className="w-full pl-12 md:pl-14 pr-6 py-4 md:py-5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl md:rounded-2xl transition-all outline-none font-bold text-sm md:text-base text-gray-900"
                                    />
                                </div>
                                <div className="relative group">
                                    <Mail className="absolute left-4 md:left-5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5 group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        type="email"
                                        placeholder="Email Address (Optional)"
                                        value={candidateInfo.email}
                                        onChange={(e) => setCandidateInfo({ ...candidateInfo, email: e.target.value })}
                                        className="w-full pl-12 md:pl-14 pr-6 py-4 md:py-5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl md:rounded-2xl transition-all outline-none font-bold text-sm md:text-base text-gray-900"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 mb-6 md:mb-8 border-2 flex items-start ${user && !exam?.isEnrolled && exam?.accessMode === 'registered' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                                <AlertCircle className="w-5 h-5 md:w-6 md:h-6 mr-3 md:mr-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-black text-[10px] md:text-xs uppercase tracking-wider mb-0.5 md:mb-1">
                                        {user && !exam?.isEnrolled && exam?.accessMode === 'registered' ? 'Unauthorized' : 'Verified Entry'}
                                    </h4>
                                    <p className="text-[10px] md:text-xs font-bold leading-tight opacity-90">
                                        {user ? (
                                            exam?.isEnrolled ? (
                                                <>Logged in as <strong className="text-gray-900 underline decoration-indigo-300">{user.name}</strong>.</>
                                            ) : (
                                                <>Enrollment check failed for this classroom roster.</>
                                            )
                                        ) : (
                                            <>Authentication required to proceed.</>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}

                        {exam?.accessMode === 'registered' && !user ? (
                            <button
                                onClick={() => navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)}
                                className="w-full py-4 md:py-6 bg-gray-900 text-white rounded-xl md:rounded-[2rem] font-black md:text-xl hover:bg-black transition-all shadow-xl flex items-center justify-center space-x-3 md:space-x-4"
                            >
                                <LogOut className="w-5 h-5 md:w-6 md:h-6 rotate-180" />
                                <span>Sign In</span>
                            </button>
                        ) : (
                            <button
                                onClick={startExam}
                                disabled={exam?.accessMode === 'registered' && user && !exam?.isEnrolled}
                                className={`w-full py-4 md:py-6 text-white rounded-xl md:rounded-[2rem] font-black text-lg md:text-2xl transition-all shadow-xl flex items-center justify-center space-x-2 md:space-x-4 ${exam?.accessMode === 'registered' && user && !exam?.isEnrolled
                                    ? 'bg-gray-200 cursor-not-allowed shadow-none text-gray-400'
                                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 transform active:scale-[0.98]'
                                    }`}
                            >
                                <span>{exam?.submissionStatus === 'in-progress' ? 'Resume' : 'Begin'}</span>
                                {!(exam?.accessMode === 'registered' && user && !exam?.isEnrolled) && <Play className="w-5 h-5 md:w-8 md:h-8 fill-current" />}
                            </button>
                        )}

                        <p className="text-center text-[8px] md:text-[10px] font-bold text-gray-400 mt-4 md:mt-6 uppercase tracking-[0.2em] md:tracking-[0.3em]">
                            Session Encrypted & Secure
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // --- Final/Result Screen ---
    if (finished) {
        const totalPossible = questions.reduce((acc, q) => acc + (q.maxScore || 1), 0);
        const resultsHidden = (exam?.resultPublishTime && new Date(exam.resultPublishTime) > new Date()) ||
            (questions.some(q => q.questionType === 'theory') && submissionStatus !== 'graded');

        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
                <div className="max-w-3xl w-full bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl p-6 md:p-12 text-center my-10">
                    <img src={exam?.logoUrl || gracifiedLogo} alt="Institution" className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-contain mx-auto mb-4 border border-gray-100" onError={(e) => { e.target.src = gracifiedLogo; }} />
                    <div className="bg-green-100 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 text-green-600 shadow-lg shadow-green-100">
                        <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
                        {resultsHidden ? 'Submission Received' : 'Well Done!'}
                    </h2>
                    <p className="text-gray-500 font-medium mb-8 md:mb-10 text-sm md:text-base">
                        Your assessment has been successfully processed and stored in our secure database.
                    </p>

                    <div className="bg-indigo-50 rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 mb-8 md:mb-10 border-2 border-indigo-100">
                        <span className="text-[10px] md:text-xs font-black text-indigo-400 uppercase tracking-widest block mb-2 text-nowrap">Performance Summary</span>
                        {!resultsHidden ? (
                            <>
                                <div className="text-5xl md:text-6xl font-black text-indigo-600">
                                    {totalPossible > 0 ? Math.round((score / totalPossible) * 100) : 0}%
                                </div>
                                <p className="text-xs md:text-sm font-bold text-indigo-400 mt-4 uppercase tracking-tighter">
                                    {score} / {totalPossible} Points Earned
                                </p>
                            </>
                        ) : (
                            <div className="py-4 md:py-6">
                                <div className="text-xl md:text-2xl font-black text-indigo-600 mb-2 uppercase">Result Restricted</div>
                                <p className="text-[10px] md:text-xs font-bold text-indigo-400 uppercase tracking-widest leading-relaxed">
                                    {questions.some(q => q.questionType === 'theory') && submissionStatus !== 'graded'
                                        ? "Manual grading in progress. Please check back later."
                                        : `Results will be released on ${new Date(exam.resultPublishTime).toLocaleString()}`}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Breakdown Section */}
                    {!resultsHidden && exam?.resultData?.answers && (
                        <div className="mt-12 text-left space-y-8">
                            <h3 className="text-2xl font-black text-gray-900 border-b-2 border-gray-100 pb-4">Detailed Breakdown</h3>
                            <div className="space-y-6">
                                {questions.map((q, idx) => {
                                    const studentAns = exam.resultData.answers.find(a => a.questionIndex === idx);
                                    const isCorrect = q.questionType === 'mcq' && studentAns?.answer === q.correctOption;

                                    return (
                                        <div key={idx} className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 transition-all hover:bg-white hover:shadow-md">
                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                <div className="flex-1">
                                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-1">Question {idx + 1}</span>
                                                    <h4 className="font-bold text-gray-900 text-lg leading-snug">{q.questionText}</h4>
                                                </div>
                                                <div className={`flex-shrink-0 px-3 py-1 rounded-full flex items-center space-x-2 ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {isCorrect ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                    <span className="text-xs font-black uppercase text-nowrap">{studentAns?.score} / {q.maxScore || 1} Pts</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="p-4 rounded-xl bg-white border border-gray-100">
                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider block mb-1">Your Response</span>
                                                    <p className="font-bold text-gray-800 text-sm">{studentAns?.answer || 'No response provided'}</p>
                                                </div>
                                                {q.questionType === 'mcq' && (
                                                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                                                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-wider block mb-1">Correct Answer</span>
                                                        <p className="font-bold text-emerald-700 text-sm">{q.correctOption}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="mt-10 w-full py-4 md:py-5 bg-gray-900 text-white rounded-2xl font-black text-base md:text-lg hover:bg-black transition-all flex items-center justify-center space-x-2 shadow-xl shadow-gray-200"
                    >
                        <LogOut className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
                        <span>Return to Dashboard</span>
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
            <header className="bg-white px-4 md:px-8 py-2 md:py-3 shadow-sm border-b border-gray-100 sticky top-0 z-50 flex items-center justify-between">
                <div className="flex items-center space-x-4 md:space-x-8">
                    <div className="flex items-center space-x-2 md:space-x-3">
                        <img src={exam?.logoUrl || gracifiedLogo} alt="Institution" className="w-9 h-9 md:w-10 md:h-10 rounded-lg object-contain flex-shrink-0 border border-gray-100" onError={(e) => { e.target.src = gracifiedLogo; }} />
                        <div className="hidden sm:block">
                            <h2 className="text-sm md:text-base font-black text-gray-900 leading-none truncate max-w-[150px] md:max-w-xs">{exam?.title}</h2>
                        </div>
                    </div>

                    <div className="h-6 md:h-8 w-px bg-gray-100 hidden sm:block"></div>

                    <div className="flex items-center">
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Time Remaining</span>
                            <div className={`text-sm md:text-lg font-black font-mono leading-none transition-colors ${timeLeft < 120 ? 'text-rose-500 animate-pulse' : 'text-gray-900'}`}>
                                {formatTime(timeLeft)}
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => submitExam()}
                    className="flex items-center space-x-1.5 md:space-x-2 px-4 md:px-5 py-1.5 md:py-2 bg-rose-500 text-white rounded-lg md:rounded-xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 text-xs md:text-sm"
                >
                    <span className="hidden xs:inline uppercase tracking-widest">End Exam</span>
                    <span className="xs:hidden">End</span>
                    <Send className="w-3 h-3 md:w-4 md:h-4" />
                </button>
            </header>

            {/* Main Area */}
            <main className="flex-1 max-w-6xl w-full mx-auto p-3 md:p-6 flex flex-col">
                {/* Progress Bar */}
                <div className="w-full bg-white rounded-full h-2 mb-4 p-0.5 border border-gray-100 shadow-sm overflow-hidden">
                    <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    ></div>
                </div>

                {/* Question Card Area */}
                <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 items-stretch">
                    {/* Content Section - Order first on mobile so question + nav visible without scroll */}
                    <div className="flex-1 flex flex-col h-full order-1 lg:order-2 min-w-0">
                        <div className="flex-1 bg-white rounded-2xl md:rounded-[2rem] shadow-lg shadow-gray-100 p-4 md:p-8 border border-gray-50 relative overflow-hidden flex flex-col">
                            <div className="relative z-10 flex-1 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] md:text-xs font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Question {currentQuestionIndex + 1} of {questions.length}</span>
                                    <span className="text-[10px] md:text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full uppercase tracking-widest">
                                        {currentQuestion?.questionType === 'theory' ? 'Theory' : 'Multiple Choice'}
                                    </span>
                                </div>

                                <h3 className="text-xl md:text-2xl font-black text-gray-800 mb-6 leading-snug">
                                    {currentQuestion?.questionText}
                                </h3>

                                <div className="flex-1">
                                    {currentQuestion?.questionType === 'mcq' ? (
                                        <div className={`grid grid-cols-1 ${currentQuestion?.options?.length > 3 ? 'md:grid-cols-2' : ''} gap-3`}>
                                            {currentQuestion?.options.map((opt, oIdx) => (
                                                <button
                                                    key={oIdx}
                                                    onClick={() => setAnswers({ ...answers, [currentQuestionIndex]: opt })}
                                                    className={`group p-3 md:p-4 rounded-xl md:rounded-2xl border-2 text-left transition-all flex items-center ${answers[currentQuestionIndex] === opt
                                                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                                                        : 'border-gray-50 bg-gray-50/30 hover:bg-white hover:border-indigo-100 hover:shadow-md'
                                                        }`}
                                                >
                                                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center font-black text-[10px] md:text-sm mr-4 transition-all ${answers[currentQuestionIndex] === opt
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-white border md:border-2 border-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 group-hover:border-indigo-600'
                                                        }`}>
                                                        {String.fromCharCode(65 + oIdx)}
                                                    </div>
                                                    <span className={`text-sm md:text-base font-bold transition-colors ${answers[currentQuestionIndex] === opt ? 'text-indigo-900' : 'text-gray-700'
                                                        }`}>{opt}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Short Essay Response</label>
                                            <textarea
                                                rows="6"
                                                placeholder="Write your answer here..."
                                                value={answers[currentQuestionIndex] || ''}
                                                onChange={(e) => setAnswers({ ...answers, [currentQuestionIndex]: e.target.value })}
                                                className="w-full flex-1 p-4 md:p-6 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-xl md:rounded-2xl transition-all outline-none font-medium text-gray-800 text-sm md:text-base resize-none shadow-inner"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
                        </div>

                        {/* Navigation Controls */}
                        <div className="mt-4 flex items-center justify-between gap-4 flex-shrink-0">
                            <button
                                disabled={currentQuestionIndex === 0}
                                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                                className={`flex items-center space-x-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm ${currentQuestionIndex === 0 ? 'invisible' : ''}`}
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span className="text-sm">Previous</span>
                            </button>

                            {currentQuestionIndex === questions.length - 1 ? (
                                <button
                                    onClick={() => submitExam()}
                                    className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-sm hover:shadow-lg hover:bg-indigo-700 transition-all"
                                >
                                    <span>Submit</span>
                                    <Send className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                                    className="flex items-center space-x-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-black transition-all shadow-md"
                                >
                                    <span>Next</span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Navigation Sidebar / Question Map - Below content on mobile (order-2), left sidebar on desktop */}
                    <div className="w-full lg:w-48 flex flex-col order-2 lg:order-1 lg:flex-shrink-0">
                        {/* Mobile: collapsible header */}
                        <button
                            type="button"
                            onClick={() => setMobileMapExpanded(!mobileMapExpanded)}
                            className="lg:hidden flex items-center justify-between w-full p-3 bg-white rounded-xl border border-gray-100 shadow-sm mb-2"
                            aria-expanded={mobileMapExpanded}
                        >
                            <span className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                Question map · {currentQuestionIndex + 1} of {questions.length}
                            </span>
                            {mobileMapExpanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                        </button>
                        {/* Desktop: always-visible label */}
                        <h3 className="hidden lg:block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-2">Question Map</h3>
                        <div className={`grid grid-cols-6 xs:grid-cols-8 sm:grid-cols-10 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 p-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-y-auto lg:max-h-[400px] ${!mobileMapExpanded ? 'hidden lg:grid' : ''}`}>
                            {questions.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setCurrentQuestionIndex(idx);
                                        setMobileMapExpanded(false);
                                    }}
                                    className={`aspect-square rounded-lg flex items-center justify-center text-[10px] md:text-xs font-black transition-all ${idx === currentQuestionIndex
                                        ? 'bg-indigo-600 text-white shadow-md scale-105'
                                        : answers[idx] !== undefined
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100 border border-gray-100'
                                        }`}
                                >
                                    {idx + 1}
                                </button>
                            ))}
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