import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import StudentReport from './StudentReport';
import TeacherReport from './TeacherReport';
import SchoolAdminReport from './SchoolAdminReport';
import RootAdminReport from './RootAdminReport';
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
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8 flex items-center gap-3">
                <div className="p-3 bg-indigo-100 rounded-lg">
                    <BarChart2 className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Performance Reports</h1>
                    <p className="text-gray-500">View analytics and performance metrics</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[600px]">
                {renderReportView()}
            </div>
        </div>
    );
};

export default Reports;
