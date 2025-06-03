import * as React from "react"
import { Users, Shield, GraduationCap, User, Search, Plus, MoreHorizontal, Upload, Download } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { getUser } from "@/utils/queries/get-user"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

// Mock data for demonstration - replace with actual API calls
const getMockUsers = (type: ManagementType) => {
  const baseUsers = [
    { id: '1', name: 'Dr. Sarah Johnson', username: 'sjohnson', role: 'instructional', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-15', department: 'Computer Science' },
    { id: '2', name: 'Prof. Michael Chen', username: 'mchen', role: 'instructor', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-14', department: 'Computer Science' },
    { id: '3', name: 'Dr. Emily Rodriguez', username: 'erodriguez', role: 'instructor', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-13', department: 'Mathematics' },
    { id: '4', name: 'Alex Thompson', username: 'athompson', role: 'ta', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-15', department: 'Computer Science' },
    { id: '5', name: 'Jordan Lee', username: 'jlee', role: 'ta', email: 'redacted@purdue.edu', status: 'active', lastLogin: '2024-01-14', department: 'Computer Science' },
    { id: '6', name: 'Sam Wilson', username: 'swilson', role: 'ta', email: 'redacted@purdue.edu', status: 'inactive', lastLogin: '2024-01-10', department: 'Mathematics' },
  ];

  switch (type) {
    case 'instructional':
      return baseUsers.filter(user => user.role === 'instructional');
    case 'instructors':
      return baseUsers.filter(user => user.role === 'instructor');
    case 'tas':
      return baseUsers.filter(user => user.role === 'ta');
    default:
      return [];
  }
};

const getTypeInfo = (type: ManagementType) => {
  const typeInfo = {
    instructional: {
      title: 'Instructional Staff',
      description: 'Manage instructional staff members and their permissions',
      icon: Shield,
      addLabel: 'Add Instructional Staff',
      supportsCSV: true
    },
    instructors: {
      title: 'Instructors',
      description: 'Manage course instructors and their class assignments',
      icon: GraduationCap,
      addLabel: 'Add Instructor',
      supportsCSV: true
    },
    tas: {
      title: 'Teaching Assistants',
      description: 'Manage teaching assistants and their assignments',
      icon: User,
      addLabel: 'Add Teaching Assistant',
      supportsCSV: false
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

// CSV Upload Component
function CSVUploadDialog({ type, onUpload }: { type: ManagementType, onUpload: (file: File) => void }) {
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
    }
  };

  const handleUpload = () => {
    if (file) {
      onUpload(file);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadTemplate = () => {
    const headers = ['name', 'username', 'email', 'department'];
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Upload CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload {getTypeInfo(type).title} CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import {getTypeInfo(type).title.toLowerCase()}. 
            Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>
          <div>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
          </div>
          {file && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Selected file:</p>
              <p className="text-sm text-muted-foreground">{file.name}</p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFile(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!file}>
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ManagementSection({ type, className }: ManagementSectionProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'table' | 'all'>('table');
  
  // Fetch current user to check permissions
  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  const typeInfo = getTypeInfo(type);
  const TypeIcon = typeInfo.icon;
  const users = getMockUsers(type);

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddUser = () => {
    // TODO: Implement add user functionality
    console.log(`Add new ${type}`);
  };

  const handleEditUser = (userId: string) => {
    // TODO: Implement edit user functionality
    console.log(`Edit user ${userId}`);
  };

  const handleDeleteUser = (userId: string) => {
    // TODO: Implement delete user functionality
    console.log(`Delete user ${userId}`);
  };

  const handleToggleStatus = (userId: string) => {
    // TODO: Implement toggle status functionality
    console.log(`Toggle status for user ${userId}`);
  };

  const handleCSVUpload = (file: File) => {
    // TODO: Implement CSV upload functionality
    console.log(`Upload CSV for ${type}:`, file.name);
  };

  const handleViewAll = () => {
    setViewMode('all');
    // TODO: Implement view all functionality
    console.log(`View all ${type}`);
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TypeIcon className="h-6 w-6" />
              <div>
                <CardTitle>{typeInfo.title}</CardTitle>
                <CardDescription>{typeInfo.description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {typeInfo.supportsCSV && (
                <CSVUploadDialog type={type} onUpload={handleCSVUpload} />
              )}
              <Button variant="outline" onClick={handleViewAll}>
                View All
              </Button>
              <Button onClick={handleAddUser}>
                <Plus className="h-4 w-4 mr-2" />
                {typeInfo.addLabel}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
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
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                            <DropdownMenuItem onClick={() => handleEditUser(user.id)}>
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(user.id)}>
                              {user.status === 'active' ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-destructive"
                            >
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
          <div className="mt-6 grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{filteredUsers.length}</p>
              <p className="text-sm text-muted-foreground">Total {typeInfo.title}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {filteredUsers.filter(u => u.status === 'active').length}
              </p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-500">
                {filteredUsers.filter(u => u.status === 'inactive').length}
              </p>
              <p className="text-sm text-muted-foreground">Inactive</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {new Set(filteredUsers.map(u => u.department)).size}
              </p>
              <p className="text-sm text-muted-foreground">Departments</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 