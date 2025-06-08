"use client";
import React, { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClassDetailsContent } from "@/components/common/admin/class-details-content";
import { getClass } from "@/utils/queries/get-class";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClassDetailsPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);

  // Fetch specific class data
  const { data: classDataArray, isLoading } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(classId),
    enabled: !!classId,
  });

  const classData = React.useMemo(() => {
    return Array.isArray(classDataArray) ? classDataArray[0] : classDataArray;
  }, [classDataArray]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full" />
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
    <div className="space-y-6">
      <ClassDetailsContent classData={{
        id: classData.id,
        classCode: classData.classCode,
        name: classData.name || '',
        description: classData.description || '',
        year: classData.year || new Date().getFullYear(),
        term: classData.term || 'fall',
        simulationIds: classData.simulationIds || [],
      }} />
    </div>
  );
}
