/**
 * app/admin/page.tsx
 * This is the admin page to view the dashboard.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUsers } from "@/utils/queries/get-users";
import { logout } from "@/utils/mutations/logout";
import { getDocuments } from "@/utils/queries/get-documents";
import { toast } from "sonner";
import DocumentUploader from "@/components/DocumentUploader";

// Import UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: documents } = useQuery({
    queryKey: ['documents'],
    queryFn: () => getDocuments(),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  });

  const handleLogout = async () => {
    setLoading(true);
    try {
      const { success, error } = await logout();
      if (success) {
        router.push('/');
      } else {
        throw new Error(error);
      }
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteFile = async (documentId: string) => {
    try {
        setLoading(true);
        
        // Show confirmation dialog
        if (!confirm("Are you sure you want to delete this document?")) {
            setLoading(false);
            return;
        }
        
        // Call the delete function
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/id/${documentId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete document');
        }
        
        
        // Sho  w success notification
        toast.success("Document deleted successfully");
        
        // Invalidate document queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (error) {
        console.error("Error deleting file:", error);
        toast.error("An error occurred while deleting the document");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button variant="outline" onClick={handleLogout} disabled={loading}>
          {loading ? "Logging out..." : "Logout"}
        </Button>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Total Users: {users?.length || 0}
              </p>
              {/* Add more analytics here */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <DocumentUploader 
            onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Uploaded Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="border rounded-md">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-3 text-left font-medium">Document Name</th>
                        <th className="p-3 text-left font-medium">Student Type</th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents?.map((doc) => (
                        <tr key={doc.id} className="border-b">
                          <td className="p-3">{doc.name}</td>
                          <td className="p-3 capitalize">
                            {doc.profile} Student
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive/80"
                              onClick={() => handleDeleteFile(doc.id)}
                              disabled={loading}
                            >
                              {loading ? "Deleting..." : "Delete"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">No documents uploaded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Configure system settings and parameters.
              </p>
              <div className="mt-4 p-8 text-center bg-muted/30 rounded-lg border border-dashed border-muted">
                <h3 className="font-medium">Settings Interface</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  This section would contain system configuration options
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}