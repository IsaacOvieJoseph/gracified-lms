import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, LayoutGrid, Monitor, PlayCircle, ThumbsUp, User, Sun, Moon } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const QnAPresentation = () => {
    const { token } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [board, setBoard] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showSidebar, setShowSidebar] = useState(true);
    const [theme, setTheme] = useState('dark');

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    const fetchBoardAndQuestions = async (isInitial = false) => {
        try {
            const boardRes = await api.get(`/qna/join/${token}`);
            const boardData = boardRes.data;
            setBoard(boardData);

            const qRes = await api.get(`/qna/board/${boardData._id}/questions`);
            setQuestions(qRes.data);
        } catch (err) {
            if (isInitial) {
                toast.error('Failed to load presentation');
                navigate('/');
            } else {
                console.error('Failed to refresh presentation data, check network:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBoardAndQuestions(true);
        const interval = setInterval(() => fetchBoardAndQuestions(false), 10000);
        return () => clearInterval(interval);
    }, [token]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1));
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                setCurrentIndex(prev => Math.max(prev - 1, 0));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [questions.length]);

    const handleToggleAnswered = async (qId, currentState) => {
        try {
            await api.put(`/qna/question/${qId}/answer`, { isAnswered: !currentState });
            fetchBoardAndQuestions(); // Refresh local state
        } catch (err) {
            toast.error('Error updating question status');
        }
    };

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div></div>;
    if (!board) return null;

    const sortedQuestions = [...questions].sort((a, b) => {
        if (a.isAnswered === b.isAnswered) {
            return b.upvotes.length - a.upvotes.length || new Date(b.createdAt) - new Date(a.createdAt);
        }
        return a.isAnswered ? 1 : -1;
    });
    const currentQuestion = sortedQuestions[currentIndex];

    // Theme Variables
    const isDark = theme === 'dark';

    const bgContainer = isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900';
    const bgSidebar = isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:shadow-none';
    const bgSidebarHeader = isDark ? 'bg-slate-900' : 'bg-slate-50';
    const textPrimary = isDark ? 'text-white' : 'text-slate-900';
    const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
    const itemIdle = isDark ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm';
    const itemActive = isDark ? 'bg-indigo-600/20 border-indigo-500/50 text-white' : 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm';
    const bgMain = isDark ? 'from-slate-900 via-slate-900 to-indigo-950' : 'from-slate-50 via-slate-50 to-indigo-50';
    const cardBg = isDark ? 'bg-slate-800/60 border-slate-700 shadow-xl shadow-black/50' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50';
    const answeredCardBg = isDark ? 'border-emerald-500/50 bg-slate-800/60 shadow-emerald-500/10 shadow-2xl' : 'border-emerald-400 bg-white shadow-emerald-500/20 shadow-xl';
    const navOverlayBg = isDark ? 'bg-slate-800/40 hover:bg-slate-700 text-white border-slate-600/50 shadow-2xl' : 'bg-white/90 hover:bg-white text-slate-700 border-slate-200 shadow-lg';
    const emptyIconColor = isDark ? 'text-slate-700' : 'text-slate-300';
    const questionIndicatorText = isDark ? 'text-indigo-400 bg-indigo-900/30' : 'text-indigo-700 bg-indigo-100';

    return (
        <div className={`h-[100dvh] w-full flex flex-col md:flex-row overflow-hidden font-sans ${bgContainer}`}>

            {/* Sidebar ListView */}
            {showSidebar && (
                <div className={`w-full md:w-80 border-t md:border-t-0 md:border-r flex flex-col transition-all duration-300 order-2 md:order-1 h-2/5 md:h-full z-20 shrink-0 ${bgSidebar}`}>
                    <div className={`p-4 border-b flex items-center justify-between shrink-0 ${bgSidebarHeader} ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        <h2 className={`font-bold text-lg truncate pr-2 ${textPrimary}`}>{board.title}</h2>
                        <button
                            onClick={() => setShowSidebar(false)}
                            className={`p-1 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'}`}
                            title="Hide Sidebar"
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
                        {sortedQuestions.length === 0 ? (
                            <p className={`text-center text-sm py-10 ${textSecondary}`}>No questions yet.</p>
                        ) : (
                            sortedQuestions.map((q, idx) => (
                                <div
                                    key={q._id}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`p-3 rounded-xl cursor-pointer border transition-all ${idx === currentIndex ? itemActive : itemIdle}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-xs font-bold leading-none px-2 py-1 rounded ${isDark ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>#{idx + 1}</span>
                                        <div className="flex items-center space-x-2">
                                            {q.isAnswered && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                                            <span className={`flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${isDark ? 'text-sky-400 bg-sky-900/30' : 'text-sky-600 bg-sky-100'}`}><ThumbsUp className="w-3 h-3 mr-1" /> {q.upvotes.length}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm line-clamp-2 leading-relaxed">{q.text}</p>
                                </div>
                            ))
                        )}
                    </div>

                    <div className={`p-4 border-t shrink-0 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                        <button
                            onClick={() => navigate(`/qna/${token}`)}
                            className={`w-full text-sm font-medium transition flex justify-center items-center py-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                        >
                            <XCircle className="w-4 h-4 mr-2" /> Exit Presentation
                        </button>
                    </div>
                </div>
            )}

            {/* Main Presentation Area */}
            <div className={`flex-1 flex flex-col relative bg-gradient-to-br order-1 md:order-2 overflow-y-auto w-full ${bgMain}`}>

                {/* Header Overlay */}
                <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-start z-10 pointer-events-none">
                    {!showSidebar && (
                        <button
                            onClick={() => setShowSidebar(true)}
                            className={`p-3 backdrop-blur rounded-xl transition pointer-events-auto border ${navOverlayBg}`}
                            title="Show Sidebar"
                        >
                            <LayoutGrid className="w-6 h-6" />
                        </button>
                    )}

                    <div className={`flex flex-col sm:flex-row gap-3 pointer-events-auto items-end sm:items-center ${!showSidebar ? 'ml-auto' : 'ml-auto'}`}>
                        <button
                            onClick={toggleTheme}
                            className={`p-2.5 sm:p-3 backdrop-blur rounded-xl transition border shadow-sm ${navOverlayBg}`}
                            title="Toggle Theme"
                        >
                            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>

                        <div className={`backdrop-blur px-3 sm:px-4 py-2 border rounded-xl flex flex-col sm:flex-row items-end sm:items-center shadow-md ${isDark ? 'bg-indigo-600/20 border-indigo-500/30' : 'bg-white/80 border-indigo-200'}`}>
                            <span className={`text-xs sm:text-sm font-medium ${isDark ? 'text-indigo-200' : 'text-indigo-600'}`}>Live Q&A: </span>
                            <span className={`text-sm sm:text-base font-bold sm:ml-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{window.location.host}/qna/{token}</span>
                        </div>
                    </div>
                </div>

                {/* Content Centered - Wraps to flex-col to place mobile buttons under card */}
                <div className={`flex-1 flex flex-col items-center justify-center p-6 pt-28 pb-10 md:px-24 lg:px-32 relative z-0 ${showSidebar ? 'min-h-[50vh] md:min-h-full' : 'min-h-full'}`}>
                    {sortedQuestions.length === 0 ? (
                        <div className="text-center animate-in fade-in zoom-in duration-500">
                            <Monitor className={`w-16 h-16 md:w-24 md:h-24 mx-auto mb-6 ${emptyIconColor}`} />
                            <h1 className={`text-2xl md:text-4xl font-bold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Ready for Questions</h1>
                            <p className={`text-lg md:text-xl ${textSecondary}`}>Students can join using the link above</p>
                        </div>
                    ) : (
                        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-500 flex flex-col items-center" key={currentQuestion._id}>

                            <div className="w-full">
                                <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                                    <span className={`text-lg md:text-2xl font-black opacity-90 backdrop-blur-sm px-3 md:px-4 py-1 rounded-xl ${questionIndicatorText}`}>Q{currentIndex + 1}</span>
                                    <div className={`h-px flex-1 shadow-sm ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
                                    <div className={`flex items-center px-3 md:px-4 py-1.5 md:py-2 rounded-xl backdrop-blur ${isDark ? 'bg-slate-800/50 text-white' : 'bg-white border border-slate-200 text-slate-800 shadow-sm'}`}>
                                        <ThumbsUp className={`w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                                        <span className="text-base md:text-xl font-bold">{currentQuestion.upvotes.length} Votes</span>
                                    </div>
                                </div>

                                <div className={`p-6 md:p-10 lg:p-16 rounded-[2rem] md:rounded-[2.5rem] backdrop-blur-md transition-colors duration-500 relative ${currentQuestion.isAnswered ? answeredCardBg : cardBg}`}>
                                    <p className={`text-xl md:text-4xl lg:text-5xl font-medium leading-tight mb-8 md:mb-12 ${textPrimary}`} style={{ wordBreak: 'break-word' }}>
                                        "{currentQuestion.text}"
                                    </p>

                                    <div className="flex flex-wrap sm:flex-nowrap justify-between items-end gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 md:p-3 rounded-full flex-shrink-0 ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                                                <User className={`w-5 h-5 md:w-6 md:h-6 ${isDark ? 'text-slate-300' : 'text-slate-500'}`} />
                                            </div>
                                            <div>
                                                <p className={`text-lg md:text-xl font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                                    {board.allowAnonymous ? 'Anonymous' : currentQuestion.authorName}
                                                </p>
                                                <p className={`text-xs md:text-sm font-medium ${textSecondary}`}>{new Date(currentQuestion.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleToggleAnswered(currentQuestion._id, currentQuestion.isAnswered)}
                                            className={`flex items-center justify-center space-x-2 md:space-x-3 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-sm md:text-lg transition shadow-xl transform hover:scale-105 active:scale-95 whitespace-nowrap ${currentQuestion.isAnswered ? (isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100') : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-400 hover:to-purple-500'}`}
                                        >
                                            {currentQuestion.isAnswered ? (
                                                <><CheckCircle className="w-5 h-5 md:w-6 md:h-6" /> <span className="hidden sm:inline">Answered</span></>
                                            ) : (
                                                <><PlayCircle className="w-5 h-5 md:w-6 md:h-6" /> <span className="hidden sm:inline">Mark Answered</span></>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Buttons Row - Mobile */}
                            {sortedQuestions.length > 1 && (
                                <div className="flex md:hidden justify-center items-center w-full gap-5 mt-6 pb-2 shrink-0">
                                    <button
                                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                        disabled={currentIndex === 0}
                                        className={`p-3.5 rounded-full backdrop-blur border transform active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition shadow-sm ${navOverlayBg}`}
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-800'}`}>{currentIndex + 1} / {sortedQuestions.length}</span>
                                    <button
                                        onClick={() => setCurrentIndex(prev => Math.min(sortedQuestions.length - 1, prev + 1))}
                                        disabled={currentIndex === sortedQuestions.length - 1}
                                        className={`p-3.5 rounded-full backdrop-blur border transform active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition shadow-sm ${navOverlayBg}`}
                                    >
                                        <ChevronRight className="w-6 h-6" />
                                    </button>
                                </div>
                            )}

                        </div>
                    )}
                </div>

                {/* Navigation Overlays - Desktop */}
                {sortedQuestions.length > 1 && (
                    <div className="hidden md:block">
                        {currentIndex > 0 && (
                            <button
                                onClick={() => setCurrentIndex(prev => prev - 1)}
                                className={`absolute left-2 md:left-6 lg:left-12 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full backdrop-blur border transition transform hover:scale-110 active:scale-95 z-20 group ${navOverlayBg}`}
                            >
                                <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 group-hover:-translate-x-1 transition" />
                            </button>
                        )}

                        {currentIndex < sortedQuestions.length - 1 && (
                            <button
                                onClick={() => setCurrentIndex(prev => prev + 1)}
                                className={`absolute right-2 md:right-6 lg:right-12 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full backdrop-blur border transition transform hover:scale-110 active:scale-95 z-20 group ${navOverlayBg}`}
                            >
                                <ChevronRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-1 transition" />
                            </button>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default QnAPresentation;
