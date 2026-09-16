
const url = window.location.href;

let action = null;
let pageUrl = null;
try {
  const params = new URL(url).searchParams;
  action = params.get("action");
  pageUrl = params.get("pageUrl");
} catch (_e) {
  action = null;
  pageUrl = null;
}

function getParentOrigin() {
  if (!pageUrl) {
    return "*";
  }
  try {
    return new URL(pageUrl).origin;
  } catch (_e) {
    return "*";
  }
}

const loginItem = document.getElementById("mhc-login");
const emailItem = document.getElementById("mhc-email");

if (action === "login" && loginItem) {
  loginItem.classList.remove("is-hidden");
}

if (action === "email" && emailItem) {
  emailItem.classList.remove("is-hidden");
}

// Header String
const mhcTitle = document.querySelector(".mhc-title");
mhcTitle.textContent = browser.i18n.getMessage("megahardContainer");

// Login Strings
const mhcPromptSubtitleLogin = document.querySelector(".mhc-subtitle-login");
mhcPromptSubtitleLogin.textContent = browser.i18n.getMessage("inPageUI-tooltip-prompt-p1");

const mhcPromptBodyTextLogin = document.querySelector(".mhc-bodytext-login");
mhcPromptBodyTextLogin.textContent = browser.i18n.getMessage("inPageUI-tooltip-prompt-p2");

const mhcPromptAllow = document.querySelector(".mhc-badge-prompt-btn-allow");
const mhcPromptCancel = document.querySelector(".mhc-badge-prompt-btn-cancel");

mhcPromptAllow.textContent = browser.i18n.getMessage("btn-allow");
mhcPromptCancel.textContent = browser.i18n.getMessage("btn-cancel");

mhcPromptAllow.addEventListener("click", (e) => {
  if (!e.isTrusted) {
    // The click was not user generated so ignore
    e.preventDefault();
    return false;
  }
  browser.runtime.sendMessage({
    message: "add-domain-to-list",
    // Explicit page URL: sender.url for this extension iframe is the
    // moz-extension:// URL, not the web page. Background falls back to
    // sender.tab.url for older content scripts without pageUrl.
    url: pageUrl
  });

  // Launch microsoft authentication
  parent.postMessage("allowTriggered", getParentOrigin());

});

// Email Strings
const mhcEmailSubtitleLogin = document.querySelector(".mhc-subtitle-email");
mhcEmailSubtitleLogin.textContent = browser.i18n.getMessage("inPageUI-tooltip-email-prompt-p1");

const mhcEmailBodyTextLogin = document.querySelector(".mhc-bodytext-email");
mhcEmailBodyTextLogin.textContent = browser.i18n.getMessage("inPageUI-tooltip-email-prompt-p2");

const mhcEmailCheckbox = document.querySelector(".mhc-email-checkbox");
mhcEmailCheckbox.textContent = browser.i18n.getMessage("inPageUI-tooltip-prompt-checkbox");

const mhcEmailAllow = document.querySelector(".mhc-badge-email-btn-cta-fx-relay");
const mhcEmailCancel = document.querySelector(".mhc-badge-email-btn-dismiss");

mhcEmailAllow.textContent = browser.i18n.getMessage("btn-relay-try");
mhcEmailCancel.textContent = browser.i18n.getMessage("btn-relay-dismiss");

// Checkbox
const mhcCheckboxes = document.querySelectorAll(".settings-checkbox");

mhcCheckboxes.forEach(e => {
  e.addEventListener("change", () => {
    parent.postMessage("checkboxTicked", getParentOrigin());
  });
});

// Launch Relay when Try Relay is clicked
mhcEmailAllow.addEventListener("click", (e) => {
  if (!e.isTrusted) {
    // The click was not user generated so ignore
    return false;
  }
  window.open("https://relay.firefox.com/?utm_source=firefox&utm_medium=addon&utm_campaign=megahaRd&utm_content=Try%20Firefox%20Relay", "_blank", "noopener");
});

// // Remove popup when cancel/dismiss is clicked
[mhcPromptCancel, mhcEmailCancel].forEach(e => {
  if (!e) {
    return;
  }
  e.addEventListener("click", () => {
    parent.postMessage("closeTheInjectedIframe", getParentOrigin());
  });
});





