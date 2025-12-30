import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Users, Book, Video, Edit, Eye, EyeOff, Search } from 'lucide-react';
import Select from 'react-select';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';

const Classrooms = () => {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [filteredClassrooms, setFilteredClassrooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule: [],   // Changed from '' to []
    capacity: 30,
    pricing: { type: 'per_class', amount: 0 },
    isPaid: false,
    teacherId: '',
    schoolIds: [], // Changed from schoolId
    published: false
  });

  // Get selectedSchools from localStorage
  const [selectedSchools, setSelectedSchools] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedSchools')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    fetchClassrooms();
    if (['root_admin', 'school_admin'].includes(user?.role)) {
      fetchTeachers();
    }
    // Listen for school selection changes from SchoolSwitcher
    const handler = (e) => {
      try {
        const newSchools = JSON.parse(localStorage.getItem('selectedSchools')) || [];
        setSelectedSchools(newSchools);
      } catch (err) {
        console.error('Error parsing school selection:', err);
      }
      fetchClassrooms();
      if (['root_admin', 'school_admin'].includes(user?.role)) {
        fetchTeachers();
      }
    };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, [user, selectedSchools]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClassrooms(classrooms);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = classrooms.filter(c =>
        c.name?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.teacherId?.name?.toLowerCase().includes(query)
      );
      setFilteredClassrooms(filtered);
    }
  }, [searchQuery, classrooms]);

  const fetchClassrooms = async () => {
    setLoading(true);
    try {
      const response = await api.get('/classrooms');
      let filteredClassrooms = response.data.classrooms;
      // Students and teachers see only published classrooms in the list
      if (user?.role === 'student' || user?.role === 'teacher') {
        filteredClassrooms = filteredClassrooms.filter(c => c.published);
      }
      // School admin: filter by selected school unless 'All' (empty array)
      if (user?.role === 'school_admin') {
        if (selectedSchools.length > 0) {
          filteredClassrooms = filteredClassrooms.filter(c => {
            const classroomSchoolIds = Array.isArray(c.schoolId)
              ? c.schoolId.map(sid => (sid?._id || sid)?.toString())
              : [c.schoolId?._id?.toString() || c.schoolId?.toString()];

            return selectedSchools.some(selectedId => {
              const sid = (selectedId?._id || selectedId)?.toString();
              return classroomSchoolIds.includes(sid);
            });
          });
        }
      }
      setClassrooms([...filteredClassrooms]);
      setFilteredClassrooms([...filteredClassrooms]);
    } catch (error) {
      console.error('Error fetching classrooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      let url = '/users?role=teacher,personal_teacher';
      console.log('Classrooms.jsx: Fetching teachers from URL:', url);
      const response = await api.get(url);
      console.log('Classrooms.jsx: Raw response data for teachers:', response.data);
      const teacherList = response.data.users.filter(u =>
        ['teacher', 'personal_teacher'].includes(u.role)
      );
      setTeachers(teacherList);
      console.log('Classrooms.jsx: Filtered teacher list length:', teacherList.length, 'Teachers:', teacherList);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const handlePublishToggle = async (classroomId, currentStatus) => {
    try {
      await api.put(`/classrooms/${classroomId}/publish`, { published: !currentStatus });
      fetchClassrooms();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating publish status');
    }
  };

  const [schools, setSchools] = useState([]);
  useEffect(() => {
    if (user?.role === 'school_admin') {
      api.get('/schools?adminId=' + user._id)
        .then(res => setSchools(res.data.schools || []))
        .catch(() => setSchools([]));
    }
  }, [user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        isPaid: formData.isPaid && formData.pricing?.amount > 0
      };
      if (user?.role === 'school_admin') {
        let schoolIdToSend = null;
        if (formData.schoolIds && formData.schoolIds.length > 0) {
          const allSelected = formData.schoolIds.length === schools.length &&
            schools.every(s => formData.schoolIds.includes(s._id));

          if (allSelected || formData.schoolIds.includes('ALL')) {
            schoolIdToSend = schools.map(s => s._id);
          } else {
            schoolIdToSend = formData.schoolIds.filter(id => id !== 'ALL');
          }
        } else {
          // Fallback to active school from switcher if none selected in form
          const currentSelected = JSON.parse(localStorage.getItem('selectedSchools') || '[]');
          if (currentSelected.length > 0) {
            schoolIdToSend = currentSelected;
          } else {
            toast.error('Please select at least one school');
            return;
          }
        }
        submitData.schoolId = schoolIdToSend;
        delete submitData.schoolIds;
      }
      // Teachers don't need to provide teacherId (it's auto-assigned)
      if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
        delete submitData.teacherId;
      }
      await api.post('/classrooms', submitData);
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        schedule: [],
        capacity: 30,
        pricing: { type: 'per_class', amount: 0 },
        isPaid: false,
        teacherId: '',
        published: false
      });
      toast.success('Classroom created successfully');
      fetchClassrooms();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating classroom');
    }
  };

  const canCreate = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);

  if (loading) {
    return <Layout><div className="text-center py-8">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">
            {user?.role === 'student' ? 'Available Classes' : 'Manage Classrooms'}
          </h2>
          {canCreate && (
            <button
              onClick={() => {
                const currentSelected = JSON.parse(localStorage.getItem('selectedSchools') || '[]');
                setFormData({
                  ...formData,
                  schoolIds: user?.role === 'school_admin' ? currentSelected.map(id => id?._id || id) : []
                });
                setShowCreateModal(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Class</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by class name, description, or teacher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClassrooms.map((classroom) => {
            const isEnrolled = user?.enrolledClasses?.includes(classroom._id) ||
              classroom.students?.some(s => s._id === user?._id);

            // Check if class is from a school or tutorial
            const isTutorial = !classroom.schoolId;

            return (
              <div key={classroom._id} className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition ${isTutorial ? 'border-l-4 border-purple-500' : ''
                }`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xl font-bold text-gray-800">{classroom.name}</h3>
                      {!classroom.published && (
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                          Draft
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${(Array.isArray(classroom.schoolId) ? classroom.schoolId.length > 0 : classroom.schoolId) ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'}`}>
                        {(Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}
                        {Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 && ` +${classroom.schoolId.length - 1}`}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      by {classroom.teacherId?.name || 'TBA'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    {classroom.isPaid && classroom.pricing?.amount > 0 ? (
                      <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-semibold">
                        {formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}
                      </span>
                    ) : (
                      <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-semibold">
                        Free
                      </span>
                    )}
                    {['root_admin', 'school_admin', 'personal_teacher'].includes(user?.role) && (
                      <button
                        onClick={() => handlePublishToggle(classroom._id, classroom.published)}
                        className={`text-xs px-2 py-1 rounded ${classroom.published
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                          }`}
                        title={classroom.published ? 'Published - Click to unpublish' : 'Unpublished - Click to publish'}
                      >
                        {classroom.published ? <Eye className="w-3 h-3 inline" /> : <EyeOff className="w-3 h-3 inline" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    {/* Displaying schedule - iterate over the array */}
                    {classroom.schedule && classroom.schedule.length > 0 ? (
                      classroom.schedule.map((session, index) => (
                        <span key={index} className="mr-1">
                          {session.dayOfWeek ? session.dayOfWeek.substring(0, 3) : 'N/A'} {session.startTime}-{session.endTime}
                          {index < classroom.schedule.length - 1 ? ',' : ''}
                        </span>
                      ))
                    ) : (
                      <span>No schedule available</span>
                    )}
                  </div>
                  {user?.role !== 'student' && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      {classroom.students?.length || 0} students enrolled
                    </div>
                  )}
                  <div className="flex items-center text-sm text-gray-600">
                    <Book className="w-4 h-4 mr-2" />
                    {classroom.topics?.length || 0} topics
                  </div>
                </div>

                <Link
                  to={`/classrooms/${classroom._id}`}
                  className="w-full block text-center bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-semibold mb-2"
                >
                  View Details
                </Link>
              </div>
            );
          })}
        </div>

        {filteredClassrooms.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">
              {searchQuery.trim() !== ''
                ? 'No classrooms found matching your search'
                : 'No classrooms available'}
            </p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4">Create Classroom</h3>
            {(['root_admin', 'school_admin'].includes(user?.role) && teachers.length === 0) && (
              <p className="text-red-500 text-sm mb-4 text-center">
                Please ensure there is at least one teacher registered for the school.
              </p>
            )}
            <form onSubmit={handleCreate} className="space-y-4">
              {user?.role === 'school_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School(s)</label>
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
                      : []
                    }
                    onChange={selected => {
                      if (selected.some(opt => opt.value === 'ALL')) {
                        setFormData({ ...formData, schoolIds: schools.map(s => s._id), teacherId: '' });
                      } else {
                        setFormData({ ...formData, schoolIds: selected.map(opt => opt.value), teacherId: '' });
                      }
                    }}
                    classNamePrefix="react-select"
                    placeholder="Select school(s)..."
                  />
                  <small className="text-gray-500 text-xs mt-1 block">
                    You can select multiple schools or "All Schools".
                  </small>
                </div>
              )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                {formData.schedule.map((session, index) => (
                  <div key={index} className="flex space-x-2 mb-2 items-center">
                    <select
                      value={session.dayOfWeek}
                      onChange={(e) => {
                        const newSchedule = [...formData.schedule];
                        newSchedule[index].dayOfWeek = e.target.value;
                        setFormData({ ...formData, schedule: newSchedule });
                      }}
                      className="w-1/3 px-2 py-1 border rounded-lg"
                      required
                    >
                      <option value="">Select Day</option>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={session.startTime}
                      onChange={(e) => {
                        const newSchedule = [...formData.schedule];
                        newSchedule[index].startTime = e.target.value;
                        setFormData({ ...formData, schedule: newSchedule });
                      }}
                      className="w-1/3 px-2 py-1 border rounded-lg"
                      required
                    />
                    <input
                      type="time"
                      value={session.endTime}
                      onChange={(e) => {
                        const newSchedule = [...formData.schedule];
                        newSchedule[index].endTime = e.target.value;
                        setFormData({ ...formData, schedule: newSchedule });
                      }}
                      className="w-1/3 px-2 py-1 border rounded-lg"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newSchedule = formData.schedule.filter((_, i) => i !== index);
                        setFormData({ ...formData, schedule: newSchedule });
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      X
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    schedule: [...formData.schedule, { dayOfWeek: '', startTime: '', endTime: '' }]
                  })}
                  className="mt-2 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                >
                  Add Session
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                  min="1"
                  required
                />
              </div>
              {['root_admin', 'school_admin'].includes(user?.role) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher</label>
                  {(() => {
                    // Filter teachers by selected schools in the form
                    const schoolIdsInForm = formData.schoolIds && formData.schoolIds.length > 0
                      ? formData.schoolIds
                      : (selectedSchools.length > 0 ? selectedSchools : []);

                    const filteredTeachers = schoolIdsInForm.length > 0 && user?.role === 'school_admin'
                      ? teachers.filter(teacher => {
                        const teacherSchoolIds = Array.isArray(teacher.schoolId)
                          ? teacher.schoolId.map(id => (id?._id || id)?.toString())
                          : [teacher.schoolId?._id?.toString() || teacher.schoolId?.toString()];

                        return schoolIdsInForm.some(sid => teacherSchoolIds.includes((sid?._id || sid)?.toString()));
                      })
                      : teachers;

                    return (
                      <select
                        value={formData.teacherId}
                        onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                      >
                        <option value="">Select a teacher</option>
                        {filteredTeachers.length > 0 ? (
                          filteredTeachers.map(teacher => (
                            <option key={teacher._id} value={teacher._id}>
                              {teacher.name} ({teacher.email})
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>
                            {schoolIdsInForm.length > 0 ? 'No teachers found for selected school(s)' : 'Please select a school first'}
                          </option>
                        )}
                      </select>
                    );
                  })()}
                </div>
              )}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isPaid}
                    onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                  />
                  <span>Paid Class</span>
                </label>
              </div>
              {['root_admin', 'school_admin', 'personal_teacher'].includes(user?.role) && (
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.published}
                      onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                    />
                    <span>Publish immediately</span>
                  </label>
                </div>
              )}
              {formData.isPaid && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₦)</label>
                  <input
                    type="number"
                    value={formData.pricing.amount}
                    onChange={(e) => setFormData({
                      ...formData,
                      pricing: { ...formData.pricing, amount: parseFloat(e.target.value) }
                    })}
                    className="w-full px-4 py-2 border rounded-lg"
                    min="0"
                    step="0.01"
                  />
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
                  disabled={loading || (['root_admin', 'school_admin'].includes(user?.role) && teachers.length === 0)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:bg-gray-400 disabled:hover:bg-gray-400"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Classrooms;

