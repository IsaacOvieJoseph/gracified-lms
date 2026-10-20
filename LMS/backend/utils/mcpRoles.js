// ─── MCP role and scope vocabulary ───────────────────────────────────────────

const STAFF_ROLES = ['teacher', 'personal_teacher', 'school_admin', 'root_admin'];
const ADMIN_ROLES = ['school_admin', 'root_admin'];

const isStaff = (role) => STAFF_ROLES.includes(role);
const isAdmin = (role) => ADMIN_ROLES.includes(role);
const isStudent = (role) => role === 'student';

module.exports = { STAFF_ROLES, ADMIN_ROLES, isStaff, isAdmin, isStudent };
