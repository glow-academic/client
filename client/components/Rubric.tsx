/**
 * Rubric.tsx
 * This is the rubric for the chat assessment.
 * @AshokSaravanan222 & @siladiea
 * 05/19/2025
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Rubric() {
  return (
    <div className="space-y-6 w-full">
      <div className="overflow-auto max-h-[70vh]">
        <Table className="min-w-[800px]">
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead className="bg-primary text-primary-foreground font-semibold w-[120px]">
                Criteria
              </TableHead>
              <TableHead className="bg-primary text-primary-foreground font-semibold">
                Excellent (5)
              </TableHead>
              <TableHead className="bg-primary text-primary-foreground font-semibold">
                Good (4)
              </TableHead>
              <TableHead className="bg-primary text-primary-foreground font-semibold">
                Acceptable (3)
              </TableHead>
              <TableHead className="bg-primary text-primary-foreground font-semibold">
                Marginal (2)
              </TableHead>
              <TableHead className="bg-primary text-primary-foreground font-semibold">
                Poor (1)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Active Listening</TableCell>
              <TableCell className="whitespace-normal text-xs">
                Consistently employs open-ended questions that empower students
                to discover solutions independently.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Regularly uses guided questioning, encouraging student reasoning
                with occasional prompts.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Occasionally guides students with questions but sometimes
                provides direct answers.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Rarely uses questioning techniques, often resorting to hints or
                partial solutions.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Directly provided the answer
              </TableCell>
            </TableRow>
            <TableRow className="bg-secondary/20">
              <TableCell className="font-medium">Course Objectives</TableCell>
              <TableCell className="whitespace-normal text-xs">
                Clearly articulates course objectives and aligns explanations
                with learning goals, ensuring conceptual clarity.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Explains course objectives accurately and relates examples to
                key learning outcomes.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Provides a basic overview of objectives but with occasional
                inaccuracies or lack of depth.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Demonstrates limited awareness of course goals and offers
                explanations with minor misconceptions.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Didn't know the course material, had to ask students, or clear
                demonstration of not knowing
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Time Management</TableCell>
              <TableCell className="whitespace-normal text-xs">
                Begins and concludes sessions within scheduled times, maximizing
                productivity and respecting student availability.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Generally adheres to time allocations with minor deviations that
                do not impact session quality.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Sometimes exceeds or finishes early, slightly affecting pacing
                yet maintaining core engagement.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Frequently mismanages time, leading to rushed explanations or
                unnecessary prolongation.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Ended the conversation really early, or made it last longer than
                needed
              </TableCell>
            </TableRow>
            <TableRow className="bg-secondary/20">
              <TableCell className="font-medium">Adaptability</TableCell>
              <TableCell className="whitespace-normal text-xs">
                Perfectly adapts approach to diverse student emotional and
                attitude types
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Mostly seamlessly adjusted communication and teaching style to
                effectively engage students across a wide range of emotional
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Demonstrates thoughtful adjustments to support most student
                types, maintaining a supportive and responsive demeanor.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Shows minimal ability to adjust to varied student behaviors,
                occasionally missing cues or responding inappropriately.
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                Fails to adapt to different student types, responding uniformly
                without consideration of individual emotional or behavioral
                needs.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Scoring System</h4>
        <p className="text-sm mb-2">
          Your interactions with each student type are scored based on the
          criteria above:
        </p>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>
            <span className="font-medium">Pass:</span> Score of 17-20 points
            (85%+)
          </li>
          <li>
            <span className="font-medium">Fail:</span> Score below 17 points
          </li>
          <li>
            Each interaction must score at least 3 points in every criterion to
            pass
          </li>
        </ul>
      </div>
    </div>
  );
}
