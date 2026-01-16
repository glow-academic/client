<#import "template.ftl" as layout>
<#include "providers.ftl">

<@layout.registrationLayout displayInfo=social.displayInfo; section>
  <#if section = "form">
    <div id="kc-form">
      <div id="kc-form-wrapper">
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
        
        <#-- Provider buttons (filtered by client_id) -->
        <#-- DEBUG: Check what's available -->
        <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; border: 1px solid #ccc; font-family: monospace; font-size: 12px;">
          <strong>DEBUG INFO:</strong><br/>
          social.providers exists: <#if social.providers??>yes<#else>no</#if><br/>
          social.providers size: ${(social.providers?size)!0}<br/>
          client.clientId: ${client.clientId!""}<br/>
          <#if social.providers??>
            <#assign cid = client.clientId!"" />
            <#assign allowed = getAllowedProviders(cid) />
            allowed providers: ${allowed?join(", ")}<br/>
            <#list social.providers as p>
              provider alias seen: ${p.alias}<br/>
            </#list>
          </#if>
        </div>
        
        <#if social.providers?? && social.providers?size gt 0>
          <#assign cid = client.clientId!"" />
          <#assign allowed = getAllowedProviders(cid) />
          
          <#if allowed?size gt 0>
            <div id="kc-social-providers" class="${properties.kcFormSocialAccountSectionClass!}">
              <hr/>
              <h4>${msg("identity-provider-login-label")}</h4>
              <ul class="${properties.kcFormSocialAccountListClass!} <#if social.providers?size gt 3>${properties.kcFormSocialAccountListGridClass!}</#if>">
                <#list social.providers as p>
                  <#if allowed?seq_contains(p.alias)>
                    <li>
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
                  </#if>
                </#list>
              </ul>
            </div>
          </#if>
        </#if>
      </div>
    </div>
  </#if>
</@layout.registrationLayout>
