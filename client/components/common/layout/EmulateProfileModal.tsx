"use client";

import { Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  SearchSimulatableProfilesIn,
  SearchSimulatableProfilesOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
} from "@/app/(main)/layout-server";
import { STAFF_ROLES } from "@/components/common/forms/StaffRolePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/contexts/profile-context";

export interface EmulateProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchSimulatableProfiles: (
    input: SearchSimulatableProfilesIn
  ) => Promise<SearchSimulatableProfilesOut>;
  switchEffectiveProfile: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
}

export function EmulateProfileModal({
  open,
  onOpenChange,
  searchSimulatableProfiles,
  switchEffectiveProfile,
}: EmulateProfileModalProps) {
  const { activeProfile } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );
  const [searchData, setSearchData] =
    useState<SearchSimulatableProfilesOut | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmulating, setIsEmulating] = useState(false);
  const [fullEmulation, setFullEmulation] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is superadmin
  const isSuperadmin = activeProfile?.role === "superadmin";

  // Search when user types (debounced)
  const handleSearch = useCallback(
    async (query: string) => {
      if (!activeProfile?.id) return;
      setIsLoading(true);
      try {
        const data = await searchSimulatableProfiles({
          body: {
            query: query || null,
            limit: 200,
            profileId: activeProfile.id,
          },
        });
        setSearchData(data);
      } catch {
        toast.error("Failed to search profiles");
      } finally {
        setIsLoading(false);
      }
    },
    [activeProfile?.id, searchSimulatableProfiles]
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
    [handleSearch]
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
      setFullEmulation(false);
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
    if (!selectedProfileId || !activeProfile?.id) {
      toast.error("Please select a profile to emulate");
      return;
    }

    setIsEmulating(true);
    try {
      const result = await switchEffectiveProfile({
        targetProfileId: selectedProfileId,
        fullEmulation: fullEmulation && isSuperadmin,
        emulationTTL: Date.now() + 120 * 60 * 1000, // 2 hours TTL
      });

      if (!result.ok) {
        toast.error(result.reason || "Failed to emulate profile");
        return;
      }

      toast.success(
        fullEmulation && isSuperadmin
          ? "Full emulation enabled. You must log out to exit."
          : "Emulation enabled successfully"
      );

      // Close modal and refresh page
      onOpenChange(false);
      window.location.reload();
    } catch {
      toast.error("Failed to emulate profile");
    } finally {
      setIsEmulating(false);
    }
  }, [
    selectedProfileId,
    activeProfile?.id,
    fullEmulation,
    isSuperadmin,
    switchEffectiveProfile,
    onOpenChange,
  ]);

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
                  {searchResults.map((profile) => {
                    const isSelected = selectedProfileId === profile.id;
                    return (
                      <TableRow
                        key={profile.id}
                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                          isSelected ? "bg-muted" : ""
                        }`}
                        onClick={() => handleSelectProfile(profile.id)}
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
                          {profile.firstName} {profile.lastName}
                        </TableCell>
                        <TableCell>{profile.email}</TableCell>
                        <TableCell>
                          {(() => {
                            const roleData = STAFF_ROLES.find(
                              (r) => r.id === profile.role
                            );
                            if (!roleData) {
                              return (
                                <Badge variant="outline">{profile.role}</Badge>
                              );
                            }
                            const IconComponent = roleData.icon;
                            const hexColor = roleData.color || "#64748b";
                            // Generate gradient from hex color
                            const cleanHex = hexColor.replace("#", "");
                            const r = parseInt(cleanHex.substr(0, 2), 16);
                            const g = parseInt(cleanHex.substr(2, 2), 16);
                            const b = parseInt(cleanHex.substr(4, 2), 16);
                            const lighterR = Math.min(255, r + 60);
                            const lighterG = Math.min(255, g + 60);
                            const lighterB = Math.min(255, b + 60);
                            const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                            const gradientStyle = `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;

                            return (
                              <div className="flex items-center gap-2">
                                <div
                                  className="p-1.5 rounded-md shadow-sm flex-shrink-0"
                                  style={{
                                    background: gradientStyle,
                                  }}
                                >
                                  <IconComponent className="h-3.5 w-3.5 text-white" />
                                </div>
                                <span className="text-sm">{roleData.name}</span>
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

          {/* Full Emulation Switch (Superadmin only) */}
          {isSuperadmin && (
            <div className="flex items-center justify-between p-4 border rounded-md bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="full-emulation" className="text-sm font-medium">
                  Full Emulation
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, you must log out to exit emulation. This mode
                  prevents accidental exits.
                </p>
              </div>
              <Switch
                id="full-emulation"
                checked={fullEmulation}
                onCheckedChange={setFullEmulation}
              />
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
              className="group text-white hover:text-white focus:text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {isEmulating ? "Emulating..." : "Emulate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
