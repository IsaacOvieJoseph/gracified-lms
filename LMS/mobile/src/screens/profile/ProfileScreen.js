import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ProfileScreen({ navigation }) {
  const { user, setUser, logout } = useAuth();
  const [bankName, setBankName] = useState(user?.bankDetails?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(user?.bankDetails?.accountNumber || '');
  const [accountName, setAccountName] = useState(user?.bankDetails?.accountName || '');
  const [updating, setUpdating] = useState(false);

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'personal_teacher' || user?.role === 'school_admin' || user?.role === 'root_admin';
  const { theme, toggleTheme } = useTheme();

  const handleUpdateBank = async () => {
    if (!bankName || !accountNumber || !accountName) {
      Alert.alert('Inputs required', 'Please fill in all bank details.');
      return;
    }
    setUpdating(true);
    try {
      const response = await api.put('/auth/profile', {
        bankName,
        accountNumber,
        accountName
      });
      setUser(response.data.user);
      Alert.alert('Success', 'Bank payout details updated successfully!');
    } catch (error) {
      Alert.alert('Update failed', error?.response?.data?.message || 'Failed to update bank details.');
    } finally {
      setUpdating(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'root_admin': return theme.danger;
      case 'school_admin': return theme.warning;
      case 'teacher':
      case 'personal_teacher': return theme.info;
      default: return theme.info;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.userCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: theme.border }]}>
            <Ionicons name="person" size={32} color={theme.text} />
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{user?.name || 'LMS User'}</Text>
          <Text style={[styles.email, { color: theme.muted }]}>{user?.email || 'user@example.com'}</Text>

          <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user?.role) }]}>
            <Text style={[styles.roleBadgeText, { color: theme.onPrimary }]}>{user?.role?.toUpperCase() || 'STUDENT'}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>General</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable style={[styles.actionRow, { borderBottomColor: theme.border }]} onPress={toggleTheme}>
            <View style={[styles.actionIcon, { backgroundColor: theme.surfaceElevated }]}>
              <Ionicons name={theme.mode === 'dark' ? 'moon' : 'sunny'} size={18} color={theme.text} />
            </View>
            <Text style={[styles.actionText, { color: theme.text }]}>Appearance: {theme.mode === 'dark' ? 'Dark' : 'Light'}</Text>
            <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
          </Pressable>
          <Pressable style={[styles.actionRow, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Payments')}>
            <View style={[styles.actionIcon, { backgroundColor: `${theme.success}1A` }]}>
              <Ionicons name="receipt-outline" size={20} color={theme.success} />
            </View>
            <Text style={[styles.actionText, { color: theme.text }]}>Billing & Payment History</Text>
            <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
          </Pressable>

          <Pressable style={styles.actionRow} onPress={() => navigation.navigate('Notifications')}>
            <View style={[styles.actionIcon, { backgroundColor: theme.surfaceElevated }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.text} />
            </View>
            <Text style={[styles.actionText, { color: theme.text }]}>Notifications Settings</Text>
            <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
          </Pressable>
        </View>

        {isTeacherOrAdmin && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Bank Payout Details</Text>
            <View style={[styles.bankCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Input
                placeholder="Bank Name"
                value={bankName}
                onChangeText={setBankName}
              />
              <Input
                placeholder="Account Number (10 digits)"
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
              />
              <Input
                placeholder="Account Name"
                value={accountName}
                onChangeText={setAccountName}
              />
              <Button
                title={updating ? 'Updating...' : 'Save bank details'}
                onPress={handleUpdateBank}
                disabled={updating}
              />
            </View>
          </View>
        )}

        <View style={{ marginTop: 32 }}>
          <Pressable style={[styles.logoutBtn, { backgroundColor: theme.danger }]} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={theme.onPrimary} />
            <Text style={[styles.logoutBtnText, { color: theme.onPrimary }]}>Sign out of account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  userCard: { borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, marginBottom: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '800' },
  email: { fontSize: 14, marginTop: 4, marginBottom: 12 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleBadgeText: { fontSize: 10, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, paddingLeft: 4 },
  cardGroup: { borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  actionIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 12 },
  bankCard: { borderRadius: 20, padding: 18, borderWidth: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 14 },
  logoutBtnText: { fontWeight: '800', fontSize: 14 },
});
