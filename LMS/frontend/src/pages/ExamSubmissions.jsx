import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    ArrowLeft,
    User,
    Mail,
    Clock,
    Award,
    Search,
    Globe,
    FileText,
    Download,
    UserCheck,
    BarChart
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Layout from '../components/Layout';
import api from '../utils/api';
import { formatDisplayDate } from '../utils/timezone';

const ExamSubmissions = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState([]);
    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const [examRes, submissionsRes] = await Promise.all([
                api.get(`/exams/${id}`),
                api.get(`/exams/${id}/submissions`)
            ]);
            setExam(examRes.data);
            setSubmissions(submissionsRes.data);
        } catch (error) {
            toast.error('Failed to fetch data');
            navigate('/exams');
        } finally {
            setLoading(false);
        }
    };

    const totalMaxScore = exam?.questions?.reduce((acc, q) => acc + (q.maxScore || 1), 0) || 1;

    const filteredSubmissions = submissions
        .filter(s => {
            const name = (s.studentId?.name || s.candidateName || '').toLowerCase();
            const email = (s.studentId?.email || s.candidateEmail || '').toLowerCase();
            const matchesSearch = name.includes(searchQuery.toLowerCase()) || email.includes(searchQuery.toLowerCase());

            const needsReview = exam?.questions.some(q => q.questionType === 'theory') && s.status !== 'graded';
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'graded' && s.status === 'graded') ||
                (statusFilter === 'pending' && needsReview);

            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => b.totalScore - a.totalScore);

    const averageScore = submissions.length > 0
        ? (submissions.reduce((acc, curr) => acc + curr.totalScore, 0) / submissions.length).toFixed(1)
        : 0;

    const formatDuration = (start, end) => {
        if (!start || !end) return 'N/A';
        const ms = new Date(end) - new Date(start);
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        return `${mins}m ${secs}s`;
    };

    const exportToCSV = () => {
        if (submissions.length === 0) return toast.error('No submissions to export');

        const headers = ['Candidate Name', 'Email', 'Mode', 'Submitted At', 'Time Spent', 'Score', 'Total Points', 'Percentage'];
        const csvData = filteredSubmissions.map(s => [
            s.studentId?.name || s.candidateName,
            s.studentId?.email || s.candidateEmail || 'N/A',
            s.studentId ? 'Registered' : 'Guest',
            new Date(s.submittedAt).toLocaleString(),
            formatDuration(s.startedAt, s.submittedAt),
            s.totalScore,
            totalMaxScore,
            Math.round((s.totalScore / totalMaxScore) * 100) + '%'
        ]);

        const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `submissions_${exam?.title.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        if (submissions.length === 0) return toast.error('No submissions to export');

        const doc = new jsPDF();

        const addHeaderAndFooter = (data) => {
            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height || pageSize.getHeight();
            const pageWidth = pageSize.width || pageSize.getWidth();

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('Powered by Gracified LMS', pageWidth / 2, pageHeight - 10, { align: 'center' });
        };

        const tableColumn = ['Candidate Name', 'Email', 'Mode', 'Submitted At', 'Time Spent', 'Score', 'Total Points', 'Percentage'];
        const tableRows = filteredSubmissions.map(s => [
            s.studentId?.name || s.candidateName,
            s.studentId?.email || s.candidateEmail || 'N/A',
            s.studentId ? 'Registered' : 'Guest',
            new Date(s.submittedAt).toLocaleString(),
            formatDuration(s.startedAt, s.submittedAt),
            s.totalScore,
            totalMaxScore,
            Math.round((s.totalScore / totalMaxScore) * 100) + '%'
        ]);

        const generatePDF = (logoData = null) => {
            // Header with Logo
            if (logoData) {
                try {
                    doc.addImage(logoData, 'PNG', 14, 15, 20, 20); // x, y, w, h
                    doc.setFontSize(20);
                    doc.setTextColor(79, 70, 229);
                    doc.text('Examination Performance Report', 40, 22);

                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.text(`Exam Title: ${exam?.title}`, 40, 30);
                    doc.text(`Total Participants: ${submissions.length} | Average Score: ${averageScore}`, 40, 35);
                    doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 40);
                } catch (e) {
                    console.error("Error adding logo to PDF", e);
                    // Fallback header (Duplicate code to ensure it renders if addImage fails)
                    doc.setFontSize(20);
                    doc.setTextColor(79, 70, 229);
                    doc.text('Examination Performance Report', 14, 22);

                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.text(`Exam Title: ${exam?.title}`, 14, 30);
                    doc.text(`Total Participants: ${submissions.length} | Average Score: ${averageScore}`, 14, 35);
                    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 40);
                }
            } else {
                // Standard Header (No Logo)
                doc.setFontSize(20);
                doc.setTextColor(79, 70, 229);
                doc.text('Examination Performance Report', 14, 22);

                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`Exam Title: ${exam?.title}`, 14, 30);
                doc.text(`Total Participants: ${submissions.length} | Average Score: ${averageScore}`, 14, 35);
                doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 40);
            }

            autoTable(doc, {
                startY: 50,
                head: [tableColumn],
                body: tableRows,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
                bodyStyles: { fontSize: 9 },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                didDrawPage: addHeaderAndFooter
            });

            doc.save(`report_${exam?.title.replace(/\s+/g, '_')}.pdf`);
        };

        if (exam?.logoUrl) {
            const img = new Image();
            img.src = exam.logoUrl;
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const dataURL = canvas.toDataURL('image/png');
                    generatePDF(dataURL);
                } catch (error) {
                    console.error("Error processing logo image", error);
                    generatePDF(null);
                }
            };
            img.onerror = () => {
                generatePDF(null);
            };
        } else {
            generatePDF(null);
        }
    };

    return (
        <Layout>
            <div className="max-w-7xl mx-auto space-y-8 pb-20">
                {/* Header */}
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-4">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => navigate('/exams')}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors font-bold shrink-0"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-gray-900 leading-tight">Exam Submissions</h1>
                            <p className="text-sm md:text-base text-gray-500 font-medium line-clamp-1">Results for: {exam?.title}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={exportToCSV}
                            className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm whitespace-nowrap"
                        >
                            <Download className="w-4 h-4" />
                            <span>Export CSV</span>
                        </button>
                        <button
                            onClick={exportToPDF}
                            className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 whitespace-nowrap"
                        >
                            <FileText className="w-4 h-4" />
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Participants</div>
                        <div className="text-3xl font-black text-gray-900">{submissions.length}</div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Average Score</div>
                        <div className="text-3xl font-black text-indigo-600">{averageScore}</div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Completion Rate</div>
                        <div className="text-3xl font-black text-emerald-500">100%</div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Max Possible</div>
                        <div className="text-3xl font-black text-gray-900">
                            {exam?.questions?.reduce((acc, q) => acc + (q.maxScore || 1), 0)}
                        </div>
                    </div>
                </div>

                {/* Search & List */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by candidate name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-gray-50 border-none rounded-2xl px-4 py-3 font-bold text-gray-500 focus:ring-2 focus:ring-indigo-500 transition-all text-xs uppercase tracking-widest outline-none"
                            >
                                <option value="all">All Submissions</option>
                                <option value="graded">Graded Only</option>
                                <option value="pending">Needs Review</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Candidate</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Access Mode</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-nowrap">Submitted At</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-nowrap">Time Spent</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Score (%)</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-20 text-center">
                                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                                        </td>
                                    </tr>
                                ) : filteredSubmissions.length > 0 ? (
                                    filteredSubmissions.map((s) => (
                                        <tr key={s._id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                                        {(s.studentId?.name || s.candidateName || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900">{s.studentId?.name || s.candidateName}</div>
                                                        <div className="text-xs text-gray-500">{s.studentId?.email || s.candidateEmail || 'No email provided'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                {s.studentId ? (
                                                    <span className="flex items-center text-xs font-bold text-violet-600 bg-violet-50 px-3 py-1 rounded-full w-fit">
                                                        <UserCheck className="w-3 h-3 mr-1" /> REGISTERED
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full w-fit">
                                                        <Globe className="w-3 h-3 mr-1" /> GUEST
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-900">{formatDisplayDate(s.submittedAt)}</span>
                                                    <span className="text-[10px] text-gray-400 uppercase tracking-tighter">Completion</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-900">{formatDuration(s.startedAt, s.submittedAt)}</span>
                                                    <span className="text-[10px] text-gray-400 flex items-center mt-1 text-nowrap">
                                                        Started: {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex flex-col space-y-1 items-center">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="text-2xl font-black text-indigo-600">
                                                            {Math.round((s.totalScore / totalMaxScore) * 100)}%
                                                        </div>
                                                        <Award className="w-4 h-4 text-amber-400" />
                                                    </div>
                                                    <div className="text-[10px] font-bold text-gray-400 uppercase">
                                                        {s.totalScore} / {totalMaxScore} Pts
                                                    </div>
                                                    {s.status === 'graded' ? (
                                                        <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest bg-violet-50 px-2 py-0.5 rounded-md mt-1">Graded</span>
                                                    ) : exam?.questions.some(q => q.questionType === 'theory') ? (
                                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md mt-1">Needs Review</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={() => navigate(`/exams/submissions/detail/${s._id}`)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >
                                                    <BarChart className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-20 text-center text-gray-400 font-medium">
                                            No submissions found for this exam.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ExamSubmissions;
