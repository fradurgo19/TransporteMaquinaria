// src/types/index.ts - Actualizado con nuevos tipos

export type UserRole = 'admin' | 'user' | 'guest' | 'commercial' | 'logistics' | 'admin_logistics';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  full_name?: string;
  phone?: string;
  createdAt: string;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type VehicleType = 'tractor' | 'trailer' | 'van' | 'truck';
export type Department = 'transport' | 'logistics';

export interface Equipment {
  id: string;
  driverName: string;
  siteLocation: string;
  brand: string;
  licensePlate: string;
  serialNumber: string;
  vehicleType: VehicleType;
  technicalInspectionExpiration: string;
  soatExpiration: string;
  insurancePolicyExpiration: string;
  driverLicenseExpiration: string;
  permitStatus: string;
  documentAttachments?: string[];
  lastGpsLocation?: GPSLocation;
  department?: Department;
  createdAt: string;
  updatedAt: string;
}

export interface GPSLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface OperationHour {
  id: string;
  vehiclePlate: string;
  driverName: string;
  checkInTime: string;
  checkOutTime?: string;
  breakfastDeduction: boolean;
  lunchDeduction: boolean;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  nightHours: number;
  holidayHours: number;
  taskDescription?: string;
  department?: Department;
  createdAt: string;
}

export interface FuelLog {
  id: string;
  vehiclePlate: string;
  date: string;
  gallons: number;
  cost: number;
  pricePerGallon?: number; // Precio por galón (calculado o extraído del OCR)
  startingOdometer: number;
  endingOdometer: number;
  distanceTraveled?: number; // Kms recorridos (calculado: ending - starting)
  fuelEfficiency?: number; // Km/Galon (calculado: distanceTraveled / gallons)
  receiptPhoto?: string;
  receiptPhotos?: string[]; // Múltiples fotos de tirillas
  department?: Department;
  createdAt: string;
}

export type OperationType = 'loading' | 'route_start' | 'delivery';

export interface Operation {
  id: string;
  vehiclePlate: string;
  operationType: OperationType;
  timestamp: string;
  location?: GPSLocation;
  cargo?: string;
  photos?: string[];
  department?: Department;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  vehiclePlate: string;
  date: string;
  item: string;
  status: 'ok' | 'issue' | 'critical';
  photo?: string;
  notes?: string;
  department?: Department;
  createdAt: string;
}

export interface TransportRequest {
  id: string;
  requestDate: string;
  pickupLocation: string;
  deliveryLocation: string;
  cargo: string;
  weight?: number;
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  requestedBy: string;
  assignedVehicle?: string;
  estimatedDate?: string;
  actualDate?: string;
  notes?: string;
}

export interface DashboardMetrics {
  totalKilometers: number;
  fuelConsumption: number;
  activeVehicles: number;
  recentAlerts: Alert[];
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  equipmentId?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// ==========================================
// NUEVOS TIPOS PARA LOGÍSTICA
// ==========================================

export type DeliveryStatus = 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';

export interface Delivery {
  id: string;
  tracking_number: string;
  customer_name: string;
  delivery_address: string;
  status: DeliveryStatus;
  assigned_vehicle?: string;
  assigned_driver?: string;
  pickup_date?: string;
  delivery_date?: string;
  notes?: string;
  department: Department;
  created_by: string;
  created_at: string;
}

export interface DeliveryTracking {
  id: string;
  delivery_id: string;
  status: DeliveryStatus;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  created_at: string;
}

export interface LogisticsDashboardMetrics {
  totalDeliveries: number;
  pendingDeliveries: number;
  deliveredToday: number;
  activeVehicles: number;
  averageDeliveryTime: number;
}
