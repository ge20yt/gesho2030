import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { AuthContext, useAuthProvider } from '../hooks/useAuth';
import { useWallet } from '../hooks/useWallet';
import { useNavigation } from '../hooks/useNavigation';
import { useDashboard } from '../hooks/useDashboard';
import { PlatformKernel } from '../lib/platform/kernel';
import type { User } from '../lib/database/schema';

interface PlatformContextType {
  // Platform state
  isInitialized: boolean;
  isDarkMode: boolean;
  language: string;
  tenant: { id: string; name: string } | null;

  // Methods
  toggleDarkMode: () => void;
  setLanguage: (lang: string) => void;
  setTenant: (tenant: { id: string; name: string }) => void;

  // Services access
  kernel: PlatformKernel | null;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export const usePlatform = () => {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within PlatformProvider');
  }
  return context;
};

interface PlatformProviderProps {
  children: React.ReactNode;
  config?: {
    darkMode?: boolean;
    language?: string;
    tenantId?: string;
  };
}

export const PlatformProvider: React.FC<PlatformProviderProps> = ({
  children,
  config = {},
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(config.darkMode ?? true);
  const [language, setLanguageState] = useState(config.language ?? 'ar');
  const [tenant, setTenantState] = useState<{ id: string; name: string } | null>(
    config.tenantId ? { id: config.tenantId, name: 'Default Tenant' } : null
  );

  // Initialize auth
  const authValue = useAuthProvider();

  // Initialize wallet if user is authenticated
  const walletValue = useWallet(authValue.user?.id ?? null);

  // Initialize navigation
  const navValue = useNavigation(authValue.user?.role ?? null, tenant?.id ?? null);

  // Initialize dashboard
  const dashboardValue = useDashboard(tenant?.id ?? null);

  // Initialize platform kernel
  const [kernel] = useState<PlatformKernel | null>(() => {
    try {
      return new PlatformKernel({
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        debug: process.env.NODE_ENV === 'development',
      });
    } catch (error) {
      console.error('[v0] Failed to initialize PlatformKernel:', error);
      return null;
    }
  });

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
  }, []);

  const setTenant = useCallback((newTenant: { id: string; name: string }) => {
    setTenantState(newTenant);
  }, []);

  // Initialize platform on mount
  useEffect(() => {
    const initPlatform = async () => {
      try {
        if (kernel) {
          // Initialize kernel with config
          await kernel.initialize({
            userId: authValue.user?.id,
            userRole: authValue.user?.role,
            tenantId: tenant?.id,
            language,
            darkMode: isDarkMode,
          });
        }
        setIsInitialized(true);
      } catch (error) {
        console.error('[v0] Failed to initialize platform:', error);
        setIsInitialized(false);
      }
    };

    if (authValue.user) {
      initPlatform();
    }
  }, [authValue.user, tenant, language, isDarkMode, kernel]);

  const value: PlatformContextType = {
    isInitialized,
    isDarkMode,
    language,
    tenant,
    toggleDarkMode,
    setLanguage,
    setTenant,
    kernel,
  };

  return (
    <AuthContext.Provider value={authValue as any}>
      <PlatformContext.Provider value={value}>
        {children}
      </PlatformContext.Provider>
    </AuthContext.Provider>
  );
};
