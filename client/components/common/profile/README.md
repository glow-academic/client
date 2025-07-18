# ProfileSelector Component

A reusable component for selecting and managing profiles with multiple input methods.

## Features

### 🔍 **Search Functionality**
- Real-time fuzzy search through existing profiles
- Searches by first name, last name, alias, and full name
- Client-side search (no MCP dependency)
- Role-based filtering (only shows profiles with allowed roles)

### 📁 **CSV Upload**
- Upload CSV files with profile data
- Template download with example data
- Preview table before adding profiles
- Validation for required fields and valid roles
- Automatic role filtering based on component configuration

### ✏️ **Quick Add**
- Paste comma-separated names in "First Last" format
- Automatic alias generation (firstname + lastname)
- Default role assignment (first allowed role)

### 📊 **Table Management**
- Display selected profiles in a clean table format
- Role management with dropdown selection
- Visual indicators for new vs existing profiles
- Remove profiles with confirmation

## Usage

```tsx
import ProfileSelector from '@/components/common/profile/ProfileSelector';

// For Class Form (instructors and TAs)
<ProfileSelector
  selectedProfiles={editedProfiles}
  onProfilesChange={setEditedProfiles}
  allowedRoles={["instructor", "ta"]}
  title="Staff Management"
  description="Add instructors and teaching assistants to this class"
/>

// For Department Form (instructional staff only)
<ProfileSelector
  selectedProfiles={editedProfiles}
  onProfilesChange={setEditedProfiles}
  allowedRoles={["instructional"]}
  title="Staff Management"
  description="Add instructional staff to this department"
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `selectedProfiles` | `EditableProfile[]` | Yes | Array of currently selected profiles |
| `onProfilesChange` | `(profiles: EditableProfile[]) => void` | Yes | Callback when profiles change |
| `allowedRoles` | `ProfileRole[]` | Yes | Array of allowed roles for this context |
| `title` | `string` | No | Title for the component (default: "Profiles") |
| `description` | `string` | No | Description text (default: "Add profiles to this item") |

## CSV Format

The CSV should have the following columns:
```csv
firstName,lastName,alias,role
John,Doe,jdoe,instructor
Jane,Smith,jsmith,ta
```

## Profile Types

### EditableProfile
```tsx
type EditableProfile = 
  | Profile  // Existing profile from database
  | {
      isNew: true;
      id: string;
      firstName: string;
      lastName: string;
      alias: string;
      role: ProfileRole;
    };
```

## Integration with Forms

The ProfileSelector is designed to work with form state management:

1. **Staging**: Profiles are staged locally and only saved when the form is submitted
2. **Change Detection**: The component tracks changes for form validation
3. **Role Restrictions**: Automatically filters profiles based on context (class vs department)
4. **Error Handling**: Provides user feedback for invalid data

## Search Algorithm

The fuzzy search uses a scoring system:
- **Exact matches**: 100-150 points
- **Starts with**: 40-60 points  
- **Contains**: 15-25 points
- **Partial word matches**: 5-10 points

Results are sorted by score and limited to top 10 matches. 