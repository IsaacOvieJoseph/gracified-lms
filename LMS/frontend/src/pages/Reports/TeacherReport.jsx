import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const TeacherReport = () => {
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch Classrooms on mount
    useEffect(() => {
        const fetchClassrooms = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/classrooms', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Filter if necessary, but backend usually handles "my classrooms"
                const options = res.data.map(c => ({ value: c._id, label: c.name }));
                setClassrooms(options);

                if (options.length > 0) {
                    setSelectedClass(options[0]);
                }
            } catch (error) {
                console.error(error);
                toast.error("Failed to fetch classrooms");
            }
        };
        fetchClassrooms();
    }, []);

    // Fetch report when selected class changes
    useEffect(() => {
        if (!selectedClass) return;

        const fetchReport = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/reports/class/${selectedClass.value}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setReportData(res.data);
            } catch (error) {
                console.error(error);
                toast.error("Failed to fetch class report");
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [selectedClass]);

    if (!classrooms.length && !loading) {
        return <div className="p-8 text-center text-gray-500">You don't have any classrooms yet.</div>;
    }

    return (
        <div className="space-y-8">
            <div className="w-full max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Classroom</label>
                <Select
                    options={classrooms}
                    value={selectedClass}
                    onChange={setSelectedClass}
                    className="basic-single"
                    classNamePrefix="select"
                />
            </div>

            {loading && <div className="py-10 text-center text-gray-500">Loading Report...</div>}

            {!loading && reportData && (
                <>
                    {/* Top Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                            <div className="flex items-center space-x-3 mb-2">
                                <Users className="opacity-80" size={24} />
                                <h3 className="font-medium opacity-90">Total Students</h3>
                            </div>
                            <p className="text-3xl font-bold">{reportData.classroom.studentCount}</p>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center space-x-3 mb-2 text-green-600">
                                <FileText size={24} />
                                <h3 className="font-medium text-gray-600">Assignments Created</h3>
                            </div>
                            <p className="text-3xl font-bold text-gray-800">{reportData.assignmentStats.length}</p>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center space-x-3 mb-2 text-blue-600">
                                <TrendingUp size={24} />
                                <h3 className="font-medium text-gray-600">Class Average</h3>
                            </div>
                            {/* Calculate overall average from assignments avg */}
                            <p className="text-3xl font-bold text-gray-800">
                                {(reportData.assignmentStats.reduce((acc, curr) => acc + curr.averageScore, 0) / (reportData.assignmentStats.length || 1)).toFixed(1)}
                            </p>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-6">Assignment Performance Averages</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={reportData.assignmentStats}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="title" hide />
                                        <YAxis />
                                        <Tooltip labelStyle={{ color: 'black' }} />
                                        <Bar dataKey="averageScore" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg Score" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-center text-gray-400 mt-2">Assignments (Chronological)</p>
                        </div>

                        {/* Student Leaderboard / At Risk */}
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                            <h3 className="font-bold text-gray-800 mb-4">Student Performance</h3>
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 rounded-l-lg">Name</th>
                                            <th className="px-3 py-2 text-right">Avg %</th>
                                            <th className="px-3 py-2 text-right rounded-r-lg">Completed</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportData.studentStats.map((student) => (
                                            <tr key={student.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-3 font-medium text-gray-900">{student.name}</td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className={`font-bold ${student.averagePercentage >= 70 ? 'text-green-600' :
                                                            student.averagePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                                                        }`}>
                                                        {student.averagePercentage}%
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right text-gray-600">
                                                    {student.assignmentsSubmitted} / {student.totalAssignments}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TeacherReport;
