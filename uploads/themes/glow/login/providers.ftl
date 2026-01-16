<#-- GENERATED FILE: do not edit manually -->
<#-- Generated at: 2026-01-16T12:47:36.132126 -->
<#--
  Provider mapping: department_id -> allowed IdP aliases

  Enumerated departments:
    - 019b3be4-3247-7cb0-bd74-9b2467b5e32d: Purdue CS
    - 019b3be4-3247-7d5e-a958-5b9fb4e2725b: Purdue Chem
    - 019b3be4-3247-7d4f-9974-77e974f7949c: Purdue Math

  Enumerated IdP aliases:
    - auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8
    - auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294
    - google
    - microsoft
-->

<#-- Departments to show in the picker -->
<#assign departments = [
  {"id": "019b3be4-3247-7cb0-bd74-9b2467b5e32d", "title": "Purdue CS"},
  {"id": "019b3be4-3247-7d5e-a958-5b9fb4e2725b", "title": "Purdue Chem"},
  {"id": "019b3be4-3247-7d4f-9974-77e974f7949c", "title": "Purdue Math"}
] />

<#-- Map department_id -> allowed IdP aliases -->
<#assign allowedProvidersByDept = {
  "019b3be4-3247-7cb0-bd74-9b2467b5e32d": ["auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294"],
  "019b3be4-3247-7d4f-9974-77e974f7949c": ["auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8"],
  "019b3be4-3247-7d5e-a958-5b9fb4e2725b": ["auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8", "auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294"]
} />

<#-- Platform fallback (when no department chosen) -->
<#assign platformProviders = ["google", "microsoft"] />

<#function getAllowedProvidersForDepartment deptId>
  <#if deptId?has_content && allowedProvidersByDept[deptId]??>
    <#assign deptProviders = allowedProvidersByDept[deptId] />
    <#if deptProviders?size gt 0>
      <#return deptProviders>
    <#else>
      <#-- Department has no IdPs, fallback to platform -->
      <#return platformProviders>
    </#if>
  <#else>
    <#-- No department selected, return platform IdPs -->
    <#return platformProviders>
  </#if>
</#function>