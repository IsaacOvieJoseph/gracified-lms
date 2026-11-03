import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
    X, Plus, Trash2, Loader2, CheckCircle, Clock, Play, Book,
    Pencil, GripVertical, RotateCcw, Video, Upload, AlertCircle,
    ChevronDown, ChevronUp, ArrowLeft, Link as LinkIcon, Sparkles, Layers, Lock,
    School
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Layout from '../components/Layout';
import ConfirmationModal from '../components/ConfirmationModal';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import FormFieldHelp from '../components/FormFieldHelp';
import AIAssistantPanel from '../components/AIAssistantPanel';
import { consumeGracyPrefill } from '../utils/gracyPrefill';

// ─── Flat record card primitives (ClassRecord design language) ──────────────
const INK = 'hsl(var(--foreground))';
const NAVY = 'hsl(var(--primary))';
const SLATE = 'hsl(var(--muted-foreground))';
const HAIRLINE = 'hsl(var(--border))';
const PAPER = 'hsl(var(--card))';
const PANEL = 'hsl(var(--muted))';
const GOLD = 'hsl(var(--gold))';
const FOREST = 'hsl(var(--success))';
const ROSE = 'hsl(var(--danger))';

const primaryActionStyle = { backgroundColor: NAVY, color: PAPER, borderRadius: 'var(--radius)' };
const outlineActionStyle = { backgroundColor: PAPER, color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: 'var(--radius)' };

function RecordField({ icon: Icon, label, children, borderRight }) {
    return (
        <div className={`flex items-start gap-3 px-5 py-4 min-w-0 ${borderRight ? 'sm:border-r sm:border-border' : ''}`}>
            <Icon size={17} strokeWidth={1.75} style={{ color: SLATE, marginTop: 2 }} />
            <div className="min-w-0">
                <div className="text-xs" style={{ color: SLATE }}>{label}</div>
                <div className="text-sm font-semibold mt-0.5 break-words" style={{ color: INK }}>{children}</div>
            </div>
        </div>
    );
}

function IconAction({ icon: Icon, label, onClick, tone = 'default', disabled, loading }) {
    const tones = {
        default: { color: INK, border: HAIRLINE },
        primary: { color: NAVY, border: 'hsl(var(--primary) / 0.35)' },
        success: { color: FOREST, border: 'hsl(var(--success) / 0.35)' },
        warning: { color: GOLD, border: 'hsl(var(--gold) / 0.35)' },
        danger: { color: ROSE, border: 'hsl(var(--danger) / 0.35)' },
    };
    const t = tones[tone] || tones.default;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            className="flex items-center justify-center w-9 h-9 transition-colors hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: `1px solid ${t.border}`, backgroundColor: PAPER, color: t.color, borderRadius: 'var(--radius)' }}
        >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} strokeWidth={2} />}
        </button>
    );
}

