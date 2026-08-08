import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import SelectField from '../../components/ui/SelectField';

export default function ReportsScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [allStudentsData, setAllStudentsData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'all_students'

  // Teacher state
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);

  // School Admin state
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(null);

  const role = user?.role || 'student';

  const fetchReports = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);

    try {
      if (role === 'student') {
        const res = await api.get('/reports/student/me');
        setReportData(res.data);
      } else if (role === 'teacher' || role === 'personal_teacher') {
        let classId = selectedClassId;
        if (!classrooms.length) {
          const classRes = await api.get('/classrooms');
          const list = classRes.data?.classrooms || [];
          const options = list.map((c) => ({ label: c.name, value: c._id }));
          setClassrooms(options);
          if (options.length > 0 && !classId) {
            classId = options[0].value;
            setSelectedClassId(classId);
          }
        }
        if (classId) {
          const reportRes = await api.get(`/reports/class/${classId}`);
          setReportData(reportRes.data);
        }

        // Fetch consolidated students report
        try {
          const allRes = await api.get('/reports/all-students');
          setAllStudentsData(allRes.data);
        } catch (allErr) {
          console.log('All students report error:', allErr?.message);
        }
      } else if (role === 'school_admin') {
        let schoolId = selectedSchoolId;
        if (!schools.length) {
          const schoolRes = await api.get('/schools');
          const list = schoolRes.data?.schools || [];
          const options = [
            { label: 'All Schools', value: 'all' },
            ...list.map((s) => ({ label: s.name, value: s._id })),
          ];
          setSchools(options);
          if (!schoolId) {
            schoolId = options[0].value;
            setSelectedSchoolId(schoolId);
          }
        }
        if (schoolId) {
          const reportRes = await api.get(`/reports/school/${schoolId}`);
          setReportData(reportRes.data);
        }

        // Fetch consolidated students report for school admin
        try {
          const url = schoolId ? `/reports/all-students?schoolId=${schoolId}` : '/reports/all-students';
          const allRes = await api.get(url);
          setAllStudentsData(allRes.data);
        } catch (allErr) {
          console.log('All students report error:', allErr?.message);
        }
      } else if (role === 'root_admin') {
        const res = await api.get('/reports/admin/overview');
        setReportData(res.data);

        try {
          const allRes = await api.get('/reports/all-students');
          setAllStudentsData(allRes.data);
        } catch (allErr) {
          console.log('All students report error:', allErr?.message);
        }
      }
    } catch (err) {
      console.error('Fetch reports error:', err);
      setError(err?.response?.data?.message || 'Failed to load performance report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports(true);
  }, [role, selectedClassId, selectedSchoolId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports(false);
  };

  const getScoreColor = (score) => {
    const val = Number(score) || 0;
    if (val >= 80) return '#10b981'; // Green
    if (val >= 60) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  // RENDER STUDENT REPORT
  const renderStudentReport = () => {
    if (!reportData) return null;
    const { student, summary = {}, byClass = [], recentAssignments = [] } = reportData;

    const completionPercent =
      summary.totalAssignments > 0
        ? Math.round((summary.submittedCount / summary.totalAssignments) * 100)
        : 0;

    return (
      <View style={styles.sectionContainer}>
        {/* User Summary Header Card */}
        <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="school-outline" size={24} color={theme.primary} />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{student?.name || user?.name}</Text>
            <Text style={[styles.headerSub, { color: theme.muted }]}>{student?.email || user?.email}</Text>
          </View>
        </View>

        {/* Top Metric Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="document-text-outline" size={20} color={theme.text} />
            <Text style={[styles.statValue, { color: theme.text }]}>{summary.totalAssignments || 0}</Text>
            <Text style={[styles.statLabel, { color: theme.muted }]}>Total Tasks</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
            <Text style={[styles.statValue, { color: '#10b981' }]}>{summary.submittedCount || 0}</Text>
            <Text style={[styles.statLabel, { color: theme.muted }]}>Submitted</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="time-outline" size={20} color="#f59e0b" />
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{summary.pendingCount || 0}</Text>
            <Text style={[styles.statLabel, { color: theme.muted }]}>Pending</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="ribbon-outline" size={20} color={getScoreColor(summary.overallPercentage || 0)} />
            <Text style={[styles.statValue, { color: getScoreColor(summary.overallPercentage || 0) }]}>
              {summary.overallPercentage || 0}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.muted }]}>Avg Score</Text>
          </View>
        </View>

        {/* Completion Bar */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Assignment Completion</Text>
            <Text style={[styles.cardBadgeText, { color: theme.primary }]}>{completionPercent}%</Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
            <View style={[styles.progressBarFill, { width: `${completionPercent}%`, backgroundColor: theme.primary }]} />
          </View>
        </View>

        {/* Performance by Classroom */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Classroom Performance</Text>
        {byClass.length > 0 ? (
          byClass.map((cls, idx) => (
            <View key={cls.classId || idx} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{cls.className}</Text>
                  <Text style={[styles.cardSubText, { color: theme.muted }]}>
                    {cls.submittedCount || cls.submitted || 0} of {cls.totalAssignments || 0} completed
                  </Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(cls.averagePercentage || cls.totalScore || 0)}18` }]}>
                  <Text style={[styles.scoreBadgeText, { color: getScoreColor(cls.averagePercentage || cls.totalScore || 0) }]}>
                    {cls.averagePercentage || 0}%
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.muted }]}>No class performance records yet.</Text>
          </View>
        )}

        {/* Recent Assignments */}
        {recentAssignments.length > 0 && (
          <>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Recent Grades</Text>
            {recentAssignments.slice(0, 5).map((item, idx) => (
              <View key={item.id || item._id || idx} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title || item.assignmentTitle || 'Assignment'}</Text>
                    <Text style={[styles.cardSubText, { color: theme.muted }]}>{item.className}</Text>
                  </View>
                  <View style={[styles.scoreBadge, { backgroundColor: item.status === 'graded' || item.status === 'returned' || item.submitted ? '#10b98118' : '#f59e0b18' }]}>
                    <Text style={[styles.scoreBadgeText, { color: item.status === 'graded' || item.status === 'returned' || item.submitted ? '#10b981' : '#f59e0b' }]}>
                      {item.score != null && item.score > 0 ? `${item.score} pts` : item.status === 'submitted' || item.submitted ? 'Submitted' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  // RENDER TEACHER REPORT
  const renderTeacherReport = () => {
    if (!classrooms.length) {
      return (
        <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="easel-outline" size={40} color={theme.muted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Classrooms Found</Text>
          <Text style={[styles.emptyText, { color: theme.muted }]}>Create or assign classrooms to view performance reports.</Text>
        </View>
      );
    }

    const classroomInfo = reportData?.classroom || {};
    const assignmentStats = reportData?.assignmentStats || [];
    const studentStats = reportData?.studentStats || [];

    // Calculate class average
    const totalStudents = classroomInfo.studentCount || studentStats.length || 0;
    const avgScoreSum = studentStats.reduce((acc, s) => acc + (s.averagePercentage || 0), 0);
    const classAvgScore = studentStats.length > 0 ? Math.round(avgScoreSum / studentStats.length) : 0;

    return (
      <View style={styles.sectionContainer}>
        <SelectField
          label="Select Classroom"
          value={selectedClassId}
          options={classrooms}
          onChange={setSelectedClassId}
          placeholder="Choose classroom"
        />

        {/* Tab Toggle for Overview vs All Students */}
        <View style={styles.tabToggleRow}>
          <Pressable
            style={[
              styles.tabBtn,
              { backgroundColor: activeTab === 'overview' ? theme.primary : theme.surface, borderColor: theme.border },
            ]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'overview' ? theme.onPrimary : theme.text }]}>
              Class Overview
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabBtn,
              { backgroundColor: activeTab === 'all_students' ? theme.primary : theme.surface, borderColor: theme.border },
            ]}
            onPress={() => setActiveTab('all_students')}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'all_students' ? theme.onPrimary : theme.text }]}>
              All Students Summary
            </Text>
          </Pressable>
        </View>

        {activeTab === 'overview' ? (
          <>
            {/* Top Metric Cards */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="people-outline" size={20} color={theme.primary} />
                <Text style={[styles.statValue, { color: theme.text }]}>{totalStudents}</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>Students</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="document-text-outline" size={20} color="#10b981" />
                <Text style={[styles.statValue, { color: '#10b981' }]}>{assignmentStats.length}</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>Assignments</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="stats-chart-outline" size={20} color={getScoreColor(classAvgScore)} />
                <Text style={[styles.statValue, { color: getScoreColor(classAvgScore) }]}>{classAvgScore}%</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>Class Avg</Text>
              </View>
            </View>

            {/* Assignment Performance */}
            {assignmentStats.length > 0 && (
              <>
                <Text style={[styles.sectionHeading, { color: theme.text }]}>Assignment Stats</Text>
                {assignmentStats.map((assign, idx) => (
                  <View key={assign.id || idx} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>{assign.title}</Text>
                        <Text style={[styles.cardSubText, { color: theme.muted }]}>
                          Submissions: {assign.submissionCount || 0} / {assign.totalStudents || totalStudents}
                        </Text>
                      </View>
                      <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(assign.averageScore)}18` }]}>
                        <Text style={[styles.scoreBadgeText, { color: getScoreColor(assign.averageScore) }]}>
                          Avg: {assign.averageScore || 0} pts
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Students List */}
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Enrolled Students ({studentStats.length})</Text>
            {studentStats.length > 0 ? (
              studentStats.map((std, idx) => (
                <View key={std.id || idx} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{std.name}</Text>
                      <Text style={[styles.cardSubText, { color: theme.muted }]}>
                        {std.assignmentsSubmitted || 0} of {std.totalAssignments || 0} tasks submitted
                      </Text>
                    </View>
                    <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(std.averagePercentage)}18` }]}>
                      <Text style={[styles.scoreBadgeText, { color: getScoreColor(std.averagePercentage) }]}>
                        {std.averagePercentage || 0}%
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.emptyText, { color: theme.muted }]}>No enrolled students in this classroom.</Text>
              </View>
            )}
          </>
        ) : (
          renderAllStudentsView()
        )}
      </View>
    );
  };

  // RENDER SCHOOL ADMIN REPORT
  const renderSchoolAdminReport = () => {
    const schoolName = reportData?.schoolName || 'School Report';
    const totalStudents = reportData?.totalStudents || 0;
    const totalClassrooms = reportData?.totalClassrooms || 0;
    const overallAverage = reportData?.overallAverage || 0;
    const classPerformance = reportData?.classPerformance || [];

    return (
      <View style={styles.sectionContainer}>
        {schools.length > 0 && (
          <SelectField
            label="Select School"
            value={selectedSchoolId}
            options={schools}
            onChange={setSelectedSchoolId}
            placeholder="Select school"
          />
        )}

        {/* Tab Toggle */}
        <View style={styles.tabToggleRow}>
          <Pressable
            style={[
              styles.tabBtn,
              { backgroundColor: activeTab === 'overview' ? theme.primary : theme.surface, borderColor: theme.border },
            ]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'overview' ? theme.onPrimary : theme.text }]}>
              School Overview
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabBtn,
              { backgroundColor: activeTab === 'all_students' ? theme.primary : theme.surface, borderColor: theme.border },
            ]}
            onPress={() => setActiveTab('all_students')}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'all_students' ? theme.onPrimary : theme.text }]}>
              All Students Summary
            </Text>
          </Pressable>
        </View>

        {activeTab === 'overview' ? (
          <>
            {/* School Header Title */}
            <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="business-outline" size={24} color={theme.primary} />
              </View>
              <View style={styles.headerTextCol}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{schoolName}</Text>
                <Text style={[styles.headerSub, { color: theme.muted }]}>School Performance Report</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="business-outline" size={20} color={theme.primary} />
                <Text style={[styles.statValue, { color: theme.text }]}>{totalClassrooms}</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>Classes</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="people-outline" size={20} color="#10b981" />
                <Text style={[styles.statValue, { color: '#10b981' }]}>{totalStudents}</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>Students</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="ribbon-outline" size={20} color={getScoreColor(overallAverage)} />
                <Text style={[styles.statValue, { color: getScoreColor(overallAverage) }]}>{overallAverage}%</Text>
                <Text style={[styles.statLabel, { color: theme.muted }]}>School Avg</Text>
              </View>
            </View>

            <Text style={[styles.sectionHeading, { color: theme.text }]}>Classrooms Performance</Text>
            {classPerformance.length > 0 ? (
              classPerformance.map((item, idx) => (
                <View key={item.id || idx} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[styles.cardSubText, { color: theme.muted }]}>
                        {item.studentCount || 0} Students • {item.assignmentCount || 0} Assignments
                      </Text>
                    </View>
                    <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(item.averagePercentage)}18` }]}>
                      <Text style={[styles.scoreBadgeText, { color: getScoreColor(item.averagePercentage) }]}>
                        {item.averagePercentage || 0}% Avg
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.emptyText, { color: theme.muted }]}>No classrooms found for this school.</Text>
              </View>
            )}
          </>
        ) : (
          renderAllStudentsView()
        )}
      </View>
    );
  };

  // RENDER ROOT ADMIN REPORT
  const renderRootAdminReport = () => {
    const totalSchools = reportData?.totalSchools || 0;
    const totalUsers = reportData?.totalUsers || 0;
    const totalClassrooms = reportData?.totalClassrooms || 0;
    const totalAssignments = reportData?.totalAssignments || 0;

    return (
      <View style={styles.sectionContainer}>
        {/* Tab Toggle */}
        <View style={styles.tabToggleRow}>
          <Pressable
            style={[
              styles.tabBtn,
              { backgroundColor: activeTab === 'overview' ? theme.primary : theme.surface, borderColor: theme.border },
            ]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'overview' ? theme.onPrimary : theme.text }]}>
              Global Overview
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabBtn,
              { backgroundColor: activeTab === 'all_students' ? theme.primary : theme.surface, borderColor: theme.border },
            ]}
            onPress={() => setActiveTab('all_students')}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'all_students' ? theme.onPrimary : theme.text }]}>
              All Students Summary
            </Text>
          </Pressable>
        </View>

        {activeTab === 'overview' ? (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="school-outline" size={20} color={theme.primary} />
              <Text style={[styles.statValue, { color: theme.text }]}>{totalSchools}</Text>
              <Text style={[styles.statLabel, { color: theme.muted }]}>Schools</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="people-outline" size={20} color="#10b981" />
              <Text style={[styles.statValue, { color: '#10b981' }]}>{totalUsers}</Text>
              <Text style={[styles.statLabel, { color: theme.muted }]}>Users</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="easel-outline" size={20} color="#f59e0b" />
              <Text style={[styles.statValue, { color: '#f59e0b' }]}>{totalClassrooms}</Text>
              <Text style={[styles.statLabel, { color: theme.muted }]}>Classes</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="document-text-outline" size={20} color="#6366f1" />
              <Text style={[styles.statValue, { color: '#6366f1' }]}>{totalAssignments}</Text>
              <Text style={[styles.statLabel, { color: theme.muted }]}>Assignments</Text>
            </View>
          </View>
        ) : (
          renderAllStudentsView()
        )}
      </View>
    );
  };

  // RENDER CONSOLIDATED ALL STUDENTS VIEW
  const renderAllStudentsView = () => {
    const students = allStudentsData?.students || [];

    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Consolidated Student Performance</Text>
        {students.length > 0 ? (
          students.map((st, idx) => (
            <View key={st.id || st.email || idx} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{st.name}</Text>
                  <Text style={[styles.cardSubText, { color: theme.muted }]}>{st.email}</Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(st.overallAverage)}18` }]}>
                  <Text style={[styles.scoreBadgeText, { color: getScoreColor(st.overallAverage) }]}>
                    {st.overallAverage || 0}%
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.muted }]}>No consolidated student records available.</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* App Bar Header */}
      <View style={[styles.headerBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back-outline" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerBarTitle, { color: theme.text }]}>Reports & Analytics</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.muted }]}>Loading performance report...</Text>
          </View>
        ) : error ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="alert-circle-outline" size={40} color={theme.danger} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Unable to load report</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>{error}</Text>
            <Pressable
              style={[styles.retryBtn, { backgroundColor: theme.primary }]}
              onPress={() => fetchReports(true)}
            >
              <Text style={[styles.retryBtnText, { color: theme.onPrimary }]}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {role === 'student' && renderStudentReport()}
            {(role === 'teacher' || role === 'personal_teacher') && renderTeacherReport()}
            {role === 'school_admin' && renderSchoolAdminReport()}
            {role === 'root_admin' && renderRootAdminReport()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    height: 56,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: { padding: 4 },
  headerBarTitle: { fontSize: 17, fontWeight: '800' },
  scrollContent: { padding: 18, paddingBottom: 40 },
  loadingContainer: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { fontSize: 14, marginTop: 12, fontWeight: '500' },
  sectionContainer: { gap: 14 },
  headerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  tabToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  statLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  sectionHeading: { fontSize: 16, fontWeight: '800', marginTop: 10 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSubText: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  cardBadgeText: { fontSize: 14, fontWeight: '800' },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  scoreBadgeText: { fontSize: 13, fontWeight: '800' },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyText: { fontSize: 13, textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
  },
  retryBtnText: { fontSize: 14, fontWeight: '700' },
});
