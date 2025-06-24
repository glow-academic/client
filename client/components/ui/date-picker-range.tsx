"use client";

import * as React from "react";
import { format, subMonths } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Default date range for the past month
const getDefaultDateRange = (): DateRange => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const lastMonth = subMonths(today, 1);
  lastMonth.setHours(0, 0, 0, 0);
  return {
    from: lastMonth,
    to: today,
  };
};

export function DatePickerWithRange({
  className,
  dateRange,
  setDateRange,
}: React.HTMLAttributes<HTMLDivElement> & {
  dateRange?: DateRange | undefined;
  setDateRange?: (date: DateRange | undefined) => void;
}) {
  // Initialize with default date range if none provided
  const [localDateRange, setLocalDateRange] = React.useState<
    DateRange | undefined
  >(dateRange || getDefaultDateRange());

  // Set default date range on initial mount if using external state - disabled to prevent auto filter
  // React.useEffect(() => {
  //   if (setDateRange && !dateRange) {
  //     setDateRange(getDefaultDateRange())
  //   }
  // }, [setDateRange, dateRange])

  const handleDateChange = (range: DateRange | undefined) => {
    if (setDateRange) {
      setDateRange(range);
    } else {
      setLocalDateRange(range);
    }
  };

  const displayRange = dateRange || localDateRange;

  return (
    <div className={cn("flex", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            size="sm"
            className={cn(
              "justify-start text-left font-normal h-8",
              !displayRange && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayRange?.from ? (
              displayRange.to ? (
                <>
                  {format(displayRange.from, "LLL dd, y")} -{" "}
                  {format(displayRange.to, "LLL dd, y")}
                </>
              ) : (
                format(displayRange.from, "LLL dd, y")
              )
            ) : (
              <span>Filter by date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={displayRange?.from || new Date()}
            selected={displayRange}
            onSelect={handleDateChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
