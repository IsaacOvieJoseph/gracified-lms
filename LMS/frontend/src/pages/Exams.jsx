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

    const copyLink = (token) => {
        const link = `${window.location.origin}/exam-center/${token}`;
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
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            {user.role === 'student' ? 'My Assessments' : 'External Exam Center'}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {user.role === 'student'
                                ? 'View and participate in exams assigned to your classes.'
                                : 'Manage standard timed assessments and sharable links.'}
                        </p>
                    </div>
                    {user.role !== 'student' && (
                        <button
                            onClick={() => navigate('/exams/create')}
                            className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 group"
                        >
                            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                            <span className="font-semibold text-sm sm:text-base">New Exam</span>
                        </button>
                    )}
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                        <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">
                                {user.role === 'student' ? 'Unfinished' : 'Total Exams'}
                            </p>
                            <h3 className="text-2xl font-bold text-gray-900">
                                {user.role === 'student'
                                    ? exams.filter(e => e.submissionStatus === 'not-started').length
                                    : exams.length}
                            </h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                        <div className="bg-green-50 p-3 rounded-xl text-green-600">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">
                                {user.role === 'student' ? 'Completed' : 'Active Links'}
                            </p>
                            <h3 className="text-2xl font-bold text-gray-900">
                                {user.role === 'student'
                                    ? exams.filter(e => e.submissionStatus !== 'not-started').length
                                    : exams.filter(e => e.isPublished).length}
                            </h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                        <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">
                                {user.role === 'student' ? 'Average Score' : 'Access Modes'}
                            </p>
                            <h3 className="text-2xl font-bold text-gray-900">
                                {user.role === 'student'
                                    ? (exams.filter(e => e.score !== null).reduce((acc, curr) => acc + curr.score, 0) / Math.max(exams.filter(e => e.score !== null).length, 1)).toFixed(1) + '%'
                                    : 'Multi-Channel'}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Search & Filter */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search exams..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-gray-400 text-sm"
                        />
                    </div>
                </div>

                {/* Exams Table/List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                            <p className="mt-4 text-gray-500">Loading your exam center...</p>
                        </div>
                    ) : filteredExams.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">Exam Details</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">Mode & Duration</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-gray-600 uppercase tracking-wider">{user.role === 'student' ? 'Result' : 'Status'}</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-gray-600 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredExams.map((exam) => (
                                        <tr key={exam._id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{exam.title}</span>
                                                    <span className="text-sm text-gray-500 mt-1 line-clamp-1">{exam.description || 'No description provided'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="space-y-2">
                                                    <div className="flex items-center text-sm text-gray-600">
                                                        {exam.accessMode === 'open' ? (
                                                            <div className="flex items-center px-2 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold uppercase ring-1 ring-green-200">
                                                                <Globe className="w-3 h-3 mr-1" /> Open
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold uppercase ring-1 ring-amber-200">
                                                                <Lock className="w-3 h-3 mr-1" /> Private
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center text-sm text-gray-600">
                                                        <Clock className="w-4 h-4 mr-2 text-indigo-400" />
                                                        <span className="font-medium">{exam.duration} Minutes</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                {user.role === 'student' ? (
                                                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${exam.submissionStatus === 'graded'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : exam.submissionStatus === 'submitted'
                                                            ? 'bg-indigo-100 text-indigo-700'
                                                            : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        <span className={`w-2 h-2 rounded-full mr-2 ${exam.submissionStatus === 'graded' ? 'bg-emerald-500' :
                                                            exam.submissionStatus === 'submitted' ? 'bg-indigo-500' : 'bg-gray-400'
                                                            }`}></span>
                                                        {exam.submissionStatus === 'graded' ? `${exam.score}% Score` :
                                                            exam.submissionStatus === 'submitted' ? 'Submitted' : 'Not Started'}
                                                    </div>
                                                ) : (
                                                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${exam.isPublished
                                                        ? 'bg-indigo-100 text-indigo-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        <span className={`w-2 h-2 rounded-full mr-2 ${exam.isPublished ? 'bg-indigo-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                                        {exam.isPublished ? 'Published' : 'Draft'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    {user.role === 'student' ? (
                                                        <>
                                                            {exam.submissionStatus === 'not-started' ? (
                                                                <Link
                                                                    to={`/exam-center/${exam.linkToken}`}
                                                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all flex items-center space-x-2 shadow-md shadow-indigo-100"
                                                                >
                                                                    <span>Start Exam</span>
                                                                    <Play className="w-4 h-4 fill-current" />
                                                                </Link>
                                                            ) : (
                                                                <Link
                                                                    to={`/exam-center/${exam.linkToken}`} // Redirects to result screen if already done
                                                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition-all flex items-center space-x-2"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                    <span>View Details</span>
                                                                </Link>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => copyLink(exam.linkToken)}
                                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group/btn"
                                                                title="Copy Exam Link"
                                                            >
                                                                <Share2 className="w-5 h-5" />
                                                            </button>
                                                            <Link
                                                                to={`/exams/edit/${exam._id}`}
                                                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                title="Edit Exam"
                                                            >
                                                                <Edit className="w-5 h-5" />
                                                            </Link>
                                                            <button
                                                                onClick={() => handleDelete(exam._id)}
                                                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                title="Delete Exam"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                            <Link
                                                                to={`/exams/${exam._id}/submissions`}
                                                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                title="View Submissions"
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
                        <div className="text-center py-20 bg-gray-50/30">
                            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
                                <Users className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">
                                {user.role === 'student' ? 'No exams available' : 'No exams yet'}
                            </h3>
                            <p className="text-gray-500 mt-2 max-w-sm mx-auto">
                                {user.role === 'student'
                                    ? 'You haven\'t been assigned any exams yet. Assigned exams will appear here.'
                                    : 'Create your first exam and share the link with students for a standardized assessment experience.'}
                            </p>
                            {user.role !== 'student' && (
                                <button
                                    onClick={() => navigate('/exams/create')}
                                    className="mt-8 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
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
                    message="Are you sure you want to delete this exam? All captured submissions and results for this assessment will be permanently lost. This action cannot be undone."
                    confirmText="Delete"
                    confirmButtonColor="bg-rose-600 hover:bg-rose-700"
                    isLoading={isDeleting}
                />
            </div>
        </Layout>
    );
};

export default Exams;
