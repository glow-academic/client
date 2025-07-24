/**
 * ScenarioAttributePicker.tsx
 * Component for selecting which scenario attribute to analyze in the performance breakdown
 * @AshokSaravanan222
 * 07/23/2025
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Filter } from "lucide-react";

export type ScenarioAttributeType =
  | "classes"
  | "locations"
  | "deadlines"
  | "times";

export interface ScenarioAttributePickerProps {
  selectedAttribute: ScenarioAttributeType;
  onAttributeChange: (attribute: ScenarioAttributeType) => void;
}

const attributeOptions: {
  value: ScenarioAttributeType;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "classes",
    label: "Classes",
    icon: "👨‍🏫",
    description: "Analyze performance by class/course",
  },
  {
    value: "locations",
    label: "Locations",
    icon: "📍",
    description: "Analyze performance by location",
  },
  {
    value: "deadlines",
    label: "Deadlines",
    icon: "⏰",
    description: "Analyze performance by deadline urgency",
  },
  {
    value: "times",
    label: "Times",
    icon: "🕐",
    description: "Analyze performance by time of day",
  },
];

export default function ScenarioAttributePicker({
  selectedAttribute,
  onAttributeChange,
}: ScenarioAttributePickerProps) {
  const selectedOption = attributeOptions.find(
    (option) => option.value === selectedAttribute
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Filter className="h-4 w-4 mr-2" />
          {selectedOption?.icon} {selectedOption?.label}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {attributeOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onAttributeChange(option.value)}
            className="flex items-start gap-3 p-3 cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="text-lg">{option.icon}</span>
              <div className="flex flex-col">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
            </div>
            {selectedAttribute === option.value && (
              <div className="w-2 h-2 bg-primary rounded-full" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
