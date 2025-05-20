"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Avatar, 
  AvatarFallback
} from "@/components/ui/avatar";
import { 
  ArrowLeft,  
  UserCheck, 
  Smile, 
  HelpCircle, 
  AlertCircle,
  Download
} from "lucide-react";
// Import Recharts components
import {
  LineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Mock course data
const mockCourses = {
  "cs182": {
    code: "CS 182",
    name: "Foundations of Computer Science",
    description: "Introduction to discrete mathematics, logic, and proof techniques for computer science",
    taCount: 8
  },
  "cs253": {
    code: "CS 253",
    name: "Data Structures and Algorithms for DS/AI",
    description: "Specialized data structures and algorithms for data science and artificial intelligence applications",
    taCount: 6
  },
  "cs381": {
    code: "CS 381",
    name: "Introduction to the Analysis of Algorithms",
    description: "Techniques for designing efficient algorithms and analyzing their complexity",
    taCount: 5
  },
  "csxyz": {
    code: "CS XYZ",
    name: "General",
    description: "For TA's who are not assigned to a specific course",
    taCount: 4
  }
};

// Mock TA data for each course
const mockTAs = {
  "cs182": [
    { id: 1, name: "Alex Johnson", avatar: "AJ", avgScore: 82, interactions: 45 },
    { id: 2, name: "Maria Garcia", avatar: "MG", avgScore: 94, interactions: 38 },
    { id: 3, name: "James Brown", avatar: "JB", avgScore: 91, interactions: 41 },
    { id: 4, name: "Emily Davis", avatar: "ED", avgScore: 73, interactions: 29 },
    { id: 5, name: "David Lee", avatar: "DL", avgScore: 61, interactions: 32 },
    { id: 6, name: "Sarah Wilson", avatar: "SW", avgScore: 89, interactions: 37 },
    { id: 7, name: "John Smith", avatar: "JS", avgScore: 65, interactions: 25 },
    { id: 8, name: "Lisa Taylor", avatar: "LT", avgScore: 85, interactions: 34 },
  ],
  "cs253": [
    { id: 1, name: "Michael Brown", avatar: "MB", avgScore: 88, interactions: 39 },
    { id: 2, name: "Jennifer Lopez", avatar: "JL", avgScore: 79, interactions: 31 },
    { id: 3, name: "Robert Chen", avatar: "RC", avgScore: 91, interactions: 42 },
    { id: 4, name: "Amanda White", avatar: "AW", avgScore: 83, interactions: 35 },
    { id: 5, name: "Daniel Kim", avatar: "DK", avgScore: 86, interactions: 40 },
    { id: 6, name: "Jessica Park", avatar: "JP", avgScore: 78, interactions: 28 },
  ],
  "cs381": [
    { id: 1, name: "Thomas Anderson", avatar: "TA", avgScore: 87, interactions: 36 },
    { id: 2, name: "Olivia Martinez", avatar: "OM", avgScore: 92, interactions: 43 },
    { id: 3, name: "Kevin Johnson", avatar: "KJ", avgScore: 75, interactions: 30 },
    { id: 4, name: "Sophia Lee", avatar: "SL", avgScore: 84, interactions: 37 },
    { id: 5, name: "William Davis", avatar: "WD", avgScore: 79, interactions: 33 },
  ],
  "csxyz": [
    { id: 1, name: "Emma Wilson", avatar: "EW", avgScore: 81, interactions: 34 },
    { id: 2, name: "Ryan Thompson", avatar: "RT", avgScore: 76, interactions: 27 },
    { id: 3, name: "Nina Patel", avatar: "NP", avgScore: 89, interactions: 40 },
    { id: 4, name: "Christopher Moore", avatar: "CM", avgScore: 72, interactions: 29 },
  ]
};

// Mock data for charts
const mockTrendData = [
  { date: "05-10", avgScore: 72 },
  { date: "05-11", avgScore: 68 },
  { date: "05-12", avgScore: 74 },
  { date: "05-13", avgScore: 79 },
  { date: "05-14", avgScore: 76 },
  { date: "05-15", avgScore: 81 },
  { date: "05-16", avgScore: 80 },
  { date: "05-17", avgScore: 84 },
  { date: "05-18", avgScore: 87 },
  { date: "05-19", avgScore: 90 },
];

export default function CourseDetailsPage({ params }: { params: { courseId: string } }) {
  const { courseId } = params;
  const router = useRouter();
  
  const [course, setCourse] = useState<any>(null);
  const [tas, setTAs] = useState<any[]>([]);
  
  // Student behavior controls
  const [happyLevel, setHappyLevel] = useState<number>(50);
  const [confusedLevel, setConfusedLevel] = useState<number>(30);
  const [angryLevel, setAngryLevel] = useState<number>(20);
  
  // For emotion tab state
  const [activeEmotion, setActiveEmotion] = useState<"happy" | "confused" | "angry">("happy");
  
  // Load course data
  useEffect(() => {
    if (courseId in mockCourses) {
      setCourse(mockCourses[courseId as keyof typeof mockCourses]);
      setTAs(mockTAs[courseId as keyof typeof mockTAs] || []);
    } else {
      // Handle invalid course ID
      router.push('/admin');
    }
  }, [courseId, router]);
  
  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading course details...</p>
      </div>
    );
  }
  
  // Go back to admin dashboard
  const handleBack = () => {
    router.push('/admin');
  };
  
  // Apply behavior changes
  const handleApplyBehaviorChanges = () => {
    alert(`Applied behavior settings: Happy (${happyLevel}%), Confused (${confusedLevel}%), Angry (${angryLevel}%)`);
  };
  
  // Generate emotion data based on current TAs
  const taEmotionData = tas.map(ta => {
    // Use TA's avgScore to influence emotion distribution
    // Higher scores = more happy, less angry
    const happy = Math.min(Math.max(ta.avgScore, 30), 80);
    const angry = Math.max(Math.min(100 - ta.avgScore, 40), 5);
    const confused = 100 - happy - angry;
    
    return {
      name: ta.name.split(' ')[0] + ' ' + ta.name.split(' ')[1][0] + '.',
      happy,
      confused,
      angry,
      id: ta.id
    };
  });
  
  // Function to handle mock PDF download
  const handleDownloadReport = async (ta: any) => {
    const link = document.createElement('a');
    link.download = `TA_Report_${ta.name.replace(/\s+/g, '_')}.pdf`;

    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();

    // Add a blank page to the document
    const page = pdfDoc.addPage([612, 792]); // Standard US Letter size

    // Get the Times Roman font
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // Get the width and height of the page
    const { width, height } = page.getSize();

    // Define content
    const reportTitle = "TA PERFORMANCE REPORT";
    const taNameLine = `TA Name: ${ta.name}`;
    const courseLine = `Course: ${course.code} - ${course.name}`;
    const avgScoreLine = `Average Score: ${ta.avgScore}%`;
    const breakdownTitle = "STUDENT INTERACTION BREAKDOWN";
    const angryLine = "Angry Student Trials: 54%, 68%, 60%, 70%, 80%";
    const happyLine = "Happy Student Trials: 72%, 80%";
    const confusedLine = "Confused Student Trials: 60%, 74%, 82%";

    // Draw text on the page
    let yPosition = height - 50; // Start from top

    page.drawText(reportTitle, {
      x: 72,
      y: yPosition,
      font: timesRomanBoldFont,
      size: 18,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30; // Move down for next line

    page.drawText(taNameLine, {
      x: 72,
      y: yPosition,
      font: timesRomanFont,
      size: 12,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    page.drawText(courseLine, {
      x: 72,
      y: yPosition,
      font: timesRomanFont,
      size: 12,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    page.drawText(avgScoreLine, {
      x: 72,
      y: yPosition,
      font: timesRomanFont,
      size: 12,
      color: rgb(0, 0, 0),
    });
    yPosition -= 40; // More space before breakdown

    page.drawText(breakdownTitle, {
      x: 72,
      y: yPosition,
      font: timesRomanBoldFont,
      size: 14,
      color: rgb(0, 0, 0),
    });
    yPosition -= 25;

    page.drawText(angryLine, {
      x: 72,
      y: yPosition,
      font: timesRomanFont,
      size: 12,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    page.drawText(happyLine, {
      x: 72,
      y: yPosition,
      font: timesRomanFont,
      size: 12,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    page.drawText(confusedLine, {
      x: 72,
      y: yPosition,
      font: timesRomanFont,
      size: 12,
      color: rgb(0, 0, 0),
    });

    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();

    // Create a blob from the PDF bytes
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(pdfBlob);

    link.href = objectUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    }, 100);

    // Use a visual toast notification
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.right = '20px';
    notification.style.bottom = '20px';
    notification.style.padding = '12px 16px';
    notification.style.background = '#10b981';
    notification.style.color = 'white';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    notification.style.zIndex = '1000';
    notification.style.opacity = '0.9';
    notification.textContent = `Downloading report for ${ta.name}`;
    
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s ease-out';
      setTimeout(() => document.body.removeChild(notification), 500);
    }, 2000);
  };

  return (
    <div className="container mx-auto py-8">
      {/* Header with navigation */}
      <div className="flex items-center mb-8">
        <Button variant="ghost" onClick={handleBack} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-medium">{course.code}</Badge>
            <h1 className="text-2xl font-bold">{course.name}</h1>
          </div>
          <p className="text-muted-foreground mt-1">{course.description}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* TA List */}
        <div className="md:col-span-2 space-y-6">
          <Card className="flex flex-col h-full max-h-[500px]">
            <CardHeader className="pb-0 flex-shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Teaching Assistants</CardTitle>
                  <CardDescription>Manage TAs assigned to {course.code}</CardDescription>
                </div>
                <span className="font-medium text-sm text-muted-foreground mr-16">Avg. Score</span>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-grow overflow-hidden">
              <div className="border-t overflow-y-auto h-full">
                {tas.map((ta) => (
                  <div key={ta.id} className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className={ta.avgScore >= 80 ? "bg-primary/10" : ta.avgScore >= 70 ? "bg-amber-100" : "bg-red-100"}>
                          {ta.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{ta.name}</p>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <UserCheck className="h-3 w-3 mr-1" />
                          <span>{ta.interactions} interactions</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`
                        ${ta.avgScore >= 80 ? 'bg-green-100 text-green-800' : 
                         ta.avgScore >= 70 ? 'bg-amber-100 text-amber-800' : 
                         'bg-red-100 text-red-800'}
                      `}>
                        Score: {ta.avgScore}%
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadReport(ta)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Student Behavior Controls */}
        <div>
          <Card className="flex flex-col h-full max-h-[500px]">
            <CardHeader className="flex-shrink-0">
              <CardTitle>AI Student Behavior</CardTitle>
              <CardDescription>Adjust the behavior traits for AI students in this course</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow overflow-y-auto">
              {/* Happy students control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Smile className="h-4 w-4 mr-2 text-green-500" />
                    <span className="font-medium">Happy Students</span>
                  </div>
                  <span className="text-sm font-semibold">{happyLevel}%</span>
                </div>
                <Slider 
                  value={[happyLevel]} 
                  onValueChange={(values) => setHappyLevel(values[0])} 
                  min={0} 
                  max={100} 
                  step={5}
                  className="[&>.data-[value]:bg-green-500]"
                />
                <p className="text-xs text-muted-foreground">
                  These students are engaged, understanding the material well, and responsive to teaching.
                </p>
              </div>
              
              {/* Confused students control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <HelpCircle className="h-4 w-4 mr-2 text-amber-500" />
                    <span className="font-medium">Confused Students</span>
                  </div>
                  <span className="text-sm font-semibold">{confusedLevel}%</span>
                </div>
                <Slider 
                  value={[confusedLevel]} 
                  onValueChange={(values) => setConfusedLevel(values[0])} 
                  min={0} 
                  max={100} 
                  step={5}
                  className="[&>.data-[value]:bg-amber-500]"
                />
                <p className="text-xs text-muted-foreground">
                  These students struggle to understand concepts and require additional explanation and patience.
                </p>
              </div>
              
              {/* Angry students control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                    <span className="font-medium">Angry Students</span>
                  </div>
                  <span className="text-sm font-semibold">{angryLevel}%</span>
                </div>
                <Slider 
                  value={[angryLevel]} 
                  onValueChange={(values) => setAngryLevel(values[0])} 
                  min={0} 
                  max={100} 
                  step={5}
                  className="[&>.data-[value]:bg-red-500]"
                />
                <p className="text-xs text-muted-foreground">
                  These students are frustrated, possibly confrontational, and need careful handling to resolve issues.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 flex-shrink-0">
              <Button className="w-full" onClick={handleApplyBehaviorChanges}>
                Apply Behavior Changes
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Changes will affect all new interactions with TAs in this course.
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* Performance Trend Charts - Now full width */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>TA performance metrics and student emotional data</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Line Chart - Score Trends */}
              <div className="h-80">
                <h3 className="text-sm font-medium mb-2">Average Score Trend</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={mockTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" axisLine={true} tickLine={true} />
                    <YAxis domain={[60, 100]} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="avgScore" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Avg. Score" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Bar Chart - Student Emotions */}
              <div className="h-80">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium">Student Emotional Response</h3>
                  <div className="flex items-center bg-secondary rounded-md p-0.5">
                    <button
                      onClick={() => setActiveEmotion("happy")}
                      className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                        activeEmotion === "happy" ? "bg-background shadow" : "hover:bg-secondary-foreground/10"
                      }`}
                    >
                      Happy
                    </button>
                    <button
                      onClick={() => setActiveEmotion("confused")}
                      className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                        activeEmotion === "confused" ? "bg-background shadow" : "hover:bg-secondary-foreground/10"
                      }`}
                    >
                      Confused
                    </button>
                    <button
                      onClick={() => setActiveEmotion("angry")}
                      className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                        activeEmotion === "angry" ? "bg-background shadow" : "hover:bg-secondary-foreground/10"
                      }`}
                    >
                      Angry
                    </button>
                  </div>
                </div>
                
                <div className="h-[calc(100%-24px)]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                      data={taEmotionData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      barGap={0} 
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" axisLine={true} tickLine={true} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      {activeEmotion === "happy" && (
                        <Bar 
                          dataKey="happy" 
                          name="Happy" 
                          fill="#10b981" 
                          minPointSize={3}
                          isAnimationActive={true}
                        />
                      )}
                      {activeEmotion === "confused" && (
                        <Bar 
                          dataKey="confused" 
                          name="Confused" 
                          fill="#f59e0b" 
                          minPointSize={3}
                          isAnimationActive={true}
                        />
                      )}
                      {activeEmotion === "angry" && (
                        <Bar 
                          dataKey="angry" 
                          name="Angry" 
                          fill="#ef4444" 
                          minPointSize={3}
                          isAnimationActive={true}
                        />
                      )}
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
