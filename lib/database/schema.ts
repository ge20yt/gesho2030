/**
 * Database Schema Types
 * Comprehensive type definitions for the TukTouky platform database
 */

export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: string;
  roles: string[];
  status: 'active' | 'inactive' | 'suspended' | 'banned';
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface Driver extends User {
  licenseNumber: string;
  licenseExpiry: Date;
  vehicleType: 'motorcycle' | 'car' | 'truck' | 'auto';
  vehicleNumber: string;
  vehicleColor: string;
  insuranceExpiry: Date;
  bankAccount?: string;
  bankName?: string;
  nationalId: string;
  backgroundCheckStatus: 'pending' | 'approved' | 'rejected';
  backgroundCheckDate?: Date;
  rating: number;
  totalTrips: number;
  totalEarnings: number;
  joinedAt: Date;
  verification?: {
    documentsVerified: boolean;
    backgroundCheckApproved: boolean;
    bankAccountVerified: boolean;
  };
}

export interface Customer extends User {
  addresses: Address[];
  favoriteDrivers?: string[];
  familyMembers?: FamilyMember[];
  subscription?: SubscriptionPlan;
  emergencyContacts?: EmergencyContact[];
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  lockedBalance: number;
  currency: string;
  lastUpdated: Date;
  transactionHistory: WalletTransaction[];
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: 'credit' | 'debit' | 'lock' | 'unlock' | 'commission' | 'refund';
  amount: number;
  balance: number;
  description: string;
  reference?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface Commission {
  id: string;
  driverId: string;
  tripId: string;
  amount: number;
  rate: number;
  type: 'trip' | 'referral' | 'bonus' | 'penalty';
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  createdAt: Date;
  paidAt?: Date;
}

export interface Trip {
  id: string;
  customerId: string;
  driverId?: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  startLocation: Location;
  endLocation: Location;
  distance: number;
  duration: number;
  fare: number;
  commission?: number;
  rating?: TripRating;
  paymentMethod: 'wallet' | 'card' | 'cash' | 'corporate';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancelReason?: string;
  notes?: string;
}

export interface TripRating {
  customerId: string;
  driverId: string;
  tripId: string;
  customerRating: number;
  customerComment?: string;
  driverRating: number;
  driverComment?: string;
  createdAt: Date;
}

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country: string;
  zipCode?: string;
}

export interface Address extends Location {
  id: string;
  userId: string;
  label: string;
  isDefault: boolean;
  savedAt: Date;
}

export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string;
  profileImage?: string;
  canTrackTrips: boolean;
  addedAt: Date;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string;
  notifyOn: 'accident' | 'emergency' | 'all';
}

export interface Marketplace {
  id: string;
  name: string;
  description?: string;
  type: 'workshop' | 'shop' | 'service';
  owner: string;
  location: Location;
  rating: number;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  openingHours?: Record<string, { open: string; close: string }>;
  services?: Service[];
  createdAt: Date;
}

export interface Service {
  id: string;
  marketplaceId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  duration?: number;
  image?: string;
  availability: boolean;
}

export interface SubscriptionPlan {
  id: string;
  userId: string;
  planType: 'basic' | 'premium' | 'corporate';
  status: 'active' | 'cancelled' | 'expired';
  startDate: Date;
  endDate: Date;
  renewalDate?: Date;
  benefits: string[];
  price: number;
  billingCycle: 'monthly' | 'yearly';
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  createdAt: Date;
}

export interface FeatureFlagConfig {
  id: string;
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetRoles?: string[];
  targetCountries?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NavigationItem {
  id: string;
  key: string;
  label: string;
  icon?: string;
  path?: string;
  order: number;
  children?: NavigationItem[];
  visibleTo: string[]; // roles
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  updatedAt: Date;
  updatedBy: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'trip' | 'payment' | 'promotion' | 'alert' | 'message';
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface SupportTicket {
  id: string;
  userId: string;
  type: 'technical' | 'payment' | 'complaint' | 'feedback';
  subject: string;
  description: string;
  attachments?: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}
