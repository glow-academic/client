# V2 to V3 API Migration Analysis

## Summary
This document identifies all components still using `@/lib/api/v2` hooks and what v3 endpoints need to be created.

**STATUS**: Most endpoints already exist in v3! Only a few are missing.

## Components Still Using V2 Hooks

### 1. **Attempts** (simulation-context.tsx, AttemptChat.tsx, DataTable.tsx)
**Hooks Used:**
- `useAttemptFull` - `/attempts/{attemptId}/full`
- `useUpdateChatCreatedAt` - `/attempts/chats/update-created-at`
- `useUpdateChatCompletedAt` - `/attempts/chats/update-completed-at` 
- `useBulkArchiveAttempts` - `/attempts/bulk-archive`

**V3 Endpoints Status:**
- ✅ `POST /attempts/full` (body: { attemptId }) - EXISTS
- ✅ `POST /attempts/chats/update-created-at` (body: { chatId, createdAt }) - EXISTS
- ❌ `POST /attempts/chats/update-completed-at` (body: { chatId, completedAt }) - **MISSING**
- ✅ `POST /attempts/bulk-archive` (body: { attemptIds, archive }) - EXISTS

---

### 2. **Rubrics** (Rubric.tsx, RubricDetails.tsx, RubricStandardGroup.tsx, Rubrics.tsx)
**Hooks Used:**
- `useRubricDetail` - `/rubrics/detail`
- `useRubricDetailDefault` - `/rubrics/detail-default`
- `useCreateRubric` - `/rubrics/create`
- `useRubricUnifiedUpdate` - `/rubrics/update`
- `useDeleteRubric` - `/rubrics/delete`
- `useDuplicateRubric` - `/rubrics/duplicate`

**V3 Endpoints Status:**
- ✅ `POST /rubrics/list` - EXISTS
- ✅ `POST /rubrics/detail` - EXISTS
- ✅ `POST /rubrics/detail-default` - EXISTS
- ✅ `POST /rubrics/create` - EXISTS
- ✅ `POST /rubrics/update` - EXISTS
- ✅ `POST /rubrics/duplicate` - EXISTS
- ✅ `POST /rubrics/delete` - EXISTS

**Action:** Just need to migrate components to use v3 API

---

### 3. **Documents** (Documents.tsx, DocumentUploadDialog.tsx)
**Hooks Used:**
- `useDocumentsList` - `/documents/list`
- `useDocumentDetail` - `/documents/detail`
- `useDocumentDetailBulk` - `/documents/detail-bulk`
- `useUpdateDocument` - `/documents/update`
- `useBulkUpdateDocuments` - `/documents/bulk-update`
- `useDeleteDocument` - `/documents/delete`
- `useBulkDeleteDocuments` - `/documents/bulk-delete`
- `useFinalizeDocumentUpload` - `/documents/upload/finalize`

**V3 Endpoints Status:**
- ✅ `POST /documents/list` - EXISTS
- ✅ `POST /documents/detail` - EXISTS
- ✅ `POST /documents/detail-bulk` - EXISTS
- ❌ `POST /documents/create` - **MISSING** (may not be needed if using upload flow)
- ✅ `POST /documents/update` - EXISTS
- ✅ `POST /documents/bulk-update` - EXISTS
- ✅ `POST /documents/delete` - EXISTS
- ✅ `POST /documents/bulk-delete` - EXISTS
- ❌ `POST /documents/upload/init` - **MISSING**
- ❌ `POST /documents/upload/chunk` - **MISSING**
- ❌ `POST /documents/upload/finalize` - **MISSING**

**Action:** Need to create document upload endpoints (init, chunk, finalize)

---

### 4. **Profile/Staff** (Multiple components)
**Hooks Used:**
- `useProfileSimple` - `/profile/detail-simple`
- `useProfileDetailBulk` - `/profile/detail-bulk`
- `useProfileList` - `/profile/list`
- `useUpdateProfileSimple` - `/profile/update-simple`
- `useBulkUpdateProfile` - `/profile/bulk-update`
- `useDeleteProfile` - `/profile/delete`
- `useBulkDeleteProfile` - `/profile/bulk-delete`
- `useCreateStaffData` - `/profile/create-staff-data`
- `useBulkCreateProfile` - `/profile/bulk-create`
- `useBulkCreateOrUpdateStaff` - `/profile/bulk-create-or-update-staff`
- `useSearchStaff` - `/profile/search`
- `useAuthorizeEmulation` - `/profile/authorize-emulation`
- `useMarkIntroComplete` - `/profile/mark-intro-complete`
- `useMarkChatComplete` - `/profile/mark-chat-complete`
- `useProcessCSV` - `/profile/process-csv`

