/**
 * Context.tsx
 * Context component showing overview of scenario context items
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import { useQuery } from "@tanstack/react-query";
import { Book, Calendar, Clock, Edit, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  ScenarioClasse,
  ScenarioDeadline,
  ScenarioLocation,
  ScenarioTime,
} from "@/types";
import { getAllScenarioClasses } from "@/utils/queries/scenario_classes/get-all-scenario-classes";
import { getAllScenarioDeadlines } from "@/utils/queries/scenario_deadlines/get-all-scenario-deadlines";
import { getAllScenarioLocations } from "@/utils/queries/scenario_locations/get-all-scenario-locations";
import { getAllScenarioTimes } from "@/utils/queries/scenario_times/get-all-scenario-times";

export default function Context() {
  const router = useRouter();

  // Fetch all context data
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ["scenario-classes"],
    queryFn: () => getAllScenarioClasses(),
  });

  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["scenario-locations"],
    queryFn: () => getAllScenarioLocations(),
  });

  const { data: deadlines = [], isLoading: deadlinesLoading } = useQuery({
    queryKey: ["scenario-deadlines"],
    queryFn: () => getAllScenarioDeadlines(),
  });

  const { data: times = [], isLoading: timesLoading } = useQuery({
    queryKey: ["scenario-times"],
    queryFn: () => getAllScenarioTimes(),
  });

  const formatTime = (timeString: string) => {
    try {
      const time = new Date(`1970-01-01T${timeString}`);
      return time.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return timeString;
    }
  };

  const renderContextCard = <T,>(
    title: string,
    icon: React.ReactNode,
    count: number,
    items: T[],
    editRoute: string,
    isLoading: boolean,
    renderPreview: (items: T[]) => React.ReactNode
  ) => (
    <Card className="relative flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">
                {count} {count === 1 ? "item" : "items"}
              </Badge>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(editRoute)}
            aria-label={`Edit ${title}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet</p>
        ) : (
          renderPreview(items)
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Classes */}
        {renderContextCard<ScenarioClasse>(
          "Classes",
          <Book className="h-5 w-5" />,
          classes.length,
          classes,
          "/management/context/classes",
          classesLoading,
          (items) => (
            <div className="space-y-2">
              {items.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.classCode}
                    </p>
                  </div>
                </div>
              ))}
              {items.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{items.length - 3} more
                </p>
              )}
            </div>
          )
        )}

        {/* Locations */}
        {renderContextCard<ScenarioLocation>(
          "Locations",
          <MapPin className="h-5 w-5" />,
          locations.length,
          locations,
          "/management/context/locations",
          locationsLoading,
          (items) => (
            <div className="space-y-2">
              {items.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
              {items.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{items.length - 3} more
                </p>
              )}
            </div>
          )
        )}

        {/* Deadlines */}
        {renderContextCard<ScenarioDeadline>(
          "Deadlines",
          <Calendar className="h-5 w-5" />,
          deadlines.length,
          deadlines,
          "/management/context/deadlines",
          deadlinesLoading,
          (items) => (
            <div className="space-y-2">
              {items.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium">{item.deadline}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
              {items.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{items.length - 3} more
                </p>
              )}
            </div>
          )
        )}

        {/* Times */}
        {renderContextCard<ScenarioTime>(
          "Times",
          <Clock className="h-5 w-5" />,
          times.length,
          times,
          "/management/context/times",
          timesLoading,
          (items) => (
            <div className="space-y-2">
              {items.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatTime(item.timeOfDay)}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
              {items.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{items.length - 3} more
                </p>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
