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
            <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 bg-indigo-100 rounded-lg shrink-0">
                        <BarChart2 className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 leading-tight">Performance Reports</h1>
                        <p className="text-sm sm:text-base text-gray-500 hidden xs:block">View analytics and performance metrics</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-6 min-h-[500px]">
                {renderReportView()}
            </div>
        </Layout>
    );
};

export default Reports;