**V3 Endpoints Status:**
- ❌ `POST /profile/detail-simple` - **MISSING** (may use `/profile/detail` instead)
- ✅ `POST /profile/staff/detail-bulk` - EXISTS
- ❌ `POST /profile/list` - **MISSING** (may use `/profile/staff/list` instead)
- ❌ `POST /profile/update-simple` - **MISSING** (may use `/profile/staff/update` instead)
- ✅ `POST /profile/staff/bulk-update` - EXISTS
- ✅ `POST /profile/staff/delete` - EXISTS
- ✅ `POST /profile/staff/bulk-delete` - EXISTS
- ✅ `POST /profile/staff/create-staff-data` - EXISTS
- ✅ `POST /profile/staff/bulk-create` - EXISTS
- ✅ `POST /profile/staff/bulk-create-or-update-staff` - EXISTS
- ✅ `POST /profile/staff/search-staff` - EXISTS
- ✅ `POST /profile/authorize-emulation` - EXISTS
- ✅ `POST /profile/mark-intro-complete` - EXISTS
- ✅ `POST /profile/mark-chat-complete` - EXISTS
- ✅ `POST /profile/staff/process-csv` - EXISTS

**Action:** Most endpoints exist under `/profile/staff/` prefix. Need to check if `/profile/detail-simple` and `/profile/list` are needed or if staff endpoints cover them.

---

### 5. **Cohorts** (Cohorts.tsx, AddStaffToCohort.tsx)
**Hooks Used:**
- `useCohortsList` - `/cohorts/list`
- `useCohortDetail` - `/cohorts/detail`
- `useCohortDetailWithProfiles` - `/cohorts/detail-with-profiles`
- `useCohortDetailDefault` - `/cohorts/detail-default`
- `useCreateCohort` - `/cohorts/create`
- `useUpdateCohort` - `/cohorts/update`
- `useDuplicateCohort` - `/cohorts/duplicate`
- `useDeleteCohort` - `/cohorts/delete`
- `useAddProfilesToCohort` - `/cohorts/add-profiles`
- `useRemoveProfilesFromCohort` - `/cohorts/remove-profiles`
- `useLeaveCohort` - `/cohorts/leave`

**V3 Endpoints Status:**
- ✅ `POST /cohorts/list` - EXISTS
- ✅ `POST /cohorts/detail` - EXISTS
- ✅ `POST /cohorts/detail-with-profiles` - EXISTS
- ✅ `POST /cohorts/detail-default` - EXISTS
- ✅ `POST /cohorts/create` - EXISTS
- ✅ `POST /cohorts/update` - EXISTS
- ✅ `POST /cohorts/duplicate` - EXISTS
- ✅ `POST /cohorts/delete` - EXISTS
- ✅ `POST /cohorts/add-profiles` - EXISTS
- ✅ `POST /cohorts/remove-profiles` - EXISTS
- ✅ `POST /cohorts/leave` - EXISTS

**Action:** Just need to migrate components to use v3 API

---

### 6. **Feedback** (BulkDeleteFeedbackDialog.tsx, Feedback.tsx)
**Hooks Used:**
- `useFeedbackList` - `/feedback/list`
- `useBulkDeleteFeedback` - `/feedback/bulk-delete`

**V3 Endpoints Status:**
- ✅ `POST /feedback/list` - EXISTS
- ✅ `POST /feedback/bulk-delete` - EXISTS

**Action:** Just need to migrate components to use v3 API

---

### 7. **Logs** (BulkDeleteLogsDialog.tsx, Logs.tsx, TATour.tsx, HealthModal.tsx)
**Hooks Used:**
- `useLogger` - `/logs/create`
- `useLogsList` - `/logs/list`
- `useBulkDeleteLogs` - `/logs/bulk-delete`
- `getApiBase` - used for health check

**V3 Endpoints Status:**
- ✅ `POST /logs/create` - EXISTS
- ✅ `POST /logs/list` - EXISTS
- ✅ `POST /logs/bulk-delete` - EXISTS
- ❌ `GET /logs/health` - **MISSING** (may use different endpoint)

**Action:** Just need to migrate components to use v3 API (check health endpoint)

---

### 8. **Analytics** (AnalyticsFilters.tsx)
**Hooks Used:**
- `useRefreshAnalytics` - `/analytics/refresh`

