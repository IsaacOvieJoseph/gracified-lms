import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle, Clock, Banknote, User, Layout as LayoutIcon } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';

const Disbursements = () => {
    const { user } = useAuth();
    const [pendingPayouts, setPendingPayouts] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        if (user?.role === 'root_admin') {
            fetchData();
        }
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const endpoint = activeTab === 'pending' ? '/disbursements/pending' : '/disbursements/history';
            const response = await api.get(endpoint);
            if (activeTab === 'pending') {
                setPendingPayouts(response.data.payments);
            } else {
                setHistory(response.data.payments);
            }
        } catch (error) {
            console.error('Error fetching disbursements:', error);
            toast.error('Failed to load disbursements');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (paymentId) => {
        if (!window.confirm('Are you sure you want to approve this disbursement?')) return;

        setProcessingId(paymentId);
        try {
            await api.post(`/disbursements/approve/${paymentId}`);
            toast.success('Disbursement approved and marked as paid');
            fetchData();
        } catch (error) {
            console.error('Approval error:', error);
            toast.error(error.response?.data?.message || 'Failed to approve disbursement');
        } finally {
            setProcessingId(null);
        }
    };

    if (user?.role !== 'root_admin') {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <p className="text-xl text-gray-600">Access Denied: Admin only.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Banknote className="text-indigo-600" />
                        Disbursement Management
                    </h1>
                </div>

                <div className="flex gap-4 mb-6 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`pb-2 px-4 text-sm font-medium transition-colors ${activeTab === 'pending' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Pending Approval ({pendingPayouts.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`pb-2 px-4 text-sm font-medium transition-colors ${activeTab === 'history' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Payout History
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Class Owner</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Bank Details</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Payment Info</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Amount Due</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(activeTab === 'pending' ? pendingPayouts : history).map((item) => (
                                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                                    <User size={16} className="text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{item.payoutOwnerId?.name || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-500">{item.payoutOwnerId?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.payoutOwnerId?.bankDetails?.accountNumber ? (
                                                <div className="text-xs text-gray-600">
                                                    <p className="font-medium">{item.payoutOwnerId.bankDetails.bankName}</p>
                                                    <p>{item.payoutOwnerId.bankDetails.accountNumber}</p>
                                                    <p className="italic text-gray-400">{item.payoutOwnerId.bankDetails.accountName}</p>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-red-500 font-medium">No Bank Details</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-gray-600">
                                                <p className="flex items-center gap-1"><LayoutIcon size={12} /> {item.classroomId?.name || 'Class Enrollment'}</p>
                                                <p className="flex items-center gap-1 text-gray-400"><Clock size={12} /> {new Date(item.paymentDate).toLocaleDateString()}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900">
                                            {formatAmount(item.amount, item.currency)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {activeTab === 'pending' ? (
                                                <button
                                                    onClick={() => handleApprove(item._id)}
                                                    disabled={processingId === item._id || !item.payoutOwnerId?.bankDetails?.accountNumber}
                                                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {processingId === item._id ? 'Processing...' : 'Approve & Pay'}
                                                </button>
                                            ) : (
                                                <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                                                    <CheckCircle size={14} /> Paid
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {(activeTab === 'pending' ? pendingPayouts : history).length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-10 text-center text-gray-500 italic">
                                            No {activeTab} disbursements found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Disbursements;
