import React from 'react';

const SubscriptionBlockBanner = ({ onViewPlans, user }) => {
  // Don't show banner for students or teachers
  if (user?.role === 'student' || user?.role === 'teacher') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-none p-8 max-w-md w-full text-center overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-semibold mb-4 text-red-600">Subscription Required</h2>
        <p className="mb-6 text-gray-700">
          Your subscription is not active. You can only view the dashboard. Please activate or renew your subscription to access other features.
        </p>
        <button
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          onClick={onViewPlans}
        >
          View Subscription Plans
        </button>
      </div>
    </div>
  );
};
export default SubscriptionBlockBanner;
