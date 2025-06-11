/**
 * SimulationPicker.tsx
 * Used to pick a certain item as part of the simulation
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

"use client"

import * as React from "react"
import { PopoverProps } from "@radix-ui/react-popover"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { useMutationObserver } from "@/hooks/use-mutation-observer"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Type definitions
export type ModelType = "Agents" | "Documents" | "Scenarios" | "Classes";

export interface Model {
  id: string;
  name: string;
  description: string;
  type: ModelType;
  strengths?: string;
}

interface ScenarioPickerProps extends PopoverProps {
  types: readonly ModelType[]
  models: Model[]
  label?: string
  placeholder?: string
  description?: string
  onSelect?: (model: Model) => void
  selectedModel?: Model
}

export function ScenarioPicker({ 
  models, 
  types, 
  label = "Model",
  placeholder = "Select a model...",
  description = "The model which will generate the completion. Some models are suitable for natural language tasks, others specialize in code. Learn more.",
  onSelect,
  selectedModel: externalSelectedModel,
  ...props 
}: ScenarioPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [internalSelectedModel, setInternalSelectedModel] = React.useState<Model | undefined>(models[0])
  const [peekedModel, setPeekedModel] = React.useState<Model | undefined>(models[0])

  // Use external selectedModel if provided, otherwise use internal state
  const selectedModel = externalSelectedModel || internalSelectedModel

  const handleSelect = (model: Model) => {
    if (!externalSelectedModel) {
      setInternalSelectedModel(model)
    }
    onSelect?.(model)
    setOpen(false)
  }

  return (
    <div className="grid gap-2">
              <HoverCard openDelay={200}>
          <HoverCardTrigger asChild>
            <Label htmlFor="model">{label}</Label>
          </HoverCardTrigger>
          <HoverCardContent
            align="start"
            className="w-[260px] text-sm"
            side="left"
          >
            {description}
          </HoverCardContent>
        </HoverCard>
      <Popover open={open} onOpenChange={setOpen} {...props}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a model"
            className="w-full justify-between"
          >
            {selectedModel ? selectedModel.name : placeholder}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[250px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[280px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">{peekedModel?.name || "No model selected"}</h4>
                <div className="text-sm text-muted-foreground">
                  {peekedModel?.description || "No description available"}
                </div>
                {peekedModel?.strengths ? (
                  <div className="mt-4 grid gap-2">
                    <h5 className="text-sm font-medium leading-none">
                      Strengths
                    </h5>
                    <ul className="text-sm text-muted-foreground">
                      {peekedModel.strengths}
                    </ul>
                  </div>
                ) : null}
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput placeholder="Search Models..." />
                <CommandEmpty>No Models found.</CommandEmpty>
                <HoverCardTrigger />
                {types.map((type) => (
                  <CommandGroup key={type} heading={type}>
                    {models
                      .filter((model) => model.type === type)
                      .map((model) => (
                        <ModelItem
                          key={model.id}
                          model={model}
                          isSelected={selectedModel?.id === model.id}
                          onPeek={(model) => setPeekedModel(model)}
                          onSelect={() => handleSelect(model)}
                        />
                      ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface ModelItemProps {
  model: Model
  isSelected: boolean
  onSelect: () => void
  onPeek: (model: Model) => void
}

function ModelItem({ model, isSelected, onSelect, onPeek }: ModelItemProps) {
  const ref = React.useRef<HTMLDivElement>(null)

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(model)
      }
    })
  })

  return (
    <CommandItem
      key={model.id}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      {model.name}
      <Check
        className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
      />
    </CommandItem>
  )
}
