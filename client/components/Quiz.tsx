/**
 * Quiz.tsx
 * Quiz creation and management for admins
 * 05/28/2023
 */
"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Icons
import {
  Plus,
  Minus,
  Zap,
  SmilePlus,
  HelpCircle,
  FileText,
  Trash2,
  Shuffle,
  GripVertical,
} from "lucide-react";

// Queries and mutations
import { getClasses } from "@/utils/queries/get-classes";
import { getDocuments } from "@/utils/queries/get-documents";
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
  cardOrder: StudentCard[]; // New field for maintaining order
}

interface FormErrors {
  title?: string;
  classId?: string;
  timeLimit?: string;
  documentId?: string;
  studentCount?: string;
}

export default function Quiz() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<"create" | "list">("create");
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
    cardOrder: [], // Initialize empty array
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

  // Fetch quizzes for the list tab
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
          // Ensure studentInteractions is always an object with expected keys
          studentInteractions: quiz.studentInteractions || { aggressive: [], happy: [], confused: [] }
        }));
      } catch (error) {
        console.error("Error fetching quizzes:", error);
        return [];
      }
    },
  });

  const handleInputChange = (field: keyof QuizComponentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
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
    
    // Validate that at least one student is selected
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
    const quizToEdit = quizzes.find(q => q.id === quizId);
    if (quizToEdit) {
      setActiveTab("create");
      setEditingQuizId(quizToEdit.id);

      const newStudentConfigs: Record<string, { crowdedness: number; intensity: number }> = {};
      quizToEdit.studentInteractions.aggressive?.forEach((config, i) => {
        newStudentConfigs[`aggressive-${i}`] = config;
      });
      quizToEdit.studentInteractions.happy?.forEach((config, i) => {
        newStudentConfigs[`happy-${i}`] = config;
      });
      quizToEdit.studentInteractions.confused?.forEach((config, i) => {
        newStudentConfigs[`confused-${i}`] = config;
      });
      
      setFormData({
        title: quizToEdit.title,
        classId: quizToEdit.classId,
        timeLimit: quizToEdit.timeLimit,
        documentId: quizToEdit.documentId ? quizToEdit.documentId : "none", // "none" for Select if null/undefined
        aggressiveCount: quizToEdit.studentInteractions.aggressive?.length || 0,
        happyCount: quizToEdit.studentInteractions.happy?.length || 0,
        confusedCount: quizToEdit.studentInteractions.confused?.length || 0,
        studentConfigs: newStudentConfigs,
        cardOrder: [], // Reset card order on edit
      });
      setErrors({});
    }
  };
  
  const handleCancelEdit = () => {
    resetFormAndState();
    // Optionally switch tab or stay on create tab with a blank form
    // setActiveTab("list"); 
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
        setActiveTab("list");
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
        icon: <SmilePlus className="h-3 w-3 text-green-500" />,
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

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "list")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create Quiz</TabsTrigger>
          <TabsTrigger value="list">Quiz List</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create Quiz</CardTitle>
              <CardDescription>
                Create a new quiz with student interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-10 gap-2">
                  {/* Left column: Basic quiz settings - 3/10 width */}
                  <div className="lg:col-span-3 space-y-4 pr-2">
                    <div>
                      <Label className="text-sm font-medium">Quiz Title</Label>
                      <Input
                        placeholder="Enter quiz title"
                        value={formData.title}
                        onChange={(e) => handleInputChange("title", e.target.value)}
                      />
                      {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Class</Label>
                      <Select
                        value={formData.classId}
                        onValueChange={(value) => handleInputChange("classId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.classCode} - {cls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.classId && <p className="text-sm text-red-500">{errors.classId}</p>}
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Document (Optional)</Label>
                      <div className="flex space-x-2">
                        <Select
                          value={formData.documentId}
                          onValueChange={(value) => handleInputChange("documentId", value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select document (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No document</SelectItem>
                            {documents.map((doc) => (
                              <SelectItem key={doc.id} value={doc.id}>
                                {doc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            if (formData.documentId && formData.documentId !== "none") {
                              const doc = documents.find(d => d.id === formData.documentId);
                              if (doc) {
                                setPreviewDocument(doc);
                                setShowDocumentModal(true);
                              }
                            } else {
                              toast.info("No document selected");
                            }
                          }}
                          disabled={!formData.documentId || formData.documentId === "none"}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                      {errors.documentId && <p className="text-sm text-red-500">{errors.documentId}</p>}
                    </div>

                    {/* Smaller Time Limit Input */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Time Limit</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            min={1}
                            max={120}
                            value={formData.timeLimit}
                            onChange={(e) => handleInputChange("timeLimit", parseInt(e.target.value))}
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">minutes</span>
                        </div>
                        {errors.timeLimit && <p className="text-sm text-red-500">{errors.timeLimit}</p>}
                      </div>
                    </div>

                    {/* Student Type Counters */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">Student Types</h3>
                        {errors.studentCount && (
                          <p className="text-sm text-red-500">{errors.studentCount}</p>
                        )}
                      </div>
                      
                      {/* Aggressive Students */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium">Aggressive</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => adjustCount("aggressiveCount", -1)}
                            disabled={formData.aggressiveCount <= 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{formData.aggressiveCount}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => adjustCount("aggressiveCount", 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Happy Students */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <SmilePlus className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">Happy</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => adjustCount("happyCount", -1)}
                            disabled={formData.happyCount <= 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{formData.happyCount}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => adjustCount("happyCount", 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Confused Students */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium">Confused</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => adjustCount("confusedCount", -1)}
                            disabled={formData.confusedCount <= 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{formData.confusedCount}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => adjustCount("confusedCount", 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vertical separator - minimal space */}
                  <div className="hidden lg:flex lg:col-span-1 justify-center pl-1 pr-1">
                    <Separator orientation="vertical" className="h-full" />
                  </div>

                  {/* Horizontal separator for mobile */}
                  <div className="lg:hidden col-span-full">
                    <Separator className="w-full" />
                  </div>

                  {/* Right column: Student cards - 6/10 width */}
                  <div className="lg:col-span-6 pl-2">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">Student Order</h3>
                        {formData.cardOrder.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={randomizeCards}
                            className="flex items-center gap-2"
                          >
                            <Shuffle className="h-4 w-4" />
                            Randomize
                          </Button>
                        )}
                      </div>
                      
                      <ScrollArea className="h-[600px] pr-4">
                        {renderDraggableCards()}
                      </ScrollArea>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  {editingQuizId && (
                    <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSubmitting}>
                      Cancel
                    </Button>
                  )}
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || (formData.aggressiveCount + formData.happyCount + formData.confusedCount === 0)}
                  >
                    {isSubmitting ? (editingQuizId ? "Saving..." : "Creating...") : (editingQuizId ? "Save Changes" : "Create Quiz")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map((quiz) => {
              // Calculate student counts from studentInteractions
              const interactions = quiz.studentInteractions || { aggressive: [], happy: [], confused: [] };
              const aggressiveCount = interactions.aggressive?.length || 0;
              const happyCount = interactions.happy?.length || 0;
              const confusedCount = interactions.confused?.length || 0;
              const totalStudents = aggressiveCount + happyCount + confusedCount;
              
              return (
                <Card key={quiz.id} className="group hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1" onClick={() => handleEditQuizClick(quiz.id)}>
                        <CardTitle className="text-lg leading-tight">{quiz.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {quiz.className || "Unknown class"}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuizToDelete(quiz.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0" onClick={() => handleEditQuizClick(quiz.id)}>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Time Limit:</span>
                        <span className="font-medium">{quiz.timeLimit} minutes</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Students:</span>
                        <span className="font-medium">{totalStudents}</span>
                      </div>
                      
                      <div className="space-y-2">
                        {aggressiveCount > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="flex items-center">
                              <Zap className="h-3 w-3 text-red-500 mr-1" /> Aggressive:
                            </span>
                            <span>{aggressiveCount}</span>
                          </div>
                        )}
                        {happyCount > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="flex items-center">
                              <SmilePlus className="h-3 w-3 text-green-500 mr-1" /> Happy:
                            </span>
                            <span>{happyCount}</span>
                          </div>
                        )}
                        {confusedCount > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="flex items-center">
                              <HelpCircle className="h-3 w-3 text-yellow-500 mr-1" /> Confused:
                            </span>
                            <span>{confusedCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {quizzes.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center h-64 border rounded-lg border-dashed">
                <h3 className="font-medium text-lg mb-2">No quizzes found</h3>
                <p className="text-muted-foreground mb-4">Create a quiz to get started</p>
                <Button onClick={() => setActiveTab("create")}>Create Quiz</Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quiz</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this quiz? This action cannot be undone and will also delete any quiz attempts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteQuiz} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Quiz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
