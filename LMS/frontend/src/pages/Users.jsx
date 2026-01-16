import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import Select from 'react-select';
import { Plus, Edit, Trash2, Search, Loader2, Upload, Download, X, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`bg-white rounded-lg shadow-2xl ${uploadStep === 2 ? 'max-w-4xl' : 'max-w-md'} w-full p-6 overflow-y-auto max-h-[90vh]`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Create User</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={(e) => { setIsCreating(true); handleCreate(e); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showModalPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                      required
                      minLength="6"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                    >
                      {showModalPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">School(s)</label>
                    <Select
                      isMulti
                      options={[{ value: 'ALL', label: 'All' }, ...schools.map(s => ({ value: s._id, label: s.name }))]}
                      value={formData.schoolIds && formData.schoolIds.length > 0
                        ? (formData.schoolIds.length === schools.length
                          ? [{ value: 'ALL', label: 'All' }]
                          : formData.schoolIds.map(id => {
                            if (id === 'ALL') return { value: 'ALL', label: 'All' };
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
                      placeholder="Select school(s)..."
                    />
                    <small className="text-gray-500">
                      {selectedSchools.length > 0
                        ? `Default: ${schools.find(s => s._id === selectedSchools[0])?.name || 'Selected school'}. Select multiple schools or 'All'.`
                        : 'Select multiple schools or \'All\'.'}
                    </small>
                  </div>
                )}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center"
                  >
                    Create
                    {isCreating && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Bulk Upload Modal */}
      {
        showBulkUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full p-6 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Bulk Upload Users via CSV</h3>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-500">Step {uploadStep} of 3</div>
                  <button
                    onClick={() => {
                      setShowBulkUploadModal(false);
                      setCsvFile(null);
                      setUploadStep(1);
                      setParsedData([]);
                      setValidationErrors([]);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Step 1: Upload CSV */}
              {uploadStep === 1 && (
                <>
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 mb-3">
                      <strong>📋 CSV Format Requirements:</strong>
                    </p>
                    <div className="bg-white p-3 rounded border border-blue-100 mb-3">
                      <p className="text-xs font-mono text-gray-700 mb-1">Required columns:</p>
                      <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                        <li><code className="bg-gray-100 px-1 rounded">name</code> - Full name of the user</li>
                        <li><code className="bg-gray-100 px-1 rounded">email</code> - Valid email address</li>
                      </ul>
                      <p className="text-xs font-mono text-gray-700 mb-1 mt-2">Optional columns:</p>
                      <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                        <li><code className="bg-gray-100 px-1 rounded">role</code> - student, teacher, personal_teacher{user?.role === 'root_admin' ? ', school_admin' : ''}</li>
                        <li><code className="bg-gray-100 px-1 rounded">school</code> - School name (must match existing school)</li>
                      </ul>
                    </div>
                    <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                      <li>Each user will receive an invite email with a unique link</li>
                      <li>Invite links expire in 7 days</li>
                      <li>Duplicate emails will be rejected</li>
                    </ul>
                  </div>

                  <div className="mb-6 flex justify-center">
                    <button
                      onClick={downloadSampleCSV}
                      className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition shadow-lg transform hover:scale-105"
                    >
                      <Download className="w-5 h-5" />
                      <span className="font-semibold">Download Sample CSV Template</span>
                    </button>
                  </div>

                  <form onSubmit={handleBulkUpload} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select CSV File</label>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setCsvFile(e.target.files[0])}
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                      />
                      {csvFile && (
                        <p className="text-sm text-green-600 mt-1 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Selected: {csvFile.name}
                        </p>
                      )}
                    </div>

                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBulkUploadModal(false);
                          setCsvFile(null);
                          setUploadStep(1);
                        }}
                        className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isUploading}
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Validating...
                          </>
                        ) : (
                          'Next: Validate Data'
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* Step 2: Validation Preview */}
              {uploadStep === 2 && (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Validation Summary</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Total rows: {parsedData.length} |
                          <span className="text-green-600 ml-1 font-semibold">✓ Valid: {parsedData.filter(u => u.valid).length}</span> |
                          <span className="text-red-600 ml-1 font-semibold">✗ Invalid: {validationErrors.length}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-sm text-indigo-800 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <strong>Tip:</strong> You can edit any field directly in the table below. Changes are validated in real-time.
                    </p>
                  </div>

                  <div className="mb-4 max-h-96 overflow-y-auto border rounded-lg">
                    {/* Mobile Card Layout */}
                    <div className="block sm:hidden divide-y divide-gray-200">
                      {parsedData.map((row, idx) => (
                        <div key={idx} className={`p-4 space-y-3 ${row.valid ? 'bg-white' : 'bg-red-50'}`}>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="font-bold text-gray-700">User #{row.rowNumber}</span>
                            {row.valid ? (
                              <span className="text-green-600 text-xs font-semibold flex items-center">
                                <CheckCircle className="w-4 h-4 mr-1" /> Valid
                              </span>
                            ) : (
                              <span className="text-red-600 text-xs font-semibold flex items-center">
                                <XCircle className="w-4 h-4 mr-1" /> Invalid
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-400">Name</label>
                            <input
                              type="text"
                              value={row.name || ''}
                              onChange={(e) => handleFieldEdit(idx, 'name', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                              placeholder="Enter name"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-400">Email</label>
                            <input
                              type="email"
                              value={row.email || ''}
                              onChange={(e) => handleFieldEdit(idx, 'email', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                              placeholder="Enter email"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-gray-400">Role</label>
                              <select
                                value={row.role || 'student'}
                                onChange={(e) => handleFieldEdit(idx, 'role', e.target.value)}
                                className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
                              >
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                                <option value="personal_teacher">Personal Teacher</option>
                                {user?.role === 'root_admin' && (
                                  <option value="school_admin">School Admin</option>
                                )}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-gray-400">Status</label>
                              {!row.valid && (
                                <ul className="text-[10px] text-red-600 list-disc list-inside">
                                  {row.errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                  ))}
                                </ul>
                              )}
                              {row.valid && <div className="text-[10px] text-green-600 font-medium py-1">Ready for upload</div>}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-400">School(s)</label>
                            <Select
                              isMulti
                              value={
                                row.schools && row.schools.length > 0
                                  ? row.schools.map(schoolName => {
                                    if (schoolName === 'ALL') {
                                      return { value: 'ALL', label: 'All Schools' };
                                    }
                                    const school = schools.find(s => s.name === schoolName);
                                    return school ? { value: school.name, label: school.name } : null;
                                  }).filter(Boolean)
                                  : []
                              }
                              onChange={(selected) => {
                                if (selected && selected.some(opt => opt.value === 'ALL')) {
                                  handleFieldEdit(idx, 'schools', schools.map(s => s.name));
                                } else {
                                  handleFieldEdit(idx, 'schools', selected ? selected.map(opt => opt.value) : []);
                                }
                              }}
                              options={[
                                { value: 'ALL', label: 'All Schools' },
                                ...schools.map(school => ({ value: school.name, label: school.name }))
                              ]}
                              className="text-sm"
                              classNamePrefix="react-select"
                              placeholder="Select school(s)..."
                              menuPlacement="auto"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View */}
                    <table className="hidden sm:table w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">#</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Name</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Email</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Role</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">School</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {parsedData.map((row, idx) => (
                          <tr key={idx} className={row.valid ? 'bg-white hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100'}>
                            <td className="px-3 py-2 text-gray-600 font-medium">{row.rowNumber}</td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.name || ''}
                                onChange={(e) => handleFieldEdit(idx, 'name', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Enter name"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="email"
                                value={row.email || ''}
                                onChange={(e) => handleFieldEdit(idx, 'email', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Enter email"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={row.role || 'student'}
                                onChange={(e) => handleFieldEdit(idx, 'role', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                              >
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                                <option value="personal_teacher">Personal Teacher</option>
                                {user?.role === 'root_admin' && (
                                  <option value="school_admin">School Admin</option>
                                )}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <Select
                                isMulti
                                value={
                                  row.schools && row.schools.length > 0
                                    ? row.schools.map(schoolName => {
                                      if (schoolName === 'ALL') {
                                        return { value: 'ALL', label: 'All Schools' };
                                      }
                                      const school = schools.find(s => s.name === schoolName);
                                      return school ? { value: school.name, label: school.name } : null;
                                    }).filter(Boolean)
                                    : []
                                }
                                onChange={(selected) => {
                                  if (selected && selected.some(opt => opt.value === 'ALL')) {
                                    handleFieldEdit(idx, 'schools', schools.map(s => s.name));
                                  } else {
                                    handleFieldEdit(idx, 'schools', selected ? selected.map(opt => opt.value) : []);
                                  }
                                }}
                                options={[
                                  { value: 'ALL', label: 'All Schools' },
                                  ...schools.map(school => ({ value: school.name, label: school.name }))
                                ]}
                                className="text-xs"
                                classNamePrefix="react-select"
                                placeholder="Select school(s)..."
                                styles={{
                                  control: (base) => ({
                                    ...base,
                                    minHeight: '30px',
                                    fontSize: '0.75rem'
                                  }),
                                  valueContainer: (base) => ({
                                    ...base,
                                    padding: '0 6px'
                                  }),
                                  input: (base) => ({
                                    ...base,
                                    margin: 0,
                                    padding: 0
                                  }),
                                  indicatorsContainer: (base) => ({
                                    ...base,
                                    height: '30px'
                                  })
                                }}
                              />
                            </td>
                            <td className="px-3 py-2">
                              {row.valid ? (
                                <span className="flex items-center text-green-600 text-xs font-semibold">
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Valid
                                </span>
                              ) : (
                                <div>
                                  <span className="flex items-center text-red-600 text-xs mb-1 font-semibold">
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Invalid
                                  </span>
                                  <ul className="text-xs text-red-600 list-disc list-inside">
                                    {row.errors.map((err, i) => (
                                      <li key={i}>{err}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {validationErrors.length > 0 && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        ⚠️ <strong>Warning:</strong> {validationErrors.length} row(s) have errors and will be skipped.
                        Only valid users will be uploaded.
                      </p>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadStep(1);
                        setParsedData([]);
                        setValidationErrors([]);
                      }}
                      className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={confirmBulkUpload}
                      disabled={isUploading || parsedData.filter(u => u.valid).length === 0}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        `Upload ${parsedData.filter(u => u.valid).length} Valid User(s) & Send Invites`
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Results */}
              {uploadStep === 3 && uploadResults && (
                <>
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Upload Complete!
                    </h4>
                    <p className="text-sm text-green-700">✓ Successfully processed: {uploadResults.successful} users</p>
                    <p className="text-sm text-gray-600 mt-1">Invite emails have been sent to all users.</p>
                    {uploadResults.failed > 0 && (
                      <p className="text-sm text-red-700 mt-1">✗ Failed: {uploadResults.failed} users</p>
                    )}
                  </div>

                  {uploadResults.errors && uploadResults.errors.length > 0 && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                      <div className="max-h-40 overflow-y-auto">
                        {uploadResults.errors.map((err, idx) => (
                          <p key={idx} className="text-xs text-red-600">
                            Row {err.row}: {err.email} - {err.error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setShowBulkUploadModal(false);
                        setCsvFile(null);
                        setUploadResults(null);
                        setParsedData([]);
                        setValidationErrors([]);
                        setUploadStep(1);
                      }}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
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
