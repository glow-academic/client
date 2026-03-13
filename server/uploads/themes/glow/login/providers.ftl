<#-- GENERATED FILE: do not edit manually -->
<#-- Generated at: 2026-03-13T11:42:37.774105 -->
<#--
  Provider mapping: department_id -> allowed IdP aliases

  Enumerated departments:
    - f558f882-9630-5b77-a3c8-c09eb940b871: Organization
    - a2b369c1-a81e-5e02-98d5-dd42af15ae4a: University

  Enumerated IdP aliases:
    - auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8
    - auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294

  Default-IdP aliases:
-->

<#-- Departments to show in the picker -->
<#assign departments = [
  {"id": "f558f882-9630-5b77-a3c8-c09eb940b871", "title": "Organization"},
  {"id": "a2b369c1-a81e-5e02-98d5-dd42af15ae4a", "title": "University"}
] />

<#-- Map department_id -> allowed IdP aliases -->
<#assign allowedProvidersByDept = {
  "a2b369c1-a81e-5e02-98d5-dd42af15ae4a": ["auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294"],
  "f558f882-9630-5b77-a3c8-c09eb940b871": ["auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8"]
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