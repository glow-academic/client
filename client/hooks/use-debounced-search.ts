import { useEffect, useState } from "react";

/**
 * Hook for debouncing search input before updating URL params
 * @param searchTerm - Current search term value
 * @param setSearchTerm - Function to update search term
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 * @returns Debounced search term
 */
export function useDebouncedSearch(
  searchTerm: string | null,
  setSearchTerm: (term: string | null) => void,
  delay: number = 300
): string | null {
  const [debouncedTerm, setDebouncedTerm] = useState<string | null>(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      // Update URL param after debounce
      setSearchTerm(searchTerm);
    }, delay);

    return () => clearTimeout(timer);
  }, [searchTerm, delay, setSearchTerm]);

  return debouncedTerm;
}
