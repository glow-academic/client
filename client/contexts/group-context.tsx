"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface GroupContextType {
  groupId: string | null;
  setGroupId: (id: string | null) => void;
}

const GroupContext = createContext<GroupContextType | null>(null);

/**
 * Returns the group context — throws if used outside GroupProviderClient.
 * Use in components that require a group_id.
 */
export function useGroupId(): GroupContextType {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error("useGroupId must be used within a GroupProviderClient");
  }
  return context;
}

/**
 * Returns the group context or null if outside provider.
 * Use in hooks/components that optionally consume group_id (backward compatible).
 */
export function useGroupIdOptional(): GroupContextType | null {
  return useContext(GroupContext);
}

export function GroupProviderClient({
  children,
  initialGroupId,
}: {
  children: React.ReactNode;
  initialGroupId: string | null;
}) {
  const [groupId, setGroupIdState] = useState<string | null>(initialGroupId);

  const setGroupId = useCallback((id: string | null) => {
    setGroupIdState(id);
  }, []);

  const value = useMemo<GroupContextType>(
    () => ({
      groupId,
      setGroupId,
    }),
    [groupId, setGroupId],
  );

  return (
    <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
  );
}
