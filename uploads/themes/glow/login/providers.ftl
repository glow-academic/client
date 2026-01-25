<#-- GENERATED FILE: do not edit manually -->
<#-- Generated at: 2026-01-25T07:08:44.217260 -->
<#--
  Provider mapping: department_id -> allowed IdP aliases

  Enumerated departments:
    - 019b3be4-3247-7cb0-bd74-9b2467b5e32d: Purdue CS
    - 019b3be4-3247-7d5e-a958-5b9fb4e2725b: Purdue Chem
    - 019b3be4-3247-7d4f-9974-77e974f7949c: Purdue Math

  Enumerated IdP aliases:
    - auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8
    - auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294
    - default-idp-profile-019b3be4-36ef-7a5f-98ab-ccb879770be0
    - default-idp-profile-019b3be4-36f0-792c-82d6-126664ed18b6
    - default-idp-profile-019bdb94-b2b6-7001-afd4-8dea58b2b22d
    - google
    - microsoft

  Default-IdP aliases:
    - default-idp-profile-019b3be4-36ef-7a5f-98ab-ccb879770be0
    - default-idp-profile-019b3be4-36f0-792c-82d6-126664ed18b6
    - default-idp-profile-019bdb94-b2b6-7001-afd4-8dea58b2b22d
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

<#-- Platform providers (only used when no departments exist) -->
<#assign platformProviders = ["google", "microsoft"] />

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