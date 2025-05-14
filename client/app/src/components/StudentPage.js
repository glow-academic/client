import React from 'react';
import { useParams, Link } from 'react-router-dom';
import './StudentPage.css';

function StudentPage() {
  const { type } = useParams();
  
  const getContent = () => {
    switch (type) {
      case 'courses':
        return <CoursesContent />;
      case 'assignments':
        return <AssignmentsContent />;
      case 'progress':
        return <ProgressContent />;
      default:
        return <div>Page not found</div>;
    }
  };
  
  return (
    <div className="student-container">
      <header className="student-header">
        <div className="header-left">
          <h1 className="text-2xl font-bold">Glow Learning</h1>
        </div>
        
        <nav className="student-nav">
          <Link to="/home" className="nav-link">Dashboard</Link>
          <Link to="/login" className="nav-link logout">Logout</Link>
        </nav>
      </header>
      
      <div className="student-layout">
        <aside className="student-sidebar">
          <nav className="sidebar-nav">
            <Link 
              to="/student/courses" 
              className={`sidebar-link ${type === 'courses' ? 'active' : ''}`}
            >
              My Courses
            </Link>
            <Link 
              to="/student/assignments" 
              className={`sidebar-link ${type === 'assignments' ? 'active' : ''}`}
            >
              Assignments
            </Link>
            <Link 
              to="/student/progress" 
              className={`sidebar-link ${type === 'progress' ? 'active' : ''}`}
            >
              My Progress
            </Link>
          </nav>
        </aside>
        
        <main className="student-content">
          {getContent()}
        </main>
      </div>
    </div>
  );
}

function CoursesContent() {
  const courses = [
    { id: 1, title: 'Introduction to Programming', progress: 65, instructor: 'Dr. Smith' },
    { id: 2, title: 'Web Development Fundamentals', progress: 30, instructor: 'Prof. Johnson' },
    { id: 3, title: 'Data Structures and Algorithms', progress: 80, instructor: 'Dr. Williams' },
    { id: 4, title: 'Machine Learning Basics', progress: 15, instructor: 'Dr. Brown' }
  ];
  
  return (
    <div className="content-section">
      <h2 className="text-xl font-semibold mb-6">My Courses</h2>
      
      <div className="courses-grid">
        {courses.map(course => (
          <div key={course.id} className="course-card">
            <h3 className="course-title">{course.title}</h3>
            <p className="course-instructor">Instructor: {course.instructor}</p>
            
            <div className="progress-container">
              <div className="progress-label">
                <span>Progress</span>
                <span>{course.progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${course.progress}%` }}></div>
              </div>
            </div>
            
            <button className="course-button">Continue Learning</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentsContent() {
  const assignments = [
    { id: 1, title: 'JavaScript Basics Quiz', course: 'Web Development Fundamentals', dueDate: '2023-10-15', status: 'pending' },
    { id: 2, title: 'Python Programming Project', course: 'Introduction to Programming', dueDate: '2023-10-20', status: 'submitted' },
    { id: 3, title: 'Data Analysis Assignment', course: 'Machine Learning Basics', dueDate: '2023-10-25', status: 'graded', grade: 'A' }
  ];
  
  return (
    <div className="content-section">
      <h2 className="text-xl font-semibold mb-6">Assignments</h2>
      
      <div className="assignments-list">
        {assignments.map(assignment => (
          <div key={assignment.id} className={`assignment-item ${assignment.status}`}>
            <div className="assignment-info">
              <h3 className="assignment-title">{assignment.title}</h3>
              <p className="assignment-course">{assignment.course}</p>
              <p className="assignment-due">Due: {assignment.dueDate}</p>
            </div>
            
            <div className="assignment-status">
              {assignment.status === 'pending' && (
                <button className="status-button pending">Submit Assignment</button>
              )}
              {assignment.status === 'submitted' && (
                <span className="status-label submitted">Submitted</span>
              )}
              {assignment.status === 'graded' && (
                <span className="status-label graded">Grade: {assignment.grade}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressContent() {
  const achievements = [
    { id: 1, name: 'Fast Learner', description: 'Completed 5 lessons in one day', date: '2023-09-28' },
    { id: 2, name: 'Perfect Score', description: 'Achieved 100% on a quiz', date: '2023-09-15' },
    { id: 3, name: 'Consistent Student', description: 'Logged in for 7 consecutive days', date: '2023-10-01' }
  ];
  
  const stats = {
    coursesCompleted: 2,
    assignmentsSubmitted: 12,
    totalHours: 28,
    averageGrade: 'B+'
  };
  
  return (
    <div className="content-section">
      <h2 className="text-xl font-semibold mb-6">My Progress</h2>
      
      <div className="stats-container">
        <div className="stat-card">
          <span className="stat-value">{stats.coursesCompleted}</span>
          <span className="stat-label">Courses Completed</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.assignmentsSubmitted}</span>
          <span className="stat-label">Assignments Submitted</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.totalHours}</span>
          <span className="stat-label">Total Hours</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.averageGrade}</span>
          <span className="stat-label">Average Grade</span>
        </div>
      </div>
      
      <h3 className="text-lg font-semibold mt-8 mb-4">Achievements</h3>
      <div className="achievements-list">
        {achievements.map(achievement => (
          <div key={achievement.id} className="achievement-item">
            <div className="achievement-icon">🏆</div>
            <div className="achievement-info">
              <h4 className="achievement-name">{achievement.name}</h4>
              <p className="achievement-desc">{achievement.description}</p>
              <p className="achievement-date">Earned on {achievement.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StudentPage;
