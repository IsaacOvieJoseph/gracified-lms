import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { Plus, Pencil, Trash2, ArrowUpDown } from "lucide-react";

const CreateSchoolModal = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const [schoolName, setSchoolName] = useState('');
  const [adminId, setAdminId] = useState(user?._id);
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
        payload.adminId = adminId; // Root admin can explicitly assign an admin
      } else if (user.role === 'school_admin') {
        // School admin's adminId is handled by backend using req.user._id,
        // but we can explicitly send it for clarity/robustness if needed.
        // For now, relying on backend default for school_admin.
        // If backend logic changes, uncomment: payload.adminId = user._id;
      }

      await api.post('/schools', payload, { skipLoader: true });
      setSchoolName('');
      // Reset adminId to current user's ID only if it's a root_admin and they had selected someone else
      if (user.role === 'root_admin') {
        setAdminId(''); // Clear selection for root_admin
      } else if (user.role === 'school_admin') {
        setAdminId(user?._id); // Ensure it's reset to their own ID
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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm overflow-y-auto max-h-[90vh]">
        <h2 className="text-xl font-bold mb-4">Create School</h2>
        <form onSubmit={handleCreateSchool} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium text-sm">School Name</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          {user?.role === 'root_admin' && (
            <div>
              <label className="block mb-1 font-medium text-sm">School Admin</label>
              <select
                value={adminId}
                onChange={e => setAdminId(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">Select Admin</option>
                {admins.map(a => (
                  <option key={a._id} value={a._id}>
                    {a.name} ({a.email})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border px-3 py-2 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const EditSchoolModal = ({ open, onClose, school, onUpdated }) => {
  const { user } = useAuth(); // Access user from AuthContext
  const [form, setForm] = useState({
    name: "",
    adminId: "",
  });
  const [admins, setAdmins] = useState([]); // State to store list of admins for dropdown

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name,
        adminId: school.admin?._id || "",
      });
    }
  }, [school]);

  // Fetch admins if user is root_admin and modal is open
  useEffect(() => {
    if (user?.role === 'root_admin' && open) {
      api.get('/users').then(res => {
        setAdmins(res.data.users.filter(u => u.role === 'school_admin' || u.role === 'root_admin'));
      });
    }
  }, [user, open]);

  if (!open || !school) return null;

  const submit = async (e) => {
    e.preventDefault();

    try {
      const payload = { name: form.name };
      if (user.role === 'root_admin') {
        payload.adminId = form.adminId; // Root admin can change adminId
      } else if (user.role === 'school_admin') {
        payload.adminId = user._id; // School admin's adminId is fixed to themselves
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 overflow-y-auto max-h-[90vh]">
        <h3 className="text-xl font-bold mb-4">Edit School</h3>

        <form onSubmit={submit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>

          {user?.role === 'root_admin' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School Admin
              </label>
              <select
                value={form.adminId}
                onChange={e => setForm({ ...form, adminId: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
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
            // For School Admin, display their own adminId as fixed
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin (Fixed)
              </label>
              <input
                type="text"
                value={school.admin?.name || 'N/A'} // Display admin's name
                className="w-full px-4 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"
                disabled
              />
            </div>
          )}

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};


// export default function SchoolsPage() {
//   const { user } = useAuth();
//   const [modalOpen, setModalOpen] = useState(false);
//   const [schools, setSchools] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [search, setSearch] = useState("");

//   const canManage =
//     user?.role === "root_admin" || user?.role === "school_admin";

//   // Fetch schools
//   const loadSchools = async () => {
//     try {
//       setLoading(true);
//       const res = await api.get("/schools");
//       setSchools(res.data);
//     } catch (err) {
//       console.error("Error loading schools:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadSchools();
//   }, []);

//   // Search filtering
//   const filteredSchools = schools.filter((s) => {
//     const q = search.toLowerCase();
//     return (
//       s.name?.toLowerCase().includes(q) ||
//       s.admin?.name?.toLowerCase().includes(q) ||
//       s.admin?.email?.toLowerCase().includes(q)
//     );
//   });

//   return (
//     <Layout>
//       <div className="space-y-6">
//         {/* ---------- HEADER ---------- */}
//         <div className="flex justify-between items-center">
//           <h2 className="text-2xl font-bold text-gray-800">Schools</h2>

//           {canManage && (
//             <button
//               onClick={() => setModalOpen(true)}
//               className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
//             >
//               <Plus className="w-4 h-4" />
//               <span>Create School</span>
//             </button>
//           )}
//         </div>

//         {/* ---------- SEARCH BAR ---------- */}
//         <div>
//           <input
//             type="text"
//             placeholder="Search schools..."
//             className="px-4 py-2 border rounded-lg w-72 shadow-sm focus:ring focus:ring-blue-300 focus:outline-none"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//           />
//         </div>

//         {/* ---------- TABLE ---------- */}
//         <div className="bg-white rounded-lg shadow-md overflow-hidden">
//           <table className="w-full">
//             <thead className="bg-gray-50">
//               <tr>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                   School Name
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                   Admin Name
//                 </th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                   Admin Email
//                 </th>
//                 <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
//                   Teachers
//                 </th>
//                 <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
//                   Students
//                 </th>
//               </tr>
//             </thead>

//             <tbody className="divide-y divide-gray-200">
//               {loading ? (
//                 <tr>
//                   <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
//                     Loading...
//                   </td>
//                 </tr>
//               ) : filteredSchools.length === 0 ? (
//                 <tr>
//                   <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
//                     No matching schools found
//                   </td>
//                 </tr>
//               ) : (
//                 filteredSchools.map((school) => (
//                   <tr key={school._id}>
//                     <td className="px-6 py-4 text-sm font-medium text-gray-800">
//                       {school.name}
//                     </td>
//                     <td className="px-6 py-4 text-sm text-gray-700">
//                       {school.admin?.name ?? "N/A"}
//                     </td>
//                     <td className="px-6 py-4 text-sm text-gray-600">
//                       {school.admin?.email ?? "N/A"}
//                     </td>
//                     <td className="px-6 py-4 text-center text-sm text-gray-700">
//                       {school.teacherCount ?? 0}
//                     </td>
//                     <td className="px-6 py-4 text-center text-sm text-gray-700">
//                       {school.studentCount ?? 0}
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>

//         {/* ---------- EMPTY STATE ---------- */}
//         {!loading && schools.length === 0 && (
//           <div className="text-center py-12 bg-white rounded-lg shadow">
//             <p className="text-gray-500">No schools found</p>
//           </div>
//         )}
//       </div>

//       {/* ---------- CREATE SCHOOL MODAL ---------- */}
//       <CreateSchoolModal
//         open={modalOpen}
//         onClose={() => setModalOpen(false)}
//         onCreated={loadSchools}
//       />
//     </Layout>
//   );
// }



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

  const canManage = ["root_admin", "school_admin"].includes(user?.role); // Root admin and school admin can manage (edit/delete) schools
  const canCreateSchool = ["root_admin", "school_admin"].includes(user?.role); // Both root_admin and school_admin can create new schools

  // Fetch schools
  const loadSchools = async () => {
    try {
      if (schools.length === 0) setLoading(true);
      let response;
      if (user?.role === "school_admin") {
        // School admin fetches all schools they administer
        response = await api.get("/schools"); // Backend will filter by user.schoolId array
        setSchools(response.data.schools); // Backend now returns { schools: [...] }
      } else if (user?.role === "root_admin") {
        // Root admin fetches all schools
        response = await api.get("/schools");
        setSchools(response.data.schools); // Now returns { schools: [...] }
      } else {
        // Other roles or no user - no schools to load
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
      // Only load schools if user is defined
      loadSchools();
    }
  }, [user]); // Re-run when user object changes

  // -----------------------
  // SEARCH FILTER
  // -----------------------
  const filteredSchools = schools.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.admin?.name?.toLowerCase().includes(q) ||
      s.admin?.email?.toLowerCase().includes(q)
    );
  });

  // -----------------------
  // SORTING LOGIC
  // -----------------------
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

  // -----------------------
  // DELETE SCHOOL
  // -----------------------
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

        {/* HEADER */}
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

        {/* SEARCH */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search schools..."
            className="w-full sm:w-80"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* TABLE */}
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
                  <td colSpan="6" className="text-center py-4 text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedSchools.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-gray-500">
                    No schools found
                  </td>
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
                        onClick={(e) => e.stopPropagation()} // prevent navigation
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

      {/* CREATE MODAL */}
      <CreateSchoolModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={loadSchools}
      />

      {/* EDIT MODAL */}
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

/* -----------------------
   SORTABLE HEADER COMPONENT
------------------------ */
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
