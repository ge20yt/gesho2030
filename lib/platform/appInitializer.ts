/**
 * Platform App Initializer
 * Centralized initialization of all platform systems
 */

import { createClient } from '@supabase/supabase-js';
import { PlatformKernel, PlatformEnvironment } from './kernel';
import { ServiceFactory, type ServiceConfig } from '@/lib/services/serviceFactory';
import { authProvider } from '@/lib/auth/authProvider';
import { navigationManager } from '@/lib/navigation/navigationManager';
import { dashboardManager } from '@/lib/admin/dashboardManager';
import { createWalletService } from '@/lib/wallet/walletService';
import { createCommissionService } from '@/lib/wallet/commissionService';
import { createAuditService } from '@/lib/security/auditService';

export interface PlatformInitConfig {
  environment?: PlatformEnvironment;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  apiBaseUrl?: string;
}

export class PlatformAppInitializer {
  private static instance: PlatformAppInitializer;
  private initialized: boolean = false;
  private config: ServiceConfig | null = null;

  private constructor() {}

  static getInstance(): PlatformAppInitializer {
    if (!PlatformAppInitializer.instance) {
      PlatformAppInitializer.instance = new PlatformAppInitializer();
    }
    return PlatformAppInitializer.instance;
  }

  /**
   * Initialize the entire platform
   */
  async initialize(initConfig: PlatformInitConfig = {}): Promise<void> {
    if (this.initialized) {
      console.warn('Platform already initialized');
      return;
    }

    try {
      console.log('[Platform] Initializing TukTouky Platform...');

      // 1. Initialize Kernel
      const environment = initConfig.environment || PlatformEnvironment.DEVELOPMENT;
      const kernel = PlatformKernel.getInstance(environment);
      console.log('[Platform] Kernel initialized');

      // 2. Initialize Supabase
      const supabaseUrl = initConfig.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = initConfig.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase credentials not provided');
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.log('[Platform] Supabase client initialized');

      // 3. Initialize Service Factory
      this.config = {
        supabase,
        apiBaseUrl: initConfig.apiBaseUrl || kernel.getConfig().apiBaseUrl,
        environment: environment,
      };

      const serviceFactory = ServiceFactory.getInstance(this.config);

      // 4. Register Services
      serviceFactory.registerService('auth', authProvider);
      serviceFactory.registerService('wallet', createWalletService(supabase));
      serviceFactory.registerService('commission', createCommissionService(supabase));
      serviceFactory.registerService('audit', createAuditService(supabase));

      console.log('[Platform] Services registered');

      // 5. Initialize services
      await serviceFactory.initializeAll();
      console.log('[Platform] Services initialized');

      // 6. Perform health check
      const health = await serviceFactory.healthCheck();
      console.log('[Platform] Health check:', health);

      // 7. Initialize Navigation
      // Note: This will be called after user login with their roles
      console.log('[Platform] Navigation manager ready');

      // 8. Initialize Dashboard Manager
      // Note: This will be called for admin users
      console.log('[Platform] Dashboard manager ready');

      // Mark as initialized
      this.initialized = true;
      console.log('[Platform] TukTouky Platform initialized successfully');
    } catch (error) {
      console.error('[Platform] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize user session
   */
  async initializeUserSession(roles: string[]): Promise<void> {
    try {
      // Initialize navigation for user's roles
      await navigationManager.initializeForUser(roles);
      console.log('[Platform] User session initialized with roles:', roles);

      // Load dashboard if user has admin role
      if (roles.some((r) => r.includes('admin'))) {
        await dashboardManager.loadMetrics();
        await dashboardManager.loadAlerts();
        await dashboardManager.loadFeatureFlags();
        console.log('[Platform] Admin dashboard initialized');
      }
    } catch (error) {
      console.error('[Platform] User session initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get service factory
   */
  getServiceFactory(): ServiceFactory {
    if (!this.config) {
      throw new Error('Platform not initialized');
    }
    return ServiceFactory.getInstance(this.config);
  }

  /**
   * Get kernel
   */
  getKernel(): PlatformKernel {
    return PlatformKernel.getInstance();
  }

  /**
   * Get auth provider
   */
  getAuthProvider() {
    return authProvider;
  }

  /**
   * Get navigation manager
   */
  getNavigationManager() {
    return navigationManager;
  }

  /**
   * Get dashboard manager
   */
  getDashboardManager() {
    return dashboardManager;
  }

  /**
   * Check if platform is ready
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Destroy platform instance
   */
  destroy(): void {
    // Cleanup resources
    this.initialized = false;
    this.config = null;
    console.log('[Platform] Platform instance destroyed');
  }
}

export const platformInitializer = PlatformAppInitializer.getInstance();

/**
 * Global function to get platform instance
 */
export const getPlatform = () => platformInitializer;
