/**
 * Staff.tsx
 * Used to display the staff page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import React from "react";
import { Shield, GraduationCap, User as UserIcon, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAllUsers } from "@/utils/queries/users/get-all-users";
import { User } from "@/types";

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
    case 'admin':
      return 'destructive';
    case 'instructional':
      return 'default';
    case 'instructor':
      return 'secondary';
    case 'ta':
      return 'outline';
    default:
      return 'outline';
  }
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'instructional':
      return Shield;
    case 'instructor':
      return GraduationCap;
    case 'ta':
      return UserIcon;
    default:
      return UserIcon;
  }
};

const getRoleDisplayName = (role: string) => {
  switch (role) {
    case 'instructional':
      return 'Instructional Staff';
    case 'instructor':
      return 'Instructor';
    case 'ta':
      return 'Teaching Assistant';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

export default function Staff() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<string>('name');

  const router = useRouter();

  // Fetch all users
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getAllUsers(),
  });

  // Filter staff users (exclude admin and regular users)
  const staffUsers = React.useMemo(() => {
    return allUsers.filter((user: User) =>
      ['instructional', 'instructor', 'ta'].includes(user.role)
    );
  }, [allUsers]);

  // Apply filters and search
  const filteredUsers = React.useMemo(() => {
    let filtered = staffUsers;

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter((user: User) => user.role === roleFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((user: User) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a: User, b: User) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'role':
          return a.role.localeCompare(b.role);
        case 'username':
          return a.username.localeCompare(b.username);
        case 'classes':
          return (b.classIds?.length || 0) - (a.classIds?.length || 0);
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
      instructional: staffUsers.filter((u: User) => u.role === 'instructional').length,
      instructor: staffUsers.filter((u: User) => u.role === 'instructor').length,
      ta: staffUsers.filter((u: User) => u.role === 'ta').length,
    };
  }, [staffUsers]);

  const handleEditUser = (userId: string) => {
    router.push(`/management/staff/u/${userId}`);
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <GraduationCap className="h-4 w-4 text-green-600" />
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
            placeholder="Search staff by name, username, or role..."
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
            <SelectItem value="username">Username</SelectItem>
            <SelectItem value="classes">Classes</SelectItem>
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
              <TableHead>Username</TableHead>
              <TableHead>Classes</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {searchTerm || roleFilter !== 'all'
                    ? "No staff members match your filters"
                    : "No staff members found"
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user: User) => {
                const RoleIcon = getRoleIcon(user.role);
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <RoleIcon className="h-4 w-4" />
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.username}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.classIds?.length || 0} classes
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user.id)}
                      >
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
