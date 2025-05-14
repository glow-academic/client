import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('analytics');
  
  // Mock data for demonstration
  const gtaUsageData = [
    { id: 1, name: 'John Smith', interactions: 25, avgDuration: '8m 12s', lastActive: '2 hours ago' },
    { id: 2, name: 'Emily Johnson', interactions: 18, avgDuration: '12m 45s', lastActive: '1 day ago' },
    { id: 3, name: 'Michael Brown', interactions: 32, avgDuration: '5m 30s', lastActive: '3 hours ago' },
    { id: 4, name: 'Sarah Wilson', interactions: 15, avgDuration: '10m 08s', lastActive: '5 days ago' },
    { id: 5, name: 'David Lee', interactions: 28, avgDuration: '7m 22s', lastActive: '1 hour ago' }
  ];
  
  const studentTypes = [
    { type: 'happy', usageCount: 78, avgResponseQuality: 'High' },
    { type: 'sad', usageCount: 45, avgResponseQuality: 'Medium' },
    { type: 'aggressive', usageCount: 62, avgResponseQuality: 'Low' },
    { type: 'distracted', usageCount: 31, avgResponseQuality: 'Medium' },
    { type: 'anxious', usageCount: 53, avgResponseQuality: 'High' },
    { type: 'overachiever', usageCount: 40, avgResponseQuality: 'High' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">GTA Training Admin</h1>
          <button 
            onClick={() => navigate('/login')}
            className="px-3 py-1 bg-secondary/50 text-secondary-foreground rounded-md"
          >
            Logout
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
                          {gtaUsageData.map(user => (
                            <tr key={user.id} className="border-b border-border/50">
                              <td className="py-2">{user.name}</td>
                              <td className="py-2">{user.interactions}</td>
                              <td className="py-2">{user.avgDuration}</td>
                              <td className="py-2">{user.lastActive}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="bg-background p-6 rounded-lg border border-border">
                    <h3 className="text-lg font-semibold mb-4">Student Type Usage</h3>
                    <div className="space-y-4">
                      {studentTypes.map(student => (
                        <div key={student.type} className="flex items-center">
                          <div className="w-24 font-medium capitalize">{student.type}</div>
                          <div className="flex-1">
                            <div className="h-4 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary"
                                style={{ width: `${(student.usageCount / 100) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                          <div className="w-20 text-right text-sm">{student.usageCount} uses</div>
                          <div className={`w-16 text-right text-sm ml-4 ${
                            student.avgResponseQuality === 'High' ? 'text-green-600' : 
                            student.avgResponseQuality === 'Medium' ? 'text-yellow-600' : 
                            'text-red-600'
                          }`}>
                            {student.avgResponseQuality}
                          </div>
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

export default AdminPage;
