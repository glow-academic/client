import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function GTADashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('new'); // 'new', 'passed', 'failed', 'rubric'
  
  // Student personality types with their status
  const allStudentTypes = [
    { 
      id: 1, 
      type: 'happy',
      name: 'Happy Student', 
      description: 'A student approaches you with a big smile, excited about the course material and asking for additional resources to learn more beyond what was covered in class.',
      imageUrl: '/images/happy-student.svg',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300',
      status: 'new', // This student type hasn't been attempted yet
      attemptCount: 0,
    },
    { 
      id: 2, 
      type: 'sad', 
      name: 'Distressed Student', 
      description: 'A student comes to your office hours visibly upset, explaining that personal issues have affected their performance and they have missed multiple deadlines.',
      imageUrl: '/images/sad-student.svg',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300',
      status: 'passed', // This student type was passed
      attemptCount: 2,
      lastAttempt: '2023-10-15',
      score: 85,
    },
    { 
      id: 3, 
      type: 'aggressive', 
      name: 'Aggressive Student', 
      description: 'An agitated student approaches you, raising their voice about receiving a low grade. They insist their answers were correct and demand an immediate grade change.',
      imageUrl: '/images/aggressive-student.svg',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-300',
      status: 'failed', // This student type was failed
      attemptCount: 1,
      lastAttempt: '2023-10-12',
      score: 45,
    },
    { 
      id: 4, 
      type: 'distracted', 
      name: 'Distracted Student', 
      description: 'During your explanation of an important concept, you notice a student checking their phone repeatedly and missing key information. They later ask questions you just answered.',
      imageUrl: '/images/distracted-student.svg',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300',
      status: 'new',
      attemptCount: 0,
    },
    { 
      id: 5, 
      type: 'anxious', 
      name: 'Anxious Student', 
      description: 'A student emails you in a panic about the upcoming exam, expressing extreme worry about failing the course despite having decent grades. They are requesting constant reassurance.',
      imageUrl: '/images/anxious-student.svg',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-300',
      status: 'passed',
      attemptCount: 3,
      lastAttempt: '2023-10-18',
      score: 92,
    },
    { 
      id: 6, 
      type: 'overachiever', 
      name: 'Overachiever', 
      description: 'A student with a 96% in the course visits your office hours repeatedly, concerned about minor point deductions and arguing for perfect scores on every assignment.',
      imageUrl: '/images/overachiever-student.svg',
      bgColor: 'bg-indigo-100',
      borderColor: 'border-indigo-300',
      status: 'failed',
      attemptCount: 2,
      lastAttempt: '2023-10-10',
      score: 60,
    }
  ];

  // Filter student types based on active tab
  const filteredStudentTypes = allStudentTypes.filter(student => student.status === activeTab);
  
  // Get counts for tab badges
  const newCount = allStudentTypes.filter(s => s.status === 'new').length;
  const passedCount = allStudentTypes.filter(s => s.status === 'passed').length;
  const failedCount = allStudentTypes.filter(s => s.status === 'failed').length;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">GLOW - GTA Training</h1>
          <div>
            <button 
              onClick={() => navigate('/login')}
              className="px-3 py-1 bg-secondary/50 text-secondary-foreground rounded-md"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        {/* Tab Navigation */}
        <div className="border-b border-border mb-6">
          <nav className="-mb-px flex" aria-label="Tabs">
            <button 
              onClick={() => setActiveTab('new')} 
              className={`mr-2 px-4 py-2 font-medium text-sm rounded-t-lg border-b-2 ${
                activeTab === 'new' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              New
              <span className={`ml-2 py-0.5 px-2.5 text-xs font-medium rounded-full ${
                activeTab === 'new' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}>
                {newCount}
              </span>
            </button>
            
            <button 
              onClick={() => setActiveTab('passed')} 
              className={`mr-2 px-4 py-2 font-medium text-sm rounded-t-lg border-b-2 ${
                activeTab === 'passed' 
                  ? 'border-green-500 text-green-600' 
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Passed
              <span className={`ml-2 py-0.5 px-2.5 text-xs font-medium rounded-full ${
                activeTab === 'passed' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-800'
              }`}>
                {passedCount}
              </span>
            </button>
            
            <button 
              onClick={() => setActiveTab('failed')} 
              className={`mr-2 px-4 py-2 font-medium text-sm rounded-t-lg border-b-2 ${
                activeTab === 'failed' 
                  ? 'border-red-500 text-red-600' 
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Failed
              <span className={`ml-2 py-0.5 px-2.5 text-xs font-medium rounded-full ${
                activeTab === 'failed' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-800'
              }`}>
                {failedCount}
              </span>
            </button>
            
            <button 
              onClick={() => setActiveTab('rubric')} 
              className={`mr-2 px-4 py-2 font-medium text-sm rounded-t-lg border-b-2 ${
                activeTab === 'rubric' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              Rubric
            </button>
          </nav>
        </div>
        
        {/* Tab Content */}
        <div>
          {activeTab === 'new' && (
            <div>
            </div>
          )}
          
          {activeTab === 'passed' && (
            <div>
            </div>
          )}
          
          {activeTab === 'failed' && (
            <div>
            </div>
          )}
          
          {activeTab === 'rubric' && (
            <div>
              <h3 className="text-xl font-medium mb-4 text-blue-600">Assessment Rubric</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-md">
                  <thead className="bg-primary text-primary-foreground text-left">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Criteria</th>
                      <th className="py-3 px-4 font-semibold">Excellent (4)</th>
                      <th className="py-3 px-4 font-semibold">Proficient (3)</th>
                      <th className="py-3 px-4 font-semibold">Developing (2)</th>
                      <th className="py-3 px-4 font-semibold">Needs Improvement (1)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">Active Listening</td>
                      <td className="py-3 px-4">Demonstrates exceptional attention to student's concerns, repeats and rephrases to confirm understanding</td>
                      <td className="py-3 px-4">Shows consistent engagement with student's concerns, confirms understanding most of the time</td>
                      <td className="py-3 px-4">Some evidence of listening but misses key points, limited confirmation of understanding</td>
                      <td className="py-3 px-4">Minimal attention to student's concerns, frequently interrupts or misunderstands</td>
                    </tr>
                    <tr className="border-b border-border bg-secondary/30">
                      <td className="py-3 px-4 font-medium">Empathy</td>
                      <td className="py-3 px-4">Consistently acknowledges emotions, shows genuine concern and understanding of student's perspective</td>
                      <td className="py-3 px-4">Often recognizes emotions, attempts to understand student's perspective</td>
                      <td className="py-3 px-4">Occasionally acknowledges emotions, limited attempts to understand perspective</td>
                      <td className="py-3 px-4">Rarely acknowledges emotions or dismisses student's concerns</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">Problem Solving</td>
                      <td className="py-3 px-4">Identifies core issues quickly, offers multiple effective solutions, involves student in decision-making</td>
                      <td className="py-3 px-4">Identifies main issues, provides workable solutions, considers student input</td>
                      <td className="py-3 px-4">Partially identifies issues, limited solution options, minimal student involvement</td>
                      <td className="py-3 px-4">Misidentifies issues or provides inappropriate solutions without student input</td>
                    </tr>
                    <tr className="border-b border-border bg-secondary/30">
                      <td className="py-3 px-4 font-medium">Communication Clarity</td>
                      <td className="py-3 px-4">Consistently clear explanations, adapts language to student level, checks comprehension</td>
                      <td className="py-3 px-4">Generally clear explanations, appropriate language for student, occasional comprehension checks</td>
                      <td className="py-3 px-4">Sometimes unclear explanations, inconsistent language level, rare comprehension checks</td>
                      <td className="py-3 px-4">Confusing explanations, inappropriate language level, no comprehension checks</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">Resource Utilization</td>
                      <td className="py-3 px-4">Comprehensive knowledge of resources, provides specific referrals with details</td>
                      <td className="py-3 px-4">Good knowledge of resources, provides general referral information</td>
                      <td className="py-3 px-4">Limited knowledge of resources, vague referral information</td>
                      <td className="py-3 px-4">Minimal knowledge of resources, incorrect or no referral information</td>
                    </tr>
                    <tr className="border-b border-border bg-secondary/30">
                      <td className="py-3 px-4 font-medium">Time Management</td>
                      <td className="py-3 px-4">Efficiently uses time, addresses all concerns, provides closure within appropriate timeframe</td>
                      <td className="py-3 px-4">Good use of time, addresses main concerns, reasonable pacing throughout interaction</td>
                      <td className="py-3 px-4">Inconsistent pacing, spends too much time on minor issues, rushes important topics</td>
                      <td className="py-3 px-4">Poor time management, conversation either too rushed or unnecessarily lengthy</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-medium">Adjusted to Student Type</td>
                      <td className="py-3 px-4">Perfectly adapts approach to match student's personality and needs, uses appropriate strategies</td>
                      <td className="py-3 px-4">Generally adjusts communication style to student type, employs suitable techniques</td>
                      <td className="py-3 px-4">Some attempts to adjust to student type, but inconsistent application of strategies</td>
                      <td className="py-3 px-4">Uses same approach regardless of student type, ignores or misreads personality cues</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Scoring System</h4>
                <p className="text-sm mb-2">Your interactions with each student type are scored based on the criteria above:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li><span className="font-medium">Pass:</span> Score of 21-28 points (75%+)</li>
                  <li><span className="font-medium">Fail:</span> Score below 21 points</li>
                  <li>Each interaction must score at least 2 points in every criterion to pass</li>
                </ul>
              </div>
            </div>
          )}
          
          {(activeTab === 'new' || activeTab === 'passed' || activeTab === 'failed') && (
            filteredStudentTypes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStudentTypes.map((student) => (
                  <Link 
                    to={`/gta/conversation/${student.type}`} 
                    key={student.id}
                    className={`p-6 rounded-lg shadow-md ${student.bgColor} ${student.borderColor} border-2 transition-transform hover:scale-105`}
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 mb-4 rounded-full bg-white flex items-center justify-center relative">
                        <span className="text-4xl">
                          {student.type === 'happy' ? '😊' : 
                           student.type === 'sad' ? '😢' : 
                           student.type === 'aggressive' ? '😠' : 
                           student.type === 'distracted' ? '🤔' : 
                           student.type === 'anxious' ? '😰' : 
                           '🤓'}
                        </span>
                        
                        {student.status === 'passed' && (
                          <span className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center bg-green-500 text-white rounded-full border-2 border-white">
                            ✓
                          </span>
                        )}
                        
                        {student.status === 'failed' && (
                          <span className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-full border-2 border-white">
                            ✗
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-bold mb-2">{student.name}</h3>
                      <p className="text-center text-sm mb-3">{student.description}</p>
                      
                      {student.status !== 'new' && (
                        <div className="w-full mt-2 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Last attempt:</span>
                            <span>{student.lastAttempt}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Score:</span>
                            <span className={student.status === 'passed' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {student.score}/100
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Attempts:</span>
                            <span>{student.attemptCount}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className={`mt-4 w-full py-2 text-center rounded-md ${
                        student.status === 'new' ? 'bg-primary text-primary-foreground' :
                        student.status === 'passed' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {student.status === 'new' ? 'Start Practice' : 'Practice Again'}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-secondary/30 rounded-lg">
                <p className="text-muted-foreground">No student types in this category.</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}

export default GTADashboard;
