/**
 * Service Factory
 * Central registry and factory for all platform services
 */

import type { Database } from '@/lib/database/supabase.types';
import { createClient } from '@supabase/supabase-js';

export interface ServiceConfig {
  supabase: ReturnType<typeof createClient<Database>>;
  apiBaseUrl: string;
  environment: string;
}

export interface IService {
  initialize(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

export interface IAuthService extends IService {
  login(email: string, password: string): Promise<any>;
  logout(): Promise<void>;
  signup(data: any): Promise<any>;
  getCurrentUser(): Promise<any>;
  refreshToken(): Promise<void>;
}

export interface IWalletService extends IService {
  getBalance(userId: string): Promise<number>;
  addFunds(userId: string, amount: number, method: string): Promise<any>;
  withdrawFunds(userId: string, amount: number, method: string): Promise<any>;
  getTransactionHistory(userId: string, limit?: number): Promise<any[]>;
}

export interface ICommissionService extends IService {
  calculateCommission(tripId: string): Promise<number>;
  applyCommission(driverId: string, amount: number, tripId: string): Promise<any>;
  getCommissionHistory(driverId: string): Promise<any[]>;
  updateCommissionRules(rules: any): Promise<void>;
}

export interface ITripService extends IService {
  createTrip(data: any): Promise<any>;
  getTrip(tripId: string): Promise<any>;
  updateTripStatus(tripId: string, status: string): Promise<any>;
  cancelTrip(tripId: string, reason: string): Promise<any>;
  getUserTrips(userId: string): Promise<any[]>;
  rateTrip(tripId: string, rating: any): Promise<any>;
}

export interface IDriverService extends IService {
  getDriver(driverId: string): Promise<any>;
  updateDriverProfile(driverId: string, data: any): Promise<any>;
  getDriverStats(driverId: string): Promise<any>;
  getAvailableDrivers(location: any, radius?: number): Promise<any[]>;
  toggleDriverAvailability(driverId: string, available: boolean): Promise<void>;
}

export interface INotificationService extends IService {
  sendNotification(userId: string, notification: any): Promise<void>;
  getNotifications(userId: string, limit?: number): Promise<any[]>;
  markAsRead(notificationId: string): Promise<void>;
  subscribeToNotifications(userId: string, callback: (data: any) => void): () => void;
}

export interface IAuditService extends IService {
  logAction(data: any): Promise<void>;
  getAuditLogs(filter?: any): Promise<any[]>;
  getActivityReport(userId: string, startDate?: Date, endDate?: Date): Promise<any>;
}

export interface IAnalyticsService extends IService {
  trackEvent(eventName: string, data: any): Promise<void>;
  getMetrics(metric: string, startDate?: Date, endDate?: Date): Promise<any>;
  getUserAnalytics(userId: string): Promise<any>;
  getPlatformAnalytics(): Promise<any>;
}

export class ServiceFactory {
  private static instance: ServiceFactory;
  private config: ServiceConfig;
  private services: Map<string, IService> = new Map();

  private constructor(config: ServiceConfig) {
    this.config = config;
  }

  static getInstance(config: ServiceConfig): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory(config);
    }
    return ServiceFactory.instance;
  }

  registerService(name: string, service: IService): void {
    this.services.set(name, service);
  }

  getService<T extends IService>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not registered`);
    }
    return service as T;
  }

  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.services.values()).map((service) =>
      service.initialize().catch((error) => {
        console.error(`Failed to initialize service:`, error);
      })
    );
    await Promise.all(initPromises);
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    for (const [name, service] of this.services.entries()) {
      try {
        health[name] = await service.isHealthy();
      } catch {
        health[name] = false;
      }
    }
    return health;
  }

  getConfig(): ServiceConfig {
    return this.config;
  }
}

export const createServiceFactory = (config: ServiceConfig): ServiceFactory => {
  return ServiceFactory.getInstance(config);
};
