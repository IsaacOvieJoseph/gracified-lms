import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import NetworkTestScreen from '../screens/auth/NetworkTestScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Core Screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ClassroomsScreen from '../screens/classrooms/ClassroomsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Feature Detail Screens
import ClassroomDetailScreen from '../screens/classrooms/ClassroomDetailScreen';
import TopicDetailScreen from '../screens/classrooms/TopicDetailScreen';
import AssignmentsScreen from '../screens/assignments/AssignmentsScreen';
import AssignmentDetailScreen from '../screens/assignments/AssignmentDetailScreen';
import ExamsScreen from '../screens/exams/ExamsScreen';
import ExamCenterScreen from '../screens/exams/ExamCenterScreen';
import PaymentsScreen from '../screens/payments/PaymentsScreen';
import PaystackWebViewScreen from '../screens/payments/PaystackWebViewScreen';
import QnACenterScreen from '../screens/qna/QnACenterScreen';
import WhiteboardScreen from '../screens/whiteboard/WhiteboardScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import { canUseAssignmentsPortal, canUsePayments } from '../utils/roles';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: 82 + insets.bottom,
          paddingBottom: 20 + insets.bottom,
          paddingTop: 12,
        },
        tabBarSafeAreaInsets: { bottom: insets.bottom },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Dashboard: 'home-outline',
            Classes: 'school-outline',
            Assignments: 'clipboard-outline',
            Payments: 'receipt-outline',
            Profile: 'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Classes" component={ClassroomsScreen} options={{ tabBarLabel: 'Class' }} />
      {canUsePayments(user) && <Tab.Screen name="Payments" component={PaymentsScreen} />}
      {canUseAssignmentsPortal(user) && <Tab.Screen name="Assignments" component={AssignmentsScreen} />}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const needsVerification = user && !user.isVerified && user.role !== 'root_admin';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        needsVerification ? (
          // Unverified Users locked to verification screen
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        ) : (
          // Verified Main App Stack
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="ClassroomDetail" component={ClassroomDetailScreen} />
            <Stack.Screen name="TopicDetail" component={TopicDetailScreen} />
            <Stack.Screen name="AssignmentDetail" component={AssignmentDetailScreen} />
            <Stack.Screen name="Exams" component={ExamsScreen} />
            <Stack.Screen name="ExamCenter" component={ExamCenterScreen} />
            <Stack.Screen name="PaystackWebView" component={PaystackWebViewScreen} />
            <Stack.Screen name="QnACenter" component={QnACenterScreen} />
            <Stack.Screen name="Whiteboard" component={WhiteboardScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
          </>
        )
      ) : (
        // Non-Authenticated Stack
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="NetworkTest" component={NetworkTestScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
