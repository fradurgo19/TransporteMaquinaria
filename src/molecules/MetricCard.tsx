import React from 'react';
import { Card, CardBody } from '../atoms/Card';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  iconColor?: string;
}

export const MetricCard = React.memo<MetricCardProps>(
  ({ title, value, icon: Icon, trend, iconColor = 'text-blue-600' }) => {
    return (
      <Card hover>
        <CardBody>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
              {trend && (
                <p
                  className={`mt-2 text-sm ${
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
                </p>
              )}
            </div>
            <div className={`p-3 rounded-full bg-gray-100 ${iconColor}`}>
              <Icon className="h-8 w-8" />
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }
);

MetricCard.displayName = 'MetricCard';
