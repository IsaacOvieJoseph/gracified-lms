import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
    X, Plus, Trash2, Loader2, CheckCircle, Clock, Circle, Play, Flag, Book, 
    Pencil, GripVertical, RotateCcw, Video, Upload, AlertCircle, 
    ChevronDown, ChevronUp, ArrowLeft, Link as LinkIcon, Sparkles, BookOpen, Layers, Zap, Lock,
    School
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Layout from '../components/Layout';
import ConfirmationModal from '../components/ConfirmationModal';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import FormFieldHelp from '../components/FormFieldHelp';
import AIAssistantPanel from '../components/AIAssistantPanel';

const TopicManagement = () => {
    const { id: classroomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [topics, setTopics] = useState([]);
    const [totalDuration, setTotalDuration] = useState('N/A');
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
    const [showAIPanel, setShowAIPanel] = useState(false);

    // Progression states
    const [showProgressionModal, setShowProgressionModal] = useState(false);
    const [topicToComplete, setTopicToComplete] = useState(null);
    const [nextTopic, setNextTopic] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [topicToDelete, setTopicToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Video upload/URL states
    const [videoUploadTopicId, setVideoUploadTopicId] = useState(null);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [removingVideoId, setRemovingVideoId] = useState(null);
    const [showUrlInput, setShowUrlInput] = useState(null); // stores topicId if showing input
    const [videoUrl, setVideoUrl] = useState('');

    useEffect(() => {
        if (classroomId) {
            fetchTopics();
            fetchCurrentTopic();
            fetchClassroomDetails();
        }
    }, [classroomId]);

    const fetchTopics = async () => {
        try {
            const response = await api.get(`/topics/classroom/${classroomId}`);
            const fetchedTopics = response.data.topics || [];
            setTopics(fetchedTopics);

            // Calculate total duration
            let totalDays = 0;
            fetchedTopics.forEach(t => {
                if (t.duration && t.duration.mode !== 'not_sure') {
                    const val = t.duration.value || 1;
                    if (t.duration.mode === 'day') totalDays += val;
                    if (t.duration.mode === 'week') totalDays += val * 7;
                    if (t.duration.mode === 'month') totalDays += val * 30;
                }
            });

            if (totalDays > 0) {
                const weeks = Math.ceil(totalDays / 7);
                setTotalDuration(`~${weeks} Week${weeks !== 1 ? 's' : ''}`);
            } else {
                setTotalDuration('N/A');
            }
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
        } catch (error) {
            let msg = error.response?.data?.message || 'Error saving topic';
            if (msg.includes('Cast to ObjectId failed') || msg.includes('BSONError')) {
                msg = 'Invalid data provided. Please check the classroom or other selected options.';
            } else if (msg.toLowerCase().includes('validation failed')) {
                msg = 'Some required fields are missing or invalid.';
            }
            toast.error(msg);
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
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error activating topic');
        }
    };

    const handleComplete = async (topicId) => {
        const currentIndex = topics.findIndex(t => t._id === topicId);
        const next = topics.find((t, i) => i > currentIndex && t.status === 'pending');

        if (next) {
            setTopicToComplete(topicId);
            setNextTopic(next);
            setShowProgressionModal(true);
        } else {
            completeTopic(topicId, false);
        }
    };

    const completeTopic = async (topicId, activateNext) => {
        try {
            const response = await api.post(`/topics/${topicId}/complete`, { activateNext });
            toast.success(response.data.message);
            fetchTopics();
            fetchCurrentTopic();
            setShowProgressionModal(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error completing topic');
        }
    };

    const handleApplySyllabus = async (topicsToImport) => {
        setLoading(true);
        try {
            await api.post(`/topics/bulk-create/${classroomId}`, { topics: topicsToImport });
            toast.success(`${topicsToImport.length} topics added to syllabus!`);
            fetchTopics();
            setShowAIPanel(false);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to apply syllabus');
        } finally {
            setLoading(false);
        }
    };

    const handleReactivate = async (topicId) => {
        try {
            await api.post(`/topics/${topicId}/reset`);
            toast.success('Topic reset to pending!');
            fetchTopics();
            fetchCurrentTopic();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error resetting topic');
        }
    };

    // Drag and drop for topics
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

        setTopics(reorderedTopics);
        setDraggedIndex(null);

        try {
            const orderedIds = reorderedTopics.map(t => t._id);
            await api.put('/topics/reorder', { orderedIds });
            toast.success('Topics reordered!');
            fetchTopics();
        } catch (error) {
            toast.error('Error reordering topics');
            fetchTopics();
        }
    };

    // Video URL handler
    const handleAddVideoUrl = async (topicId) => {
        if (!videoUrl) return;
        setUploadingVideo(true);
        try {
            await api.post(`/topics/${topicId}/add-video-url`, { url: videoUrl });
            toast.success('Video URL added!');
            setVideoUrl('');
            setShowUrlInput(null);
            fetchTopics();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding video URL');
        } finally {
            setUploadingVideo(false);
        }
    };

    // Video upload handlers
    const handleVideoFileChange = async (e, topicId) => {
        const file = e.target.files[0];
        if (!file) return;

        const maxSize = 500 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('Video file is too large. Maximum allowed size is 500 MB.');
            e.target.value = '';
            return;
        }

        setUploadingVideo(true);
        setUploadProgress(0);
        setVideoUploadTopicId(topicId);

        try {
            const formData = new FormData();
            formData.append('video', file);

            await new Promise((resolve, reject) => {
                const token = localStorage.getItem('token');
                const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const pct = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress(pct);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        try {
                            const err = JSON.parse(xhr.responseText);
                            reject(new Error(err.message || 'Upload failed'));
                        } catch {
                            reject(new Error('Upload failed'));
                        }
                    }
                });

                xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
                xhr.open('POST', `${baseURL}/topics/${topicId}/upload-video`);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(formData);
            });

            toast.success('Lecture video uploaded successfully!');
            fetchTopics();
        } catch (err) {
            toast.error(err.message || 'Error uploading video');
        } finally {
            setUploadingVideo(false);
            setUploadProgress(0);
            setVideoUploadTopicId(null);
            e.target.value = '';
        }
    };

    const handleRemoveVideo = async (topicId, videoId) => {
        setRemovingVideoId(`${topicId}-${videoId}`);
        try {
            await api.delete(`/topics/${topicId}/videos/${videoId}`);
            toast.success('Video removed successfully');
            fetchTopics();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error removing video');
        } finally {
            setRemovingVideoId(null);
        }
    };

    const handleReorderVideos = async (topicId, orderedVideoIds) => {
        try {
            await api.put(`/topics/${topicId}/videos/reorder`, { orderedVideoIds });
            toast.success('Videos reordered');
            fetchTopics();
        } catch (err) {
            toast.error('Error reordering videos');
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

    const getDurationText = (duration) => {
        if (!duration || duration.mode === 'not_sure') return 'Duration not set';
        return `${duration.value} ${duration.mode}${duration.value > 1 ? 's' : ''}`;
    };

    return (
        <Layout>
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                    <div className="flex items-center gap-5 w-full md:w-auto">
                        <button 
                            onClick={() => navigate(`/classrooms/${classroomId}`)}
                            className="w-14 h-14 flex items-center justify-center bg-card border border-border text-muted-foreground rounded-2xl hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1">Curriculum Builder</p>
                            <h1 className="text-4xl font-black text-foreground italic uppercase tracking-tighter">Manage Topics</h1>
                            {classroom && (
                                <p className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                    <School className="w-3 h-3" /> {classroom.name}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="bg-card border border-border p-4 rounded-3xl flex items-center gap-6 shadow-sm">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Modules</span>
                                <span className="text-xl font-black text-primary">{topics.length}</span>
                            </div>
                            <div className="w-px h-8 bg-border" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Duration</span>
                                <span className="text-xl font-black text-foreground italic">{totalDuration}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAIPanel(true)}
                            className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all active:scale-95"
                            title="AI Syllabus Assistant"
                        >
                            <Sparkles className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => { resetForm(); setShowCreateForm(true); }}
                            className="h-14 px-6 bg-primary text-white rounded-2xl flex items-center gap-3 shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95 font-black uppercase tracking-widest text-[10px]"
                        >
                            <Plus className="w-5 h-5" />
                            Add Topic
                        </button>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto">
                    {/* Creation/Editing Form Modal */}
                    {showCreateForm && (
                        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto py-10">
                            <div className="bg-card rounded-[3rem] p-10 shadow-2xl border border-border w-full max-w-2xl relative animate-in fade-in zoom-in duration-300">
                                <button 
                                    onClick={resetForm}
                                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-red-500 hover:text-white transition-all active:scale-95 z-10"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-5 mb-10">
                                    <div className="w-16 h-16 rounded-[1.25rem] bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 shadow-inner">
                                        {editingTopic ? <Pencil className="w-7 h-7" /> : <Plus className="w-8 h-8" />}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter italic mb-1">
                                            {editingTopic ? 'Edit Module' : 'New Module'}
                                        </h3>
                                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-50">Building your journey</p>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-muted-foreground mb-3 block tracking-widest italic opacity-60">Topic Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Introduction to Calculus"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-5 py-4 rounded-2xl bg-muted/50 border-2 border-border focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-foreground font-black italic tracking-tight placeholder:opacity-30 placeholder:italic"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-bold text-muted-foreground mb-2 block">Description</label>
                                        <textarea
                                            placeholder="What will students learn in this topic?"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-muted border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground"
                                            rows="3"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-bold text-muted-foreground mb-2 block">Lesson Outline</label>
                                        <textarea
                                            placeholder="Briefly outline the lessons..."
                                            value={formData.lessonsOutline}
                                            onChange={(e) => setFormData({ ...formData, lessonsOutline: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-muted border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground"
                                            rows="3"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-bold text-muted-foreground mb-2 flex items-center">
                                                Duration Mode
                                                <FormFieldHelp content="Choose a time unit (Days, Weeks, Months) to estimate the duration of this topic." />
                                            </label>
                                            <select
                                                value={formData.duration.mode}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    duration: { ...formData.duration, mode: e.target.value }
                                                })}
                                                className="w-full px-4 py-3 rounded-xl bg-muted border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground"
                                            >
                                                <option value="not_sure">Not Sure</option>
                                                <option value="day">Day(s)</option>
                                                <option value="week">Week(s)</option>
                                                <option value="month">Month(s)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-sm font-bold text-muted-foreground mb-2 block">Value</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={formData.duration.value}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    duration: { ...formData.duration, value: parseInt(e.target.value) || 1 }
                                                })}
                                                className="w-full px-4 py-3 rounded-xl bg-muted border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground"
                                                disabled={formData.duration.mode === 'not_sure'}
                                            />
                                        </div>
                                    </div>

                                    {showPaidTopics && (
                                        <div className="pt-2">
                                            <div className="flex items-center gap-6 p-4 bg-muted rounded-2xl border border-border">
                                                <label className="flex items-center gap-3 mb-0 ml-0 cursor-pointer">
                                                    <div className={`w-10 h-6 flex items-center p-1 rounded-full transition-colors ${formData.isPaid ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={formData.isPaid}
                                                            onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                                                        />
                                                        <div className={`bg-card w-4 h-4 rounded-full shadow-sm transition-transform ${formData.isPaid ? 'translate-x-4' : ''}`} />
                                                    </div>
                                                    <span className="font-bold text-foreground flex items-center">
                                                        Paid Topic
                                                        <FormFieldHelp content="If enabled, students must pay an individual fee to unlock this topic and its materials." />
                                                    </span>
                                                </label>
                                                {formData.isPaid && (
                                                    <div className="flex-1 flex items-center gap-2">
                                                        <span className="font-bold text-muted-foreground">₦</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={formData.price}
                                                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                                            placeholder="Price"
                                                            className="flex-1 px-3 py-1.5 rounded-lg bg-card border border-border text-foreground"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-4 pt-6">
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="flex-1 px-6 py-4 rounded-2xl border-2 border-border font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition-all active:scale-95"
                                        >
                                            CANCEL
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="btn-premium flex-1 py-4 flex items-center justify-center text-[10px]"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingTopic ? 'UPDATE' : 'CREATE')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Topics List */}
                    <div className="w-full">
                        <div className="space-y-6">
                            {topics.length === 0 ? (
                                <div className="text-center py-20 bg-card rounded-[2.5rem] border-2 border-dashed border-border">
                                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Book className="w-10 h-10 text-muted-foreground/30" />
                                    </div>
                                    <h4 className="text-xl font-bold text-foreground mb-2">No topics yet</h4>
                                    <p className="text-muted-foreground">Create your first topic to get started with the curriculum!</p>
                                </div>
                            ) : (
                                topics.map((topic, index) => {
                                    const isCurrent = topic.status === 'active';
                                    const isDone = topic.status === 'completed';
                                    const recordedVideos = topic.recordedVideos || [];
                                    const hasVideos = recordedVideos.length > 0;
                                    const isUploadingThis = uploadingVideo && videoUploadTopicId === topic._id;
                                    const isShowingUrlInput = showUrlInput === topic._id;

                                    return (
                                        <div
                                            key={topic._id}
                                            className={`relative pl-12 pb-12 last:pb-0 transition-all duration-300 ${draggedIndex === index ? 'opacity-30 scale-95' : 'opacity-100'}`}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDrop={(e) => handleDrop(e, index)}
                                            onDragEnd={() => setDraggedIndex(null)}
                                        >
                                            {/* Timeline Line */}
                                            {index !== topics.length - 1 && (
                                                <div className="absolute left-[23px] top-12 bottom-0 w-1 bg-gradient-to-b from-primary/20 to-transparent" />
                                            )}

                                            {/* Timeline Node */}
                                            <div className={`absolute left-0 top-1 w-12 h-12 rounded-2xl flex items-center justify-center z-10 border-4 border-card transition-all ${isCurrent ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/30' : isDone ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                                {isDone ? <CheckCircle className="w-6 h-6" /> : <span className="font-black italic">{index + 1}</span>}
                                            </div>

                                            <div className={`bg-card border-2 rounded-[2.5rem] p-8 transition-all group shadow-sm ${isCurrent ? 'border-primary shadow-2xl shadow-primary/10' : isDone ? 'border-emerald-500/20 opacity-80' : 'border-border hover:border-primary/20 hover:shadow-xl hover:shadow-muted/50'}`}>
                                                {/* Topic Header */}
                                                <div className="flex items-start justify-between gap-4 mb-8">
                                                    <div className="flex items-start gap-4 flex-1">
                                                        <div className="mt-1 text-muted-foreground/30 cursor-grab active:cursor-grabbing flex-shrink-0 group-hover:text-primary transition-colors">
                                                            <GripVertical className="w-6 h-6" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center flex-wrap gap-2 mb-3">
                                                                <h4 className="text-xl font-black text-foreground italic tracking-tighter uppercase">{topic.name}</h4>
                                                                {isCurrent && <span className="px-3 py-1 bg-primary text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">Active Lesson</span>}
                                                                {isDone && <span className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">Done</span>}
                                                                {hasVideos && (
                                                                    <span className="px-3 py-1 bg-muted border border-border text-foreground rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                                                        <Video className="w-2.5 h-2.5 text-primary" /> {recordedVideos.length} Assets
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-muted-foreground text-xs mb-4 line-clamp-2 italic font-black uppercase tracking-widest opacity-60 leading-relaxed">"{topic.description}"</p>
                                                            <div className="flex items-center gap-5 text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] italic">
                                                                <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-primary" /> {getDurationText(topic.duration)}</span>
                                                                {topic.isPaid && <span className="text-emerald-500 flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20"><AlertCircle className="w-3.5 h-3.5" /> ₦{topic.price}</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        {topic.status === 'pending' && (
                                                            <button onClick={() => handleActivate(topic._id)} className="p-2.5 text-primary hover:bg-primary/10 rounded-xl transition" title="Activate Topic"><Play className="w-5 h-5 fill-current" /></button>
                                                        )}
                                                        {isCurrent && (
                                                            <button onClick={() => handleComplete(topic._id)} className="p-2.5 text-emerald-600 hover:bg-emerald-500/10 rounded-xl transition" title="Mark Complete"><CheckCircle className="w-5 h-5" /></button>
                                                        )}
                                                        {isDone && (
                                                            <button onClick={() => handleReactivate(topic._id)} className="p-2.5 text-orange-600 hover:bg-orange-500/10 rounded-xl transition" title="Reactivate"><RotateCcw className="w-5 h-5" /></button>
                                                        )}
                                                        <button onClick={() => openEditForm(topic)} className="p-2.5 text-indigo-600 hover:bg-indigo-500/10 rounded-xl transition"><Pencil className="w-5 h-5" /></button>
                                                        <button onClick={() => handleDelete(topic._id)} className="p-2.5 text-red-600 hover:bg-red-500/10 rounded-xl transition"><Trash2 className="w-5 h-5" /></button>
                                                    </div>
                                                </div>

                                                {/* Video Management Section */}
                                                <div className="bg-muted/30 rounded-2xl p-6 border border-border">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <h5 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/40">Lecture Videos</h5>
                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={() => setShowUrlInput(isShowingUrlInput ? null : topic._id)}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isShowingUrlInput ? 'bg-primary text-white' : 'bg-card text-primary border border-primary/20 hover:bg-primary/5'}`}
                                                            >
                                                                <LinkIcon className="w-3 h-3" />
                                                                External URL
                                                                <FormFieldHelp content="Attach videos from external platforms like YouTube or Google Drive." />
                                                            </button>

                                                            {/* Premium Upload logic */}
                                                            {(() => {
                                                                const isPremium = user?.role === 'root_admin' || 
                                                                                  user?.subscriptionPlan?.name === 'Premium';
                                                                
                                                                if (isPremium) {
                                                                    return (
                                                                        <label className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border text-foreground/60 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer hover:bg-muted transition-all">
                                                                            <Upload className="w-3 h-3 text-primary" />
                                                                            Upload File
                                                                            <FormFieldHelp content="Securely upload video files directly to our cloud storage." />
                                                                            <input
                                                                                type="file"
                                                                                accept="video/*"
                                                                                className="hidden"
                                                                                onChange={(e) => handleVideoFileChange(e, topic._id)}
                                                                                disabled={uploadingVideo}
                                                                            />
                                                                        </label>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <div 
                                                                            className="flex items-center gap-2 px-3 py-1.5 bg-muted border border-border text-muted-foreground/40 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-not-allowed group relative"
                                                                            title="File upload is a Premium feature"
                                                                        >
                                                                            <Lock className="w-3 h-3" />
                                                                            Upload File
                                                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[8px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none font-black uppercase tracking-widest">
                                                                                Premium Plan Required
                                                                            </div>
                                                                            <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                                                                        </div>
                                                                    );
                                                                }
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* URL Input Form */}
                                                    {isShowingUrlInput && (
                                                        <div className="mb-6 p-4 bg-muted/50 rounded-xl border border-primary/20 animate-in slide-in-from-top-2">
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="url"
                                                                    placeholder="Paste video URL (YouTube, Drive, etc.)"
                                                                    value={videoUrl}
                                                                    onChange={(e) => setVideoUrl(e.target.value)}
                                                                    className="flex-1 px-4 py-2 rounded-lg bg-card border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                                                                />
                                                                <button 
                                                                    onClick={() => handleAddVideoUrl(topic._id)}
                                                                    disabled={!videoUrl || uploadingVideo}
                                                                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50"
                                                                >
                                                                    Add
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isUploadingThis && (
                                                        <div className="mb-6 space-y-2">
                                                            <div className="flex justify-between text-[10px] font-black uppercase text-primary">
                                                                <span>Uploading...</span>
                                                                <span>{uploadProgress}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-primary/10 rounded-full overflow-hidden">
                                                                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {hasVideos ? (
                                                        <div className="space-y-3">
                                                            {[...recordedVideos].sort((a,b) => (a.order||0) - (b.order||0)).map((vid, vIdx, arr) => {
                                                                const isRemoving = removingVideoId === `${topic._id}-${vid._id}`;
                                                                return (
                                                                    <div key={vid._id} className="flex items-center gap-4 bg-card p-3 rounded-xl border border-border group/vid">
                                                                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-muted-foreground font-black text-xs">
                                                                            {vIdx + 1}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-sm font-bold text-foreground truncate">{vid.label}</span>
                                                                                {vid.videoType === 'url' ? (
                                                                                    <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[8px] font-black uppercase tracking-widest">URL</span>
                                                                                ) : (
                                                                                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[8px] font-black uppercase tracking-widest">FILE</span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{vid.originalName || vid.url}</p>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 opacity-0 group-hover/vid:opacity-100 transition-opacity">
                                                                            <button 
                                                                                disabled={vIdx === 0}
                                                                                onClick={() => {
                                                                                    const newOrder = arr.map(v => v._id);
                                                                                    [newOrder[vIdx], newOrder[vIdx-1]] = [newOrder[vIdx-1], newOrder[vIdx]];
                                                                                    handleReorderVideos(topic._id, newOrder);
                                                                                }}
                                                                                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors disabled:opacity-10"
                                                                            >
                                                                                <ChevronUp className="w-4 h-4" />
                                                                            </button>
                                                                            <button 
                                                                                disabled={vIdx === arr.length - 1}
                                                                                onClick={() => {
                                                                                    const newOrder = arr.map(v => v._id);
                                                                                    [newOrder[vIdx], newOrder[vIdx+1]] = [newOrder[vIdx+1], newOrder[vIdx]];
                                                                                    handleReorderVideos(topic._id, newOrder);
                                                                                }}
                                                                                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors disabled:opacity-10"
                                                                            >
                                                                                <ChevronDown className="w-4 h-4" />
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleRemoveVideo(topic._id, vid._id)}
                                                                                className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                                                                            >
                                                                                {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="py-8 text-center border-2 border-dashed border-border rounded-xl bg-card/50">
                                                            <Video className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
                                                            <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">No lectures attached</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Progression Modal */}
            {showProgressionModal && (
                <div className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
                    <div className="bg-card rounded-[2.5rem] shadow-2xl max-w-md w-full p-10 animate-slide-up text-center border border-border">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h3 className="text-2xl font-black text-foreground mb-2">Topic Complete!</h3>
                        <p className="text-muted-foreground font-medium mb-8">
                            Should the next topic <span className="text-primary font-bold">"{nextTopic?.name}"</span> be activated immediately?
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => completeTopic(topicToComplete, true)} className="py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg shadow-primary/20">Yes, Activate</button>
                            <button onClick={() => completeTopic(topicToComplete, false)} className="py-4 bg-muted text-muted-foreground rounded-2xl font-bold hover:bg-muted/80 transition">Not Yet</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Topic Modal */}
            <ConfirmationModal
                show={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title="Delete Topic"
                message="Are you sure you want to delete this topic? This cannot be undone."
                confirmText="Delete"
                isLoading={isDeleting}
            />
            <AIAssistantPanel
                isOpen={showAIPanel}
                onClose={() => setShowAIPanel(false)}
                allowedModes={['syllabus', 'topic', 'powerpoint']}
                defaultMode="syllabus"
                prefill={{
                    className: classroom?.name || '',
                    subject: classroom?.subject || '',
                    description: classroom?.description || '',
                    outcomes: classroom?.learningOutcomes || '',
                    topicName: formData.name || '',
                    teacherHint: formData.description || '',
                }}
                onApply={(data) => {
                    if (data.topics) {
                        // Handle syllabus import
                        handleApplySyllabus(data.topics);
                    } else {
                        // Handle single topic import
                        setFormData(prev => ({
                            ...prev,
                            name: data.name || prev.name,
                            description: data.description || prev.description,
                            lessonsOutline: data.lessonsOutline || prev.lessonsOutline,
                            duration: data.duration || prev.duration,
                        }));
                        setShowCreateForm(true);
                        setShowAIPanel(false);
                    }
                }}
            />
        </Layout>
    );
};

export default TopicManagement;
