import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

export function isMarkdownFile(filename: string): boolean {
  const extension = getFileExtension(filename).toLowerCase();
  return extension === 'md' || extension === 'markdown';
}

export function isTextFile(filename: string): boolean {
  const extension = getFileExtension(filename).toLowerCase();
  return extension === 'txt' || extension === 'text' || isMarkdownFile(filename);
}
