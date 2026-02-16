import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Plus, Calendar, Users, Book, Video, Edit, Eye, EyeOff, Search, Trash2, Loader2, ChevronDown, ChevronRight, Clock, School } from 'lucide-react';
import { convertLocalToUTC, convertUTCToLocal } from '../utils/timezone';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';

// subjectOptions converted to dynamic state inside component


const levelOptions = [
  { value: 'Pre-Primary', label: 'Pre-Primary' },
  { value: 'Primary', label: 'Primary' },
  { value: 'High School', label: 'High School' },
  { value: 'Pre-University', label: 'Pre-University' },
  { value: 'Undergraduate', label: 'Undergraduate' },
  { value: 'Postgraduate', label: 'Postgraduate' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Vocational', label: 'Vocational' },
  { value: 'Other', label: 'Other' },
];

const defaultSubjects = [
  'Mathematics', 'English', 'Physics', 'Chemistry', 'Biology',
  'Computer Science', 'History', 'Geography', 'Economics',
  'Literature', 'Art', 'Music', 'Physical Education'
];

const Classrooms = () => {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState([]);
  const [filteredClassrooms, setFilteredClassrooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subjectOptions, setSubjectOptions] = useState(defaultSubjects.map(s => ({ value: s, label: s }))); // Initialize with defaults
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    learningOutcomes: '',
    subject: '',
    level: 'Other',
    schedule: [],   // Changed from '' to []
    capacity: 30,
    pricing: { type: user?.defaultPricingType || 'monthly', amount: 0 },
    isPaid: false,
    teacherId: '',
    schoolIds: [], // Changed from schoolId
    published: false,
    isPrivate: false
  });

  useEffect(() => {
    // Fetch dynamic subjects
    const fetchSubjects = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data && res.data.subjects) {
          // Merge default subjects with fetched subjects and remove duplicates
          const uniqueSubjects = Array.from(new Set([...defaultSubjects, ...res.data.subjects]));
          // Sort alphabetically
          uniqueSubjects.sort();
          setSubjectOptions(uniqueSubjects.map(s => ({ value: s, label: s })));
        }
      } catch (err) {
        console.error('Error fetching subjects:', err);
      }
    };
    fetchSubjects();
  }, []);

  const [openMySchool, setOpenMySchool] = useState(true);
  const [openOthers, setOpenOthers] = useState(true);

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
    if (classrooms.length === 0) setLoading(true);
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
      setPublishingClassId(null);
    }
  };

  const fetchTeachers = async () => {
    try {
      let url = '/users?role=teacher,personal_teacher';
      // console.log('Classrooms.jsx: Fetching teachers from URL:', url);
      const response = await api.get(url);
      // console.log('Classrooms.jsx: Raw response data for teachers:', response.data);
      const teacherList = response.data.users.filter(u =>
        ['teacher', 'personal_teacher'].includes(u.role)
      );
      setTeachers(teacherList);
      // console.log('Classrooms.jsx: Filtered teacher list length:', teacherList.length, 'Teachers:', teacherList);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  const [publishingClassId, setPublishingClassId] = useState(null);
  const handlePublishToggle = async (classroomId, currentStatus) => {
    setPublishingClassId(classroomId);
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

  const [isCreating, setIsCreating] = useState(false);
  const handleCreate = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const submitData = {
        ...formData,
        isPaid: formData.isPaid && formData.pricing?.amount > 0,
        schedule: formData.schedule.map(s => {
          const utc = convertLocalToUTC(s.dayOfWeek, s.startTime);
          const utcEnd = convertLocalToUTC(s.dayOfWeek, s.endTime);
          return {
            dayOfWeek: utc.dayOfWeek,
            startTime: utc.time,
            endTime: utcEnd.time
          };
        })
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
      await api.post('/classrooms', submitData, { skipLoader: true });
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        learningOutcomes: '',
        subject: '',
        level: 'Other',
        schedule: [],
        capacity: 30,
        pricing: { type: user?.defaultPricingType || 'monthly', amount: 0 },
        isPaid: false,
        teacherId: '',
        published: false,
        isPrivate: false
      });
      toast.success('Classroom created successfully');
      fetchClassrooms();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating classroom');
    } finally {
      setIsCreating(false);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (classroomId, e) => {
    e.preventDefault(); // Prevent navigation link from triggering
    setClassToDelete(classroomId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!classToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/classrooms/${classToDelete}`);
      toast.success('Classroom deleted successfully');
      fetchClassrooms();
      setShowDeleteModal(false);
      setClassToDelete(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting classroom');
    } finally {
      setIsDeleting(false); // Ensure loading state is reset
    }
  };

  const canCreate = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);

  // Helper to check if a classroom belongs to student's school
  const isMySchoolClass = (classroom) => {
    if (!user?.schoolId || user.schoolId.length === 0) return false;
    // Map user school IDs to strings
    const userSchoolIds = user.schoolId.map(s => (s?._id || s).toString());

    if (Array.isArray(classroom.schoolId)) {
      return classroom.schoolId.some(sid => userSchoolIds.includes((sid?._id || sid).toString()));
    }
    return userSchoolIds.includes((classroom.schoolId?._id || classroom.schoolId)?.toString());
  };

  const renderClassroomGrid = (classroomsToRender) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {classroomsToRender.map((classroom) => {
        const isEnrolled = user?.enrolledClasses?.includes(classroom._id) ||
          classroom.students?.some(s => s._id === user?._id);

        // Check if class is from a school or tutorial
        const isTutorial = !classroom.schoolId;

        return (
          <div key={classroom._id} className={`relative bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition overflow-hidden flex flex-col h-full ${isTutorial ? 'border-l-4 border-purple-500' : ''
            }`}>
            {new Date(classroom.createdAt) > new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) && (
              <span className="absolute -left-6 top-2 bg-red-500 text-white text-[10px] px-6 py-0.5 font-semibold transform -rotate-45 shadow-sm">
                New
              </span>
            )}
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xl font-bold text-gray-800 truncate" title={classroom.name}>{classroom.name}</h3>
                </div>
                <p className="text-sm text-gray-600">
                  by {classroom.teacherId?.name || 'TBA'}
                </p>
              </div>
              <div className="flex flex-col items-end space-y-1">
                {/* Show dynamic topic price if available, else fallback to class price */}
                {classroom.dynamicTopicPrice ? (
                  <div className="flex flex-col items-end">
                    <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-semibold">
                      ₦{classroom.dynamicTopicPrice}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium uppercase mt-0.5">
                      PER TOPIC
                    </span>
                  </div>
                ) : classroom.isPaid && classroom.pricing?.amount > 0 ? (
                  <div className="flex flex-col items-end">
                    <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-semibold">
                      {formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}
                    </span>
                    {classroom.pricing?.type && classroom.pricing.type !== 'free' && (
                      <span className="text-[10px] text-gray-500 font-medium uppercase mt-0.5">
                        {classroom.pricing.type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
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
                    disabled={publishingClassId === classroom._id}
                  >
                    {publishingClassId === classroom._id ? (
                      <Loader2 className="w-3 h-3 inline animate-spin" />
                    ) : classroom.published ? (
                      <Eye className="w-3 h-3 inline" />
                    ) : (
                      <EyeOff className="w-3 h-3 inline" />
                    )}
                  </button>
                )}
                {(user?.role === 'root_admin' || user?.role === 'school_admin' || (user?.role === 'personal_teacher' && user?._id === classroom.teacherId?._id)) && (
                  <button
                    onClick={(e) => handleDeleteClick(classroom._id, e)}
                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200 transition"
                    title="Delete Classroom"
                  >
                    <Trash2 className="w-3 h-3 inline" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-grow space-y-2 mb-4">
              <div className="flex items-start text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <div className="truncate">
                  {classroom.schedule && classroom.schedule.length > 0 ? (
                    <>
                      {classroom.schedule.slice(0, 3).map((session, index) => {
                        const local = convertUTCToLocal(session.dayOfWeek, session.startTime);
                        const localEnd = convertUTCToLocal(session.dayOfWeek, session.endTime);
                        const isMultiDay = classroom.schedule.length > 1;
                        return (
                          <span key={index} className="mr-1">
                            {local.dayOfWeek ? local.dayOfWeek.substring(0, 3) : 'N/A'}
                            {!isMultiDay && ` ${local.hhmm}-${localEnd.hhmm} (${local.timezone})`}
                            {index < Math.min(classroom.schedule.length, 3) - 1 ? ',' : ''}
                          </span>
                        );
                      })}
                      {classroom.schedule.length > 3 && (
                        <span className="text-gray-400">+{classroom.schedule.length - 3} more</span>
                      )}
                      <span className="ml-1 text-[10px] font-bold text-indigo-500 uppercase">
                        (Weekly)
                      </span>
                    </>
                  ) : (
                    <span>No schedule available</span>
                  )}
                </div>
              </div>
              {user?.role !== 'student' && (
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="w-4 h-4 mr-2" />
                  {classroom.students?.length || 0} students enrolled
                </div>
              )}
              <div className="flex items-center text-sm text-gray-600">
                <School className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate" title={(Array.isArray(classroom.schoolId) ? classroom.schoolId.map(s => s?.name || s).join(', ') : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}>
                  {(Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}
                  {Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 && ` +${classroom.schoolId.length - 1}`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <div className="flex items-center">
                  <Book className="w-4 h-4 mr-2" />
                  {classroom.topics?.length || 0} topics
                </div>
                {(() => {
                  const currentTopic = classroom.topics?.find(t => t.status === 'active');
                  if (currentTopic) {
                    return (
                      <div className="flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-bold border border-blue-100">
                        <Clock className="w-3 h-3 mr-1 animate-pulse" />
                        Current: {currentTopic.name}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            <Link
              to={`/classrooms/${classroom._id}`}
              className="w-full block text-center bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-semibold mt-auto"
            >
              View Details
            </Link>
          </div>
        );
      })}
    </div>
  );

  // Logic to separate classes if student has a school
  const showAccordions = user?.role === 'student' && user?.schoolId && user.schoolId.length > 0;

  let mySchoolClasses = [];
  let otherClasses = [];

  if (showAccordions) {
    mySchoolClasses = filteredClassrooms.filter(isMySchoolClass);
    otherClasses = filteredClassrooms.filter(c => !isMySchoolClass(c));
  }

  if (loading) {
    return <Layout><div className="text-center py-8">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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

        <div>
          {showAccordions ? (
            <div className="space-y-8">
              {/* My School Section */}
              <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <button
                  onClick={() => setOpenMySchool(!openMySchool)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
                >
                  <h3 className="text-xl font-bold text-gray-800 flex items-center">
                    My School / Tutorial Center
                    <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{mySchoolClasses.length}</span>
                  </h3>
                  {openMySchool ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                </button>
                {openMySchool && (
                  <div className="p-4">
                    {mySchoolClasses.length > 0 ? renderClassroomGrid(mySchoolClasses) : (
                      <p className="text-gray-500 text-center py-4">No classes found for your school.</p>
                    )}
                  </div>
                )}
              </div>

              {otherClasses.length > 0 && (
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                  <button
                    onClick={() => setOpenOthers(!openOthers)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <h3 className="text-xl font-bold text-gray-800 flex items-center">
                      Others
                      <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{otherClasses.length}</span>
                    </h3>
                    {openOthers ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                  </button>
                  {openOthers && (
                    <div className="p-4">
                      {renderClassroomGrid(otherClasses)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            renderClassroomGrid(filteredClassrooms)
          )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Learning Outcomes</label>
                <textarea
                  value={formData.learningOutcomes}
                  onChange={(e) => setFormData({ ...formData, learningOutcomes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="3"
                  placeholder="Outline what students will learn..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <CreatableSelect
                  isClearable
                  options={subjectOptions}
                  value={formData.subject ? { value: formData.subject, label: formData.subject } : null}
                  onChange={(selected) => setFormData({ ...formData, subject: selected ? selected.value : '' })}
                  onCreateOption={async (inputValue) => {
                    // Optimistically set the value
                    setFormData({ ...formData, subject: inputValue });
                    // Add to options locally
                    const newOption = { value: inputValue, label: inputValue };
                    setSubjectOptions((prev) => [...prev, newOption]);
                    // Save to backend
                    try {
                      await api.post('/settings/add-subject', { subject: inputValue });
                      toast.success(`Subject "${inputValue}" added to global list`);
                    } catch (error) {
                      console.error('Error adding subject:', error);
                      toast.error('Failed to save new subject to global list');
                    }
                  }}
                  placeholder="Select or type a subject..."
                  classNamePrefix="react-select"
                  menuPortalTarget={document.body}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                <Select
                  options={levelOptions}
                  value={levelOptions.find(opt => opt.value === formData.level)}
                  onChange={(selected) => setFormData({ ...formData, level: selected.value })}
                  placeholder="Select class level..."
                  classNamePrefix="react-select"
                  menuPortalTarget={document.body}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (Weekly)</label>
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
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isPrivate}
                    onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                  />
                  <span>Private Classroom</span>
                </label>
                <p className="text-[10px] text-gray-500 ml-5 mt-1">
                  Private classes are only visible to school members and enrolled students.
                </p>
              </div>
              {formData.isPaid && (
                <div className="space-y-4">
                  {user?.subscriptionStatus === 'pay_as_you_go' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Type</label>
                      <select
                        value={formData.pricing.type}
                        onChange={(e) => setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, type: e.target.value }
                        })}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="per_lecture">Per Lecture</option>
                        <option value="per_topic">Per Topic</option>
                        <option value="free">Free</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {user?.subscriptionStatus === 'pay_as_you_go' ? 'Price (₦)' : 'Class Price (₦)'}
                    </label>
                    <input
                      type="number"
                      value={formData.pricing.amount}
                      onChange={(e) => setFormData({
                        ...formData,
                        pricing: { ...formData.pricing, amount: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border rounded-lg"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
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
                  disabled={loading || isCreating || (['root_admin', 'school_admin'].includes(user?.role) && teachers.length === 0)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:bg-gray-400 disabled:hover:bg-gray-400 flex items-center justify-center"
                >
                  Create
                  {isCreating && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Delete Classroom?</h3>
            <p className="text-gray-500 text-center mb-6">
              Are you sure you want to delete this classroom? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
                {isDeleting && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Classrooms;