const TopicManagement = () => {
    const { id: classroomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [topics, setTopics] = useState([]);
    const [totalDuration, setTotalDuration] = useState('N/A');
    const [currentTopic, setCurrentTopic] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingTopics, setLoadingTopics] = useState(true);
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
        } else {
            setLoadingTopics(false);
        }
    }, [classroomId]);

    // Gracy → create-form handoff: seed the topic form or bulk-apply a syllabus.
    useEffect(() => {
        const topicPrefill = consumeGracyPrefill('topic');
        if (topicPrefill) {
            setFormData((prev) => ({
                ...prev,
                name: topicPrefill.name || prev.name,
                description: topicPrefill.description || prev.description,
                lessonsOutline: topicPrefill.lessonsOutline || prev.lessonsOutline,
                duration: prev.duration
                    ? {
                        ...prev.duration,
                        ...(topicPrefill.duration && typeof topicPrefill.duration === 'object'
                            ? { mode: topicPrefill.duration.mode, value: typeof topicPrefill.duration.value === 'number' ? topicPrefill.duration.value : prev.duration.value }
                            : {}),
                    }
                    : prev.duration,
            }));
            setShowCreateForm(true);
        }
        const syllabusPrefill = consumeGracyPrefill('syllabus');
        if (syllabusPrefill && Array.isArray(syllabusPrefill.topics) && syllabusPrefill.topics.length) {
            handleApplySyllabus(syllabusPrefill.topics);
            toast.success('AI syllabus ready — adding topics to this class…');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchTopics = async () => {
        setLoadingTopics(true);
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
        } finally {
            setLoadingTopics(false);
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
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}` }}>
                    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                        <div className="flex items-start gap-4 min-w-0">
                            <button
                                onClick={() => navigate(`/classrooms/${classroomId}`)}
                                className="flex items-center justify-center w-9 h-9 shrink-0 transition-colors hover:bg-muted"
                                style={outlineActionStyle}
                                aria-label="Back to classroom"
                            >
                                <ArrowLeft size={15} style={{ color: INK }} />
                            </button>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <School size={13} style={{ color: SLATE }} />
                                    <span className="text-xs font-semibold truncate" style={{ color: SLATE }}>
                                        {classroom?.name || 'Classroom'}
                                    </span>
                                </div>
                                <h1 className="font-serif text-[26px] font-semibold leading-tight" style={{ color: INK }}>Manage topics</h1>
                                <p className="text-sm mt-1" style={{ color: SLATE }}>Build, order and publish the syllabus for this class.</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setShowAIPanel(true)}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                                style={outlineActionStyle}
                                title="AI Syllabus Assistant"
                            >
                                <Sparkles size={15} style={{ color: NAVY }} />
                                <span className="hidden sm:inline">Generate topics</span>
                                <span className="sm:hidden">AI</span>
                            </button>
                            <button
                                onClick={() => { resetForm(); setShowCreateForm(true); }}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                                style={primaryActionStyle}
                            >
                                <Plus size={16} />
                                Add topic
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                        <RecordField icon={Layers} label="Modules" borderRight>
                            {loadingTopics
                                ? <span className="inline-block w-8 h-5 rounded bg-muted animate-pulse" />
                                : topics.length}
                        </RecordField>
                        <RecordField icon={Clock} label="Total duration" borderRight>
                            {loadingTopics
                                ? <span className="inline-block w-16 h-5 rounded bg-muted animate-pulse" />
                                : totalDuration}
                        </RecordField>
                        <RecordField icon={Play} label="Current topic">
                            {currentTopic?.name || 'None active'}
                        </RecordField>
                    </div>
                </div>

                <div className="w-full">
                    {/* Creation/Editing Form Modal */}
                    {showCreateForm && (
                        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-start justify-center p-4 overflow-y-auto py-10">
                            <div className="w-full max-w-2xl relative animate-in fade-in zoom-in-95 duration-200" style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: 'var(--radius)' }}>
                                <div className="flex items-start justify-between gap-4 px-6 py-5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                                    <div>
                                        <h2 className="font-serif text-[22px] font-semibold" style={{ color: INK }}>
                                            {editingTopic ? 'Edit topic' : 'New topic'}
                                        </h2>
                                        <p className="text-sm mt-1" style={{ color: SLATE }}>
                                            {editingTopic ? 'Update the details of this syllabus module.' : 'Add a module to this class syllabus.'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={resetForm}
                                        className="flex items-center justify-center w-9 h-9 shrink-0 transition-colors hover:bg-muted"
                                        style={outlineActionStyle}
                                        aria-label="Close"
                                    >
                                        <X size={16} style={{ color: INK }} />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
                                    <div>
                                        <label className="text-xs font-semibold tracking-wide">Topic name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Introduction to Calculus"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold tracking-wide">Description</label>
                                        <textarea
                                            placeholder="What will students learn in this topic?"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full"
                                            rows="3"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold tracking-wide">Lesson outline</label>
                                        <textarea
                                            placeholder="Briefly outline the lessons..."
                                            value={formData.lessonsOutline}
                                            onChange={(e) => setFormData({ ...formData, lessonsOutline: e.target.value })}
                                            className="w-full"
                                            rows="3"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold tracking-wide flex items-center">
                                                Duration mode
                                                <FormFieldHelp content="Choose a time unit (Days, Weeks, Months) to estimate the duration of this topic." />
                                            </label>
                                            <select
                                                value={formData.duration.mode}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    duration: { ...formData.duration, mode: e.target.value }
                                                })}
                                                className="w-full"
                                            >
                                                <option value="not_sure">Not sure</option>
                                                <option value="day">Day(s)</option>
                                                <option value="week">Week(s)</option>
                                                <option value="month">Month(s)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold tracking-wide">Value</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={formData.duration.value}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    duration: { ...formData.duration, value: parseInt(e.target.value) || 1 }
                                                })}
                                                className="w-full disabled:opacity-50"
                                                disabled={formData.duration.mode === 'not_sure'}
                                            />
                                        </div>
                                    </div>

                                    {showPaidTopics && (
                                        <div className="pt-1">
                                            <div className="flex flex-wrap items-center gap-4 p-4" style={{ backgroundColor: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 'var(--radius)' }}>
                                                <label
                                                    onClick={() => setFormData({ ...formData, isPaid: !formData.isPaid })}
                                                    className="flex items-center justify-between gap-4 cursor-pointer mb-0 ml-0 flex-1 min-w-[180px]"
                                                >
                                                    <span className="text-sm font-semibold flex items-center" style={{ color: INK }}>
                                                        Paid topic
                                                        <FormFieldHelp content="If enabled, students must pay an individual fee to unlock this topic and its materials." />
                                                    </span>
                                                    <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${formData.isPaid ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.isPaid ? 'translate-x-4' : ''}`} />
                                                    </div>
                                                </label>
                                                {formData.isPaid && (
                                                    <div className="flex items-center gap-2 min-w-[140px]">
                                                        <span className="text-sm font-semibold" style={{ color: SLATE }}>₦</span>
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

                                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="flex-1 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                                            style={outlineActionStyle}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-1 px-5 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                                            style={primaryActionStyle}
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingTopic ? 'Save changes' : 'Create topic')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Topics List */}
                    <div className="w-full">
                        <div className="space-y-4">
                            {loadingTopics ? (
                                <div className="text-center py-16" style={{ backgroundColor: PAPER, border: `1px dashed ${HAIRLINE}`, borderRadius: 'var(--radius)' }}>
                                    <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: NAVY }} />
                                    <p className="text-sm" style={{ color: SLATE }}>Loading topics...</p>
                                </div>
                            ) : topics.length === 0 ? (
                                <div className="text-center py-16" style={{ backgroundColor: PAPER, border: `1px dashed ${HAIRLINE}`, borderRadius: 'var(--radius)' }}>
                                    <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: PANEL, borderRadius: 'var(--radius)' }}>
                                        <Book size={24} style={{ color: SLATE, opacity: 0.5 }} />
                                    </div>
                                    <h3 className="font-serif text-[20px] font-semibold" style={{ color: INK }}>No topics yet</h3>
                                    <p className="text-sm mt-1" style={{ color: SLATE }}>Create your first topic to get started with the curriculum.</p>
                                </div>
                            ) : (
                                topics.map((topic, index) => {
                                    const isCurrent = topic.status === 'active';
                                    const isDone = topic.status === 'completed';
                                    const recordedVideos = topic.recordedVideos || [];
                                    const hasVideos = recordedVideos.length > 0;
                                    const isUploadingThis = uploadingVideo && videoUploadTopicId === topic._id;
                                    const isShowingUrlInput = showUrlInput === topic._id;
                                    const nodeColor = isCurrent ? NAVY : isDone ? FOREST : PANEL;
                                    const nodeText = isCurrent || isDone ? PAPER : SLATE;

                                    return (
                                        <div
                                            key={topic._id}
                                            className={`relative pl-14 pb-1 last:pb-0 transition-all duration-300 ${draggedIndex === index ? 'opacity-40' : 'opacity-100'}`}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDrop={(e) => handleDrop(e, index)}
                                            onDragEnd={() => setDraggedIndex(null)}
                                        >
                                            {/* Timeline Line */}
                                            {index !== topics.length - 1 && (
                                                <div className="absolute left-[19px] top-12 bottom-0 w-px" style={{ backgroundColor: HAIRLINE }} />
                                            )}

                                            {/* Timeline Node */}
                                            <div
                                                className="absolute left-0 top-4 w-10 h-10 flex items-center justify-center z-10"
                                                style={{
                                                    backgroundColor: nodeColor,
                                                    color: nodeText,
                                                    border: `1px solid ${isCurrent ? NAVY : isDone ? FOREST : HAIRLINE}`,
                                                    borderRadius: 'var(--radius)',
                                                }}
                                            >
                                                {isDone ? <CheckCircle size={18} /> : <span className="text-sm font-semibold">{index + 1}</span>}
                                            </div>

                                            <div className="overflow-hidden group" style={{ backgroundColor: PAPER, border: `1px solid ${isCurrent ? 'hsl(var(--primary) / 0.5)' : HAIRLINE}`, borderRadius: 'var(--radius)' }}>
                                                <div style={{ height: '3px', backgroundColor: isCurrent ? NAVY : isDone ? FOREST : HAIRLINE }} />
                                                {/* Topic Header */}
                                                <div className="flex items-start justify-between gap-4 px-5 py-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        <div className="mt-1 cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors" style={{ color: SLATE }}>
                                                            <GripVertical size={16} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center flex-wrap gap-2 mb-1.5">
                                                                <h3 className="font-serif text-[18px] font-semibold leading-snug" style={{ color: INK }}>{topic.name}</h3>
                                                                {isCurrent && (
                                                                    <span className="text-[10px] font-semibold px-2 py-0.5" style={{ color: PAPER, backgroundColor: NAVY, borderRadius: 'var(--radius)' }}>Active</span>
                                                                )}
                                                                {isDone && (
                                                                    <span className="text-[10px] font-semibold px-2 py-0.5" style={{ color: FOREST, border: '1px solid hsl(var(--success) / 0.35)', backgroundColor: 'hsl(var(--success) / 0.12)', borderRadius: 'var(--radius)' }}>Completed</span>
                                                                )}
                                                                {hasVideos && (
                                                                    <span className="text-[10px] font-semibold px-2 py-0.5 flex items-center gap-1" style={{ color: SLATE, border: `1px solid ${HAIRLINE}`, backgroundColor: PANEL, borderRadius: 'var(--radius)' }}>
                                                                        <Video size={11} /> {recordedVideos.length} video{recordedVideos.length !== 1 ? 's' : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {topic.description && (
                                                                <p className="text-sm line-clamp-2 mb-3 leading-relaxed" style={{ color: SLATE }}>{topic.description}</p>
                                                            )}
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" style={{ color: SLATE }}>
                                                                <span className="flex items-center gap-1.5"><Clock size={13} /> {getDurationText(topic.duration)}</span>
                                                                {topic.isPaid && (
                                                                    <span className="flex items-center gap-1.5 px-2 py-0.5 font-semibold" style={{ color: GOLD, border: '1px solid hsl(var(--gold) / 0.35)', backgroundColor: 'hsl(var(--gold) / 0.12)', borderRadius: 'var(--radius)' }}>
                                                                        <AlertCircle size={12} /> ₦{topic.price}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {topic.status === 'pending' && (
                                                            <IconAction icon={Play} label="Activate topic" tone="primary" onClick={() => handleActivate(topic._id)} />
                                                        )}
                                                        {isCurrent && (
                                                            <IconAction icon={CheckCircle} label="Mark complete" tone="success" onClick={() => handleComplete(topic._id)} />
                                                        )}
                                                        {isDone && (
                                                            <IconAction icon={RotateCcw} label="Reset topic" tone="warning" onClick={() => handleReactivate(topic._id)} />
                                                        )}
                                                        <IconAction icon={Pencil} label="Edit topic" onClick={() => openEditForm(topic)} />
                                                        <IconAction icon={Trash2} label="Delete topic" tone="danger" onClick={() => handleDelete(topic._id)} />
                                                    </div>
                                                </div>

                                                {/* Video Management Section */}
                                                <div className="px-5 py-4" style={{ backgroundColor: PANEL }}>
                                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                                        <h5 className="text-xs font-semibold tracking-wide" style={{ color: SLATE }}>Lecture videos</h5>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <button
                                                                onClick={() => setShowUrlInput(isShowingUrlInput ? null : topic._id)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
                                                                style={isShowingUrlInput ? primaryActionStyle : outlineActionStyle}
                                                            >
                                                                <LinkIcon size={12} />
                                                                External URL
                                                                <FormFieldHelp content="Attach videos from external platforms like YouTube or Google Drive." />
                                                            </button>

                                                            {/* Premium Upload logic */}
                                                            {(() => {
                                                                const isPremium = user?.role === 'root_admin' ||
                                                                                  user?.subscriptionPlan?.name === 'Premium';

                                                                if (isPremium) {
                                                                    return (
                                                                        <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors hover:bg-muted" style={outlineActionStyle}>
                                                                            <Upload size={12} style={{ color: NAVY }} />
                                                                            Upload file
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
                                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-not-allowed group/premium relative"
                                                                            style={{ color: SLATE, border: `1px solid ${HAIRLINE}`, backgroundColor: PAPER, borderRadius: 'var(--radius)' }}
                                                                            title="File upload is a Premium feature"
                                                                        >
                                                                            <Lock size={12} />
                                                                            Upload file
                                                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] py-1 px-2 rounded opacity-0 group-hover/premium:opacity-100 transition whitespace-nowrap pointer-events-none" style={{ backgroundColor: INK, color: PAPER }}>
                                                                                Premium plan required
                                                                            </div>
                                                                            <Sparkles size={12} style={{ color: GOLD }} />
                                                                        </div>
                                                                    );
                                                                }
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* URL Input Form */}
                                                    {isShowingUrlInput && (
                                                        <div className="mb-4 p-3 animate-in slide-in-from-top-2" style={{ backgroundColor: PAPER, border: `1px solid hsl(var(--primary) / 0.3)`, borderRadius: 'var(--radius)' }}>
                                                            <div className="flex flex-col sm:flex-row gap-2">
                                                                <input
                                                                    type="url"
                                                                    placeholder="Paste video URL (YouTube, Drive, etc.)"
                                                                    value={videoUrl}
                                                                    onChange={(e) => setVideoUrl(e.target.value)}
                                                                    className="flex-1"
                                                                />
                                                                <button
                                                                    onClick={() => handleAddVideoUrl(topic._id)}
                                                                    disabled={!videoUrl || uploadingVideo}
                                                                    className="px-4 py-2 text-sm font-semibold disabled:opacity-50"
                                                                    style={primaryActionStyle}
                                                                >
                                                                    Add
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isUploadingThis && (
                                                        <div className="mb-4 space-y-2">
                                                            <div className="flex justify-between text-xs font-semibold" style={{ color: NAVY }}>
                                                                <span>Uploading...</span>
                                                                <span>{uploadProgress}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--primary) / 0.15)' }}>
                                                                <div className="h-full transition-all duration-300" style={{ width: `${uploadProgress}%`, backgroundColor: NAVY }} />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {hasVideos ? (
                                                        <div className="space-y-2">
                                                            {[...recordedVideos].sort((a,b) => (a.order||0) - (b.order||0)).map((vid, vIdx, arr) => {
                                                                const isRemoving = removingVideoId === `${topic._id}-${vid._id}`;
                                                                return (
                                                                    <div key={vid._id} className="flex items-center gap-3 p-2.5 group/vid" style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: 'var(--radius)' }}>
                                                                        <div className="w-8 h-8 flex items-center justify-center text-xs font-semibold shrink-0" style={{ backgroundColor: PANEL, color: SLATE, borderRadius: 'var(--radius)' }}>
                                                                            {vIdx + 1}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-sm font-semibold truncate" style={{ color: INK }}>{vid.label}</span>
                                                                                <span className="px-1.5 py-0.5 text-[9px] font-semibold tracking-wide shrink-0" style={vid.videoType === 'url' ? { color: SLATE, backgroundColor: PANEL, borderRadius: 'var(--radius)' } : { color: NAVY, backgroundColor: 'hsl(var(--primary) / 0.1)', borderRadius: 'var(--radius)' }}>
                                                                                    {vid.videoType === 'url' ? 'URL' : 'FILE'}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs truncate mt-0.5" style={{ color: SLATE }}>{vid.originalName || vid.url}</p>
                                                                        </div>
                                                                        <div className="flex items-center gap-0.5 opacity-60 sm:opacity-0 group-hover/vid:opacity-100 transition-opacity">
                                                                            <button
                                                                                disabled={vIdx === 0}
                                                                                onClick={() => {
                                                                                    const newOrder = arr.map(v => v._id);
                                                                                    [newOrder[vIdx], newOrder[vIdx-1]] = [newOrder[vIdx-1], newOrder[vIdx]];
                                                                                    handleReorderVideos(topic._id, newOrder);
                                                                                }}
                                                                                className="p-1.5 transition-colors hover:bg-muted disabled:opacity-20"
                                                                                style={{ color: SLATE, borderRadius: 'var(--radius)' }}
                                                                                aria-label="Move video up"
                                                                            >
                                                                                <ChevronUp size={15} />
                                                                            </button>
                                                                            <button
                                                                                disabled={vIdx === arr.length - 1}
                                                                                onClick={() => {
                                                                                    const newOrder = arr.map(v => v._id);
                                                                                    [newOrder[vIdx], newOrder[vIdx+1]] = [newOrder[vIdx+1], newOrder[vIdx]];
                                                                                    handleReorderVideos(topic._id, newOrder);
                                                                                }}
                                                                                className="p-1.5 transition-colors hover:bg-muted disabled:opacity-20"
                                                                                style={{ color: SLATE, borderRadius: 'var(--radius)' }}
                                                                                aria-label="Move video down"
                                                                            >
                                                                                <ChevronDown size={15} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleRemoveVideo(topic._id, vid._id)}
                                                                                className="p-1.5 transition-colors hover:bg-muted"
                                                                                style={{ color: ROSE, borderRadius: 'var(--radius)' }}
                                                                                aria-label="Remove video"
                                                                            >
                                                                                {isRemoving ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="py-6 text-center" style={{ border: `1px dashed ${HAIRLINE}`, backgroundColor: PAPER, borderRadius: 'var(--radius)' }}>
                                                            <Video size={18} className="mx-auto mb-1.5" style={{ color: SLATE, opacity: 0.4 }} />
                                                            <p className="text-xs" style={{ color: SLATE }}>No lectures attached</p>
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
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
                    <div className="max-w-md w-full p-8 animate-slide-up text-center" style={{ backgroundColor: PAPER, border: `1px solid ${HAIRLINE}`, borderRadius: 'var(--radius)' }}>
                        <div className="w-14 h-14 flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'hsl(var(--success) / 0.12)', borderRadius: 'var(--radius)' }}>
                            <CheckCircle size={28} style={{ color: FOREST }} />
                        </div>
                        <h3 className="font-serif text-[22px] font-semibold mb-2" style={{ color: INK }}>Topic complete</h3>
                        <p className="text-sm mb-7 leading-relaxed" style={{ color: SLATE }}>
                            Should the next topic <span className="font-semibold" style={{ color: NAVY }}>&ldquo;{nextTopic?.name}&rdquo;</span> be activated immediately?
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => completeTopic(topicToComplete, true)} className="py-2.5 text-sm font-semibold transition-opacity hover:opacity-90" style={primaryActionStyle}>Yes, activate</button>
                            <button onClick={() => completeTopic(topicToComplete, false)} className="py-2.5 text-sm font-semibold transition-colors hover:bg-muted" style={outlineActionStyle}>Not yet</button>
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
