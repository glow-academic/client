<#import "template.ftl" as layout>
<#include "providers.ftl">

<@layout.registrationLayout displayInfo=social.displayInfo; section>
  <#if section = "form">
    <div id="kc-form">
      <div id="kc-form-wrapper">
        <#-- Read department from URL parameter (param is available in Keycloak FreeMarker) -->
        <#assign departmentId = "" />
        <#if param?? && param.department??>
          <#assign departmentId = param.department?string />
        </#if>
        <#assign allowed = getAllowedProvidersForDepartment(departmentId) />
        
        <#-- Department Picker -->
        <#if departments?size gt 0>
          <div class="${properties.kcFormGroupClass!}" style="margin-bottom: 20px;">
            <label for="department" class="${properties.kcLabelClass!}">Department</label>
            <select id="department" name="department" class="${properties.kcInputClass!}" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
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
              
              select.addEventListener("change", function () {
                var dept = select.value || "";
                var url = new URL(window.location.href);
                
                if (dept) {
                  url.searchParams.set("department", dept);
                } else {
                  url.searchParams.delete("department");
                }
                
                // Reload to let FTL render correct provider set
                window.location.href = url.toString();
              });
            })();
          </script>
        </#if>
        
        <#-- Auto-redirect if only one provider for selected department -->
        <#if social.providers?? && allowed?size == 1>
          <#assign targetAlias = allowed[0] />
          <#list social.providers as p>
            <#if p.alias == targetAlias>
              <script>
                window.location.href = "${p.loginUrl}";
              </script>
            </#if>
          </#list>
        </#if>
        
        <#-- JavaScript fallback: Read department from URL if param not available (for robustness) -->
        <script>
          (function () {
            // Fallback: if departmentId is empty, try reading from URL
            var departmentId = "${departmentId}";
            if (!departmentId) {
              var urlParams = new URLSearchParams(window.location.search);
              departmentId = urlParams.get("department") || "";
            }
            
            // Store department mapping for client-side filtering fallback
            var allowedProvidersByDept = {
              <#list allowedProvidersByDept?keys as deptId>
              "${deptId}": [<#list allowedProvidersByDept[deptId] as alias>"${alias}"<#sep>, </#list>]<#sep>,
              </#list>
            };
            var platformProviders = [<#list platformProviders as p>"${p}"<#sep>, </#list>];
            
            // Fallback filtering function (only used if server-side filtering didn't work)
            function getAllowedProvidersFallback(deptId) {
              if (deptId && allowedProvidersByDept[deptId] && allowedProvidersByDept[deptId].length > 0) {
                return allowedProvidersByDept[deptId];
              }
              return platformProviders;
            }
            
            // Only apply fallback filtering if needed (when param wasn't available)
            <#if !departmentId?has_content>
            document.addEventListener("DOMContentLoaded", function() {
              var allowed = getAllowedProvidersFallback(departmentId);
              var providerLinks = document.querySelectorAll("#kc-social-providers a[id^='social-']");
              var visibleCount = 0;
              var firstVisibleLink = null;
              
              providerLinks.forEach(function(link) {
                var alias = link.id.replace("social-", "");
                if (allowed.indexOf(alias) === -1) {
                  link.parentElement.style.display = "none";
                } else {
                  visibleCount++;
                  if (!firstVisibleLink) {
                    firstVisibleLink = link;
                  }
                }
              });
              
              // Auto-redirect if only one provider
              if (visibleCount === 1 && firstVisibleLink) {
                window.location.href = firstVisibleLink.href;
              }
            });
            </#if>
          })();
        </script>
        
        <#-- Username/password form (from base theme) -->
        <#if realm.password>
          <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
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
        
        <#-- Provider buttons (filtered by department server-side) -->
        <#if social.providers?? && social.providers?size gt 0>
          <#if allowed?size gt 0>
            <div id="kc-social-providers" class="${properties.kcFormSocialAccountSectionClass!}">
              <hr/>
              <h4>${msg("identity-provider-login-label")}</h4>
              <ul class="${properties.kcFormSocialAccountListClass!} <#if allowed?size gt 3>${properties.kcFormSocialAccountListGridClass!}</#if>">
                <#list social.providers as p>
                  <#if allowed?seq_contains(p.alias)>
                    <li>
                      <a id="social-${p.alias}" 
                         class="${properties.kcFormSocialAccountListButtonClass!} <#if allowed?size gt 3>${properties.kcFormSocialAccountGridItem!}</#if>"
                         type="button" 
                         href="${p.loginUrl}">
                        <#if p.iconClasses?has_content>
                          <i class="${properties.kcCommonLogoIdP!} ${p.iconClasses!}" aria-hidden="true"></i>
                          <span class="${properties.kcFormSocialAccountNameClass!} kc-social-icon-text">${p.displayName!}</span>
                        <#else>
                          <span class="${properties.kcFormSocialAccountNameClass!}">${p.displayName!}</span>
                        </#if>
                      </a>
                    </li>
                  </#if>
                </#list>
              </ul>
            </div>
          </#if>
        </#if>
        
        <#-- Continue as Guest button -->
        <#-- Link back to app login page - app will handle guest login -->
        <#assign appBase = client.baseUrl!"" />
        <#if appBase?has_content>
          <#assign guestUrl = appBase + "/login" />
          <#if departmentId?has_content>
            <#assign guestUrl = guestUrl + "?department=" + departmentId />
          </#if>
          
          <div style="margin-top: 20px;">
            <a class="guest-button" href="${guestUrl}">
              Continue as Guest
            </a>
          </div>
        </#if>
      </div>
    </div>
  </#if>
</@layout.registrationLayout>
