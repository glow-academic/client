<#-- GENERATED FILE: do not edit manually -->
<#-- Generated at: 2026-02-22T16:04:33.977553 -->
<#--
  Provider mapping: department_id -> allowed IdP aliases

  Enumerated departments:
    - 019b3be4-3247-7cb0-bd74-9b2467b5e32d: Purdue CS
    - 019c3f8c-b97b-7350-8d77-632e29b1c3f9: General

  Enumerated IdP aliases:
    - auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8
    - auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294
    - default-idp-profile-019bb25e-e611-78ab-b453-5c7720d87aec
    - default-idp-profile-019bdb94-b2b9-712b-9f14-6625ddc5e4ad

  Default-IdP aliases:
    - default-idp-profile-019bb25e-e611-78ab-b453-5c7720d87aec
    - default-idp-profile-019bdb94-b2b9-712b-9f14-6625ddc5e4ad
-->

<#-- Departments to show in the picker -->
<#assign departments = [
  {"id": "019b3be4-3247-7cb0-bd74-9b2467b5e32d", "title": "Purdue CS"},
  {"id": "019c3f8c-b97b-7350-8d77-632e29b1c3f9", "title": "General"}
] />

<#-- Map department_id -> allowed IdP aliases -->
<#assign allowedProvidersByDept = {
  "019b3be4-3247-7cb0-bd74-9b2467b5e32d": ["auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294", "default-idp-profile-019bdb94-b2b9-712b-9f14-6625ddc5e4ad", "default-idp-profile-019bb25e-e611-78ab-b453-5c7720d87aec"],
  "019c3f8c-b97b-7350-8d77-632e29b1c3f9": ["auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8"]
} />

<#-- Platform providers (only used when no departments exist) -->
<#assign platformProviders = [] />

<#function getAllowedProvidersForDepartment deptId>
  <#-- If departments exist, always use department-specific providers -->
  <#if departments?size gt 0>
    <#-- Default to first department if no department selected -->
    <#assign effectiveDeptId = deptId!"" />
    <#if !effectiveDeptId?has_content>
      <#assign effectiveDeptId = departments[0].id />
    </#if>
    <#if effectiveDeptId?has_content && allowedProvidersByDept[effectiveDeptId]??>
      <#assign deptProviders = allowedProvidersByDept[effectiveDeptId] />
      <#if deptProviders?size gt 0>
        <#return deptProviders>
      </#if>
    </#if>
    <#-- Fallback: return empty list if department has no providers -->
    <#return []>
  <#else>
    <#-- No departments exist: use platform providers -->
    <#return platformProviders>
  </#if>
</#function>