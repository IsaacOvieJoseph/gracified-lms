import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import Select from 'react-select';
import {
  Plus, Edit, Trash2, Search, Loader2, Upload, Download, X,
  CheckCircle, XCircle, Eye, EyeOff, UserPlus, Users as UsersIcon,
  FileText, ArrowRight, AlertCircle, Send
} from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmationModal from '../components/ConfirmationModal';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, passwordRequirements } from '../utils/validation';

const Users = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  // School filter state for school admin
  const [selectedSchools, setSelectedSchools] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedSchools')) || [];
    } catch {
      return [];
    }
  });
  const [schools, setSchools] = useState([]);
  useEffect(() => {
    if (user?.role === 'school_admin') {
      api.get('/schools?adminId=' + user._id)
        .then(res => setSchools(res.data.schools || []))
        .catch(() => setSchools([]));
    }
  }, [user]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student'
  });
  const [uploadStep, setUploadStep] = useState(1); // 1: Upload, 2: Validate, 3: Results
  const [parsedData, setParsedData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);

  const [showPassword, setShowPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
    // Listen for school selection changes from SchoolSwitcher
    const handler = (e) => {
      try {
        const newSchools = JSON.parse(localStorage.getItem('selectedSchools')) || [];
        setSelectedSchools(newSchools);
      } catch (err) {
        console.error('Error parsing school selection:', err);
      }
      fetchUsers();
    };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, [selectedSchools]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(u =>
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.role?.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    if (users.length === 0) setLoading(true);
    try {
      // Teachers see only their enrolled students
      if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
        const response = await api.get('/users/my-students');
        setUsers(response.data.students);
        setFilteredUsers(response.data.students);
      } else {
        // Root admin and school admin see users based on their permissions
        const response = await api.get('/users');
        let filtered = response.data.users;
        if (user?.role === 'school_admin' && selectedSchools.length > 0) {
          filtered = filtered.filter(u => {
            if (Array.isArray(u.schoolId)) {
              return u.schoolId.some(sid => selectedSchools.includes(sid?._id || sid));
            }
            return selectedSchools.includes(u.schoolId?._id || u.schoolId);
          });
        }
        setUsers(filtered);
        setFilteredUsers(filtered);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!validateEmail(formData.email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (!validatePassword(formData.password)) {
      toast.error(passwordRequirements);
      return;
    }

    try {
      const submitData = { ...formData };
      if (user?.role === 'school_admin') {
        let schoolIdToSend = null;

        // If 'All' is selected, assign all school IDs
        if (submitData.schoolIds && submitData.schoolIds.length > 0) {
          // Check if all schools are selected (equivalent to 'ALL')
          const allSelected = submitData.schoolIds.length === schools.length &&
            schools.every(s => submitData.schoolIds.includes(s._id));

          if (allSelected || submitData.schoolIds.includes('ALL')) {
            // Send all school IDs as an array
            schoolIdToSend = schools.map(s => s._id);
          } else {
            // Send selected school IDs as array (backend handles arrays)
            schoolIdToSend = submitData.schoolIds.filter(id => id !== 'ALL');
          }
        } else if (!submitData.schoolIds || submitData.schoolIds.length === 0) {
          // If no school selected in form, use the selected school from dropdown
          if (selectedSchools.length > 0) {
            schoolIdToSend = selectedSchools;
          } else {
            toast.error('Please select a school from the header dropdown first');
            return;
          }
        }

        // Send as schoolId (singular) to match backend expectation
        submitData.schoolId = schoolIdToSend;
        // Remove schoolIds from submitData to avoid confusion
        delete submitData.schoolIds;
      }
      await api.post('/users', submitData, { skipLoader: true });
      toast.success('User created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', email: '', password: '', role: 'student', schoolIds: [] });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating user');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setIsUploading(true);
    setUploadResults(null);
    setParsedData([]);
    setValidationErrors([]);

    try {
      // Parse CSV file
      const text = await csvFile.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const data = [];
      const errors = [];
      const emailSet = new Set();

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.trim());
        const row = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Basic validation
        const rowErrors = [];

        if (!row.name) {
          rowErrors.push('Name is required');
        }

        if (!row.email) {
          rowErrors.push('Email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          rowErrors.push('Invalid email format');
        } else if (emailSet.has(row.email.toLowerCase())) {
          rowErrors.push('Duplicate email in CSV');
        } else {
          emailSet.add(row.email.toLowerCase());
        }

        // Check if user already exists
        try {
          const existingUsers = users.filter(u => u.email.toLowerCase() === row.email.toLowerCase());
          if (existingUsers.length > 0) {
            rowErrors.push('User already exists in system');
          }
        } catch (err) {
          // Continue if check fails
        }

        // Validate role
        const validRoles = ['student', 'teacher', 'personal_teacher'];
        if (user?.role === 'root_admin') {
          validRoles.push('school_admin');
        }

        if (row.role && !validRoles.includes(row.role)) {
          rowErrors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
        }

        // Initialize schools as array
        if (row.school) {
          row.schools = row.school.split(',').map(s => s.trim()).filter(s => s);
        } else {
          row.schools = [];
        }

        // Validate school - students must have at least one school
        if (row.role === 'student' || !row.role) {
          const hasSchool = row.schools && row.schools.length > 0;
          if (!hasSchool) {
            rowErrors.push('Students must belong to at least one school');
          }
        }

        // Validate schools if provided
        if (row.schools && row.schools.length > 0) {
          const invalidSchools = [];
          const validSchoolIds = [];
          const validSchoolNames = [];

          row.schools.forEach(schoolName => {
            if (!schoolName) return;

            if (schoolName === 'ALL') {
              validSchoolIds.push(...schools.map(s => s._id));
              validSchoolNames.push(...schools.map(s => s.name));
            } else {
              const schoolExists = schools.find(s =>
                s.name.toLowerCase() === schoolName.toLowerCase() ||
                s._id === schoolName
              );
              if (!schoolExists) {
                invalidSchools.push(schoolName);
              } else {
                validSchoolIds.push(schoolExists._id);
                validSchoolNames.push(schoolExists.name);
              }
            }
          });

          if (invalidSchools.length > 0) {
            rowErrors.push(`School(s) not found: ${invalidSchools.join(', ')}`);
          }

          row.schoolIds = [...new Set(validSchoolIds)];
          row.schoolNames = [...new Set(validSchoolNames)];
        }

        data.push({
          ...row,
          rowNumber: i + 1,
          errors: rowErrors,
          valid: rowErrors.length === 0
        });

        if (rowErrors.length > 0) {
          errors.push({
            row: i + 1,
            email: row.email || 'N/A',
            errors: rowErrors
          });
        }
      }

      setParsedData(data);
      setValidationErrors(errors);
      setUploadStep(2); // Move to validation step

    } catch (error) {
      toast.error('Error parsing CSV: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const confirmBulkUpload = async () => {
    setIsUploading(true);
    setUploadResults(null);

    try {
      const validUsers = parsedData.filter(u => u.valid);

      if (validUsers.length === 0) {
        toast.error('No valid users to upload');
        setIsUploading(false);
        return;
      }

      const formDataToSend = new FormData();

      // Create a new CSV with only valid users, including school IDs
      const csvContent = 'name,email,role,school,schoolIds\n' +
        validUsers.map(u => {
          const schoolNames = u.schools ? u.schools.join(';') : '';
          const schoolIds = u.schoolIds ? u.schoolIds.join(';') : '';
          return `${u.name},${u.email},${u.role || 'student'},${schoolNames},${schoolIds}`;
        }).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      formDataToSend.append('csvFile', blob, 'validated_users.csv');
      formDataToSend.append('role', 'student'); // Default, will be overridden by CSV

      // For school admin, send their selected schools as default
      if (user?.role === 'school_admin' && selectedSchools.length > 0) {
        formDataToSend.append('schoolId', JSON.stringify(selectedSchools));
      }

      const response = await api.post('/users/bulk-invite', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipLoader: true
      });

      setUploadResults(response.data);
      setUploadStep(3); // Move to results step
      toast.success(`Successfully processed ${response.data.successful} users`);

      if (response.data.failed > 0) {
        toast.error(`${response.data.failed} users failed to process`);
      }

      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error uploading CSV');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = `name,email,role,school
John Doe,john@example.com,student,${schools[0]?.name || 'School Name'}
Jane Smith,jane@example.com,teacher,${schools[0]?.name || 'School Name'}
Bob Johnson,bob@example.com,student,`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_users.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFieldEdit = (rowIndex, field, value) => {
    const updatedData = [...parsedData];

    // Handle schools field specially for multi-select
    if (field === 'schools') {
      updatedData[rowIndex].schools = value; // value is already an array
    } else {
      updatedData[rowIndex][field] = value;
    }

    // Re-validate the row
    const row = updatedData[rowIndex];
    const rowErrors = [];
    const emailSet = new Set();

    // Collect all other emails for duplicate check
    parsedData.forEach((r, idx) => {
      if (idx !== rowIndex && r.email) {
        emailSet.add(r.email.toLowerCase());
      }
    });

    // Validate name
    if (!row.name || !row.name.trim()) {
      rowErrors.push('Name is required');
    }

    // Validate email
    if (!row.email || !row.email.trim()) {
      rowErrors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      rowErrors.push('Invalid email format');
    } else if (emailSet.has(row.email.toLowerCase())) {
      rowErrors.push('Duplicate email in CSV');
    }

    // Check if user already exists
    const existingUsers = users.filter(u => u.email.toLowerCase() === row.email.toLowerCase());
    if (existingUsers.length > 0) {
      rowErrors.push('User already exists in system');
    }

    // Validate role
    const validRoles = ['student', 'teacher', 'personal_teacher'];
    if (user?.role === 'root_admin') {
      validRoles.push('school_admin');
    }

    if (row.role && !validRoles.includes(row.role)) {
      rowErrors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Validate school - students must have at least one school
    if (row.role === 'student') {
      const hasSchool = row.schools && row.schools.length > 0 && row.schools.some(s => s && s !== '');
      if (!hasSchool) {
        rowErrors.push('Students must belong to at least one school');
      }
    }

    // Validate schools if provided
    if (row.schools && row.schools.length > 0) {
      const invalidSchools = [];
      const validSchoolIds = [];
      const validSchoolNames = [];

      row.schools.forEach(schoolName => {
        if (!schoolName || schoolName === '') return;

        if (schoolName === 'ALL') {
          // Select all schools
          validSchoolIds.push(...schools.map(s => s._id));
          validSchoolNames.push(...schools.map(s => s.name));
        } else {
          const schoolExists = schools.find(s =>
            s.name.toLowerCase() === schoolName.toLowerCase() ||
            s._id === schoolName
          );
          if (!schoolExists) {
            invalidSchools.push(schoolName);
          } else {
            validSchoolIds.push(schoolExists._id);
            validSchoolNames.push(schoolExists.name);
          }
        }
      });

      if (invalidSchools.length > 0) {
        rowErrors.push(`School(s) not found: ${invalidSchools.join(', ')}`);
      }

      row.schoolIds = [...new Set(validSchoolIds)]; // Remove duplicates
      row.schoolNames = [...new Set(validSchoolNames)];
    } else {
      // Clear school data if empty
      row.schoolIds = [];
      row.schoolNames = [];
    }

    updatedData[rowIndex].errors = rowErrors;
    updatedData[rowIndex].valid = rowErrors.length === 0;

    setParsedData(updatedData);

    // Update validation errors list
    const newErrors = updatedData
      .filter(r => !r.valid)
      .map(r => ({
        row: r.rowNumber,
        email: r.email || 'N/A',
        errors: r.errors
      }));

    setValidationErrors(newErrors);
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleDelete = (userId) => {
    setUserToDelete(userId);
    setShowDeleteModal(true);
  };

  const exportUsersToCSV = () => {
    if (filteredUsers.length === 0) {
      toast.error('No users to export');
      return;
    }

    const headers = ['Name', 'Email', 'Role', 'School', 'Status'];
    const csvRows = filteredUsers.map(u => {
      let schoolName = '';
      if (Array.isArray(u.schoolId)) {
        schoolName = u.schoolId.map(s => s?.name || (schools.find(sch => sch._id === s)?.name || s)).join('; ');
      } else {
        schoolName = u.schoolId?.name || schools.find(sch => sch._id === u.schoolId)?.name || u.schoolName || u.schoolId || '';
      }

      return [
        u.name,
        u.email,
        u.role,
        `"${schoolName}"`, // Quote school names to handle potential commas
        u.isActive !== false ? 'Active' : 'Inactive'
      ].join(',');
    });

    const csvString = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/users/${userToDelete}`);
      toast.success('User deleted successfully');
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting user');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'root_admin':
        return 'bg-red-100 text-red-800';
      case 'school_admin':
        return 'bg-orange-100 text-orange-800';
      case 'teacher':
      case 'personal_teacher':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const [showModalPassword, setShowModalPassword] = useState(false);

  if (loading) {
    return <Layout><div className="text-center py-8">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">
            {user?.role === 'teacher' || user?.role === 'personal_teacher'
              ? 'My Students'
              : 'User Management'}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={exportUsersToCSV}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              title="Export Users"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            {['root_admin', 'school_admin'].includes(user?.role) && (
              <>
                <button
                  onClick={() => {
                    const currentSelected = JSON.parse(localStorage.getItem('selectedSchools') || '[]');
                    if (user?.role === 'school_admin' && currentSelected.length > 0) {
                      setFormData({
                        name: '',
                        email: '',
                        password: '',
                        role: 'student',
                        schoolIds: currentSelected
                      });
                    } else {
                      setFormData({ name: '', email: '', password: '', role: 'student', schoolIds: [] });
                    }
                    setShowModalPassword(false);
                    setShowCreateModal(true);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  title="Create User"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Create User</span>
                </button>
                <button
                  onClick={() => {
                    setCsvFile(null);
                    setUploadResults(null);
                    setShowBulkUploadModal(true);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  title="Bulk Upload"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Bulk Upload</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                {user?.role !== 'teacher' && user?.role !== 'personal_teacher' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                )}
                {user?.role !== 'teacher' && user?.role !== 'personal_teacher' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">School</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {user?.role === 'root_admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((u) => (
                <tr key={u._id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  {user?.role !== 'teacher' && user?.role !== 'personal_teacher' && (
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(u.role)}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                  )}
                  {user?.role !== 'teacher' && user?.role !== 'personal_teacher' && (
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {Array.isArray(u.schoolId)
                        ? u.schoolId.map(s => s?.name || s).join(', ')
                        : (u.schoolId?.name || u.schoolName || u.schoolId || '')}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-green-600">
                    {u.isActive !== false ? 'Active' : 'Inactive'}
                  </td>
                  {(user?.role === 'root_admin' || (user?.role === 'school_admin' && u.createdBy === user._id)) && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(u._id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">
              {searchQuery.trim() !== ''
                ? 'No users found matching your search'
                : user?.role === 'teacher' || user?.role === 'personal_teacher'
                  ? 'No students enrolled in your classes yet'
                  : 'No users found'}
            </p>
          </div>
        )}
      </div>

      {
        showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-slide-up">
              {/* Modal Header */}
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">Create User</h3>
                    <p className="text-sm text-slate-500 font-medium mt-0.5">Add a new member to the system</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <form onSubmit={(e) => { setIsCreating(true); handleCreate(e); }} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Isaac Ovie Joseph"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Initial Password</label>
                    <div className="relative">
                      <input
                        type={showModalPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all pr-12"
                        required
                        minLength="6"
                      />
                      <button
                        type="button"
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200/50 rounded-lg transition-colors text-slate-400"
                        onClick={() => setShowModalPassword(!showModalPassword)}
                      >
                        {showModalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Account Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl font-bold text-slate-600 focus:bg-white focus:border-primary transition-all appearance-none"
                      required
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="personal_teacher">Personal Teacher</option>
                      {user?.role === 'root_admin' && (
                        <>
                          <option value="school_admin">School Admin</option>
                          <option value="root_admin">Root Admin</option>
                        </>
                      )}
                    </select>
                  </div>

                  {user?.role === 'school_admin' && (
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Assigned School(s)</label>
                      <Select
                        isMulti
                        options={[{ value: 'ALL', label: 'All Schools' }, ...schools.map(s => ({ value: s._id, label: s.name }))]}
                        value={formData.schoolIds && formData.schoolIds.length > 0
                          ? (formData.schoolIds.length === schools.length
                            ? [{ value: 'ALL', label: 'All Schools' }]
                            : formData.schoolIds.map(id => {
                              if (id === 'ALL') return { value: 'ALL', label: 'All Schools' };
                              const school = schools.find(s => s._id === id);
                              return school ? { value: school._id, label: school.name } : null;
                            }).filter(Boolean))
                          : (selectedSchools.length > 0
                            ? selectedSchools.map(id => {
                              const school = schools.find(s => s._id === id);
                              return school ? { value: school._id, label: school.name } : null;
                            }).filter(Boolean)
                            : [])
                        }
                        onChange={selected => {
                          if (selected.some(opt => opt.value === 'ALL')) {
                            setFormData({ ...formData, schoolIds: schools.map(s => s._id) });
                          } else {
                            setFormData({ ...formData, schoolIds: selected.map(opt => opt.value) });
                          }
                        }}
                        classNamePrefix="react-select"
                        placeholder="Search schools..."
                        styles={{
                          control: (base) => ({
                            ...base,
                            borderRadius: '1rem',
                            padding: '4px',
                            border: '2px solid #f8fafc',
                            backgroundColor: '#f8fafc',
                            '&:hover': { border: '2px solid #f8fafc' },
                            boxShadow: 'none'
                          }),
                          placeholder: (base) => ({ ...base, color: '#94a3b8', fontWeight: 'bold' }),
                        }}
                      />
                      <p className="text-[10px] font-bold text-slate-400 ml-1">
                        {selectedSchools.length > 0
                          ? `Default: ${schools.find(s => s._id === selectedSchools[0])?.name || 'Current School'}.`
                          : 'Select one or more schools to grant access.'}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-200 transition-all uppercase tracking-widest text-xs"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="btn-premium flex-1 py-4 flex items-center justify-center shadow-xl shadow-primary/20"
                    >
                      {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )
      }

      {/* Bulk Upload Modal */}
      {
        showBulkUploadModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className={`bg-white rounded-[2.5rem] shadow-2xl ${uploadStep === 2 ? 'max-w-6xl' : 'max-w-2xl'} w-full flex flex-col overflow-hidden animate-slide-up max-h-[95vh]`}>
              {/* Modal Header */}
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <UsersIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">Bulk Invitation</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex gap-1">
                        {[1, 2, 3].map(step => (
                          <div key={step} className={`w-4 h-1 rounded-full transition-colors ${uploadStep >= step ? 'bg-primary' : 'bg-slate-100'}`} />
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest ml-1">Step {uploadStep} of 3</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowBulkUploadModal(false);
                    setCsvFile(null);
                    setUploadStep(1);
                    setParsedData([]);
                    setValidationErrors([]);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
                {/* Step 1: Upload CSV */}
                {uploadStep === 1 && (
                  <div className="space-y-8">
                    <div className="p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <FileText className="w-24 h-24" />
                      </div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Requirements</p>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Required Headers</p>
                            <div className="flex flex-wrap gap-2">
                              <span className="px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">name</span>
                              <span className="px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">email</span>
                            </div>
                          </div>
                          <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Optional Headers</p>
                            <div className="flex flex-wrap gap-2">
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">role</span>
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">school</span>
                            </div>
                          </div>
                        </div>
                        <ul className="space-y-2">
                          {[
                            'Each user receives a unique secure link',
                            'Links expire automatically after 7 days',
                            'Existing emails will be skipped'
                          ].map((text, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-600">
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                              {text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50 hover:bg-white hover:border-primary transition-all group">
                      <div className="w-20 h-20 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:scale-110 transition-all mb-6">
                        <Upload className="w-10 h-10" />
                      </div>
                      <h4 className="text-xl font-black text-slate-900 mb-2">Upload Data Source</h4>
                      <p className="text-sm text-slate-500 font-medium mb-8">Select a .csv file to begin importing users</p>

                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => setCsvFile(e.target.files[0])}
                          className="hidden"
                        />
                        <div className="px-8 py-3 bg-white border-2 border-slate-100 rounded-2xl font-black text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm">
                          {csvFile ? csvFile.name : 'Choose CSV File'}
                        </div>
                      </label>

                      {csvFile && (
                        <div className="mt-4 flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 animate-in zoom-in">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Ready to Process</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={downloadSampleCSV}
                        className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-200 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Sample Template
                      </button>
                      <button
                        onClick={handleBulkUpload}
                        disabled={isUploading || !csvFile}
                        className="flex-[2] btn-premium py-4 flex items-center justify-center gap-3 shadow-xl shadow-primary/20 disabled:grayscale"
                      >
                        {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                          <>
                            <span>Validate Data Source</span>
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Validation Preview */}
                {uploadStep === 2 && (
                  <div className="space-y-8 animate-in slide-in-from-right duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Records</p>
                        <p className="text-3xl font-black text-slate-900">{parsedData.length}</p>
                      </div>
                      <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 text-center">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Pass Check</p>
                        <p className="text-3xl font-black text-emerald-600">{parsedData.filter(u => u.valid).length}</p>
                      </div>
                      <div className="p-6 bg-red-50 rounded-3xl border border-red-100 text-center">
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-1">Failed Check</p>
                        <p className="text-3xl font-black text-red-600">{validationErrors.length}</p>
                      </div>
                    </div>

                    {validationErrors.length > 0 && (
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        <p className="text-xs font-bold text-amber-700">Records with errors will be skipped automatically during the invite process.</p>
                      </div>
                    )}

                    <div className="rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm bg-white">
                      <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 z-20 bg-slate-900">
                            <tr>
                              {['#', 'Name', 'Email Address', 'Account Role', 'Schools', 'Status'].map(h => (
                                <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {parsedData.map((row, idx) => (
                              <tr key={idx} className={`group hover:bg-slate-50 transition-colors ${!row.valid ? 'bg-red-50/30' : ''}`}>
                                <td className="px-6 py-4 text-xs font-black text-slate-300">{row.rowNumber}</td>
                                <td className="px-6 py-4">
                                  <input
                                    type="text"
                                    value={row.name || ''}
                                    onChange={(e) => handleFieldEdit(idx, 'name', e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 placeholder:text-slate-300"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <input
                                    type="email"
                                    value={row.email || ''}
                                    onChange={(e) => handleFieldEdit(idx, 'email', e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 placeholder:text-slate-300"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <select
                                    value={row.role || 'student'}
                                    onChange={(e) => handleFieldEdit(idx, 'role', e.target.value)}
                                    className="bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 appearance-none cursor-pointer"
                                  >
                                    <option value="student">Student</option>
                                    <option value="teacher">Teacher</option>
                                    <option value="personal_teacher">Personal Teacher</option>
                                    {user?.role === 'root_admin' && <option value="school_admin">School Admin</option>}
                                  </select>
                                </td>
                                <td className="px-6 py-4 min-w-[200px]">
                                  <Select
                                    isMulti
                                    value={row.schools?.map(s => ({ value: s, label: s === 'ALL' ? 'All' : s })) || []}
                                    onChange={(sel) => handleFieldEdit(idx, 'schools', sel ? sel.map(o => o.value) : [])}
                                    options={[{ value: 'ALL', label: 'All' }, ...schools.map(s => ({ value: s.name, label: s.name }))]}
                                    classNamePrefix="small-select"
                                    styles={{
                                      control: (base) => ({ ...base, minHeight: '30px', border: 'none', backgroundColor: 'transparent', boxShadow: 'none' }),
                                      valueContainer: (base) => ({ ...base, padding: '0' }),
                                      multiValue: (base) => ({ ...base, borderRadius: '4px', backgroundColor: '#f1f5f9' }),
                                      multiValueLabel: (base) => ({ ...base, fontSize: '10px', fontWeight: 'bold' })
                                    }}
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  {row.valid ? (
                                    <div className="flex items-center gap-1.5 text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full w-fit border border-emerald-100">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Valid</span>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-red-500 bg-red-50 px-3 py-1 rounded-full w-fit border border-red-100">
                                        <XCircle className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Invalid</span>
                                      </div>
                                      <div className="text-[10px] text-red-400 font-bold ml-1">{row.errors[0]}</div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4 sticky bottom-0 bg-white">
                      <button
                        onClick={() => { setUploadStep(1); setParsedData([]); setValidationErrors([]); }}
                        className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all uppercase tracking-widest text-xs"
                      >
                        Reset Source
                      </button>
                      <button
                        onClick={confirmBulkUpload}
                        disabled={isUploading || parsedData.filter(u => u.valid).length === 0}
                        className="flex-[2] btn-premium py-4 flex items-center justify-center gap-3 shadow-xl shadow-primary/20 disabled:grayscale"
                      >
                        {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                          <>
                            <span>Broadcast {parsedData.filter(u => u.valid).length} Invitations</span>
                            <Send className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Final Report */}
                {uploadStep === 3 && uploadResults && (
                  <div className="space-y-8 animate-in zoom-in duration-500 text-center py-10">
                    <div className="relative inline-block">
                      <div className="w-24 h-24 bg-emerald-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-200 mx-auto relative z-10">
                        <CheckCircle className="w-12 h-12" />
                      </div>
                      <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500 rounded-[2rem] animate-ping opacity-20" />
                    </div>

                    <div>
                      <h4 className="text-3xl font-black text-slate-900 mb-2">Bravo! Import Successful.</h4>
                      <p className="text-slate-500 font-medium">Invitation emails are now flying through outer space to their destinations.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Delivered</p>
                        <p className="text-3xl font-black text-emerald-600">{uploadResults.successful}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Bounced</p>
                        <p className="text-3xl font-black text-red-600">{uploadResults.failed}</p>
                      </div>
                    </div>

                    {uploadResults.errors?.length > 0 && (
                      <div className="max-w-md mx-auto p-6 bg-red-50/50 rounded-[2rem] border border-red-100 text-left">
                        <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-4">Error Intelligence Report</p>
                        <div className="max-h-40 overflow-y-auto space-y-2 scrollbar-thin">
                          {uploadResults.errors.map((err, idx) => (
                            <div key={idx} className="flex gap-3 text-xs font-bold text-red-700">
                              <span className="opacity-40">#{err.row}</span>
                              <span>{err.email}: {err.error}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setShowBulkUploadModal(false);
                        setCsvFile(null);
                        setUploadResults(null);
                        setParsedData([]);
                        setValidationErrors([]);
                        setUploadStep(1);
                      }}
                      className="w-full btn-premium py-5 text-xl shadow-2xl shadow-primary/30"
                    >
                      Dismiss Report
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      <ConfirmationModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </Layout >
  );
};

export default Users;
