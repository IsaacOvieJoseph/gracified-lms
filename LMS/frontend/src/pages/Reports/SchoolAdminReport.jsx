import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { School, Users, BookOpen, TrendingUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

const SchoolAdminReport = () => {
    const { user } = useAuth();
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSchoolReport = async () => {
            try {
                // If school_admin has multiple schools, we might need a selector.
                // For now, assume first school ID in array or field
                let schoolId = null;
                if (Array.isArray(user.schoolId) && user.schoolId.length > 0) {
                    schoolId = user.schoolId[0];
                } else if (user.schoolId) {
                    schoolId = user.schoolId;
                }

                if (!schoolId) {
                    setLoading(false);
                    return; // No school assigned
                }

                const token = localStorage.getItem('token');
                const res = await axios.get(`http://localhost:5000/api/reports/school/${schoolId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setReportData(res.data);

            } catch (error) {
                console.error(error);
                toast.error("Failed to fetch school report");
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchSchoolReport();
        }
    }, [user]);

    if (loading) return <div className="p-10 text-center">Loading School Analytics...</div>;
    if (!reportData) return <div className="p-10 text-center text-gray-500">No school data found.</div>;

    const { schoolName, totalStudents, totalClassrooms, overallAverage, classPerformance } = reportData;

    return (
        <div className="space-y-8">
            <div className="flex items-center space-x-4 mb-4">
                <div className="bg-indigo-600 p-2 rounded-lg text-white">
                    <School size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{schoolName} <span className="text-gray-400 font-normal">Dashboard</span></h2>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Total Students</p>
                        <p className="text-3xl font-bold text-gray-900">{totalStudents}</p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                        <Users size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Active Classes</p>
                        <p className="text-3xl font-bold text-gray-900">{totalClassrooms}</p>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                        <BookOpen size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">School Average</p>
                        <p className={`text-3xl font-bold ${overallAverage >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                            {overallAverage}%
                        </p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-full text-green-600">
                        <TrendingUp size={24} />
                    </div>
                </div>
            </div>

            {/* Main Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Classroom Performance Overview</h3>
                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={classPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis unit="%" />
                            <Tooltip cursor={{ fill: '#f3f4f6' }} />
                            <Legend />
                            <Bar dataKey="averagePercentage" name="Average Score" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">Classroom Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Class Name</th>
                                <th className="px-6 py-4 text-center">Students</th>
                                <th className="px-6 py-4 text-center">Assignments</th>
                                <th className="px-6 py-4 text-right">Avg Performance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {classPerformance.map((cls) => (
                                <tr key={cls.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{cls.name}</td>
                                    <td className="px-6 py-4 text-center text-gray-600">{cls.studentCount}</td>
                                    <td className="px-6 py-4 text-center text-gray-600">{cls.assignmentCount}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            <span className="font-bold">{cls.averagePercentage}%</span>
                                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${cls.averagePercentage >= 75 ? 'bg-green-500' :
                                                            cls.averagePercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                        }`}
                                                    style={{ width: `${cls.averagePercentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SchoolAdminReport;
