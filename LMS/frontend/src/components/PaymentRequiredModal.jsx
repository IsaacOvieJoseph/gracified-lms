import React from 'react';
import { X, Lock, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PaymentRequiredModal = ({ show, onClose, topic, classroomId }) => {
  const navigate = useNavigate();

  if (!show || !topic) return null;

  const handlePay = () => {
    // Navigate to payment page with params
    navigate(`/payments?classroomId=${classroomId}&topicId=${topic._id}&amount=${topic.price}&type=topic_access`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-yellow-500" />
            Access Restricted
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-yellow-600" />
          </div>
          
          <h4 className="text-xl font-bold text-gray-800 mb-2">Payment Required</h4>
          <p className="text-gray-600 mb-6">
            The topic <span className="font-semibold text-indigo-600">"{topic.name}"</span> requires payment to access its contents, including assignments, meetings, and the whiteboard.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">Access Fee</div>
            <div className="text-3xl font-bold text-green-600">₦{topic.price?.toLocaleString()}</div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handlePay}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition font-medium flex items-center justify-center gap-2 shadow-lg"
            >
              <CreditCard className="w-4 h-4" />
              Pay Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentRequiredModal;
