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

                var links = document.querySelectorAll("#kc-social-providers a[id^='social-']");
                var visible = [];
                links.forEach(function (a) {
                  var alias = a.id.replace("social-", "");
                  var show = allowed.indexOf(alias) !== -1;
                  var li = a.closest("li");
                  if (li) {
                    li.style.display = show ? "" : "none";
                    if (show) visible.push(a);
                  }
                });

                // Auto-redirect if only one visible
                if (visible.length === 1) {
                  window.location.href = visible[0].href;
                  return;
                }

                // Update guest link
                var guest = document.getElementById("guest-link");
                if (guest) {
                  var gb = new URL(guest.getAttribute("data-base"), window.location.origin);
                  if (dept) {
                    gb.searchParams.set("department", dept);
                  } else {
                    gb.searchParams.delete("department");
                  }
                  guest.href = gb.toString();
                }
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
        
        <#-- Auto-redirect if only one provider for selected department (server-side check) -->
        <#-- Note: Client-side JavaScript will handle this dynamically when department changes -->
        <#if social.providers?? && allowed?size == 1>
          <#assign targetAlias = allowed[0] />
          <#list social.providers as p>
            <#if p.alias == targetAlias>
              <script>
                // Only auto-redirect on initial page load, not on department change
                (function() {
                  var urlParams = new URLSearchParams(window.location.search);
                  var deptFromUrl = urlParams.get("department") || "";
                  var deptFromServer = "${departmentId}";
                  // Only redirect if URL param matches server-rendered department (initial load)
                  if (deptFromUrl === deptFromServer) {
                    window.location.href = "${p.loginUrl}";
                  }
                })();
              </script>
            </#if>
          </#list>
        </#if>
        
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
        
        <#-- Provider buttons (all rendered, filtered client-side by JavaScript) -->
        <#-- Server-side filtering provides initial state, JS handles dynamic changes -->
        <#if social.providers?? && social.providers?size gt 0>
          <div id="kc-social-providers" class="${properties.kcFormSocialAccountSectionClass!}">
            <hr/>
            <h4>${msg("identity-provider-login-label")}</h4>
            <ul class="${properties.kcFormSocialAccountListClass!} <#if social.providers?size gt 3>${properties.kcFormSocialAccountListGridClass!}</#if>">
              <#list social.providers as p>
                <li <#if !allowed?seq_contains(p.alias)>style="display: none;"</#if>>
                  <a id="social-${p.alias}" 
                     class="${properties.kcFormSocialAccountListButtonClass!} <#if social.providers?size gt 3>${properties.kcFormSocialAccountGridItem!}</#if>"
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
              </#list>
            </ul>
          </div>
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
            <a id="guest-link" data-base="${appBase}/login" class="guest-button" href="${guestUrl}">
              Continue as Guest
            </a>
          </div>
        </#if>
      </div>
    </div>
  </#if>
</@layout.registrationLayout>
