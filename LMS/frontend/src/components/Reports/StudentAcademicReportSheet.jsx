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
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col space-y-4 my-8">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800">Academic Report Sheet</h3>
                <div className="flex space-x-2">
                    <button
                        onClick={exportCSV}
                        className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition"
                    >
                        <FileText size={16} />
                        <span>CSV</span>
                    </button>
                    <button
                        onClick={exportPDF}
                        className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition"
                    >
                        <Download size={16} />
                        <span>PDF</span>
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg border-b border-gray-100">Subject</th>
                            <th className="px-4 py-3 text-center border-b border-gray-100">Assignments</th>
                            <th className="px-4 py-3 text-center border-b border-gray-100">Avg Score (%)</th>
                            <th className="px-4 py-3 text-center border-b border-gray-100">Attendance (%)</th>
                            <th className="px-4 py-3 text-center rounded-tr-lg border-b border-gray-100">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-4 font-medium text-gray-900 border-r border-gray-50">
                                    {item.className}
                                </td>
                                <td className="px-4 py-4 text-center text-gray-600">
                                    {item.submittedCount} / {item.totalAssignments}
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <span className={`font-bold ${item.averagePercentage >= 70 ? 'text-green-600' :
                                        item.averagePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {item.averagePercentage}%
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <span className={`font-bold ${(item.attendance?.percentage || 0) >= 75 ? 'text-green-600' : 'text-gray-600'}`}>
                                        {item.attendance?.percentage || 0}%
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-center">
                                    {item.averagePercentage >= 50 ? (
                                        <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">Pass</span>
                                    ) : (
                                        <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded">Fail</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center text-sm border border-gray-100">
                <span className="text-gray-500 italic">This is an automated academic transcript generated from your performance data.</span>
                <span className="font-bold text-indigo-600 uppercase">OFFICIAL</span>
            </div>
        </div>
    );
};

export default StudentAcademicReportSheet;
