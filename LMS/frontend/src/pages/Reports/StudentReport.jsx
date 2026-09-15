import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BookOpen, CheckCircle, Clock, Award, Users } from 'lucide-react';
import StudentAcademicReportSheet from '../../components/Reports/StudentAcademicReportSheet';
import api from '../../utils/api';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444'];

const StudentReport = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get('/reports/student/me');
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
        <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-card  border border-border/50 rounded-xl p-8 shadow-none relative overflow-hidden mb-6 sm:mb-8 animate-slide-up">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5  rounded-full pointer-events-none"></div>
                <div className="flex items-center space-x-5 relative z-10">
                    <div className="bg-primary/10 p-4 rounded-xl text-primary border border-primary/20 shadow-none ">
                        <Users className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Performance <span className="text-primary not-italic hidden xs:inline opacity-80">Overview</span></h2>
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground mt-1">Synchronized academic report for student <span className="text-primary font-semibold">{student?.name}</span></p>
                    </div>
                </div>
                <div className="text-xs tracking-wide font-semibold text-muted-foreground bg-muted px-5 py-3 rounded-xl border border-border/50 shadow-none opacity-80 relative z-10">
                    ID: {student?.email}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-none flex flex-col items-center justify-center text-center transition-all hover:border-primary/20 hover:scale-[1.02] group">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary mb-3 group-hover:bg-primary group-hover:text-white transition-colors">
                        <BookOpen size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-semibold tracking-wide mb-1 opacity-60">Assignments</p>
                        <p className="text-2xl font-semibold text-foreground">{summary.totalAssignments}</p>
                    </div>
                </div>

                <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-none flex flex-col items-center justify-center text-center transition-all hover:border-emerald-500/20 hover:scale-[1.02] group">
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 mb-3 group-hover:bg-success/90 group-hover:text-white transition-colors">
                        <CheckCircle size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-semibold tracking-wide mb-1 opacity-60">Submitted</p>
                        <p className="text-2xl font-semibold text-foreground">{summary.submittedCount}</p>
                    </div>
                </div>

                <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-none flex flex-col items-center justify-center text-center transition-all hover:border-amber-500/20 hover:scale-[1.02] group">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 mb-3 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                        <Clock size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-semibold tracking-wide mb-1 opacity-60">Pending</p>
                        <p className="text-2xl font-semibold text-foreground">{summary.pendingCount}</p>
                    </div>
                </div>

                <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-none flex flex-col items-center justify-center text-center transition-all hover:border-primary/20 hover:scale-[1.02] group">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary mb-3 group-hover:bg-primary group-hover:text-white transition-colors">
                        <Award size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-semibold tracking-wide mb-1 opacity-60">Avg Score</p>
                        <p className="text-2xl font-semibold text-foreground">{summary.overallPercentage}%</p>
                    </div>
                </div>

                <div className="bg-card p-4 sm:p-5 rounded-xl border-2 border-border/80 shadow-none flex flex-col items-center justify-center text-center transition-all hover:border-primary/40 col-span-2 md:col-span-1 group">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary mb-3 group-hover:bg-primary/90 group-hover:text-white transition-colors">
                        <Users size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-semibold tracking-wide mb-1 opacity-60">Attendance</p>
                        <p className="text-2xl font-semibold text-foreground">{summary.attendancePercentage}%</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Performance by Class Chart */}
                <div className="bg-card p-6 rounded-xl shadow-none border border-border transition-all hover:border-primary/10">
                    <h3 className="text-sm font-semibold text-foreground mb-6 tracking-wide px-2">Progress Report</h3>
                    <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted">
                        <div className="min-w-[600px] sm:min-w-full h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byClass.map(c => ({
                                    className: c.className,
                                    averagePercentage: c.averagePercentage,
                                    attendancePercentage: c.attendance?.percentage || 0
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                                    <XAxis dataKey="className" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900, textTransform: 'uppercase' }} />
                                    <YAxis unit="%" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                                    <Tooltip 
                                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '1.5rem', fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Legend iconType="circle" />
                                    <Bar dataKey="averagePercentage" name="Avg Score (%)" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={24} />
                                    <Bar dataKey="attendancePercentage" name="Attendance (%)" fill="#10b981" radius={[8, 8, 0, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground/40 mt-2 block sm:hidden text-center tracking-wide">← Swipe to analyze →</p>
                </div>

                {/* Completion Status Chart */}
                <div className="bg-card p-6 rounded-xl shadow-none border border-border transition-all hover:border-primary/10">
                    <h3 className="text-sm font-semibold text-foreground mb-6 tracking-wide px-2">Completion Status</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '1.5rem', fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Legend iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Academic Report Sheet (Official Table) */}
            <StudentAcademicReportSheet data={byClass} studentName={student?.name} />

            {/* Recent Activity Table */}
            <div className="bg-card  rounded-xl shadow-none border border-border/50 overflow-hidden mt-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <div className="p-8 border-b border-border/50 bg-muted/10 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-semibold text-foreground tracking-tight">Recent Activity</h3>
                        <p className="text-xs font-semibold text-muted-foreground tracking-wide mt-1 opacity-60">Recent Assignments</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-muted text-muted-foreground text-xs font-semibold tracking-wide">
                            <tr>
                                <th className="px-8 py-6 border-b border-border/50">Assignment Title</th>
                                <th className="px-8 py-6 border-b border-border/50">Class</th>
                                <th className="px-8 py-6 border-b border-border/50">Deadline</th>
                                <th className="px-8 py-6 border-b border-border/50">Status</th>
                                <th className="px-8 py-6 text-right border-b border-border/50 w-48">Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50 text-sm">
                            {recentAssignments.map((assign) => (
                                <tr key={assign.id} className="hover:bg-primary/5 transition-colors group">
                                    <td className="px-8 py-6 font-semibold text-foreground tracking-tight border-r border-border/30">{assign.title}</td>
                                    <td className="px-8 py-6 text-muted-foreground/80 font-semibold">{assign.className}</td>
                                    <td className="px-8 py-6 text-muted-foreground/80 font-semibold">
                                        {assign.dueDate ? new Date(assign.dueDate).toLocaleDateString() : 'No Due Date'}
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide shadow-none transition-all ${assign.status === 'graded' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-none' :
                                            assign.status === 'submitted' ? 'bg-primary/10 text-primary border border-primary/20 ' :
                                                assign.status === 'missing' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-none' :
                                                    'bg-muted text-muted-foreground border border-border/50'
                                            }`}>
                                            {assign.status === 'graded' ? 'Graded' :
                                                assign.status === 'submitted' ? 'Submitted' :
                                                    assign.status === 'missing' ? 'Missing' : 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right font-semibold text-foreground">
                                        {assign.status === 'graded' || assign.status === 'returned' ? (
                                            <span className="text-primary bg-primary/5 px-4 py-2 rounded-xl border border-primary/10 text-lg">{assign.score} / {assign.maxScore}</span>
                                        ) : (
                                            <span className="text-muted-foreground/30 text-lg">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {recentAssignments.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-8 py-12 text-center text-muted-foreground/40 font-semibold tracking-wide text-xs">
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
