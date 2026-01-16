<#-- Custom head.ftl for Glow theme -->
<#-- Override favicon to use Glow branding instead of Keycloak default -->
<#-- This file is included by Keycloak's base template.ftl -->

<#-- Favicon (SVG for modern browsers) -->
<link rel="icon" href="${url.resourcesPath}/favicon.svg" type="image/svg+xml" />

<#-- Favicon fallbacks (PNG and ICO for older browsers) -->
<link rel="icon" href="${url.resourcesPath}/img/favicon.png" type="image/png" />
<link rel="shortcut icon" href="${url.resourcesPath}/img/favicon.ico" />
