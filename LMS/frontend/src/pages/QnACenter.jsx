import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { MessageSquare, ThumbsUp, Send, User as UserIcon, CheckCircle, Clock, EyeOff } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout'; // Or we can use a minimalist layout like ExamCenter

const QnACenter = () => {
    const { token } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const isAdmin = user && ['teacher', 'personal_teacher', 'root_admin', 'school_admin'].includes(user.role);

    const [board, setBoard] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Submit new question
    const [newQuestion, setNewQuestion] = useState('');
    const [authorName, setAuthorName] = useState(user?.name || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stayAnonymous, setStayAnonymous] = useState(false);

    const fetchBoardAndQuestions = async (isInitial = false) => {
        try {
            const boardRes = await api.get(`/qna/join/${token}`);
            const boardData = boardRes.data;
            setBoard(boardData);

            const qRes = await api.get(`/qna/board/${boardData._id}/questions`);
            setQuestions(qRes.data);
        } catch (err) {
            if (isInitial) {
                toast.error('Board not found or inactive');
                navigate('/');
            } else {
                console.error('Network error during polling', err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBoardAndQuestions(true);

        // Polling for real-time feel
        const interval = setInterval(() => fetchBoardAndQuestions(false), 10000);
        return () => clearInterval(interval);
    }, [token]);

    const handleSubmitQuestion = async (e) => {
        e.preventDefault();
        if (!newQuestion.trim()) return;

        if (!user && !board.isPublic) {
            toast.error('Please login to ask a question in this board.');
            return;
        }

        if (!user && !board.allowAnonymous && !authorName.trim()) {
            toast.error('Please provide your name.');
            return;
        }

        setIsSubmitting(true);
        try {
            const finalAuthorName = user ? (stayAnonymous ? 'Anonymous' : user.name) : authorName;
            const finalAuthorId = user ? (stayAnonymous ? null : user._id) : null;
            await api.post(`/qna/board/${board._id}/questions`, {
                text: newQuestion,
                authorName: finalAuthorName,
                authorId: finalAuthorId
            });
            toast.success('Question posted!');
            setNewQuestion('');
            fetchBoardAndQuestions(false);
        } catch (err) {
            toast.error('Error posting question');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpvote = async (qId) => {
        try {
            // Use userId if logged in
            const payload = user ? { userId: user._id } : {};
            await api.put(`/qna/question/${qId}/upvote`, payload);
            fetchBoardAndQuestions();
        } catch (err) {
            toast.error('Error upvoting');
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
    if (!board) return null;

    const sortedQuestions = [...questions].sort((a, b) => b.upvotes.length - a.upvotes.length || new Date(b.createdAt) - new Date(a.createdAt));

    const displayQuestions = sortedQuestions.filter(q => {
        if (isAdmin) return true;
        if (!board.hideQuestions) return true;
        if (user && q.authorId === user._id) return true;
        return false;
    });

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3 w-full">
                        <div className="bg-indigo-100 p-2 rounded-lg shrink-0">
                            <MessageSquare className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="font-bold text-gray-900 truncate">{board.title}</h1>
                            <p className="text-xs text-gray-500 truncate">{board.classroomId?.name} {board.topicId ? `• ${board.topicId.name}` : ''}</p>
                        </div>
                    </div>
                    {user && (user.role === 'teacher' || user.role === 'personal_teacher' || user.role === 'root_admin' || user.role === 'school_admin') && (
                        <button
                            onClick={() => navigate(`/qna/${token}/present`)}
                            className="ml-4 shrink-0 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 transition"
                        >
                            Present Mode
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8">
                {board.description && (
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-100">
                        <p className="text-gray-700 text-lg">{board.description}</p>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Ask a Question</h2>
                    <form onSubmit={handleSubmitQuestion} className="space-y-4">
                        {!user && board.allowAnonymous && (
                            <div>
                                <input
                                    type="text"
                                    placeholder="Your Name (optional)"
                                    value={authorName}
                                    onChange={e => setAuthorName(e.target.value)}
                                    className="w-full sm:w-64 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        )}
                        {!user && !board.allowAnonymous && (
                            <div>
                                <input
                                    type="text"
                                    required
                                    placeholder="Your Name"
                                    value={authorName}
                                    onChange={e => setAuthorName(e.target.value)}
                                    className="w-full sm:w-64 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        )}
                        {user && board.allowAnonymous && (
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="stayAnonymous"
                                    checked={stayAnonymous}
                                    onChange={e => setStayAnonymous(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                />
                                <label htmlFor="stayAnonymous" className="text-sm font-medium text-gray-700 cursor-pointer">Stay anonymous</label>
                            </div>
                        )}
                        <div className="relative">
                            <textarea
                                required
                                rows="3"
                                value={newQuestion}
                                onChange={e => setNewQuestion(e.target.value)}
                                placeholder="What's on your mind?"
                                className="w-full border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 resize-none pr-16"
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="absolute bottom-3 right-3 bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition drop-shadow-md"
                            >
                                <Send className="w-5 h-5 text-white transform translate-x-px -translate-y-px" />
                            </button>
                        </div>
                    </form>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                        <h2 className="text-xl font-bold text-gray-900">Questions <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full ml-2">{displayQuestions.length}</span></h2>
                        {!isAdmin && board.hideQuestions && (
                            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded font-medium border border-indigo-100 shadow-sm flex items-center">
                                <EyeOff className="w-3.5 h-3.5 mr-1" />
                                Hidden to Class
                            </span>
                        )}
                    </div>

                    {displayQuestions.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">No questions yet. Be the first to ask!</p>
                        </div>
                    ) : (
                        displayQuestions.map(q => {
                            // Determine if current user has upvoted
                            const ident = user ? user._id : null; // Server uses IP if no user._id, but frontend can't know IP easily, so we just rely on visual refresh from server
                            const hasUpvoted = ident && q.upvotes.includes(ident);

                            return (
                                <div key={q._id} className={`bg-white rounded-xl p-5 shadow-sm border ${q.isAnswered ? 'border-green-300 bg-green-50/10' : 'border-gray-100'} transition flex gap-4`}>
                                    <div className="flex flex-col items-center">
                                        <button
                                            onClick={() => handleUpvote(q._id)}
                                            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition ${hasUpvoted ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                        >
                                            <ThumbsUp className={`w-5 h-5 mb-1 ${hasUpvoted ? 'fill-current' : ''}`} />
                                            <span className="text-xs">{q.upvotes.length}</span>
                                        </button>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <p className="text-gray-900 text-lg leading-snug whitespace-pre-wrap">{q.text}</p>
                                            {q.isAnswered && (
                                                <span className="shrink-0 flex items-center text-[10px] md:text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-lg ml-4">
                                                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Answered
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 md:gap-4 mt-3 text-[10px] md:text-xs text-gray-500">
                                            <div className="flex items-center">
                                                <UserIcon className="w-3.5 h-3.5 mr-1" />
                                                <span className="font-medium text-gray-700">
                                                    {(board.allowAnonymous && !isAdmin) ? 'Anonymous' : q.authorName}
                                                </span>
                                                {board.allowAnonymous && isAdmin && q.authorName !== 'Anonymous' && (
                                                    <span className="ml-2 text-[9px] font-bold tracking-wider uppercase bg-indigo-50 text-indigo-500 border border-indigo-100 px-1.5 py-0.5 rounded">
                                                        Anon to Class
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center">
                                                <Clock className="w-3.5 h-3.5 mr-1" />
                                                <span>{new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </main>
        </div>
    );
};

export default QnACenter;
