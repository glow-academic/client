/**
 * ActivityStatus.tsx
 * Used to show metrics about who is currently active and who is not.
 * @AshokSaravanan222 & @siladiea
 * 07/08/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Clock, RefreshCw, Users } from "lucide-react";
import { useMemo, useState } from "react";

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: string;
  active: boolean;
  lastActive: string;
}

export default function ActivityStatus() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: allProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["allProfiles"],
    queryFn: () => getAllProfiles(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter profiles to only show those with lastActive timestamp
  const profilesWithActivity = useMemo(() => {
    if (!allProfiles) return [];
    return allProfiles
      .filter((profile: Profile) => profile.lastActive)
      .sort((a: Profile, b: Profile) => {
        // Sort by active status first, then by lastActive timestamp
        if (a.active !== b.active) {
          return a.active ? -1 : 1; // Active users first
        }
        return (
          new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
        );
      });
  }, [allProfiles]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["allProfiles"] });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getRoleVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "destructive";
      case "instructor":
        return "default";
      case "instructional":
        return "secondary";
      case "ta":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatLastActive = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  };

  if (loadingProfiles) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Status
              </CardTitle>
              <CardDescription>
                Current user activity and session status
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-lg">Loading activity status...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeCount = profilesWithActivity.filter(
    (profile: Profile) => profile.active
  ).length;
  const inactiveCount = profilesWithActivity.filter(
    (profile: Profile) => !profile.active
  ).length;
  const totalCount = profilesWithActivity.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Status
            </CardTitle>
            <CardDescription>
              Users with recent activity ({totalCount} total)
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">{activeCount} Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span className="text-sm font-medium">
                {inactiveCount} Inactive
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!profilesWithActivity || profilesWithActivity.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <div className="text-lg text-muted-foreground">
                No user activity found
              </div>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg max-h-96 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Alias</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profilesWithActivity.map((profile: Profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.firstName} {profile.lastName}
                    </TableCell>
                    <TableCell>{profile.alias}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleVariant(profile.role)}>
                        {profile.role.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            profile.active ? "bg-green-500" : "bg-gray-400"
                          }`}
                        ></div>
                        <span
                          className={`text-sm font-medium ${
                            profile.active ? "text-green-700" : "text-gray-600"
                          }`}
                        >
                          {profile.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatLastActive(profile.lastActive)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
