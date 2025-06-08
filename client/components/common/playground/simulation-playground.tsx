"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { 
  Plus, 
  Trash2, 
  Play, 
  Save, 
  Settings, 
  Users, 
  FileText, 
  Timer, 
  Sparkles,
  ChevronDown,
  GripVertical,
  Eye,
  Copy
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"

// Import existing playground components
import { ModelSelector } from "./model-selector"
import { TemperatureSelector } from "./temperature-selector"
import { TopPSelector } from "./top-p-selector"
import { MaxLengthSelector } from "./maxlength-selector"
import { PresetSelector } from "./preset-selector"
import { PresetSave } from "./preset-save"
import { PresetShare } from "./preset-share"
import { CodeViewer } from "./code-viewer"

// Import data and queries
import { models, types } from "./data/models"
import { getAgents } from "@/utils/queries/get-agents"
import { getScenarios } from "@/utils/queries/get-scenarios"
import { createSimulation } from "@/utils/mutations/create-simulation"
import { createAgent } from "@/utils/mutations/create-agent"
import { createScenario } from "@/utils/mutations/create-scenario"

// Types
interface AgentProfile {
  id?: string
  name: string
  subtitle: string
  description: string
  prompt: string
  threshold: number
  isNew?: boolean
}

interface ScenarioConfig {
  id?: string
  title: string
  description: string
  context: string
  difficulty: "easy" | "medium" | "hard"
  isNew?: boolean
}

interface InteractionConfig {
  id: string
  agentId: string
  scenarioId?: string
  crowdedness: number
  intensity: number
  seniority: "freshman" | "sophomore" | "junior" | "senior"
  isNew?: boolean
}

interface SimulationConfig {
  title: string
  description: string
  timeLimit: number | null
  maxParticipants: number
  documents: string[]
  interactions: InteractionConfig[]
  active: boolean
}

// Preset configurations
const AGENT_PRESETS = [
  {
    name: "Aggressive Student",
    subtitle: "Direct and Challenging",
    description: "Pushes back on ideas and challenges assumptions",
    prompt: "You are an aggressive student who challenges ideas directly. Use caps for emphasis and multiple exclamation points when frustrated.",
    threshold: 50,
  },
  {
    name: "Confused Student", 
    subtitle: "Seeks Understanding",
    description: "Asks many clarifying questions and needs detailed explanations",
    prompt: "You are a confused student who has fundamental misunderstandings. Ask lots of questions and express confusion clearly.",
    threshold: 30,
  },
  {
    name: "Happy Student",
    subtitle: "Positive and Engaged",
    description: "Enthusiastic and encouraging in discussions",
    prompt: "You are an enthusiastic student who is positive and encouraging. Keep conversations natural and engaging.",
    threshold: 70,
  },
]

const SCENARIO_PRESETS = [
  {
    title: "Office Hours Help",
    description: "Student seeking help during office hours",
    context: "You are in office hours with 5 other students waiting. The student approaches with a specific question about homework.",
    difficulty: "medium" as const,
  },
  {
    title: "Exam Review Session",
    description: "Group review session before major exam",
    context: "Large review session with 20+ students. High energy, lots of questions, time pressure.",
    difficulty: "hard" as const,
  },
  {
    title: "Lab Assistance",
    description: "One-on-one help during lab session",
    context: "Quiet lab environment, student working on programming assignment, needs debugging help.",
    difficulty: "easy" as const,
  },
]

