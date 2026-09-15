import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { School, Users, BookOpen, TrendingUp, Eye, X } from 'lucide-react';
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

    // Fetch report when selected school changes or header school changes
    useEffect(() => {
        const syncSelectedSchool = async () => {
            try {
                // Get selected school from localStorage (synced with header)
                const savedStr = localStorage.getItem('selectedSchools');
                const saved = savedStr ? JSON.parse(savedStr) : [];
                const activeId = saved[0];

                // Fetch school list to get names and check if activeId is valid
                const res = await api.get('/schools');
                const schoolList = res.data.schools || [];
                setSchools(schoolList.map(s => ({ value: s._id, label: s.name })));

                let targetSchool = null;
                if (activeId) {
                    const found = schoolList.find(s => s._id === activeId);
                    if (found) targetSchool = { value: found._id, label: found.name };
                } else {
                    // "All Schools" selected in header (empty array)
                    targetSchool = { value: 'all', label: 'All Schools' };
                }

                // Final fallback
                if (!targetSchool && schoolList.length > 0) {
                    targetSchool = { value: 'all', label: 'All Schools' };
                }

                setSelectedSchool(targetSchool);
            } catch (error) {
                console.error("Sync error:", error);
                setLoading(false);
            }
        };

        syncSelectedSchool();

        // Listen for global school changes
        const handleGlobalChange = () => syncSelectedSchool();
        window.addEventListener('schoolSelectionChanged', handleGlobalChange);
        return () => window.removeEventListener('schoolSelectionChanged', handleGlobalChange);
    }, []);

    // Fetch report when selectedSchool state updates
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
        <>
        <div className="space-y-6 sm:space-y-8 animate-slide-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card  border border-border/50 rounded-xl p-8 shadow-none relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5  rounded-full pointer-events-none"></div>
                <div className="flex items-center space-x-5 relative z-10">
                    <div className="bg-primary/10 p-4 rounded-xl text-primary border border-primary/20 shadow-none ">
                        <School className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">{schoolName} <span className="text-primary not-italic hidden xs:inline opacity-80">Dashboard</span></h2>
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground/80 mt-1">School Overview</p>
                    </div>
                </div>

                {/* Internal school selector removed - uses header switcher */}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-card  p-6 rounded-xl border border-border/50 shadow-none flex items-center justify-between group hover:border-primary/30 transition-all hover:-translate-y-1">
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-1 opacity-60">Total Students</p>
                        <p className="text-3xl font-semibold text-foreground">{totalStudents}</p>
                    </div>
                    <div className="bg-primary/10 p-4 rounded-xl text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                        <Users size={24} />
                    </div>
                </div>
                <div className="bg-card  p-6 rounded-xl border border-border/50 shadow-none flex items-center justify-between group hover:border-primary/40 transition-all hover:-translate-y-1">
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-1 opacity-60">Total Classes</p>
                        <p className="text-3xl font-semibold text-foreground">{totalClassrooms}</p>
                    </div>
                    <div className="bg-primary/10 p-4 rounded-xl text-primary border border-primary/30 group-hover:scale-110 transition-transform">
                        <BookOpen size={24} />
                    </div>
                </div>
                <div className="bg-card  p-6 rounded-xl border border-border/50 shadow-none flex items-center justify-between group transition-all hover:-translate-y-1">
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-1 opacity-60">Average Score</p>
                        <p className={`text-3xl font-semibold ${overallAverage >= 70 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {overallAverage}%
                        </p>
                    </div>
                    <div className={`${overallAverage >= 70 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'} p-4 rounded-xl border group-hover:scale-110 transition-transform`}>
                        <TrendingUp size={24} />
                    </div>
                </div>
            </div>

            {/* Main Chart */}
            <div className="bg-card  p-8 rounded-xl border border-border/50 shadow-none relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                    <TrendingUp className="w-48 h-48 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-8 tracking-wide px-2 relative z-10">Class Performance Overview</h3>
                <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted relative z-10">
                    <div className="min-w-[800px] sm:min-w-full h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={classPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900, textTransform: 'uppercase' }} />
                                <YAxis unit="%" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                                <Tooltip 
                                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} 
                                    contentStyle={{ 
                                        backgroundColor: 'hsl(var(--card))', 
                                        borderColor: 'hsl(var(--border))',
                                        borderRadius: '12px',
                                        color: 'hsl(var(--foreground))'
                                    }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Legend />
                                <Bar dataKey="averagePercentage" name="Average Score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                                <Bar dataKey="attendancePercentage" name="Avg Attendance" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 block sm:hidden text-center">← Swipe to see more →</p>
            </div>

            {/* Detailed Table */}
            <div className="bg-card  rounded-xl shadow-none border border-border/50 overflow-hidden mt-8">
                <div className="p-8 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between bg-muted/10 gap-4">
                    <div>
                        <h3 className="text-2xl font-semibold text-foreground tracking-tight">Class Breakdown</h3>
                        <p className="text-xs font-semibold text-muted-foreground tracking-wide mt-1 opacity-60">Detailed Performance Data</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-muted text-muted-foreground text-xs font-semibold tracking-wide">
                            <tr>
                                <th className="px-8 py-6">Class Name</th>
                                <th className="px-8 py-6 text-center">Students</th>
                                <th className="px-8 py-6 text-center">Assignments</th>
                                <th className="px-8 py-6 text-right">Avg Attendance</th>
                                <th className="px-8 py-6 text-right w-64">Avg Score</th>
                                <th className="px-8 py-6 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50 text-sm">
                            {classPerformance.map((cls) => (
                                <tr key={cls.id} className="hover:bg-primary/5 transition-colors group">
                                    <td className="px-8 py-6 font-semibold text-foreground tracking-tight">{cls.name}</td>
                                    <td className="px-8 py-6 text-center font-semibold text-muted-foreground/80">{cls.studentCount}</td>
                                    <td className="px-8 py-6 text-center font-semibold text-muted-foreground/80">{cls.assignmentCount}</td>
                                    <td className="px-8 py-6 text-right font-semibold text-muted-foreground/80">{cls.attendancePercentage}%</td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end space-x-4">
                                            <span className="font-semibold text-foreground">{cls.averagePercentage}%</span>
                                            <div className="w-32 h-2.5 bg-muted rounded-full overflow-hidden border border-border/50 shadow-none">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${cls.averagePercentage >= 75 ? 'bg-emerald-500' :
                                                        cls.averagePercentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                                        }`}
                                                    style={{ width: `${cls.averagePercentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button
                                            onClick={() => setViewingClass(cls)}
                                            className="p-2.5 text-primary bg-primary/5 hover:bg-primary hover:text-white rounded-xl transition-all shadow-none"
                                            title="View Report"
                                        >
                                            <Eye size={18} />
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
        </div>

        {/* Class Details Modal */}
            {viewingClass && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80  p-4">
                    <div className="bg-card w-full max-w-5xl max-h-[90vh] rounded-xl shadow-none overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-border">
                        <div className="p-8 border-b border-border flex justify-between items-center bg-card sticky top-0 z-10">
                            <div>
                                <h3 className="text-2xl font-semibold text-foreground tracking-tight leading-tight">Class Report</h3>
                                <p className="text-xs font-semibold text-muted-foreground tracking-wide mt-1">Detailed performance metrics for <span className="text-primary tracking-tight">{viewingClass.name}</span></p>
                            </div>
                            <button
                                onClick={() => setViewingClass(null)}
                                className="w-12 h-12 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-primary hover:text-white transition-all active:scale-95 shadow-none"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                                    <p className="text-muted-foreground font-semibold tracking-wide text-xs">Loading Data...</p>
                                </div>
                            ) : classDetails ? (
                                <div className="animate-slide-up">
                                    <StudentReportTable students={classDetails.studentStats} classroomName={viewingClass.name} />
                                </div>
                            ) : (
                                <div className="text-center py-20 text-muted-foreground font-medium">Details not available for this classroom at this time.</div>
                            )}
                        </div>
                        <div className="p-6 bg-card border-t border-border flex justify-end">
                            <button
                                onClick={() => setViewingClass(null)}
                                className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-none "
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SchoolAdminReport;
