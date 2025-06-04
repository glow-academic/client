/**
 * app/dashboard/rubric/page.tsx
 * Rubric display page showing evaluation criteria
 * @AshokSaravanan222 & @siladiea
 * 12/15/2024
 */
"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Target, Clock, Users, MessageSquare } from "lucide-react";

const rubricData = [
  {
    criterion: "Facilitates student-driven learning",
    shortName: "listen",
    icon: MessageSquare,
    color: "blue",
    ratings: {
      5: "Consistently employs open-ended questions that empower students to discover solutions independently.",
      4: "Regularly uses guided questioning, encouraging student reasoning with occasional prompts.",
      3: "Occasionally guides students with questions but sometimes provides direct answers.",
      2: "Rarely uses questioning techniques, often resorting to hints or partial solutions.",
      1: "Directly provided the answer"
    }
  },
  {
    criterion: "Demonstrates understanding of course objectives",
    shortName: "obj",
    icon: Target,
    color: "green",
    ratings: {
      5: "Clearly articulates course objectives and aligns explanations with learning goals, ensuring conceptual clarity.",
      4: "Explains course objectives accurately and relates examples to key learning outcomes.",
      3: "Provides a basic overview of objectives but with occasional inaccuracies or lack of depth.",
      2: "Demonstrates limited awareness of course goals and offers explanations with minor misconceptions.",
      1: "Didn't know the course material, had to ask students, or clear demonstration of not knowing"
    }
  },
  {
    criterion: "Manages session time effectively",
    shortName: "time",
    icon: Clock,
    color: "amber",
    ratings: {
      5: "Begins and concludes sessions within scheduled times, maximizing productivity and respecting student availability.",
      4: "Generally adheres to time allocations with minor deviations that do not impact session quality.",
      3: "Sometimes exceeds or finishes early, slightly affecting pacing yet maintaining core engagement.",
      2: "Frequently mismanages time, leading to rushed explanations or unnecessary prolongation.",
      1: "Ended the conversation really early, or made it last longer than needed"
    }
  },
  {
    criterion: "Adapts approach to individual student needs",
    shortName: "adapt",
    icon: Users,
    color: "purple",
    ratings: {
      5: "Perfectly adapts approach to diverse student emotional and attitude types",
      4: "Mostly seamlessly adjusted communication and teaching style to effectively engage students across a wide range of emotional",
      3: "Demonstrates thoughtful adjustments to support most student types, maintaining a supportive and responsive demeanor.",
      2: "Shows minimal ability to adjust to varied student behaviors, occasionally missing cues or responding inappropriately.",
      1: "Fails to adapt to different student types, responding uniformly without consideration of individual emotional or behavioral needs."
    }
  }
];

const ratingLabels = {
  5: "Excellent",
  4: "Good", 
  3: "Acceptable",
  2: "Marginal",
  1: "Poor"
};

const ratingColors = {
  5: "bg-green-100 text-green-800 border-green-200",
  4: "bg-blue-100 text-blue-800 border-blue-200",
  3: "bg-yellow-100 text-yellow-800 border-yellow-200",
  2: "bg-orange-100 text-orange-800 border-orange-200",
  1: "bg-red-100 text-red-800 border-red-200"
};

export default function RubricPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Evaluation Rubric</h2>
        <p className="text-muted-foreground">
          Assessment criteria and performance standards for teaching assistant evaluation
        </p>
      </div>

      <div className="space-y-6">
        {rubricData.map((criterion, index) => {
          const IconComponent = criterion.icon;
          return (
            <Card key={index} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    criterion.color === 'blue' ? 'bg-blue-100' :
                    criterion.color === 'green' ? 'bg-green-100' :
                    criterion.color === 'amber' ? 'bg-amber-100' :
                    'bg-purple-100'
                  }`}>
                    <IconComponent className={`h-5 w-5 ${
                      criterion.color === 'blue' ? 'text-blue-600' :
                      criterion.color === 'green' ? 'text-green-600' :
                      criterion.color === 'amber' ? 'text-amber-600' :
                      'text-purple-600'
                    }`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{criterion.criterion}</CardTitle>
                    <CardDescription>
                      Code: <Badge variant="outline">{criterion.shortName}</Badge>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Rating</TableHead>
                      <TableHead className="w-32">Level</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(criterion.ratings)
                      .reverse()
                      .map(([rating, description]) => (
                        <TableRow key={rating}>
                          <TableCell>
                            <Badge className={`font-semibold ${ratingColors[rating as keyof typeof ratingColors]}`}>
                              {rating}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {ratingLabels[rating as keyof typeof ratingLabels]}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm leading-relaxed">
                            {description}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            How to Use This Rubric
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">Rating Scale</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <strong>5 (Excellent):</strong> Exceeds expectations</li>
                <li>• <strong>4 (Good):</strong> Meets expectations well</li>
                <li>• <strong>3 (Acceptable):</strong> Meets basic expectations</li>
                <li>• <strong>2 (Marginal):</strong> Below expectations</li>
                <li>• <strong>1 (Poor):</strong> Significantly below expectations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Evaluation Focus</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Student-centered teaching approach</li>
                <li>• Knowledge of course material</li>
                <li>• Time management skills</li>
                <li>• Adaptability to student needs</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
