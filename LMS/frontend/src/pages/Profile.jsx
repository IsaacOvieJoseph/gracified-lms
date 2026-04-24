import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { User, CreditCard, Save, Camera, Lock, Building, Upload, Eye, EyeOff, Loader2 } from 'lucide-react';

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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-4xl mx-auto pb-20">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                        <User className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-foreground italic">Profile <span className="text-primary not-italic">Settings</span></h1>
                        <p className="text-muted-foreground font-black text-[10px] uppercase tracking-[0.2em] mt-1 opacity-60">Identity & Protocol Management</p>
                    </div>
                </div>

                <div className="bg-card rounded-[2.5rem] shadow-2xl border border-border overflow-hidden">
                    <form onSubmit={handleSubmit} className="p-8 space-y-10">

                        {/* Profile Picture Section - Only for Students, Teachers and Root Admins */}
                        {!(user?.role === 'school_admin' || user?.role === 'personal_teacher') && (
                            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 border-b border-border pb-8">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-muted shadow-inner bg-muted">
                                        {profilePicPreview ? (
                                            <img src={profilePicPreview} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                                                <User className="w-10 h-10" />
                                            </div>
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 p-2.5 bg-primary text-white rounded-full cursor-pointer hover:bg-primary/90 transition shadow-lg border-2 border-card">
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
                                    <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Identity Avatar</h3>
                                    <p className="text-sm text-muted-foreground mt-1 font-medium">
                                        Recommended Size: 400x400px.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Logo Upload Section (for Admins/Teachers) */}
                        {canEditLogo && (
                            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 border-b border-border pb-8">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-muted shadow-inner bg-muted flex items-center justify-center">
                                        {logoPreview || profilePicPreview ? (
                                            <img src={logoPreview || profilePicPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                                        ) : (
                                            <Building className="w-10 h-10 text-muted-foreground/20" />
                                        )}
                                    </div>
                                    <label className="absolute -bottom-2 -right-2 p-3 bg-card text-primary border-2 border-border rounded-2xl cursor-pointer hover:bg-muted transition shadow-sm">
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
                                    <h3 className="text-lg font-black text-foreground uppercase tracking-tight">Institution Credentials</h3>
                                    <p className="text-sm text-muted-foreground mt-1 font-medium">
                                        This asset will be used for official branding & platform identity.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Personal Info Section */}
                        <div className="space-y-6">
                            <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2 opacity-40">
                                <User className="w-4 h-4" /> Core Protocol
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Authentication Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl focus:border-primary outline-none transition-all text-foreground font-bold"
                                        placeholder="Your Name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Secure Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        disabled
                                        className="w-full px-4 py-3.5 bg-muted/40 border border-border/10 rounded-2xl text-muted-foreground/20 cursor-not-allowed font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Change Password Section */}
                        <div className="space-y-6 border-t border-border pt-8">
                            <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2 opacity-40">
                                <Lock className="w-4 h-4" /> Encryption Key Update
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Access Pass</label>
                                    <div className="relative">
                                        <input
                                            type={showCurrentPassword ? "text" : "password"}
                                            name="currentPassword"
                                            value={formData.currentPassword}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl focus:border-primary outline-none transition-all text-foreground font-bold pr-10"
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground/30 hover:text-primary transition-colors"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        >
                                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">New Access Key</label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            name="newPassword"
                                            value={formData.newPassword}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl focus:border-primary outline-none transition-all text-foreground font-bold pr-10"
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground/30 hover:text-primary transition-colors"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest mt-1.5 ml-1">Minimum 6 Tokens Required</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Confirm Protocol</label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            name="confirmNewPassword"
                                            value={formData.confirmNewPassword}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl focus:border-primary outline-none transition-all text-foreground font-bold pr-10"
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground/30 hover:text-primary transition-colors"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bank Details Section */}
                        {canEditBankDetails && (
                            <div className="space-y-6 border-t border-border pt-8">
                                <div className="flex items-center gap-2 opacity-40">
                                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                                    <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Payout Intelligence</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Bank Establishment</label>
                                        <input
                                            type="text"
                                            name="bankName"
                                            value={formData.bankName}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl focus:border-primary outline-none transition-all text-foreground font-bold"
                                            placeholder="e.g. First Bank"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Core Identity Number</label>
                                        <input
                                            type="text"
                                            name="accountNumber"
                                            value={formData.accountNumber}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl focus:border-primary outline-none transition-all text-foreground font-bold"
                                            placeholder="0123456789"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Legal Register Name</label>
                                        <input
                                            type="text"
                                            name="accountName"
                                            value={formData.accountName}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl focus:border-primary outline-none transition-all text-foreground font-bold"
                                            placeholder="As appears on account"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Sort Code (Optional)</label>
                                        <input
                                            type="text"
                                            name="bankCode"
                                            value={formData.bankCode}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl focus:border-primary outline-none transition-all text-foreground font-bold"
                                            placeholder="Bank Logic Code"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1">Disbursement Frequency</label>
                                        <select
                                            name="payoutFrequency"
                                            value={formData.payoutFrequency}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3.5 bg-muted border border-border rounded-2xl focus:border-primary outline-none transition-all text-foreground font-bold appearance-none"
                                        >
                                            <option value="daily">Daily Cycle</option>
                                            <option value="weekly">Weekly Cycle</option>
                                            <option value="monthly">Monthly Cycle</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 flex justify-end sticky bottom-0 bg-card/80 backdrop-blur-md p-4 border-t border-border -mx-8 -mb-8 mt-8 shadow-2xl z-20">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center space-x-2 px-10 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:grayscale disabled:opacity-50"
                            >
                                {saving ? (
                                    <Loader2 className="animate-spin h-5 w-5" />
                                ) : (
                                    <Save className="w-5 h-5" />
                                )}
                                <span>{saving ? 'Synchronizing...' : 'Commit Changes'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default Profile;
