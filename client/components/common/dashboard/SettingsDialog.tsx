/**
 * SettingsDialog.tsx
 * This component is used to display the settings dialog for the dashboard.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */

import { Dashboard } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Settings } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SettingsDialog({
    dashboardConfig,
    updateSettings,
  }: {
    dashboardConfig: Partial<Dashboard> | null;
    updateSettings: (
      settings: Partial<
        Pick<
          Partial<Dashboard>,
          | "autoScroll"
          | "showIndicators"
          | "headerComponents"
          | "mainSplit"
          | "footerSplit"
        >
      >
    ) => void;
  }) {
    const [localSettings, setLocalSettings] = useState({
      autoScroll: dashboardConfig?.autoScroll ?? true,
      showIndicators: dashboardConfig?.showIndicators ?? true,
      headerComponents: dashboardConfig?.headerComponents ?? 4,
    });
  
    useEffect(() => {
      if (dashboardConfig) {
        setLocalSettings({
          autoScroll: dashboardConfig.autoScroll ?? false,
          showIndicators: dashboardConfig.showIndicators ?? false,
          headerComponents: dashboardConfig.headerComponents ?? 4,
        });
      }
    }, [dashboardConfig]);
  
    const handleApply = () => {
      updateSettings(localSettings);
      toast.success("Settings applied");
    };
  
    return (
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p> Settings</p>
          </TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dashboard Settings</DialogTitle>
          </DialogHeader>
  
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-scroll">Auto Scroll</Label>
              <Switch
                id="auto-scroll"
                checked={localSettings.autoScroll}
                onCheckedChange={(checked) =>
                  setLocalSettings((prev) => ({ ...prev, autoScroll: checked }))
                }
              />
            </div>
  
            <div className="flex items-center justify-between">
              <Label htmlFor="show-indicators">Show Indicators</Label>
              <Switch
                id="show-indicators"
                checked={localSettings.showIndicators}
                onCheckedChange={(checked) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    showIndicators: checked,
                  }))
                }
              />
            </div>
  
            <div className="space-y-2">
              <Label htmlFor="header-components">
                Header Components Shown
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="header-components"
                  min={1}
                  max={8}
                  step={1}
                  value={[localSettings.headerComponents]}
                  onValueChange={([value]) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      headerComponents: value ?? 1,
                    }))
                  }
                  className="flex-1"
                />
                <span className="w-8 text-sm text-muted-foreground">
                  {localSettings.headerComponents}
                </span>
              </div>
            </div>
  
            <Button onClick={handleApply} className="w-full">
              Apply Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }