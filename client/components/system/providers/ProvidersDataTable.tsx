"use client";

import { ColumnDef } from "@tanstack/react-table";
import * as React from "react";

import { Model } from "@/types";

export interface ProvidersDataTableProps {
  columns: ColumnDef<Model>[];
  data: Model[];
  providerOptions: { value: string; label: string }[];
  customModelOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  renderModelCard: (model: Model) => React.ReactNode;
}

export function ProvidersDataTable({
  columns: _columns,
  data: _data,
  providerOptions: _providerOptions,
  customModelOptions: _customModelOptions,
  statusOptions: _statusOptions,
  renderModelCard: _renderModelCard,
}: ProvidersDataTableProps) {
  // This component is now deprecated in favor of the integrated approach
  // Keeping it for backward compatibility but it's not used in the new implementation
  return null;
}
