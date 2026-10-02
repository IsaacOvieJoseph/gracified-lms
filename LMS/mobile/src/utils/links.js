import { Share, Alert, Platform } from 'react-native';

export const getWebBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_FRONTEND_URL || 'https://gracified-lms.vercel.app';
  return url.replace(/\/$/, '').replace(/\/api$/i, '');
};

export const buildClassroomLink = (classroom) => {
  const identifier = classroom?.slug || classroom?.shortCode || classroom?._id;
  return `${getWebBaseUrl()}/c/${identifier}`;
};

export const buildSchoolLink = (school) => {
  const identifier = school?.slug || school?.shortCode || school?._id;
  return `${getWebBaseUrl()}/s/${identifier}`;
};

export const buildExamLink = (exam) => {
  const identifier = exam?.linkToken || exam?._id;
  return `${getWebBaseUrl()}/exam-center/${identifier}`;
};

export const shareLink = async (url, { title, message } = {}) => {
  if (!url) {
    Alert.alert('Unavailable', 'This link is not available yet.');
    return;
  }

  try {
    const shareMessage = message || title || url;
    await Share.share(
      Platform.OS === 'ios'
        ? { url, message: shareMessage }
        : { message: `${shareMessage}\n${url}`, title: title || 'Share link' }
    );
  } catch (err) {
    if (err?.message !== 'User did not share') {
      Alert.alert('Share failed', 'Unable to share this link right now.');
    }
  }
};

export const shareClassroomLink = (classroom) =>
  shareLink(buildClassroomLink(classroom), {
    title: classroom?.name || 'Classroom',
    message: `Join "${classroom?.name || 'this class'}" on Gracified LMS`,
  });

export const shareSchoolLink = (school) =>
  shareLink(buildSchoolLink(school), {
    title: school?.name || 'School Portal',
    message: `Visit "${school?.name || 'our school'}" on Gracified LMS`,
  });

export const shareExamLink = (exam) =>
  shareLink(buildExamLink(exam), {
    title: exam?.title || 'Exam',
    message: `Take "${exam?.title || 'this exam'}" on Gracified LMS`,
  });
