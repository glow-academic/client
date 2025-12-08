/**
 * Unit type definitions
 * Extracted from UnitPicker for reuse
 */

export interface UnitItem {
  id: string;
  name: string;
  unit_category: string; // 'tokens' | 'seconds' | 'units'
  value: number;
}

