/**
 * Dynamic Navigation Manager
 * Manages dynamic sidebar, menus, and navigation based on roles and features
 */

import type { NavigationItem } from '@/lib/database/schema';

export interface NavigationConfig {
  items: NavigationItem[];
  customization?: {
    theme?: string;
    layout?: 'vertical' | 'horizontal';
    collapseMode?: 'icon' | 'text';
  };
}

export class NavigationManager {
  private static instance: NavigationManager;
  private navigationConfig: NavigationConfig = { items: [] };
  private userRoles: string[] = [];
  private listeners: Set<(config: NavigationConfig) => void> = new Set();

  private constructor() {}

  static getInstance(): NavigationManager {
    if (!NavigationManager.instance) {
      NavigationManager.instance = new NavigationManager();
    }
    return NavigationManager.instance;
  }

  /**
   * Initialize navigation for a specific user role
   */
  async initializeForUser(roles: string[]): Promise<void> {
    this.userRoles = roles;
    await this.loadNavigationConfig();
  }

  /**
   * Load navigation configuration from database or cache
   */
  private async loadNavigationConfig(): Promise<void> {
    try {
      // TODO: Fetch from Supabase based on user roles and feature flags
      const config = await this.generateNavigationConfig();
      this.navigationConfig = config;
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to load navigation config:', error);
      this.navigationConfig = this.getDefaultNavigation();
    }
  }

  /**
   * Generate navigation based on user roles
   */
  private async generateNavigationConfig(): Promise<NavigationConfig> {
    const baseItems = this.getBaseNavigationItems();
    const filteredItems = baseItems.filter((item) => this.canAccessItem(item));
    const sortedItems = filteredItems.sort((a, b) => a.order - b.order);

    return {
      items: sortedItems,
      customization: {
        theme: 'light',
        layout: 'vertical',
        collapseMode: 'icon',
      },
    };
  }

  /**
   * Check if user can access a navigation item
   */
  private canAccessItem(item: NavigationItem): boolean {
    if (!item.enabled) return false;
    if (item.visibleTo.length === 0) return true;
    return item.visibleTo.some((role) => this.userRoles.includes(role));
  }

  /**
   * Get default navigation structure
   */
  private getDefaultNavigation(): NavigationConfig {
    return {
      items: this.getBaseNavigationItems(),
    };
  }

