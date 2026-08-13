import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Auth Screens
import AuthIntroScreen from '../screens/auth/AuthIntroScreen';
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
import VideoPlayerScreen from '../screens/classrooms/VideoPlayerScreen';
import AssignmentsScreen from '../screens/assignments/AssignmentsScreen';
import AssignmentDetailScreen from '../screens/assignments/AssignmentDetailScreen';
import ExamsScreen from '../screens/exams/ExamsScreen';
import ExamCenterScreen from '../screens/exams/ExamCenterScreen';
import ExamDetailScreen from '../screens/exams/ExamDetailScreen';
import PaymentsScreen from '../screens/payments/PaymentsScreen';
import PaystackWebViewScreen from '../screens/payments/PaystackWebViewScreen';
import QnACenterScreen from '../screens/qna/QnACenterScreen';
import WhiteboardScreen from '../screens/whiteboard/WhiteboardScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import SharedResourceScreen from '../screens/shared/SharedResourceScreen';
import ManageTeachersScreen from '../screens/users/ManageTeachersScreen';
import AIAssistantScreen from '../screens/ai/AIAssistantScreen';
import AITutorScreen from '../screens/ai/AITutorScreen';
import AITutorQuizScreen from '../screens/ai/AITutorQuizScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
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
          paddingBottom: 18 + insets.bottom,
          paddingTop: 10,
          paddingHorizontal: 8,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
          paddingVertical: 0,
          justifyContent: 'center',
          minWidth: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          textAlign: 'center',
          marginTop: 2,
        },
        tabBarLabel: ({ color, children }) => (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit={false}
            style={{ color, fontSize: 10, fontWeight: '700', lineHeight: 12, textAlign: 'center' }}
          >
            {children}
          </Text>
        ),
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
            <Stack.Screen name="SharedResource" component={SharedResourceScreen} />
            <Stack.Screen name="ClassroomDetail" component={ClassroomDetailScreen} />
            <Stack.Screen name="TopicDetail" component={TopicDetailScreen} />
            <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
            <Stack.Screen name="AssignmentDetail" component={AssignmentDetailScreen} />
            <Stack.Screen name="Exams" component={ExamsScreen} />
            <Stack.Screen name="ExamCenter" component={ExamCenterScreen} />
            <Stack.Screen name="ExamDetail" component={ExamDetailScreen} />
            <Stack.Screen name="PaystackWebView" component={PaystackWebViewScreen} />
            <Stack.Screen name="QnACenter" component={QnACenterScreen} />
            <Stack.Screen name="Whiteboard" component={WhiteboardScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="ManageTeachers" component={ManageTeachersScreen} />
            <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
            <Stack.Screen name="AITutor" component={AITutorScreen} />
            <Stack.Screen name="AITutorQuiz" component={AITutorQuizScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
          </>
        )
      ) : (
        // Non-Authenticated Stack
        <>
          <Stack.Screen name="AuthIntro" component={AuthIntroScreen} />
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
