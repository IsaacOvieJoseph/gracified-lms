import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, CheckCircle, Clock, Circle, Play, Flag, Book, Pencil, GripVertical, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ConfirmationModal from './ConfirmationModal';
import api from '../utils/api';

const TopicManagementModal = ({ show, onClose, classroomId, onSuccess }) => {
    const [topics, setTopics] = useState([]);
    const [currentTopic, setCurrentTopic] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingTopic, setEditingTopic] = useState(null);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        lessonsOutline: '',
        duration: {
            mode: 'not_sure',
            value: 1
        },
        isPaid: false,
        price: 0
    });
    const [showPaidTopics, setShowPaidTopics] = useState(false);
    const [classroom, setClassroom] = useState(null);

    // Progression states
    const [showProgressionModal, setShowProgressionModal] = useState(false);
    const [topicToComplete, setTopicToComplete] = useState(null);
    const [nextTopic, setNextTopic] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [topicToDelete, setTopicToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (show && classroomId) {
            fetchTopics();
            fetchCurrentTopic();
            fetchClassroomDetails();
        }
    }, [show, classroomId]);

    const fetchTopics = async () => {
        try {
            const response = await api.get(`/topics/classroom/${classroomId}`);
            setTopics(response.data.topics || []);
        } catch (error) {
            console.error('Error fetching topics:', error);
        }
    };

    const fetchCurrentTopic = async () => {
        try {
            const response = await api.get(`/topics/classroom/${classroomId}/current`);
            setCurrentTopic(response.data.currentTopic);
        } catch (error) {
            console.error('Error fetching current topic:', error);
        }
    };

    const fetchClassroomDetails = async () => {
        try {
            const response = await api.get(`/classrooms/${classroomId}`);
            setClassroom(response.data.classroom);
            setShowPaidTopics(response.data.showPaidTopics);
        } catch (error) {
            setClassroom(null);
            setShowPaidTopics(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                classroomId,
                order: editingTopic ? editingTopic.order : topics.length
            };

            if (editingTopic) {
                await api.put(`/topics/${editingTopic._id}`, payload);
                toast.success('Topic updated successfully!');
            } else {
                await api.post('/topics', payload);
                toast.success('Topic created successfully!');
            }

            resetForm();
            fetchTopics();
            fetchCurrentTopic();
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving topic');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (topicId) => {
        setTopicToDelete(topicId);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!topicToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/topics/${topicToDelete}`);
            toast.success('Topic deleted successfully!');
            setShowDeleteConfirm(false);
            setTopicToDelete(null);
            fetchTopics();
            fetchCurrentTopic();
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error deleting topic');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleActivate = async (topicId) => {
        try {
            await api.post(`/topics/${topicId}/activate`);
            toast.success('Topic activated!');
            fetchTopics();
            fetchCurrentTopic();
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error activating topic');
        }
    };

    const handleComplete = async (topicId) => {
        // Find next topic in order
        const currentIndex = topics.findIndex(t => t._id === topicId);
        const next = topics.find((t, i) => i > currentIndex && t.status === 'pending');

        if (next) {
            setTopicToComplete(topicId);
            setNextTopic(next);
            setShowProgressionModal(true);
        } else {
            // No next topic, just complete
            completeTopic(topicId, false);
        }
    };

    const completeTopic = async (topicId, activateNext) => {
        try {
            const response = await api.post(`/topics/${topicId}/complete`, { activateNext });
            toast.success(response.data.message);
            fetchTopics();
            fetchCurrentTopic();
            if (onSuccess) onSuccess();
            setShowProgressionModal(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error completing topic');
        }
    };

    const handleReactivate = async (topicId) => {
        try {
            await api.post(`/topics/${topicId}/reset`);
            toast.success('Topic reset to pending!');
            fetchTopics();
            fetchCurrentTopic();
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error resetting topic');
        }
    };

    // Drag and drop handlers
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, dropIndex) => {
        e.preventDefault();

        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            return;
        }

        const reorderedTopics = [...topics];
        const [draggedTopic] = reorderedTopics.splice(draggedIndex, 1);
        reorderedTopics.splice(dropIndex, 0, draggedTopic);

        // Update local state immediately for smooth UX
        setTopics(reorderedTopics);
        setDraggedIndex(null);

        // Send new order to backend
        try {
            const orderedIds = reorderedTopics.map(t => t._id);
            await api.put('/topics/reorder', { orderedIds });
            toast.success('Topics reordered!');
            fetchTopics(); // Refresh to get updated order from server
        } catch (error) {
            toast.error('Error reordering topics');
            fetchTopics(); // Revert on error
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            lessonsOutline: '',
            duration: { mode: 'not_sure', value: 1 },
            isPaid: false,
            price: 0
        });
        setEditingTopic(null);
        setShowCreateForm(false);
    };

    const openEditForm = (topic) => {
        setFormData({
            name: topic.name,
            description: topic.description || '',
            lessonsOutline: topic.lessonsOutline || '',
            duration: topic.duration || { mode: 'not_sure', value: 1 },
            isPaid: topic.isPaid || false,
            price: topic.price || 0
        });
        setEditingTopic(topic);
        setShowCreateForm(true);
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            case 'active':
                return <Clock className="w-5 h-5 text-blue-600 animate-pulse" />;
            default:
                return <Circle className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            completed: 'bg-green-100 text-green-800',
            active: 'bg-blue-100 text-blue-800',
            pending: 'bg-gray-100 text-gray-600'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.pending}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const getDurationText = (duration) => {
        if (!duration || duration.mode === 'not_sure') return 'Duration not set';
        return `${duration.value} ${duration.mode}${duration.value > 1 ? 's' : ''}`;
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] w-full max-w-4xl flex flex-col shadow-2xl animate-slide-up">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Topic Management</h2>
                            {currentTopic && (
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm text-slate-500">Current Topic</span>
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-bold">
                                        {currentTopic.name}
                                    </span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Create/Edit Form */}
                        {showCreateForm ? (
                            <form onSubmit={handleSubmit} className="bg-slate-50/50 rounded-3xl p-6 mb-8 border border-slate-100">
                                <h3 className="text-lg font-bold mb-6 text-slate-900">
                                    {editingTopic ? 'Edit Topic' : 'New Topic'}
                                </h3>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <label>Topic Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Introduction to Calculus"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full"
                                                required
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label>Description</label>
                                            <textarea
                                                placeholder="What will students learn in this topic?"
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full"
                                                rows="2"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label>Lesson Outline</label>
                                            <textarea
                                                placeholder="Briefly outline the lessons..."
                                                value={formData.lessonsOutline}
                                                onChange={(e) => setFormData({ ...formData, lessonsOutline: e.target.value })}
                                                className="w-full"
                                                rows="2"
                                            />
                                        </div>

                                        <div>
                                            <label>Duration Mode</label>
                                            <select
                                                value={formData.duration.mode}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    duration: { ...formData.duration, mode: e.target.value }
                                                })}
                                                className="w-full"
                                            >
                                                <option value="not_sure">Not Sure</option>
                                                <option value="day">Day(s)</option>
                                                <option value="week">Week(s)</option>
                                                <option value="month">Month(s)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label>Duration Value</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={formData.duration.value}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    duration: { ...formData.duration, value: parseInt(e.target.value) || 1 }
                                                })}
                                                className="w-full"
                                                disabled={formData.duration.mode === 'not_sure'}
                                            />
                                        </div>

                                        {showPaidTopics && (
                                            <div className="md:col-span-2 pt-2">
                                                <div className="flex items-center gap-6 p-4 bg-white rounded-2xl border border-slate-100">
                                                    <label className="flex items-center gap-3 mb-0 ml-0 cursor-pointer">
                                                        <div className={`w-10 h-6 flex items-center p-1 rounded-full transition-colors ${formData.isPaid ? 'bg-primary' : 'bg-slate-200'}`}>
                                                            <input
                                                                type="checkbox"
                                                                className="hidden"
                                                                checked={formData.isPaid}
                                                                onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                                                            />
                                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${formData.isPaid ? 'translate-x-4' : ''}`} />
                                                        </div>
                                                        <span className="font-bold text-slate-700">Paid Topic</span>
                                                    </label>
                                                    {formData.isPaid && (
                                                        <div className="flex-1 flex items-center gap-2">
                                                            <span className="font-bold text-slate-400">₦</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={formData.price}
                                                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                                                placeholder="Price"
                                                                className="flex-1"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-white transition"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn-premium flex-1"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingTopic ? 'Update Topic' : 'Create Topic')}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="w-full mb-8 p-4 rounded-2xl border-2 border-dashed border-primary/20 text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 font-bold group"
                            >
                                <div className="bg-primary/10 p-1.5 rounded-lg group-hover:scale-110 transition-transform">
                                    <Plus className="w-5 h-5" />
                                </div>
                                <span>New Course Topic</span>
                            </button>
                        )}

                        {/* Topics List */}
                        <div className="space-y-3">
                            {topics.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Book className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                    <p>No topics yet. Create your first topic to get started!</p>
                                </div>
                            ) : (
                                (() => {
                                    const activeIndex = topics.findIndex(t => t.status === 'active');
                                    let nextId = null;
                                    if (activeIndex !== -1) {
                                        const nextTopic = topics.find((t, i) => i > activeIndex && t.status === 'pending');
                                        if (nextTopic) nextId = nextTopic._id;
                                    } else {
                                        const firstPending = topics.find(t => t.status === 'pending');
                                        if (firstPending) nextId = firstPending._id;
                                    }

                                    return topics.map((topic, index) => {
                                        const isNext = topic._id === nextId;
                                        const isCurrent = topic.status === 'active';
                                        const isDone = topic.status === 'completed';
                                        const isPending = topic.status === 'pending' && !isNext;

                                        return (
                                            <div
                                                key={topic._id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDrop={(e) => handleDrop(e, index)}
                                                className={`bg-white border-2 rounded-lg p-4 transition-all cursor-move ${draggedIndex === index ? 'opacity-50 scale-95' : ''
                                                    } ${isCurrent ? 'border-blue-400 shadow-lg' :
                                                        isDone ? 'border-green-200 opacity-75' :
                                                            isNext ? 'border-indigo-300 shadow-md transform scale-[1.01]' :
                                                                'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start space-x-3 flex-1">
                                                        {/* Drag Handle */}
                                                        <div className="mt-1 text-gray-400 cursor-grab active:cursor-grabbing">
                                                            <GripVertical className="w-5 h-5" />
                                                        </div>

                                                        {/* Status Icon */}
                                                        <div className="mt-1">
                                                            {isDone ? (
                                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                                            ) : isCurrent ? (
                                                                <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
                                                            ) : isNext ? (
                                                                <Play className="w-5 h-5 text-indigo-600" />
                                                            ) : (
                                                                <Circle className="w-5 h-5 text-gray-400" />
                                                            )}
                                                        </div>

                                                        <div className="flex-1">
                                                            <div className="flex items-center space-x-2 mb-1">
                                                                <h4 className="font-semibold text-gray-800">{topic.name}</h4>
                                                                {isCurrent && (
                                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                                                        Current
                                                                    </span>
                                                                )}
                                                                {isDone && (
                                                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                                                        Done
                                                                    </span>
                                                                )}
                                                                {isNext && (
                                                                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-semibold">
                                                                        Next
                                                                    </span>
                                                                )}
                                                                {isPending && (
                                                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                                                                        Pending
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {topic.description && (
                                                                <p className="text-sm text-gray-600 mb-2">{topic.description}</p>
                                                            )}
                                                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                                                                <span className="flex items-center space-x-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    <span>{getDurationText(topic.duration)}</span>
                                                                </span>
                                                                {topic.isPaid && (
                                                                    <span className="text-green-600 font-semibold">₦{topic.price}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center space-x-2 ml-4">
                                                        {(topic.status === 'pending') && (
                                                            <button
                                                                onClick={() => handleActivate(topic._id)}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                                title="Activate Topic"
                                                            >
                                                                <Play className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {topic.status === 'active' && (
                                                            <button
                                                                onClick={() => handleComplete(topic._id)}
                                                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                                                title="Mark as Complete"
                                                            >
                                                                <Flag className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {topic.status === 'completed' && (
                                                            <button
                                                                onClick={() => handleReactivate(topic._id)}
                                                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                                                                title="Reactivate Topic"
                                                            >
                                                                <RotateCcw className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => openEditForm(topic)}
                                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                                            title="Edit Topic"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(topic._id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                            title="Delete Topic"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-6 border-t border-slate-50 bg-slate-50/50">
                        <div className="flex items-center justify-between text-sm text-slate-500 mb-6 font-medium">
                            <span className="flex items-center gap-2">
                                <GripVertical className="w-4 h-4 text-slate-300" />
                                <span>Drag topics to reorder curriculum</span>
                            </span>
                            <span className="bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm text-xs font-bold uppercase tracking-wider">{topics.length} Total Topics</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-200"
                        >
                            Done Managing
                        </button>
                    </div>
                </div>
            </div>

            {/* Progression Confirmation Modal */}
            {showProgressionModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110] overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-10 animate-slide-up text-center">
                            <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <CheckCircle className="w-12 h-12 text-emerald-500" />
                            </div>

                            <h3 className="text-3xl font-black text-slate-900 mb-2">Topic Milestone!</h3>
                            <p className="text-slate-500 font-medium mb-10 px-2 leading-relaxed">
                                Should the next topic <span className="text-primary font-bold">"{nextTopic?.name}"</span> become active immediately for all students?
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => completeTopic(topicToComplete, true)}
                                    className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-[0.98]"
                                >
                                    <Play className="w-6 h-6 fill-current" />
                                    <span>Yes, Activate Next</span>
                                </button>
                                <button
                                    onClick={() => completeTopic(topicToComplete, false)}
                                    className="w-full py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                                >
                                    <Clock className="w-5 h-5 text-slate-400" />
                                    <span>No, I'll Open Later</span>
                                </button>
                                <button
                                    onClick={() => setShowProgressionModal(false)}
                                    className="w-full pt-4 text-slate-400 text-xs font-black uppercase tracking-widest hover:text-slate-600 transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                show={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title="Delete Topic"
                message="Are you sure you want to delete this topic? All related assignments and student progress for this topic will be removed."
                confirmText="Delete"
                isLoading={isDeleting}
            />
        </div>
    );
};

export default TopicManagementModal;
