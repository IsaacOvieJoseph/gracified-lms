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

    const colors = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444'];

    return (
        <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden mb-6 sm:mb-8 animate-slide-up">
            <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-primary/5 blur-[80px] rounded-full pointer-events-none"></div>
            <div className="flex items-center space-x-5 relative z-10">
                <div className="bg-primary/10 p-4 rounded-2xl text-primary border border-primary/20 shadow-lg shadow-primary/5">
                    <Globe className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black italic text-foreground tracking-tighter uppercase">Global <span className="text-primary not-italic hidden xs:inline opacity-80">Overview</span></h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 mt-1">Global Platform Statistics</p>
                </div>
            </div>
        </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="bg-card/40 backdrop-blur-md p-6 rounded-[2rem] border border-border/50 shadow-xl transition-all hover:border-primary/30 hover:-translate-y-1 group">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-muted-foreground font-black uppercase text-[10px] tracking-widest italic leading-none opacity-60">Schools</h3>
                        <div className="p-3 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform"><School className="text-primary w-5 h-5" /></div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-black text-foreground italic tracking-tight">{stats.totalSchools}</p>
                </div>
                <div className="bg-card/40 backdrop-blur-md p-6 rounded-[2rem] border border-border/50 shadow-xl transition-all hover:border-emerald-500/30 hover:-translate-y-1 group">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-muted-foreground font-black uppercase text-[10px] tracking-widest italic leading-none opacity-60">Users</h3>
                        <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform"><Users className="text-emerald-500 w-5 h-5" /></div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-black text-foreground italic tracking-tight">{stats.totalUsers}</p>
                </div>
                <div className="bg-card/40 backdrop-blur-md p-6 rounded-[2rem] border border-border/50 shadow-xl transition-all hover:border-amber-500/30 hover:-translate-y-1 group">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-muted-foreground font-black uppercase text-[10px] tracking-widest italic leading-none opacity-60">Classes</h3>
                        <div className="p-3 bg-amber-500/10 rounded-xl group-hover:scale-110 transition-transform"><BookOpen className="text-amber-500 w-5 h-5" /></div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-black text-foreground italic tracking-tight">{stats.totalClassrooms}</p>
                </div>
                <div className="bg-card/40 backdrop-blur-md p-6 rounded-[2rem] border border-border/50 shadow-xl transition-all hover:border-rose-500/30 hover:-translate-y-1 group">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-muted-foreground font-black uppercase text-[10px] tracking-widest italic leading-none opacity-60">Assessments</h3>
                        <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500 font-black text-xs group-hover:scale-110 transition-transform">A+</div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-black text-foreground italic tracking-tight">{stats.totalAssignments}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <div className="bg-card/40 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border border-border/50 relative overflow-hidden group hover:border-primary/30 transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                        <Globe className="w-48 h-48 text-primary" />
                    </div>
                    <h3 className="text-sm font-black italic text-foreground mb-8 uppercase tracking-widest px-2 relative z-10">Data Distribution</h3>
                    <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted relative z-10">
                        <div className="min-w-[500px] sm:min-w-full h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.2} />
                                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900, textTransform: 'uppercase' }} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                                    <Tooltip 
                                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '1.5rem', fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={40}>
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <p className="text-[9px] font-black italic text-muted-foreground/40 mt-4 block sm:hidden text-center uppercase tracking-widest relative z-10">← Swipe to analyze →</p>
                </div>

                <div className="bg-card/40 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border border-border/50 relative overflow-hidden group hover:border-primary/30 transition-all">
                    <h3 className="text-sm font-black italic text-foreground mb-8 uppercase tracking-widest px-2 relative z-10">Platform Breakdown</h3>
                    <div className="h-80 relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
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
        </div>
    );
};

export default RootAdminReport;
