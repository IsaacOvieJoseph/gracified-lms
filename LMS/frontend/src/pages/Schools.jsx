import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { Plus, Pencil, Trash2, ArrowUpDown, Loader2, X } from "lucide-react";

const CreateSchoolModal = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const [schoolName, setSchoolName] = useState('');
  const [adminId, setAdminId] = useState(user?._id || '');
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);

  // For root_admin: fetch school admins to assign
  useEffect(() => {
    if (user?.role === 'root_admin' && open) {
      api.get('/users').then(res => {
        setAdmins(res.data.users.filter(u => u.role === 'school_admin' || u.role === 'root_admin'));
      });
    }
  }, [user, open]);

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name: schoolName };

      if (user.role === 'root_admin' && adminId) {
        payload.adminId = adminId;
      }

      await api.post('/schools', payload, { skipLoader: true });
      setSchoolName('');
      if (user.role === 'root_admin') {
        setAdminId('');
      } else if (user.role === 'school_admin') {
        setAdminId(user?._id);
      }
      onCreated && onCreated();
      onClose();
      toast.success('School created successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create school.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md animate-slide-up">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Establish New School</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleCreateSchool} className="space-y-6">
            <div>
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">School Name</label>
              <input
                type="text"
                placeholder="e.g. Gracified International"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                required
              />
            </div>
            {user?.role === 'root_admin' && (
              <div>
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Assign Administrator</label>
                <select
                  value={adminId}
                  onChange={e => setAdminId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                  required
                >
                  <option value="">Select an administrator</option>
                  {admins.map(a => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-premium flex-1"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Create School"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const EditSchoolModal = ({ open, onClose, school, onUpdated }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    adminId: "",
  });
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name,
        adminId: school.admin?._id || "",
      });
    }
  }, [school]);

  useEffect(() => {
    if (user?.role === 'root_admin' && open) {
      api.get('/users').then(res => {
        setAdmins(res.data.users.filter(u => u.role === 'school_admin' || u.role === 'root_admin'));
      });
    }
  }, [user, open]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { name: form.name };
      if (user.role === 'root_admin') {
        payload.adminId = form.adminId;
      } else if (user.role === 'school_admin') {
        payload.adminId = user._id;
      }
      await api.put(`/schools/${school._id}`, payload);
      toast.success('School updated successfully!');
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
      console.error("Update failed", err);
    }
  };

  if (!open || !school) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md animate-slide-up">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Modify School</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">School Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Isaac Ovie Joseph Academy"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                required
              />
            </div>

            {user?.role === 'root_admin' ? (
              <div>
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">School Admin</label>
                <select
                  value={form.adminId}
                  onChange={e => setForm({ ...form, adminId: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl"
                  required
                >
                  <option value="">Select Admin</option>
                  {admins.map(a => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Administrator</label>
                <input
                  type="text"
                  value={school.admin?.name || 'N/A'}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl cursor-not-allowed"
                  disabled
                />
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Discard
              </button>
              <button
                type="submit"
                className="btn-premium flex-1"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default function SchoolsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = ["root_admin", "school_admin"].includes(user?.role);
  const canCreateSchool = ["root_admin", "school_admin"].includes(user?.role);

  const loadSchools = async () => {
    try {
      if (schools.length === 0) setLoading(true);
      let response;
      if (user?.role === "school_admin" || user?.role === "root_admin") {
        response = await api.get("/schools");
        setSchools(response.data.schools || []);
      } else {
        setSchools([]);
      }
    } catch (err) {
      console.error("Error loading schools:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSchools();
    }
  }, [user]);

  const filteredSchools = Array.isArray(schools) ? schools.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.admin?.name?.toLowerCase().includes(q) ||
      s.admin?.email?.toLowerCase().includes(q)
    );
  }) : [];

  const sortData = (field) => {
    let direction = sortDir;
    if (sortField === field) {
      direction = direction === "asc" ? "desc" : "asc";
      setSortDir(direction);
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedSchools = [...filteredSchools].sort((a, b) => {
    if (!sortField) return 0;
    let x = a[sortField];
    let y = b[sortField];
    if (sortField === "adminName") {
      x = a.admin?.name || "";
      y = b.admin?.name || "";
    }
    if (sortField === "adminEmail") {
      x = a.admin?.email || "";
      y = b.admin?.email || "";
    }
    if (typeof x === "string") x = x.toLowerCase();
    if (typeof y === "string") y = y.toLowerCase();
    if (sortDir === "asc") return x > y ? 1 : -1;
    return x < y ? 1 : -1;
  });

  const deleteSchool = (id) => {
    setSchoolToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!schoolToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/schools/${schoolToDelete}`);
      toast.success('School deleted successfully');
      setShowDeleteModal(false);
      setSchoolToDelete(null);
      loadSchools();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
      console.error("Delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">Schools</h2>
          {canCreateSchool && (
            <button
              onClick={() => setModalOpen(true)}
              className="btn-premium"
            >
              <Plus className="w-5 h-5" />
              <span>Create School</span>
            </button>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search schools..."
            className="w-full sm:w-80"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="card-premium overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <HeaderCell label="School Name" field="name" sortData={sortData} sortField={sortField} sortDir={sortDir} />
                <HeaderCell label="Admin Name" field="adminName" sortData={sortData} sortField={sortField} sortDir={sortDir} />
                <HeaderCell label="Admin Email" field="adminEmail" sortData={sortData} sortField={sortField} sortDir={sortDir} />
                <HeaderCell label="Teachers" field="teacherCount" sortData={sortData} sortField={sortField} sortDir={sortDir} center />
                <HeaderCell label="Students" field="studentCount" sortData={sortData} sortField={sortField} sortDir={sortDir} center />
                {canManage && (
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-gray-500">Loading...</td>
                </tr>
              ) : sortedSchools.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-gray-500">No schools found</td>
                </tr>
              ) : (
                sortedSchools.map((school) => (
                  <tr
                    key={school._id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/schools/${school._id}`)}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{school.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{school.admin?.name || "N/A"}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{school.admin?.email || "N/A"}</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700">{school.teacherCount}</td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700">{school.studentCount}</td>
                    {canManage && (
                      <td
                        className="px-6 py-4 flex space-x-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { setSelectedSchool(school); setEditModalOpen(true); }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSchool(school._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateSchoolModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={loadSchools}
      />

      <EditSchoolModal
        open={editModalOpen}
        school={selectedSchool}
        onClose={() => setEditModalOpen(false)}
        onUpdated={loadSchools}
      />

      <ConfirmationModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete School"
        message="Are you sure you want to delete this school? This action cannot be undone and will affect all related users and classrooms."
        confirmText="Delete"
        isLoading={isDeleting}
      />
    </Layout>
  );
}

function HeaderCell({ label, field, sortData, sortField, sortDir, center }) {
  return (
    <th
      className={`px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer select-none transition-colors hover:text-primary ${center ? "text-center" : "text-left"
        }`}
      onClick={() => sortData(field)}
    >
      <div className={`flex items-center space-x-1 ${center ? "justify-center" : ""}`}>
        <span>{label}</span>
        <ArrowUpDown
          className={`w-4 h-4 transition-colors ${sortField === field ? "text-primary" : "text-slate-300"
            }`}
        />
      </div>
    </th>
  );
}
