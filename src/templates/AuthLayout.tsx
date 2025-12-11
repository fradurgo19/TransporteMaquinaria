import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png" 
              alt="Partequipos S.A.S" 
              className="h-16 w-auto object-contain"
              style={{ maxHeight: '80px' }}
            />
          </div>
          <p className="mt-2 text-secondary-600">{title}</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
};
