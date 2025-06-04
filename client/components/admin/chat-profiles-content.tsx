/**
 * components/admin/chat-profiles-content.tsx
 * Chat Profiles management component
 */
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Edit } from "lucide-react";

import { getProfiles } from "@/utils/queries/get-profiles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { profiles as Profiles } from "@/drizzle/schema";

export function ChatProfilesContent() {
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({ 
    name: "", 
    subtitle: "", 
    description: "", 
    threshold: 50 
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(),
  });

  const handleCreateProfile = async () => {
    // Mock API call - replace with actual implementation
    toast.success("Profile created successfully!");
    setShowCreateProfile(false);
    setNewProfile({ name: "", subtitle: "", description: "", threshold: 50 });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Chat Profiles</h2>
          <p className="text-muted-foreground">Manage AI student personality profiles</p>
        </div>
        <Button onClick={() => setShowCreateProfile(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Profile
        </Button>
      </div>

      <div className="grid gap-4">
        {profiles?.map((profile: typeof Profiles.$inferSelect) => (
          <Card key={profile.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{profile.name}</CardTitle>
                  <CardDescription>{profile.subtitle}</CardDescription>
                  <p className="text-sm text-muted-foreground">{profile.description}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">Threshold: {profile.threshold}%</Badge>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Create Profile Dialog */}
      <Dialog open={showCreateProfile} onOpenChange={setShowCreateProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profileName">Profile Name</Label>
              <Input
                id="profileName"
                value={newProfile.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setNewProfile(prev => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Enthusiastic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileSubtitle">Subtitle</Label>
              <Input
                id="profileSubtitle"
                value={newProfile.subtitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setNewProfile(prev => ({ ...prev, subtitle: e.target.value }))
                }
                placeholder="Brief description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileDescription">Description</Label>
              <Textarea
                id="profileDescription"
                value={newProfile.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                  setNewProfile(prev => ({ ...prev, description: e.target.value }))
                }
                placeholder="Detailed behavior description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileThreshold">Threshold (%)</Label>
              <Input
                id="profileThreshold"
                type="number"
                min="0"
                max="100"
                value={newProfile.threshold}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  setNewProfile(prev => ({ ...prev, threshold: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateProfile(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateProfile}>
                Create Profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 