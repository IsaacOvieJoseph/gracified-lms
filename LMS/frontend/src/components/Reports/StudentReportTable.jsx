import React from 'react';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const StudentReportTable = ({ students, classroomName }) => {

    const exportCSV = () => {
        const headers = ['Name', 'Email', 'Assignments Submitted', 'Total Assignments', 'Avg Score (%)', 'Attendance (%)', 'Classes Attended', 'Total Classes'];
        const rows = students.map(s => [
            s.name,
            s.email,
            s.assignmentsSubmitted,
            s.totalAssignments,
            s.averagePercentage,
            (s.attendancePercentage || 0),
            (s.classesAttended || 0),
            (s.totalClasses || 0)
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${classroomName}_Report_Card.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text(`Student Report Card: ${classroomName}`, 14, 15);

        const tableColumn = ["Name", "Email", "Submissions", "Avg Score %", "Attendance %", "Classes"];
        const tableRows = [];

        students.forEach(s => {
            const studentData = [
                s.name,
                s.email,
                `${s.assignmentsSubmitted}/${s.totalAssignments}`,
                `${s.averagePercentage}%`,
                `${s.attendancePercentage || 0}%`,
                `${s.classesAttended || 0}/${s.totalClasses || 0}`
            ];
            tableRows.push(studentData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(`${classroomName}_Report_Card.pdf`);
    };

    if (!students || students.length === 0) {
        return <div className="text-muted-foreground text-center py-4">No student data available.</div>;
    }

    return (
        <div className="bg-card  p-8 rounded-xl shadow-none border border-border/50 overflow-hidden flex flex-col mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h3 className="text-2xl font-semibold text-foreground tracking-tight">Student Report Cards</h3>
                    <p className="text-xs font-semibold text-muted-foreground tracking-wide mt-1 opacity-60">Complete Performance Log</p>
                </div>
                <div className="flex w-full sm:w-auto space-x-3">
                    <button
                        onClick={exportCSV}
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-3 text-xs font-semibold tracking-wide bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all shadow-none"
                    >
                        <FileText size={16} />
                        <span>CSV Export</span>
                    </button>
                    <button
                        onClick={exportPDF}
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-3 text-xs font-semibold tracking-wide bg-rose-500/10 text-rose-500 rounded-xl hover:bg-danger/90 hover:text-white transition-all shadow-none"
                    >
                        <Download size={16} />
                        <span>PDF Export</span>
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-muted text-muted-foreground text-xs font-semibold tracking-wide border-b border-border/50">
                        <tr>
                            <th className="px-6 py-5">Name</th>
                            <th className="px-6 py-5">Email</th>
                            <th className="px-6 py-5 text-center">Assignments</th>
                            <th className="px-6 py-5 text-center">Average Score</th>
                            <th className="px-6 py-5 text-center">Attendance</th>
                            <th className="px-6 py-5 text-center">Classes Attended</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {students.map((student) => (
                            <tr key={student.id} className="hover:bg-primary/5 transition-colors">
                                <td className="px-6 py-5 font-semibold text-foreground tracking-tight">{student.name}</td>
                                <td className="px-6 py-5 text-muted-foreground/80 font-semibold">{student.email}</td>
                                <td className="px-6 py-5 text-center font-semibold text-muted-foreground/80">
                                    {student.assignmentsSubmitted} / {student.totalAssignments}
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <span className={`font-semibold ${student.averagePercentage >= 70 ? 'text-emerald-500' :
                                        student.averagePercentage >= 50 ? 'text-amber-500' : 'text-rose-500'
                                        }`}>
                                        {student.averagePercentage}%
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <span className={`font-semibold ${student.attendancePercentage >= 75 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                        {student.attendancePercentage || 0}%
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-center font-semibold text-muted-foreground/80">
                                    {student.classesAttended || 0} / {student.totalClasses || 0}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StudentReportTable;
