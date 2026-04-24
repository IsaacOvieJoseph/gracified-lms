import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import StudentReport from './StudentReport';
import TeacherReport from './TeacherReport';
import SchoolAdminReport from './SchoolAdminReport';
import RootAdminReport from './RootAdminReport';
import Layout from '../../components/Layout';
import { Activity, BarChart2 } from 'lucide-react';

const Reports = () => {
    const { user } = useAuth();
    const [role, setRole] = useState(null);

    useEffect(() => {
        if (user) {
            setRole(user.role);
        }
    }, [user]);

    if (!role) return <div>Loading...</div>;

    const renderReportView = () => {
        switch (role) {
            case 'student':
                return <StudentReport />;
            case 'teacher':
            case 'personal_teacher':
                return <TeacherReport />;
            case 'school_admin':
                return <SchoolAdminReport />;
            case 'root_admin':
                return <RootAdminReport />;
            default:
                return <div>Unknown role</div>;
        }
    };

    return (
        <Layout>
            <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-primary/10 rounded-2xl shrink-0 border border-primary/20 shadow-lg shadow-primary/5">
                        <Activity className="w-8 h-8 text-primary animate-pulse-slow" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-black text-foreground leading-tight italic uppercase tracking-tighter">Reports & <span className="text-primary not-italic">Analytics</span></h1>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1 opacity-60">Performance Overview</p>
                    </div>
                </div>
            </div>

            <div className="bg-card/30 backdrop-blur-md rounded-[2.5rem] border border-border/50 p-4 sm:p-10 min-h-[600px] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-primary/5 blur-[100px] rounded-full group-hover:bg-primary/10 transition-colors duration-1000"></div>
                <div className="relative z-10">
                    {renderReportView()}
                </div>
            </div>
        </Layout>
    );
};

export default Reports;
