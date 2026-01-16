import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import StudentReportTable from '../../components/Reports/StudentReportTable';
import AllStudentsReportTable from '../../components/Reports/AllStudentsReportTable';
import api from '../../utils/api';

const TeacherReport = () => {
    const [classrooms, setClassrooms] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch Classrooms on mount
    useEffect(() => {
        const fetchClassrooms = async () => {
            try {
                const res = await api.get('/classrooms');
                // Filter if necessary, but backend usually handles "my classrooms"
                const options = res.data.classrooms.map(c => ({ value: c._id, label: c.name }));
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
                const res = await api.get(`/reports/class/${selectedClass.value}`);
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                            <div className="flex items-center space-x-3 mb-1 sm:mb-2">
                                <Users className="opacity-80" size={20} />
                                <h3 className="text-sm sm:text-base font-medium opacity-90">Total Students</h3>
                            </div>
                            <p className="text-xl sm:text-3xl font-bold">{reportData.classroom.studentCount}</p>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-xl p-4 sm:p-6 shadow-sm">
                            <div className="flex items-center space-x-3 mb-1 sm:mb-2 text-green-600">
                                <FileText size={20} />
                                <h3 className="text-sm sm:text-base font-medium text-gray-600">Assignments</h3>
                            </div>
                            <p className="text-xl sm:text-3xl font-bold text-gray-800">{reportData.assignmentStats.length}</p>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-xl p-4 sm:p-6 shadow-sm">
                            <div className="flex items-center space-x-3 mb-1 sm:mb-2 text-blue-600">
                                <TrendingUp size={20} />
                                <h3 className="text-sm sm:text-base font-medium text-gray-600">Class Avg</h3>
                            </div>
                            {/* Calculate overall average from assignments avg */}
                            <p className="text-xl sm:text-3xl font-bold text-gray-800">
                                {(reportData.assignmentStats.reduce((acc, curr) => acc + curr.averageScore, 0) / (reportData.assignmentStats.length || 1)).toFixed(1)}%
                            </p>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-6">Assignment Performance Averages</h3>
                            <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-200">
                                <div className="min-w-[600px] sm:min-w-full h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={reportData.assignmentStats}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="title" hide />
                                            <YAxis />
                                            <Tooltip labelStyle={{ color: 'black' }} />
                                            <Bar dataKey="averageScore" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg Score ( % )" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 block sm:hidden text-center">← Swipe to see more →</p>
                            <p className="text-xs text-center text-gray-400 mt-2">Assignments (Chronological)</p>
                        </div>

                        {/* Student Leaderboard / At Risk */}
                        {/* Student Leaderboard / At Risk - Replaced with Full Table */}
                        <div className="md:col-span-2">
                            <StudentReportTable students={reportData.studentStats} classroomName={reportData.classroom.name} />
                        </div>
                    </div>

                    {/* All Students Overview Table */}
                    <div className="mt-8">
                        <AllStudentsReportTable />
                    </div>
                </>
            )}
        </div>
    );
};

export default TeacherReport;
