import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { Plus, Pencil, Trash2, ArrowUpDown, Loader2, X, Share2, Award } from "lucide-react";

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
    <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-card rounded-[2rem] shadow-2xl p-8 w-full max-w-md animate-slide-up border border-border">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-foreground tracking-tighter uppercase italic">Academy <span className="text-primary not-italic">Establishment</span></h2>
            <button onClick={onClose} className="p-2 hover:bg-primary/20 hover:text-primary rounded-xl transition text-muted-foreground/30 active:scale-90">
              <X className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleCreateSchool} className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">School Name</label>
              <input
                type="text"
                placeholder="e.g. Gracified International"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:border-primary outline-none transition-colors text-foreground font-medium"
                required
              />
            </div>
            {user?.role === 'root_admin' && (
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">Assign Administrator</label>
                <select
                  value={adminId}
                  onChange={e => setAdminId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:border-primary outline-none transition-colors text-foreground font-medium appearance-none"
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
                className="flex-1 px-6 py-3 rounded-xl border border-border font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:bg-muted transition"
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
    <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[100] overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="bg-card rounded-[2rem] shadow-2xl p-8 w-full max-w-md animate-slide-up border border-border">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-foreground tracking-tighter uppercase italic">Reconfigure <span className="text-primary not-italic">Academy</span></h2>
            <button onClick={onClose} className="p-2 hover:bg-primary/20 hover:text-primary rounded-xl transition text-muted-foreground/30 active:scale-90">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">School Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Isaac Ovie Joseph Academy"
                className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:border-primary outline-none transition-colors text-foreground font-medium"
                required
              />
            </div>

            {user?.role === 'root_admin' ? (
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">School Admin</label>
                <select
                  value={form.adminId}
                  onChange={e => setForm({ ...form, adminId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl focus:border-primary outline-none transition-colors text-foreground font-medium appearance-none"
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
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 block">Administrator</label>
                <input
                  type="text"
                  value={school.admin?.name || 'N/A'}
                  className="w-full px-4 py-2.5 bg-muted border border-border rounded-xl cursor-not-allowed text-muted-foreground/40 font-medium"
                  disabled
                />
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl border border-border font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:bg-muted transition"
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
  const [tutorialCenters, setTutorialCenters] = useState([]);
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
  const isRootAdmin = user?.role === "root_admin";

  const loadSchools = async () => {
    try {
      if (schools.length === 0 && tutorialCenters.length === 0) setLoading(true);
      let response;
      if (user?.role === "school_admin" || user?.role === "root_admin") {
        response = await api.get("/schools");
        setSchools(response.data.schools || []);
      } else {
        setSchools([]);
      }
      
      // Load tutorial centers only for root_admin
      if (isRootAdmin) {
        try {
          const tutResponse = await api.get("/schools/tutorial-centers/all");
          setTutorialCenters(tutResponse.data.tutorialCenters || []);
        } catch (err) {
          console.error("Error loading tutorial centers:", err);
          setTutorialCenters([]);
        }
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

  // Combine schools and tutorial centers
  const allInstitutions = [
    ...schools.map(s => ({ ...s, type: 'school' })),
    ...tutorialCenters
  ];

  const filteredInstitutions = Array.isArray(allInstitutions) ? allInstitutions.filter((inst) => {
    const q = search.toLowerCase();
    const adminName = inst.type === 'school' ? inst.admin?.name : inst.teacherName;
    const adminEmail = inst.type === 'school' ? inst.admin?.email : inst.teacherEmail;
    return (
      inst.name?.toLowerCase().includes(q) ||
      adminName?.toLowerCase().includes(q) ||
      adminEmail?.toLowerCase().includes(q)
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

  const sortedSchools = [...filteredInstitutions].sort((a, b) => {
    if (!sortField) return 0;
    let x = a[sortField];
    let y = b[sortField];
    if (sortField === "adminName") {
      x = a.type === 'school' ? a.admin?.name : a.teacherName;
      y = b.type === 'school' ? b.admin?.name : b.teacherName;
    }
    if (sortField === "adminEmail") {
      x = a.type === 'school' ? a.admin?.email : a.teacherEmail;
      y = b.type === 'school' ? b.admin?.email : b.teacherEmail;
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

  const handleShare = (inst) => {
    let url;
    if (inst.type === 'school') {
      url = `${window.location.origin}/s/${inst.slug || inst.shortCode || inst._id}`;
    } else {
      url = `${window.location.origin}/tutorial-center/${inst._id}`;
    }
    navigator.clipboard.writeText(url);
    toast.success('Portal link copied!');
  };

  const handleManageSubscription = (inst) => {
    if (inst.type === 'school') {
      navigate('/subscription-management', { 
        state: { 
          schoolId: inst._id, 
          schoolName: inst.name,
          email: inst.admin?.email 
        } 
      });
    } else {
      navigate('/subscription-management', { 
        state: { 
          personalTeacherId: inst.teacherId, 
          tutorialCenterName: inst.name,
          email: inst.teacherEmail 
        } 
      });
    }
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tighter italic uppercase">School <span className="text-primary not-italic">Management</span></h2>
          {canCreateSchool && (
            <button
              onClick={() => setModalOpen(true)}
              className="btn-premium px-8 py-3 rounded-2xl flex items-center gap-3 shadow-lg shadow-primary/20"
            >
              <Plus className="w-5 h-5" />
              <span className="font-black text-[10px] uppercase tracking-widest">Establish Establishment</span>
            </button>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search schools or tutorial centers..."
            className="w-full sm:w-96 px-5 py-4 bg-muted/40 border-2 border-border rounded-2xl font-black italic tracking-tight placeholder:opacity-30 placeholder:italic focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="card-premium overflow-hidden overflow-x-auto border border-border">
          <table className="w-full">
            <thead className="bg-muted text-muted-foreground border-b border-border">
              <tr>
                <HeaderCell label="School Name" field="name" sortData={sortData} sortField={sortField} sortDir={sortDir} />
                <HeaderCell label="Admin Name" field="adminName" sortData={sortData} sortField={sortField} sortDir={sortDir} />
                <HeaderCell label="Admin Email" field="adminEmail" sortData={sortData} sortField={sortField} sortDir={sortDir} />
                <HeaderCell label="Teachers" field="teacherCount" sortData={sortData} sortField={sortField} sortDir={sortDir} center />
                <HeaderCell label="Students" field="studentCount" sortData={sortData} sortField={sortField} sortDir={sortDir} center />
                {canManage && (
                  <th className="px-6 py-4 text-left text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.25em] whitespace-nowrap">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary/30" />
                  </td>
                </tr>
              ) : sortedSchools.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-20 text-muted-foreground/30 font-bold italic uppercase tracking-widest">No establishments found</td>
                </tr>
              ) : (
                sortedSchools.map((inst) => (
                  <tr
                    key={inst._id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => inst.type === 'school' && navigate(`/schools/${inst._id}`)}
                  >
                    <td className="px-6 py-5 text-sm font-bold text-foreground italic">
                      {inst.name}
                      <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-primary/60 bg-primary/5 px-2 py-1 rounded">
                        {inst.type === 'school' ? 'School' : 'Tutorial'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-foreground/70 font-black uppercase tracking-tight">
                      {inst.type === 'school' ? (inst.admin?.name || "N/A") : (inst.teacherName || "N/A")}
                    </td>
                    <td className="px-6 py-5 text-sm text-muted-foreground font-medium">
                      {inst.type === 'school' ? (inst.admin?.email || "N/A") : (inst.teacherEmail || "N/A")}
                    </td>
                    <td className="px-6 py-5 text-center text-[10px] font-black text-primary uppercase">
                        <span className="bg-primary/5 px-3 py-1 rounded-full border border-primary/10 tracking-[0.2em]">
                          {inst.type === 'school' ? (inst.teacherCount || 0) : (inst.classCount || 0)}
                        </span>
                    </td>
                    <td className="px-6 py-5 text-center text-[10px] font-black uppercase">
                        <span className={`${inst.type === 'school' ? 'text-emerald-500 bg-emerald-500/5 border-emerald-500/10' : 'text-blue-500 bg-blue-500/5 border-blue-500/10'} px-3 py-1 rounded-full border tracking-[0.2em]`}>
                          {inst.type === 'school' ? (inst.studentCount || 0) : (inst.subscriptionStatus || 'Active')}
                        </span>
                    </td>
                    {canManage && (
                      <td
                        className="px-6 py-5 flex items-center space-x-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleShare(inst)}
                          className="p-2 text-muted-foreground/30 hover:text-primary transition-colors"
                          title="Share Access Link"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleManageSubscription(inst)}
                          className="p-2 text-muted-foreground/30 hover:text-amber-500 transition-colors"
                          title="Manage Subscription"
                        >
                          <Award className="w-4 h-4" />
                        </button>
                        {inst.type === 'school' && (
                          <>
                            <button
                              onClick={() => { setSelectedSchool(inst); setEditModalOpen(true); }}
                              className="p-2 text-muted-foreground/30 hover:text-blue-500 transition-colors"
                              title="Reconfigure Academy"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteSchool(inst._id)}
                              className="p-2 text-muted-foreground/30 hover:text-red-500 transition-colors"
                              title="Decommission Academy"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
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
        title="Decommission Academy"
        message="Are you sure you want to delete this school? This action will permanently remove all associated users and data."
        confirmText="DECOMMISSION"
        isLoading={isDeleting}
      />
    </Layout>
  );
}

const HeaderCell = ({ label, field, sortData, sortField, sortDir, center = false }) => {
  return (
    <th
      className={`px-6 py-5 text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.25em] cursor-pointer select-none transition-colors hover:text-primary ${center ? "text-center" : "text-left"
        }`}
      onClick={() => sortData(field)}
    >
      <div className={`flex items-center space-x-2 ${center ? "justify-center" : ""}`}>
        <span>{label}</span>
        <ArrowUpDown
          className={`w-3.5 h-3.5 transition-colors ${sortField === field ? "text-primary" : "text-muted-foreground/10"
            }`}
        />
      </div>
    </th>
  );
}
