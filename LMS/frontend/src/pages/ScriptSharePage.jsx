import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
    Clock, Shield, User, Mail, Award, CheckCircle2, 
    AlertTriangle, FileText, Send, Save, ArrowLeft, RefreshCw, Menu, X 
} from 'lucide-react';
import OTPInput from '../components/OTPInput';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { formatDisplayDate } from '../utils/timezone';

// Use a clean axios instance to bypass default auth interceptors (which redirect on 401)
const publicApi = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    headers: { 'Content-Type': 'application/json' }
});

const ScriptSharePage = () => {
    const { shareToken } = useParams();
    const navigate = useNavigate();

    // Lifecycle States: 'LOADING', 'REQUEST_ACCESS', 'VERIFY_OTP', 'ACTIVE', 'EXPIRED', 'SAVED'
    const [pageState, setPageState] = useState('LOADING');
    const [loading, setLoading] = useState(true);

    // Share link metadata
    const [meta, setMeta] = useState(null);

    // Request Access form
    const [requesterName, setRequesterName] = useState('');
    const [requesterEmail, setRequesterEmail] = useState('');
    const [otpExpiresAt, setOtpExpiresAt] = useState(null);

    // OTP entry
    const [otpValue, setOtpValue] = useState('');
    const [otpVerifying, setOtpVerifying] = useState(false);

    // Active access session
    const [accessToken, setAccessToken] = useState('');
    const [timeRemainingMs, setTimeRemainingMs] = useState(0);
    const [sessionStatus, setSessionStatus] = useState('');
    const [script, setScript] = useState(null);

    // Grading state
    const [questionGrades, setQuestionGrades] = useState([]); // { index/questionIndex, score, feedback }
    const [overallFeedback, setOverallFeedback] = useState('');
    const [savingDraft, setSavingDraft] = useState(false);
    const [finalizing, setFinalizing] = useState(false);

    const [selectedSubmissionRef, setSelectedSubmissionRef] = useState('');
    const [candidateGradeDrafts, setCandidateGradeDrafts] = useState({});
    const [isCandidatePanelOpen, setIsCandidatePanelOpen] = useState(false);
    const [questionFilter, setQuestionFilter] = useState('all');

    // Timer refs
    const timerIntervalRef = useRef(null);
    const autoSaveTriggeredRef = useRef(false);

    const { theme } = useTheme();

    const rootColors = theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900';
    const topBarBg = theme === 'dark' ? 'bg-slate-900/90' : 'bg-white/90';
    const topBorder = theme === 'dark' ? 'border-slate-800' : 'border-slate-200';
    const cardBg = theme === 'dark' ? 'bg-slate-900' : 'bg-white';
    const border = theme === 'dark' ? 'border-slate-800' : 'border-slate-200';
    const panelBg = theme === 'dark' ? 'bg-slate-950' : 'bg-gray-50';
    const panelBorder = theme === 'dark' ? 'border-slate-850' : 'border-slate-200';
    const inputBg = theme === 'dark' ? 'bg-slate-950' : 'bg-white';
    const inputText = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
    const caret = theme === 'dark' ? 'caret-white' : 'caret-black';
    const placeholder = theme === 'dark' ? 'placeholder:text-slate-500' : 'placeholder:text-slate-400';
    const textPrimary = theme === 'dark' ? 'text-slate-100' : 'text-slate-900';
    const textSecondary = theme === 'dark' ? 'text-slate-400' : 'text-slate-600';
    const cardText = theme === 'dark' ? 'text-slate-200' : 'text-slate-900';
    const cardSubText = theme === 'dark' ? 'text-slate-400' : 'text-slate-500';
    const pageLayoutCols = script?.submissions?.length > 1 ? 'lg:grid-cols-[280px_1fr]' : 'lg:grid-cols-1';

    useEffect(() => {
        resolveShareToken();
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [shareToken]);

    // 1. Resolve share token and check sessionStorage for existing active session
    const resolveShareToken = async () => {
        setLoading(true);
        try {
            const storedToken = sessionStorage.getItem(`script_access_${shareToken}`);
            const res = await publicApi.get(`/scripts/share/${shareToken}`);
            setMeta(res.data);

            if (res.data.status === 'saved') {
                setPageState('SAVED');
                return;
            }

            // If active and we have stored token, load it
            if (storedToken) {
                await fetchScriptSession(storedToken);
            } else if (res.data.status === 'active' && res.data.accessToken) {
                // If backend says it's active and returned token, use it
                sessionStorage.setItem(`script_access_${shareToken}`, res.data.accessToken);
                await fetchScriptSession(res.data.accessToken);
            } else {
                setPageState('REQUEST_ACCESS');
            }
        } catch (error) {
            console.error('Error resolving share link:', error);
            toast.error(error.response?.data?.message || 'Invalid or expired share link');
            setPageState('EXPIRED');
        } finally {
            setLoading(false);
        }
    };

    // 2. Fetch full script data using access token
    const fetchScriptSession = async (tokenToUse) => {
        try {
            const res = await publicApi.get(`/scripts/session/${tokenToUse}`);
            const { session, script: scriptData } = res.data;

            setAccessToken(tokenToUse);
            setSessionStatus(session.status);
            setScript(scriptData);
            setTimeRemainingMs(session.timeRemainingMs);
            // Preserve current selection if possible, otherwise default to first submission
            setSelectedSubmissionRef(prev => prev || scriptData.submissions?.[0]?.submissionRef || '');

            if (session.status === 'saved') {
                setPageState('SAVED');
                return;
            }

            setPageState('ACTIVE');
            startSessionTimer(session.timeRemainingMs);
        } catch (error) {
            console.error('Error loading session:', error);
            sessionStorage.removeItem(`script_access_${shareToken}`);
            if (error.response?.status === 410) {
                setPageState('EXPIRED');
            } else {
                setPageState('REQUEST_ACCESS');
            }
        }
    };

    // 3. Start countdown timer
    const startSessionTimer = (initialMs) => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        let remaining = initialMs;
        
        timerIntervalRef.current = setInterval(() => {
            remaining -= 1000;
            if (remaining <= 0) {
                clearInterval(timerIntervalRef.current);
                setTimeRemainingMs(0);
                setPageState('EXPIRED');
                sessionStorage.removeItem(`script_access_${shareToken}`);
                toast.error('Your access session has expired. Progress was discarded.');
            } else {
                setTimeRemainingMs(remaining);
            }
        }, 1000);
    };

    // 4. Request Access (Submit name/email)
    const handleRequestAccess = async (e) => {
        e.preventDefault();
        if (!requesterName || !requesterEmail) return toast.error('Please enter name and email');
        
        setLoading(true);
        try {
            const res = await publicApi.post(`/scripts/share/${shareToken}/request-access`, {
                requesterName,
                requesterEmail
            });
            setOtpExpiresAt(new Date(res.data.otpExpiresAt));
            setPageState('VERIFY_OTP');
            toast.success('Access requested. OTP has been sent to the authority.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to request access');
        } finally {
            setLoading(false);
        }
    };

    // 5. Verify OTP
    const handleVerifyOtp = async (e) => {
        if (e) e.preventDefault();
        if (otpValue.length !== 6) return toast.error('Please enter the 6-digit OTP code');

        setOtpVerifying(true);
        try {
            const res = await publicApi.post(`/scripts/share/${shareToken}/verify-otp`, {
                otp: otpValue
            });
            const { accessToken: token } = res.data;
            sessionStorage.setItem(`script_access_${shareToken}`, token);
            await fetchScriptSession(token);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Invalid or expired OTP');
        } finally {
            setOtpVerifying(false);
        }
    };

    const formatAnswerDisplay = (answerObj) => {
        if (answerObj === undefined || answerObj === null) return null;
        if (typeof answerObj === 'string' || typeof answerObj === 'number' || typeof answerObj === 'boolean') return String(answerObj);
        if (Array.isArray(answerObj)) return answerObj.join(', ');
        // If object has no meaningful answer fields, treat as no answer
        const meaningfulKeys = ['answer', 'theoryAnswer', 'selectedOption', 'text', 'file', 'attachments', 'response'];
        const hasMeaningful = meaningfulKeys.some(k => answerObj[k] !== undefined && answerObj[k] !== null && answerObj[k] !== '');
        if (!hasMeaningful) return null;
        return answerObj.answer || answerObj.theoryAnswer || answerObj.selectedOption || JSON.stringify(answerObj, null, 2);
    };

    const buildInitialGradingState = (scriptData, activeSubmission) => {
        if (scriptData.type === 'exam') {
            const answersSource = activeSubmission?.answers ?? scriptData.answers;
            const snapshot = activeSubmission?.gradingSnapshot ?? scriptData.gradingSnapshot;
            const questionGrades = scriptData.questions.map((q, qIndex) => {
                const submittedAns = answersSource?.find(a => a.questionIndex === qIndex);
                const snapshotAns = snapshot?.questionGrades?.find(g => g.index === qIndex);
                return {
                    index: qIndex,
                    score: snapshotAns?.score ?? (submittedAns?.score || 0),
                    feedback: ''
                };
            });
            return {
                questionGrades,
                overallFeedback: snapshot?.feedback || ''
            };
        }

        const questionScoresSource = activeSubmission?.questionScores ?? scriptData.questionScores;
        const snapshot = activeSubmission?.gradingSnapshot ?? scriptData.gradingSnapshot;
        const questionGrades = scriptData.questions.map((q, qIndex) => {
            const existingScore = questionScoresSource?.find(s => s.questionIndex === qIndex);
            const snapshotScore = snapshot?.questionScores?.find(s => s.questionIndex === qIndex);
            return {
                questionIndex: qIndex,
                score: snapshotScore?.score ?? (existingScore?.score || 0),
                feedback: snapshotScore?.feedback ?? (existingScore?.feedback || '')
            };
        });
        return {
            questionGrades,
            overallFeedback: snapshot?.feedback || scriptData.feedback || ''
        };
    };

    const getActiveSubmission = () => {
        if (!script?.submissions?.length) return null;
        return script.submissions.find(sub => sub.submissionRef === selectedSubmissionRef) || script.submissions[0];
    };

    useEffect(() => {
        if (!script) return;

        if (script.submissions?.length > 0 && !selectedSubmissionRef) {
            setSelectedSubmissionRef(script.submissions[0].submissionRef);
            return;
        }

        const activeSubmission = getActiveSubmission();
        const draftKey = activeSubmission?.submissionRef || 'single';
        const savedDraft = candidateGradeDrafts[draftKey];

        if (savedDraft) {
            setQuestionGrades(savedDraft.questionGrades);
            setOverallFeedback(savedDraft.overallFeedback);
            return;
        }

        const initialState = buildInitialGradingState(script, activeSubmission);
        setQuestionGrades(initialState.questionGrades);
        setOverallFeedback(initialState.overallFeedback);
        setCandidateGradeDrafts(prev => ({ ...prev, [draftKey]: initialState }));
    }, [script, selectedSubmissionRef, candidateGradeDrafts]);

    const handleCandidateSwitch = (newRef) => {
        if (selectedSubmissionRef) {
            setCandidateGradeDrafts(prev => ({
                ...prev,
                [selectedSubmissionRef]: {
                    questionGrades,
                    overallFeedback
                }
            }));
        }
        setSelectedSubmissionRef(newRef);
    };

    // Update grade score or feedback in state
    const handleGradeFieldChange = (index, field, value) => {
        setQuestionGrades(prev => prev.map((item, i) => {
            const matches = script?.type === 'exam' ? item.index === index : item.questionIndex === index;
            if (matches) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    // Check if entered scores are valid
    const validateScores = () => {
        for (const qg of questionGrades) {
            const questionIndex = script?.type === 'exam' ? qg.index : qg.questionIndex;
            const maxScore = script?.questions[questionIndex]?.maxScore || 10;
            if (qg.score < 0 || qg.score > maxScore) {
                toast.error(`Question ${questionIndex + 1} score must be between 0 and ${maxScore}`);
                return false;
            }
        }
        return true;
    };

    // Build the grading payload based on script type
    const buildGradingPayload = () => {
        if (script?.type === 'exam') {
            return {
                gradingData: {
                    questionGrades: questionGrades.map(qg => ({
                        index: qg.index,
                        score: Number(qg.score)
                    })),
                    feedback: overallFeedback
                    ,
                    submissionRef: selectedSubmissionRef || script?.submissionRef
                }
            };
        } else {
            // Assignment
            const totalScore = questionGrades.reduce((sum, qg) => sum + Number(qg.score), 0);
            return {
                gradingData: {
                    score: totalScore,
                    feedback: overallFeedback,
                    questionScores: questionGrades.map(qg => ({
                        questionIndex: qg.questionIndex,
                        score: Number(qg.score),
                        feedback: qg.feedback
                    }))
                    ,
                    submissionRef: selectedSubmissionRef || script?.submissionRef
                }
            };
        }
    };

    // 6. Save Draft grading
    const handleSaveDraft = async (isAutoSave = false) => {
        if (!validateScores()) return;
        setSavingDraft(true);
        try {
            const payload = buildGradingPayload();
            await publicApi.patch(`/scripts/session/${accessToken}/grade`, payload);
            if (!isAutoSave) {
                toast.success('Grading draft saved successfully!');
            }
            // Refresh session data to reflect saved snapshot and updated scores for this candidate
            if (accessToken) await fetchScriptSession(accessToken);
            if (isAutoSave) {
                toast.success('Progress auto-saved before access expiry.');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save draft. Session may have expired.');
            if (error.response?.status === 410) setPageState('EXPIRED');
        } finally {
            setSavingDraft(false);
        }
    };

    useEffect(() => {
        if (pageState !== 'ACTIVE' || autoSaveTriggeredRef.current || savingDraft || finalizing) return;
        if (timeRemainingMs > 0 && timeRemainingMs <= 60000) {
            autoSaveTriggeredRef.current = true;
            handleSaveDraft(true);
        }
    }, [pageState, timeRemainingMs, savingDraft, finalizing]);

    // 7. Finalize Grading (Write to actual DB and expire access)
    const handleFinalizeGrading = async () => {
        if (!validateScores()) return;
        if (!window.confirm('Are you sure you want to finalize? This will submit the grades to the student record and end your active session.')) return;

        setFinalizing(true);
        try {
            const payload = buildGradingPayload();
            const res = await publicApi.post(`/scripts/session/${accessToken}/finalize`, payload);
            // If group session, backend returns submissionRef and keeps session active
            if (res.data && res.data.submissionRef && script?.submissions?.length > 1) {
                toast.success('Candidate grading finalized. You may continue grading other scripts.');
                // Refresh session so UI shows updated scores
                if (accessToken) await fetchScriptSession(accessToken);
            } else {
                // Single submission finalize ends the session
                sessionStorage.removeItem(`script_access_${shareToken}`);
                if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                setPageState('SAVED');
                toast.success('Grading finalized and applied to student records!');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to finalize grading. Session may have expired.');
            if (error.response?.status === 410) setPageState('EXPIRED');
        } finally {
            setFinalizing(false);
        }
    };

    // Helper to format remaining time
    const formatTimeRemaining = (ms) => {
        if (ms <= 0) return '00:00';
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Render loading view
    if (pageState === 'LOADING') {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolving share link authority...</p>
                </div>
            </div>
        );
    }

    // Render Request Access view
    if (pageState === 'REQUEST_ACCESS') {
        return (
            <div className={`min-h-screen ${rootColors} flex items-center justify-center p-4 relative overflow-hidden`}>
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-400/5 rounded-full blur-[120px] pointer-events-none" />

                <div className={`w-full max-w-md ${cardBg} border ${border} rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative z-10 animate-slide-up`}>
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 text-primary border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Shield className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight italic">Secure <span className="text-primary not-italic">Script Access</span></h2>
                        <p className={`text-xs ${textSecondary} mt-2 font-medium`}>Request authorization to view or grade this student script</p>
                    </div>

                    <div className={`${panelBg} border ${panelBorder} p-4 rounded-2xl mb-6`}>
                        <span className={`text-[9px] font-black ${cardSubText} uppercase tracking-widest block`}>TARGET DOCUMENT</span>
                        <h4 className={`font-bold text-sm ${cardText} mt-1`}>{meta?.title || 'Script Submission'}</h4>
                        <div className={`flex justify-between items-center mt-3 text-[10px] ${cardSubText} uppercase font-bold tracking-wider pt-2 border-t ${panelBorder}`}>
                            <span>Candidate: {meta?.candidateName || 'Anonymous'}</span>
                            <span className="text-primary font-black">{meta?.accessType === 'grade' ? 'Evaluator' : 'Viewer'} Mode</span>
                        </div>
                    </div>

                    <form onSubmit={handleRequestAccess} className="space-y-4">
                        <div>
                            <label className={`text-[10px] font-black uppercase tracking-widest ${cardSubText} mb-1.5 ml-1`}>Your Full Name</label>
                            <input
                                type="text"
                                placeholder="e.g. John Doe"
                                value={requesterName}
                                onChange={(e) => setRequesterName(e.target.value)}
                                className={`w-full ${inputBg} border ${border} focus:border-primary focus:ring-primary/20 ${inputText} rounded-xl ${placeholder} px-4 py-3`}
                                required
                            />
                        </div>
                        <div>
                            <label className={`text-[10px] font-black uppercase tracking-widest ${cardSubText} mb-1.5 ml-1`}>Your Email Address</label>
                            <input
                                type="email"
                                placeholder="e.g. john@school.com"
                                value={requesterEmail}
                                onChange={(e) => setRequesterEmail(e.target.value)}
                                className={`w-full ${inputBg} border ${border} focus:border-primary focus:ring-primary/20 ${inputText} rounded-xl ${placeholder} px-4 py-3`}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full btn-premium py-4 mt-6 text-sm font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-60 ${loading ? 'opacity-70' : ''}`}
                        >
                            {loading ? 'Requesting...' : 'Request OTP Code'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Render OTP Verification view
    if (pageState === 'VERIFY_OTP') {
        return (
            <div className={`min-h-screen ${rootColors} flex items-center justify-center p-4 relative overflow-hidden`}>
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
                <div className={`w-full max-w-md ${cardBg} border ${border} rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative z-10 animate-slide-up`}>
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 text-primary border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Clock className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight italic">Verify <span className="text-primary not-italic">Identity</span></h2>
                        <p className={`text-xs ${textSecondary} mt-2 font-medium`}>An OTP code has been dispatched to the exam owner / root admin. Enter the code below to proceed.</p>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <div className={`${panelBg} rounded-2xl border ${panelBorder} text-center py-4`}>
                            <span className={`text-[9px] font-black ${cardSubText} uppercase tracking-widest block mb-3`}>ENTER ONE-TIME PASSWORD</span>
                            <OTPInput length={6} value={otpValue} onChange={setOtpValue} />
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setPageState('REQUEST_ACCESS')}
                                className={`flex-1 px-4 py-4 rounded-xl border ${border} ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-900' : 'text-slate-700 hover:bg-slate-100'} transition-all font-black uppercase tracking-widest text-[10px]`}
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                disabled={otpVerifying || otpValue.length !== 6}
                                className="flex-[2] btn-premium py-4 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                            >
                                {otpVerifying ? 'Verifying...' : 'Verify & Open'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // Render Expired view
    if (pageState === 'EXPIRED') {
        return (
            <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-[2.5rem] p-10 text-center animate-slide-up">
                    <div className="w-20 h-20 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-rose-500 mb-2">Access Expired</h2>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                        Your secure sharing session has expired. To maintain security, grades must be saved and finalized before the timer runs out.
                    </p>
                    <button
                        onClick={() => setPageState('REQUEST_ACCESS')}
                        className="w-full btn-premium py-4 font-black uppercase tracking-widest text-xs"
                    >
                        Request New Access
                    </button>
                </div>
            </div>
        );
    }

    // Render Saved Success view
    if (pageState === 'SAVED') {
        return (
            <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-[2.5rem] p-10 text-center animate-slide-up">
                    <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-emerald-500 mb-2">Grading Completed</h2>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                        The grading session was finalized successfully and scores have been submitted directly to the student record.
                    </p>
                    <p className="text-xs text-slate-500 mb-4 font-medium italic">You may now close this browser window safely.</p>
                </div>
            </div>
        );
    }

    // Render Active Script viewing / grading view
    const activeSubmission = getActiveSubmission();
    const isGrader = meta?.accessType === 'grade';
    const isTheoryScript = script?.type === 'assignment' ? script.assignmentType === 'theory' : false;
    const candidateDisplayName = activeSubmission?.candidateName || script?.candidateName || script?.candidateEmail || 'Anonymous';

    const questionIsMCQ = (question) => {
        if (!question) return false;
        if (question.questionType === 'mcq') return true;
        if (question.questionType === 'theory') return false;
        return Array.isArray(question.options) && question.options.length > 0 && Boolean(question.correctOption);
    };
    const questionType = (question) => {
        if (question?.questionType) return question.questionType;
        if (script?.type === 'assignment') {
            if (script.assignmentType === 'mcq') return 'mcq';
            if (script.assignmentType === 'theory') return 'theory';
        }
        return questionIsMCQ(question) ? 'mcq' : 'theory';
    };
    const filteredQuestions = (script?.questions || [])
        .map((question, index) => ({ question, index }))
        .filter(({ question }) => {
            if (questionFilter === 'all') return true;
            return questionType(question) === questionFilter;
        });
    const candidateInitial = candidateDisplayName?.charAt(0)?.toUpperCase() || 'A';
    const candidateEmail = activeSubmission?.candidateEmail || script?.candidateEmail || '';
    const submittedAt = activeSubmission?.submittedAt || script?.submittedAt;
    const currentStatus = activeSubmission?.status || script?.status;
    const computedScore = questionGrades.reduce((sum, qg) => sum + Number(qg.score || 0), 0);
    const currentScore = questionGrades.length > 0
        ? computedScore
        : script?.type === 'exam'
            ? activeSubmission?.totalScore ?? script?.totalScore
            : activeSubmission?.score ?? script?.score;
    
    return (
        <div className={`min-h-screen ${rootColors} flex flex-col font-inter`}>
            {/* Top Bar Banner */}
                <div className={`sticky top-0 ${topBarBg} backdrop-blur-md border-b ${topBorder} px-6 py-4 z-50`}> 
                    <div className="flex items-center justify-between sm:hidden">
                        <div className={`text-sm font-black uppercase tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>
                            {script?.examTitle || script?.assignmentTitle || 'Shared Script'}
                        </div>
                        {(script?.submissions?.length > 1 || isGrader) && (
                            <button
                                type="button"
                                onClick={() => setIsCandidatePanelOpen(prev => !prev)}
                                className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-black uppercase tracking-widest transition ${theme === 'dark' ? 'border-slate-700 text-slate-200 bg-slate-900/80 hover:bg-slate-800' : 'border-slate-200 text-slate-700 bg-white/90 hover:bg-slate-100'}`}>
                                {isCandidatePanelOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                            </button>
                        )}
                    </div>

                    <div className="hidden sm:flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-primary/15 rounded-xl border border-primary/20 flex items-center justify-center text-primary font-black text-sm italic shadow-inner">
                                {candidateInitial}
                            </div>
                            <div>
                                <h1 className="text-lg font-black tracking-tight flex items-center gap-2 uppercase italic">
                                    <span>{candidateDisplayName}</span>
                                    <span className={`text-[9px] font-black not-italic px-2 py-0.5 rounded border ${isGrader ? 'bg-primary/20 text-primary border-primary/30' : `${theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-200 text-slate-700 border-slate-300'}`}`}>
                                        {isGrader ? 'EVALUATOR' : 'VIEWER'}
                                    </span>
                                </h1>
                                <p className={`text-[9px] font-black ${textSecondary} uppercase tracking-widest mt-0.5`}>
                                    Target: {script?.examTitle || script?.assignmentTitle} ({script?.type})
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border ${timeRemainingMs < 300000 ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse' : theme === 'dark' ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                                <Clock className="w-4 h-4" />
                                <span className="font-mono text-sm font-black tracking-wider">{formatTimeRemaining(timeRemainingMs)}</span>
                            </div>

                            <ThemeToggle />

                            {isGrader && (
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={savingDraft || finalizing}
                                    className="hidden sm:inline-flex px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50 items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    <span>Save Draft</span>
                                </button>
                                <button
                                    onClick={handleFinalizeGrading}
                                    disabled={savingDraft || finalizing}
                                    className="w-full sm:w-auto btn-premium px-3 py-2 text-[11px] uppercase tracking-wider font-black flex items-center justify-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    <span>Finalize</span>
                                </button>
                            </div>
                            )}
                        </div>
                    </div>
                </div>

            {isCandidatePanelOpen && script?.submissions?.length > 1 && (
                <div className="fixed inset-0 z-50 flex justify-start bg-slate-950/90 sm:hidden">
                    <div className={`${cardBg} border ${border} rounded-r-[2rem] w-full max-w-xs h-full p-4 overflow-y-auto shadow-2xl`}> 
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${cardSubText}`}>Shared Candidates</p>
                                <h2 className={`text-sm font-black ${cardText} mt-2`}>{script.submissions.length} candidates</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCandidatePanelOpen(false)}
                                className={`rounded-xl border px-3 py-2 ${theme === 'dark' ? 'border-slate-700 text-slate-200 bg-slate-900/80' : 'border-slate-200 text-slate-700 bg-white/90'}`}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 mb-4">
                            <div className={`rounded-2xl border ${border} p-3 ${panelBg}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${cardSubText}`}>Actions</span>
                                </div>
                                <div className="space-y-3">
                                    <div className={`rounded-2xl border ${border} p-3 ${panelBg}`}>
                                        <div className="text-[10px] font-black uppercase tracking-widest ${cardSubText} mb-2">Timer</div>
                                        <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 ${theme === 'dark' ? 'bg-slate-900/90 text-slate-200 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                            <Clock className="w-4 h-4" />
                                            <span className="font-mono text-sm font-black tracking-wider">{formatTimeRemaining(timeRemainingMs)}</span>
                                        </div>
                                    </div>
                                    {isGrader && (
                                        <div className="space-y-2">
                                            <button
                                                onClick={handleSaveDraft}
                                                disabled={savingDraft || finalizing}
                                                className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-xl text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50"
                                            >
                                                Save Draft
                                            </button>
                                            <button
                                                onClick={handleFinalizeGrading}
                                                disabled={savingDraft || finalizing}
                                                className="w-full btn-premium px-3 py-2 text-sm uppercase tracking-wider font-black"
                                            >
                                                Finalize
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${cardSubText}`}>Theme</span>
                                        <ThemeToggle />
                                    </div>
                                </div>
                            </div>
                            <div className={`rounded-2xl border ${border} p-3 ${panelBg}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${cardSubText} mb-3`}>Filter Questions</p>
                                <div className="flex flex-wrap gap-2">
                                    {['all', 'mcq', 'theory'].map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setQuestionFilter(type)}
                                            className={`rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-widest transition ${questionFilter === type ? 'bg-primary text-white' : theme === 'dark' ? 'bg-slate-900 text-slate-200 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                                        >
                                            {type.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3 max-h-[calc(100vh-22rem)] overflow-y-auto">
                            {script.submissions.map((submission) => {
                                const isActive = submission.submissionRef === selectedSubmissionRef;
                                const displayName = submission.candidateName || submission.candidateEmail || 'Anonymous';
                                const initial = displayName?.charAt(0)?.toUpperCase() || 'A';
                                return (
                                    <button
                                        key={submission.submissionRef}
                                        type="button"
                                        onClick={() => {
                                            handleCandidateSwitch(submission.submissionRef);
                                            setIsCandidatePanelOpen(false);
                                        }}
                                        className={`w-full rounded-3xl border px-4 py-4 text-left transition-all ${isActive ? 'border-primary bg-primary/10 shadow-inner' : `${theme === 'dark' ? 'border-slate-800 bg-slate-950/70 hover:bg-slate-900' : 'border-slate-200 bg-slate-100 hover:bg-slate-200'}`}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-11 h-11 rounded-2xl ${theme === 'dark' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'} flex items-center justify-center text-sm font-black`}>{initial}</div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-bold ${cardText} truncate`}>{displayName}</p>
                                                <p className={`text-[10px] ${cardSubText} truncate`}>{formatDisplayDate(submission.submittedAt)}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            {/* Main Content Area */}
            <div className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
                <div className={`grid gap-6 ${pageLayoutCols}`}>
                    {script?.submissions?.length > 1 && (
                        <aside className="hidden lg:block space-y-4">
                            <div className={`${cardBg} border ${border} rounded-[2rem] p-5 shadow-xl sticky top-24 max-h-[calc(100vh-200px)] overflow-y-auto`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${cardSubText}`}>Shared Candidates</p>
                                        <h2 className={`text-sm font-black ${cardText} mt-2`}>{script.submissions.length} candidates</h2>
                                    </div>
                                    <span className={`text-[10px] uppercase tracking-widest ${cardSubText}`}>Group</span>
                                </div>
                                <div className="space-y-3">
                                    {script.submissions.map((submission) => {
                                        const isActive = submission.submissionRef === selectedSubmissionRef;
                                        const displayName = submission.candidateName || submission.candidateEmail || 'Anonymous';
                                        const initial = displayName?.charAt(0)?.toUpperCase() || 'A';

                                        return (
                                            <button
                                                key={submission.submissionRef}
                                                type="button"
                                                onClick={() => handleCandidateSwitch(submission.submissionRef)}
                                                className={`w-full rounded-3xl border px-4 py-4 text-left transition-all ${isActive ? 'border-primary bg-primary/10 shadow-inner' : `${theme === 'dark' ? 'border-slate-800 bg-slate-950/70 hover:bg-slate-900' : 'border-slate-200 bg-slate-100 hover:bg-slate-200'}`}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-11 h-11 rounded-2xl ${theme === 'dark' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'} flex items-center justify-center text-sm font-black`}>{initial}</div>
                                                    <div className="min-w-0">
                                                        <p className={`text-sm font-bold ${cardText} truncate`}>{displayName}</p>
                                                        <p className={`text-[10px] ${cardSubText} truncate`}>{formatDisplayDate(submission.submittedAt)}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </aside>
                    )}
                    <div className="space-y-6">
                {/* Warning header when session is ending */}
                {timeRemainingMs < 300000 && isGrader && (
                    <div className="bg-rose-500/15 border-2 border-rose-500/30 rounded-2xl p-4 flex gap-3 text-rose-400 items-start">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-black text-xs uppercase tracking-wide">Critical Warning: Session Expiring Soon</h4>
                            <p className="text-xs font-medium leading-relaxed mt-1">
                                Your secure grading session will terminate in less than 5 minutes. You must click **Finalize** or **Save Draft** before the timer reaches zero, otherwise all your current grading work will be discarded.
                            </p>
                        </div>
                    </div>
                )}

                {/* Submissions Details Overview */}
                <div className={`${cardBg} border ${border} rounded-[2rem] p-6 shadow-xl grid grid-cols-2 sm:grid-cols-4 gap-4`}>
                    <div>
                        <span className={`text-[9px] font-black ${cardSubText} uppercase tracking-widest block`}>Submitted At</span>
                        <span className={`font-bold text-xs ${cardText} mt-1 block`}>{formatDisplayDate(submittedAt)}</span>
                    </div>
                    <div>
                        <span className={`text-[9px] font-black ${cardSubText} uppercase tracking-widest block`}>Original Score</span>
                        <span className={`font-bold text-xs ${cardText} mt-1 block`}>
                            {script?.type === 'exam' ? `${currentScore || 0} pts` : `${currentScore || 0}/${script.maxScore} pts`}
                        </span>
                    </div>
                    <div>
                        <span className={`text-[9px] font-black ${cardSubText} uppercase tracking-widest block`}>Status</span>
                        <span className={`inline-block text-[9px] font-black uppercase tracking-wider border rounded px-2.5 py-0.5 mt-1.5 ${currentStatus === 'graded' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'}`}>
                            {currentStatus}
                        </span>
                    </div>
                    <div>
                        <span className={`text-[9px] font-black ${cardSubText} uppercase tracking-widest block`}>Candidate Email</span>
                        <span className={`font-bold text-xs ${cardText} mt-1 block truncate`} title={candidateEmail}>{candidateEmail || 'N/A'}</span>
                    </div>
                </div>

                {/* Questions Listing */}
                {script?.questions?.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                        {['all', 'mcq', 'theory'].map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setQuestionFilter(type)}
                                className={`rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-widest transition ${questionFilter === type ? 'bg-primary text-white' : theme === 'dark' ? 'bg-slate-900 text-slate-200 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
                            >
                                {type.toUpperCase()}
                            </button>
                        ))}
                    </div>
                )}
                <div className="space-y-6 pb-24">
                    {filteredQuestions.map(({ question, index }, filteredIndex) => {
                        const answerObj = script.type === 'exam'
                            ? activeSubmission?.answers?.find(a => a.questionIndex === index) ?? script.answers?.find(a => a.questionIndex === index)
                            : null;
                        const studentAnswer = script.type === 'exam'
                            ? formatAnswerDisplay(answerObj)
                            : formatAnswerDisplay(activeSubmission?.answers?.[index] ?? (Array.isArray(script.answers) ? script.answers[index] : script.answers));

                        const currentGradeItem = questionGrades.find(qg => 
                            script.type === 'exam' ? qg.index === index : qg.questionIndex === index
                        ) || { score: 0, feedback: '' };

                        return (
                            <div key={index} className={`${cardBg} border ${border} rounded-[2rem] p-6 shadow-lg space-y-6`}>
                                {/* Question Title */}
                                <div className="flex items-start gap-3">
                                    <span className="w-8 h-8 rounded-lg bg-primary/20 text-primary border border-primary/20 flex items-center justify-center font-black text-xs">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <p className={`font-bold ${cardText} text-sm leading-relaxed`}>{question.questionText}</p>
                                        <span className={`text-[9px] font-black ${cardSubText} uppercase tracking-widest mt-1 block`}>Maximum Points: {question.maxScore || 10}</span>
                                    </div>
                                </div>

                                {/* MCQ Options if MCQ */}
                                {questionType(question) === 'mcq' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-11">
                                        {question.options.map((opt, oIdx) => {
                                            const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
                                            const isSelected = answerObj?.answer === opt;
                                            const isCorrect = question.correctOption === opt;
                                            return (
                                                <div 
                                                    key={oIdx} 
                                                    className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${isSelected ? 'border-primary bg-primary/5 text-slate-200' : theme === 'dark' ? 'border-slate-800/80 bg-slate-950/40 text-slate-400' : 'border-slate-200/80 bg-slate-100 text-slate-700'} ${isCorrect && script.type === 'exam' ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400' : ''}`}
                                                >
                                                    <span className={`w-6 h-6 rounded flex items-center justify-center font-black text-[10px] ${isSelected ? 'bg-primary text-white' : 'bg-slate-850 text-slate-500'}`}>
                                                        {labels[oIdx]}
                                                    </span>
                                                    <span>{opt}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Student Answer Box */}
                                <div className={`${panelBg} border ${panelBorder} rounded-2xl p-5 relative overflow-hidden pl-11`}>
                                    <div className="absolute top-0 right-0 p-3 opacity-[0.02]">
                                        <FileText className="w-12 h-12 text-white" />
                                    </div>
                                    <span className={`text-[9px] font-black ${cardSubText} uppercase tracking-widest block mb-2`}>Student Response</span>
                                    <p className={`${cardText} text-xs font-medium whitespace-pre-wrap leading-relaxed`}>
                                        {studentAnswer || 'No answer submitted.'}
                                    </p>
                                </div>

                                {/* Evaluator Scoring Details */}
                                {isGrader ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-850 pt-5 pl-11">
                                        <div>
                                            <label className={`text-[9px] font-black ${cardSubText} uppercase tracking-widest mb-1.5 block`}>Assign Score</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={currentGradeItem.score}
                                                    onChange={(e) => handleGradeFieldChange(index, 'score', Math.min(question.maxScore || 10, Math.max(0, parseInt(e.target.value) || 0)))}
                                                    className={`w-full ${inputBg} border ${panelBorder} focus:border-primary focus:ring-primary/20 ${inputText} ${caret} rounded-xl text-sm font-bold pr-12 ${placeholder}`}
                                                    min="0"
                                                    max={question.maxScore || 10}
                                                    required
                                                />
                                                <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black ${cardSubText} uppercase`}>pts</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={`text-[9px] font-black ${cardSubText} uppercase tracking-widest mb-1.5 block`}>Question Feedback</label>
                                            <input
                                                type="text"
                                                placeholder="Feedback comments..."
                                                value={currentGradeItem.feedback}
                                                onChange={(e) => handleGradeFieldChange(index, 'feedback', e.target.value)}
                                                className={`w-full ${inputBg} border ${panelBorder} focus:border-primary focus:ring-primary/20 ${inputText} ${caret} rounded-xl text-xs font-medium ${placeholder}`}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* Read only score display */
                                    (script.status === 'graded' || answerObj?.score !== undefined) && (
                                        <div className="flex items-center gap-3 pl-11 pt-2">
                                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 uppercase tracking-widest">
                                                Score: {currentGradeItem.score} / {question.maxScore || 10} pts
                                            </span>
                                            {script.type === 'assignment' && currentGradeItem.feedback && (
                                                <span className="text-xs text-slate-400 font-medium italic">Comment: {currentGradeItem.feedback}</span>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        );
                    })}

                    {/* Overall Grading Feedback Card */}
                    {isGrader ? (
                        <div className={`${cardBg} border ${border} rounded-[2rem] p-6 shadow-lg space-y-4`}>
                            <h3 className={`text-sm font-black uppercase tracking-widest ${cardSubText}`}>Overall Evaluator Summary</h3>
                            <textarea
                                    placeholder="Write overall grading summary and notes..."
                                    value={overallFeedback}
                                    onChange={(e) => setOverallFeedback(e.target.value)}
                                    className={`w-full ${inputBg} border ${panelBorder} focus:border-primary focus:ring-primary/20 ${inputText} ${caret} rounded-[1.5rem] p-4 text-xs font-semibold ${placeholder}`}
                                    rows="3"
                                />
                        </div>
                    ) : (
                        overallFeedback && (
                            <div className={`${cardBg} border ${border} rounded-[2rem] p-6 shadow-lg space-y-2`}>
                                <h3 className={`text-[10px] font-black uppercase tracking-widest ${cardSubText}`}>Overall Evaluator Summary</h3>
                                <p className={`${cardText} text-xs font-medium leading-relaxed italic`}>&quot;{overallFeedback}&quot;</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    </div>
    </div>
    );
};

export default ScriptSharePage;
