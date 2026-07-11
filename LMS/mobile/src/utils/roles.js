export const ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  PERSONAL_TEACHER: 'personal_teacher',
  SCHOOL_ADMIN: 'school_admin',
  ROOT_ADMIN: 'root_admin',
};

export const STAFF_ROLES = [
  ROLES.TEACHER,
  ROLES.PERSONAL_TEACHER,
  ROLES.SCHOOL_ADMIN,
  ROLES.ROOT_ADMIN,
];

export const PAYOUT_PROFILE_ROLES = [
  ROLES.SCHOOL_ADMIN,
  ROLES.PERSONAL_TEACHER,
];

export const hasRole = (user, roles) => roles.includes(user?.role);
export const isStudent = (user) => user?.role === ROLES.STUDENT;
export const isRootAdmin = (user) => user?.role === ROLES.ROOT_ADMIN;
export const isStaff = (user) => hasRole(user, STAFF_ROLES);
export const canCreateClassroom = (user) => isStaff(user);
export const canManageAssignments = (user) => isStaff(user);
export const canEditPayoutProfile = (user) => hasRole(user, PAYOUT_PROFILE_ROLES);
export const canUsePayments = (user) => hasRole(user, [ROLES.STUDENT, ...STAFF_ROLES]);
export const canUseAssignmentsPortal = (user) => isStudent(user);

export const getEntityId = (value) => (value?._id || value)?.toString?.();

export const getUserSchoolIds = (user) => (
  Array.isArray(user?.schoolId) ? user.schoolId : [user?.schoolId]
).filter(Boolean).map(getEntityId).filter(Boolean);

export const getClassroomSchoolIds = (classroom) => {
  const rawSchoolIds = classroom?.schoolId || classroom?.schoolIds || classroom?.schools || [];
  return (Array.isArray(rawSchoolIds) ? rawSchoolIds : [rawSchoolIds])
    .filter(Boolean)
    .map(getEntityId)
    .filter(Boolean);
};

export const isClassroomTeacher = (user, classroom) => {
  if (!hasRole(user, [ROLES.TEACHER, ROLES.PERSONAL_TEACHER])) return false;
  return getEntityId(classroom?.teacherId) === getEntityId(user);
};

export const isSchoolAdminOfClassroom = (user, classroom) => {
  if (user?.role !== ROLES.SCHOOL_ADMIN) return false;
  const userSchoolIds = getUserSchoolIds(user);
  const classroomSchoolIds = getClassroomSchoolIds(classroom);
  return userSchoolIds.some((schoolId) => classroomSchoolIds.includes(schoolId));
};

export const canManageClassroom = (user, classroom) => (
  isRootAdmin(user) ||
  isSchoolAdminOfClassroom(user, classroom) ||
  isClassroomTeacher(user, classroom)
);

export const canViewClassroomContent = (user, classroom) => (
  isRootAdmin(user) ||
  isSchoolAdminOfClassroom(user, classroom) ||
  isClassroomTeacher(user, classroom)
);

export const getRoleDisplayName = (role) => {
  switch (role) {
    case ROLES.ROOT_ADMIN:
      return 'Root Admin';
    case ROLES.SCHOOL_ADMIN:
      return 'School Principal';
    case ROLES.TEACHER:
      return 'School Teacher';
    case ROLES.PERSONAL_TEACHER:
      return 'Independent Tutor';
    default:
      return 'Student';
  }
};
