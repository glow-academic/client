import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="text-3xl font-bold">Glow Learning Platform</h1>
        <nav className="home-nav">
          <Link to="/login" className="nav-link">Logout</Link>
        </nav>
      </header>
      
      <main className="home-content">
        <section className="welcome-section">
          <h2 className="text-2xl font-semibold mb-4">Welcome to Glow!</h2>
          <p className="mb-6">Select the area you would like to explore:</p>
          
          <div className="card-container">
            <Link to="/student/courses" className="card">
              <h3>My Courses</h3>
              <p>Access your enrolled courses and learning materials</p>
            </Link>
            
            <Link to="/student/assignments" className="card">
              <h3>Assignments</h3>
              <p>View and submit your pending assignments</p>
            </Link>
            
            <Link to="/student/progress" className="card">
              <h3>My Progress</h3>
              <p>Track your learning progress and achievements</p>
            </Link>
            
            <Link to="/admin" className="card admin-card">
              <h3>Admin Panel</h3>
              <p>Manage courses, students, and system settings</p>
            </Link>
          </div>
        </section>
      </main>
      
      <footer className="home-footer">
        <p>&copy; 2023 Glow Learning Platform</p>
      </footer>
    </div>
  );
}

export default HomePage;
