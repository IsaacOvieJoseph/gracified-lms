import React from 'react';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const StudentAcademicReportSheet = ({ data, studentName }) => {
    if (!data || data.length === 0) return null;

    const exportCSV = () => {
        const headers = ['Subject', 'Assignments', 'Avg Score (%)', 'Attendance (%)'];
        const rows = data.map(item => [
            item.className,
            `${item.submittedCount}/${item.totalAssignments}`,
            `${item.averagePercentage}%`,
            `${item.attendance?.percentage || 0}%`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${studentName}_Academic_Report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text("Official Academic Report Sheet", 14, 15);

        doc.setFontSize(12);
        doc.text(`Student: ${studentName}`, 14, 25);
        doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 14, 32);

        const tableColumn = ["Subject", "Assignments", "Score (%)", "Attendance (%)"];
        const tableRows = data.map(item => [
            item.className,
            `${item.submittedCount}/${item.totalAssignments}`,
            `${item.averagePercentage}%`,
            `${item.attendance?.percentage || 0}%`
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            styles: { fontSize: 10 },
            headStyles: { fillColor: [79, 70, 229] }
        });

        doc.save(`${studentName}_Academic_Report.pdf`);
    };

    return (
        <div className="bg-card/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-border/50 shadow-2xl overflow-hidden flex flex-col space-y-6 my-8 animate-slide-up">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">Academic Report Sheet</h3>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-1 opacity-60">Official Transcript</p>
                </div>
                <div className="flex w-full sm:w-auto space-x-3">
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

            <div className="overflow-x-auto border border-border/50 rounded-2xl">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] font-black tracking-[0.2em]">
                        <tr>
                            <th className="px-6 py-5 border-b border-border/50">Class Name</th>
                            <th className="px-6 py-5 text-center border-b border-border/50">Assignments Submitted</th>
                            <th className="px-6 py-5 text-center border-b border-border/50">Average Score</th>
                            <th className="px-6 py-5 text-center border-b border-border/50">Attendance</th>
                            <th className="px-6 py-5 text-center border-b border-border/50">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-sm">
                        {data.map((item, index) => (
                            <tr key={index} className="hover:bg-primary/5 transition-colors group">
                                <td className="px-6 py-5 font-black italic text-foreground tracking-tight border-r border-border/30">
                                    {item.className}
                                </td>
                                <td className="px-6 py-5 text-center font-black text-muted-foreground/80">
                                    {item.submittedCount} / {item.totalAssignments}
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <span className={`font-black ${item.averagePercentage >= 70 ? 'text-emerald-500' :
                                        item.averagePercentage >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                                        {item.averagePercentage}%
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <span className={`font-black ${(item.attendance?.percentage || 0) >= 75 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                        {item.attendance?.percentage || 0}%
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-center">
                                     {item.averagePercentage >= 50 ? (
                                         <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg shadow-sm">Pass</span>
                                     ) : (
                                         <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg shadow-sm">Fail</span>
                                     )}
                                 </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-5 bg-muted/30 rounded-2xl flex justify-between items-center text-sm border border-border/50">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Official Auto-Generated Transcript</span>
                <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase shadow-sm">OFFICIAL</span>
            </div>
        </div>
    );
};

export default StudentAcademicReportSheet;
