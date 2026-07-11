import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';

export default function NotificationsScreen({ navigation }) {
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadNotifications = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await api.get('/notifications/inapp');
      // The endpoint returns { notifications: [...] }
      setNotifications(response.data?.notifications || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/inapp/mark-all-read');
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      Alert.alert('Success', 'All notifications marked as read.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update notifications.');
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/inapp/${id}/read`);
      // Update local state
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.log('Failed to mark notification as read:', err.message);
    }
  };

  const getIconAndColor = (type) => {
    switch (type) {
      case 'new_assignment':
      case 'assignment_reminder':
        return { name: 'clipboard-outline', color: theme.text };
      case 'assignment_graded':
      case 'assignment_result':
        return { name: 'ribbon-outline', color: theme.success };
      case 'payment_success':
      case 'payment_received':
      case 'payout_received':
        return { name: 'cash-outline', color: theme.success };
      case 'topic_activated':
        return { name: 'play-circle-outline', color: theme.text };
      case 'class_reminder':
        return { name: 'time-outline', color: theme.text };
      default:
        return { name: 'notifications-outline', color: theme.muted };
    }
  };

  const renderItem = ({ item }) => {
    const iconConfig = getIconAndColor(item.type);
    const formattedDate = new Date(item.createdAt).toLocaleDateString() + ' ' + new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <Pressable
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: item.read ? theme.border : theme.text },
          !item.read && { backgroundColor: theme.surfaceElevated },
        ]}
        onPress={() => {
          if (!item.read) {
            handleMarkRead(item._id);
          }
          // Navigate to corresponding entities if applicable
          if (item.entityRef === 'Assignment') {
            navigation.navigate('AssignmentDetail', { assignmentId: item.entityId });
          } else if (item.entityRef === 'Classroom') {
            navigation.navigate('ClassroomDetail', { classroomId: item.entityId });
          }
        }}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${iconConfig.color}15` }]}>
          <Ionicons name={iconConfig.name} size={22} color={iconConfig.color} />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.messageText, { color: item.read ? theme.muted : theme.text }, !item.read && styles.messageTextUnread]}>
            {item.message}
          </Text>
          <Text style={[styles.dateText, { color: theme.muted }]}>{formattedDate}</Text>
        </View>

        {!item.read && <View style={[styles.unreadIndicator, { backgroundColor: theme.text }]} />}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        {notifications.some(n => !n.read) ? (
          <Pressable onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={[styles.markAllText, { color: theme.text }]}>Read all</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={() => loadNotifications()}>
            <Text style={[styles.retryBtnText, { color: theme.text }]}>Retry</Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="notifications-off-outline" size={48} color={theme.muted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>All caught up!</Text>
          <Text style={[styles.emptyText, { color: theme.muted }]}>You don't have any in-app notification messages at this time.</Text>
        </View>
      ) : (
          <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        />
      )}
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
  iconButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center', marginLeft: 12 },
  markAllBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  markAllText: { fontSize: 13, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 30 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: { flex: 1, marginLeft: 12, marginRight: 8 },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageTextUnread: { fontWeight: '600' },
  dateText: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  unreadIndicator: { width: 8, height: 8, borderRadius: 4 },
  errorCard: { padding: 24, alignItems: 'center', marginTop: 40 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  retryBtnText: { fontWeight: '700' },
  emptyCard: { padding: 40, alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 16 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
