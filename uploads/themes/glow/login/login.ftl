<#import "template.ftl" as layout>
<#include "providers.ftl">

<@layout.registrationLayout displayInfo=social.displayInfo; section>
  <#if section = "form">
    <#-- Read department from URL parameter -->
    <#assign departmentId = "" />
    <#if param?? && param.department??>
      <#assign departmentId = param.department?string />
    </#if>
    <#assign allowed = getAllowedProvidersForDepartment(departmentId) />
    
    <#-- Find selected department name -->
    <#assign selectedDeptName = "Default Account" />
    <#if departmentId?has_content>
      <#list departments as d>
        <#if d.id == departmentId>
          <#assign selectedDeptName = d.title />
          <#break />
        </#if>
      </#list>
    </#if>
    
    <#-- Full-page wrapper matching Next.js structure -->
    <div class="glow-page-wrapper">
      <#-- Sparkles background -->
      <div class="sparkles-background" id="sparkles-container"></div>
      
      <#-- Back button -->
      <#assign appBase = client.baseUrl!"" />
      <#if appBase?has_content>
        <div class="back-button-container">
          <a href="${appBase}/login" class="back-button">
            <div class="back-button-shine-1"></div>
            <div class="back-button-shine-2"></div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="back-icon">
              <path d="m12 19-7-7 7-7"></path>
              <path d="M19 12H5"></path>
            </svg>
            <span class="back-text">Back</span>
          </a>
        </div>
      </#if>
      
      <#-- Centered card -->
      <div class="glow-card">
        <#-- Shine effects -->
        <div class="glow-card-shine-1"></div>
        <div class="glow-card-shine-2"></div>
        
        <#-- Content container -->
        <div class="glow-card-content">
          <#-- Logo section -->
          <div class="logo-section">
            <#if appBase?has_content>
              <a href="${appBase}/" class="logo-link">
                <svg width="64" height="64" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="logo-icon">
                  <defs>
                    <linearGradient id="glow-gradient-login" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#93C5FD"></stop>
                      <stop offset="50%" stop-color="#60A5FA"></stop>
                      <stop offset="100%" stop-color="#3B82F6"></stop>
                    </linearGradient>
                  </defs>
                  <rect width="32" height="32" rx="8" fill="url(#glow-gradient-login)"></rect>
                  <g transform="translate(16, 16) scale(0.667)">
                    <path d="M0 -11L2.59 -2.59L11 0L2.59 2.59L0 11L-2.59 2.59L-11 0L-2.59 -2.59L0 -11Z" fill="white"></path>
                  </g>
                </svg>
                <h1 class="glow-title">GLOW</h1>
              </a>
            <#else>
              <div class="logo-link">
                <svg width="64" height="64" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="logo-icon">
                  <defs>
                    <linearGradient id="glow-gradient-login" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#93C5FD"></stop>
                      <stop offset="50%" stop-color="#60A5FA"></stop>
                      <stop offset="100%" stop-color="#3B82F6"></stop>
                    </linearGradient>
                  </defs>
                  <rect width="32" height="32" rx="8" fill="url(#glow-gradient-login)"></rect>
                  <g transform="translate(16, 16) scale(0.667)">
                    <path d="M0 -11L2.59 -2.59L11 0L2.59 2.59L0 11L-2.59 2.59L-11 0L-2.59 -2.59L0 -11Z" fill="white"></path>
                  </g>
                </svg>
                <h1 class="glow-title">GLOW</h1>
              </div>
            </#if>
          </div>
          
          <#-- Form content -->
          <div class="form-content">
            <#-- Department Picker -->
            <#if departments?size gt 0>
              <div class="department-picker-wrapper">
                <select id="department" name="department" class="department-select">
                  <option value="" <#if !departmentId?has_content>selected</#if>>Default</option>
                  <#list departments as d>
                    <option value="${d.id}" <#if departmentId == d.id>selected</#if>>${d.title}</option>
                  </#list>
                </select>
              </div>
              
              <script>
                (function () {
                  var select = document.getElementById("department");
                  if (!select) return;

                  function applyDept(dept) {
                    // Update URL without reload
                    var url = new URL(window.location.href);
                    if (dept) {
                      url.searchParams.set("department", dept);
                    } else {
                      url.searchParams.delete("department");
                    }
                    window.history.replaceState({}, "", url.toString());

                    // Filter provider buttons in DOM
                    var allowedProvidersByDept = {
                      <#list allowedProvidersByDept?keys as deptId>
                      "${deptId}": [<#list allowedProvidersByDept[deptId] as alias>"${alias}"<#sep>, </#list>]<#sep>,
                      </#list>
                    };
                    var platformProviders = [<#list platformProviders as p>"${p}"<#sep>, </#list>];

                    var allowed = (dept && allowedProvidersByDept[dept] && allowedProvidersByDept[dept].length)
                      ? allowedProvidersByDept[dept]
                      : platformProviders;

                    // Filter action buttons (provider buttons) - show/hide based on department selection
                    // Includes regular IdPs and default-idp instances
                    var actionButtons = document.querySelectorAll(".action-button[id^='social-']");
                    var visibleProviders = [];
                    actionButtons.forEach(function (btn) {
                      var alias = btn.id.replace("social-", "");
                      var show = allowed.indexOf(alias) !== -1;
                      btn.style.display = show ? "" : "none";
                      if (show) visibleProviders.push(btn);
                    });
                  }

                  select.addEventListener("change", function () {
                    applyDept(select.value || "");
                  });

                  // Apply initial state from URL or server-rendered departmentId
                  var initial = "${departmentId}";
                  if (!initial) {
                    var urlParams = new URLSearchParams(window.location.search);
                    initial = urlParams.get("department") || "";
                  }
                  if (select.value !== initial) select.value = initial;
                  applyDept(initial);
                })();
              </script>
            </#if>
            
            <#-- Username/password form (hidden by default, shown if needed) -->
            <#if realm.password>
              <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post" style="display: none;">
                <div class="${properties.kcFormGroupClass!}">
                  <label for="username" class="${properties.kcLabelClass!}">
                    <#if !realm.loginWithEmailAllowed>
                      ${msg("username")}
                    <#elseif !realm.registrationEmailAsUsername>
                      ${msg("usernameOrEmail")}
                    <#else>
                      ${msg("email")}
                    </#if>
                  </label>
                  <#if usernameEditDisabled??>
                    <input tabindex="1" id="username" class="${properties.kcInputClass!}" name="username" value="${(login.username!'')}" type="text" disabled />
                  <#else>
                    <input tabindex="1" id="username" class="${properties.kcInputClass!}" name="username" value="${(login.username!'')}" type="text" autofocus autocomplete="off" aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>" />
                  </#if>
                </div>
                <div class="${properties.kcFormGroupClass!}">
                  <div class="${properties.kcLabelWrapperClass!}">
                    <label for="password" class="${properties.kcLabelClass!}">${msg("password")}</label>
                    <#if realm.resetPasswordAllowed>
                      <span class="${properties.kcFormOptionsWrapperClass!}">
                        <a tabindex="5" class="${properties.kcFormForgotPasswordClass!}" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a>
                      </span>
                    </#if>
                  </div>
                  <input tabindex="2" id="password" class="${properties.kcInputClass!}" name="password" type="password" autocomplete="off" aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>" />
                </div>
                <div class="${properties.kcFormGroupClass!} ${properties.kcFormSettingClass!}">
                  <div id="kc-form-options">
                    <#if realm.rememberMe && !usernameEditDisabled??>
                      <div class="checkbox">
                        <label>
                          <#if login.rememberMe??>
                            <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox" checked> ${msg("rememberMe")}
                          <#else>
                            <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox"> ${msg("rememberMe")}
                          </#if>
                        </label>
                      </div>
                    </#if>
                  </div>
                </div>
                <div id="kc-form-buttons" class="${properties.kcFormGroupClass!}">
                  <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                  <input tabindex="4" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}" name="login" id="kc-login" type="submit" value="${msg("doLogIn")}"/>
                </div>
              </form>
            </#if>
            
            <#-- Provider buttons and action buttons (all styled consistently) -->
            <div class="action-buttons-section">
              <#-- Provider buttons (all rendered, filtered client-side by JavaScript) -->
              <#-- Includes regular IdPs (Google, Microsoft, etc.) and default-idp instances -->
              <#if social.providers?? && social.providers?size gt 0>
                <#list social.providers as p>
                  <a id="social-${p.alias}" class="action-button" href="${p.loginUrl}" <#if !allowed?seq_contains(p.alias)>style="display: none;"</#if>>
                    <div class="action-button-shine-1"></div>
                    <div class="action-button-shine-2"></div>
                    <div class="action-button-content">
                      <#if p.iconClasses?has_content>
                        <i class="${properties.kcCommonLogoIdP!} ${p.iconClasses!}" aria-hidden="true"></i>
                      </#if>
                      <#-- Default-idp instances have specific display names, regular IdPs use their displayName -->
                      <#if p.alias?starts_with("default-idp-")>
                        <#if p.alias?contains("guest")>
                          <span class="action-button-text">Continue as Guest</span>
                        <#elseif p.alias?contains("default")>
                          <svg class="action-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                          </svg>
                          <span class="action-button-text">Continue as Default Account</span>
                        <#else>
                          <span class="action-button-text">${p.displayName!}</span>
                        </#if>
                      <#else>
                        <span class="action-button-text">Continue with ${p.displayName!}</span>
                      </#if>
                    </div>
                  </a>
                </#list>
              </#if>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <#-- Load sparkles JavaScript from external file to avoid CSP issues -->
    <script src="${url.resourcesPath}/js/sparkles.js"></script>
  </#if>
</@layout.registrationLayout>
