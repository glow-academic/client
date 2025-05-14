import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './components/AuthPage';
import AdminPage from './components/AdminPage';
import GTADashboard from './components/GTADashboard';
import ConversationArea from './components/ConversationArea';

function App() {
  return (
    <div className="App min-h-screen bg-background text-foreground">
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/gta/dashboard" element={<GTADashboard />} />
        <Route path="/gta/conversation/:studentType" element={<ConversationArea />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

export default App;
