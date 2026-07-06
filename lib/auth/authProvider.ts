/**
 * Enhanced Auth Provider with RBAC
 * Role-Based Access Control for TukTouky platform
 */

import type { User, UserRole } from '@/lib/platform/kernel';
import { PlatformKernel, UserRole as KernelRole } from '@/lib/platform/kernel';

export interface AuthSession {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  roles: UserRole[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  userType: 'customer' | 'driver';
}

export class AuthProvider {
  private session: AuthSession | null = null;
  private kernel: PlatformKernel;
  private listeners: Set<(session: AuthSession | null) => void> = new Set();

  constructor() {
    this.kernel = PlatformKernel.getInstance();
  }

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    try {
      // TODO: Implement actual authentication with Supabase
      // This is a placeholder for the real implementation
      const response = await fetch(`${this.kernel.getConfig().apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      this.session = {
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
        expiresAt: new Date(data.expiresAt),
        roles: data.roles,
      };

      this.notifyListeners();
      return this.session;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async signup(data: SignupData): Promise<AuthSession> {
    try {
      const response = await fetch(`${this.kernel.getConfig().apiBaseUrl}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Signup failed');
      }

      const result = await response.json();
      this.session = {
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
        expiresAt: new Date(result.expiresAt),
        roles: result.roles,
      };

      this.notifyListeners();
      return this.session;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.session?.token) {
        await fetch(`${this.kernel.getConfig().apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.session = null;
      this.notifyListeners();
    }
  }

  async refreshSession(): Promise<AuthSession> {
    if (!this.session?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${this.kernel.getConfig().apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.refreshToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.session = {
        ...this.session,
        token: data.token,
        expiresAt: new Date(data.expiresAt),
      };

      this.notifyListeners();
      return this.session;
    } catch (error) {
      this.session = null;
      this.notifyListeners();
      throw error;
    }
  }

  getSession(): AuthSession | null {
    return this.session;
  }

  isAuthenticated(): boolean {
    if (!this.session) return false;
    return new Date() < this.session.expiresAt;
  }

  hasRole(role: KernelRole): boolean {
    if (!this.session) return false;
    return this.session.roles.includes(role);
  }

  hasAnyRole(roles: KernelRole[]): boolean {
    if (!this.session) return false;
    return roles.some((role) => this.session!.roles.includes(role));
  }

  hasAllRoles(roles: KernelRole[]): boolean {
    if (!this.session) return false;
    return roles.every((role) => this.session!.roles.includes(role));
  }

  canAccess(resource: string, action: 'create' | 'read' | 'update' | 'delete' | 'execute'): boolean {
    if (!this.session) return false;

    // Check if any of the user's roles have permission for this resource/action
    for (const role of this.session.roles) {
      if (this.kernel.hasPermission(role as KernelRole, resource, action)) {
        return true;
      }
    }

    return false;
  }

  onAuthStateChanged(callback: (session: AuthSession | null) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.session);
    });
  }

  getCurrentUser() {
    return this.session?.user || null;
  }

  getToken(): string | null {
    return this.session?.token || null;
  }
}

export const authProvider = new AuthProvider();
