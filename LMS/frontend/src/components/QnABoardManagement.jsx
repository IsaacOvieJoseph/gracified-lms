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

    if (loading) return <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div></div>;

    return (
        <div className="bg-white rounded-lg shadow-md p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Q&A Boards</h3>
                    <p className="text-sm text-gray-500">Interactive question boards for your class topics</p>
                </div>
                {canEdit && (
                    <button
                        onClick={() => {
                            setFormData({ title: '', description: '', topicId: '', isPublic: false, allowAnonymous: false, isActive: true });
                            setIsEditing(false);
                            setShowModal(true);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Create Board</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {boards.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <MonitorPlay className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg">No Q&A boards yet.</p>
                        {canEdit && <p className="text-sm">Create one to engage with your students.</p>}
                    </div>
                ) : (
                    boards.map(board => (
                        <div key={board._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition group">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-gray-900 text-lg truncate" title={board.title}>{board.title}</h4>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full shrink-0 ${board.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                        {board.isActive ? 'Active' : 'Archived'}
                                    </span>
                                </div>

                                {board.topicId ? (
                                    <p className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block mb-3">
                                        Topic: {board.topicId.name}
                                    </p>
                                ) : (
                                    <p className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block mb-3">
                                        General Classroom
                                    </p>
                                )}

                                <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">{board.description || 'No description provided.'}</p>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleOpenNewWindow(`/qna/${board.shareableLink}`)}
                                        className="flex justify-center flex-1 items-center space-x-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition text-sm font-medium"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        <span>Join Q&A</span>
                                    </button>

                                    {canEdit && (
                                        <div className="flex justify-center items-center gap-2 mt-1">
                                            <button
                                                onClick={() => handleCopyLink(board.shareableLink)}
                                                className="flex-1 flex justify-center items-center space-x-1 px-2 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                                <span>Link</span>
                                            </button>
                                            <button
                                                onClick={() => handleOpenNewWindow(`/qna/${board.shareableLink}/present`)}
                                                className="flex-1 flex justify-center items-center space-x-1 px-2 py-1.5 text-xs text-white bg-slate-800 hover:bg-slate-900 rounded transition"
                                            >
                                                <MonitorPlay className="w-3.5 h-3.5" />
                                                <span>Present</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {canEdit && (
                                <div className="bg-gray-50 border-t border-gray-100 px-5 py-3 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(board)} className="text-blue-600 hover:text-blue-800 p-1 bg-white shadow-sm rounded">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(board._id)} className="text-red-600 hover:text-red-800 p-1 bg-white shadow-sm rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit Q&A Board' : 'Create Q&A Board'}</h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g., Week 1 Physics Questions"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                                <textarea
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    rows="3"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="What is this Q&A about?"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Related Topic (Optional)</label>
                                <select
                                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    value={formData.topicId}
                                    onChange={e => setFormData({ ...formData, topicId: e.target.value })}
                                >
                                    <option value="">-- General Classroom --</option>
                                    {classroom.topics?.map(t => (
                                        <option key={t._id} value={t._id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-3 pt-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <label className="flex items-center group cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                        checked={formData.allowAnonymous}
                                        onChange={e => setFormData({ ...formData, allowAnonymous: e.target.checked })}
                                    />
                                    <span className="ml-3 text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition">Allow Anonymous Questions</span>
                                </label>

                                <label className="flex items-center group cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                        checked={formData.isPublic}
                                        onChange={e => setFormData({ ...formData, isPublic: e.target.checked })}
                                    />
                                    <span className="ml-3 flex flex-col">
                                        <span className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition">Open to Public</span>
                                        <span className="text-xs text-gray-500">Anyone with the link can join, even without an account.</span>
                                    </span>
                                </label>

                                {isEditing && (
                                    <label className="flex items-center group cursor-pointer border-t border-gray-200 mt-2 pt-3">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                                            checked={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                        />
                                        <span className="ml-3 text-sm font-medium text-gray-800">Board is Active</span>
                                    </label>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-5 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 font-medium transition shadow-sm"
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
