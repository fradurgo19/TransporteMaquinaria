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
import { MachinesManagementPage } from './pages/MachinesManagementPage';
import { ManufacturerKPGPage } from './pages/ManufacturerKPGPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { TrackingPage } from './pages/TrackingPage';
import { LogisticsDashboardPage } from './pages/LogisticsDashboardPage';
import { OvertimeTrackingPage } from './pages/OvertimeTrackingPage';
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

  // Admins, invitados y logística NO necesitan seleccionar equipo
  const noEquipmentNeeded = ['admin', 'admin_logistics', 'guest', 'logistics'].includes(user?.role || '');
  if (!noEquipmentNeeded && !isEquipmentSelected) {
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
  
  // Admin de logística va a su dashboard
  if (user?.role === 'admin_logistics') {
    return <Navigate to="/logistics-dashboard" replace />;
  }
  
  // Usuarios de logística van a gestión de entregas
  if (user?.role === 'logistics') {
    return <Navigate to="/deliveries" replace />;
  }
  
  // Invitados van directo a operaciones (pueden crear operaciones, solo ven las suyas)
  if (user?.role === 'guest') {
    return <Navigate to="/operations" replace />;
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
        path="/machines-management"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <MachinesManagementPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manufacturer-kpg"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <ManufacturerKPGPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/logistics-dashboard"
        element={
          <ProtectedRoute>
            <LogisticsDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/overtime-tracking"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <OvertimeTrackingPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/deliveries"
        element={
          <ProtectedRoute>
            <DeliveriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tracking/:deliveryId"
        element={
          <ProtectedRoute>
            <TrackingPage />
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
