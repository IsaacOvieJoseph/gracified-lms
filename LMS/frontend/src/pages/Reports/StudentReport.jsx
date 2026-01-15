import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BookOpen, CheckCircle, Clock, Award, Users } from 'lucide-react';

import StudentAcademicReportSheet from '../../components/Reports/StudentAcademicReportSheet';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const StudentReport = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/reports/student/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data);
            } catch (err) {
                console.error(err);
                setError('Failed to load performance data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="flex justify-center p-10">Loading report...</div>;
    if (error) return <div className="text-red-500 p-10">{error}</div>;

    if (!data) return <div>No data available</div>;

    const { student, summary, byClass, recentAssignments } = data;

    const pieData = [
        { name: 'Submitted', value: summary.submittedCount },
        { name: 'Pending/Missing', value: summary.pendingCount }
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end gap-2 border-b border-gray-100 pb-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Performance Overview</h2>
                    <p className="text-gray-500 mt-1">Detailed academic report for <span className="text-indigo-600 font-semibold">{student?.name}</span></p>
                </div>
                <p className="text-sm text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                    ID: {student?.email}
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Total Assignments</p>
                        <p className="text-2xl font-bold text-gray-800">{summary.totalAssignments}</p>
                    </div>
                </div>

                <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center space-x-4">
                    <div className="p-3 bg-green-100 rounded-lg text-green-600">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Submitted</p>
                        <p className="text-2xl font-bold text-gray-800">{summary.submittedCount}</p>
                    </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex items-center space-x-4">
                    <div className="p-3 bg-yellow-100 rounded-lg text-yellow-600">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Pending</p>
                        <p className="text-2xl font-bold text-gray-800">{summary.pendingCount}</p>
                    </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-center space-x-4">
                    <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
                        <Award size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Overall Score</p>
                        <p className="text-2xl font-bold text-gray-800">{summary.overallPercentage}%</p>
                    </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center space-x-4">
                    <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Attendance</p>
                        <p className="text-2xl font-bold text-gray-800">{summary.attendancePercentage}%</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Performance by Class Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-6 text-gray-800">Performance Chart</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={byClass.map(c => ({
                                className: c.className,
                                averagePercentage: c.averagePercentage,
                                attendancePercentage: c.attendance?.percentage || 0
                            }))}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="className" />
                                <YAxis unit="%" />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="averagePercentage" name="Avg Score (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="attendancePercentage" name="Attendance (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Completion Status Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-6 text-gray-800">Assignment Completion</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Academic Report Sheet (Official Table) */}
            <StudentAcademicReportSheet data={byClass} studentName={student?.name} />

            {/* Recent Activity Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">Recent Assignments</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Title</th>
                                <th className="px-6 py-4">Subject</th>
                                <th className="px-6 py-4">Due Date</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm md:text-base">
                            {recentAssignments.map((assign) => (
                                <tr key={assign.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{assign.title}</td>
                                    <td className="px-6 py-4 text-gray-600">{assign.className}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {assign.dueDate ? new Date(assign.dueDate).toLocaleDateString() : 'No Due Date'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${assign.status === 'graded' ? 'bg-green-100 text-green-700 border-green-200' :
                                            assign.status === 'submitted' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                assign.status === 'missing' ? 'bg-red-100 text-red-700 border-red-200' :
                                                    'bg-gray-100 text-gray-600 border-gray-200'
                                            }`}>
                                            {assign.status === 'graded' ? 'Graded' :
                                                assign.status === 'submitted' ? 'Submitted' :
                                                    assign.status === 'missing' ? 'Missing' : 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium">
                                        {assign.status === 'graded' || assign.status === 'returned' ? (
                                            <span className="text-indigo-600">{assign.score} / {assign.maxScore}</span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {recentAssignments.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        No recent assignments found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StudentReport;
