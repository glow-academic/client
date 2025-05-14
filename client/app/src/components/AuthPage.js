import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function AuthPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  
  const handleLogin = (userType) => {
    // Basic validation
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    
    // For demo purposes, we'll just navigate based on the button clicked
    // In a real app, you would authenticate with a backend
    setError('');
    
    if (userType === 'student') {
      navigate('/gta/dashboard');
    } else if (userType === 'admin') {
      navigate('/admin');
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-secondary/30 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-lg shadow-lg border border-border">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Glow</h1>
          <p className="mt-2 text-muted-foreground">Graduate Learning Orientation Workshop</p>
        </div>
        
        <form className="mt-8 space-y-6">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-md">
              {error}
            </div>
          )}
          
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-foreground">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleLogin('student')}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90"
            >
              GTA
            </button>
            
            <button
              type="button"
              onClick={() => handleLogin('admin')}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/90"
            >
              Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuthPage;
