import * as React from "react"
import { Users, Shield, GraduationCap, User, Search, MoreHorizontal } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { getUser } from "@/utils/queries/get-user"
import { getUsers } from "@/utils/queries/get-users"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

type UserRole = 'admin' | 'instructional' | 'instructor' | 'ta'
type ManagementType = 'instructional' | 'instructors' | 'tas'

interface ManagementSectionProps {
  type: ManagementType
  className?: string
}

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

const getTypeInfo = (type: ManagementType) => {
  const typeInfo = {
    instructional: {
      title: 'Instructional Staff',
      description: 'Manage instructional staff members and their permissions',
      icon: Shield,
      role: 'instructional' as UserRole
    },
    instructors: {
      title: 'Instructors',
      description: 'Manage course instructors and their class assignments',
      icon: GraduationCap,
      role: 'instructor' as UserRole
    },
    tas: {
      title: 'Teaching Assistants',
      description: 'Manage teaching assistants and their assignments',
      icon: User,
      role: 'ta' as UserRole
    }
  };

  return typeInfo[type];
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

export function ManagementSection({ type, className }: ManagementSectionProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const router = useRouter();

  // Fetch current user to check permissions
  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  // Fetch all users
  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const typeInfo = getTypeInfo(type);
  const TypeIcon = typeInfo.icon;

  // Filter users by role and search term
  const filteredUsers = allUsers
    .filter(user => user.role === typeInfo.role)
    .filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const handleEditUser = (userId: string) => {
    router.push(`/management/${type}/u/${userId}`);
  };

  // Check if current user can edit users
  const canEdit = currentUser?.role === 'admin' ||
    (currentUser?.role === 'instructional' && typeInfo.role !== 'admin' && typeInfo.role !== 'instructional');

  if (isLoading) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${typeInfo.title.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Classes</TableHead>
              {canEdit && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 5 : 4} className="text-center py-8 text-muted-foreground">
                  No {typeInfo.title.toLowerCase()} found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
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
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.username}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.classIds?.length || 0} classes
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEditUser(user.id)}>
                            Edit User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 