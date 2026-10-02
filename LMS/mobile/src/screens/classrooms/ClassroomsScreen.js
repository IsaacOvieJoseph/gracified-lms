import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import {
  canCreateClassroom,
  canManageClassroom,
  getClassroomSchoolIds,
  getEntityId,
  getUserSchoolIds,
  isStudent,
} from '../../utils/roles';
import { shareClassroomLink } from '../../utils/links';

const normalizeClassroomsResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.classrooms)) return payload.classrooms;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
  }
  return [];
};

export default function ClassroomsScreen({ navigation, route }) {
  const { user, setUser } = useAuth();
  const { theme } = useTheme();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const canCreate = canCreateClassroom(user);

  const loadClassrooms = async () => {
    try {
      const response = await api.get('/classrooms');
      const allClassrooms = normalizeClassroomsResponse(response.data);

      const visibleClassrooms = allClassrooms.filter((item) => {
        if (!item) return false;

        if (isStudent(user)) {
          return item.published !== false;
        }

        if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
          return getEntityId(item.teacherId) === getEntityId(user);
        }

        if (user?.role === 'school_admin') {
          const schoolIds = getUserSchoolIds(user);
          const classroomSchoolIds = getClassroomSchoolIds(item);
          return schoolIds.some((schoolId) => classroomSchoolIds.includes(schoolId));
        }

        return true;
      });

      setClassrooms(visibleClassrooms);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load classrooms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadClassrooms();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Accept AI-generated classroom content from the assistant and open the form
  // with the result already mapped to the fields users need to review.
  useEffect(() => {
    const aiResult = route?.params?.aiResult;
    if (!aiResult || route?.params?.aiAction !== 'classroom') return;
    navigation.navigate('CreateClassroom', { mode: 'create', aiResult, aiAction: 'classroom' });
    navigation.setParams({ aiAction: undefined, aiResult: undefined });
  }, [route?.params?.aiAction, route?.params?.aiResult, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) {
        loadClassrooms();
      }
    });
    return unsubscribe;
  }, [navigation, user]);

  const isStudentEnrolled = (item) => {
    const hasDirectMatch = (user?.enrolledClasses || []).some((id) => (id?._id || id)?.toString() === item._id?.toString());
    const hasStudentMatch = (item.students || []).some((student) => (student?._id || student)?.toString() === user?._id?.toString());
    return hasDirectMatch || hasStudentMatch;
  };

  const subjectOptions = Array.from(new Set(classrooms
    .map((item) => item?.subject?.name || item?.subject)
    .filter(Boolean)
    .map((subject) => String(subject).trim())
    .filter(Boolean))).sort();

  const levelOptions = Array.from(new Set(classrooms
    .map((item) => item?.level)
    .filter(Boolean)
    .map((level) => String(level).trim())
    .filter(Boolean))).sort();

  const filteredClassrooms = classrooms.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    const subject = item.subject?.name || item.subject || '';
    const level = item.level || '';
    const matchesSearch = !query || [item.name, item.description, subject, item.teacherId?.name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));

    const matchesPrice = priceFilter === 'all' || (priceFilter === 'free' && !item.isPaid) || (priceFilter === 'paid' && item.isPaid);
    const matchesSubject = subjectFilter === 'all' || String(subject) === subjectFilter;
    const matchesLevel = levelFilter === 'all' || String(level) === levelFilter;

    return matchesSearch && matchesPrice && matchesSubject && matchesLevel;
  });

  const activeFilterCount = [priceFilter !== 'all', subjectFilter !== 'all', levelFilter !== 'all']
    .filter(Boolean).length;

  const enrolledClassrooms = filteredClassrooms.filter(isStudentEnrolled);
  const exploreClassrooms = filteredClassrooms.filter((item) => !isStudentEnrolled(item));

  const handleEnroll = async (item) => {
    if (!user) return;

    try {
      if (item.isPaid) {
        Alert.alert(
          'Paid classroom',
          'This classroom requires paid enrollment. Complete payment on the Gracified website and your access will appear here automatically.'
        );
        return;
      }
      await api.post(`/classrooms/${item._id}/enroll`);
      setUser((currentUser) => ({
        ...currentUser,
        enrolledClasses: [...(currentUser?.enrolledClasses || []), item._id],
      }));
      setClassrooms((current) => current.map((classroom) => classroom._id === item._id ? { ...classroom, students: [...(classroom.students || []), { _id: user._id }] } : classroom));
      Alert.alert('Enrolled', 'You have successfully enrolled in this classroom.');
    } catch (err) {
      Alert.alert('Enrollment failed', err?.response?.data?.message || 'Unable to enroll right now.');
    }
  };

  const handlePublishToggle = async (item) => {
    if (!item || !item._id) return;
    try {
      await api.put(`/classrooms/${item._id}/publish`, { published: !item.published });
      setClassrooms((current) => current.map((classroom) => classroom._id === item._id ? { ...classroom, published: !classroom.published } : classroom));
      Alert.alert('Updated', `Classroom has been ${item.published ? 'unpublished' : 'published'}.`);
    } catch (err) {
      Alert.alert('Status update failed', err?.response?.data?.message || 'Unable to update classroom status.');
    }
  };

  const handleDelete = async (item) => {
    if (!item || !item._id) return;
    Alert.alert(
      'Delete classroom',
      'Are you sure you want to delete this classroom? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/classrooms/${item._id}`);
              setClassrooms((current) => current.filter((classroom) => classroom._id !== item._id));
              Alert.alert('Deleted', 'Classroom removed successfully.');
            } catch (err) {
              Alert.alert('Delete failed', err?.response?.data?.message || 'Unable to delete classroom.');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => {
    const enrolled = isStudentEnrolled(item);
    const canManage = canManageClassroom(user, item);

    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Pressable style={styles.cardContent} onPress={() => navigation.navigate('ClassroomDetail', { classroomId: item._id })}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name || 'Untitled classroom'}</Text>
              <Text style={[styles.cardTeacher, { color: theme.muted }]}>{item.teacherId?.name || 'Instructor TBD'}</Text>
            </View>
            <View style={styles.cardHeaderActions}>
              <View style={[styles.priceBadge, item.isPaid ? { backgroundColor: `${theme.warning}29` } : { backgroundColor: `${theme.success}29` }]}>
                <Text style={[styles.priceBadgeText, { color: theme.text }]}>{item.isPaid ? `NGN ${item.pricing?.amount || 0}` : 'Free'}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.cardText, { color: theme.muted }]} numberOfLines={3}>{item.description || 'No description provided'}</Text>

          <View style={styles.metaRow}>
            <Text style={[styles.cardMeta, { color: theme.muted }]}>{item.level || 'Other'}</Text>
            <Text style={[styles.cardMeta, { color: theme.muted }]}>•</Text>
            <Text style={[styles.cardMeta, { color: theme.muted }]}>{item.students?.length ?? 0} students</Text>
            <Text style={[styles.cardMeta, { color: theme.muted }]}>•</Text>
            <Text style={[styles.cardMeta, { color: theme.muted }]}>{item.topics?.length ?? 0} topics</Text>
          </View>
        </Pressable>

        {canManage && (
          <View style={styles.adminActionsRow}>
            <Pressable
              style={[styles.smallActionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => shareClassroomLink(item)}
            >
              <Ionicons name="share-outline" size={18} color={theme.primary} />
              <Text style={[styles.smallActionText, { color: theme.primary }]}>Share</Text>
            </Pressable>
            <Pressable
              style={[styles.smallActionBtn, { backgroundColor: theme.surface, borderColor: theme.border }, item.published && { backgroundColor: theme.surfaceElevated }]}
              onPress={() => handlePublishToggle(item)}
            >
              <Ionicons name={item.published ? 'eye-off-outline' : 'eye-outline'} size={18} color={item.published ? theme.muted : theme.success} />
              <Text style={[styles.smallActionText, { color: item.published ? theme.muted : theme.success }]}>
                {item.published ? 'Unpublish' : 'Publish'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.smallActionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={18} color={theme.danger} />
              <Text style={[styles.smallActionText, { color: theme.muted }]}>Delete</Text>
            </Pressable>
          </View>
        )}

        {isStudent(user) && (
          <Pressable style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => enrolled ? navigation.navigate('ClassroomDetail', { classroomId: item._id }) : handleEnroll(item)}>
            <Text style={[styles.actionBtnText, { color: theme.onPrimary }]}>{enrolled ? 'Open' : item.isPaid ? 'Locked' : 'Enroll'}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }] }>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.title, { color: theme.text }]}>{isStudent(user) ? 'Explore Classes' : 'Learning Spaces'}</Text>
          {canCreate && (
            <Pressable style={[styles.createBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('CreateClassroom', { mode: 'create' })}>
              <Ionicons name="add-circle-outline" size={20} color={theme.onPrimary} />
              <Text style={[styles.createBtnText, { color: theme.onPrimary }]}>Create</Text>
            </Pressable>
          )}
        </View>
        <Text style={[styles.subtitle, { color: theme.muted }] }>
          {isStudent(user)
            ? 'Search classrooms and enroll from the same experience as the web app.'
            : 'Your assigned and managed classrooms are shown here.'}
        </Text>
      </View>

      <View style={styles.searchPanel}>
        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search classes, subjects, teachers"
            placeholderTextColor={theme.muted}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <Pressable
          style={[styles.filterToggle, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => setFiltersExpanded((prev) => !prev)}
        >
          <View style={styles.filterToggleLeft}>
            <Ionicons name="options-outline" size={18} color={theme.primary} />
            <Text style={[styles.filterToggleText, { color: theme.text }]}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: theme.primary }]}>
                <Text style={[styles.filterBadgeText, { color: theme.onPrimary }]}>{activeFilterCount}</Text>
              </View>
            )}
          </View>
          <Ionicons
            name={filtersExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.muted}
          />
        </Pressable>

        {filtersExpanded && (
          <View style={styles.filterSection}>
            <View style={styles.filterRow}>
              {['all', 'free', 'paid'].map((filter) => (
                <Pressable
                  key={filter}
                  style={[
                    styles.filterChip,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    priceFilter === filter && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => setPriceFilter(filter)}
                >
                  <Text style={[
                    styles.filterChipText,
                    { color: theme.muted },
                    priceFilter === filter && { color: theme.onPrimary },
                  ]}>
                    {filter === 'all' ? 'All' : filter === 'free' ? 'Free' : 'Paid'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: theme.muted }]}>Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {['all', ...subjectOptions].map((subject) => (
                  <Pressable
                    key={subject}
                    style={[
                      styles.filterChip,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      subjectFilter === subject && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setSubjectFilter(subject)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      { color: theme.muted },
                      subjectFilter === subject && { color: theme.onPrimary },
                    ]}>
                      {subject === 'all' ? 'All Subjects' : subject}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: theme.muted }]}>Level</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {['all', ...levelOptions].map((level) => (
                  <Pressable
                    key={level}
                    style={[
                      styles.filterChip,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      levelFilter === level && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                    onPress={() => setLevelFilter(level)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      { color: theme.muted },
                      levelFilter === level && { color: theme.onPrimary },
                    ]}>
                      {level === 'all' ? 'All Levels' : level}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : filteredClassrooms.length === 0 ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>No classes match your search</Text>
          <Text style={[styles.cardText, { color: theme.muted }]}>Try another keyword or adjust your filters.</Text>
        </View>
      ) : (
        <FlatList
          data={isStudent(user) ? [...enrolledClassrooms, ...exploreClassrooms] : filteredClassrooms}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={isStudent(user) && enrolledClassrooms.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Your classes</Text>
            </View>
          ) : null}
          ListFooterComponent={isStudent(user) && exploreClassrooms.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Explore more</Text>
            </View>
          ) : null}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 8, marginBottom: 16 },
  searchPanel: { paddingHorizontal: 20, paddingBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  filterToggle: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  filterToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterToggleText: { fontSize: 14, fontWeight: '700' },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: { fontSize: 11, fontWeight: '800' },
  filterSection: { marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterGroup: { marginTop: 12 },
  filterLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 7 },
  filterScroll: { gap: 8, paddingRight: 20 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  filterChipText: { fontWeight: '700', fontSize: 12 },
  list: { padding: 20, paddingBottom: 40 },
  sectionBlock: { marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  card: { borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardTeacher: { fontSize: 12, fontWeight: '700' },
  cardText: { fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  cardMeta: { fontSize: 11, fontWeight: '600' },
  priceBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  priceBadgeText: { fontSize: 11, fontWeight: '800' },
  actionBtn: { marginTop: 14, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { fontWeight: '800', fontSize: 13 },
  error: { textAlign: 'center', marginTop: 20 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  createBtnText: { fontWeight: '800' },
  cardContent: { paddingBottom: 12 },
  adminActionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  smallActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10, minWidth: 88 },
  smallActionText: { fontSize: 11, fontWeight: '700' },
});
