import * as React from "react"
import { Shield, GraduationCap, User, Search, MoreHorizontal, SortAsc, SortDesc, Eye, EyeOff } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

type ManagementType = 'instructional' | 'instructors' | 'tas'
type SortField = 'name' | 'email' | 'department' | 'status' | 'lastLogin'
type SortDirection = 'asc' | 'desc'

interface UserManagementViewProps {
  type: ManagementType
  className?: string
  onBack: () => void
}

interface UserData {
  id: string
  name: string
  username: string
  role: ManagementType
  email: string
  status: 'active' | 'inactive'
  lastLogin: string
  department: string
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

// Extended mock data for demonstration
const getAllMockUsers = (type: ManagementType): UserData[] => {
  const baseUsers: UserData[] = [
    { id: '1', name: 'Dr. Sarah Johnson', username: 'sjohnson', role: 'instructional', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-15', department: 'Computer Science' },
    { id: '2', name: 'Prof. Michael Chen', username: 'mchen', role: 'instructors', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-14', department: 'Computer Science' },
    { id: '3', name: 'Dr. Emily Rodriguez', username: 'erodriguez', role: 'instructors', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-13', department: 'Mathematics' },
    { id: '4', name: 'Prof. David Kim', username: 'dkim', role: 'instructors', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-12', department: 'Physics' },
    { id: '5', name: 'Dr. Lisa Wang', username: 'lwang', role: 'instructional', email: 'redacted@purdue.edu', status: 'inactive', lastLogin: '2024-01-10', department: 'Mathematics' },
    { id: '6', name: 'Alex Thompson', username: 'athompson', role: 'tas', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-15', department: 'Computer Science' },
    { id: '7', name: 'Jordan Lee', username: 'jlee', role: 'tas', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-14', department: 'Computer Science' },
    { id: '8', name: 'Sam Wilson', username: 'swilson', role: 'tas', email: 'redacted@purdue.edu', status: 'inactive', lastLogin: '2024-01-10', department: 'Mathematics' },
    { id: '9', name: 'Taylor Brown', username: 'tbrown', role: 'tas', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-13', department: 'Physics' },
  ];

  switch (type) {
    case 'instructional':
      return baseUsers.filter(user => user.role === 'instructional');
    case 'instructors':
      return baseUsers.filter(user => user.role === 'instructors');
    case 'tas':
      return baseUsers.filter(user => user.role === 'tas');
    default:
      return [];
  }
};

const getTypeInfo = (type: ManagementType) => {
  const typeInfo = {
    instructional: {
      title: 'Instructional Staff',
      description: 'Complete list of all instructional staff members',
      icon: Shield,
    },
    instructors: {
      title: 'Instructors',
      description: 'Complete list of all course instructors',
      icon: GraduationCap,
    },
    tas: {
      title: 'Teaching Assistants',
      description: 'Complete list of all teaching assistants',
      icon: User,
    }
  };

  return typeInfo[type];
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
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

export function UserManagementView({ type, className, onBack }: UserManagementViewProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedUsers, setSelectedUsers] = React.useState<string[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [sortField, setSortField] = React.useState<SortField>('name');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');
  const [showInactive, setShowInactive] = React.useState(true);
  
  const typeInfo = getTypeInfo(type);
  const TypeIcon = typeInfo.icon;
  const allUsers = getAllMockUsers(type);

  // Get unique departments for filter
  const departments = React.useMemo(() => {
    return Array.from(new Set(allUsers.map(user => user.department))).sort();
  }, [allUsers]);

  // Filter and sort users
  const filteredAndSortedUsers = React.useMemo(() => {
    const filtered = allUsers.filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.department.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter;
      const matchesVisibility = showInactive || user.status === 'active';

      return matchesSearch && matchesStatus && matchesDepartment && matchesVisibility;
    });

    // Sort users
    filtered.sort((a, b) => {
      let aValue: string | number = a[sortField];
      let bValue: string | number = b[sortField];

      if (sortField === 'lastLogin') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      } else {
        aValue = (aValue as string).toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [allUsers, searchTerm, statusFilter, departmentFilter, showInactive, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(filteredAndSortedUsers.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleBulkAction = (action: 'activate' | 'deactivate' | 'delete') => {
    console.log(`Bulk ${action} for users:`, selectedUsers);
    setSelectedUsers([]);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />;
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onBack}>
                ← Back
              </Button>
              <TypeIcon className="h-6 w-6" />
              <div>
                <CardTitle>{typeInfo.title} - All Users</CardTitle>
                <CardDescription>{typeInfo.description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowInactive(!showInactive)}
              >
                {showInactive ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showInactive ? 'Hide Inactive' : 'Show Inactive'}
              </Button>
              {selectedUsers.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Bulk Actions ({selectedUsers.length})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkAction('activate')}>
                      Activate Selected
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('deactivate')}>
                      Deactivate Selected
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleBulkAction('delete')}
                      className="text-destructive"
                    >
                      Delete Selected
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${typeInfo.title.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.length === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      User
                      <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('department')}
                  >
                    <div className="flex items-center gap-2">
                      Department
                      <SortIcon field="department" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      <SortIcon field="status" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort('lastLogin')}
                  >
                    <div className="flex items-center gap-2">
                      Last Login
                      <SortIcon field="lastLogin" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No {typeInfo.title.toLowerCase()} found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked) => handleSelectUser(user.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.department}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(user.lastLogin).toLocaleDateString()}
                      </TableCell>
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
                            <DropdownMenuItem>
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              {user.status === 'active' ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{filteredAndSortedUsers.length}</p>
              <p className="text-sm text-muted-foreground">Showing</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{allUsers.length}</p>
              <p className="text-sm text-muted-foreground">Total {typeInfo.title}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {allUsers.filter(u => u.status === 'active').length}
              </p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-500">
                {allUsers.filter(u => u.status === 'inactive').length}
              </p>
              <p className="text-sm text-muted-foreground">Inactive</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {departments.length}
              </p>
              <p className="text-sm text-muted-foreground">Departments</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 