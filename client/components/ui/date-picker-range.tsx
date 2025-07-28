"use client";

import { format, isBefore, subMonths } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

  // Sync local state with prop changes
  React.useEffect(() => {
    if (dateRange) {
      setLocalDateRange(dateRange);
    }
  }, [dateRange]);

  // Set default date range on initial mount if using external state - disabled to prevent auto filter
  // React.useEffect(() => {
  //   if (setDateRange && !dateRange) {
  //     setDateRange(getDefaultDateRange())
  //   }
  // }, [setDateRange, dateRange])

  const handleDateChange = (incoming: DateRange | undefined) => {
    if (!incoming?.from) {
      return;
    }

    const base = dateRange ?? localDateRange;
    let next: DateRange | undefined = incoming;

    // Check if we need to extend the range backwards
    if (
      !incoming.to && // DayPicker reset the range (no end date)
      base?.from &&
      base?.to && // We had a complete range
      isBefore(incoming.from, base.from) // New date is before current start
    ) {
      next = { from: incoming.from, to: base.to };
    }

    // Update state
    if (setDateRange) {
      setDateRange(next);
    } else {
      setLocalDateRange(next);
    }
  };

  const displayRange = dateRange || localDateRange;

  // Calculate the best default month to show - prioritize the start date if it exists
  const getDefaultMonth = () => {
    if (displayRange?.from) {
      return displayRange.from;
    }
    if (displayRange?.to) {
      return displayRange.to;
    }
    return new Date();
  };

  return (
    <div className={cn("flex", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"secondary"}
            size="sm"
            className={cn(
              "justify-start text-left font-normal h-8",
              !displayRange && "text-muted-foreground"
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
            defaultMonth={getDefaultMonth()}
            selected={displayRange}
            onSelect={handleDateChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