**V3 Endpoints Status:**
- ✅ `POST /refresh` - EXISTS (may be `/api/v3/refresh`)

**Action:** Just need to migrate components to use v3 API

---

### 9. **Scenarios** (Scenarios.tsx)
**V3 Endpoints Status:**
- ✅ `POST /scenarios/list` - EXISTS
- ✅ `POST /scenarios/detail` - EXISTS
- ✅ `POST /scenarios/detail-default` - EXISTS
- ✅ `POST /scenarios/create` - EXISTS
- ✅ `POST /scenarios/update` - EXISTS
- ✅ `POST /scenarios/duplicate` - EXISTS
- ✅ `POST /scenarios/delete` - EXISTS
- ✅ `POST /scenarios/generate-ai` - EXISTS
- ✅ `POST /scenarios/randomize` - EXISTS

**Action:** Just need to migrate components to use v3 API

---

### 10. **Simulations** (Simulations.tsx)
**V3 Endpoints Status:**
- ✅ `POST /simulations/list` - EXISTS
- ✅ `POST /simulations/detail` - EXISTS
- ✅ `POST /simulations/detail-default` - EXISTS
- ✅ `POST /simulations/create` - EXISTS
- ✅ `POST /simulations/update` - EXISTS
- ✅ `POST /simulations/duplicate` - EXISTS
- ✅ `POST /simulations/delete` - EXISTS

**Action:** Just need to migrate components to use v3 API

---

### 11. **Personas** (Persona.tsx)
**V3 Endpoints Status:**
- ✅ Most endpoints exist
- ❌ `POST /personas/delete-prompt` - **MISSING** (body: { personaId, promptId, departmentId })

**Action:** Need to create `/personas/delete-prompt` endpoint

---

### 12. **Agents** (Agent.tsx)
**V3 Endpoints Status:**
- ✅ `POST /agents/list` - EXISTS
- ✅ `POST /agents/detail` - EXISTS
- ✅ `POST /agents/detail-default` - EXISTS
- ✅ `POST /agents/create` - EXISTS
- ✅ `POST /agents/update` - EXISTS
- ✅ `POST /agents/duplicate` - EXISTS
- ✅ `POST /agents/delete` - EXISTS
- ✅ `POST /agents/delete-prompt` - EXISTS

**Action:** Just need to migrate components to use v3 API

---

## Missing Endpoints Summary

Only **4 endpoints** are missing:

1. ❌ `POST /attempts/chats/update-completed-at` (body: { chatId, completedAt })
2. ❌ `POST /documents/upload/init` (body: { filename, contentType })
3. ❌ `POST /documents/upload/chunk` (body: { uploadId, chunk })
4. ❌ `POST /documents/upload/finalize` (body: { uploadId, metadata })
5. ❌ `POST /personas/delete-prompt` (body: { personaId, promptId, departmentId })

**Note:** Some profile endpoints may need verification (detail-simple, list) but most functionality exists under `/profile/staff/` prefix.

---

## Migration Priority

### Phase 1: Create Missing Endpoints
1. Create `/attempts/chats/update-completed-at`
2. Create document upload endpoints (init, chunk, finalize)
3. Create `/personas/delete-prompt`

### Phase 2: Migrate Components (High Priority)
1. **Attempts** - simulation-context.tsx, AttemptChat.tsx, DataTable.tsx
2. **Documents** - Documents.tsx, DocumentUploadDialog.tsx
3. **Profile/Staff** - Multiple components (Staff.tsx, StaffEdit.tsx, etc.)
4. **Cohorts** - Cohorts.tsx, AddStaffToCohort.tsx

### Phase 3: Migrate Components (Medium Priority)
1. **Rubrics** - Rubric.tsx, RubricDetails.tsx, Rubrics.tsx
2. **Scenarios** - Scenarios.tsx
3. **Simulations** - Simulations.tsx
4. **Agents** - Agent.tsx

### Phase 4: Migrate Components (Low Priority)
1. **Feedback** - Feedback.tsx, BulkDeleteFeedbackDialog.tsx
2. **Logs** - Logs.tsx, BulkDeleteLogsDialog.tsx, TATour.tsx
3. **Analytics** - AnalyticsFilters.tsx

---

## Notes

- Most endpoints already exist! The main work is migrating components from v2 hooks to v3 `api.post`.
- All endpoints should follow the pattern: `POST /resource/action` with body parameters
- Remove path parameters (like `/{id}`) and use body parameters instead
- Each endpoint should have a `response_model` in FastAPI
- Follow the personas pattern for keys, queries, and invalidation

