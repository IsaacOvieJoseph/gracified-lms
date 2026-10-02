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
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Select Classroom</label>
                <Select
                    options={classrooms}
                    value={selectedClass}
                    onChange={setSelectedClass}
                    className="modern-select"
                    classNamePrefix="react-select"
                />
            </div>

            {loading && <div className="py-10 text-center text-gray-500">Loading Report...</div>}

            {!loading && reportData && (
                <>
                    {/* Top Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-slide-up">
                        <div className="bg-primary/10 rounded-xl p-6 text-primary border border-primary/20 shadow-none transition-all hover:-translate-y-1 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                <Users size={64} />
                            </div>
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-3 bg-primary rounded-xl text-white shadow-none"><Users size={20} /></div>
                                <h3 className="text-xs font-semibold tracking-wide opacity-80">Total Students</h3>
                            </div>
                            <p className="text-3xl sm:text-4xl font-semibold">{reportData.classroom.studentCount}</p>
                        </div>
                        <div className="bg-card  border border-border/50 rounded-xl p-6 shadow-none transition-all hover:-translate-y-1 hover:border-emerald-500/30 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                <FileText size={64} className="text-emerald-500" />
                            </div>
                            <div className="flex items-center space-x-3 mb-4 text-emerald-500">
                                <div className="p-3 bg-emerald-500/10 rounded-xl"><FileText size={20} /></div>
                                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">Assignments</h3>
                            </div>
                            <p className="text-3xl sm:text-4xl font-semibold text-foreground">{reportData.assignmentStats.length}</p>
                        </div>
                        <div className="bg-card  border border-border/50 rounded-xl p-6 shadow-none transition-all hover:-translate-y-1 hover:border-blue-500/30 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                <TrendingUp size={64} className="text-blue-500" />
                            </div>
                            <div className="flex items-center space-x-3 mb-4 text-blue-500">
                                <div className="p-3 bg-primary/10 rounded-xl"><TrendingUp size={20} /></div>
                                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">Class Average</h3>
                            </div>
                            {/* Calculate overall average from assignments avg */}
                            <p className="text-3xl sm:text-4xl font-semibold text-foreground">
                                {(reportData.assignmentStats.reduce((acc, curr) => acc + curr.averageScore, 0) / (reportData.assignmentStats.length || 1)).toFixed(1)}%
                            </p>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <div className="bg-card  p-8 rounded-xl border border-border/50 shadow-none relative overflow-hidden group hover:border-primary/30 transition-all">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                                <TrendingUp className="w-48 h-48 text-primary" />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground mb-8 tracking-wide px-2 relative z-10">Assignment Performance</h3>
                            <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted relative z-10">
                                <div className="min-w-[600px] sm:min-w-full h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={reportData.assignmentStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                                            <XAxis dataKey="title" hide />
                                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                                            <Tooltip 
                                                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '1.5rem', fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
                                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                            />
                                            <Bar dataKey="averageScore" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Avg Score (%)" barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <p className="text-xs font-semibold text-muted-foreground/40 mt-4 block sm:hidden text-center tracking-wide relative z-10">← Swipe to analyze →</p>
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