export function SimulationPlayground() {
  const queryClient = useQueryClient()
  
  // State management
  const [activeTab, setActiveTab] = useState("agents")
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([])
  const [scenarioConfigs, setScenarioConfigs] = useState<ScenarioConfig[]>([])
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>({
    title: "",
    description: "",
    timeLimit: 15,
    maxParticipants: 1,
    documents: [],
    interactions: [],
    active: true,
  })
  
  const [isCreating, setIsCreating] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  // Queries
  const { data: existingAgents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: getAgents,
  })

  const { data: existingScenarios = [] } = useQuery({
    queryKey: ["scenarios"], 
    queryFn: getScenarios,
  })

  // Agent management functions
  const addAgentProfile = (preset?: typeof AGENT_PRESETS[0]) => {
    const newAgent: AgentProfile = preset ? {
      ...preset,
      id: `temp-${Date.now()}`,
      isNew: true,
    } : {
      id: `temp-${Date.now()}`,
      name: "",
      subtitle: "",
      description: "",
      prompt: "",
      threshold: 50,
      isNew: true,
    }
    setAgentProfiles(prev => [...prev, newAgent])
  }

  const updateAgentProfile = (index: number, field: keyof AgentProfile, value: any) => {
    setAgentProfiles(prev => prev.map((agent, i) => 
      i === index ? { ...agent, [field]: value } : agent
    ))
  }

  const removeAgentProfile = (index: number) => {
    setAgentProfiles(prev => prev.filter((_, i) => i !== index))
  }

  // Scenario management functions
  const addScenarioConfig = (preset?: typeof SCENARIO_PRESETS[0]) => {
    const newScenario: ScenarioConfig = preset ? {
      ...preset,
      id: `temp-${Date.now()}`,
      isNew: true,
    } : {
      id: `temp-${Date.now()}`,
      title: "",
      description: "",
      context: "",
      difficulty: "medium",
      isNew: true,
    }
    setScenarioConfigs(prev => [...prev, newScenario])
  }

  const updateScenarioConfig = (index: number, field: keyof ScenarioConfig, value: any) => {
    setScenarioConfigs(prev => prev.map((scenario, i) => 
      i === index ? { ...scenario, [field]: value } : scenario
    ))
  }

  const removeScenarioConfig = (index: number) => {
    setScenarioConfigs(prev => prev.filter((_, i) => i !== index))
  }

  // Interaction management
  const addInteraction = () => {
    if (agentProfiles.length === 0) {
      toast.error("Please create at least one agent profile first")
      return
    }

    const newInteraction: InteractionConfig = {
      id: `temp-${Date.now()}`,
      agentId: agentProfiles[0].id || "",
      scenarioId: scenarioConfigs[0]?.id,
      crowdedness: 3,
      intensity: 3,
      seniority: "sophomore",
      isNew: true,
    }

    setSimulationConfig(prev => ({
      ...prev,
      interactions: [...prev.interactions, newInteraction]
    }))
  }

  const updateInteraction = (index: number, field: keyof InteractionConfig, value: any) => {
    setSimulationConfig(prev => ({
      ...prev,
      interactions: prev.interactions.map((interaction, i) => 
        i === index ? { ...interaction, [field]: value } : interaction
      )
    }))
  }

  const removeInteraction = (index: number) => {
    setSimulationConfig(prev => ({
      ...prev,
      interactions: prev.interactions.filter((_, i) => i !== index)
    }))
  }

  // Create simulation
  const handleCreateSimulation = async () => {
    if (!simulationConfig.title.trim()) {
      toast.error("Please enter a simulation title")
      return
    }

    if (simulationConfig.interactions.length === 0) {
      toast.error("Please add at least one interaction")
      return
    }

    setIsCreating(true)
    try {
      // First create new agents
      const createdAgents = []
      for (const agent of agentProfiles.filter(a => a.isNew)) {
        const result = await createAgent({
          name: agent.name,
          subtitle: agent.subtitle,
          description: agent.description,
          prompt: agent.prompt,
          threshold: agent.threshold,
        })
        if (result.success) {
          createdAgents.push({ tempId: agent.id, realId: result.data.id })
        }
      }

      // Then create new scenarios
      const createdScenarios: { tempId: string; realId: string }[] = []
      for (const scenario of scenarioConfigs.filter(s => s.isNew)) {
        const result = await createScenario({
          title: scenario.title,
          description: scenario.description,
          context: scenario.context,
          difficulty: scenario.difficulty,
        })
        if (result.success) {
          createdScenarios.push({ tempId: scenario.id, realId: result.data?.id || "" })
        }
      }

      // Update interaction IDs with real IDs
      const updatedInteractions = simulationConfig.interactions.map(interaction => ({
        ...interaction,
        agentId: createdAgents.find(a => a.tempId === interaction.agentId)?.realId || interaction.agentId,
        scenarioId: interaction.scenarioId ? 
          createdScenarios.find(s => s.tempId === interaction.scenarioId)?.realId || interaction.scenarioId :
          undefined
      }))

      // Finally create the simulation
      const simulationResult = await createSimulation({
        title: simulationConfig.title,
        description: simulationConfig.description,
        timeLimit: simulationConfig.timeLimit,
        documents: simulationConfig.documents,
        interactions: updatedInteractions,
        active: simulationConfig.active,
      })

      if (simulationResult.success) {
        toast.success("Simulation created successfully!")
        // Reset form
        setAgentProfiles([])
        setScenarioConfigs([])
        setSimulationConfig({
          title: "",
          description: "",
          timeLimit: 15,
          maxParticipants: 1,
          documents: [],
          interactions: [],
          active: true,
        })
        queryClient.invalidateQueries({ queryKey: ["simulations"] })
      } else {
        toast.error(simulationResult.error || "Failed to create simulation")
      }
    } catch (error) {
      console.error("Error creating simulation:", error)
      toast.error("An error occurred while creating the simulation")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="container flex flex-col items-start justify-between space-y-2 py-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16">
        <h2 className="text-lg font-semibold">Simulation Playground</h2>
        <div className="ml-auto flex w-full space-x-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? "Edit" : "Preview"}
          </Button>
          <Button
            onClick={handleCreateSimulation}
            disabled={isCreating}
            className="bg-primary text-primary-foreground"
          >
            {isCreating ? (
              <>Creating...</>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Create Simulation
              </>
            )}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Main Content */}
      <div className="flex-1 container py-6">
        <div className="grid h-full gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main Panel */}
          <div className="flex flex-col space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="agents">
                  <Users className="h-4 w-4 mr-2" />
                  Agent Profiles
                </TabsTrigger>
                <TabsTrigger value="scenarios">
                  <FileText className="h-4 w-4 mr-2" />
                  Scenarios
                </TabsTrigger>
                <TabsTrigger value="simulation">
                  <Settings className="h-4 w-4 mr-2" />
                  Simulation
                </TabsTrigger>
              </TabsList>

              {/* Agent Profiles Tab */}
              <TabsContent value="agents" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">Agent Profiles</h3>
                    <p className="text-sm text-muted-foreground">
                      Create AI student personalities for your simulation
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Presets
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium">Agent Presets</h4>
                            <p className="text-sm text-muted-foreground">
                              Quick start with common student personalities
                            </p>
                          </div>
                          <div className="space-y-2">
                            {AGENT_PRESETS.map((preset, index) => (
                              <div
                                key={index}
                                className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => addAgentProfile(preset)}
                              >
                                <div className="font-medium text-sm">{preset.name}</div>
                                <div className="text-xs text-muted-foreground">{preset.subtitle}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button onClick={() => addAgentProfile()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Agent
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {agentProfiles.map((agent, index) => (
                    <Card key={agent.id}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <Input
                              placeholder="Agent name"
                              value={agent.name}
                              onChange={(e) => updateAgentProfile(index, "name", e.target.value)}
                              className="font-medium"
                            />
                            <Input
                              placeholder="Subtitle"
                              value={agent.subtitle}
                              onChange={(e) => updateAgentProfile(index, "subtitle", e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAgentProfile(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Description</Label>
                          <Textarea
                            placeholder="Describe this agent's personality and behavior"
                            value={agent.description}
                            onChange={(e) => updateAgentProfile(index, "description", e.target.value)}
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label>System Prompt</Label>
                          <Textarea
                            placeholder="Instructions for how this agent should behave"
                            value={agent.prompt}
                            onChange={(e) => updateAgentProfile(index, "prompt", e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Response Threshold: {agent.threshold}</Label>
                          <Slider
                            value={[agent.threshold]}
                            onValueChange={([value]) => updateAgentProfile(index, "threshold", value)}
                            max={100}
                            step={1}
                            className="mt-2"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {agentProfiles.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <Users className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground text-center">
                          No agent profiles yet. Add your first agent to get started.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Scenarios Tab */}
              <TabsContent value="scenarios" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">Scenarios</h3>
                    <p className="text-sm text-muted-foreground">
                      Define the context and situations for interactions
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Presets
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-medium">Scenario Presets</h4>
                            <p className="text-sm text-muted-foreground">
                              Common teaching scenarios
                            </p>
                          </div>
                          <div className="space-y-2">
                            {SCENARIO_PRESETS.map((preset, index) => (
                              <div
                                key={index}
                                className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => addScenarioConfig(preset)}
                              >
                                <div className="font-medium text-sm">{preset.title}</div>
                                <div className="text-xs text-muted-foreground">{preset.description}</div>
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {preset.difficulty}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button onClick={() => addScenarioConfig()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Scenario
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {scenarioConfigs.map((scenario, index) => (
                    <Card key={scenario.id}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Scenario title"
                              value={scenario.title}
                              onChange={(e) => updateScenarioConfig(index, "title", e.target.value)}
                              className="font-medium"
                            />
                            <Input
                              placeholder="Brief description"
                              value={scenario.description}
                              onChange={(e) => updateScenarioConfig(index, "description", e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeScenarioConfig(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label>Context & Setting</Label>
                          <Textarea
                            placeholder="Describe the situation, environment, and context for this scenario"
                            value={scenario.context}
                            onChange={(e) => updateScenarioConfig(index, "context", e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Difficulty Level</Label>
                          <Select
                            value={scenario.difficulty}
                            onValueChange={(value: "easy" | "medium" | "hard") => 
                              updateScenarioConfig(index, "difficulty", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {scenarioConfigs.length === 0 && (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground text-center">
                          No scenarios yet. Add your first scenario to get started.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Simulation Tab */}
              <TabsContent value="simulation" className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Simulation Configuration</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure your simulation settings and interactions
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Basic Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Simulation Title</Label>
                        <Input
                          placeholder="Enter simulation title"
                          value={simulationConfig.title}
                          onChange={(e) => setSimulationConfig(prev => ({ ...prev, title: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Describe what this simulation is about"
                          value={simulationConfig.description}
                          onChange={(e) => setSimulationConfig(prev => ({ ...prev, description: e.target.value }))}
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label>Time Limit (minutes)</Label>
                        <Input
                          type="number"
                          placeholder="15"
                          value={simulationConfig.timeLimit || ""}
                          onChange={(e) => setSimulationConfig(prev => ({ 
                            ...prev, 
                            timeLimit: e.target.value ? parseInt(e.target.value) : null 
                          }))}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={simulationConfig.active}
                          onCheckedChange={(checked) => setSimulationConfig(prev => ({ ...prev, active: checked }))}
                        />
                        <Label>Active</Label>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base">Interactions</CardTitle>
                        <Button size="sm" onClick={addInteraction}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {simulationConfig.interactions.map((interaction, index) => (
                          <div key={interaction.id} className="p-3 border rounded-lg space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Interaction {index + 1}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeInteraction(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="grid gap-3">
                              <div>
                                <Label className="text-xs">Agent Profile</Label>
                                <Select
                                  value={interaction.agentId}
                                  onValueChange={(value) => updateInteraction(index, "agentId", value)}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select agent" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {agentProfiles.map((agent) => (
                                      <SelectItem key={agent.id} value={agent.id!}>
                                        {agent.name || "Unnamed Agent"}
                                      </SelectItem>
                                    ))}
                                    {existingAgents.map((agent: any) => (
                                      <SelectItem key={agent.id} value={agent.id}>
                                        {agent.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-xs">Scenario (Optional)</Label>
                                <Select
                                  value={interaction.scenarioId || ""}
                                  onValueChange={(value) => updateInteraction(index, "scenarioId", value || undefined)}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select scenario" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="">No specific scenario</SelectItem>
                                    {scenarioConfigs.map((scenario) => (
                                      <SelectItem key={scenario.id} value={scenario.id!}>
                                        {scenario.title || "Unnamed Scenario"}
                                      </SelectItem>
                                    ))}
                                    {existingScenarios.map((scenario: any) => (
                                      <SelectItem key={scenario.id} value={scenario.id}>
                                        {scenario.title}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">Crowdedness: {interaction.crowdedness}</Label>
                                  <Slider
                                    value={[interaction.crowdedness]}
                                    onValueChange={([value]) => updateInteraction(index, "crowdedness", value)}
                                    max={5}
                                    min={1}
                                    step={1}
                                    className="mt-1"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Intensity: {interaction.intensity}</Label>
                                  <Slider
                                    value={[interaction.intensity]}
                                    onValueChange={([value]) => updateInteraction(index, "intensity", value)}
                                    max={5}
                                    min={1}
                                    step={1}
                                    className="mt-1"
                                  />
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs">Student Level</Label>
                                <Select
                                  value={interaction.seniority}
                                  onValueChange={(value: any) => updateInteraction(index, "seniority", value)}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="freshman">Freshman</SelectItem>
                                    <SelectItem value="sophomore">Sophomore</SelectItem>
                                    <SelectItem value="junior">Junior</SelectItem>
                                    <SelectItem value="senior">Senior</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ))}

                        {simulationConfig.interactions.length === 0 && (
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            No interactions configured. Add an interaction to get started.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuration Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Agent Profiles:</span>
                  <Badge variant="secondary">{agentProfiles.length}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Scenarios:</span>
                  <Badge variant="secondary">{scenarioConfigs.length}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Interactions:</span>
                  <Badge variant="secondary">{simulationConfig.interactions.length}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Time Limit:</span>
                  <span className="text-muted-foreground">
                    {simulationConfig.timeLimit ? `${simulationConfig.timeLimit}m` : "No limit"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate Configuration
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Save className="h-4 w-4 mr-2" />
                  Save as Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 