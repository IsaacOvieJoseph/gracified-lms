import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';

const normalizeClassroomsResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.classrooms)) return payload.classrooms;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
  }
  return [];
};

const classroomLevels = ['Pre-Primary', 'Primary', 'High School', 'Pre-University', 'Undergraduate', 'Postgraduate', 'Professional', 'Vocational', 'Other'];

export default function ClassroomsScreen({ navigation }) {
  const { user, setUser } = useAuth();
  const { theme } = useTheme();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject: '',
    level: 'Other',
    pricing: { amount: 0, type: 'one_time' },
    isPaid: false,
    isPrivate: false,
    published: true,
    capacity: 30,
    teacherId: user?.role === 'teacher' || user?.role === 'personal_teacher' ? user._id : '',
    schoolIds: user?.schoolId ? (Array.isArray(user.schoolId) ? user.schoolId : [user.schoolId]) : [],
  });

  const canCreate = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);

  const isClassOwner = (classroom) => {
    const teacherId = classroom.teacherId?._id || classroom.teacherId;
    return ['root_admin', 'school_admin'].includes(user?.role) || teacherId?.toString() === user?._id?.toString();
  };

  const canManageClassroom = (classroom) => {
    if (['root_admin', 'school_admin'].includes(user?.role)) return true;
    if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
      const teacherId = classroom.teacherId?._id || classroom.teacherId;
      return teacherId?.toString() === user?._id?.toString();
    }
    return false;
  };

  const fetchTeachers = async () => {
    if (!['root_admin', 'school_admin'].includes(user?.role)) return;
    try {
      const response = await api.get('/users?role=teacher,personal_teacher');
      const teacherList = Array.isArray(response.data?.users) ? response.data.users : response.data;
      setTeachers(teacherList.filter((t) => ['teacher', 'personal_teacher'].includes(t.role)));
    } catch (err) {
      console.log('Could not load teachers', err?.message || err);
    }
  };

  const fetchSchools = async () => {
    if (!['root_admin', 'school_admin'].includes(user?.role)) return;
    try {
      const url = user?.role === 'school_admin' ? `/schools?adminId=${user._id}` : '/schools';
      const response = await api.get(url);
      const schoolList = Array.isArray(response.data?.schools) ? response.data.schools : response.data;
      setSchools(schoolList || []);
    } catch (err) {
      console.log('Could not load schools', err?.message || err);
    }
  };

  const loadClassrooms = async () => {
    try {
      const response = await api.get('/classrooms');
      const allClassrooms = normalizeClassroomsResponse(response.data);

      const visibleClassrooms = allClassrooms.filter((item) => {
        if (!item) return false;

        if (user?.role === 'student') {
          return item.published !== false;
        }

        if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
          const teacherId = item.teacherId?._id || item.teacherId;
          return teacherId?.toString() === user?._id?.toString();
        }

        if (user?.role === 'school_admin') {
          const schoolIds = (Array.isArray(user?.schoolId) ? user.schoolId : [user?.schoolId]).filter(Boolean);
          const classroomSchoolIds = (Array.isArray(item.schoolId) ? item.schoolId : [item.schoolId]).filter(Boolean);
          return schoolIds.some((sid) => classroomSchoolIds.some((cid) => (cid?._id || cid)?.toString() === sid?.toString()));
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
      fetchTeachers();
      fetchSchools();
      loadClassrooms();
    } else {
      setLoading(false);
    }
  }, [user]);

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

  const filteredClassrooms = classrooms.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [item.name, item.description, item.subject, item.teacherId?.name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));

    const matchesPrice = priceFilter === 'all' || (priceFilter === 'free' && !item.isPaid) || (priceFilter === 'paid' && item.isPaid);

    return matchesSearch && matchesPrice;
  });

  const enrolledClassrooms = filteredClassrooms.filter(isStudentEnrolled);
  const exploreClassrooms = filteredClassrooms.filter((item) => !isStudentEnrolled(item));

  const handleEnroll = async (item) => {
    if (!user) return;

    try {
      if (item.isPaid) {
        const amount = item.pricing?.amount || 0;
        const response = await api.post('/payments/paystack/initiate', {
          amount,
          classroomId: item._id,
          type: 'class_enrollment'
        });

        const { authorization_url, reference } = response.data || {};
        if (authorization_url) {
          navigation.navigate('PaystackWebView', {
            authorizationUrl: authorization_url,
            reference,
            classroomId: item._id,
            type: 'class_enrollment'
          });
        } else {
          Alert.alert('Checkout Error', 'Payment initiation failed: authorization URL missing.');
        }
      } else {
        await api.post(`/classrooms/${item._id}/enroll`);
        setUser((currentUser) => ({
          ...currentUser,
          enrolledClasses: [...(currentUser?.enrolledClasses || []), item._id],
        }));
        setClassrooms((current) => current.map((classroom) => classroom._id === item._id ? { ...classroom, students: [...(classroom.students || []), { _id: user._id }] } : classroom));
        Alert.alert('Enrolled', 'You have successfully enrolled in this classroom.');
      }
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

  const handleCreateClassroom = async () => {
    if (!user) return;
    if (!formData.name.trim()) {
      Alert.alert('Missing title', 'Please provide a classroom name.');
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        subject: formData.subject,
        level: formData.level,
        isPaid: formData.isPaid && formData.pricing.amount > 0,
        pricing: { ...formData.pricing },
        isPrivate: formData.isPrivate,
        published: formData.published,
        capacity: formData.capacity,
        schedule: [],
      };

      if (['teacher', 'personal_teacher'].includes(user.role)) {
        payload.teacherId = user._id;
      } else if (formData.teacherId) {
        payload.teacherId = formData.teacherId;
      }

      if (user.role === 'school_admin') {
        payload.schoolId = formData.schoolIds;
      } else if (user.role === 'root_admin' && formData.schoolIds.length > 0) {
        payload.schoolId = formData.schoolIds;
      }

      const response = await api.post('/classrooms', payload);
      const newClassroom = response.data?.classroom || response.data;
      if (newClassroom) {
        setClassrooms((current) => [newClassroom, ...current]);
      }
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        subject: '',
        level: 'Other',
        pricing: { amount: 0, type: 'one_time' },
        isPaid: false,
        isPrivate: false,
        published: true,
        capacity: 30,
        teacherId: user?.role === 'teacher' || user?.role === 'personal_teacher' ? user._id : '',
        schoolIds: user?.schoolId ? (Array.isArray(user.schoolId) ? user.schoolId : [user.schoolId]) : [],
      });
      Alert.alert('Created', 'Classroom successfully created.');
    } catch (err) {
      Alert.alert('Creation failed', err?.response?.data?.message || 'Unable to create classroom.');
    } finally {
      setCreateLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const enrolled = isStudentEnrolled(item);
    const canManage = canManageClassroom(item);

    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Pressable style={styles.cardContent} onPress={() => navigation.navigate('ClassroomDetail', { classroomId: item._id })}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name || 'Untitled classroom'}</Text>
              <Text style={[styles.cardTeacher, { color: theme.muted }]}>{item.teacherId?.name || 'Instructor TBD'}</Text>
            </View>
            <View style={[styles.priceBadge, item.isPaid ? { backgroundColor: `${theme.warning}29` } : { backgroundColor: `${theme.success}29` }]}>
              <Text style={[styles.priceBadgeText, { color: theme.text }]}>{item.isPaid ? `NGN ${item.pricing?.amount || 0}` : 'Free'}</Text>
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
            <Pressable style={[styles.smallActionBtn, { backgroundColor: theme.surface, borderColor: theme.border }, item.published && { backgroundColor: theme.surfaceElevated }]} onPress={() => handlePublishToggle(item)}>
              <Ionicons name={item.published ? 'eye-outline' : 'eye-off-outline'} size={18} color={item.published ? theme.success : theme.muted} />
              <Text style={[styles.smallActionText, item.published ? { color: theme.success } : { color: theme.muted }]}>{item.published ? 'Published' : 'Unpublished'}</Text>
            </Pressable>
            <Pressable style={[styles.smallActionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => handleDelete(item)}>
              <Ionicons name="trash-outline" size={18} color={theme.danger} />
              <Text style={[styles.smallActionText, { color: theme.muted }]}>Delete</Text>
            </Pressable>
          </View>
        )}

        {user?.role === 'student' && (
          <Pressable style={[styles.actionBtn, { backgroundColor: enrolled ? theme.success : theme.primary }, enrolled && { backgroundColor: theme.success }]} onPress={() => enrolled ? navigation.navigate('ClassroomDetail', { classroomId: item._id }) : handleEnroll(item)}>
            <Text style={[styles.actionBtnText, { color: theme.onPrimary }]}>{enrolled ? 'Open' : item.isPaid ? 'Pay & Enroll' : 'Enroll'}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }] }>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.title, { color: theme.text }]}>{user?.role === 'student' ? 'Explore Classes' : 'Learning Spaces'}</Text>
          {canCreate && (
            <Pressable style={[styles.createBtn, { backgroundColor: theme.primary }]} onPress={() => setShowCreateModal(true)}>
              <Ionicons name="add-circle-outline" size={20} color={theme.onPrimary} />
              <Text style={[styles.createBtnText, { color: theme.onPrimary }]}>Create</Text>
            </Pressable>
          )}
        </View>
        <Text style={[styles.subtitle, { color: theme.muted }] }>
          {user?.role === 'student'
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
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : filteredClassrooms.length === 0 ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>No classes match your search</Text>
          <Text style={[styles.cardText, { color: theme.muted }]}>Try another keyword or change the price filter.</Text>
        </View>
      ) : (
        <FlatList
          data={user?.role === 'student' ? [...enrolledClassrooms, ...exploreClassrooms] : filteredClassrooms}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={user?.role === 'student' && enrolledClassrooms.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Your classes</Text>
            </View>
          ) : null}
          ListFooterComponent={user?.role === 'student' && exploreClassrooms.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Explore more</Text>
            </View>
          ) : null}
        />
      )}

      {showCreateModal && (
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>New Classroom</Text>
                <Pressable onPress={() => setShowCreateModal(false)} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={24} color={theme.muted} />
                </Pressable>
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Classroom title"
                placeholderTextColor={theme.muted}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Short description"
                placeholderTextColor={theme.muted}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Subject"
                placeholderTextColor={theme.muted}
                value={formData.subject}
                onChangeText={(text) => setFormData({ ...formData, subject: text })}
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Level (e.g. High School)"
                placeholderTextColor={theme.muted}
                value={formData.level}
                onChangeText={(text) => setFormData({ ...formData, level: text })}
              />

              <View style={styles.inlineRow}>
                <Pressable
                  style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, formData.isPaid && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => setFormData({ ...formData, isPaid: !formData.isPaid })}
                >
                  <Text style={[styles.chipText, { color: theme.muted }, formData.isPaid && { color: theme.onPrimary }]}>{formData.isPaid ? 'Paid classroom' : 'Free classroom'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, formData.isPrivate && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => setFormData({ ...formData, isPrivate: !formData.isPrivate })}
                >
                  <Text style={[styles.chipText, { color: theme.muted }, formData.isPrivate && { color: theme.onPrimary }]}>{formData.isPrivate ? 'Private' : 'Public'}</Text>
                </Pressable>
              </View>

              {formData.isPaid && (
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                  placeholder="Price amount"
                  placeholderTextColor={theme.muted}
                  keyboardType="numeric"
                  value={String(formData.pricing.amount)}
                  onChangeText={(value) => setFormData({ ...formData, pricing: { ...formData.pricing, amount: Number(value) || 0 } })}
                />
              )}

              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Capacity"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                value={String(formData.capacity)}
                onChangeText={(value) => setFormData({ ...formData, capacity: Number(value) || 30 })}
              />

              {['root_admin', 'school_admin'].includes(user?.role) && (
                <View style={styles.cardsWrapper}>
                  <Text style={[styles.sectionLabel, { color: theme.muted }]}>Assign teacher</Text>
                  <View style={styles.chipRow}>
                    {teachers.length === 0 ? (
                      <Text style={[styles.helperText, { color: theme.muted }]}>No teacher list available.</Text>
                    ) : teachers.map((teacher) => (
                      <Pressable
                        key={teacher._id}
                        style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, formData.teacherId === teacher._id && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                        onPress={() => setFormData({ ...formData, teacherId: teacher._id })}
                      >
                        <Text style={[styles.chipText, { color: theme.muted }, formData.teacherId === teacher._id && { color: theme.onPrimary }]}>{teacher.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {['root_admin', 'school_admin'].includes(user?.role) && (
                <View style={styles.cardsWrapper}>
                  <Text style={[styles.sectionLabel, { color: theme.muted }]}>School visibility</Text>
                  <View style={styles.chipRow}>
                    {schools.length === 0 ? (
                      <Text style={[styles.helperText, { color: theme.muted }]}>No school list available.</Text>
                    ) : schools.map((school) => (
                      <Pressable
                        key={school._id}
                        style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, formData.schoolIds.includes(school._id) && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                        onPress={() => {
                          const has = formData.schoolIds.includes(school._id);
                          setFormData({
                            ...formData,
                            schoolIds: has
                              ? formData.schoolIds.filter((id) => id !== school._id)
                              : [...formData.schoolIds, school._id]
                          });
                        }}
                      >
                        <Text style={[styles.chipText, { color: theme.muted }, formData.schoolIds.includes(school._id) && { color: theme.onPrimary }]}>{school.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.inlineRow}>
                <Pressable
                  style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, formData.published && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => setFormData({ ...formData, published: !formData.published })}
                >
                  <Text style={[styles.chipText, { color: theme.muted }, formData.published && { color: theme.onPrimary }]}>{formData.published ? 'Published' : 'Draft'}</Text>
                </Pressable>
              </View>

              <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }, createLoading && { opacity: 0.7 }]} onPress={handleCreateClassroom} disabled={createLoading}>
                <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>{createLoading ? 'Creating…' : 'Create Classroom'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
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
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  filterChipText: { fontWeight: '700', fontSize: 12 },
  list: { padding: 20, paddingBottom: 40 },
  sectionBlock: { marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  card: { borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
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
  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContainer: { width: '100%', maxHeight: '90%', borderRadius: 28, borderWidth: 1 },
  modalContent: { padding: 20, gap: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalCloseButton: { padding: 6 },
  input: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, marginBottom: 12 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '700' },
  cardsWrapper: { marginBottom: 14 },
  sectionLabel: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  helperText: { fontSize: 12 },
  submitBtn: { borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontWeight: '800', fontSize: 14 },
});
