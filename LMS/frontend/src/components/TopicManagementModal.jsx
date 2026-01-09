import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, CheckCircle, Clock, Circle, Play, Flag, Book, Pencil, GripVertical, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
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
        duration: {
            mode: 'not_sure',
            value: 1
        },
        isPaid: false,
        price: 0
    });

    useEffect(() => {
        if (show && classroomId) {
            fetchTopics();
            fetchCurrentTopic();
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

    const handleDelete = async (topicId) => {
        if (!window.confirm('Are you sure you want to delete this topic?')) return;

        try {
            await api.delete(`/topics/${topicId}`);
            toast.success('Topic deleted successfully!');
            fetchTopics();
            fetchCurrentTopic();
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error deleting topic');
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
        try {
            const response = await api.post(`/topics/${topicId}/complete`);
            toast.success(`Topic completed! ${response.data.nextTopic ? `Next: ${response.data.nextTopic.name}` : 'No more topics.'}`);
            fetchTopics();
            fetchCurrentTopic();
            if (onSuccess) onSuccess();
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Topic Management</h2>
                        {currentTopic && (
                            <p className="text-sm text-gray-600 mt-1">
                                Current: <span className="font-semibold text-indigo-600">{currentTopic.name}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Create/Edit Form */}
                    {showCreateForm ? (
                        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-6 mb-6 border-2 border-indigo-200">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">
                                {editingTopic ? 'Edit Topic' : 'Create New Topic'}
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Topic Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        rows="3"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Duration Mode</label>
                                        <select
                                            value={formData.duration.mode}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                duration: { ...formData.duration, mode: e.target.value }
                                            })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        >
                                            <option value="not_sure">Not Sure</option>
                                            <option value="day">Day(s)</option>
                                            <option value="week">Week(s)</option>
                                            <option value="month">Month(s)</option>
                                            <option value="year">Year(s)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Duration Value</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.duration.value}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                duration: { ...formData.duration, value: parseInt(e.target.value) || 1 }
                                            })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            disabled={formData.duration.mode === 'not_sure'}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-4">
                                    <label className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.isPaid}
                                            onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Paid Topic</span>
                                    </label>

                                    {formData.isPaid && (
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                            placeholder="Price"
                                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="flex space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingTopic ? 'Update Topic' : 'Create Topic')}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="w-full mb-6 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition flex items-center justify-center space-x-2 font-semibold"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Add New Topic</span>
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
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                        <span className="flex items-center space-x-2">
                            <GripVertical className="w-4 h-4" />
                            <span>Drag topics to reorder</span>
                        </span>
                        <span>{topics.length} topic{topics.length !== 1 ? 's' : ''}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TopicManagementModal;

