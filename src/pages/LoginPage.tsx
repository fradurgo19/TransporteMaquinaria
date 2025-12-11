import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../templates/AuthLayout';
import { LoginForm } from '../molecules/LoginForm';
import { RegisterForm } from '../molecules/RegisterForm';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    navigate('/');
  };

  const handleRegister = async (
    username: string,
    email: string,
    password: string,
    role: 'admin' | 'user' | 'commercial'
  ) => {
    await register(username, email, password, role);
    navigate('/');
  };

  return (
    <AuthLayout title={isLogin ? 'Gestión de Transporte Partequipos S.A.S' : 'Create a new account'}>
      {isLogin ? (
        <LoginForm
          onSubmit={handleLogin}
          onSwitchToRegister={() => setIsLogin(false)}
        />
      ) : (
        <RegisterForm
          onSubmit={handleRegister}
          onSwitchToLogin={() => setIsLogin(true)}
        />
      )}
    </AuthLayout>
  );
};
