import React, { useState, useRef } from 'react';
import * as tus from 'tus-js-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DocumentUploaderProps {
    onUploadComplete?: () => void;
}

export default function DocumentUploader({ onUploadComplete }: DocumentUploaderProps) {
    const [selectedProfileType, setSelectedProfileType] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>(''); // Added state for selected class
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !selectedProfileType || !selectedClass) { // Added selectedClass check
            toast.error('Please select a file, profile type, and class');
            return;
        }

        const file = e.target.files[0];
        if (!file) return;

        try {
            setIsUploading(true);
            setUploadProgress(0);

            // Generate a unique file ID
            const fileId = crypto.randomUUID();

            // Create notification
            toast.loading(`Uploading ${file.name}...`);

            // Get the API URL from environment
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

            // Create a new tus upload
            const upload = new tus.Upload(file, {
                endpoint: `${apiUrl}/documents/tus`,
                retryDelays: [0, 3000, 5000, 10000, 20000],
                metadata: {
                    filename: file.name,
                    filetype: file.type,
                    profile: selectedProfileType,
                    class: selectedClass, // Ensure class is correctly set in metadata
                    fileId: fileId
                },
                onError: (error) => {
                    console.error('Failed because: ', error);
                    toast.dismiss();
                    toast.error(`Upload failed: ${error.message || 'Unknown error'}`);
                    setIsUploading(false);
                },
                onProgress: (bytesUploaded, bytesTotal) => {
                    const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
                    setUploadProgress(percentage);
                    
                    // Update toast every 5% to avoid too many updates
                    if (percentage % 5 === 0 || percentage === 100) {
                        toast.loading(`Uploading ${file.name}... ${percentage}%`);
                    }
                },
                onSuccess: async () => {
                    // Finalize the upload
                    try {
                        const response = await fetch(`${apiUrl}/documents/tus/finalize`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ 
                                fileId,
                                profile: selectedProfileType,
                                class: selectedClass // Ensure class is included in the finalize request
                            }),
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'Failed to finalize upload');
                        }

                        toast.dismiss();
                        toast.success(`${file.name} uploaded successfully!`);
                        
                        // Reset form
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                        setSelectedProfileType(''); // Reset profile type
                        setSelectedClass(''); // Reset class
                        
                        // Invalidate queries to refresh data
                        queryClient.invalidateQueries({ queryKey: ['documents'] });
                        
                        // Call the onUploadComplete callback if provided
                        if (onUploadComplete) {
                            onUploadComplete();
                        }
                    } catch (error) {
                        console.error('Finalization error:', error);
                        toast.error(`Failed to process upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                        setIsUploading(false);
                    }
                }
            });

            // Start the upload
            upload.start();
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsUploading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>
                    Upload documents for different student profiles
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="profile-type">Student Profile Type</Label>
                    <Select
                        value={selectedProfileType}
                        onValueChange={(value) => setSelectedProfileType(value)}
                        disabled={isUploading}
                    >
                        <SelectTrigger id="profile-type">
                            <SelectValue placeholder="Select profile type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="aggressive">Aggressive</SelectItem>
                            <SelectItem value="happy">Happy</SelectItem>
                            <SelectItem value="confused">Confused</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* New Class Dropdown */}
                <div className="space-y-2">
                    <Label htmlFor="class-type">Class</Label>
                    <Select
                        value={selectedClass}
                        onValueChange={(value) => setSelectedClass(value)}
                        disabled={isUploading}
                    >
                        <SelectTrigger id="class-type">
                            <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="CS 182">CS 182</SelectItem>
                            <SelectItem value="CS 253">CS 253</SelectItem>
                            <SelectItem value="CS 381">CS 381</SelectItem>
                            <SelectItem value="CS XYZ">CS XYZ (General)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="document-file">Document File</Label>
                    <Input
                        id="document-file"
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileUpload}
                        disabled={!selectedProfileType || !selectedClass || isUploading} // Updated disabled condition
                        accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        className="cursor-pointer"
                    />
                    {(!selectedProfileType || !selectedClass) && ( // Updated conditional message
                        <p className="text-sm text-muted-foreground mt-1">
                            Please select a student profile type and class first
                        </p>
                    )}
                </div>

                {isUploading && (
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Upload Progress</span>
                            <span className="text-sm font-medium">{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}