"use client";

import { Loader2, Search, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  SearchProfilesIn,
  SearchProfilesOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
} from "@/app/(main)/layout-server";
import {
  PROFILE_ROLES,
  generateGradientFromHex,
} from "@/components/common/forms/profile-roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/contexts/profile-context";
import { SvgIcon } from "@/components/common/SvgIcon";

export interface EmulateProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchProfiles: (
    input: SearchProfilesIn,
  ) => Promise<SearchProfilesOut>;
  switchEffectiveProfile: (
    input: SwitchEffectiveProfileParams,
  ) => Promise<SwitchEffectiveProfileResult>;
}

export function EmulateProfileModal({
  open,
  onOpenChange,
  searchProfiles,
  switchEffectiveProfile,
}: EmulateProfileModalProps) {
  const { profile, roleResources } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [searchData, setSearchData] =
    useState<SearchProfilesOut | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmulating, setIsEmulating] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const roleResourceMap = useMemo(() => {
    if (!roleResources || roleResources.length === 0) return null;
    const map = new Map<
      string,
      {
        name: string;
        description: string;
        iconSvg?: string | null;
        icon: typeof User;
        color: string;
      }
    >();
    roleResources.forEach((resource) => {
      if (!resource?.role) return;
      map.set(resource.role, {
        name: resource.name ?? resource.role ?? "Role",
        description: resource.description ?? "",
        iconSvg: resource.icon_value ?? null,
        icon: User,
        color: resource.color_hex ?? "#64748b",
      });
    });
    return map;
  }, [roleResources]);

  const getRoleDisplay = useCallback(
    (roleId?: string | null) => {
      if (!roleId) return null;
      const resource = roleResourceMap?.get(roleId);
      if (resource) {
        return resource;
      }
      const fallback = PROFILE_ROLES.find((role) => role.id === roleId);
      if (fallback) {
        return {
          name: fallback.name,
          description: fallback.description ?? "",
          icon: fallback.icon,
          color: fallback.color ?? "#64748b",
        };
      }
      return {
        name: roleId,
        description: "",
        icon: User,
        color: "#64748b",
      };
    },
    [roleResourceMap],
  );

  // Search when user types (debounced)
  const handleSearch = useCallback(
    async (query: string) => {
      if (!profile?.id) return;
      setIsLoading(true);
      try {
        const data = await searchProfiles({
          body: {
            search: query || null,
            page_size: 200,
          },
        });
        // profileId comes from X-Profile-Id header automatically
        setSearchData(data);
      } catch {
        toast.error("Failed to search profiles");
      } finally {
        setIsLoading(false);
      }
    },
    [profile?.id, searchProfiles],
  );

  // Handle search input change with debounce
  const handleSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      // If query becomes empty, search immediately (no debounce)
      if (value === "") {
        handleSearch("");
        return;
      }
      // Otherwise, debounce the search but show loading immediately
      setIsLoading(true);
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(value);
      }, 500);
    },
    [handleSearch],
  );

  // Get search results from API response
  const searchResults = useMemo(() => {
    if (!searchData?.profiles) {
      return [];
    }
    return searchData.profiles;
  }, [searchData?.profiles]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      // Initial search when modal opens
      handleSearch("");
    } else {
      setSearchQuery("");
      setSelectedProfileId(null);
      setSearchData(null);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [open, handleSearch]);

  // Handle profile selection
  const handleSelectProfile = useCallback((profileId: string) => {
    setSelectedProfileId(profileId);
  }, []);

  // Handle emulation
  const handleEmulate = useCallback(async () => {
    if (!selectedProfileId || !profile?.id) {
      toast.error("Please select a profile to emulate");
      return;
    }

    setIsEmulating(true);
    try {
      const result = await switchEffectiveProfile({
        targetProfileId: selectedProfileId,
      });

      if (!result.ok) {
        toast.error(result.reason || "Failed to emulate profile");
        return;
      }

      toast.success("Emulation enabled. Reloading...");
      onOpenChange(false);

      // Reload page — resolve_identity() picks up the active grant
      // and swaps the effective profile_id on the next request
      window.location.reload();
    } catch {
      toast.error("Failed to emulate profile");
    } finally {
      setIsEmulating(false);
    }
  }, [selectedProfileId, profile?.id, switchEffectiveProfile, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emulate Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by name or email"
              value={searchQuery}
              onChange={(e) => handleSearchQueryChange(e.target.value)}
              className="pl-10"
              autoFocus
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search Results */}
          <div className="border rounded-md max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading profiles...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? "No profiles found matching your search"
                  : "Start typing to search for profiles"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Alias</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults
                    .filter((profile) => profile.profile_id !== null)
                    .map((profile) => {
                      const profileId = String(profile.profile_id!);
                      const isSelected = selectedProfileId === profileId;
                    return (
                      <TableRow
                        key={profileId}
                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                          isSelected ? "bg-muted" : ""
                        }`}
                        onClick={() => handleSelectProfile(profileId)}
                      >
                        <TableCell className="w-[50px]">
                          <div
                            className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                              isSelected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                            }`}
                          >
                            {isSelected && (
                              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {profile.name || ""}
                        </TableCell>
                        <TableCell>
                          {profile.emails && profile.emails.length > 0
                            ? profile.emails.join(", ")
                            : profile.primary_email || "No email"}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const roleInfo = getRoleDisplay(profile.role);
                            if (!roleInfo) {
                              return (
                                <Badge variant="outline">{profile.role}</Badge>
                              );
                            }
                            const FallbackIcon = roleInfo.icon;
                            const gradientStyle = generateGradientFromHex(
                              roleInfo.color,
                            );

                            return (
                              <div className="flex items-center gap-2">
                                <div
                                  className="p-1.5 rounded-md shadow-sm flex-shrink-0"
                                  style={{ background: gradientStyle }}
                                >
                                  {"iconSvg" in roleInfo && roleInfo.iconSvg ? (
                                    <SvgIcon svg={roleInfo.iconSvg} className="h-3.5 w-3.5 text-white" />
                                  ) : (
                                    <FallbackIcon className="h-3.5 w-3.5 text-white" />
                                  )}
                                </div>
                                <span className="text-sm">
                                  {roleInfo.name}
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Emulation Warning */}
          {selectedProfileId && (
            <div className="p-4 border border-yellow-500/50 rounded-md bg-yellow-50 dark:bg-yellow-950/20">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                Emulation can be destructive if you take actions on behalf of
                this user. You can exit emulation from the profile menu.
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEmulate}
              disabled={!selectedProfileId || isEmulating}
              className="group"
            >
              {isEmulating ? "Emulating..." : "Emulate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
