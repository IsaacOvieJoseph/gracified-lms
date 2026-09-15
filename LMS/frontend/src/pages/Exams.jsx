import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
    Calendar,
    Clock,
    Users,
    Globe,
    Lock,
    Eye,
    Copy,
    Share2,
    Play,
    Plus,
    Search,
    Edit,
    Trash2,
    BarChart2,
    ChevronRight,
    TrendingUp,
    Award,
    BookOpen
} from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { formatDisplayDate } from '../utils/timezone';
import ConfirmationModal from '../components/ConfirmationModal';

const Exams = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [examToDelete, setExamToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchExams();
    }, []);

    const fetchExams = async () => {
        try {
            const response = await api.get('/exams');
            setExams(response.data);
        } catch (error) {
            toast.error('Failed to fetch exams');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id) => {
        setExamToDelete(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!examToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/exams/${examToDelete}`);
            toast.success('Exam deleted');
            fetchExams();
            setShowDeleteModal(false);
        } catch (error) {
            toast.error('Failed to delete exam');
        } finally {
            setIsDeleting(false);
            setExamToDelete(null);
        }
    };

    const copyLink = (exam) => {
        const identifier = exam.linkToken || exam._id;
        const link = `${window.location.origin}/exam-center/${identifier}`;
        navigator.clipboard.writeText(link);
        toast.success('Exam link copied to clipboard!');
    };

    const filteredExams = exams.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Layout>
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold text-foreground tracking-tight">
                            {user.role === 'student' ? (
                                <>School <span className="text-primary not-italic">Assessments</span></>
                            ) : (
                                <>Exam <span className="text-primary not-italic">Center</span></>
                            )}
                        </h1>
                        <p className="text-muted-foreground font-semibold text-xs tracking-wide mt-1 opacity-60">
                            {user.role === 'student'
                                ? 'View and take your assigned exams.'
                                : 'Create and manage standardized exams and secure share-links.'}
                        </p>
                    </div>
                    {user.role !== 'student' && (
                        <button
                            onClick={() => navigate('/exams/create')}
                            className="btn-premium px-8 py-3 rounded-xl flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            <span>New Exam</span>
                        </button>
                    )}
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card p-6 rounded-xl border border-border flex items-center space-x-4 shadow-none group hover:border-primary/40 transition-all">
                        <div className="bg-primary/10 p-3 rounded-xl text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground tracking-wide opacity-60">
                                {user.role === 'student' ? 'Pending Exams' : 'Total Exams'}
                            </p>
                            <h3 className="text-2xl font-semibold text-foreground tracking-tight">
                                {user.role === 'student'
                                    ? exams.filter(e => e.submissionStatus === 'not-started').length
                                    : exams.length}
                            </h3>
                        </div>
                    </div>
                    <div className="bg-card p-6 rounded-xl border border-border flex items-center space-x-4 shadow-none group hover:border-emerald-500/40 transition-all">
                        <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-500 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground tracking-wide opacity-60">
                                {user.role === 'student' ? 'Completed Exams' : 'Active Exams'}
                            </p>
                            <h3 className="text-2xl font-semibold text-foreground tracking-tight">
                                {user.role === 'student'
                                    ? exams.filter(e => e.submissionStatus !== 'not-started').length
                                    : exams.filter(e => e.isPublished).length}
                            </h3>
                        </div>
                    </div>
                    <div className="bg-card p-6 rounded-xl border border-border flex items-center space-x-4 shadow-none group hover:border-purple-500/40 transition-all">
                        <div className="bg-purple-500/10 p-3 rounded-xl text-purple-500 border border-purple-500/20 group-hover:scale-110 transition-transform">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground tracking-wide opacity-60">
                                {user.role === 'student' ? 'Average Score' : 'Global Access'}
                            </p>
                            <h3 className="text-2xl font-semibold text-foreground tracking-tight">
                                {user.role === 'student'
                                    ? (exams.filter(e => e.score !== null).reduce((acc, curr) => acc + curr.score, 0) / Math.max(exams.filter(e => e.score !== null).length, 1)).toFixed(1) + '%'
                                    : 'Active'}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Search & Filter */}
                <div className="bg-card p-4 rounded-xl border border-border shadow-none">
                    <div className="relative group">
                        <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-muted-foreground/40 w-5 h-5 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter exams..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-muted border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30 text-sm font-semibold tracking-wide text-foreground"
                        />
                    </div>
                </div>

                {/* Exams Table/List */}
                <div className="bg-card rounded-xl border border-border shadow-none overflow-hidden">
                    {loading ? (
                        <div className="p-24 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-6 text-muted-foreground font-semibold text-xs tracking-wide opacity-40">Loading Exams...</p>
                        </div>
                    ) : filteredExams.length > 0 ? (
                        <div className="overflow-x-auto font-inter">
                            <table className="w-full text-left">
                                <thead className="bg-muted border-b border-border">
                                    <tr>
                                        <th className="px-8 py-5 text-xs font-semibold text-muted-foreground tracking-wide">Exam Title</th>
                                        <th className="px-8 py-5 text-xs font-semibold text-muted-foreground tracking-wide">Access Mode</th>
                                        <th className="px-8 py-5 text-xs font-semibold text-muted-foreground tracking-wide">Status</th>
                                        <th className="px-8 py-5 text-xs font-semibold text-muted-foreground tracking-wide text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredExams.map((exam) => (
                                        <tr key={exam._id} className="hover:bg-muted transition-all group">
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors tracking-tight">{exam.title}</span>
                                                    <span className="text-[11px] text-muted-foreground mt-1 line-clamp-1 font-semibold tracking-wide opacity-60">{exam.description || 'No description available'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="space-y-3">
                                                    <div className="flex items-center">
                                                        {exam.accessMode === 'open' ? (
                                                            <div className="flex items-center px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-xl text-xs font-semibold tracking-wide border border-emerald-500/20">
                                                                <Globe className="w-3 h-3 mr-1.5" /> Public Link
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center px-3 py-1 bg-amber-500/10 text-amber-500 rounded-xl text-xs font-semibold tracking-wide border border-amber-500/20">
                                                                <Lock className="w-3 h-3 mr-1.5" /> Private
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center text-xs font-semibold text-muted-foreground tracking-wide opacity-60">
                                                        <Clock className="w-4 h-4 mr-2 text-primary" />
                                                        <span>{exam.duration} Minutes</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                {user.role === 'student' ? (
                                                    <div className={`inline-flex items-center px-4 py-1.5 rounded-xl text-xs font-semibold tracking-wide border shadow-none ${exam.submissionStatus === 'graded'
                                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                        : exam.submissionStatus === 'submitted'
                                                            ? 'bg-primary/10 text-primary border-primary/20'
                                                            : 'bg-muted text-muted-foreground border-border'
                                                        }`}>
                                                        <span className={`w-2 h-2 rounded-full mr-2 ${exam.submissionStatus === 'graded' ? 'bg-emerald-500 shadow-none' :
                                                            exam.submissionStatus === 'submitted' ? 'bg-primary shadow-none' : 'bg-muted-foreground/30'
                                                            }`}></span>
                                                        {exam.submissionStatus === 'graded' ? `${exam.score}% Score` :
                                                            exam.submissionStatus === 'submitted' ? 'Submitted' : 'Pending'}
                                                    </div>
                                                ) : (
                                                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${exam.isPublished
                                                        ? 'bg-primary/10 text-primary border-primary/20 shadow-none'
                                                        : 'bg-muted text-muted-foreground border-border'
                                                        }`}>
                                                        <span className={`w-2 h-2 rounded-full mr-2 ${exam.isPublished ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`}></span>
                                                        {exam.isPublished ? 'Active' : 'Draft'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end space-x-3">
                                                    {user.role === 'student' ? (
                                                        <>
                                                            {exam.submissionStatus === 'not-started' ? (
                                                                <Link
                                                                    to={`/exam-center/${exam.linkToken || exam._id}`}
                                                                    className="px-6 py-2 bg-primary text-white rounded-xl font-semibold text-xs tracking-wide hover:bg-primary/90 transition-all flex items-center space-x-2 shadow-none "
                                                                >
                                                                    <span>Take Exam</span>
                                                                    <Play className="w-4 h-4 fill-current" />
                                                                </Link>
                                                            ) : (
                                                                <Link
                                                                    to={`/exam-center/${exam.linkToken || exam._id}`}
                                                                    className="px-6 py-2 bg-muted text-muted-foreground rounded-xl font-semibold text-xs tracking-wide hover:bg-muted/80 transition-all flex items-center space-x-2 border border-border"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                    <span>View Score</span>
                                                                </Link>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => copyLink(exam)}
                                                                className="p-2.5 text-primary hover:bg-primary/10 rounded-xl transition-all border border-border/50"
                                                                title="Copy Link"
                                                            >
                                                                <Share2 className="w-5 h-5" />
                                                            </button>
                                                            <Link
                                                                to={`/exams/edit/${exam._id}`}
                                                                className="p-2.5 text-amber-500 hover:bg-amber-500/10 rounded-xl transition-all border border-border/50"
                                                                title="Edit Exam"
                                                            >
                                                                <Edit className="w-5 h-5" />
                                                            </Link>
                                                            <button
                                                                onClick={() => handleDelete(exam._id)}
                                                                className="p-2.5 text-rose-500 hover:bg-danger/10 rounded-xl transition-all border border-border/50"
                                                                title="Delete Exam"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                            <Link
                                                                to={`/exams/${exam._id}/submissions`}
                                                                className="p-2.5 text-emerald-500 hover:bg-success/10 rounded-xl transition-all border border-border/50"
                                                                title="View Results"
                                                            >
                                                                <BarChart2 className="w-5 h-5" />
                                                            </Link>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-muted/10">
                            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
                                <Users className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground tracking-tight">
                                {user.role === 'student' ? 'No exams available' : 'No exams yet'}
                            </h3>
                            <p className="text-xs font-semibold text-muted-foreground tracking-wide max-w-sm mx-auto mt-2">
                                {user.role === 'student'
                                    ? 'You haven\'t been assigned any exams yet. Assigned exams will appear here.'
                                    : 'Create your first exam and share the link with students for a standardized assessment experience.'}
                            </p>
                            {user.role !== 'student' && (
                                <button
                                    onClick={() => navigate('/exams/create')}
                                    className="mt-8 px-8 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-none "
                                >
                                    Create First Exam
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <ConfirmationModal
                    show={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={confirmDelete}
                    title="Delete Exam"
                    message="Are you sure you want to delete this assessment? All submissions and results will be permanently removed. This action is irreversible."
                    confirmText="Delete"
                    confirmButtonColor="bg-rose-600 hover:bg-danger/90 font-semibold tracking-wide text-xs"
                    isLoading={isDeleting}
                />
            </div>
        </Layout>
    );
};

export default Exams;
