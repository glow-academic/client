/**
 * Staff.tsx
 * Used to display the staff page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Profile } from "@/types";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Search, Shield, User as UserIcon } from "lucide-react";
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
    case "instructor":
      return "secondary";
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
    case "instructor":
      return UserIcon;
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
    case "instructor":
      return "Instructor";
    case "ta":
      return "Teaching Assistant";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

export default function Staff() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [sortBy, setSortBy] = React.useState<string>("name");

  const router = useRouter();

  // Fetch all users
  const { data: allProfiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  // Filter staff users (include admin, instructional, instructor, ta)
  const staffUsers = React.useMemo(() => {
    return allProfiles.filter((profile: Profile) =>
      ["admin", "instructional", "instructor", "ta"].includes(profile.role)
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
        default:
          return 0;
      }
    });

    return filtered;
  }, [staffUsers, roleFilter, searchTerm, sortBy]);

  // Get role counts for summary
  const roleCounts = React.useMemo(() => {
    return {
      total: staffUsers.length,
      admin: staffUsers.filter((profile: Profile) => profile.role === "admin")
        .length,
      instructional: staffUsers.filter(
        (profile: Profile) => profile.role === "instructional"
      ).length,
      instructor: staffUsers.filter(
        (profile: Profile) => profile.role === "instructor"
      ).length,
      ta: staffUsers.filter((profile: Profile) => profile.role === "ta").length,
    };
  }, [staffUsers]);

  const handleEditUser = (profileId: string) => {
    router.push(`/management/staff/p/${profileId}`);
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{roleCounts.total}</p>
                <p className="text-sm text-muted-foreground">Total Staff</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{roleCounts.admin}</p>
                <p className="text-sm text-muted-foreground">Administrators</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{roleCounts.instructional}</p>
                <p className="text-sm text-muted-foreground">Instructional</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{roleCounts.instructor}</p>
                <p className="text-sm text-muted-foreground">Instructors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{roleCounts.ta}</p>
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
            <SelectItem value="instructor">Instructors</SelectItem>
            <SelectItem value="ta">Teaching Assistants</SelectItem>
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
          </SelectContent>
        </Select>
      </div>

      {/* Staff Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  {searchTerm || roleFilter !== "all"
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
                        <Avatar className="h-8 w-8">
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
