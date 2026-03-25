"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

interface NewArtifactButtonProps {
  label: string;
  href: string;
}

export function NewArtifactButton({ label, href }: NewArtifactButtonProps) {
  return (
    <Button asChild size="sm">
      <Link href={href}>
        <Plus className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
