<#-- GENERATED FILE: do not edit manually -->
<#-- Generated at: 2026-01-16T12:13:41.728392 -->
<#--
  Provider mapping: clientId -> allowed IdP aliases

  Enumerated clientIds:
    - glow-client
    - glow-client-019b3be4-3247-7cb0-bd74-9b2467b5e32d
    - glow-client-019b3be4-3247-7d4f-9974-77e974f7949c
    - glow-client-019b3be4-3247-7d5e-a958-5b9fb4e2725b

  Enumerated IdP aliases:
    - auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8
    - auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294
    - google
    - microsoft
-->

<#assign allowedProvidersByClient = {
  "glow-client": ["google", "microsoft"],
  "glow-client-019b3be4-3247-7cb0-bd74-9b2467b5e32d": ["google", "microsoft", "auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294"],
  "glow-client-019b3be4-3247-7d4f-9974-77e974f7949c": ["google", "microsoft", "auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8"],
  "glow-client-019b3be4-3247-7d5e-a958-5b9fb4e2725b": ["google", "microsoft", "auth_google_019b3be4-3117-7aa4-aa34-0041aa51d1d8", "auth_microsoft_019b3be4-3117-7afc-8d1d-a2815d70f294"]
}>

<#-- Fallback function: unknown clientIds get platform IdPs only (strict mode) -->
<#function getAllowedProviders clientId>
  <#if allowedProvidersByClient[clientId]??>
    <#return allowedProvidersByClient[clientId]>
  <#else>
    <#-- Unknown clientId: return platform IdPs only (strict mode) -->
    <#return allowedProvidersByClient["glow-client"]![]>
  </#if>
</#function>