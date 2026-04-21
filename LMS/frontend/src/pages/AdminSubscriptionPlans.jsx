import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { 
  Plus, Edit, Trash2, Eye, EyeOff, Loader2, 
  CheckCircle, XCircle, CreditCard, Clock, 
  ShieldCheck, UserPlus, Users, Search
} from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatAmount } from '../utils/currency';

const AdminSubscriptionPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  
  // Free Access issuance state
  const [showFreeAccessModal, setShowFreeAccessModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [durationDays, setDurationDays] = useState(30);
  const [userSearchText, setUserSearchText] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    planType: 'monthly',
    price: 0,
    durationDays: 30,
    revenueSharePercentage: 0,
    features: '',
    isActive: true
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/subscription-plans');
      // By default the GET route only returns active plans if we don't handle it differently
      // Let's check backend/routes/subscriptionPlans.js line 9: const plans = await SubscriptionPlan.find({ isActive: true });
      // We might need to change the backend to allow root_admin to see all plans
      setPlans(response.data.plans);
    } catch (error) {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPlanModal = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        description: plan.description || '',
        planType: plan.planType,
        price: plan.price,
        durationDays: plan.durationDays,
        revenueSharePercentage: plan.revenueSharePercentage || 0,
        features: plan.features.join(', '),
        isActive: plan.isActive
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        description: '',
        planType: 'monthly',
        price: 0,
        durationDays: 30,
        revenueSharePercentage: 0,
        features: '',
        isActive: true
      });
    }
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        features: formData.features.split(',').map(f => f.trim()).filter(f => f)
      };

      if (editingPlan) {
        await api.put(`/subscription-plans/${editingPlan._id}`, payload);
        toast.success('Plan updated successfully');
      } else {
        await api.post('/subscription-plans', payload);
        toast.success('Plan created successfully');
      }
      setShowPlanModal(false);
      fetchPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    try {
      await api.delete(`/subscription-plans/${planToDelete._id}`);
      toast.success('Plan deleted successfully');
      setShowDeleteModal(false);
      setPlanToDelete(null);
      fetchPlans();
    } catch (error) {
      toast.error('Failed to delete plan');
    }
  };

  const handleToggleActive = async (plan) => {
    try {
      await api.put(`/subscription-plans/${plan._id}`, { ...plan, isActive: !plan.isActive });
      toast.success(`Plan ${!plan.isActive ? 'activated' : 'deactivated'}`);
      fetchPlans();
    } catch (error) {
      toast.error('Failed to update plan status');
    }
  };

  // User search for free access
  useEffect(() => {
    if (userSearchText.length > 2) {
      const timer = setTimeout(() => {
        searchUsers();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [userSearchText]);

  const searchUsers = async () => {
    setSearchingUsers(true);
    try {
      // Find eligible users (school admins and personal teachers)
      const response = await api.get(`/users?search=${userSearchText}`);
      const filtered = response.data.users.filter(u => 
        ['school_admin', 'personal_teacher'].includes(u.role)
      );
      setUsers(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleIssueFreeAccess = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/user-subscriptions/issue-free-access', {
        userIds: selectedUsers.map(u => u._id),
        durationDays
      });
      toast.success('Free access issued successfully');
      setShowFreeAccessModal(false);
      setSelectedUsers([]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to issue free access');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <CreditCard className="w-6 h-6" />
              </div>
              Subscription Plans
            </h2>
            <p className="text-slate-500 font-medium mt-1">Manage platform subscription plans and user access</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFreeAccessModal(true)}
              className="px-5 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Issue Free Access
            </button>
            <button
              onClick={() => handleOpenPlanModal()}
              className="btn-premium"
            >
              <Plus className="w-5 h-5" />
              Create New Plan
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="card-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Plan Name</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Price</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Duration</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plans.map((plan) => (
                    <tr key={plan._id} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{plan.name}</span>
                          <span className="text-xs text-slate-500 line-clamp-1">{plan.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-600 capitalize">{plan.planType.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-slate-900">{formatAmount(plan.price)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                          <Clock className="w-4 h-4 opacity-40" />
                          {plan.durationDays} Days
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleToggleActive(plan)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                            plan.isActive 
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {plan.isActive ? (
                            <><CheckCircle className="w-3 h-3" /> Active</>
                          ) : (
                            <><EyeOff className="w-3 h-3" /> Hidden</>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenPlanModal(plan)}
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Edit Plan"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setPlanToDelete(plan);
                              setShowDeleteModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Plan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {plans.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium">
                        No subscription plans found. Create one to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Plan Modal */}
        {showPlanModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] overflow-y-auto p-4 flex items-center justify-center">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full animate-slide-up overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    {editingPlan ? <Edit className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h3>
                    <p className="text-sm text-slate-500 font-medium">Configure plan details and pricing</p>
                  </div>
                </div>
                <button onClick={() => setShowPlanModal(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSavePlan} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Plan Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all outline-none"
                      placeholder="e.g. Professional Monthly"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Plan Type</label>
                    <select
                      value={formData.planType}
                      onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all outline-none appearance-none"
                      required
                    >
                      <option value="trial">Free Trial</option>
                      <option value="pay_as_you_go">Pay As You Go</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Price (₦)</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all outline-none"
                      placeholder="0"
                      min="0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Duration (Days)</label>
                    <input
                      type="number"
                      value={formData.durationDays}
                      onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all outline-none"
                      placeholder="30"
                      min="1"
                      required
                    />
                  </div>
                  {formData.planType === 'pay_as_you_go' && (
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Revenue Share (%)</label>
                      <input
                        type="number"
                        value={formData.revenueSharePercentage}
                        onChange={(e) => setFormData({ ...formData, revenueSharePercentage: parseFloat(e.target.value) })}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all outline-none"
                        placeholder="0"
                        min="0"
                        max="100"
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all outline-none min-h-[100px]"
                      placeholder="Write a short description of this plan..."
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Features (Comma separated)</label>
                    <textarea
                      value={formData.features}
                      onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all outline-none min-h-[80px]"
                      placeholder="e.g. Unlimited Students, Advanced Reports, 24/7 Support"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPlanModal(false)}
                    className="px-8 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-premium px-12"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingPlan ? 'Update Plan' : 'Create Plan')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Free Access Modal */}
        {showFreeAccessModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] overflow-y-auto p-4 flex items-center justify-center">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full animate-slide-up overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Issue Free Access</h3>
                    <p className="text-sm text-slate-500 font-medium">Grant free access to selected users</p>
                  </div>
                </div>
                <button onClick={() => setShowFreeAccessModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <XCircle className="w-8 h-8" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Search Users</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={userSearchText}
                      onChange={(e) => setUserSearchText(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                      placeholder="Type name or email..."
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    {searchingUsers && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-indigo-500" />}
                  </div>
                  
                  {/* Search Results */}
                  {users.length > 0 && userSearchText.length > 2 && (
                    <div className="mt-2 max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-lg divide-y divide-slate-50">
                      {users.map(u => (
                        <button
                          key={u._id}
                          onClick={() => {
                            if (!selectedUsers.find(su => su._id === u._id)) {
                              setSelectedUsers([...selectedUsers, u]);
                            }
                            setUserSearchText('');
                            setUsers([]);
                          }}
                          className="w-full p-3 text-left hover:bg-slate-50 flex items-center justify-between group"
                        >
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-indigo-600">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email} • {u.role.replace(/_/g, ' ')}</p>
                          </div>
                          <Plus className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Users Chips */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(u => (
                      <div key={u._id} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100">
                        {u.name}
                        <button onClick={() => setSelectedUsers(selectedUsers.filter(su => su._id !== u._id))}>
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Duration (Days)</label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(parseInt(e.target.value))}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                    placeholder="30"
                    min="1"
                    required
                  />
                </div>

                <button
                  onClick={handleIssueFreeAccess}
                  disabled={submitting || selectedUsers.length === 0}
                  className="w-full btn-premium py-5 text-lg"
                >
                  {submitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Grant Free Access'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeletePlan}
          title="Delete Plan"
          message={`Are you sure you want to delete the plan "${planToDelete?.name}"? This action cannot be undone.`}
          confirmText="Delete Plan"
          confirmColor="bg-red-600"
        />
      </div>
    </Layout>
  );
};

export default AdminSubscriptionPlans;
