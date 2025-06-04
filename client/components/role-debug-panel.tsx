/**
 * Role Debug Panel - Temporary component for testing role switching
 * Add this to any page to see real-time role state changes
 */
"use client";
import React from 'react';
import { useRole } from './role-context';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

export function RoleDebugPanel() {
  const { effectiveRole, simulatedRole, isGuestMode, debug, setRole } = useRole();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-background/95 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Role Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span>Effective Role:</span>
          <Badge variant="default">{effectiveRole}</Badge>
        </div>
        <div className="flex justify-between">
          <span>Simulated Role:</span>
          <Badge variant="outline">{simulatedRole || 'None'}</Badge>
        </div>
        <div className="flex justify-between">
          <span>Guest Mode:</span>
          <Badge variant={isGuestMode ? "destructive" : "secondary"}>
            {isGuestMode ? 'Yes' : 'No'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>User Role:</span>
          <Badge variant="outline">{debug.userRole || 'None'}</Badge>
        </div>
        <div className="flex justify-between">
          <span>Client:</span>
          <Badge variant={debug.isClient ? "default" : "destructive"}>
            {debug.isClient ? 'Yes' : 'No'}
          </Badge>
        </div>
        
        <div className="pt-2 border-t">
          <div className="text-xs font-medium mb-1">LocalStorage:</div>
          <div className="text-xs text-muted-foreground">
            <div>simulatedRole: {debug.localStorage.simulatedRole || 'null'}</div>
            <div>guestMode: {debug.localStorage.guestMode || 'null'}</div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="text-xs font-medium mb-1">Quick Actions:</div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setRole(null)}
              className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
            >
              Reset
            </button>
            <button
              onClick={() => setRole('guest')}
              className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded"
            >
              Guest
            </button>
            <button
              onClick={() => setRole('admin')}
              className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded"
            >
              Admin
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 