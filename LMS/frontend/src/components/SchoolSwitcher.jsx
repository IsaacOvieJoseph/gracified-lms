import React, { useEffect, useState } from 'react';
import api from '../utils/api';

const SchoolSwitcher = ({ user, selectedSchools, setSelectedSchools }) => {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'school_admin') {
      api.get('/schools?adminId=' + user._id)
        .then(res => setSchools(res.data.schools || []))
        .catch(() => setSchools([]))
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (user?.role !== 'school_admin') return null;
  if (loading) return <span>Loading schools...</span>;
  if (!schools.length) return <span>No schools found</span>;

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">Schools:</label>
      <select
        value={selectedSchools[0] || 'ALL'}
        onChange={e => {
          const value = e.target.value;
          let schoolsArr;
          if (value === 'ALL') {
            schoolsArr = [];
            setSelectedSchools([]);
            localStorage.setItem('selectedSchools', JSON.stringify([]));
          } else {
            schoolsArr = [value];
            setSelectedSchools([value]);
            localStorage.setItem('selectedSchools', JSON.stringify([value]));
          }
          // Dispatch a custom event so pages can listen and reload data
          window.dispatchEvent(new CustomEvent('schoolSelectionChanged', { detail: schoolsArr }));
        }}
        className="border rounded px-2 py-1 text-sm"
        style={{ minWidth: 120, maxWidth: 220 }}
      >
        <option value="ALL">All</option>
        {schools.map(s => (
          <option key={s._id} value={s._id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
};

export default SchoolSwitcher;
