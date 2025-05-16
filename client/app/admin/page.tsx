/**
 * app/admin/page.tsx
 * This is the admin page to view the dashboard.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUsers } from "@/utils/queries/get-users";
import { chatProfile } from "@/drizzle/schema";
import { logout } from "@/utils/mutations/logout";
import { uploadDocument, deleteDocument, getDocumentsByProfile } from '@/lib/documentStorage';

export default function HomePage() {
    const [activeTab, setActiveTab] = useState('analytics');
    const [loading, setLoading] = useState(false);
    const [selectedProfileType, setSelectedProfileType] = useState('');
    const [fileUploadLoading, setFileUploadLoading] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();
    
    // Custom hook for document queries with cache invalidation
    const useDocumentsQuery = (profile: string) => {
      return useQuery({
        queryKey: ['documents', profile],
        queryFn: () => getDocumentsByProfile(profile),
        staleTime: 10000,  // Don't refetch too frequently
      });
    };

    // Fetch documents for each profile type
    const { data: aggressiveDocuments = [] } = useDocumentsQuery('aggressive');
    const { data: happyDocuments = [] } = useDocumentsQuery('happy');
    const { data: confusedDocuments = [] } = useDocumentsQuery('confused');
    
    // Combined list of all documents with profile name for display
    const allDocuments = [
        ...aggressiveDocuments.map(doc => ({ ...doc, profileName: 'Aggressive' })),
        ...happyDocuments.map(doc => ({ ...doc, profileName: 'Happy' })),
        ...confusedDocuments.map(doc => ({ ...doc, profileName: 'Confused' })),
    ];

    // Set up storage event listener to refresh documents when they change
    useEffect(() => {
      const handleStorageEvent = () => {
        queryClient.invalidateQueries({ queryKey: ['documents'] });
      };
      
      window.addEventListener('storage', handleStorageEvent);
      return () => window.removeEventListener('storage', handleStorageEvent);
    }, [queryClient]);

    const handleLogout = async () => {
      setLoading(true);
      try {
        const {success, error} = await logout();
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

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => getUsers(),
    });

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !selectedProfileType) return;
        
        const file = e.target.files[0];
        if (!file) return;

        try {
            setFileUploadLoading(true);
            await uploadDocument(file, selectedProfileType);
            
            // Invalidate document queries to refresh the list
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            
            // Reset file input and selection
            e.target.value = '';
            setSelectedProfileType('');
        } catch (error) {
            console.error("Error uploading file:", error);
        } finally {
            setFileUploadLoading(false);
        }
    };

    const handleDeleteFile = async (documentId: string, profile: string) => {
        try {
            setLoading(true);
            const success = await deleteDocument(documentId);
            
            if (success) {
                // Invalidate all document queries to refresh the lists
                queryClient.invalidateQueries({ queryKey: ['documents'] });
            }
        } catch (error) {
            console.error("Error deleting file:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
        <header className="bg-primary text-primary-foreground p-4">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">GTA Training Admin</h1>
            <button 
              onClick={handleLogout}
              className="px-3 py-1 bg-secondary/50 text-secondary-foreground rounded-md"
              disabled={loading}
            >
              {loading ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </header>
  
        <div className="container mx-auto p-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="bg-muted p-4">
              <div className="flex space-x-1">
                <button 
                  className={`px-4 py-2 rounded-md ${activeTab === 'analytics' ? 'bg-background shadow' : 'hover:bg-background/50'}`}
                  onClick={() => setActiveTab('analytics')}
                >
                  Analytics
                </button>
                <button 
                  className={`px-4 py-2 rounded-md ${activeTab === 'users' ? 'bg-background shadow' : 'hover:bg-background/50'}`}
                  onClick={() => setActiveTab('users')}
                >
                  Users
                </button>
                <button 
                  className={`px-4 py-2 rounded-md ${activeTab === 'uploads' ? 'bg-background shadow' : 'hover:bg-background/50'}`}
                  onClick={() => setActiveTab('uploads')}
                >
                  Uploads
                </button>
                <button 
                  className={`px-4 py-2 rounded-md ${activeTab === 'settings' ? 'bg-background shadow' : 'hover:bg-background/50'}`}
                  onClick={() => setActiveTab('settings')}
                >
                  Settings
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {activeTab === 'analytics' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">System Analytics</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-background p-6 rounded-lg border border-border">
                      <h3 className="text-lg font-semibold mb-4">GTA Usage Statistics</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2">Name</th>
                              <th className="text-left py-2">Interactions</th>
                              <th className="text-left py-2">Avg Duration</th>
                              <th className="text-left py-2">Last Active</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users?.map(user => (
                              <tr key={user.id} className="border-b border-border/50">
                                <td className="py-2">{user.username}</td>
                                {/* <td className="py-2">{user.interactions}</td>
                                <td className="py-2">{user.avgDuration}</td> */}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    <div className="bg-background p-6 rounded-lg border border-border">
                      <h3 className="text-lg font-semibold mb-4">Student Type Usage</h3>
                      <div className="space-y-4">
                        {chatProfile.enumValues.map(student => (
                          <div key={student} className="flex items-center">
                            <div className="w-24 font-medium capitalize">{student}</div>
                            {/* <div className="flex-1">
                              <div className="h-4 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary"
                                  style={{ width: `${(student.usageCount / 100) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="w-20 text-right text-sm">{student.usageCount} uses</div> */}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'users' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">User Management</h2>
                  <p className="text-muted-foreground">View and manage user accounts and permissions.</p>
                  
                  <div className="mt-4 p-8 text-center bg-muted/30 rounded-lg border border-dashed border-muted">
                    <h3 className="font-medium">User Management Interface</h3>
                    <p className="text-sm text-muted-foreground mt-2">This section would contain user management controls</p>
                  </div>
                </div>
              )}
              
              {activeTab === 'uploads' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">Document Uploads</h2>
                  <p className="text-muted-foreground mb-4">Upload reference documents for each student type. These documents will be displayed during conversations with that student type.</p>
                  
                  <div className="bg-background p-6 rounded-lg border border-border">
                    <h3 className="text-lg font-semibold mb-4">Upload New Document</h3>
                    
                    <div className="mb-4">
                      <label htmlFor="profile-select" className="block text-sm font-medium mb-1">Select Student Type:</label>
                      <select 
                        id="profile-select"
                        className="w-full p-2 border border-border rounded-md bg-background"
                        value={selectedProfileType}
                        onChange={(e) => setSelectedProfileType(e.target.value)}
                      >
                        <option value="">Select a student type</option>
                        {chatProfile.enumValues.map(profile => (
                          <option key={profile} value={profile}>
                            {profile.charAt(0).toUpperCase() + profile.slice(1)} Student
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="mb-6">
                      <label htmlFor="file-upload" className="block text-sm font-medium mb-1">Upload Document:</label>
                      <input
                        id="file-upload"
                        type="file"
                        onChange={handleFileUpload}
                        disabled={!selectedProfileType || fileUploadLoading}
                        className="w-full p-2 border border-border rounded-md bg-background"
                        accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
                      />
                      {fileUploadLoading && (
                        <p className="text-sm text-blue-500 mt-1">Uploading document...</p>
                      )}
                      {!selectedProfileType && (
                        <p className="text-sm text-red-500 mt-1">Please select a student type first</p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Uploaded Documents</h4>
                      {allDocuments.length > 0 ? (
                        <table className="min-w-full border border-border">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="p-2 text-left">Document Name</th>
                              <th className="p-2 text-left">Student Type</th>
                              <th className="p-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allDocuments.map((doc) => (
                              <tr key={doc.id} className="border-t border-border">
                                <td className="p-2">{doc.name}</td>
                                <td className="p-2 capitalize">
                                  {doc.profileName} Student
                                </td>
                                <td className="p-2 text-right">
                                  <button 
                                    onClick={() => handleDeleteFile(doc.id, doc.profile)}
                                    className="text-red-500 hover:text-red-700 text-sm"
                                    disabled={loading}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'settings' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">System Settings</h2>
                  <p className="text-muted-foreground">Configure system settings and parameters.</p>
                  
                  <div className="mt-4 p-8 text-center bg-muted/30 rounded-lg border border-dashed border-muted">
                    <h3 className="font-medium">Settings Interface</h3>
                    <p className="text-sm text-muted-foreground mt-2">This section would contain system configuration options</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
}