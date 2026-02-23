import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { User, CreditCard, Save, Camera, Lock, Building, Upload, Eye, EyeOff } from 'lucide-react';

const Profile = () => {
    const { user, setAuthData } = useAuth(); // Use setAuthData to update user
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Default form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        bankName: '',
        bankCode: '',
        accountNumber: '',
        accountName: '',
        paystackRecipientCode: '',
        payoutFrequency: 'weekly',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
    });

    const [profilePicFile, setProfilePicFile] = useState(null);
    const [profilePicPreview, setProfilePicPreview] = useState(null);

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                if (user) {
                    setFormData(prev => ({
                        ...prev,
                        name: user.name || '',
                        email: user.email || '',
                        bankName: user.bankDetails?.bankName || '',
                        bankCode: user.bankDetails?.bankCode || '',
                        accountNumber: user.bankDetails?.accountNumber || '',
                        accountName: user.bankDetails?.accountName || '',
                        paystackRecipientCode: user.bankDetails?.paystackRecipientCode || '',
                        payoutFrequency: user.payoutPreference?.frequency || 'weekly'
                    }));

                    if (user.profilePicture) {
                        setProfilePicPreview(user.profilePicture);
                    }

                    // Initial logo preview if available
                    if (user.role === 'school_admin' && user.schoolId && user.schoolId.length > 0 && user.schoolId[0].logoUrl) {
                        setLogoPreview(user.schoolId[0].logoUrl);
                    } else if (user.role === 'personal_teacher' && user.tutorialId?.logoUrl) {
                        setLogoPreview(user.tutorialId.logoUrl);
                    }
                }
            } catch (error) {
                console.error("Error loading profile", error);
                toast.error("Failed to load profile data");
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            if (type === 'profile') {
                setProfilePicFile(file);
                setProfilePicPreview(previewUrl);
            } else if (type === 'logo') {
                setLogoFile(file);
                setLogoPreview(previewUrl);
            }
        }
    };

    const uploadFile = async (file) => {
        const uploadData = new FormData();
        uploadData.append('logo', file); // keeping field name 'logo' as existing endpoint expects it
        const res = await api.post('/auth/upload-logo', uploadData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            skipLoader: true
        });
        return res.data.imageUrl;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            let updatedFormData = { ...formData };

            // Upload Profile Picture if changed
            if (profilePicFile) {
                const profilePicUrl = await uploadFile(profilePicFile);
                updatedFormData.profilePicture = profilePicUrl;
            }

            // Upload Logo if changed
            if (logoFile) {
                const logoUrl = await uploadFile(logoFile);
                if (user.role === 'school_admin') {
                    updatedFormData.schoolLogoUrl = logoUrl;
                } else if (user.role === 'personal_teacher') {
                    updatedFormData.tutorialLogoUrl = logoUrl;
                }
            }

            // Clean up password fields
            const currentPass = updatedFormData.currentPassword ? updatedFormData.currentPassword.trim() : '';
            const newPass = updatedFormData.newPassword ? updatedFormData.newPassword.trim() : '';
            const confirmPass = updatedFormData.confirmNewPassword ? updatedFormData.confirmNewPassword.trim() : '';

            if (currentPass) updatedFormData.currentPassword = currentPass;
            else delete updatedFormData.currentPassword;

            if (newPass) updatedFormData.newPassword = newPass;
            else delete updatedFormData.newPassword;

            if (confirmPass) updatedFormData.confirmNewPassword = confirmPass;
            else delete updatedFormData.confirmNewPassword;

            // Re-validate if newPassword still exists (meaning user typed something)
            if (updatedFormData.newPassword) {
                if (updatedFormData.newPassword.length < 6) {
                    toast.error("New password must be at least 6 characters long.");
                    setSaving(false);
                    return;
                }
                if (updatedFormData.newPassword !== updatedFormData.confirmNewPassword) {
                    toast.error("New passwords do not match.");
                    setSaving(false);
                    return;
                }
                if (!updatedFormData.currentPassword) {
                    toast.error("Please enter your current password to change it.");
                    setSaving(false);
                    return;
                }
            } else if (updatedFormData.currentPassword && !updatedFormData.newPassword) {
                // If user ONLY entered current password but NOT new password, 
                // we should probably warn them or just let backend verify it (but backend won't update pass).
                // Let's allow it so they can potentialy verify their pass without changing it, or we can block it if confusing.
                // However, user said: "only scenario 1 is failing now". Scenario 1: inputted wrong current password.
                // If they input wrong current password AND NO new password, backend checks currentPassword presence.
                // WE MUST send currentPassword if user typed it.
            }

            const response = await api.put('/auth/profile', updatedFormData);

            // Update local user context with new data
            if (response.data.user) {
                // Ensure we keep the SAME token to prevent logout
                const token = localStorage.getItem('token');
                setAuthData(token, response.data.user);
            }

            // Clear sensitive fields
            setFormData(prev => ({
                ...prev,
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: ''
            }));

            // Clear files
            setProfilePicFile(null);
            setLogoFile(null);

            toast.success('Profile updated successfully');
        } catch (error) {
            console.error("Profile update failed", error);
            // If backend sends specific password error, it will be toasted here
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    // Determine if user is allowed to edit bank details (SChool Admin / Personal Teacher)
    const canEditBankDetails = user?.role === 'school_admin' || user?.role === 'personal_teacher';
    const canEditLogo = user?.role === 'school_admin' || user?.role === 'personal_teacher';

    if (loading) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-4xl mx-auto pb-20">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                        <User className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Profile Settings</h1>
                        <p className="text-gray-500">Manage your account information</p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <form onSubmit={handleSubmit} className="p-8 space-y-10">

                        {/* Profile Picture Section - Only for Students, Teachers and Root Admins */}
                        {!(user?.role === 'school_admin' || user?.role === 'personal_teacher') && (
                            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 border-b pb-8">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-100 shadow-inner bg-gray-50">
                                        {profilePicPreview ? (
                                            <img src={profilePicPreview} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <User className="w-10 h-10" />
                                            </div>
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full cursor-pointer hover:bg-indigo-700 transition shadow-lg">
                                        <Camera className="w-4 h-4" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleFileChange(e, 'profile')}
                                        />
                                    </label>
                                </div>
                                <div className="flex-1 text-center sm:text-left">
                                    <h3 className="text-lg font-bold text-gray-900">Profile Picture</h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Upload a new profile picture. Recommended size: 400x400px.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Logo Upload Section (for Admins/Teachers) */}
                        {canEditLogo && (
                            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 border-b pb-8">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-xl overflow-hidden border-4 border-gray-100 shadow-inner bg-gray-50 flex items-center justify-center">
                                        {logoPreview || profilePicPreview ? (
                                            <img src={logoPreview || profilePicPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                                        ) : (
                                            <Building className="w-10 h-10 text-gray-400" />
                                        )}
                                    </div>
                                    <label className="absolute -bottom-2 -right-2 p-2 bg-white text-indigo-600 border border-gray-200 rounded-full cursor-pointer hover:bg-gray-50 transition shadow-sm">
                                        <Upload className="w-4 h-4" />
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleFileChange(e, 'logo')}
                                        />
                                    </label>
                                </div>
                                <div className="flex-1 text-center sm:text-left">
                                    <h3 className="text-lg font-bold text-gray-900">Brand Logo & Profile Image</h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Update your official logo. This will also be used as your profile image across the platform.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Personal Info Section */}
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <User className="w-5 h-5 text-gray-400" /> Personal Information
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                        placeholder="Your Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        disabled
                                        className="w-full px-4 py-3 bg-gray-100 border-none rounded-xl text-gray-500 cursor-not-allowed font-medium"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Email cannot be changed directly.</p>
                                </div>
                            </div>
                        </div>

                        {/* Change Password Section */}
                        <div className="space-y-6 border-t pt-8">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Lock className="w-5 h-5 text-gray-400" /> Change Password
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                                    <div className="relative">
                                        <input
                                            type={showCurrentPassword ? "text" : "password"}
                                            name="currentPassword"
                                            value={formData.currentPassword}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium pr-10"
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        >
                                            {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            name="newPassword"
                                            value={formData.newPassword}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium pr-10"
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Min. 6 characters</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            name="confirmNewPassword"
                                            value={formData.confirmNewPassword}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium pr-10"
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bank Details Section */}
                        {canEditBankDetails && (
                            <div className="space-y-6 border-t pt-8">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-gray-400" />
                                    <h2 className="text-lg font-bold text-gray-900">Payout Details</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name</label>
                                        <input
                                            type="text"
                                            name="bankName"
                                            value={formData.bankName}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                            placeholder="e.g. First Bank"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Account Number</label>
                                        <input
                                            type="text"
                                            name="accountNumber"
                                            value={formData.accountNumber}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                            placeholder="0123456789"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Account Name</label>
                                        <input
                                            type="text"
                                            name="accountName"
                                            value={formData.accountName}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                            placeholder="As appears on account"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Code (Optional)</label>
                                        <input
                                            type="text"
                                            name="bankCode"
                                            value={formData.bankCode}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                            placeholder="Sort Code"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Payout Frequency</label>
                                        <select
                                            name="payoutFrequency"
                                            value={formData.payoutFrequency}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 flex justify-end sticky bottom-0 bg-white p-4 border-t border-gray-100 -mx-8 -mb-8 mt-8 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-100 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-95"
                            >
                                {saving ? (
                                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                                ) : (
                                    <Save className="w-5 h-5" />
                                )}
                                <span>{saving ? 'Save Changes' : 'Save Changes'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default Profile;
