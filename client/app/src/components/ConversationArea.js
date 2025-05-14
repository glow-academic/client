import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function ConversationArea() {
  const { studentType } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Define which student types should show rubric and their pass/fail status
  const passGroup = ['sad', 'anxious']; // Students that pass
  const failGroup = ['aggressive', 'overachiever']; // Students that fail
  const noRubricGroup = ['happy', 'distracted']; // New students, don't show rubric
  
  // Check if the current student type should show rubric
  const shouldShowRubric = passGroup.includes(studentType) || failGroup.includes(studentType);
  const isPassed = passGroup.includes(studentType);
  
  // Rubric scores based on student type
  const getRubricScores = () => {
    if (studentType === 'sad') {
      return {
        activeListening: 4,
        empathy: 4,
        problemSolving: 3,
        communicationClarity: 3,
        resourceUtilization: 3,
        timeManagement: 3,
        adaptability: 4
      };
    } else if (studentType === 'anxious') {
      return {
        activeListening: 3,
        empathy: 4,
        problemSolving: 3,
        communicationClarity: 3,
        resourceUtilization: 4,
        timeManagement: 3,
        adaptability: 3
      };
    } else if (studentType === 'aggressive') {
      return {
        activeListening: 1,
        empathy: 1,
        problemSolving: 2,
        communicationClarity: 1,
        resourceUtilization: 2,
        timeManagement: 2,
        adaptability: 1
      };
    } else if (studentType === 'overachiever') {
      return {
        activeListening: 2,
        empathy: 1,
        problemSolving: 2,
        communicationClarity: 2,
        resourceUtilization: 2,
        timeManagement: 1,
        adaptability: 1
      };
    } else {
      // Default scores - though these won't be shown for noRubricGroup
      return {
        activeListening: 0,
        empathy: 0,
        problemSolving: 0,
        communicationClarity: 0,
        resourceUtilization: 0,
        timeManagement: 0,
        adaptability: 0
      };
    }
  };
  
  const rubricScores = getRubricScores();

  // Get student persona based on type
  const getStudentPersona = () => {
    switch(studentType) {
      case 'happy':
        return {
          name: "Alex Chen",
          mood: "Happy",
          emoji: "😊",
          color: "bg-green-100",
          border: "border-green-300",
          initialMessage: "Hi! I'm really enjoying this course. I just had a question about the last assignment.",
          scenarioDescription: "A student approaches you with a big smile, excited about the course material and asking for additional resources to learn more beyond what was covered in class."
        };
      case 'sad':
        return {
          name: "Jamie Lee",
          mood: "Sad",
          emoji: "😢",
          color: "bg-blue-100",
          border: "border-blue-300",
          initialMessage: "Hello... I've been having a really hard time keeping up with the coursework lately.",
          scenarioDescription: "A student comes to your office hours visibly upset, explaining that personal issues have affected their performance and they have missed multiple deadlines."
        };
      case 'aggressive':
        return {
          name: "Jordan Smith",
          mood: "Aggressive",
          emoji: "😠",
          color: "bg-red-100",
          border: "border-red-300",
          initialMessage: "This grading is completely unfair! I deserve a better grade than this.",
          scenarioDescription: "An agitated student approaches you, raising their voice about receiving a low grade. They insist their answers were correct and demand an immediate grade change."
        };
      case 'distracted':
        return {
          name: "Riley Johnson",
          mood: "Distracted",
          emoji: "🤔",
          color: "bg-yellow-100",
          border: "border-yellow-300",
          initialMessage: "Sorry, what was the assignment again? I was... um... what were we talking about?",
          scenarioDescription: "During your explanation of an important concept, you notice a student checking their phone repeatedly and missing key information. They later ask questions you just answered."
        };
      case 'anxious':
        return {
          name: "Morgan Taylor",
          mood: "Anxious",
          emoji: "😰",
          color: "bg-purple-100",
          border: "border-purple-300",
          initialMessage: "I'm really worried about failing this class. Do you think there's any chance I could pass?",
          scenarioDescription: "A student emails you in a panic about the upcoming exam, expressing extreme worry about failing the course despite having decent grades. They are requesting constant reassurance."
        };
      case 'overachiever':
        return {
          name: "Casey Williams",
          mood: "Overachiever",
          emoji: "🤓",
          color: "bg-indigo-100",
          border: "border-indigo-300",
          initialMessage: "I've already finished the next three assignments and was wondering if you could review them early. I'm aiming for an A+.",
          scenarioDescription: "A student with a 96% in the course visits your office hours repeatedly, concerned about minor point deductions and arguing for perfect scores on every assignment."
        };
      default:
        return {
          name: "Student",
          mood: "Neutral",
          emoji: "😐",
          color: "bg-gray-100",
          border: "border-gray-300",
          initialMessage: "Hello, I have a question about the course.",
          scenarioDescription: "A student approaches you with a general question about the course."
        };
    }
  };

  const studentPersona = getStudentPersona();

  // Auto-generated responses based on student type
  const generateStudentResponse = (gtaMessage) => {
    // Convert message to lowercase for easier matching
    const msg = gtaMessage.toLowerCase();
    
    switch(studentType) {
      case 'happy':
        if (msg.includes('help') || msg.includes('assist')) {
          return "That would be fantastic! Thank you so much for your help!";
        } else if (msg.includes('deadline') || msg.includes('late')) {
          return "No problem at all, I understand deadlines are important! I'll make sure to submit it on time.";
        } else {
          return "Great! I appreciate your guidance on this. I'm really enjoying the course material.";
        }
      
      case 'sad':
        if (msg.includes('help') || msg.includes('assist') || msg.includes('support')) {
          return "Thank you... I could really use some help right now.";
        } else if (msg.includes('extension') || msg.includes('extra time')) {
          return "That would be helpful... I've been dealing with a lot lately.";
        } else {
          return "I'll try to do better... it's just been hard to focus with everything going on.";
        }
        
      case 'aggressive':
        if (msg.includes('understand') || msg.includes('policy')) {
          return "That's just a convenient excuse. Other professors are much more reasonable about these things.";
        } else if (msg.includes('calm') || msg.includes('tone')) {
          return "Don't tell me to calm down! This is my education we're talking about!";
        } else {
          return "Well, I still think this is unfair. I put a lot of work into this course despite what you might think.";
        }
        
      case 'distracted':
        if (msg.includes('focus') || msg.includes('attention')) {
          return "Oh right, sorry about that. I just got distracted by... wait, what were we talking about again?";
        } else if (msg.includes('deadline') || msg.includes('due')) {
          return "There was a deadline? Oh no, I completely missed that... when was it announced?";
        } else {
          return "Sure, I'll try to... oh, did you see that new post on social media about the campus event?";
        }
        
      case 'anxious':
        if (msg.includes('worry') || msg.includes('fine')) {
          return "But what if I mess up again? I'm really worried about my GPA.";
        } else if (msg.includes('resources') || msg.includes('help')) {
          return "I've tried those resources, but I still don't feel confident. Do you think I should withdraw from the course?";
        } else {
          return "I'll try, but I'm still really nervous about the next exam. What if I blank out again?";
        }
        
      case 'overachiever':
        if (msg.includes('pace') || msg.includes('slow down')) {
          return "Slow down? But I need to maintain my perfect GPA! Could I at least get some extra credit work?";
        } else if (msg.includes('rest') || msg.includes('break')) {
          return "I don't have time for breaks. I need to stay ahead if I want to get into a top graduate program.";
        } else {
          return "I've already read all the recommended materials. Do you have any advanced readings you could suggest?";
        }
        
      default:
        return "I see. Thanks for your response.";
    }
  };

  // Initialize conversation with student's initial message
  useEffect(() => {
    setMessages([
      {
        sender: 'student',
        content: studentPersona.initialMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [studentType]);

  // Auto-scroll to bottom of message list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    // Add GTA's message
    const updatedMessages = [
      ...messages,
      {
        sender: 'gta',
        content: newMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    
    setMessages(updatedMessages);
    setNewMessage('');
    
    // Simulate student response after a short delay
    setTimeout(() => {
      const studentResponse = generateStudentResponse(newMessage);
      setMessages(prev => [
        ...prev,
        {
          sender: 'student',
          content: studentResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 1000);
  };

  // Helper function to render checkmark or X for rubric scores
  const renderScoreIcon = (score) => {
    if (score >= 3) {
      return <span className="text-green-500 text-xl">✓</span>;
    } else {
      return <span className="text-red-500 text-xl">✗</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/gta/dashboard')}
              className="p-1 rounded-full bg-secondary/20 hover:bg-secondary/40"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold">Conversation Practice</h1>
          </div>
          
          {shouldShowRubric && (
            <div className={`px-4 py-1 rounded-full ${isPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isPassed ? 'PASSED' : 'FAILED'}
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto flex-1 p-4 flex flex-col">
        <div className={`mb-6 p-4 rounded-lg ${studentPersona.color} ${studentPersona.border} border`}>
          <p className="text-base">{studentPersona.scenarioDescription}</p>
        </div>
        
        <div className="flex flex-1 gap-4">
          {/* Chat area - takes full width or 2/3 width depending on rubric display */}
          <div className={`${shouldShowRubric ? 'w-2/3' : 'w-full'} flex flex-col`}>
            <div className="flex-1 bg-card border border-border rounded-lg p-4 mb-4 overflow-y-auto">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`flex ${message.sender === 'gta' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.sender === 'gta' 
                          ? 'bg-primary text-primary-foreground rounded-br-none' 
                          : `${studentPersona.color} rounded-bl-none`
                      }`}
                    >
                      <p>{message.content}</p>
                      <p className="text-xs mt-1 opacity-70 text-right">{message.timestamp}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
            
            {/* Only show input area if rubric is not shown */}
            {!shouldShowRubric && (
              <div className="flex gap-2">
                <form onSubmit={handleSendMessage} className="relative flex-1">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="w-full p-3 pr-12 rounded-lg border border-input bg-background"
                    placeholder="Type your response..."
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      className={`w-6 h-6 ${newMessage.trim() ? 'text-blue-500' : 'text-gray-300'} transition-colors`}
                    >
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  </button>
                </form>
                
                <button 
                  onClick={() => navigate('/gta/dashboard')}
                  className="px-4 py-3 bg-red-500 text-white rounded-lg"
                >
                  End Session
                </button>
              </div>
            )}
          </div>
          
          {/* Rubric area - shown only for pass/fail students */}
          {shouldShowRubric && (
            <div className="w-1/3 bg-card border border-border rounded-lg p-4 overflow-y-auto">
              <h2 className="text-lg font-bold mb-4 text-center">Assessment Rubric</h2>
              
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Active Listening</span>
                    <span className="flex items-center gap-1">
                      {renderScoreIcon(rubricScores.activeListening)} 
                      <span className="ml-1">{rubricScores.activeListening}/4</span>
                    </span>
                  </div>
                </div>
                
                <div className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Empathy</span>
                    <span className="flex items-center gap-1">
                      {renderScoreIcon(rubricScores.empathy)} 
                      <span className="ml-1">{rubricScores.empathy}/4</span>
                    </span>
                  </div>
                </div>
                
                <div className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Problem Solving</span>
                    <span className="flex items-center gap-1">
                      {renderScoreIcon(rubricScores.problemSolving)} 
                      <span className="ml-1">{rubricScores.problemSolving}/4</span>
                    </span>
                  </div>
                </div>
                
                <div className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Communication</span>
                    <span className="flex items-center gap-1">
                      {renderScoreIcon(rubricScores.communicationClarity)} 
                      <span className="ml-1">{rubricScores.communicationClarity}/4</span>
                    </span>
                  </div>
                </div>
                
                <div className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Resource Utilization</span>
                    <span className="flex items-center gap-1">
                      {renderScoreIcon(rubricScores.resourceUtilization)} 
                      <span className="ml-1">{rubricScores.resourceUtilization}/4</span>
                    </span>
                  </div>
                </div>
                
                <div className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Time Management</span>
                    <span className="flex items-center gap-1">
                      {renderScoreIcon(rubricScores.timeManagement)} 
                      <span className="ml-1">{rubricScores.timeManagement}/4</span>
                    </span>
                  </div>
                </div>
                
                <div className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Adaptability</span>
                    <span className="flex items-center gap-1">
                      {renderScoreIcon(rubricScores.adaptability)} 
                      <span className="ml-1">{rubricScores.adaptability}/4</span>
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <div className={`p-3 rounded-lg text-center font-semibold ${
                  isPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  <div className="text-xl mb-1">{isPassed ? 'PASSED' : 'FAILED'}</div>
                  <div className="text-sm">
                    Total Score: {Object.values(rubricScores).reduce((a, b) => a + b, 0)}/28
                  </div>
                </div>
                
                <button
                  onClick={() => navigate('/gta/dashboard')}
                  className="mt-4 w-full p-3 bg-primary text-primary-foreground rounded-lg"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConversationArea;
