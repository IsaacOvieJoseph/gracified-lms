import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, LayoutGrid, Monitor, PlayCircle, ThumbsUp, User } from 'lucide-react';
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

        // Auto refresh every 10s to get new questions from students while presenting
        const interval = setInterval(() => fetchBoardAndQuestions(false), 10000);
        return () => clearInterval(interval);
    }, [token]);

    // Handle keyboard navigation
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

    // Real-time sort: prioritize upvotes, then timestamp
    const sortedQuestions = [...questions].sort((a, b) => b.upvotes.length - a.upvotes.length || new Date(b.createdAt) - new Date(a.createdAt));
    const currentQuestion = sortedQuestions[currentIndex];

    return (
        <div className="h-screen w-full bg-slate-900 text-white flex overflow-hidden font-sans">

            {/* Sidebar ListView */}
            {showSidebar && (
                <div className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col transition-all duration-300">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                        <h2 className="font-bold text-lg text-slate-100 truncate pr-2">{board.title}</h2>
                        <button
                            onClick={() => setShowSidebar(false)}
                            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
                        {sortedQuestions.length === 0 ? (
                            <p className="text-slate-500 text-center text-sm py-10">No questions yet.</p>
                        ) : (
                            sortedQuestions.map((q, idx) => (
                                <div
                                    key={q._id}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`p-3 rounded-xl cursor-pointer border transition-all ${idx === currentIndex ? 'bg-indigo-600/20 border-indigo-500/50 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold leading-none bg-slate-800/50 px-2 py-1 rounded text-slate-300">#{idx + 1}</span>
                                        <div className="flex items-center space-x-2">
                                            {q.isAnswered && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                                            <span className="flex items-center text-xs text-sky-400 font-bold bg-sky-900/30 px-1.5 py-0.5 rounded"><ThumbsUp className="w-3 h-3 mr-1" /> {q.upvotes.length}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm line-clamp-2 leading-relaxed">{q.text}</p>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-800 bg-slate-950 text-center">
                        <button
                            onClick={() => navigate(`/qna/${token}`)}
                            className="text-sm font-medium text-slate-400 hover:text-white transition flex justify-center items-center mx-auto"
                        >
                            <XCircle className="w-4 h-4 mr-2" /> Exit Presentation
                        </button>
                    </div>
                </div>
            )}

            {/* Main Presentation Area */}
            <div className="flex-1 flex flex-col relative bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950">

                {/* Header Overlay */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 pointer-events-none">
                    {!showSidebar && (
                        <button
                            onClick={() => setShowSidebar(true)}
                            className="p-3 bg-slate-800/50 hover:bg-slate-700 backdrop-blur rounded-xl text-slate-300 hover:text-white transition pointer-events-auto"
                            title="Show Sidebar"
                        >
                            <LayoutGrid className="w-6 h-6" />
                        </button>
                    )}
                    <div className="ml-auto flex space-x-4 pointer-events-auto">
                        <div className="bg-indigo-600/20 border border-indigo-500/30 backdrop-blur px-4 py-2 rounded-xl flex items-center shadow-lg">
                            <span className="text-sm font-medium text-indigo-200">Live Q&A: </span>
                            <span className="font-bold ml-2 text-white">{window.location.host}/qna/{token}</span>
                        </div>
                    </div>
                </div>

                {/* Content Centered */}
                <div className="flex-1 flex items-center justify-center p-6 md:px-24 lg:px-32 relative z-0">
                    {sortedQuestions.length === 0 ? (
                        <div className="text-center animate-in fade-in zoom-in duration-500">
                            <Monitor className="w-16 h-16 md:w-24 md:h-24 mx-auto text-slate-700 mb-6" />
                            <h1 className="text-2xl md:text-4xl font-bold text-slate-400 mb-2">Ready for Questions</h1>
                            <p className="text-lg md:text-xl text-slate-500">Students can join using the link above</p>
                        </div>
                    ) : (
                        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-500" key={currentQuestion._id}>

                            <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8 text-slate-400">
                                <span className="text-lg md:text-2xl font-black text-indigo-400 opacity-80 backdrop-blur-sm bg-indigo-900/30 px-3 md:px-4 py-1 rounded-xl">Q{currentIndex + 1}</span>
                                <div className="h-px bg-slate-700 flex-1"></div>
                                <div className="flex items-center bg-slate-800/50 px-3 md:px-4 py-1.5 md:py-2 rounded-xl backdrop-blur">
                                    <ThumbsUp className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3 text-sky-400" />
                                    <span className="text-base md:text-xl font-bold text-white">{currentQuestion.upvotes.length} Votes</span>
                                </div>
                            </div>

                            <div className={`p-6 md:p-10 lg:p-16 rounded-[2rem] md:rounded-[2.5rem] bg-slate-800/60 backdrop-blur-md border shadow-2xl transition-colors duration-500 ${currentQuestion.isAnswered ? 'border-emerald-500/50 shadow-emerald-500/10' : 'border-slate-700 shadow-black/50'}`}>
                                <p className="text-xl md:text-4xl lg:text-5xl font-medium leading-tight text-white mb-8 md:mb-12" style={{ wordBreak: 'break-word' }}>
                                    "{currentQuestion.text}"
                                </p>

                                <div className="flex flex-wrap sm:flex-nowrap justify-between items-end gap-4">
                                    <div className="flex items-center text-slate-400 gap-3">
                                        <div className="bg-slate-700/50 p-2 md:p-3 rounded-full flex-shrink-0">
                                            <User className="w-5 h-5 md:w-6 md:h-6 text-slate-300" />
                                        </div>
                                        <div>
                                            <p className="text-lg md:text-xl font-bold text-slate-200">{currentQuestion.authorName}</p>
                                            <p className="text-xs md:text-sm font-medium">{new Date(currentQuestion.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleToggleAnswered(currentQuestion._id, currentQuestion.isAnswered)}
                                        className={`flex items-center justify-center space-x-2 md:space-x-3 px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-sm md:text-lg transition shadow-xl transform hover:scale-105 active:scale-95 whitespace-nowrap ${currentQuestion.isAnswered ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/20' : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-400 hover:to-purple-500'}`}
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
                    )}
                </div>

                {/* Navigation Overlays */}
                {sortedQuestions.length > 0 && (
                    <>
                        {currentIndex > 0 && (
                            <button
                                onClick={() => setCurrentIndex(prev => prev - 1)}
                                className="absolute left-2 md:left-6 lg:left-12 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full bg-slate-800/40 hover:bg-slate-700 backdrop-blur text-white border border-slate-600/50 shadow-2xl transition transform hover:scale-110 active:scale-95 z-20 group"
                            >
                                <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 group-hover:-translate-x-1 transition" />
                            </button>
                        )}

                        {currentIndex < sortedQuestions.length - 1 && (
                            <button
                                onClick={() => setCurrentIndex(prev => prev + 1)}
                                className="absolute right-2 md:right-6 lg:right-12 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full bg-slate-800/40 hover:bg-slate-700 backdrop-blur text-white border border-slate-600/50 shadow-2xl transition transform hover:scale-110 active:scale-95 z-20 group"
                            >
                                <ChevronRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-1 transition" />
                            </button>
                        )}
                    </>
                )}

            </div>
        </div>
    );
};

export default QnAPresentation;
