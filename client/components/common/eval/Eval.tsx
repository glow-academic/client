/**
 * Eval.tsx
 * Used to create and manage evaluations - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

interface EvalProps {
    evalId?: string;
    mode?: "create" | "edit";
}

export default function Eval({
    evalId,
    mode = evalId ? "edit" : "create",
}: EvalProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const isEditMode = mode === "edit" && !!evalId;

    return (
        <div>Eval</div>
    )
}