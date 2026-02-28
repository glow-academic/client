"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const RIGHT_PANEL_WIDTH = "24rem";
const RIGHT_PANEL_WIDTH_MOBILE = "100vw";

type RightPanelContextProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  togglePanel: () => void;
  isMobile: boolean;
};

const RightPanelContext = React.createContext<RightPanelContextProps | null>(
  null,
);

function useRightPanel() {
  const context = React.useContext(RightPanelContext);
  if (!context) {
    throw new Error("useRightPanel must be used within a RightPanelProvider.");
  }
  return context;
}

function RightPanelProvider({
  defaultOpen = false,
  children,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
}) {
  const isMobile = useIsMobile();
  const [open, _setOpen] = React.useState(defaultOpen);

  const setOpen = React.useCallback((value: boolean) => {
    _setOpen(value);
  }, []);

  const togglePanel = React.useCallback(() => {
    _setOpen((prev) => !prev);
  }, []);

  const contextValue = React.useMemo<RightPanelContextProps>(
    () => ({ open, setOpen, togglePanel, isMobile }),
    [open, setOpen, togglePanel, isMobile],
  );

  return (
    <RightPanelContext.Provider value={contextValue}>
      <div
        data-slot="right-panel-wrapper"
        style={
          {
            "--right-panel-width": RIGHT_PANEL_WIDTH,
            ...style,
          } as React.CSSProperties
        }
        className={cn("relative", className)}
        {...props}
      >
        {children}
      </div>
    </RightPanelContext.Provider>
  );
}

function RightPanel({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { open, setOpen, isMobile } = useRightPanel();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          data-slot="right-panel"
          className="w-full p-0 [&>button]:hidden"
          style={
            {
              "--right-panel-width": RIGHT_PANEL_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side="right"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>AI Panel</SheetTitle>
            <SheetDescription>AI generation panel.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      data-slot="right-panel"
      data-state={open ? "open" : "closed"}
      className={cn(
        "border-l bg-background fixed inset-y-0 right-0 z-10 hidden h-svh w-(--right-panel-width) flex-col transition-[right] duration-200 ease-linear md:flex",
        open
          ? "right-0"
          : "right-[calc(var(--right-panel-width)*-1)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function RightPanelTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { togglePanel } = useRightPanel();

  return (
    <Button
      data-slot="right-panel-trigger"
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      onClick={(event) => {
        onClick?.(event);
        togglePanel();
      }}
      {...props}
    >
      <Sparkles className="size-4" />
      <span className="sr-only">Toggle AI Panel</span>
    </Button>
  );
}

export {
  RightPanel,
  RightPanelProvider,
  RightPanelTrigger,
  useRightPanel,
};
