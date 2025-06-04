/**
 * Role Context for managing role simulation across the application
 * This provides a centralized way to manage role switching and ensures
 * all components stay in sync when the effective role changes.
 */
"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type UserRole = 'admin' | 'instructional' | 'instructor' | 'ta' | 'guest';

interface RoleContextType {
  effectiveRole: UserRole;
  simulatedRole: UserRole | null;
  isGuestMode: boolean;
  setRole: (role: UserRole | null) => void;
  enableGuestMode: () => void;
  disableGuestMode: () => void;
  refreshRole: () => void;
  // Debug utilities
  debug: {
    userRole?: UserRole;
    isClient: boolean;
    localStorage: {
      simulatedRole: string | null;
      guestMode: string | null;
    };
  };
}

const RoleContext = createContext<RoleContextType | null>(null);

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within RoleProvider');
  }
  return context;
};

interface RoleProviderProps {
  children: React.ReactNode;
  userRole?: UserRole;
}

export function RoleProvider({ children, userRole }: RoleProviderProps) {
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const queryClient = useQueryClient();

  // Handle client-side mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load initial state from localStorage
  useEffect(() => {
    if (!isClient) return;

    const storedRole = localStorage.getItem('simulatedRole');
    const storedGuestMode = localStorage.getItem('guestMode') === 'true';

    if (storedRole && ['admin', 'instructional', 'instructor', 'ta', 'guest'].includes(storedRole)) {
      setSimulatedRole(storedRole as UserRole);
    }

    setIsGuestMode(storedGuestMode);
  }, [isClient]);

  // Calculate effective role
  const effectiveRole: UserRole = React.useMemo(() => {
    if (!isClient) return 'guest';
    
    if (isGuestMode) return 'guest';
    if (simulatedRole) return simulatedRole;
    return userRole || 'guest';
  }, [isClient, isGuestMode, simulatedRole, userRole]);

  const setRole = (role: UserRole | null) => {
    if (!isClient) return;

    setSimulatedRole(role);
    
    if (role) {
      localStorage.setItem('simulatedRole', role);
      if (role === 'guest') {
        localStorage.setItem('guestMode', 'true');
        setIsGuestMode(true);
      } else {
        localStorage.removeItem('guestMode');
        setIsGuestMode(false);
      }
    } else {
      localStorage.removeItem('simulatedRole');
      localStorage.removeItem('guestMode');
      setIsGuestMode(false);
    }

    // Invalidate all queries to force re-fetch with new role
    queryClient.invalidateQueries();
    
    // Force a small delay to ensure all components re-render
    setTimeout(() => {
      queryClient.invalidateQueries();
    }, 100);
  };

  const enableGuestMode = () => {
    if (!isClient) return;
    
    setIsGuestMode(true);
    setSimulatedRole('guest');
    localStorage.setItem('guestMode', 'true');
    localStorage.setItem('simulatedRole', 'guest');
    
    // Invalidate all queries
    queryClient.invalidateQueries();
  };

  const disableGuestMode = () => {
    if (!isClient) return;
    
    setIsGuestMode(false);
    localStorage.removeItem('guestMode');
    
    // If we were in guest mode, clear the simulated role too
    if (simulatedRole === 'guest') {
      setSimulatedRole(null);
      localStorage.removeItem('simulatedRole');
    }
    
    // Invalidate all queries
    queryClient.invalidateQueries();
  };

  const refreshRole = () => {
    if (!isClient) return;
    
    // Force a refresh by invalidating queries
    queryClient.invalidateQueries();
  };

  // Debug information
  const debug = React.useMemo(() => ({
    userRole,
    isClient,
    localStorage: {
      simulatedRole: isClient ? localStorage.getItem('simulatedRole') : null,
      guestMode: isClient ? localStorage.getItem('guestMode') : null,
    },
  }), [userRole, isClient, simulatedRole, isGuestMode]);

  const value: RoleContextType = {
    effectiveRole,
    simulatedRole,
    isGuestMode,
    setRole,
    enableGuestMode,
    disableGuestMode,
    refreshRole,
    debug,
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

// Debug hook for development
export const useRoleDebug = () => {
  const { debug, effectiveRole, simulatedRole, isGuestMode } = useRole();
  
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Role Debug:', {
        effectiveRole,
        simulatedRole,
        isGuestMode,
        ...debug,
      });
    }
  }, [effectiveRole, simulatedRole, isGuestMode, debug]);
  
  return { effectiveRole, simulatedRole, isGuestMode, debug };
}; 