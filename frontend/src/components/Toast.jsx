import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import './Toast.css';

/**
 * Renders stacked notifications in the top-right corner.
 * Supports 'info', 'success', and 'error' variants.
 */
export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  const renderIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} color="var(--status-jackpot)" />;
      case 'error':
        return <AlertCircle size={18} color="var(--status-bomb)" />;
      default:
        return <Info size={18} color="var(--accent-brass)" />;
    }
  };

  return (
    <div className="toast-viewport" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card toast-${toast.type || 'info'}`}>
          <div className="toast-body">
            {renderIcon(toast.type)}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => onDismiss(toast.id)}
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}