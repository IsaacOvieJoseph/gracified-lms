import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';

const STATUS_META = {
  open: { label: 'Open', color: '#f59e0b' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  resolved: { label: 'Resolved', color: '#10b981' },
  rejected: { label: 'Not Approved', color: '#ef4444' },
};

const APP_STATUS_META = {
  pending: { label: 'Applied', color: '#3b82f6' },
  accepted: { label: 'Matched!', color: '#10b981' },
  declined: { label: 'Not Selected', color: '#9ca3af' },
};

export default function TutorReferralsScreen({ navigation }) {
  const { theme } = useTheme();
  const [tab, setTab] = useState('browse');

  const [published, setPublished] = useState([]);
  const [pubLoading, setPubLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [coverNote, setCoverNote] = useState('');
  const [applyFor, setApplyFor] = useState(null);
  const [applying, setApplying] = useState(false);
  const [appReplies, setAppReplies] = useState({});
  const [sendingApp, setSendingApp] = useState(false);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [showPicker, setShowPicker] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [classes, setClasses] = useState([]);
  const [chosenClass, setChosenClass] = useState('');
  const [sharing, setSharing] = useState(false);

  const loadBrowse = useCallback(async () => {
    setPubLoading(true);
    try {
      const res = await api.get('/tutor-requests/published');
      setPublished(res.data?.requests || []);
    } catch (_) { } finally {
      setPubLoading(false);
    }
  }, []);

  const loadReferrals = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const res = await api.get('/tutor-requests/referred');
      setRequests(res.data?.requests || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load referrals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBrowse();
    const unsub = navigation.addListener('focus', () => {
      loadBrowse();
      if (tab === 'students') loadReferrals(false);
    });
    return unsub;
  }, [navigation, tab, loadBrowse, loadReferrals]);

  useEffect(() => {
    if (tab === 'students') loadReferrals(false);
  }, [tab, loadReferrals]);

  const apply = async (rid) => {
    if (!rid || applying) return;
    setApplying(true);
    try {
      await api.post(`/tutor-requests/${rid}/apply`, { message: coverNote.trim() });
      setApplyFor(null);
      setCoverNote('');
      loadBrowse();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not apply.');
    } finally {
      setApplying(false);
    }
  };

  const appSend = async (rid, appId) => {
    const msg = (appReplies[appId] || '').trim();
    if (!msg || sendingApp) return;
    setSendingApp(true);
    try {
      await api.post(`/tutor-requests/${rid}/applications/${appId}/messages`, { message: msg });
      setAppReplies((m) => ({ ...m, [appId]: '' }));
      loadBrowse();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not send message.');
    } finally {
      setSendingApp(false);
    }
  };

  const openPicker = async (r) => {
    setPickerFor(r);
    setChosenClass('');
    setClasses([]);
    setShowPicker(true);
    try {
      const res = await api.get('/classrooms');
      const list = res.data?.classrooms || [];
      setClasses(list);
    } catch (_) { }
  };

  const shareClass = async () => {
    if (!pickerFor || !chosenClass || sharing) return;
    setSharing(true);
    try {
      await api.put(`/tutor-requests/${pickerFor._id}/class-link`, { classroomId: chosenClass });
      setShowPicker(false);
      setPickerFor(null);
      loadReferrals(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not share class.');
    } finally {
      setSharing(false);
    }
  };

  const canShare = (r) => ['open', 'in_progress'].includes(r.status) && !r.referral?.classroomId;

  const renderBrowseItem = (r) => {
    const app = r.myApplication;
    const appMeta = app ? APP_STATUS_META[app.status] : null;
    const isOpen = expandedId === r._id;
    return (
      <View key={r._id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Pressable onPress={() => setExpandedId(isOpen ? null : r._id)} style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: `${theme.primary}1A` }]}>
            <Ionicons name="school-outline" size={20} color={theme.primary} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{r.subject}</Text>
              {appMeta ? (
                <View style={[styles.statusBadge, { backgroundColor: `${appMeta.color}1A` }]}>
                  <Text style={[styles.statusText, { color: appMeta.color }]}>{appMeta.label}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.subject, { color: theme.muted }]} numberOfLines={1}>{r.description}</Text>
            <Text style={[styles.metaText, { color: theme.muted }]}>
              {new Date(r.createdAt).toLocaleDateString()}{r.urgency ? ` • ${r.urgency}` : ''} • {r.applicationCount || 0} applicant(s)
            </Text>
          </View>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.muted} />
        </Pressable>

        {isOpen ? (
          <View style={styles.expandBody}>
            <Text style={[styles.desc, { color: theme.muted }]}>{r.description}</Text>
            {!app ? (
              <View style={styles.applyRow}>
                <TextInput
                  style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                  placeholder="Optional note to the Gracified team..."
                  placeholderTextColor={theme.muted}
                  value={applyFor === r._id ? coverNote : ''}
                  onChangeText={(t) => { setApplyFor(r._id); setCoverNote(t); }}
                />
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: theme.primary }, applying && { opacity: 0.5 }]}
                  onPress={() => apply(r._id)}
                  disabled={applying}
                >
                  {applying ? <ActivityIndicator color={theme.onPrimary} size="small" /> : <Ionicons name="send" size={15} color={theme.onPrimary} />}
                  <Text style={[styles.primaryBtnText, { color: theme.onPrimary }]}>Apply</Text>
                </Pressable>
              </View>
            ) : app.status === 'pending' ? (
              <View>
                <Text style={[styles.chatLabel, { color: theme.muted }]}>Chat with the Gracified team about your application:</Text>
                <View style={styles.thread}>
                  {(app.messages || []).map((m, i) => {
                    const mine = m.senderRole === 'personal_teacher';
                    return (
                      <View
                        key={i}
                        style={[styles.bubble, mine ? [styles.userBubble, { backgroundColor: theme.primary }] : [styles.otherBubble, { backgroundColor: theme.surfaceElevated }]]}
                      >
                        <Text style={[styles.bubbleAuthor, { color: mine ? `${theme.onPrimary}CC` : theme.primary }]}>
                          {mine ? 'You' : 'Gracified Team'}
                        </Text>
                        <Text style={[styles.bubbleText, { color: mine ? theme.onPrimary : theme.text }]}>{m.message}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.applyRow}>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                    placeholder="Message the Gracified team..."
                    placeholderTextColor={theme.muted}
                    value={appReplies[app._id] || ''}
                    onChangeText={(t) => setAppReplies((m) => ({ ...m, [app._id]: t }))}
                  />
                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }, sendingApp && { opacity: 0.5 }]}
                    onPress={() => appSend(r._id, app._id)}
                    disabled={sendingApp}
                  >
                    {sendingApp ? <ActivityIndicator color={theme.onPrimary} size="small" /> : <Ionicons name="send" size={15} color={theme.onPrimary} />}
                  </Pressable>
                </View>
                {app.status === 'accepted' ? (
                  <Pressable onPress={() => { setTab('students'); loadReferrals(false); }} style={styles.hopLink}>
                    <Ionicons name="happy-outline" size={15} color="#10b981" />
                    <Text style={[styles.hopLinkText, { color: '#10b981' }]}>You were matched — view the student</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.desc, { color: theme.muted }]}>
                {app.status === 'accepted' ? 'You were matched with this student.' : 'This application was not selected.'}
              </Text>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const renderStudentItem = (r) => {
    const meta = STATUS_META[r.status];
    const unread = (r.messages || []).filter((m) => m.senderRole === 'student' && !m.readByTutor).length;
    return (
      <Pressable
        key={r._id}
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => navigation.navigate('TutorRequestDetail', { requestId: r._id })}
      >
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: `${theme.primary}1A` }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>
              {(r.studentId?.name || 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.nameRow}>
              <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{r.studentId?.name || 'Student'}</Text>
              <View style={[styles.statusBadge, { backgroundColor: `${meta.color}1A` }]}>
                <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
            <Text style={[styles.subject, { color: theme.muted }]} numberOfLines={1}>{r.subject}</Text>
          </View>
          {unread > 0 ? (
            <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
              <Text style={[styles.unreadText, { color: theme.onPrimary }]}>{unread}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.desc, { color: theme.muted }]} numberOfLines={2}>{r.description}</Text>
        <View style={styles.cardBottom}>
          <Ionicons name="calendar-outline" size={13} color={theme.muted} />
          <Text style={[styles.metaText, { color: theme.muted }]}>{new Date(r.createdAt).toLocaleDateString()}</Text>
          {"• "}
          <Text style={[styles.metaText, { color: theme.muted }]}>{r.messages?.length || 0} messages</Text>
          {canShare(r) ? (
            <Pressable style={[styles.shareBtn, { backgroundColor: theme.success }]} onPress={() => openPicker(r)}>
              <Ionicons name="videocam-outline" size={13} color="#fff" />
              <Text style={styles.shareBtnText}>Share Class</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const headerTab = (key, label, icon) => (
    <Pressable
      style={[
        styles.tabBtn,
        tab === key && { backgroundColor: theme.primary },
      ]}
      onPress={() => setTab(key)}
    >
      <Ionicons name={icon} size={15} color={tab === key ? theme.onPrimary : theme.muted} />
      <Text style={[styles.tabText, { color: tab === key ? theme.onPrimary : theme.muted }]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Tutor Center</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.tabRow, { borderBottomColor: theme.border }]}>
        {headerTab('browse', 'Browse Requests', 'megaphone-outline')}
        {headerTab('students', 'My Students', 'people-outline')}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); tab === 'students' ? loadReferrals(false) : loadBrowse(); }} />}
      >
        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        {tab === 'browse' ? (
          pubLoading && published.length === 0 ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={theme.primary} />
          ) : published.length > 0 ? (
            <View style={styles.list}>
              <Text style={[styles.hint, { color: theme.muted }]}>
                Requests published by the Gracified team. Apply and chat with them to get matched.
              </Text>
              {published.map(renderBrowseItem)}
            </View>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="megaphone-outline" size={30} color={theme.muted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No open requests</Text>
              <Text style={[styles.emptyText, { color: theme.muted }]}>
                When the Gracified team publishes a student request, it appears here for you to apply.
              </Text>
            </View>
          )
        ) : loading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color={theme.primary} />
        ) : requests.length > 0 ? (
          <View style={styles.list}>
            <Text style={[styles.hint, { color: theme.muted }]}>
              Students matched to you. Reach out, then share your class link to begin.
            </Text>
            {requests.map(renderStudentItem)}
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={30} color={theme.muted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No students matched yet</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              Browse published requests and apply — matched students will appear here.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalWrap}>
          <View style={[styles.pickerCard, { backgroundColor: theme.surface }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>Share Your Class</Text>
              <Pressable onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={22} color={theme.muted} />
              </Pressable>
            </View>
            <ScrollView style={styles.pickerScroll}>
              <Text style={[styles.pickerHint, { color: theme.muted }]}>
                Pick a class to share with this student. Sharing it closes the chat.
              </Text>
              {classes.length === 0 ? (
                <View style={[styles.noClasses, { backgroundColor: `${theme.warning}14`, borderColor: theme.warning }]}>
                  <Text style={[styles.noClassesText, { color: theme.warning }]}>
                    You don&apos;t have any classes yet. Create one under Classrooms first.
                  </Text>
                </View>
              ) : (
                classes.map((c) => (
                  <Pressable
                    key={c._id}
                    onPress={() => setChosenClass(c._id)}
                    style={[
                      styles.classOption,
                      { borderColor: chosenClass === c._id ? theme.primary : theme.border },
                      chosenClass === c._id && { backgroundColor: `${theme.primary}14` },
                    ]}
                  >
                    <View style={styles.classTextWrap}>
                      <Text style={[styles.className, { color: theme.text }]}>{c.name}</Text>
                      <Text style={[styles.classSubject, { color: theme.muted }]}>
                        {c.subject || 'General'}{c.isPaid ? ' • Paid' : ' • Free'}
                      </Text>
                    </View>
                    {chosenClass === c._id ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={20} color={theme.border} />
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable
              style={[styles.shareSubmit, { backgroundColor: theme.success }, (!chosenClass || sharing) && { opacity: 0.5 }]}
              onPress={shareClass}
              disabled={!chosenClass || sharing}
            >
              {sharing ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="videocam-outline" size={16} color="#fff" />}
              <Text style={styles.shareSubmitText}>Share Class & Close Chat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  tabRow: { flexDirection: 'row', gap: 10, padding: 12, borderBottomWidth: 1 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999 },
  tabText: { fontSize: 13, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 14 },
  error: { fontSize: 12, marginBottom: 10 },
  list: { gap: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  cardBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  studentName: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '800' },
  subject: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  metaText: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  unreadBadge: { minWidth: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { fontSize: 10, fontWeight: '800' },
  desc: { fontSize: 12, lineHeight: 17, marginTop: 9 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9, flexWrap: 'wrap' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, marginLeft: 'auto' },
  shareBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  expandBody: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', marginTop: 12, paddingTop: 12 },
  applyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  primaryBtnText: { fontSize: 13, fontWeight: '800' },
  chatLabel: { fontSize: 11, fontWeight: '700', marginTop: 12 },
  thread: { gap: 8, marginTop: 8 },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, maxWidth: '92%' },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  otherBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleAuthor: { fontSize: 9, fontWeight: '800', marginBottom: 2 },
  bubbleText: { fontSize: 13, lineHeight: 18 },
  hopLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  hopLinkText: { fontSize: 13, fontWeight: '800' },
  emptyCard: { alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 24, marginTop: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 5 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, maxHeight: '80%' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 17, fontWeight: '800' },
  pickerScroll: { padding: 16 },
  pickerHint: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  noClasses: { borderWidth: 1.5, borderRadius: 12, padding: 14 },
  noClassesText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  classOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 10, gap: 10 },
  classTextWrap: { flex: 1 },
  className: { fontSize: 14, fontWeight: '800' },
  classSubject: { fontSize: 12, marginTop: 2 },
  shareSubmit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 15, margin: 16, borderRadius: 14 },
  shareSubmitText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
