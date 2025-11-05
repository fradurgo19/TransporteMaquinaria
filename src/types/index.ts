export type UserRole = 'admin' | 'user' | 'commercial';

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
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type VehicleType = 'tractor' | 'trailer';

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
  createdAt: string;
  updatedAt: string;
}

export interface GPSLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export type ActivityType = 'regular' | 'overtime' | 'night' | 'holiday';

export interface OperationHours {
  id: string;
  vehiclePlate: string;
  driverName: string;
  checkInTime: string;
  checkOutTime?: string;
  taskDescription: string;
  location: GPSLocation;
  activityType: ActivityType;
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  nightHours?: number;
  holidayHours?: number;
  breakfastDeduction?: number;
  lunchDeduction?: number;
  createdAt: string;
}

export interface FuelLog {
  id: string;
  vehiclePlate: string;
  date: string;
  gallons: number;
  cost: number;
  startingOdometer: number;
  endingOdometer: number;
  receiptPhoto: string;
  gpsLocation: GPSLocation;
  createdAt: string;
}

export type OperationType = 'loading' | 'route_start' | 'delivery';

export interface Operation {
  id: string;
  vehiclePlate: string;
  driverName: string;
  timestamp: string;
  operationType: OperationType;
  gpsLocation: GPSLocation;
  photoDocumentation?: string[];
  notes?: string;
  createdAt: string;
}

export interface PreOperationalChecklist {
  id: string;
  vehiclePlate: string;
  driverName: string;
  checkDate: string;
  vehicleConditionAssessment: string;
  conditionPhoto: string;
  issues?: string[];
  passed: boolean;
  createdAt: string;
}

export interface TransportRequest {
  id: string;
  serialNumber: string;
  brand: string;
  model: string;
  weight: number;
  length: number;
  capacity: number;
  origin: string;
  destination: string;
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  requestedBy: string;
  requestedAt: string;
  assignedVehicle?: string;
  assignedDriver?: string;
  notes?: string;
}

export interface DashboardMetrics {
  totalKilometers: number;
  fuelConsumption: number;
  activeVehicles: number;
  expiringDocuments: ExpiringDocument[];
  recentAlerts: Alert[];
}

export interface ExpiringDocument {
  equipmentId: string;
  licensePlate: string;
  documentType: string;
  expirationDate: string;
  daysUntilExpiration: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
  equipmentId?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
