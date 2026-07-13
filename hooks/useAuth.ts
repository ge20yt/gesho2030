import { useEffect, useState, useCallback, useContext, createContext } from 'react';
import { AuthProvider } from '../lib/auth/authProvider';
import type { User, UserRole, Permission } from '../lib/database/schema';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

// Create Auth Context
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Auth Provider Hook (for initialization)
export const useAuthProvider = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const authProvider = new AuthProvider();

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await authProvider.login(email, password);
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: message,
      });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await authProvider.logout();
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await authProvider.register(email, password, name);
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: message,
      });
      throw error;
    }
  }, []);

  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!state.user) return false;
    return authProvider.hasPermission(state.user, permission);
  }, [state.user]);

  const hasRole = useCallback((role: UserRole): boolean => {
    if (!state.user) return false;
    return state.user.role === role;
  }, [state.user]);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!state.user) throw new Error('No user logged in');
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const updatedUser = await authProvider.updateUser(state.user.id, data);
      setState({
        user: updatedUser,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw error;
    }
  }, [state.user]);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const user = await authProvider.getCurrentUser();
        setState({
          user: user || null,
          isLoading: false,
          isAuthenticated: !!user,
          error: null,
        });
      } catch (error) {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    };

    initializeAuth();
  }, []);

  return {
    ...state,
    login,
    logout,
    register,
    hasPermission,
    hasRole,
    updateProfile,
  };
};
