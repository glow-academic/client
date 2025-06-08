"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Users, FileText, Settings, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface SimulationSummaryProps {
  title?: string
  description?: string
  showCreateButton?: boolean
}

export function SimulationSummary({ 
  title = "Unified Simulation Creation",
  description = "Create agents, scenarios, and simulations all in one place",
  showCreateButton = true 
}: SimulationSummaryProps) {
  const router = useRouter()

  const handleCreateNew = () => {
    router.push("/create")
  }

  const features = [
    {
      icon: Users,
      title: "Agent Profiles",
      description: "Create AI student personalities with custom behaviors and response patterns",
      badge: "Interactive"
    },
    {
      icon: FileText,
      title: "Scenarios",
      description: "Define teaching contexts and situations for realistic interactions",
      badge: "Contextual"
    },
    {
      icon: Settings,
      title: "Simulations",
      description: "Combine agents and scenarios into complete simulation experiences",
      badge: "Unified"
    }
  ]

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-3 bg-primary/10 rounded-full">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {description}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature, index) => {
          const IconComponent = feature.icon
          return (
            <Card key={index} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {feature.badge}
                  </Badge>
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="text-center space-y-4">
        <div className="p-6 bg-muted/50 rounded-lg border-2 border-dashed">
          <h3 className="font-medium mb-2">Ready to get started?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Our interactive playground makes it easy to create comprehensive simulations
            with just a few clicks. No more switching between separate pages!
          </p>
          {showCreateButton && (
            <Button onClick={handleCreateNew} size="lg" className="bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4 mr-2" />
              Open Simulation Playground
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What's New</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Unified Interface</p>
                <p className="text-xs text-muted-foreground">
                  Create agents, scenarios, and simulations in one place
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Interactive Presets</p>
                <p className="text-xs text-muted-foreground">
                  Quick-start templates for common scenarios
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Real-time Preview</p>
                <p className="text-xs text-muted-foreground">
                  See your configuration as you build it
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <p className="font-medium mb-1">💡 Start with presets</p>
              <p className="text-muted-foreground text-xs">
                Use our built-in templates to quickly create common agent types
              </p>
            </div>
            <div className="text-sm">
              <p className="font-medium mb-1">🎯 Adjust parameters</p>
              <p className="text-muted-foreground text-xs">
                Fine-tune crowdedness and intensity for realistic scenarios
              </p>
            </div>
            <div className="text-sm">
              <p className="font-medium mb-1">🔄 Iterate quickly</p>
              <p className="text-muted-foreground text-xs">
                Make changes and see results immediately in the preview
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 