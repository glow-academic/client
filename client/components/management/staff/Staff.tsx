/**
 * Staff.tsx
 * Used to display the staff page with faceted filters and data table.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Profile } from "@/types";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { useQuery } from "@tanstack/react-query";
import { Activity, Shield, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

// Helper function to get initials from name
const getInitials = (name?: string): string => {
  if (!name) return "??";
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "admin":
      return "destructive";
    case "instructional":
      return "default";
    case "ta":
      return "outline";
    default:
      return "outline";
  }
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case "admin":
      return Shield;
    case "instructional":
      return Shield;
    case "ta":
      return UserIcon;
    default:
      return UserIcon;
  }
};

const getRoleDisplayName = (role: string) => {
  switch (role) {
    case "admin":
      return "Administrator";
    case "instructional":
      return "Instructional Staff";
    case "ta":
      return "Teaching Assistant";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
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

export default function Staff() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [activityFilter, setActivityFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<string>("name");
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const router = useRouter();

  // Fetch all users
  const { data: allProfiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter staff users (include admin, instructional, ta)
  const staffUsers = React.useMemo(() => {
    return allProfiles.filter((profile: Profile) =>
      ["admin", "instructional", "ta"].includes(profile.role)
    );
  }, [allProfiles]);

  // Apply filters and search
  const filteredUsers = React.useMemo(() => {
    let filtered = staffUsers;

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter(
        (profile: Profile) => profile.role === roleFilter
      );
    }

    // Activity filter
    if (activityFilter !== "all") {
      filtered = filtered.filter((profile: Profile) =>
        activityFilter === "active" ? profile.active : !profile.active
      );
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (profile: Profile) =>
          profile.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          profile.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          profile.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
          profile.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a: Profile, b: Profile) => {
      switch (sortBy) {
        case "name":
          return a.firstName.localeCompare(b.firstName);
        case "role":
          return a.role.localeCompare(b.role);
        case "email":
          return a.alias.localeCompare(b.alias);
        case "activity":
          // Sort by active status first, then by lastActive timestamp
          if (a.active !== b.active) {
            return a.active ? -1 : 1; // Active users first
          }
          return (
            new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
          );
        default:
          return 0;
      }
    });

    return filtered;
  }, [staffUsers, roleFilter, activityFilter, searchTerm, sortBy]);

  // Get role and activity counts for summary
  const counts = React.useMemo(() => {
    const activeStaff = staffUsers.filter((profile: Profile) => profile.active);
    const inactiveStaff = staffUsers.filter(
      (profile: Profile) => !profile.active
    );

    return {
      total: staffUsers.length,
      active: activeStaff.length,
      inactive: inactiveStaff.length,
      admin: staffUsers.filter((profile: Profile) => profile.role === "admin")
        .length,
      instructional: staffUsers.filter(
        (profile: Profile) => profile.role === "instructional"
      ).length,
      ta: staffUsers.filter((profile: Profile) => profile.role === "ta").length,
    };
  }, [staffUsers]);

  const handleEditUser = (profileId: string) => {
    router.push(`/management/staff/p/${profileId}`);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Force refetch of profiles data
      await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay for UX
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading staff members...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{counts.total}</p>
                <p className="text-sm text-muted-foreground">Total Staff</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{counts.active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
              <div>
                <p className="text-2xl font-bold">{counts.inactive}</p>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{counts.admin}</p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{counts.instructional}</p>
                <p className="text-sm text-muted-foreground">Instructional</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{counts.ta}</p>
                <p className="text-sm text-muted-foreground">TAs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Administrators</SelectItem>
            <SelectItem value="instructional">Instructional Staff</SelectItem>
            <SelectItem value="ta">Teaching Assistants</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by activity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="role">Role</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="activity">Activity</SelectItem>
          </SelectContent>
        </Select>
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

      {/* Staff Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px]">Last Active</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  {searchTerm ||
                  roleFilter !== "all" ||
                  activityFilter !== "all"
                    ? "No staff members match your filters"
                    : "No staff members found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((profile: Profile) => {
                const RoleIcon = getRoleIcon(profile.role);
                return (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          className="h-8 w-8 outline outline-muted-foreground"
                          style={{ outlineWidth: "1px", outlineStyle: "solid" }}
                        >
                          <AvatarFallback className="text-xs">
                            {getInitials(
                              profile.firstName + " " + profile.lastName
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {profile.firstName + " " + profile.lastName}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <RoleIcon className="h-4 w-4" />
                        <Badge variant={getRoleBadgeVariant(profile.role)}>
                          {getRoleDisplayName(profile.role)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {profile.alias}@{process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
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
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(profile.id)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
