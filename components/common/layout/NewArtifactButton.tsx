"use client";

import { Button } from "@/components/ui/button";
import { HoverPrefetchLink } from "@/components/common/HoverPrefetchLink";
import { Plus } from "lucide-react";

interface NewArtifactButtonProps {
  label: string;
  href: string;
}

export function NewArtifactButton({ label, href }: NewArtifactButtonProps) {
  return (
    <Button asChild size="sm">
      <HoverPrefetchLink href={href}>
        <Plus className="h-4 w-4" />
        {label}
      </HoverPrefetchLink>
    </Button>
  );
}
