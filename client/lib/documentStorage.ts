/**
 * Document storage utilities for handling profile-specific documents
 * Includes LocalStorage fallback for development/testing when API is unavailable
 */

export interface StoredDocument {
  id: string;
  name: string;
  content: string; // Base64 encoded content
  mimeType: string;
  profile: string;
  createdAt: string;
}

// LocalStorage key for document storage
const STORAGE_KEY = "gta_documents";

/**
 * LocalStorage document management functions (fallback when API is unavailable)
 */
const localStorageDocuments = {
  // Get all documents from localStorage
  getAll(): StoredDocument[] {
    if (typeof window === "undefined") return [];
    try {
      const documents = localStorage.getItem(STORAGE_KEY);
      return documents ? JSON.parse(documents) : [];
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      return [];
    }
  },

  // Get documents by profile
  getByProfile(profile: string): StoredDocument[] {
    return this.getAll().filter((doc) => doc.profile === profile);
  },

  // Add a new document
  add(document: Omit<StoredDocument, "id" | "createdAt">): StoredDocument {
    const documents = this.getAll();
    const newDocument = {
      ...document,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    documents.push(newDocument);
    this.saveAll(documents);
    return newDocument;
  },

  // Delete a document by ID
  delete(id: string): boolean {
    const documents = this.getAll();
    const initialLength = documents.length;
    const newDocuments = documents.filter((doc) => doc.id !== id);

    if (newDocuments.length !== initialLength) {
      this.saveAll(newDocuments);
      return true;
    }
    return false;
  },

  // Save all documents to localStorage
  saveAll(documents: StoredDocument[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
      // Trigger storage event for cross-tab communication
      window.dispatchEvent(new Event("storage"));
    } catch (error) {
      console.error("Error writing to localStorage:", error);
    }
  },
};

/**
 * Get all documents for a specific profile type
 * Falls back to localStorage if API fails
 */
export async function getDocumentsByProfile(
  profile: string,
): Promise<StoredDocument[]> {
  try {
    // Try to fetch from API first
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/documents/${profile}`,
    );
    if (!response.ok) {
      // API failed, use localStorage fallback
      console.warn(
        `API unavailable, using localStorage fallback for documents/${profile}`,
      );
      return localStorageDocuments.getByProfile(profile);
    }
    return await response.json();
  } catch (error) {
    console.warn("API error, using localStorage fallback:", error);
    return localStorageDocuments.getByProfile(profile);
  }
}

/**
 * Upload a document for a specific profile type
 * Falls back to localStorage if API fails
 */
export async function uploadDocument(
  file: File,
  profile: string,
): Promise<StoredDocument | null> {
  try {
    // Convert file to base64
    const base64Content = await fileToBase64(file);

    // Try to upload to API first
    const formData = new FormData();
    formData.append("name", file.name);
    formData.append("content", base64Content);
    formData.append("mimeType", file.type || getMimeType(file.name));
    formData.append("profile", profile);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`API unavailable: ${response.statusText}`);
      }

      return await response.json();
    } catch (apiError) {
      // API failed, use localStorage fallback
      console.warn("API upload failed, using localStorage fallback:", apiError);

      return localStorageDocuments.add({
        name: file.name,
        content: base64Content,
        mimeType: file.type || getMimeType(file.name),
        profile,
      });
    }
  } catch (error) {
    console.error("Error processing document for upload:", error);
    return null;
  }
}

/**
 * Delete a document by its ID
 * Falls back to localStorage if API fails
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  try {
    // Try to delete from API first
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      // API failed, use localStorage fallback
      console.warn(
        `API unavailable, using localStorage fallback to delete document ${documentId}`,
      );
      return localStorageDocuments.delete(documentId);
    }

    return true;
  } catch (error) {
    console.warn("API error, using localStorage fallback for delete:", error);
    return localStorageDocuments.delete(documentId);
  }
}

// Helper function to convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

// Get MIME type from file extension
function getMimeType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    md: "text/markdown",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
  };

  return mimeTypes[extension || ""] || "application/octet-stream";
}