  /**
   * Define base navigation structure for all user types
   */
  private getBaseNavigationItems(): NavigationItem[] {
    return [
      // Customer Navigation
      {
        id: 'customer-home',
        key: 'home',
        label: 'Home',
        icon: 'home',
        path: '/',
        order: 1,
        visibleTo: ['customer', 'customer_premium'],
        enabled: true,
      },
      {
        id: 'customer-trips',
        key: 'trips',
        label: 'My Trips',
        icon: 'navigation',
        path: '/trips',
        order: 2,
        visibleTo: ['customer', 'customer_premium'],
        enabled: true,
      },
      {
        id: 'customer-wallet',
        key: 'wallet',
        label: 'Wallet',
        icon: 'wallet',
        path: '/wallet',
        order: 3,
        visibleTo: ['customer', 'customer_premium'],
        enabled: true,
      },
      {
        id: 'customer-family',
        key: 'family',
        label: 'Family & Friends',
        icon: 'people',
        path: '/family',
        order: 4,
        visibleTo: ['customer_premium'],
        enabled: true,
      },
      {
        id: 'customer-rewards',
        key: 'rewards',
        label: 'Rewards & Coupons',
        icon: 'gift',
        path: '/rewards',
        order: 5,
        visibleTo: ['customer', 'customer_premium'],
        enabled: true,
      },

      // Driver Navigation
      {
        id: 'driver-dashboard',
        key: 'dashboard',
        label: 'Dashboard',
        icon: 'dashboard',
        path: '/driver/dashboard',
        order: 10,
        visibleTo: ['driver', 'driver_premium'],
        enabled: true,
      },
      {
        id: 'driver-trips',
        key: 'available-trips',
        label: 'Available Trips',
        icon: 'directions',
        path: '/driver/trips',
        order: 11,
        visibleTo: ['driver', 'driver_premium'],
        enabled: true,
      },
      {
        id: 'driver-earnings',
        key: 'earnings',
        label: 'Earnings',
        icon: 'trending-up',
        path: '/driver/earnings',
        order: 12,
        visibleTo: ['driver', 'driver_premium'],
        enabled: true,
      },
      {
        id: 'driver-wallet',
        key: 'driver-wallet',
        label: 'My Wallet',
        icon: 'wallet',
        path: '/driver/wallet',
        order: 13,
        visibleTo: ['driver', 'driver_premium'],
        enabled: true,
      },
      {
        id: 'driver-documents',
        key: 'documents',
        label: 'Documents',
        icon: 'document',
        path: '/driver/documents',
        order: 14,
        visibleTo: ['driver', 'driver_premium'],
        enabled: true,
      },

      // Admin Navigation
      {
        id: 'admin-overview',
        key: 'overview',
        label: 'Platform Overview',
        icon: 'dashboard',
        path: '/admin/overview',
        order: 100,
        visibleTo: ['admin', 'super_admin'],
        enabled: true,
      },
      {
        id: 'admin-users',
        key: 'users',
        label: 'Users Management',
        icon: 'people',
        path: '/admin/users',
        order: 101,
        visibleTo: ['admin', 'super_admin'],
        enabled: true,
        children: [
          {
            id: 'admin-customers',
            key: 'customers',
            label: 'Customers',
            icon: 'person',
            path: '/admin/users/customers',
            order: 1,
            visibleTo: ['admin', 'super_admin'],
            enabled: true,
          },
          {
            id: 'admin-drivers',
            key: 'drivers',
            label: 'Drivers',
            icon: 'local-shipping',
            path: '/admin/users/drivers',
            order: 2,
            visibleTo: ['admin', 'super_admin'],
            enabled: true,
          },
        ],
      },
      {
        id: 'admin-operations',
        key: 'operations',
        label: 'Operations Center',
        icon: 'manage-search',
        path: '/admin/operations',
        order: 102,
        visibleTo: ['operations_admin', 'super_admin'],
        enabled: true,
      },
      {
        id: 'admin-finance',
        key: 'finance',
        label: 'Finance & Payments',
        icon: 'paid',
        path: '/admin/finance',
        order: 103,
        visibleTo: ['finance_admin', 'super_admin'],
        enabled: true,
      },
      {
        id: 'admin-analytics',
        key: 'analytics',
        label: 'Analytics & Reports',
        icon: 'analytics',
        path: '/admin/analytics',
        order: 104,
        visibleTo: ['admin', 'super_admin'],
        enabled: true,
      },
      {
        id: 'admin-settings',
        key: 'settings',
        label: 'System Settings',
        icon: 'settings',
        path: '/admin/settings',
        order: 105,
        visibleTo: ['super_admin'],
        enabled: true,
      },

      // Common Navigation
      {
        id: 'support',
        key: 'support',
        label: 'Help & Support',
        icon: 'help',
        path: '/support',
        order: 1000,
        visibleTo: ['customer', 'driver', 'admin'],
        enabled: true,
      },
      {
        id: 'profile',
        key: 'profile',
        label: 'Profile Settings',
        icon: 'account-circle',
        path: '/profile',
        order: 1001,
        visibleTo: ['customer', 'driver', 'admin'],
        enabled: true,
      },
    ];
  }

  /**
   * Get filtered navigation for current user
   */
  getNavigationConfig(): NavigationConfig {
    return this.navigationConfig;
  }

  /**
   * Get flat list of all accessible items
   */
  getAccessibleItems(): NavigationItem[] {
    const items: NavigationItem[] = [];

    const traverse = (items: NavigationItem[]) => {
      items.forEach((item) => {
        if (this.canAccessItem(item)) {
          items.push(item);
          if (item.children) {
            traverse(item.children);
          }
        }
      });
    };

    traverse(this.navigationConfig.items);
    return items;
  }

  /**
   * Find navigation item by path
   */
  findItemByPath(path: string): NavigationItem | null {
    const items = this.navigationConfig.items;

    const search = (items: NavigationItem[]): NavigationItem | null => {
      for (const item of items) {
        if (item.path === path) {
          return item;
        }
        if (item.children) {
          const found = search(item.children);
          if (found) return found;
        }
      }
      return null;
    };

    return search(items);
  }

  /**
   * Update navigation customization
   */
  updateCustomization(customization: NavigationConfig['customization']): void {
    this.navigationConfig.customization = {
      ...this.navigationConfig.customization,
      ...customization,
    };
    this.notifyListeners();
  }

  /**
   * Subscribe to navigation changes
   */
  onChange(callback: (config: NavigationConfig) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.navigationConfig);
    });
  }
}

export const navigationManager = NavigationManager.getInstance();
