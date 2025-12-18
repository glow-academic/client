/**
 * SettingsAuthMethodConfigSection.tsx
 * Individual auth method configuration section with step status
 * Uses card-based key selection for encrypted items, text inputs for non-encrypted items
 */
"use client";

import { SettingsKeyPicker } from "@/components/settings/SettingsKeyPicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export interface AuthTableItem {
  auth_id: string;
  auth_name: string;
  auth_description: string;
  auth_slug: string | null;
  auth_item_id: string;
  auth_item_name: string;
  auth_item_description: string;
  selected_key_id: string | null;
  value: string | null;
  encrypted: boolean;
  enabled: boolean;
}

export interface SettingsAuthMethodConfigSectionProps {
  authId: string;
  authName: string;
  authDescription: string;
  data: AuthTableItem[];
  keyMapping: Record<
    string,
    {
      name: string;
      description: string;
      key_masked: string;
      active: boolean;
      department_ids: string[] | null;
    }
  >;
  validKeyIds: string[];
  onKeyChange: (
    authId: string,
    authItemId: string,
    keyId: string | null,
  ) => void;
  onValueChange: (authId: string, authItemId: string, value: string) => void;
  isReadonly: boolean;
}

export function SettingsAuthMethodConfigSection({
  authId,
  authName,
  authDescription,
  data,
  keyMapping,
  validKeyIds,
  onKeyChange,
  onValueChange,
  isReadonly,
}: SettingsAuthMethodConfigSectionProps) {
  // Filter data to only show items for this auth method
  const filteredData = data.filter((item) => item.auth_id === authId);

  // Separate encrypted and non-encrypted items
  let encryptedItems = filteredData.filter(
    (item) => item.encrypted && item.auth_item_id,
  );
  const nonEncryptedItems = filteredData.filter(
    (item) => !item.encrypted && item.auth_item_id,
  );

  // Sort encrypted items: items with selected keys first
  encryptedItems = [...encryptedItems].sort((a, b) => {
    const aHasKey = !!a.selected_key_id;
    const bHasKey = !!b.selected_key_id;
    if (aHasKey && !bHasKey) return -1;
    if (!aHasKey && bHasKey) return 1;
    return 0;
  });

  if (filteredData.length === 0) {
    return (
      <Card className="transition-all">
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            No configuration items available for this auth method
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Individual Cards for Each Encrypted Key */}
      {encryptedItems.map((item) => (
        <Card key={item.auth_item_id} className="transition-all">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {authName} {item.auth_item_name} Key
            </CardTitle>
            {item.auth_item_description && (
              <CardDescription>{item.auth_item_description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <SettingsKeyPicker
              keyMapping={keyMapping}
              validKeyIds={validKeyIds}
              selectedKeyId={item.selected_key_id}
              sectionLabel=""
              onKeyIdChange={(keyId) =>
                onKeyChange(authId, item.auth_item_id, keyId)
              }
              isReadonly={isReadonly}
            />
          </CardContent>
        </Card>
      ))}

      {/* Single Card for All Non-Encrypted Items */}
      {nonEncryptedItems.length > 0 && (
        <Card className="transition-all">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{authName} Configuration</CardTitle>
            <CardDescription>
              Configure non-encrypted values for {authName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {nonEncryptedItems.map((item) => (
              <div key={item.auth_item_id} className="space-y-2">
                <Label htmlFor={`auth-value-${item.auth_item_id}`}>
                  {authName} {item.auth_item_name}
                </Label>
                {item.auth_item_description && (
                  <p className="text-xs text-muted-foreground">
                    {item.auth_item_description}
                  </p>
                )}
                <input
                  id={`auth-value-${item.auth_item_id}`}
                  type="text"
                  value={item.value || ""}
                  onChange={(e) =>
                    onValueChange(authId, item.auth_item_id, e.target.value)
                  }
                  disabled={isReadonly}
                  placeholder={`Enter ${item.auth_item_name}...`}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
