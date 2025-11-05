import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card = React.memo<CardProps>(({ children, className = '', hover = false, ...props }) => {
  return (
    <div
      className={`
        bg-white rounded-lg shadow-md
        ${hover ? 'hover:shadow-lg transition-shadow duration-200' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export const CardHeader = React.memo<{ children: React.ReactNode; className?: string }>(
  ({ children, className = '' }) => {
    return (
      <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export const CardBody = React.memo<{ children: React.ReactNode; className?: string }>(
  ({ children, className = '' }) => {
    return <div className={`px-6 py-4 ${className}`}>{children}</div>;
  }
);

CardBody.displayName = 'CardBody';

export const CardFooter = React.memo<{ children: React.ReactNode; className?: string }>(
  ({ children, className = '' }) => {
    return (
      <div className={`px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg ${className}`}>
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';
