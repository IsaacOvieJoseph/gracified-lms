import React, { useState, useEffect } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import api from '../../utils/api';

const AllStudentsReportTable = () => {
    const [data, setData] = useState({ classrooms: [], students: [] });
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await api.get('/reports/all-students');
            setData(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch students report");
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = data.students.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const exportCSV = () => {
        const headers = ['Name', 'Email', ...data.classrooms, 'Overall Average (%)'];
        const rows = filteredStudents.map(s => [
            s.name,
            s.email,
            ...data.classrooms.map(c => s.scores[c] !== undefined ? `${s.scores[c]}%` : 'N/A'),
            `${s.overallAverage}%`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Academic_Report_Sheet.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportPDF = () => {
        const doc = new jsPDF('landscape');
        doc.text(`Academic Report Sheet`, 14, 15);

        const tableColumn = ["Name", ...data.classrooms, "Avg %"];
        const tableRows = filteredStudents.map(s => [
            s.name,
            ...data.classrooms.map(c => s.scores[c] !== undefined ? `${s.scores[c]}%` : 'N/A'),
            `${s.overallAverage}%`
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [79, 70, 229] }
        });

        doc.save(`Academic_Report_Sheet.pdf`);
    };

    if (loading && data.students.length === 0) return <div className="p-4 text-center">Loading academic report sheet...</div>;

    return (
        <div className="bg-card/40 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border border-border/50 overflow-hidden flex flex-col space-y-6 relative mt-8">
            <div className="absolute top-0 left-0 w-full h-full bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2 relative z-10">
                <div>
                    <h3 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">All Students Report</h3>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-1 opacity-60">Global Academic Overview</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                        <input
                            type="text"
                            placeholder="Search student..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-48 text-sm text-foreground"
                        />
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={exportCSV}
                            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                        >
                            <FileText size={16} />
                            <span>CSV Export</span>
                        </button>
                        <button
                            onClick={exportPDF}
                            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                        >
                            <Download size={16} />
                            <span>PDF Export</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto border border-border/50 rounded-2xl relative z-10">
                <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                    <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-black tracking-[0.2em]">
                        <tr>
                            <th className="px-6 py-5 border-b border-border/50 sticky left-0 bg-muted/80 backdrop-blur-md z-10 w-48">Student Name</th>
                            {data.classrooms.map(className => (
                                <th key={className} className="px-6 py-5 text-center border-b border-border/50 min-w-[100px]">
                                    {className}
                                </th>
                            ))}
                            <th className="px-6 py-5 text-center border-b border-border/50 font-black text-primary bg-primary/10 italic">Overall Average</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {filteredStudents.length > 0 ? (
                            filteredStudents.map((student) => (
                                <tr key={student.id} className="hover:bg-primary/5 transition-colors">
                                    <td className="px-6 py-4 font-black italic text-foreground tracking-tight border-r border-border/30 sticky left-0 bg-card z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        <div className="flex flex-col">
                                            <span>{student.name}</span>
                                            <span className="text-[10px] text-muted-foreground/60 font-black tracking-widest not-italic truncate w-40">{student.email}</span>
                                        </div>
                                    </td>
                                    {data.classrooms.map(className => (
                                        <td key={className} className="px-6 py-4 text-center text-muted-foreground/80">
                                            {student.scores[className] !== undefined ? (
                                                <span className={`font-black ${student.scores[className] >= 70 ? 'text-emerald-500' :
                                                    student.scores[className] >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                    {student.scores[className]}%
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/30 italic text-[10px] font-black uppercase tracking-widest">N/A</span>
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-6 py-4 text-center font-black bg-primary/5 text-primary text-lg italic">
                                        {student.overallAverage}%
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={data.classrooms.length + 2} className="px-4 py-12 text-center text-muted-foreground">
                                    No students found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">Showing {filteredStudents.length} entries • Student names are sticky on horizontal scroll</p>
        </div>
    );
};

export default AllStudentsReportTable;
