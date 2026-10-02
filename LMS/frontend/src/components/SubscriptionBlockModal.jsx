import React from 'react';

const SubscriptionBlockModal = ({ open, onClose, onViewPlans }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-none p-8 max-w-md w-full text-center overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-semibold mb-4 text-red-600">Action Restricted</h2>
        <p className="mb-6 text-gray-700">
          Your current subscription does not allow this action. Please upgrade or change your plan to continue.
        </p>
        <div className="flex justify-center gap-4">
          <button
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            onClick={onViewPlans}
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionBlockModal;
