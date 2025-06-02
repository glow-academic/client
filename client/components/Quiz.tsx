/**
 * Quiz.tsx
 * Used to create and manage quizzes for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Minus,
  Trash2,
  Edit,
  Eye,
  FileText,
  Clock,
  Users,
  Shuffle,
  X,
  Zap,
  Smile,
  HelpCircle,
  GripVertical,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DocumentViewer from "@/components/DocumentViewer";

// Queries and mutations
import { getClasses } from "@/utils/queries/get-classes";
import { getDocuments } from "@/utils/queries/get-documents";
import { getProfiles } from "@/utils/queries/get-profiles";
import { createQuiz, updateQuiz, QuizFormData as MutationQuizFormData } from "@/utils/mutations/create-quiz";

interface StudentCard {
  id: string;
  type: "aggressive" | "happy" | "confused";
  index: number;
  crowdedness: number;
  intensity: number;
}

interface QuizComponentFormData {
  title: string;
  classId: string;
  timeLimit: number;
  aggressiveCount: number;
  happyCount: number;
  confusedCount: number;
  documentId: string;
  studentConfigs: Record<string, { crowdedness: number; intensity: number }>;
  cardOrder: StudentCard[];
}

interface FormErrors {
  title?: string;
  classId?: string;
  timeLimit?: string;
  documentId?: string;
  studentCount?: string;
}

interface QuizProps {
  mode?: "list" | "create";
}

export default function Quiz({ mode = "create" }: QuizProps) {
  const queryClient = useQueryClient();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<any>(null);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  const initialFormData: QuizComponentFormData = {
    title: "",
    classId: "",
    timeLimit: 15,
    aggressiveCount: 0,
    happyCount: 0,
    confusedCount: 0,
    documentId: "",
    studentConfigs: {},
    cardOrder: [],
  };

  const [formData, setFormData] = useState<QuizComponentFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch classes and documents
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: getDocuments,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });

  // Fetch quizzes for the list mode
  const { data: quizzes = [] } = useQuery({
    queryKey: ["quizzes"],
    queryFn: async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/quiz`, {
          credentials: "include",
        });
        
        if (!response.ok) {
          if (response.status === 405) {
            console.warn("Quiz endpoint not implemented yet");
            return [];
          }
          throw new Error("Failed to fetch quizzes");
        }
        
        const data = await response.json();
        
        return data.map((quiz: any) => ({
          ...quiz,
          className: quiz.className || "Unknown Class", 
          classCode: quiz.classCode || "Unknown Code",
          studentInteractions: quiz.studentInteractions || { aggressive: [], happy: [], confused: [] }
        }));
      } catch (error) {
        console.error("Error fetching quizzes:", error);
        return [];
      }
    },
    enabled: mode === "list",
  });

  const handleInputChange = (field: keyof QuizComponentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const adjustCount = (field: "aggressiveCount" | "happyCount" | "confusedCount", delta: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: Math.max(0, prev[field] + delta)
    }));
  };

  const getStudentConfig = (studentKey: string) => {
    return formData.studentConfigs[studentKey] || { crowdedness: 3, intensity: 3 };
  };

  const handleStudentConfigChange = (
    studentKey: string,
    field: "crowdedness" | "intensity",
    value: number
  ) => {
    setFormData(prev => ({
      ...prev,
      studentConfigs: {
        ...prev.studentConfigs,
        [studentKey]: {
          ...getStudentConfig(studentKey),
          [field]: value
        }
      }
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!formData.classId) {
      newErrors.classId = "Class is required";
    }

    if (formData.timeLimit < 1 || formData.timeLimit > 120) {
      newErrors.timeLimit = "Time limit must be between 1 and 120 minutes";
    }
    
    const totalStudents = formData.aggressiveCount + formData.happyCount + formData.confusedCount;
    if (totalStudents === 0) {
      newErrors.studentCount = "At least one student must be added to the quiz";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setEditingQuizId(null);
    setErrors({});
  };

  const handleEditQuizClick = (quizId: string) => {
    const quizToEdit = quizzes.find((q: any) => q.id === quizId);
    if (quizToEdit) {
      setEditingQuizId(quizToEdit.id);

      const newStudentConfigs: Record<string, { crowdedness: number; intensity: number }> = {};
      quizToEdit.studentInteractions.aggressive?.forEach((config: any, i: number) => {
        newStudentConfigs[`aggressive-${i}`] = config;
      });
      quizToEdit.studentInteractions.happy?.forEach((config: any, i: number) => {
        newStudentConfigs[`happy-${i}`] = config;
      });
      quizToEdit.studentInteractions.confused?.forEach((config: any, i: number) => {
        newStudentConfigs[`confused-${i}`] = config;
      });
      
      setFormData({
        title: quizToEdit.title,
        classId: quizToEdit.classId,
        timeLimit: quizToEdit.timeLimit,
        documentId: quizToEdit.documentId ? quizToEdit.documentId : "none",
        aggressiveCount: quizToEdit.studentInteractions.aggressive?.length || 0,
        happyCount: quizToEdit.studentInteractions.happy?.length || 0,
        confusedCount: quizToEdit.studentInteractions.confused?.length || 0,
        studentConfigs: newStudentConfigs,
        cardOrder: [],
      });
      setErrors({});
    }
  };
  
  const handleCancelEdit = () => {
    resetFormAndState();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      if (errors.studentCount) {
        toast.error(errors.studentCount);
      } else {
        toast.error("Please fill in all required fields");
      }
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const studentInteractionsData = {
        aggressive: Array.from({ length: formData.aggressiveCount }, (_, i) => {
          const config = getStudentConfig(`aggressive-${i}`);
          return {
            crowdedness: config.crowdedness,
            intensity: config.intensity
          };
        }),
        happy: Array.from({ length: formData.happyCount }, (_, i) => {
          const config = getStudentConfig(`happy-${i}`);
          return {
            crowdedness: config.crowdedness,
            intensity: config.intensity
          };
        }),
        confused: Array.from({ length: formData.confusedCount }, (_, i) => {
          const config = getStudentConfig(`confused-${i}`);
          return {
            crowdedness: config.crowdedness,
            intensity: config.intensity
          };
        })
      };

      const payload: MutationQuizFormData = {
        title: formData.title,
        classId: formData.classId,
        timeLimit: formData.timeLimit,
        documentId: formData.documentId === "none" ? null : formData.documentId,
        studentInteractions: studentInteractionsData
      };

      let result;
      if (editingQuizId) {
        result = await updateQuiz(editingQuizId, payload);
      } else {
        result = await createQuiz(payload);
      }
      
      if (result.success) {
        resetFormAndState();
        queryClient.invalidateQueries({ queryKey: ["quizzes"] });
        toast.success(editingQuizId ? "Quiz updated successfully!" : "Quiz created successfully!");
      } else {
        toast.error(`Failed to ${editingQuizId ? 'update' : 'create'} quiz: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Failed to ${editingQuizId ? 'update' : 'create'} quiz: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error(`Error ${editingQuizId ? 'updating' : 'creating'} quiz:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!quizToDelete) return;

    try {
      setIsDeleting(true);
      toast.loading("Deleting quiz...");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/quiz/${quizToDelete}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete quiz: ${response.status} ${response.statusText}`);
      }

      // Refresh the quiz list
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      
      toast.dismiss();
      toast.success("Quiz deleted successfully");
      setShowDeleteDialog(false);
      setQuizToDelete(null);
    } catch (error) {
      console.error("Error deleting quiz:", error);
      toast.dismiss();
      toast.error(
        `Failed to delete quiz: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Update card order when counts change
  useEffect(() => {
    const newCards: StudentCard[] = [];
    
    // Create cards for each type
    for (let i = 0; i < formData.aggressiveCount; i++) {
      const config = getStudentConfig(`aggressive-${i}`);
      newCards.push({
        id: `aggressive-${i}`,
        type: "aggressive",
        index: i,
        crowdedness: config.crowdedness,
        intensity: config.intensity,
      });
    }
    
    for (let i = 0; i < formData.happyCount; i++) {
      const config = getStudentConfig(`happy-${i}`);
      newCards.push({
        id: `happy-${i}`,
        type: "happy",
        index: i,
        crowdedness: config.crowdedness,
        intensity: config.intensity,
      });
    }
    
    for (let i = 0; i < formData.confusedCount; i++) {
      const config = getStudentConfig(`confused-${i}`);
      newCards.push({
        id: `confused-${i}`,
        type: "confused",
        index: i,
        crowdedness: config.crowdedness,
        intensity: config.intensity,
      });
    }

    // Only update if the cards have actually changed
    if (JSON.stringify(newCards) !== JSON.stringify(formData.cardOrder)) {
      setFormData(prev => ({ ...prev, cardOrder: newCards }));
    }
  }, [formData.aggressiveCount, formData.happyCount, formData.confusedCount]);

  const randomizeCards = () => {
    const shuffled = [...formData.cardOrder].sort(() => Math.random() - 0.5);
    setFormData(prev => ({ ...prev, cardOrder: shuffled }));
    toast.success("Cards randomized!");
  };

  const [draggedCard, setDraggedCard] = useState<StudentCard | null>(null);

  const handleDragStart = (e: React.DragEvent, card: StudentCard) => {
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetCard: StudentCard) => {
    e.preventDefault();
    
    if (!draggedCard) return;

    const newOrder = [...formData.cardOrder];
    const draggedIndex = newOrder.findIndex(card => card.id === draggedCard.id);
    const targetIndex = newOrder.findIndex(card => card.id === targetCard.id);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Remove dragged card and insert at target position
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed);
      
      setFormData(prev => ({ ...prev, cardOrder: newOrder }));
    }
    
    setDraggedCard(null);
  };

  const handleCardConfigChange = (
    cardId: string,
    field: "crowdedness" | "intensity",
    value: number
  ) => {
    // Update in studentConfigs
    setFormData(prev => ({
      ...prev,
      studentConfigs: {
        ...prev.studentConfigs,
        [cardId]: {
          ...getStudentConfig(cardId),
          [field]: value
        }
      }
    }));

    // Update in cardOrder
    setFormData(prev => ({
      ...prev,
      cardOrder: prev.cardOrder.map(card => 
        card.id === cardId ? { ...card, [field]: value } : card
      )
    }));
  };

  // Render student interaction cards
  const renderDraggableCards = () => {
    if (formData.cardOrder.length === 0) {
      return (
        <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
          <div>
            <p className="text-red-500 font-medium mb-1">No students added yet</p>
            <p className="text-sm">You must add at least one student to create a quiz</p>
          </div>
        </div>
      );
    }

    const typeConfig = {
      aggressive: {
        icon: <Zap className="h-3 w-3 text-red-500" />,
        color: "border-red-200",
        intensityLabel: "Anger (low-high)",
        intensityScale: ["Annoyed", "Frustrated", "Angry", "Furious", "Rage"],
        intensityColor: "red"
      },
      happy: {
        icon: <Smile className="h-3 w-3 text-green-500" />,
        color: "border-green-200",
        intensityLabel: "Happiness (low-high)", 
        intensityScale: ["Content", "Happy", "Cheerful", "Excited", "Ecstatic"],
        intensityColor: "green"
      },
      confused: {
        icon: <HelpCircle className="h-3 w-3 text-yellow-500" />,
        color: "border-yellow-200",
        intensityLabel: "Confusion (low-high)",
        intensityScale: ["Puzzled", "Confused", "Lost", "Bewildered", "Baffled"],
        intensityColor: "yellow"
      }
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {formData.cardOrder.map((card, globalIndex) => {
          const config = typeConfig[card.type];
          
          return (
            <Card 
              key={card.id} 
              className={`${config.color} p-2 cursor-move hover:shadow-md transition-all ${
                draggedCard?.id === card.id ? 'opacity-50' : ''
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, card)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, card)}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {config.icon}
                    <span className="text-xs font-medium capitalize">
                      {card.type} {card.index + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">#{globalIndex + 1}</span>
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
                
                {/* Crowdedness Control */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Crowdedness (low-high):</span>
                    <span className="text-xs">
                      {card.crowdedness === 1 ? "Empty" : 
                       card.crowdedness === 2 ? "Sparse" :
                       card.crowdedness === 3 ? "Moderate" :
                       card.crowdedness === 4 ? "Busy" : "Crowded"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button
                        key={level}
                        type="button"
                        className={`w-4 h-4 rounded-full border-2 transition-all ${
                          level === card.crowdedness 
                            ? 'bg-blue-500 border-blue-500' 
                            : 'border-gray-300 hover:border-blue-300'
                        }`}
                        onClick={() => handleCardConfigChange(card.id, 'crowdedness', level)}
                      />
                    ))}
                  </div>
                </div>

                {/* Intensity Control */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{config.intensityLabel}:</span>
                    <span className="text-xs">{config.intensityScale[card.intensity - 1]}</span>
                  </div>
                  <div className="flex justify-between">
                    {[1, 2, 3, 4, 5].map(level => (
                      <button
                        key={level}
                        type="button"
                        className={`w-4 h-4 rounded-full border-2 transition-all ${
                          level === card.intensity 
                            ? `bg-${config.intensityColor}-500 border-${config.intensityColor}-500` 
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onClick={() => handleCardConfigChange(card.id, 'intensity', level)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  if (mode === "list") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4">
          {quizzes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No quizzes found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first quiz to get started with student assessments.
                </p>
              </CardContent>
            </Card>
          ) : (
            quizzes.map((quiz: any) => (
              <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{quiz.title}</CardTitle>
                      <CardDescription>
                        <Badge variant="outline" className="mr-2">
                          {quiz.classCode}
                        </Badge>
                        <span className="inline-flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          {quiz.timeLimit} minutes
                        </span>
                        <span className="inline-flex items-center text-sm text-muted-foreground ml-4">
                          <Users className="h-4 w-4 mr-1" />
                          {(quiz.studentInteractions?.aggressive?.length || 0) +
                           (quiz.studentInteractions?.happy?.length || 0) +
                           (quiz.studentInteractions?.confused?.length || 0)} students
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditQuizClick(quiz.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQuizToDelete(quiz.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this quiz? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteQuiz}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Create mode - render the full create form
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">
            {editingQuizId ? "Edit Quiz" : "Create Quiz"}
          </h2>
          <p className="text-muted-foreground">
            {editingQuizId ? "Update quiz settings and student configurations" : "Set up a new quiz with AI student interactions"}
          </p>
        </div>
        {editingQuizId && (
          <Button variant="outline" onClick={handleCancelEdit}>
            <X className="h-4 w-4 mr-2" />
            Cancel Edit
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Quiz Information */}
        <Card>
          <CardHeader>
            <CardTitle>Quiz Information</CardTitle>
            <CardDescription>
              Basic details about your quiz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Quiz Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Enter quiz title"
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Select
                  value={formData.classId}
                  onValueChange={(value) => handleInputChange("classId", value)}
                >
                  <SelectTrigger className={errors.classId ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.classCode} - {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.classId && (
                  <p className="text-sm text-destructive">{errors.classId}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  min="1"
                  max="120"
                  value={formData.timeLimit}
                  onChange={(e) => handleInputChange("timeLimit", parseInt(e.target.value) || 0)}
                  className={errors.timeLimit ? "border-destructive" : ""}
                />
                {errors.timeLimit && (
                  <p className="text-sm text-destructive">{errors.timeLimit}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document">Reference Document (Optional)</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.documentId}
                  onValueChange={(value) => handleInputChange("documentId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a document" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No document</SelectItem>
                    {documents.map((doc: any) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.documentId && formData.documentId !== "none" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const doc = documents.find((d: any) => d.id === formData.documentId);
                      if (doc) {
                        setPreviewDocument(doc);
                        setShowDocumentModal(true);
                      }
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Student Configuration</CardTitle>
            <CardDescription>
              Configure the AI students that will participate in this quiz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Student Type Counters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Aggressive Students */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-red-500" />
                  <Label>Aggressive Students</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => adjustCount("aggressiveCount", -1)}
                    disabled={formData.aggressiveCount === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-medium">
                    {formData.aggressiveCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => adjustCount("aggressiveCount", 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Happy Students */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Smile className="h-4 w-4 text-green-500" />
                  <Label>Happy Students</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => adjustCount("happyCount", -1)}
                    disabled={formData.happyCount === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-medium">
                    {formData.happyCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => adjustCount("happyCount", 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Confused Students */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-yellow-500" />
                  <Label>Confused Students</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => adjustCount("confusedCount", -1)}
                    disabled={formData.confusedCount === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-medium">
                    {formData.confusedCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => adjustCount("confusedCount", 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {errors.studentCount && (
              <p className="text-sm text-destructive">{errors.studentCount}</p>
            )}

            {/* Student Interaction Order */}
            {formData.cardOrder.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">Student Interaction Order</h3>
                    <p className="text-sm text-muted-foreground">
                      Drag and drop to reorder students, or click randomize
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={randomizeCards}
                    className="flex items-center gap-2"
                  >
                    <Shuffle className="h-4 w-4" />
                    Randomize
                  </Button>
                </div>
                
                <Separator />
                
                {renderDraggableCards()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {editingQuizId ? "Updating..." : "Creating..."}
              </>
            ) : (
              editingQuizId ? "Update Quiz" : "Create Quiz"
            )}
          </Button>
        </div>
      </form>

      {/* Document Preview Modal */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Document Preview: {previewDocument?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewDocument && (
              <DocumentViewer document={previewDocument} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
