/**
 * Platform Layout Component
 * Main layout with dynamic navigation and user management
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { platformInitializer } from '@/lib/platform/appInitializer';
import { navigationManager } from '@/lib/navigation/navigationManager';
import { authProvider } from '@/lib/auth/authProvider';
import type { NavigationConfig } from '@/lib/navigation/navigationManager';
import type { AuthSession } from '@/lib/auth/authProvider';

interface PlatformLayoutProps {
  children: React.ReactNode;
}

export const PlatformLayout: React.FC<PlatformLayoutProps> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [navigationConfig, setNavigationConfig] = useState<NavigationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize platform on mount
  useEffect(() => {
    const initPlatform = async () => {
      try {
        setIsLoading(true);

        // Initialize platform if not already done
        if (!platformInitializer.isInitialized()) {
          await platformInitializer.initialize();
        }

        // Get current session
        const currentSession = authProvider.getSession();
        setSession(currentSession);

        // If user is authenticated, initialize their session
        if (currentSession) {
          await platformInitializer.initializeUserSession(currentSession.roles);

          // Subscribe to navigation changes
          const unsubscribe = navigationManager.onChange((config) => {
            setNavigationConfig(config);
          });

          // Load initial navigation config
          setNavigationConfig(navigationManager.getNavigationConfig());

          return unsubscribe;
        }
      } catch (err) {
        console.error('[PlatformLayout] Initialization error:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    const cleanup = initPlatform();

    // Subscribe to auth state changes
    const unsubscribeAuth = authProvider.onAuthStateChanged((newSession) => {
      setSession(newSession);

      if (newSession) {
        platformInitializer.initializeUserSession(newSession.roles).catch(console.error);
      }
    });

    return () => {
      unsubscribeAuth();
      cleanup?.then((unsub) => unsub?.());
    };
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          {/* Loading indicator would go here */}
        </View>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          {/* Error message would go here */}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Dynamic Navigation Sidebar */}
      {navigationConfig && session && (
        <DynamicSidebar
          items={navigationConfig.items}
          customization={navigationConfig.customization}
          userRole={session.roles[0]}
        />
      )}

      {/* Main Content */}
      <View style={styles.mainContent}>{children}</View>
    </View>
  );
};

interface DynamicSidebarProps {
  items: any[];
  customization?: any;
  userRole: string;
}

const DynamicSidebar: React.FC<DynamicSidebarProps> = ({ items, customization, userRole }) => {
  return (
    <ScrollView style={styles.sidebar}>
      {items.map((item) => (
        <NavItem key={item.id} item={item} depth={0} />
      ))}
    </ScrollView>
  );
};

interface NavItemProps {
  item: any;
  depth: number;
}

const NavItem: React.FC<NavItemProps> = ({ item, depth }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!item.enabled) {
    return null;
  }

  return (
    <View style={[styles.navItem, { paddingLeft: depth * 16 }]}>
      {/* Render navigation item based on structure */}
      {item.children && (
        <View>
          <View
            style={styles.navItemContent}
            onTouchEnd={() => setIsExpanded(!isExpanded)}
          >
            {/* Icon would render here */}
            {/* Title */}
          </View>

          {isExpanded && item.children.map((child: any) => (
            <NavItem key={child.id} item={child} depth={depth + 1} />
          ))}
        </View>
      )}

      {!item.children && (
        <View style={styles.navItemContent}>
          {/* Simple navigation item */}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sidebar: {
    width: 250,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    paddingVertical: 16,
  },
  navItem: {
    paddingVertical: 8,
  },
  navItemContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
