import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Globe, School, Users, BookOpen } from 'lucide-react';
import api from '../../utils/api';

const RootAdminReport = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/reports/admin/overview');
                setStats(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div>Loading Global Stats...</div>;
    if (!stats) return <div>Data unavailable</div>;

    const data = [
        { name: 'Schools', value: stats.totalSchools },
        { name: 'Users', value: stats.totalUsers },
        { name: 'Classrooms', value: stats.totalClassrooms },
        { name: 'Assignments', value: stats.totalAssignments },
    ];

    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];

    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex items-center space-x-3 sm:space-x-4 mb-6 sm:mb-8">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-2 sm:p-3 rounded-xl text-white shadow-lg">
                    <Globe size={24} className="sm:w-8 sm:h-8" />
                </div>
                <div>
                    <h2 className="text-xl sm:text-3xl font-bold text-gray-900">Platform Overview</h2>
                    <p className="text-xs sm:text-sm text-gray-500">Global System Statistics</p>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-gray-500 font-medium text-xs sm:text-sm">Schools</h3>
                        <School className="text-indigo-500 w-4 h-4 sm:w-6 sm:h-6" />
                    </div>
                    <p className="text-xl sm:text-4xl font-bold text-gray-900">{stats.totalSchools}</p>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-gray-500 font-medium text-xs sm:text-sm">Users</h3>
                        <Users className="text-green-500 w-4 h-4 sm:w-6 sm:h-6" />
                    </div>
                    <p className="text-xl sm:text-4xl font-bold text-gray-900">{stats.totalUsers}</p>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-gray-500 font-medium text-xs sm:text-sm">Classes</h3>
                        <BookOpen className="text-yellow-500 w-4 h-4 sm:w-6 sm:h-6" />
                    </div>
                    <p className="text-xl sm:text-4xl font-bold text-gray-900">{stats.totalClassrooms}</p>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-gray-500 font-medium text-xs sm:text-sm">Assignments</h3>
                        <div className="text-red-500 font-bold text-base sm:text-xl">A+</div>
                    </div>
                    <p className="text-xl sm:text-4xl font-bold text-gray-900">{stats.totalAssignments}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Distribution</h3>
                    <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-200">
                        <div className="min-w-[500px] sm:min-w-full h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#8884d8">
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 block sm:hidden text-center">← Swipe to see more →</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Platform Composition</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RootAdminReport;
