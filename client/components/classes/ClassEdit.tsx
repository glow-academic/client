/**
 * ClassEdit.tsx
 * Used to display the edit for the class page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

import { getClass } from "@/utils/queries/classes/get-class";
import ClassForm from "@/components/common/class/ClassForm";

type ClassEditProps = {
  classId: string;
};

export default function ClassEdit({ classId }: ClassEditProps) {
  // Fetch class data
  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(classId),
    enabled: !!classId,
  });

  if (classLoading) {
    return (
      <div className="space-y-6">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Class Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The requested class could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClassForm
      mode="edit"
      classId={classId}
      initialData={{
        name: classData.name || "",
        classCode: classData.classCode || "",
        year: classData.year || new Date().getFullYear(),
        term: classData.term || "fall",
        description: classData.description || "",
      }}
    />
  );
}
