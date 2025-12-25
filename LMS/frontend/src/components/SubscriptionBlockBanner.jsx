import React from 'react';

const SubscriptionBlockBanner = ({ onViewPlans }) => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-40">
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
      <h2 className="text-2xl font-bold mb-4 text-red-600">Subscription Required</h2>
      <p className="mb-6 text-gray-700">
        Your subscription is not active. You can only view the dashboard. Please activate or renew your subscription to access other features.
      </p>
      <button
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        onClick={onViewPlans}
      >
        View Subscription Plans
      </button>
    </div>
  </div>
);

export default SubscriptionBlockBanner;
