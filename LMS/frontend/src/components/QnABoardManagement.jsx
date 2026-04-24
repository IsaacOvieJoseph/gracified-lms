import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ExternalLink, Link as LinkIcon, Eye, Copy, MonitorPlay } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

const QnABoardManagement = ({ classroomId, classroom, user, canEdit }) => {
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        topicId: '',
        isPublic: false,
        allowAnonymous: false,
        hideQuestions: false,
        isActive: true
    });
    const [selectedBoardId, setSelectedBoardId] = useState(null);

    const fetchBoards = async () => {
        try {
            const { data } = await api.get(`/qna/classroom/${classroomId}`);
            setBoards(data);
        } catch (err) {
            toast.error('Failed to load Q&A boards');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBoards();
    }, [classroomId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await api.put(`/qna/board/${selectedBoardId}`, formData);
                toast.success('Q&A board updated!');
            } else {
                await api.post('/qna/board', { ...formData, classroomId });
                toast.success('Q&A board created!');
            }
            setShowModal(false);
            fetchBoards();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error occurred');
        }
    };

    const handleEdit = (board) => {
        setFormData({
            title: board.title,
            description: board.description || '',
            topicId: board.topicId?._id || '',
            isPublic: board.isPublic,
            allowAnonymous: board.allowAnonymous,
            hideQuestions: board.hideQuestions || false,
            isActive: board.isActive
        });
        setSelectedBoardId(board._id);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this Q&A board?')) {
            try {
                await api.delete(`/qna/board/${id}`);
                toast.success('Board deleted');
                fetchBoards();
            } catch (err) {
                toast.error('Error deleting board');
            }
        }
    };

    const handleCopyLink = (token) => {
        const url = `${window.location.origin}/qna/${token}`;
        navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
    };

    const handleOpenNewWindow = (url) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    if (loading) return <div className="flex items-center justify-center p-12"><div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" /></div>;

    return (
        <div className="bg-card border border-border border-t-0 rounded-b-2xl shadow-lg p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary mb-1">Q&A Boards</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Interactive question boards for your class topics</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => {
                            setFormData({ title: '', description: '', topicId: '', isPublic: false, allowAnonymous: false, hideQuestions: false, isActive: true });
                            setIsEditing(false);
                            setShowModal(true);
                        }}
                        className="flex items-center space-x-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 transition font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Create Board</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {boards.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-muted/10 rounded-3xl border-2 border-dashed border-border/50">
                        <MonitorPlay className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">No Q&A boards yet.</p>
                        {canEdit && <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">Create one to engage with your students.</p>}
                    </div>
                ) : (
                    boards.map(board => (
                        <div key={board._id} className="bg-muted/20 rounded-2xl border border-border overflow-hidden hover:bg-muted/40 transition-colors group">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-black text-foreground italic uppercase tracking-tight text-lg truncate" title={board.title}>{board.title}</h4>
                                    <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded text-primary border border-primary/20 bg-primary/10 shrink-0 ${board.isActive ? '' : 'opacity-50'}`}>
                                        {board.isActive ? 'Active' : 'Archived'}
                                    </span>
                                </div>

                                {board.topicId ? (
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border border-border/50 bg-muted px-2 py-1 rounded inline-block mb-3">
                                        Topic: {board.topicId.name}
                                    </p>
                                ) : (
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border border-border/50 bg-muted px-2 py-1 rounded inline-block mb-3">
                                        General Classroom
                                    </p>
                                )}

                                <p className="text-sm font-medium text-muted-foreground line-clamp-2 mb-4 h-10 italic">{board.description || 'No description provided.'}</p>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleOpenNewWindow(`/qna/${board.shareableLink || board._id}`)}
                                        className="flex justify-center flex-1 items-center space-x-1.5 px-3 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary/20 transition text-[10px] font-black uppercase tracking-widest"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Join Q&A</span>
                                    </button>

                                    {canEdit && (
                                        <div className="flex justify-center items-center gap-2 mt-1">
                                            <button
                                                onClick={() => handleCopyLink(board.shareableLink || board._id)}
                                                className="flex-1 flex justify-center items-center space-x-1 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition"
                                            >
                                                <Copy className="w-3 h-3" />
                                                <span>Link</span>
                                            </button>
                                            <button
                                                onClick={() => handleOpenNewWindow(`/qna/${board.shareableLink || board._id}/present`)}
                                                className="flex-1 flex justify-center items-center space-x-1 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition"
                                            >
                                                <MonitorPlay className="w-3 h-3" />
                                                <span>Present</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {canEdit && (
                                <div className="bg-muted/40 border-t border-border px-5 py-3 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(board)} className="text-muted-foreground hover:text-primary p-1.5 bg-muted rounded-lg transition">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(board._id)} className="text-rose-500/70 hover:text-rose-500 p-1.5 bg-rose-500/10 rounded-lg transition">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-card border border-border rounded-[3rem] w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200">
                        <div className="p-8 pb-4">
                            <h2 className="text-3xl font-black italic tracking-tighter text-foreground uppercase">{isEditing ? 'Edit Q&A' : 'Create Q&A'}</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 pt-0 space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Title *</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground focus:border-primary transition-all outline-none"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g., Week 1 Physics Questions"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Description</label>
                                <textarea
                                    className="w-full min-h-[100px] bg-muted/50 border-2 border-border p-4 rounded-2xl font-medium text-foreground focus:border-primary transition-all outline-none italic"
                                    rows="3"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="What is this Q&A about?"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Related Topic (Optional)</label>
                                <select
                                    className="w-full bg-muted/50 border-2 border-border p-4 rounded-2xl font-bold text-foreground focus:border-primary transition-all outline-none"
                                    value={formData.topicId}
                                    onChange={e => setFormData({ ...formData, topicId: e.target.value })}
                                >
                                    <option value="">-- General Classroom --</option>
                                    {classroom.topics?.map(t => (
                                        <option key={t._id} value={t._id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-4 pt-4 bg-muted/30 p-6 rounded-[2rem] border border-border">
                                <label className="flex items-center group cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-primary border-border rounded focus:ring-primary cursor-pointer accent-primary"
                                        checked={formData.allowAnonymous}
                                        onChange={e => setFormData({ ...formData, allowAnonymous: e.target.checked })}
                                    />
                                    <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition">Allow Anonymous Questions</span>
                                </label>

                                <label className="flex items-center group cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-primary border-border rounded focus:ring-primary cursor-pointer accent-primary"
                                        checked={formData.isPublic}
                                        onChange={e => setFormData({ ...formData, isPublic: e.target.checked })}
                                    />
                                    <span className="ml-3 flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition">Open to Public</span>
                                        <span className="text-[9px] font-bold text-muted-foreground/50">Anyone with the link can join, even without an account.</span>
                                    </span>
                                </label>

                                <label className="flex items-center group cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-primary border-border rounded focus:ring-primary cursor-pointer accent-primary"
                                        checked={formData.hideQuestions}
                                        onChange={e => setFormData({ ...formData, hideQuestions: e.target.checked })}
                                    />
                                    <span className="ml-3 flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition">Hide questions from others</span>
                                        <span className="text-[9px] font-bold text-muted-foreground/50">Students will only be able to see their own questions.</span>
                                    </span>
                                </label>

                                {isEditing && (
                                    <label className="flex items-center group cursor-pointer border-t border-border mt-4 pt-4">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 text-emerald-500 border-border rounded focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                                            checked={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                        />
                                        <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Board is Active</span>
                                    </label>
                                )}
                            </div>

                            <div className="flex gap-4 pt-4 sticky bottom-0 bg-card">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-3 rounded-2xl border border-border font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-premium flex-1"
                                >
                                    {isEditing ? 'Save Changes' : 'Create Board'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QnABoardManagement;
