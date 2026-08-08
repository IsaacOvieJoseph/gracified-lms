import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { canEditPayoutProfile, canCreateTeachers } from '../../utils/roles';
import { shareSchoolLink } from '../../utils/links';

export default function ProfileScreen({ navigation }) {
  const { user, setUser, logout } = useAuth();
  const [bankName, setBankName] = useState(user?.bankDetails?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(user?.bankDetails?.accountNumber || '');
  const [accountName, setAccountName] = useState(user?.bankDetails?.accountName || '');
  const [updating, setUpdating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [schools, setSchools] = useState([]);

  const canEditBankDetails = canEditPayoutProfile(user);
  const canManageTeachers = canCreateTeachers(user);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!['root_admin', 'school_admin'].includes(user?.role)) return;
    const loadSchools = async () => {
      try {
        const url = user.role === 'school_admin' ? `/schools?adminId=${user._id}` : '/schools';
        const response = await api.get(url);
        const schoolList = Array.isArray(response.data?.schools) ? response.data.schools : response.data;
        setSchools(schoolList || []);
      } catch (error) {
        console.log('Could not load schools for profile sharing', error?.message || error);
      }
    };
    loadSchools();
  }, [user]);

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

  const handlePickProfileImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo library access to choose a profile image or logo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('logo', {
      uri: asset.uri,
      name: asset.fileName || `profile-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });

    setUploadingImage(true);
    try {
      const uploadResponse = await api.post('/auth/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = uploadResponse.data?.imageUrl;
      if (!imageUrl) throw new Error('The uploaded image URL was not returned.');

      const profilePayload = { profilePicture: imageUrl };
      if (user?.role === 'school_admin') profilePayload.schoolLogoUrl = imageUrl;
      if (user?.role === 'personal_teacher') profilePayload.tutorialLogoUrl = imageUrl;

      const profileResponse = await api.put('/auth/profile', profilePayload);
      setUser(profileResponse.data.user);
      Alert.alert('Updated', user?.role === 'school_admin' || user?.role === 'personal_teacher' ? 'Your image and logo have been updated.' : 'Your profile image has been updated.');
    } catch (error) {
      Alert.alert('Upload failed', error?.response?.data?.message || error?.message || 'Unable to upload this image.');
    } finally {
      setUploadingImage(false);
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
          <Pressable onPress={handlePickProfileImage} disabled={uploadingImage} style={[styles.avatar, { backgroundColor: theme.border }]} accessibilityRole="button" accessibilityLabel="Change profile image or logo">
            {user?.profilePicture ? <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} /> : <Ionicons name="person" size={32} color={theme.text} />}
            <View style={[styles.avatarEdit, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
              {uploadingImage ? <ActivityIndicator size="small" color={theme.onPrimary} /> : <Ionicons name="camera-outline" size={13} color={theme.onPrimary} />}
            </View>
          </Pressable>
          <Pressable onPress={handlePickProfileImage} disabled={uploadingImage} style={styles.changeImageButton}>
            <Text style={[styles.changeImageText, { color: theme.primary }]}>{uploadingImage ? 'Uploading image…' : user?.profilePicture ? 'Change image / logo' : 'Add image / logo'}</Text>
          </Pressable>
          <Text style={[styles.name, { color: theme.text }]}>{user?.name || 'LMS User'}</Text>
          <Text style={[styles.email, { color: theme.muted }]}>{user?.email || 'user@example.com'}</Text>

          <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user?.role) }]}>
            <Text style={[styles.roleBadgeText, { color: theme.onPrimary }]}>{user?.role?.toUpperCase() || 'STUDENT'}</Text>
          </View>

          <Pressable
            style={[styles.reportsActionBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => navigation.navigate('Reports')}
          >
            <Ionicons name="bar-chart-outline" size={18} color={theme.primary} />
            <Text style={[styles.reportsActionText, { color: theme.text }]}>View Performance Reports</Text>
            <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
          </Pressable>
        </View>

        {['root_admin', 'school_admin'].includes(user?.role) && schools.length > 0 && (
          <View style={[styles.schoolSharePanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.schoolShareHeader}>
              <View style={[styles.schoolShareIcon, { backgroundColor: `${theme.primary}18` }]}>
                <Ionicons name="business-outline" size={18} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.schoolShareTitle, { color: theme.text }]}>School portal links</Text>
                <Text style={[styles.schoolShareDescription, { color: theme.muted }]}>Share a public link for any of your {schools.length} {schools.length === 1 ? 'school' : 'schools'}.</Text>
              </View>
            </View>
            {schools.map((school) => (
              <View key={school._id} style={[styles.schoolShareRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.schoolShareInfo}>
                  <Text style={[styles.schoolShareName, { color: theme.text }]}>{school.name}</Text>
                  <Text style={[styles.schoolShareHint, { color: theme.muted }]}>Public school portal</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Share ${school.name} school portal`} style={[styles.schoolShareButton, { backgroundColor: theme.primary }]} onPress={() => shareSchoolLink(school)}>
                  <Ionicons name="share-social-outline" size={16} color={theme.onPrimary} />
                  <Text style={[styles.schoolShareButtonText, { color: theme.onPrimary }]}>Share</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

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

          {canManageTeachers && (
            <Pressable
              style={[styles.actionRow, { borderBottomColor: theme.border }]}
              onPress={() => navigation.navigate('ManageTeachers')}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${theme.info}1A` }]}>
                <Ionicons name="people-outline" size={20} color={theme.info} />
              </View>
              <Text style={[styles.actionText, { color: theme.text }]}>Manage Teachers</Text>
              <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
            </Pressable>
          )}

          <Pressable style={styles.actionRow} onPress={() => navigation.navigate('Notifications')}>
            <View style={[styles.actionIcon, { backgroundColor: theme.surfaceElevated }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.text} />
            </View>
            <Text style={[styles.actionText, { color: theme.text }]}>Notifications</Text>
            <Ionicons name="chevron-forward-outline" size={16} color={theme.muted} />
          </Pressable>
        </View>

        {canEditBankDetails && (
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
  avatarImage: { width: '100%', height: '100%', borderRadius: 32 },
  avatarEdit: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  changeImageButton: { marginTop: -4, marginBottom: 12, paddingHorizontal: 8, paddingVertical: 5 },
  changeImageText: { fontSize: 12, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800' },
  email: { fontSize: 14, marginTop: 4, marginBottom: 12 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleBadgeText: { fontSize: 10, fontWeight: '800' },
  reportsActionBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  reportsActionText: { fontSize: 13, fontWeight: '700', flex: 1 },
  schoolSharePanel: { borderRadius: 20, padding: 14, borderWidth: 1, marginBottom: 24 },
  schoolShareHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  schoolShareIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  schoolShareTitle: { fontSize: 14, fontWeight: '800' },
  schoolShareDescription: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  schoolShareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1, marginTop: 8 },
  schoolShareInfo: { flex: 1, minWidth: 0 },
  schoolShareName: { fontSize: 13, fontWeight: '800' },
  schoolShareHint: { fontSize: 11, marginTop: 3 },
  schoolShareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  schoolShareButtonText: { fontSize: 11, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, paddingLeft: 4 },
  cardGroup: { borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  actionIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 12 },
  bankCard: { borderRadius: 20, padding: 18, borderWidth: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 14 },
  logoutBtnText: { fontWeight: '800', fontSize: 14 },
});
