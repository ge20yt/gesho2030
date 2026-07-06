/**
 * Platform Kernel
 * Core system configuration and initialization for the TukTouky platform
 */

export enum PlatformEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export enum UserRole {
  // Admin Roles
  SUPER_ADMIN = 'super_admin',
  PLATFORM_ADMIN = 'platform_admin',
  OPERATIONS_ADMIN = 'operations_admin',
  FINANCE_ADMIN = 'finance_admin',
  
  // Driver Roles
  DRIVER = 'driver',
  DRIVER_PREMIUM = 'driver_premium',
  FLEET_MANAGER = 'fleet_manager',
  
  // Customer Roles
  CUSTOMER = 'customer',
  CORPORATE_CUSTOMER = 'corporate_customer',
  
  // Support & Operations
  SUPPORT_AGENT = 'support_agent',
  OPERATIONS_OFFICER = 'operations_officer',
  FINANCE_OFFICER = 'finance_officer',
  
  // Workshop & Marketplace
  WORKSHOP_OWNER = 'workshop_owner',
  SELLER = 'seller',
}

export enum FeatureFlag {
  WALLET_SYSTEM = 'wallet_system',
  COMMISSION_SYSTEM = 'commission_system',
  PREMIUM_DRIVER = 'premium_driver',
  MARKETPLACE = 'marketplace',
  FAMILY_TRACKING = 'family_tracking',
  AI_DISPATCH = 'ai_dispatch',
  ADVANCED_ANALYTICS = 'advanced_analytics',
  MULTI_COUNTRY = 'multi_country',
  PAYMENT_GATEWAY = 'payment_gateway',
  SUBSCRIPTION_PLANS = 'subscription_plans',
}

export interface PlatformConfig {
  environment: PlatformEnvironment;
  apiBaseUrl: string;
  realtimeUrl: string;
  appVersion: string;
  minAppVersion: string;
  supportedCountries: string[];
  supportedLanguages: string[];
  enabledFeatures: FeatureFlag[];
  maintenanceMode: boolean;
}

export interface UserPermission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute';
  conditions?: Record<string, any>;
}

export interface RolePermission {
  role: UserRole;
  permissions: UserPermission[];
}

/**
 * Platform Kernel Configuration
 */
export const PLATFORM_CONFIG: Record<PlatformEnvironment, PlatformConfig> = {
  [PlatformEnvironment.DEVELOPMENT]: {
    environment: PlatformEnvironment.DEVELOPMENT,
    apiBaseUrl: 'http://localhost:3000',
    realtimeUrl: 'http://localhost:3000',
    appVersion: '1.0.0',
    minAppVersion: '1.0.0',
    supportedCountries: ['EG', 'SA', 'AE', 'KSA'],
    supportedLanguages: ['ar', 'en'],
    enabledFeatures: Object.values(FeatureFlag),
    maintenanceMode: false,
  },
  [PlatformEnvironment.STAGING]: {
    environment: PlatformEnvironment.STAGING,
    apiBaseUrl: 'https://api-staging.tuktuky.app',
    realtimeUrl: 'https://realtime-staging.tuktuky.app',
    appVersion: '1.0.0',
    minAppVersion: '1.0.0',
    supportedCountries: ['EG', 'SA', 'AE', 'KSA'],
    supportedLanguages: ['ar', 'en'],
    enabledFeatures: Object.values(FeatureFlag),
    maintenanceMode: false,
  },
  [PlatformEnvironment.PRODUCTION]: {
    environment: PlatformEnvironment.PRODUCTION,
    apiBaseUrl: 'https://api.tuktuky.app',
    realtimeUrl: 'https://realtime.tuktuky.app',
    appVersion: '1.0.0',
    minAppVersion: '0.9.0',
    supportedCountries: ['EG', 'SA', 'AE', 'KSA'],
    supportedLanguages: ['ar', 'en'],
    enabledFeatures: [
      FeatureFlag.WALLET_SYSTEM,
      FeatureFlag.COMMISSION_SYSTEM,
      FeatureFlag.PREMIUM_DRIVER,
      FeatureFlag.MARKETPLACE,
      FeatureFlag.PAYMENT_GATEWAY,
    ],
    maintenanceMode: false,
  },
};

/**
 * Default Role Permissions
 */
export const ROLE_PERMISSIONS: RolePermission[] = [
  {
    role: UserRole.SUPER_ADMIN,
    permissions: [
      { resource: '*', action: 'create' },
      { resource: '*', action: 'read' },
      { resource: '*', action: 'update' },
      { resource: '*', action: 'delete' },
      { resource: '*', action: 'execute' },
    ],
  },
  {
    role: UserRole.DRIVER,
    permissions: [
      { resource: 'trips', action: 'read' },
      { resource: 'trips', action: 'create' },
      { resource: 'wallet', action: 'read' },
      { resource: 'profile', action: 'read' },
      { resource: 'profile', action: 'update' },
      { resource: 'earnings', action: 'read' },
    ],
  },
  {
    role: UserRole.CUSTOMER,
    permissions: [
      { resource: 'trips', action: 'create' },
      { resource: 'trips', action: 'read' },
      { resource: 'profile', action: 'read' },
      { resource: 'profile', action: 'update' },
      { resource: 'payments', action: 'read' },
    ],
  },
];

export class PlatformKernel {
  private static instance: PlatformKernel;
  private config: PlatformConfig;
  private rolePermissions: Map<UserRole, UserPermission[]>;

  private constructor(environment: PlatformEnvironment = PlatformEnvironment.DEVELOPMENT) {
    this.config = PLATFORM_CONFIG[environment];
    this.rolePermissions = new Map();
    this.initializePermissions();
  }

  static getInstance(environment?: PlatformEnvironment): PlatformKernel {
    if (!PlatformKernel.instance) {
      PlatformKernel.instance = new PlatformKernel(environment);
    }
    return PlatformKernel.instance;
  }

  private initializePermissions(): void {
    ROLE_PERMISSIONS.forEach((rp) => {
      this.rolePermissions.set(rp.role, rp.permissions);
    });
  }

  getConfig(): PlatformConfig {
    return this.config;
  }

  getPermissions(role: UserRole): UserPermission[] {
    return this.rolePermissions.get(role) || [];
  }

  hasPermission(role: UserRole, resource: string, action: 'create' | 'read' | 'update' | 'delete' | 'execute'): boolean {
    const permissions = this.getPermissions(role);
    return permissions.some((p) => (p.resource === '*' || p.resource === resource) && p.action === action);
  }

  isFeatureEnabled(feature: FeatureFlag): boolean {
    return this.config.enabledFeatures.includes(feature);
  }

  isMaintenance(): boolean {
    return this.config.maintenanceMode;
  }
}
