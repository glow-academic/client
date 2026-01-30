/**
 * Icons.tsx
 * Resource component for icon picker fields
 * Uses SelectableGrid to display icons as horizontal scrollable cards
 * Manages icon_id and reports to parent (pre-defined icons, no resource creation needed)
 */
"use client";
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Icons = Icons;
var jsx_runtime_1 = require("react/jsx-runtime");
var SelectableGrid_1 = require("@/components/common/forms/SelectableGrid");
var button_1 = require("@/components/ui/button");
var label_1 = require("@/components/ui/label");
var tooltip_1 = require("@/components/ui/tooltip");
var utils_1 = require("@/lib/utils");
var persona_icons_1 = require("@/utils/persona-icons");
var lucide_react_1 = require("lucide-react");
var react_1 = require("react");
function Icons(_a) {
    var _b, _c;
    var icon_id = _a.icon_id, icon_resource = _a.icon_resource, _d = _a.show_icon, show_icon = _d === void 0 ? false : _d, icon_suggestions = _a.icon_suggestions, icons = _a.icons, _e = _a.disabled, disabled = _e === void 0 ? false : _e, onIconIdChange = _a.onIconIdChange, _f = _a.label, label = _f === void 0 ? "Icon" : _f, _g = _a.id, id = _g === void 0 ? "icon" : _g, _h = _a.required, required = _h === void 0 ? false : _h, _j = _a.searchTerm, searchTerm = _j === void 0 ? "" : _j, onSearchChange = _a.onSearchChange, _k = _a.showSelectedFilter, showSelectedFilter = _k === void 0 ? false : _k, onShowSelectedChange = _a.onShowSelectedChange, group_id = _a.group_id, agent_id = _a.agent_id, onGenerate = _a.onGenerate, _l = _a.isGenerating, isGenerating = _l === void 0 ? false : _l, 
    // Legacy props for backward compatibility
    iconResource = _a.iconResource, _iconId = _a.iconId, allIcons = _a.allIcons, _m = _a.suggestedIcons, suggestedIcons = _m === void 0 ? [] : _m, iconSuggestions = _a.iconSuggestions, 
    // AI diff view props
    aiResource = _a.aiResource, onAccept = _a.onAccept, onReject = _a.onReject;
    // Use standardized props with fallback to legacy props
    var resource = (_b = icon_resource !== null && icon_resource !== void 0 ? icon_resource : iconResource) !== null && _b !== void 0 ? _b : null;
    var currentId = (_c = icon_id !== null && icon_id !== void 0 ? icon_id : _iconId) !== null && _c !== void 0 ? _c : null;
    var show = show_icon !== null && show_icon !== void 0 ? show_icon : false;
    var suggestionsList = (0, react_1.useMemo)(function () { var _a; return (_a = icon_suggestions !== null && icon_suggestions !== void 0 ? icon_suggestions : iconSuggestions) !== null && _a !== void 0 ? _a : []; }, [icon_suggestions, iconSuggestions]);
    var allIconsArray = (0, react_1.useMemo)(function () { return icons !== null && icons !== void 0 ? icons : []; }, [icons]);
    // AI suggestion state
    var showDiff = !!(aiResource === null || aiResource === void 0 ? void 0 : aiResource.id);
    var aiSuggestedId = (aiResource === null || aiResource === void 0 ? void 0 : aiResource.id) || null;
    // Accept AI suggestion - update icon selection
    var handleAccept = (0, react_1.useCallback)(function () {
        if (!(aiResource === null || aiResource === void 0 ? void 0 : aiResource.id))
            return;
        onIconIdChange(aiResource.id);
        onAccept === null || onAccept === void 0 ? void 0 : onAccept();
    }, [aiResource, onIconIdChange, onAccept]);
    // Reject AI suggestion - just clear the pending state
    var handleReject = (0, react_1.useCallback)(function () {
        onReject === null || onReject === void 0 ? void 0 : onReject();
    }, [onReject]);
    // Convert icons array to IconItem format for SelectableGrid
    var iconItems = (0, react_1.useMemo)(function () {
        if (allIconsArray.length > 0) {
            return allIconsArray
                .filter(function (i) { return i.id && i.value; }) // Filter out nulls
                .map(function (i) {
                var _a;
                return (__assign({ id: i.id, name: (_a = i.name) !== null && _a !== void 0 ? _a : i.value, value: i.value }, (i.description ? { description: i.description } : {})));
            });
        }
        // Fallback for legacy allIcons prop (array of icon names/values)
        if (allIcons && allIcons.length > 0) {
            return allIcons.map(function (iconName) { return ({
                id: iconName,
                name: iconName,
                value: iconName,
            }); });
        }
        return [];
    }, [allIconsArray, allIcons]);
    // Get suggested icon IDs
    var suggestedIconIds = (0, react_1.useMemo)(function () {
        if (suggestionsList.length > 0) {
            return new Set(suggestionsList);
        }
        // Legacy: suggestedIcons are icon values, need to map to IDs
        if (suggestedIcons.length > 0 && iconItems.length > 0) {
            var ids_1 = new Set();
            suggestedIcons.forEach(function (iconValue) {
                var item = iconItems.find(function (i) { return i.value === iconValue; });
                if (item)
                    ids_1.add(item.id);
            });
            return ids_1;
        }
        return new Set();
    }, [suggestionsList, suggestedIcons, iconItems]);
    // Check if an icon is suggested
    var isSuggested = (0, react_1.useCallback)(function (iconId) { return suggestedIconIds.has(iconId); }, [suggestedIconIds]);
    // Filter icons based on search term and showSelectedFilter
    var displayIcons = (0, react_1.useMemo)(function () {
        var filtered = iconItems;
        // Filter to show only selected if showSelectedFilter is true
        if (showSelectedFilter && currentId) {
            filtered = filtered.filter(function (item) { return item.id === currentId; });
        }
        // Filter by search term
        if (searchTerm.trim()) {
            var searchLower_1 = searchTerm.toLowerCase();
            filtered = filtered.filter(function (item) {
                return item.name.toLowerCase().includes(searchLower_1) ||
                    item.value.toLowerCase().includes(searchLower_1);
            });
        }
        return filtered;
    }, [iconItems, searchTerm, showSelectedFilter, currentId]);
    // Handle icon selection - just update parent state directly
    var handleSelect = (0, react_1.useCallback)(function (iconId) {
        // Toggle selection (single-select)
        var newId = iconId === currentId ? null : iconId;
        onIconIdChange(newId);
    }, [currentId, onIconIdChange]);
    // Check if any icon resource is generated
    var hasGenerated = (0, react_1.useMemo)(function () {
        var _a;
        return (_a = resource === null || resource === void 0 ? void 0 : resource.generated) !== null && _a !== void 0 ? _a : false;
    }, [resource]);
    // Don't render if show_icon is false (AFTER all hooks)
    if (!show) {
        return null;
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 min-w-0 w-full", children: [label && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)(label_1.Label, { htmlFor: id, className: "flex items-center gap-1", children: [label, required && (0, jsx_runtime_1.jsx)("span", { className: "text-destructive", children: "*" })] }), onGenerate && ((0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "ghost", size: "icon", className: "h-6 w-6", onClick: onGenerate, disabled: disabled || isGenerating || showDiff, children: isGenerating ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-3.5 w-3.5 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "h-3.5 w-3.5" })) }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { children: hasGenerated ? "Regenerate" : "Generate" })] }) })), showDiff && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "ghost", size: "icon", className: "h-6 w-6 text-success hover:text-success", onClick: handleAccept, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "h-3.5 w-3.5" }) }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { children: "Accept" })] }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "ghost", size: "icon", className: "h-6 w-6 text-destructive hover:text-destructive", onClick: handleReject, children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-3.5 w-3.5" }) }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { children: "Reject" })] }) })] }))] })), (0, jsx_runtime_1.jsx)(SelectableGrid_1.SelectableGrid, { items: displayIcons, selectedId: currentId, onSelect: function (iconId) { return handleSelect(iconId); }, getId: function (item) { return item.id; }, renderItem: function (item, isSelected) {
                    var IconComponent = persona_icons_1.PERSONA_ICON_MAP[item.value];
                    if (!IconComponent)
                        return null;
                    var isAiSuggested = showDiff && item.id === aiSuggestedId;
                    return ((0, jsx_runtime_1.jsxs)("div", { className: (0, utils_1.cn)("relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]", "hover:shadow-md hover:bg-accent/50", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", isSelected && "ring-2 ring-primary bg-accent", isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"), children: [isSelected && ((0, jsx_runtime_1.jsx)("div", { className: "absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "h-3 w-3 text-primary-foreground" }) })), isAiSuggested && !isSelected && ((0, jsx_runtime_1.jsx)("div", { className: "absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium", children: "AI Suggested" })), isSuggested(item.id) && !isSelected && !isAiSuggested && ((0, jsx_runtime_1.jsx)("div", { className: "absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded", children: "Suggested" })), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center justify-center gap-1 flex-1 overflow-hidden", children: [(0, jsx_runtime_1.jsx)(IconComponent, { className: "h-7 w-7 text-foreground shrink-0" }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs font-medium text-center truncate w-full", children: item.name })] })] }));
                }, emptyMessage: "No icons found. Try adjusting your search.", disabled: disabled, horizontal: true })] }));
}
