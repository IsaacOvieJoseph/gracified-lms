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
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-2">
                <h3 className="font-bold text-lg text-gray-800">Academic Report Sheet</h3>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search student..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48 text-sm"
                        />
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={exportCSV}
                            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition border border-green-200"
                        >
                            <FileText size={16} />
                            <span>CSV</span>
                        </button>
                        <button
                            onClick={exportPDF}
                            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition border border-red-200"
                        >
                            <Download size={16} />
                            <span>PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="px-4 py-3 border-b border-gray-100 sticky left-0 bg-gray-50 z-10 w-48">Student Name</th>
                            {data.classrooms.map(className => (
                                <th key={className} className="px-4 py-3 text-center border-b border-gray-100 min-w-[100px]">
                                    {className}
                                </th>
                            ))}
                            <th className="px-4 py-3 text-center border-b border-gray-100 font-bold text-indigo-600 bg-indigo-50">Overall Avg</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredStudents.length > 0 ? (
                            filteredStudents.map((student) => (
                                <tr key={student.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900 border-r border-gray-50 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        <div className="flex flex-col">
                                            <span>{student.name}</span>
                                            <span className="text-[10px] text-gray-400 font-normal">{student.email}</span>
                                        </div>
                                    </td>
                                    {data.classrooms.map(className => (
                                        <td key={className} className="px-4 py-3 text-center text-gray-600">
                                            {student.scores[className] !== undefined ? (
                                                <span className={`font-medium ${student.scores[className] >= 70 ? 'text-green-600' :
                                                    student.scores[className] >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {student.scores[className]}%
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 italic text-xs">N/A</span>
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-center font-bold bg-indigo-50/30 text-indigo-700">
                                        {student.overallAverage}%
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={data.classrooms.length + 2} className="px-4 py-12 text-center text-gray-500">
                                    No students found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Showing {filteredStudents.length} entries • Student names are sticky on horizontal scroll</p>
        </div>
    );
};

export default AllStudentsReportTable;
