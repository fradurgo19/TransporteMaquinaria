import React from 'react';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
}

export const Alert = React.memo<AlertProps>(({ type, message, onClose }) => {
  const config = {
    success: {
      bgColor: 'bg-green-50',
      textColor: 'text-green-800',
      borderColor: 'border-green-200',
      Icon: CheckCircle,
      iconColor: 'text-green-500',
    },
    error: {
      bgColor: 'bg-red-50',
      textColor: 'text-red-800',
      borderColor: 'border-red-200',
      Icon: XCircle,
      iconColor: 'text-red-500',
    },
    warning: {
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-200',
      Icon: AlertCircle,
      iconColor: 'text-yellow-500',
    },
    info: {
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-200',
      Icon: Info,
      iconColor: 'text-blue-500',
    },
  };

  const { bgColor, textColor, borderColor, Icon, iconColor } = config[type];

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-4 mb-4`}>
      <div className="flex items-start">
        <Icon className={`h-5 w-5 ${iconColor} mt-0.5`} />
        <div className="ml-3 flex-1">
          <p className={`text-sm font-medium ${textColor}`}>{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`ml-3 ${textColor} hover:opacity-70 transition-opacity`}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
});

Alert.displayName = 'Alert';
