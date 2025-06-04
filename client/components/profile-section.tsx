import * as React from "react"
import { User, Shield, Mail, Building, GraduationCap } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { getUser } from "@/utils/queries/get-user"
import { getClasses } from "@/utils/queries/get-classes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { classes as Classes } from "@/drizzle/schema"

type Class = typeof Classes.$inferSelect;


type UserRole = 'admin' | 'instructional' | 'instructor' | 'ta'

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

// Helper function to get role display info
const getRoleInfo = (role: UserRole) => {
  const roleInfo = {
    admin: {
      label: 'Administrator',
      description: 'Full system access and management capabilities',
      color: 'destructive' as const,
      icon: Shield
    },
    instructional: {
      label: 'Instructional Staff',
      description: 'Manage courses, quizzes, and teaching resources',
      color: 'default' as const,
      icon: Building
    },
    instructor: {
      label: 'Instructor',
      description: 'Teach assigned courses and manage students',
      color: 'secondary' as const,
      icon: GraduationCap
    },
    ta: {
      label: 'Teaching Assistant',
      description: 'Assist with teaching and student support',
      color: 'outline' as const,
      icon: User
    }
  };

  return roleInfo[role] || roleInfo.ta;
};

interface ProfileSectionProps {
  className?: string
}

export function ProfileSection({ className }: ProfileSectionProps) {
  // Fetch user data
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  // Fetch classes for assigned courses
  const { data: classes = []} = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
    enabled: !!user
  });

  if (userLoading) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle>Loading Profile...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle>Guest User</CardTitle>
            <CardDescription>
              You are browsing as a guest. Please log in to access your profile.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const roleInfo = getRoleInfo(user.role as UserRole);
  const RoleIcon = roleInfo.icon;

  // Filter classes user is assigned to
  const assignedClasses = classes.filter((cls: Class) => 
    user.classIds?.includes(cls.id)
  );

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Basic Profile Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl">{user.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4" />
                  {user.username}@purdue.edu
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <RoleIcon className="h-4 w-4" />
              <Badge variant={roleInfo.color}>{roleInfo.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {roleInfo.description}
            </p>
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Account Type:</span>
                <p className="text-muted-foreground">{roleInfo.label}</p>
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <p className="text-green-600">Active</p>
              </div>
              <div>
                <span className="font-medium">Member Since:</span>
                <p className="text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="font-medium">Last Login:</span>
                <p className="text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Classes */}
        {assignedClasses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Assigned Classes
              </CardTitle>
              <CardDescription>
                Classes you are currently assigned to teach or assist with
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assignedClasses.map((cls: Class, index: number) => (
                  <div key={cls.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{cls.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {cls.classCode} • {cls.term} {cls.year}
                        </p>
                      </div>
                      <Badge variant="outline">{cls.classCode}</Badge>
                    </div>
                    {index < assignedClasses.length - 1 && (
                      <Separator className="mt-3" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Permissions & Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {user.role === 'admin' && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span>Full system administration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span>User management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                    <span>All course access</span>
                  </div>
                </>
              )}
              {user.role === 'instructional' && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full" />
                    <span>Course management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full" />
                    <span>Quiz creation and management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full" />
                    <span>Instructor and TA management</span>
                  </div>
                </>
              )}
              {user.role === 'instructor' && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-orange-500 rounded-full" />
                    <span>Assigned course access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-orange-500 rounded-full" />
                    <span>Student management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-orange-500 rounded-full" />
                    <span>TA management</span>
                  </div>
                </>
              )}
              {user.role === 'ta' && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-gray-500 rounded-full" />
                    <span>Chat assistance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-gray-500 rounded-full" />
                    <span>Student support</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-gray-500 rounded-full" />
                    <span>Guest mode access</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 