/**
 * ClassEdit.tsx
 * Used to display the edit for the class page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import React from "react";

import ClassForm from "@/components/common/class/ClassForm";

export interface ClassEditProps {
  classId: string;
}

export default function ClassEdit({ classId }: ClassEditProps) {
  return <ClassForm classId={classId} />;
}
