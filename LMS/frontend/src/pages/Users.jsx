import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import Select from 'react-select';
import { Plus, Edit, Trash2, Search, Loader2, Upload, Download } from 'lucide-react';
import Layout from '../components/Layout';
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

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('csvFile', csvFile);
      formDataToSend.append('role', formData.role || 'student');

      if (user?.role === 'school_admin' && selectedSchools.length > 0) {
        formDataToSend.append('schoolId', JSON.stringify(selectedSchools));
      }

      const response = await api.post('/users/bulk-invite', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipLoader: true
      });

      setUploadResults(response.data);
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
    const csvContent = 'name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_users.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const [isCreating, setIsCreating] = useState(false);

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting user');
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
          {['root_admin', 'school_admin'].includes(user?.role) && (
            <div className="flex gap-2">
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
                  setShowCreateModal(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create User</span>
              </button>
              <button
                onClick={() => {
                  setCsvFile(null);
                  setUploadResults(null);
                  setShowBulkUploadModal(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <Upload className="w-4 h-4" />
                <span>Bulk Upload</span>
              </button>
            </div>
          )}
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
                        ? u.schoolId.map(s => s?.name || (schools.find(sch => sch._id === s)?.name || s)).join(', ')
                        : (u.schoolId?.name || schools.find(sch => sch._id === u.schoolId)?.name || u.schoolName || u.schoolId || '')}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-green-600">
                    {u.isActive !== false ? 'Active' : 'Inactive'}
                  </td>
                  {user?.role === 'root_admin' && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(u._id)}
                        className="text-red-600 hover:text-red-800"
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

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4">Create User</h3>
            <form onSubmit={(e) => { setIsCreating(true); handleCreate(e); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                  minLength="6"
                />
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
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4">Bulk Upload Users via CSV</h3>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                <strong>Instructions:</strong>
              </p>
              <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                <li>Upload a CSV file with columns: <code className="bg-blue-100 px-1 rounded">name</code>, <code className="bg-blue-100 px-1 rounded">email</code></li>
                <li>Each user will receive an invite email with a unique link to set their password</li>
                <li>The invite link expires in 7 days</li>
                <li>Select the role for all users in this upload</li>
              </ul>
              <button
                onClick={downloadSampleCSV}
                className="mt-3 flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800"
              >
                <Download className="w-4 h-4" />
                <span>Download Sample CSV</span>
              </button>
            </div>

            <form onSubmit={handleBulkUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
                {csvFile && (
                  <p className="text-sm text-gray-600 mt-1">Selected: {csvFile.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role for All Users</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  {user?.role === 'root_admin' && (
                    <>
                      <option value="school_admin">School Admin</option>
                      <option value="personal_teacher">Personal Teacher</option>
                    </>
                  )}
                </select>
              </div>

              {uploadResults && (
                <div className="p-4 bg-gray-50 border rounded-lg">
                  <h4 className="font-semibold mb-2">Upload Results:</h4>
                  <p className="text-sm text-green-600">✓ Successful: {uploadResults.successful}</p>
                  <p className="text-sm text-red-600">✗ Failed: {uploadResults.failed}</p>

                  {uploadResults.errors && uploadResults.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Errors:</p>
                      <div className="max-h-40 overflow-y-auto">
                        {uploadResults.errors.map((err, idx) => (
                          <p key={idx} className="text-xs text-red-600">
                            Row {err.row}: {err.email} - {err.error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkUploadModal(false);
                    setCsvFile(null);
                    setUploadResults(null);
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  {uploadResults ? 'Close' : 'Cancel'}
                </button>
                {!uploadResults && (
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Upload & Send Invites'
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Users;

