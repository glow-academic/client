/**
 * NewStaff.tsx
 * Used to display the new staff page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Download, X, Shield, GraduationCap, User, ArrowLeft } from "lucide-react";

import { getUser } from "@/utils/queries/users/get-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/hooks/use-auth";

type UserRole = 'instructional' | 'instructor' | 'ta';

interface CSVUser {
  name: string;
  username: string;
  password: string;
  role: UserRole;
  classIds: string[];
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'instructional':
      return Shield;
    case 'instructor':
      return GraduationCap;
    case 'ta':
      return User;
    default:
      return User;
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

export default function NewStaff() {
  const router = useRouter();
  const {userId} = useAuth();
  const [formData, setFormData] = React.useState({
    name: "",
    username: "",
    password: "",
    role: "" as UserRole | "",
    classIds: [] as string[]
  });
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [csvPreview, setCsvPreview] = React.useState<CSVUser[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Fetch current user to check permissions
  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(userId!),
    enabled: !!userId,
  });

  // Check permissions based on current user role
  const getPermissions = () => {
    if (!currentUser) return { canCreateInstructional: false, canCreateInstructor: false, canCreateTA: false };

    const isAdmin = currentUser.role === 'admin';
    const isInstructional = currentUser.role === 'instructional';

    return {
      canCreateInstructional: isAdmin, // Only admin can create instructional staff
      canCreateInstructor: isAdmin || isInstructional, // Admin and instructional can create instructors
      canCreateTA: isAdmin || isInstructional, // Admin and instructional can create TAs
    };
  };

  const { canCreateInstructional, canCreateInstructor, canCreateTA } = getPermissions();

  // Get available roles based on permissions
  const availableRoles = React.useMemo(() => {
    const roles: { value: UserRole; label: string; icon: React.ComponentType<{ className?: string }> }[] = [];
    
    if (canCreateInstructional) {
      roles.push({ value: 'instructional', label: 'Instructional Staff', icon: Shield });
    }
    if (canCreateInstructor) {
      roles.push({ value: 'instructor', label: 'Instructor', icon: GraduationCap });
    }
    if (canCreateTA) {
      roles.push({ value: 'ta', label: 'Teaching Assistant', icon: User });
    }
    
    return roles;
  }, [canCreateInstructional, canCreateInstructor, canCreateTA]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.role || availableRoles.length === 0) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to create staff member
      console.log("Creating staff member:", formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      router.push('/management/staff');
    } catch (error) {
      console.error("Error creating staff member:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      parseCSV(file);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      const users: CSVUser[] = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const role = values[3] as UserRole;
        
                 // Only include users with roles the current user can create
         const canCreateRole = Boolean(
           (role === 'instructional' && canCreateInstructional) ||
           (role === 'instructor' && canCreateInstructor) ||
           (role === 'ta' && canCreateTA)
         );
           
         if (!canCreateRole) return null;
        
        return {
          name: values[0] || '',
          username: values[1] || '',
          password: values[2] || '',
          role: role,
          classIds: values[4] ? values[4].split(';').map(id => id.trim()) : []
        };
      }).filter((user): user is CSVUser => user !== null && Boolean(user.name) && Boolean(user.username));

      setCsvPreview(users);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = ['name', 'username', 'password', 'role', 'classIds'];
    const examples = [];
    
    if (canCreateInstructional) {
      examples.push(['Dr. Sarah Johnson', 'sjohnson', 'password123', 'instructional', 'class1;class2']);
    }
    if (canCreateInstructor) {
      examples.push(['Dr. Jane Smith', 'jsmith', 'password123', 'instructor', 'class1;class2']);
    }
    if (canCreateTA) {
      examples.push(['John Doe', 'jdoe', 'password123', 'ta', 'class1;class2']);
    }
    
    const csvContent = headers.join(',') + '\n' + examples.map(ex => ex.join(',')).join('\n') + '\n';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCSVSubmit = async () => {
    if (csvPreview.length === 0) return;

    setIsSubmitting(true);
    try {
      // TODO: Implement API call to bulk create staff members
      console.log("Creating staff members from CSV:", csvPreview);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      router.push('/management/staff');
    } catch (error) {
      console.error("Error creating staff members from CSV:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (availableRoles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to create staff members.
          </p>
        </div>
        <Button onClick={() => router.push('/management/staff')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Staff Management
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Staff Member</h1>
          <p className="text-muted-foreground">
            Add a new staff member to the system.
          </p>
        </div>
        <Button onClick={() => router.push('/management/staff')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Tabs defaultValue="single" className="space-y-4">
        <TabsList>
          <TabsTrigger value="single">Single User</TabsTrigger>
          <TabsTrigger value="csv">CSV Import</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Create Staff Member</CardTitle>
              <CardDescription>
                Enter the details for the new staff member.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value: UserRole) => handleInputChange('role', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => {
                        const RoleIcon = role.icon;
                        return (
                          <SelectItem key={role.value} value={role.value}>
                            <div className="flex items-center gap-2">
                              <RoleIcon className="h-4 w-4" />
                              {role.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder={
                        formData.role === 'instructional' ? "Dr. Sarah Johnson" :
                        formData.role === 'instructor' ? "Dr. Jane Smith" : 
                        formData.role === 'ta' ? "John Doe" : "Enter full name"
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      placeholder={
                        formData.role === 'instructional' ? "sjohnson" :
                        formData.role === 'instructor' ? "jsmith" : 
                        formData.role === 'ta' ? "jdoe" : "Enter username"
                      }
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                </div>

                                 {formData.role && (
                   <div className="p-4 bg-muted rounded-md">
                     <div className="flex items-center gap-2 mb-2">
                       {(() => {
                         const RoleIcon = getRoleIcon(formData.role);
                         return <RoleIcon className="h-4 w-4" />;
                       })()}
                       <Badge variant={getRoleBadgeVariant(formData.role)}>
                         {getRoleDisplayName(formData.role)}
                       </Badge>
                     </div>
                    <p className="text-sm text-muted-foreground">
                      {formData.role === 'instructional' && "Will have permissions to manage instructors and teaching assistants."}
                      {formData.role === 'instructor' && "Will have permissions to manage assigned classes and teaching assistants."}
                      {formData.role === 'ta' && "Will have permissions to assist with assigned classes."}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/management/staff')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !formData.role}>
                    {isSubmitting ? 'Creating...' : `Create ${formData.role ? getRoleDisplayName(formData.role) : 'Staff Member'}`}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="csv">
          <Card>
            <CardHeader>
              <CardTitle>CSV Import</CardTitle>
              <CardDescription>
                Upload a CSV file to bulk import staff members. The CSV should include: name, username, password, role, classIds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Available Roles:</p>
                <div className="flex gap-2 flex-wrap">
                  {availableRoles.map((role) => {
                    const RoleIcon = role.icon;
                    return (
                      <Badge key={role.value} variant={getRoleBadgeVariant(role.value)}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {role.value}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
              </div>

              {csvFile && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Selected file:</p>
                      <p className="text-sm text-muted-foreground">{csvFile.name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvPreview([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {csvPreview.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Preview ({csvPreview.length} users)</h3>
                    <p className="text-sm text-muted-foreground">
                      Review the staff members that will be created from your CSV file.
                    </p>
                  </div>
                  
                  <div className="rounded-md border max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Password</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Classes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvPreview.map((user, index) => {
                          const RoleIcon = getRoleIcon(user.role);
                          return (
                            <TableRow key={index}>
                              <TableCell>{user.name}</TableCell>
                              <TableCell>{user.username}</TableCell>
                              <TableCell>{'*'.repeat(user.password.length)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <RoleIcon className="h-4 w-4" />
                                  <Badge variant={getRoleBadgeVariant(user.role)}>
                                    {getRoleDisplayName(user.role)}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  {user.classIds.map((classId, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {classId}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvPreview([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCSVSubmit} disabled={isSubmitting}>
                      {isSubmitting ? 'Creating...' : `Create ${csvPreview.length} Staff Members`}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
