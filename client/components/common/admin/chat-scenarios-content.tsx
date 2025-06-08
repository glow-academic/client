/**
 * components/admin/chat-scenarios-content.tsx
 * Chat Scenarios management component
 */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ChatScenariosContent() {
  const [scenarios, setScenarios] = useState([
    { id: "1", name: "Office Hours", description: "Student seeking help during office hours", difficulty: "Easy" },
    { id: "2", name: "Exam Preparation", description: "Student preparing for upcoming exam", difficulty: "Medium" },
    { id: "3", name: "Project Confusion", description: "Student confused about project requirements", difficulty: "Hard" },
  ]);

  const [showCreateScenario, setShowCreateScenario] = useState(false);
  const [newScenario, setNewScenario] = useState({ name: "", description: "", difficulty: "Easy" });

  const handleCreateScenario = () => {
    const scenario = { ...newScenario, id: Date.now().toString() };
    setScenarios(prev => [...prev, scenario]);
    setShowCreateScenario(false);
    setNewScenario({ name: "", description: "", difficulty: "Easy" });
    toast.success("Scenario created successfully!");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={() => setShowCreateScenario(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Scenario
        </Button>
      </div>

      <div className="grid gap-4">
        {scenarios.map((scenario) => (
          <Card key={scenario.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  <CardDescription>{scenario.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant={scenario.difficulty === "Easy" ? "default" : scenario.difficulty === "Medium" ? "secondary" : "destructive"}>
                    {scenario.difficulty}
                  </Badge>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Create Scenario Dialog */}
      <Dialog open={showCreateScenario} onOpenChange={setShowCreateScenario}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Scenario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scenarioName">Scenario Name</Label>
              <Input
                id="scenarioName"
                value={newScenario.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setNewScenario(prev => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Office Hours"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenarioDescription">Description</Label>
              <Textarea
                id="scenarioDescription"
                value={newScenario.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                  setNewScenario(prev => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe the scenario context"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenarioDifficulty">Difficulty</Label>
              <Select
                value={newScenario.difficulty}
                onValueChange={(value) => setNewScenario(prev => ({ ...prev, difficulty: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateScenario(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateScenario}>
                Create Scenario
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 