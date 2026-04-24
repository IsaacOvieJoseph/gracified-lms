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
import logo from '../assets/logo.jpg';

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

    const hasTheory = exam?.questions?.some(q => q.questionType === 'theory');

    const filteredSubmissions = submissions
        .filter(s => {
            const name = (s.studentId?.name || s.candidateName || '').toLowerCase();
            const email = (s.studentId?.email || s.candidateEmail || '').toLowerCase();
            const matchesSearch = name.includes(searchQuery.toLowerCase()) || email.includes(searchQuery.toLowerCase());

            const isObjectiveOnly = !hasTheory;
            const needsReview = !isObjectiveOnly && s.status === 'submitted';
            const isFinished = s.status === 'graded' || (isObjectiveOnly && s.status === 'submitted');

            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'graded' && isFinished) ||
                (statusFilter === 'pending' && needsReview);

            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => b.totalScore - a.totalScore);

    const gradedSubmissions = submissions.filter(s => s.status === 'graded' || (!hasTheory && s.status === 'submitted'));
    const averageScore = gradedSubmissions.length > 0
        ? (gradedSubmissions.reduce((acc, curr) => acc + curr.totalScore, 0) / gradedSubmissions.length).toFixed(1)
        : 0;

    const finishedCount = submissions.filter(s => ['submitted', 'graded'].includes(s.status)).length;
    const completionRate = submissions.length > 0
        ? Math.round((finishedCount / submissions.length) * 100)
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

        const addHeaderAndFooter = (data, gracifiedLogoData = null) => {
            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height || pageSize.getHeight();
            const pageWidth = pageSize.width || pageSize.getWidth();

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150);
            const footerY = pageHeight - 10;

            if (gracifiedLogoData) {
                doc.addImage(gracifiedLogoData, 'PNG', pageWidth / 2 - 22, footerY - 4, 6, 6);
                doc.text('Powered by Gracified LMS', pageWidth / 2 + 3, footerY, { align: 'center' });
            } else {
                doc.text('Powered by Gracified LMS', pageWidth / 2, footerY, { align: 'center' });
            }
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

        const generatePDF = (schoolLogoData = null, gracifiedLogoData = null) => {
            let startY = 45;

            // Header with Logo
            if (schoolLogoData) {
                try {
                    doc.addImage(schoolLogoData, 'PNG', 14, 15, 20, 20); // school logo
                    doc.setFontSize(20);
                    doc.setTextColor(79, 70, 229);
                    doc.text('Examination Performance Report', 40, 22);

                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.text(`Exam Title: ${exam?.title}`, 40, 28);
                    if (exam?.classroomName) {
                        doc.text(`Class: ${exam.classroomName}`, 40, 33);
                        doc.text(`Total Participants: ${submissions.length} | Average Score: ${averageScore}`, 40, 38);
                        doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 43);
                        startY = 48;
                    } else {
                        doc.text(`Total Participants: ${submissions.length} | Average Score: ${averageScore}`, 40, 33);
                        doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 38);
                        startY = 43;
                    }
                } catch (e) {
                    console.error("Error adding logo to PDF", e);
                    // Fallback
                    doc.setFontSize(20);
                    doc.setTextColor(79, 70, 229);
                    doc.text('Examination Performance Report', 14, 22);
                    doc.setFontSize(10);
                    doc.setTextColor(100);
                    doc.text(`Exam Title: ${exam?.title}`, 14, 28);
                    if (exam?.classroomName) doc.text(`Class: ${exam.classroomName}`, 14, 33);
                    startY = 43;
                }
            } else {
                doc.setFontSize(20);
                doc.setTextColor(79, 70, 229);
                doc.text('Examination Performance Report', 14, 22);
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text(`Exam Title: ${exam?.title}`, 14, 28);
                if (exam?.classroomName) {
                    doc.text(`Class: ${exam.classroomName}`, 14, 33);
                    doc.text(`Total Participants: ${submissions.length} | Average Score: ${averageScore}`, 14, 38);
                    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 43);
                    startY = 48;
                } else {
                    doc.text(`Total Participants: ${submissions.length} | Average Score: ${averageScore}`, 14, 33);
                    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
                    startY = 43;
                }
            }

            autoTable(doc, {
                startY: startY + 5,
                head: [tableColumn],
                body: tableRows,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
                bodyStyles: { fontSize: 9 },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                didDrawPage: (data) => addHeaderAndFooter(data, gracifiedLogoData)
            });

            doc.save(`report_${exam?.title.replace(/\s+/g, '_')}.pdf`);
        };

        const loadImageAsBase64 = (url) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = url;
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = () => resolve(null);
            });
        };

        const processPreload = async () => {
            const logoPromises = [
                loadImageAsBase64(logo), // Preload Gracified Logo
                exam?.logoUrl ? loadImageAsBase64(exam.logoUrl) : Promise.resolve(null) // Preload School Logo
            ];

            const [gracifiedBase64, schoolBase64] = await Promise.all(logoPromises);
            generatePDF(schoolBase64, gracifiedBase64);
        };

        processPreload();
    };

    return (
        <Layout>
            <div className="max-w-7xl mx-auto space-y-8 pb-20">
                {/* Header */}
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-4">
                    <div className="flex items-center space-x-6">
                        <button
                            onClick={() => navigate('/exams')}
                            className="p-3 hover:bg-muted rounded-2xl transition-all border border-border/50 shadow-sm"
                        >
                            <ArrowLeft className="w-6 h-6 text-foreground" />
                        </button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tighter uppercase italic leading-tight">Assessment <span className="text-primary not-italic">Report</span></h1>
                            <p className="text-[10px] md:text-xs font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Session Intercept: {exam?.title}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={exportToCSV}
                            className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-6 py-3 bg-card border border-border rounded-xl font-black text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted transition-all shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            <span>Export CSV</span>
                        </button>
                        <button
                            onClick={exportToPDF}
                            className="btn-premium flex-1 md:flex-none"
                        >
                            <FileText className="w-4 h-4" />
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-card p-6 rounded-[2rem] border border-border shadow-xl hover:border-primary/20 transition-all group">
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 opacity-40">Submissions</div>
                        <div className="text-3xl font-black text-foreground tracking-tighter">{submissions.length}</div>
                    </div>
                    <div className="bg-card p-6 rounded-[2rem] border border-border shadow-xl hover:border-primary/20 transition-all group">
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 opacity-40">Average Intel Score</div>
                        <div className="text-3xl font-black text-primary tracking-tighter">{averageScore}</div>
                    </div>
                    <div className="bg-card p-6 rounded-[2rem] border border-border shadow-xl hover:border-emerald-500/20 transition-all group">
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 opacity-40">Resolution Rate</div>
                        <div className="text-3xl font-black text-emerald-500 tracking-tighter">{completionRate}%</div>
                    </div>
                    <div className="bg-card p-6 rounded-[2rem] border border-border shadow-xl hover:border-primary/20 transition-all group">
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 opacity-40">Max Possible</div>
                        <div className="text-3xl font-black text-foreground tracking-tighter">
                            {exam?.questions?.reduce((acc, q) => acc + (q.maxScore || 1), 0)}
                        </div>
                    </div>
                </div>

                {/* Search & List */}
                <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-border/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-muted-foreground/30 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Filter students by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 bg-muted/20 border-none rounded-[1.5rem] focus:ring-2 focus:ring-primary/20 transition-all font-black text-xs uppercase tracking-widest text-foreground placeholder:text-muted-foreground/30"
                            />
                        </div>
                        <div className="flex items-center space-x-3">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-muted border border-border rounded-xl px-5 py-3 font-black text-muted-foreground focus:ring-2 focus:ring-primary/20 transition-all text-[10px] uppercase tracking-[0.2em] outline-none"
                            >
                                <option value="all">All Payloads</option>
                                <option value="graded">Resolved Only</option>
                                <option value="pending">Needs Review</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto font-inter">
                        <table className="w-full text-left">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] italic">Student Name</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] italic">Network Mode</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] italic text-nowrap">Resolution Time</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] italic text-nowrap">Cycle Duration</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] italic text-center">Intel (%)</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] italic text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                 {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-24 text-center">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                                            <p className="mt-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Loading submissions...</p>
                                        </td>
                                    </tr>
                                ) : filteredSubmissions.length > 0 ? (
                                    filteredSubmissions.map((s) => (
                                        <tr key={s._id} className="hover:bg-muted/30 transition-all group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center space-x-5">
                                                    <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-lg italic shadow-inner">
                                                        {(s.studentId?.name || s.candidateName || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-[15px] font-black text-foreground flex items-center gap-2 group-hover:text-primary transition-colors tracking-tight italic uppercase">{s.studentId?.name || s.candidateName}</div>
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{s.studentId?.email || s.candidateEmail || 'No secure email'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                {s.studentId ? (
                                                    <span className="flex items-center text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 tracking-widest shadow-inner">
                                                        <UserCheck className="w-3.5 h-3.5 mr-1.5" /> RECOGNIZED
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 tracking-widest shadow-inner">
                                                        <Globe className="w-3.5 h-3.5 mr-1.5" /> EXTERNAL
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-foreground tracking-tight">{formatDisplayDate(s.submittedAt)}</span>
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Intercept Log</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-foreground tracking-tight">{formatDuration(s.startedAt, s.submittedAt)}</span>
                                                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40 flex items-center mt-1">
                                                        Started: {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex flex-col space-y-1.5 items-center">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="text-2xl font-black text-primary tracking-tighter italic">
                                                            {Math.round((s.totalScore / totalMaxScore) * 100)}%
                                                        </div>
                                                        <Award className="w-4 h-4 text-amber-500" />
                                                    </div>
                                                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
                                                        {s.totalScore} / {totalMaxScore} Intel
                                                    </div>
                                                    {s.status === 'graded' ? (
                                                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 mt-1">Resolved</span>
                                                    ) : hasTheory && s.status === 'submitted' ? (
                                                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 mt-1">Review Required</span>
                                                    ) : s.status === 'submitted' ? (
                                                        <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-lg border border-primary/20 mt-1">Finalized</span>
                                                    ) : (
                                                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest bg-muted px-3 py-1 rounded-lg border border-border mt-1">Active</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <button
                                                    onClick={() => navigate(`/exams/submissions/detail/${s._id}`)}
                                                    className="p-2.5 text-primary hover:bg-primary/10 rounded-xl transition-all border border-border/50 group/btn"
                                                    title="Deep Analysis"
                                                >
                                                    <BarChart className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
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
