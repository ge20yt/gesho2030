import { useCallback, useEffect, useState } from 'react';
import { NavigationManager } from '../lib/navigation/navigationManager';
import type { NavItem, NavGroup } from '../lib/database/schema';

interface NavigationState {
  items: NavItem[];
  groups: NavGroup[];
  isLoading: boolean;
  error: string | null;
  currentPath: string | null;
}

export const useNavigation = (userRole: string | null, tenantId: string | null) => {
  const [state, setState] = useState<NavigationState>({
    items: [],
    groups: [],
    isLoading: true,
    error: null,
    currentPath: null,
  });

  const navManager = new NavigationManager();

  const fetchNavigation = useCallback(async () => {
    if (!userRole || !tenantId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const items = await navManager.getNavigationItems(userRole, tenantId);
      const groups = await navManager.getNavigationGroups(userRole, tenantId);

      setState(prev => ({
        ...prev,
        items,
        groups,
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch navigation';
      setState(prev => ({ ...prev, error: message, isLoading: false }));
    }
  }, [userRole, tenantId]);

  const getMenuItems = useCallback(() => {
    return state.items.filter(item => item.type === 'menu');
  }, [state.items]);

  const getSubmenu = useCallback((parentId: string) => {
    return state.items.filter(item => item.parentId === parentId);
  }, [state.items]);

  const hasAccess = useCallback((itemId: string): boolean => {
    const item = state.items.find(i => i.id === itemId);
    return item?.isVisible ?? false;
  }, [state.items]);

  const setCurrentPath = useCallback((path: string) => {
    setState(prev => ({ ...prev, currentPath: path }));
  }, []);

  const isActive = useCallback((path: string): boolean => {
    return state.currentPath === path || state.currentPath?.startsWith(path + '/') || false;
  }, [state.currentPath]);

  const refreshNavigation = useCallback(async () => {
    await fetchNavigation();
  }, [fetchNavigation]);

  // Fetch navigation on mount or role/tenant change
  useEffect(() => {
    fetchNavigation();
  }, [userRole, tenantId, fetchNavigation]);

  return {
    ...state,
    getMenuItems,
    getSubmenu,
    hasAccess,
    setCurrentPath,
    isActive,
    refreshNavigation,
  };
};

// Hook for breadcrumb trail
export const useBreadcrumb = (currentPath: string) => {
  const navManager = new NavigationManager();
  const [breadcrumbs, setBreadcrumbs] = useState<NavItem[]>([]);

  useEffect(() => {
    const generateBreadcrumbs = async () => {
      try {
        const crumbs = await navManager.getBreadcrumbTrail(currentPath);
        setBreadcrumbs(crumbs);
      } catch (error) {
        console.error('[v0] Failed to generate breadcrumbs:', error);
      }
    };

    if (currentPath) {
      generateBreadcrumbs();
    }
  }, [currentPath]);

  return breadcrumbs;
};
