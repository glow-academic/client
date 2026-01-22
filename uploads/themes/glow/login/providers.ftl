<#-- GENERATED FILE: do not edit manually -->
<#-- Generated at: 2026-01-21T20:00:51.833122 -->
<#--
  Provider mapping: department_id -> allowed IdP aliases

  Enumerated departments:

  Enumerated IdP aliases:

  Default-IdP aliases:
-->

<#-- Departments to show in the picker -->
<#assign departments = [
] />

<#-- Map department_id -> allowed IdP aliases -->
<#assign allowedProvidersByDept = {
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