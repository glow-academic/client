// Handle loading states for action buttons
(function () {
  "use strict";

  // Wait for DOM to be ready
  function init() {
    var actionButtons = document.querySelectorAll(".action-button");

    actionButtons.forEach(function (button) {
      button.addEventListener("click", function (e) {
        // Get loading text from data attribute
        var loadingText =
          button.getAttribute("data-loading-text") || "Signing in...";

        // Show loading state
        button.classList.add("action-button-loading");
        button.style.pointerEvents = "none";

        // Hide icon and normal text
        var icon = button.querySelector(".action-button-icon");
        var text = button.querySelector(".action-button-text");
        var spinner = button.querySelector(".action-button-spinner");
        var loadingTextSpan = button.querySelector(
          ".action-button-loading-text"
        );

        if (icon) icon.style.display = "none";
        if (text) text.style.display = "none";

        // Show spinner and loading text
        if (spinner) {
          spinner.style.display = "inline-block";
        }
        if (loadingTextSpan) {
          loadingTextSpan.textContent = loadingText;
          loadingTextSpan.style.display = "inline-block";
        }

        // Allow navigation to proceed
        // The button's href will handle the redirect
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
