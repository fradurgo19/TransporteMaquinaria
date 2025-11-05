import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EquipmentProvider, useEquipment } from './context/EquipmentContext';
import { QueryProvider } from './context/QueryProvider';
import { LoginPage } from './pages/LoginPage';
import { EquipmentSelectionPage } from './pages/EquipmentSelectionPage';
import { DashboardPage } from './pages/DashboardPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { OperationHoursPage } from './pages/OperationHoursPage';
import { FuelPage } from './pages/FuelPage';
import { OperationsPage } from './pages/OperationsPage';
import { ChecklistPage } from './pages/ChecklistPage';
import { TransportRequestsPage } from './pages/TransportRequestsPage';
import { ExpenseClaimsPage } from './pages/ExpenseClaimsPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { Spinner } from './atoms/Spinner';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isEquipmentSelected } = useEquipment();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Admins NO necesitan seleccionar equipo
  if (user?.role !== 'admin' && !isEquipmentSelected) {
    return <Navigate to="/equipment-selection" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  if (user?.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return <>{children}</>;
};

const DashboardRedirect: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { isEquipmentSelected } = useEquipment();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Admins van al dashboard
  if (user?.role === 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Usuarios normales necesitan seleccionar equipo primero
  if (!isEquipmentSelected) {
    return <Navigate to="/equipment-selection" replace />;
  }
  
  return <Navigate to="/operation-hours" replace />;
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { isEquipmentSelected } = useEquipment();

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
      />
      <Route
        path="/equipment-selection"
        element={
          isAuthenticated ? <EquipmentSelectionPage /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <DashboardPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipment"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <EquipmentPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/operation-hours"
        element={
          <ProtectedRoute>
            <OperationHoursPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fuel"
        element={
          <ProtectedRoute>
            <FuelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations"
        element={
          <ProtectedRoute>
            <OperationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checklist"
        element={
          <ProtectedRoute>
            <ChecklistPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transport-requests"
        element={
          <ProtectedRoute>
            <TransportRequestsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expense-claims"
        element={
          <ProtectedRoute>
            <ExpenseClaimsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <AuthProvider>
          <EquipmentProvider>
            <AppRoutes />
          </EquipmentProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryProvider>
  );
}

export default App;
