import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { School, Users, BookOpen, TrendingUp, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Select from 'react-select';
import StudentReportTable from '../../components/Reports/StudentReportTable';
import AllStudentsReportTable from '../../components/Reports/AllStudentsReportTable';
import api from '../../utils/api';

const SchoolAdminReport = () => {
    const { user } = useAuth();
    const [schools, setSchools] = useState([]);
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [viewingClass, setViewingClass] = useState(null); // { id, name }
    const [classDetails, setClassDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Fetch Class Details when viewingClass is set
    useEffect(() => {
        if (!viewingClass) return;

        const fetchClassDetails = async () => {
            setLoadingDetails(true);
            try {
                const res = await api.get(`/reports/class/${viewingClass.id}`);
                setClassDetails(res.data);
            } catch (error) {
                console.error(error);
                toast.error("Failed to load class details");
                setViewingClass(null);
            } finally {
                setLoadingDetails(false);
            }
        };
        fetchClassDetails();
    }, [viewingClass]);

    // Fetch Admin's Schools on mount
    useEffect(() => {
        const fetchSchools = async () => {
            try {
                // For school admin, /api/schools returns their managed schools
                const res = await api.get('/schools');

                // The backend for GET /api/schools for school_admin returns { schools: [...] }
                const schoolList = res.data.schools || [];
                const options = schoolList.map(s => ({ value: s._id, label: s.name }));

                setSchools(options);

                if (options.length > 0) {
                    setSelectedSchool(options[0]);
                } else {
                    setLoading(false); // No schools found
                }
            } catch (error) {
                console.error(error);
                toast.error("Failed to fetch schools");
                setLoading(false);
            }
        };

        if (user) {
            fetchSchools();
        }
    }, [user]);

    // Fetch report when selected school changes
    useEffect(() => {
        if (!selectedSchool) return;

        const fetchSchoolReport = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/reports/school/${selectedSchool.value}`);
                setReportData(res.data);

            } catch (error) {
                console.error(error);
                toast.error("Failed to fetch school report");
            } finally {
                setLoading(false);
            }
        };

        fetchSchoolReport();
    }, [selectedSchool]);

    if (loading && !reportData) return <div className="p-10 text-center">Loading School Analytics...</div>;

    if (schools.length === 0 && !loading) return <div className="p-10 text-center text-gray-500">No schools assigned.</div>;

    if (!reportData) return null;

    const { schoolName, totalStudents, totalClassrooms, overallAverage, classPerformance } = reportData;

    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="bg-indigo-600 p-1.5 sm:p-2 rounded-lg text-white">
                        <School className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-2xl font-bold text-gray-900">{schoolName} <span className="text-gray-400 font-normal hidden xs:inline">Dashboard</span></h2>
                    </div>
                </div>

                {/* School Selector if multiple schools */}
                {schools.length > 1 && (
                    <div className="w-full md:w-64">
                        <Select
                            options={schools}
                            value={selectedSchool}
                            onChange={setSelectedSchool}
                            placeholder="Select School"
                            className="text-sm"
                        />
                    </div>
                )}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-500">Total Students</p>
                        <p className="text-xl sm:text-3xl font-bold text-gray-900">{totalStudents}</p>
                    </div>
                    <div className="bg-blue-100 p-2 sm:p-3 rounded-full text-blue-600">
                        <Users size={20} className="sm:w-6 sm:h-6" />
                    </div>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-500">Active Classes</p>
                        <p className="text-xl sm:text-3xl font-bold text-gray-900">{totalClassrooms}</p>
                    </div>
                    <div className="bg-purple-100 p-2 sm:p-3 rounded-full text-purple-600">
                        <BookOpen size={20} className="sm:w-6 sm:h-6" />
                    </div>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-500">School Average</p>
                        <p className={`text-xl sm:text-3xl font-bold ${overallAverage >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                            {overallAverage}%
                        </p>
                    </div>
                    <div className="bg-green-100 p-2 sm:p-3 rounded-full text-green-600">
                        <TrendingUp size={20} className="sm:w-6 sm:h-6" />
                    </div>
                </div>
            </div>

            {/* Main Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Classroom Performance Overview</h3>
                <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-200">
                    <div className="min-w-[800px] sm:min-w-full h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={classPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis unit="%" />
                                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                                <Legend />
                                <Bar dataKey="averagePercentage" name="Average Score" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                                <Bar dataKey="attendancePercentage" name="Avg Attendance" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 block sm:hidden text-center">← Swipe to see more →</p>
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
                                <th className="px-6 py-4 text-right">Avg Attendance</th>
                                <th className="px-6 py-4 text-right">Avg Performance</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {classPerformance.map((cls) => (
                                <tr key={cls.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{cls.name}</td>
                                    <td className="px-6 py-4 text-center text-gray-600">{cls.studentCount}</td>
                                    <td className="px-6 py-4 text-center text-gray-600">{cls.assignmentCount}</td>
                                    <td className="px-6 py-4 text-right font-medium text-gray-700">{cls.attendancePercentage}%</td>
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
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setViewingClass(cls)}
                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                            title="View Student Report Card"
                                        >
                                            <Eye size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* All Students Overview Table */}
            <div>
                <AllStudentsReportTable />
            </div>

            {/* Class Details Modal */}
            {viewingClass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">Report Card: {viewingClass.name}</h3>
                            <button onClick={() => setViewingClass(null)} className="text-gray-500 hover:text-gray-700">
                                &times; Close
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                            {loadingDetails ? (
                                <div className="text-center py-10">Loading Details...</div>
                            ) : classDetails ? (
                                <StudentReportTable students={classDetails.studentStats} classroomName={viewingClass.name} />
                            ) : (
                                <div className="text-center py-10">Details not available</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SchoolAdminReport;
