"use strict";

// Use the following patterns to check for on-screen Microsoft elements

const EMAIL_PATTERN_DETECTION_SELECTORS = [
  "input[type='email']",
];

const LOGIN_PATTERN_DETECTION_SELECTORS = [
  "[title='Log in with Microsoft']",
  "[aria-label*='Log in with Microsoft']",
  "[data-login-with-microsoft='']",
  "[href*='login.microsoftonline.com']",
  "[href*='login.live.com']",
  "[href*='login.xbox.com']",
  "[href*='github.com/login']",
  "[href*='linkedin.com/login']",
  "[href*='linkedin.com/uas']",
  "[href*='signin/microsoft']",
  "[href*='connect/microsoft']",
  "[data-oauthserver*='microsoft']",
  "[data-test*='login-with-microsoft']",
  "[data-testid*='microsoft-login']",
  "[class*='microsoft-login']",
  "[class*='ms-login']",
  "[id*='microsoft-login']",
  ".btn-microsoft",
  ".button-login.microsoft-login",
  "[action*='microsoft_login']",
  "[action*='microsoft_signup']",
  "[action*='github.com/session']"
];

// TODO: Disarm click events on detected elements
const SHARE_PATTERN_DETECTION_SELECTORS = [
  "[href*='linkedin.com/sharing/share-offsite']",
  "[href*='teams.microsoft.com/share']",
  "[aria-label*='share on teams']",
  "[title='Share on LinkedIn']"
];

// TODO: Disarm click events on detected elements
const PASSIVE_SHARE_PATTERN_DETECTION_SELECTORS = [
  "[href*='linkedin.com/share']",
];

async function getLocalStorageSettingFromBackground(setting) {
  // Send request to background determine if to show Relay email field prompt
  const backgroundResp = await browser.runtime.sendMessage({
    message: "check-settings",
    setting
  });

  return backgroundResp;
}

function isFixed (elem) {
  do {
    if (getComputedStyle(elem).position === "fixed") return true;
  } while ((elem = elem.offsetParent));
  return false;
}

const fragmentClasses = ["mhc-badge-fence", "mhc-badge-tooltip", "mhc-badge-prompt"];

function getTooltipFragmentStrings(socialAction) {
  switch (socialAction) {
  case "login":
    return browser.i18n.getMessage("inPageUI-tooltip-button-login");
  case "share":
    return browser.i18n.getMessage("inPageUI-tooltip-button-share");
  case "share-passive":
    return browser.i18n.getMessage("inPageUI-tooltip-button-share-passive");
  case "email":
    return browser.i18n.getMessage("inPageUI-tooltip-button-email");
  default:
    return "";
  }
}

function buildSettingsObject() {
  const data = {};
  const checkboxes = document.querySelectorAll(".settings-checkbox");

  checkboxes.forEach((item) => {
    const settingName = item.id;
    if (settingName) {
      data[settingName] = Boolean(item.checked);
    }
  });

  return data;
}

async function updateSettings() {

  const storedData = await browser.storage.local.get();

  if (!storedData.settings) {
    storedData.settings = {};
  }

  const checkboxes = document.querySelectorAll(".settings-checkbox");

  checkboxes.forEach((item) => {
    const settingName = item.id;
    item.checked = Boolean(storedData.settings[settingName]);
  });

  settingsCheckboxListener();
}

function settingsCheckboxListener() {
  const checkboxes = document.querySelectorAll(".settings-checkbox");

  checkboxes.forEach((item) => {
    if (item.dataset.mhcListenerAttached) {
      return;
    }
    item.dataset.mhcListenerAttached = "true";
    item.addEventListener("change", async () => {
      const settings = buildSettingsObject();
      await browser.runtime.sendMessage({
        message: "update-settings",
        settings
      });
    });
  });
}

function createBadgeFragment(socialAction) {
  const htmlBadgeFragment = document.createDocumentFragment();

  for (let className of fragmentClasses) {
    const div = document.createElement("div");
    div.className = className;
    htmlBadgeFragment.appendChild(div);
  }

  // Create Tooltip
  const htmlBadgeFragmentTooltipDiv = htmlBadgeFragment.querySelector(".mhc-badge-tooltip");
  htmlBadgeFragmentTooltipDiv.appendChild(document.createTextNode(getTooltipFragmentStrings(socialAction)));

  // Create Empty Wrapper Div
  const htmlBadgeWrapperDiv = document.createElement("div");
  htmlBadgeWrapperDiv.appendChild(htmlBadgeFragment);

  return htmlBadgeWrapperDiv;
}

function shouldBadgeBeSmall(ratioCheck, itemHeight) {
  if (ratioCheck < 1.1) {
    return true;
  } else if (itemHeight < 39) {
    return true;
  }
  return false;
}

function createElementWithClassList(elemType, elemClass) {
  const newElem = document.createElement(elemType);
  newElem.classList.add(elemClass);
  return newElem;
}

function buildInpageIframe(socialAction, mhcIframeHeight) {

  const iframe = document.createElement("iframe");
  let pageUrlParam = "";
  try {
    pageUrlParam = `&pageUrl=${encodeURIComponent(window.location.href)}`;
  } catch (_e) {
    pageUrlParam = "";
  }
  iframe.src = browser.runtime.getURL(`inpage-content.html?action=${encodeURIComponent(socialAction)}${pageUrlParam}`);
  iframe.width = 350;
  // This height is derived from the Figma file. However, this is just the starting instance of the iframe/inpage menu. After it's built out, it resizes itself based on the inner contents.
  iframe.height = mhcIframeHeight;
  iframe.title = browser.i18n.getMessage("megahardContainer");
  iframe.tabIndex = 0;
  iframe.setAttribute("aria-hidden", "false");
  iframe.id = `mhc-iframe-${socialAction}`;
  iframe.classList.add("mhc-content-box");

  return iframe;
}

function injectIframeOntoPage(socialAction, mhcIframeHeight) {
  const mhcContent = buildInpageIframe(socialAction, mhcIframeHeight);

  const mhcWrapper = createElementWithClassList(
    "div",
    "mhc-wrapper"
  );
  const mhcChevron = createElementWithClassList(
    "div",
    "mhc-iframe-chevron"
  );

  mhcWrapper.appendChild(mhcChevron);
  mhcWrapper.appendChild(mhcContent);

  return mhcWrapper;
}

function positionIframe(fencePos) {
  if (!fencePos || typeof fencePos.getBoundingClientRect !== "function") {
    return;
  }
  const fencePosition = fencePos.getBoundingClientRect();
  const iframeBox = document.querySelector(".mhc-content-box");
  const iframeWrapper = document.querySelector(".mhc-wrapper");
  if (!iframeBox || !iframeWrapper) {
    return;
  }
  const iframeElement = iframeWrapper.getElementsByTagName("iframe");
  const iframeChevron = document.querySelector(".mhc-iframe-chevron");
  if (!iframeChevron) {
    return;
  }

  const offsetX = 20;
  const offsetY = 55;

  const iframePaddingAllowance = iframeBox.offsetWidth + offsetX;

  const iconRightAllowance = window.innerWidth - fencePosition.x + fencePos.offsetWidth;
  const iconLeftAllowance = window.innerWidth - iconRightAllowance;

  if (iconRightAllowance > iframePaddingAllowance || iconLeftAllowance > iframePaddingAllowance) {
    return desktopOrientation(iframeBox, iframeChevron, offsetY, fencePosition, iframePaddingAllowance, fencePos, offsetX);
  }
  return mobileOrientation(iframeElement, iframeChevron, iframeBox, fencePosition, offsetY);
}

function mobileOrientation(iframeElement, iframeChevron, iframeBox, fencePosition, offsetY){
  // Mobile Values
  const xPosMobile = fencePosition.x;
  const yPosMobile = fencePosition.y + offsetY;

  for (const panels of iframeElement) {
    panels.width = window.innerWidth;
    if (window.innerWidth > 480) {
      panels.width = 350;
    }
  }

  iframeChevron.classList.add("mhc-chevron-arrow-top");
  iframeBox.style.marginTop = `${yPosMobile}px`;

  const xPosChevronMobile = xPosMobile;
  const yPosChevronMobile = yPosMobile - iframeChevron.offsetWidth;

  iframeChevron.style.marginLeft = `${xPosChevronMobile}px`;
  iframeChevron.style.marginTop = `${yPosChevronMobile}px`;
}

function desktopOrientation(iframeBox, iframeChevron, offsetY, fencePosition, iframePaddingAllowance, fencePos, offsetX) {
  // Desktop Values
  const xRight = fencePosition.x + offsetX + fencePos.offsetWidth;
  const xLeft = fencePosition.x - iframePaddingAllowance;
  const yPos = fencePosition.y - offsetY;

  // Position iframe relative to MHC Icon
  iframeBox.style.marginLeft = `${xRight}px`;
  iframeBox.style.marginTop = `${yPos}px`;

  // Add Chevron (Default left arrow)
  const xPosChevron = xRight - iframeChevron.offsetWidth;
  const yPosChevron = yPos + offsetY;

  iframeChevron.classList.remove("mhc-chevron-arrow-top");
  iframeChevron.style.marginLeft = `${xPosChevron}px`;
  iframeChevron.style.marginTop = `${yPosChevron}px`;

  const calculateOffsetDiff = window.innerWidth - fencePosition.x;

  // Flip the iframe to show on the left side when icon is too close to the edge
  if (iframePaddingAllowance > calculateOffsetDiff) {
    iframeBox.style.marginLeft = `${xLeft}px`;
    iframeChevron.classList.add("mhc-chevron-arrow-right");
    iframeChevron.style.marginLeft = `${xPosChevron - fencePos.offsetWidth - iframeChevron.offsetWidth - offsetX}px`;
    return;
  }
  return iframeChevron.classList.remove("mhc-chevron-arrow-right");
}



function openInputPrompt(socialAction, fencePos, target, mhcIframeHeight) {
  const iframeSrcVal = buildInpageIframe(socialAction, mhcIframeHeight).src;
  const hasMhcWrapper = document.querySelector(".mhc-wrapper");

  // Toggle behavior: close any existing prompt before opening a new one.
  if (hasMhcWrapper) {
    hasMhcWrapper.remove();
  }

  document.body.appendChild(injectIframeOntoPage(socialAction, mhcIframeHeight));
  positionIframe(fencePos);
  ensurePromptRepositionListener(fencePos);
  ensurePromptMessageListeners(iframeSrcVal, target);
}

let promptRepositionListenerInstalled = false;
function ensurePromptRepositionListener(fencePos) {
  if (promptRepositionListenerInstalled) {
    // Reposition immediately for the newly opened prompt; the shared
    // listener already handles future resize/scroll events.
    positionIframe(fencePos);
    return;
  }
  promptRepositionListenerInstalled = true;
  const reposition = () => {
    const wrapper = document.querySelector(".mhc-wrapper");
    if (wrapper) {
      positionIframe(fencePos);
    }
  };
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, {passive: true});
}

function getIframeOrigin(iframeSrcVal) {
  try {
    return new URL(iframeSrcVal).origin;
  } catch (_e) {
    return null;
  }
}

let promptMessageListenersInstalled = false;
let currentPromptTarget = null;
let currentPromptIframeOrigin = null;

function ensurePromptMessageListeners(iframeSrcVal, target){
  currentPromptTarget = target;
  currentPromptIframeOrigin = getIframeOrigin(iframeSrcVal);
  if (promptMessageListenersInstalled) {
    return;
  }
  promptMessageListenersInstalled = true;

  window.addEventListener("message", (e) => {
    if (
      e.data === "allowTriggered"
      && currentPromptIframeOrigin
      && e.origin === currentPromptIframeOrigin
      && currentPromptTarget
    ){
      currentPromptTarget.click();
    }
  });

  window.addEventListener("message", (e) => {
    if (
      e.data === "closeTheInjectedIframe"
      && currentPromptIframeOrigin
      && e.origin === currentPromptIframeOrigin
    ) {
      closeIframe();
    }
  });

  window.addEventListener("message", (e) => {
    if (
      e.data === "checkboxTicked"
      && currentPromptIframeOrigin
      && e.origin === currentPromptIframeOrigin
      && localStorageAvailable()
    ) {

      setLocalStorageTickedCheckBox();
    }
  });
}

function localStorageAvailable() {
  try {
    return typeof Storage !== "undefined";
  } catch (_e) {
    return false;
  }
}

function setLocalStorageTickedCheckBox() {
  localStorage.setItem("checkbox-ticked", "true");
}


function addMicrosoftBadge(target, badgeClassUId, socialAction) {
  // Detect if target is visible

  const htmlBadgeDiv = createBadgeFragment(socialAction);

  const htmlBadgeFragmentFenceDiv = htmlBadgeDiv.querySelector(".mhc-badge-fence");

  htmlBadgeDiv.className = "mhc-badge " + badgeClassUId;

  document.body.appendChild(htmlBadgeDiv);

  const itemWidth = Number(target.offsetWidth) || 0;
  const itemHeight = Number(target.offsetHeight) || 0;

  const ratioCheck = itemHeight ? (itemWidth / itemHeight) : 0;


  const badgeSmallSwitch = shouldBadgeBeSmall(ratioCheck, itemHeight);
  if (badgeSmallSwitch) {
    htmlBadgeDiv.classList.add("mhc-badge-small");
  }

  const mhcIframeHeightLogin = 230;
  const mhcIframeHeightEmail = 240;

  switch (socialAction) {
  case "login":
    htmlBadgeFragmentFenceDiv.addEventListener("click", (e) => {
      if (!e.isTrusted) {
        // The click was not user generated so ignore
        return false;
      }
  
      else {
        e.preventDefault();
        e.stopPropagation();
        openInputPrompt("login", e.target.parentElement, target, mhcIframeHeightLogin);    
      }
    });
    break;
  case "email":
    // Remove the email prompt when the "do not show me again" checkbox is ticked for the first time
    window.addEventListener("message", (e) => {
      if (
        e.data === "checkboxTicked"
        && localStorage.getItem("checkbox-ticked") === "true"
      ) {
        htmlBadgeFragmentFenceDiv.remove();
        closeIframe();
      }
    });
    htmlBadgeFragmentFenceDiv.addEventListener("click", (e) => {
      if (!e.isTrusted) {
        // The click was not user generated so ignore
        return false;
      }
      e.preventDefault();
      e.stopPropagation();
      openInputPrompt("email", e.target.parentElement, target, mhcIframeHeightEmail);
    });
    break;
  case "share-passive":
    htmlBadgeDiv.classList.add("mhc-badge-share-passive", "mhc-badge-share");
    shareBadgeEventListenerInit(target, htmlBadgeDiv, { allowClickThrough: true });
    break;
  case "share":
    htmlBadgeDiv.classList.add("mhc-badge-share");
    shareBadgeEventListenerInit(target, htmlBadgeDiv, { allowClickThrough: true });
    break;
  } 

  // Applies to both!
  htmlBadgeFragmentFenceDiv.addEventListener("mouseenter", () => {
    positionPrompt(htmlBadgeDiv);
  });

  positionMicrosoftBadge(target, badgeClassUId, itemWidth, badgeSmallSwitch);
}

// Add Event Listener actions/hooks to share badges
function shareBadgeEventListenerInit(target, htmlBadgeDiv, options) {
  if (!options.allowClickThrough) {
    target.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  let hoverTimer = null;
  target.addEventListener("mouseover", () => {
    target.classList.add("mhc-badge-tooltip-active");
    htmlBadgeDiv.classList.add("mhc-badge-tooltip-active");
    if (hoverTimer) {
      clearTimeout(hoverTimer);
    }
    hoverTimer = setTimeout(() => {
      positionPrompt(htmlBadgeDiv);
      hoverTimer = null;
    }, 50);
  });

  target.addEventListener("mouseout", () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    target.classList.remove("mhc-badge-tooltip-active");
    htmlBadgeDiv.classList.remove("mhc-badge-tooltip-active");
  });
}

function positionPrompt(activeBadge) {
  const elemRect = activeBadge.getBoundingClientRect();

  const modifierClassList = ["mhc-badge-prompt-align-top", "mhc-badge-prompt-align-bottom", "mhc-badge-prompt-align-right"];
  activeBadge.classList.remove(...modifierClassList);

  if (elemRect.top < 140) {
    activeBadge.classList.add("mhc-badge-prompt-align-top");
  } else if ((window.innerHeight - elemRect.bottom) < 130) {
    activeBadge.classList.add("mhc-badge-prompt-align-bottom");
  } else if ((window.innerWidth - elemRect.left) < 350) {
    activeBadge.classList.add("mhc-badge-prompt-align-right");
  }
}

function elementSizeOffsetXY(smallSwitch) {
  // [X, Y]
  if (smallSwitch) {
    return [12, 5];
  }
  return [20, 4];
}

function getOffsetsAndApplyClass(elemRect, target, htmlBadgeDiv) {
  if (!isFixed(target) && htmlBadgeDiv.classList.contains("mhc-badge-fixed")) {
    htmlBadgeDiv.classList.remove("mhc-badge-fixed");
  } else if (isFixed(target)) {
    htmlBadgeDiv.classList.add("mhc-badge-fixed");
    return { offsetPosX: elemRect.left, offsetPosY: elemRect.top };
  }
  return { offsetPosX: elemRect.left, offsetPosY: elemRect.top + window.scrollY };
}

function isVisible(target) {
  if (!target || typeof window.getComputedStyle !== "function") {
    return false;
  }
  let currentComputedStyle;
  try {
    currentComputedStyle = window.getComputedStyle(target, false);
  } catch (_e) {
    return false;
  }
  const styleTransform = (currentComputedStyle.getPropertyValue("transform") === "matrix(1, 0, 0, 0, 0, 0)");
  const styleHidden = (currentComputedStyle.getPropertyValue("visibility") === "hidden");
  const styleDisplayNone = (currentComputedStyle.getPropertyValue("display") === "none");
  if (styleTransform || styleHidden || styleDisplayNone) return false;
  return true;
}

function checkVisibilityAndApplyClass(target, htmlBadgeDiv) {

  if (!target || !htmlBadgeDiv) {
    if (htmlBadgeDiv) {
      htmlBadgeDiv.classList.add("mhc-badge-disabled");
    }
    return false;
  }

  const htmlBadgeDivHasDisabledClass = htmlBadgeDiv.classList.contains("mhc-badge-disabled");

  if (!isVisible(target)) {
    if (!htmlBadgeDivHasDisabledClass) {
      htmlBadgeDiv.classList.add("mhc-badge-disabled");
    }
    return false;
  }

  const { parentElement } = target;
  if (parentElement) {
    if (!isVisible(parentElement)) {
      if (!htmlBadgeDivHasDisabledClass) {
        htmlBadgeDiv.classList.add("mhc-badge-disabled");
      }
      return false;
    } else {
      if (htmlBadgeDivHasDisabledClass) {
        htmlBadgeDiv.classList.remove("mhc-badge-disabled");
      }
      return true;
    }
  }

  const { offsetParent } = target;
  if (offsetParent) {
    if (!isVisible(offsetParent)) {
      if (!htmlBadgeDivHasDisabledClass) {
        htmlBadgeDiv.classList.add("mhc-badge-disabled");
      }
      return false;
    } else {
      if (htmlBadgeDivHasDisabledClass) {
        htmlBadgeDiv.classList.remove("mhc-badge-disabled");
      }
      return true;
    }
  }
  return true;
}

function calcZindex(target) {
  // Loop through each parent, getting Zindex (if its a number).
  // As it finds them, it grabs the highest/largest.
  let zIndexLevel = 0;
  for (; target && target !== document; target = target.parentNode) {
    if (!target || typeof target !== "object" || !document.defaultView) {
      break;
    }
    let zindex = 0;
    try {
      zindex = document.defaultView.getComputedStyle(target).getPropertyValue("z-index");
    } catch (_e) {
      continue;
    }
    const parsed = parseInt(zindex, 10);
    if (!isNaN(parsed) && zIndexLevel < parsed) {
      zIndexLevel = parsed;
    }
  }

  // Take highest zindex in parent tree and adds one more.
  zIndexLevel = zIndexLevel + 2;
  return zIndexLevel;
}


function positionMicrosoftBadge(target, badgeClassUId, targetWidth, smallSwitch) {

  // screenUpdate() calls positionMicrosoftBadge(uid) with a single UID string
  // like "mhc-UID_1". Derive the badge class ("js-mhc-UID_1") in that case.
  if ((typeof badgeClassUId === "undefined" || badgeClassUId === null) && typeof target === "string") {
    badgeClassUId = "js-" + target;
  }
  if (!badgeClassUId || typeof badgeClassUId !== "string") {
    return;
  }

  const htmlBadgeDiv = document.querySelector("." + badgeClassUId);
  if (!htmlBadgeDiv) {
    return;
  }

  // Confirm target element is defined (screenUpdate passes UID strings)
  if (!target || typeof target !== "object") {
    try {
      target = document.querySelector("." + target);
    } catch (_e) {
      target = null;
    }
  }
  if (!target || typeof target.getBoundingClientRect !== "function") {
    htmlBadgeDiv.classList.add("mhc-badge-disabled");
    return;
  }

  if (!checkVisibilityAndApplyClass(target, htmlBadgeDiv)) {
    return;
  }

  if (typeof smallSwitch === "undefined") {
    if (htmlBadgeDiv.classList.contains("mhc-badge-small")) {
      smallSwitch = true;
    }
  }

  // Set offset size based on large/small badge
  const [elementSizeOffsetX, elementSizeOffsetY] = elementSizeOffsetXY(smallSwitch);

  // Define target element width
  if (!targetWidth) {
    targetWidth = Number(target.offsetWidth) || 0;
  }

  // Get position coordinates
  const elemRect = target.getBoundingClientRect();

  // Determine if target element is fixed, will resets or applies class and set appor offset.
  const { offsetPosX, offsetPosY } = getOffsetsAndApplyClass(elemRect, target, htmlBadgeDiv);

  const htmlBadgeDivPosX = (offsetPosX + targetWidth) - elementSizeOffsetX;
  const htmlBadgeDivPosY = offsetPosY - elementSizeOffsetY;

  // TODO: Add Zindex Targeting
  const targetZindex = calcZindex(target);


  // Set badge position based on target coordinates/size
  htmlBadgeDiv.style.zIndex = targetZindex;
  htmlBadgeDiv.style.left = htmlBadgeDivPosX + "px";
  htmlBadgeDiv.style.top = htmlBadgeDivPosY + "px";

}

function isPinterest(target) {
  const { parentElement } = target;
  if (parentElement) {
    const { previousElementSibling } = parentElement;
    if (previousElementSibling) {
      return previousElementSibling.classList.contains("mhc-has-badge");
    }
  }
  return false;
}

function parentIsBadged(target) {
  const { parentElement } = target;
  if (parentElement) {
    return parentElement.classList.contains("mhc-has-badge");
  }
  return false;
}

// List of badge-able in-page elements
const microsoftDetectedElementsArr = [];

function patternDetection(selectionArray, socialActionIntent){
  for (const selector of selectionArray) {
    let items;
    try {
      items = document.querySelectorAll(selector);
    } catch (_e) {
      continue;
    }

    for (let item of items) {
      // overlay the MHC icon badge on the item
      if (!item.classList.contains("mhc-has-badge") && !isPinterest(item) && !parentIsBadged(item)) {
        const itemUIDClassName = "mhc-UID_" + (microsoftDetectedElementsArr.length + 1);
        const itemUIDClassTarget = "js-" + itemUIDClassName;
        const socialAction = socialActionIntent;
        microsoftDetectedElementsArr.push(itemUIDClassName);
        addMicrosoftBadge(item, itemUIDClassTarget, socialAction);
        item.classList.add("mhc-has-badge");
        item.classList.add(itemUIDClassName);

      }
    }
  }
}

function isEmailBadgeAllowed(settingsValue, relayAddonEnabled, trackersDetectedOnCurrentPage, checkboxTicked) {
  // settingsValue may be the full settings object (legacy background
  // returns whole object) or a single boolean for hideRelayEmailBadges.
  let hideRelayEmailBadges = false;
  if (settingsValue && typeof settingsValue === "object") {
    hideRelayEmailBadges = Boolean(settingsValue.hideRelayEmailBadges);
  } else {
    hideRelayEmailBadges = Boolean(settingsValue);
  }
  return !hideRelayEmailBadges && !relayAddonEnabled && Boolean(trackersDetectedOnCurrentPage) && checkboxTicked !== "true";
}

async function detectMicrosoftOnPage () {
  if (!checkForTrackers) {
    return;
  }

  patternDetection(PASSIVE_SHARE_PATTERN_DETECTION_SELECTORS, "share-passive");
  patternDetection(SHARE_PATTERN_DETECTION_SELECTORS, "share");
  patternDetection(LOGIN_PATTERN_DETECTION_SELECTORS, "login");

  const relayAddonEnabled = await getRelayAddonEnabledFromBackground();

  // Check if any Microsoft trackers were blocked, scoped to only the active tab
  const trackersDetectedOnCurrentPage = await checkIfTrackersAreDetectedOnCurrentPage();

  // Check if user dismissed the Relay prompt
  const hideRelaySetting = await getLocalStorageSettingFromBackground("hideRelayEmailBadges");

  let checkboxTicked = null;
  try {
    checkboxTicked = localStorage.getItem("checkbox-ticked");
  } catch (_e) {
    checkboxTicked = null;
  }

  if (isEmailBadgeAllowed(hideRelaySetting, relayAddonEnabled, trackersDetectedOnCurrentPage, checkboxTicked)) {
    patternDetection(EMAIL_PATTERN_DETECTION_SELECTORS, "email");
    updateSettings();
  }

  escapeKeyListener();
}

// Resize listener. Only fires after window stops resizing.
let resizeId;

window.addEventListener("resize", () => {
  clearTimeout(resizeId);
  resizeId = setTimeout(screenUpdate, 25);
});

// On Scroll, checking for position fixed on elements
let ticking = false;

window.addEventListener("scroll", () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      screenUpdate();
      ticking = false;
    });

    ticking = true;
  }
});

// Fires on screen Resize or Scroll
function screenUpdate() {
  if (checkForTrackers) {
    for (let item of microsoftDetectedElementsArr) {
      positionMicrosoftBadge(item);
    }
  }
}

let escapeKeyListenerInstalled = false;
function escapeKeyListener() {
  if (escapeKeyListenerInstalled) {
    return;
  }
  escapeKeyListenerInstalled = true;
  document.body.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.querySelector(".mhc-wrapper")) {
      closeIframe();
    }
  });
}

window.addEventListener("click", function () {
  if (this.document.querySelector(".mhc-wrapper")) {
    closeIframe();
  }
});


function closeIframe() {
  const hasMhcWrapper = document.querySelector(".mhc-wrapper");
  if (!hasMhcWrapper) {
    return;
  }
  hasMhcWrapper.remove();
  currentPromptTarget = null;
  currentPromptIframeOrigin = null;
}

let checkForTrackers = true;

browser.runtime.onMessage.addListener(message => {
  if (!message || typeof message.msg === "undefined") {
    return Promise.resolve({ response: "content_script onMessage listener" });
  }
  if (message.msg === "allowed-microsoft-subresources" || message.msg === "microsoft-domain") {
    // Flags function to not add badges to page
    checkForTrackers = false;
  } else {
    setTimeout(() => {
      contentScriptInit(true);
    }, 10);
  }

  return Promise.resolve({ response: "content_script onMessage listener" });
});

let contentScriptDelay = 999;

async function contentScriptInit(resetSwitch) {
  if (resetSwitch) {
    contentScriptDelay = 999;
    contentScriptSetTimeout();
  }

  // Resource call is not in megahaRd/Microsoft Domain and is a Microsoft resource
  if (checkForTrackers) {
    await detectMicrosoftOnPage();
    screenUpdate();
  }
}

async function getRelayAddonEnabledFromBackground() {
  const relayAddonEnabled = await browser.runtime.sendMessage({
    message: "get-relay-enabled"
  });
  return relayAddonEnabled;
}

async function checkIfTrackersAreDetectedOnCurrentPage() {
  const trackersDetected = await browser.runtime.sendMessage({
    message: "are-trackers-detected"
  });
  return trackersDetected;
}

async function getRootDomainFromBackground(url) {
  // Send request to background to parse URL via PSL
  const backgroundResp = await browser.runtime.sendMessage({
    message: "get-root-domain",
    url
  });

  return backgroundResp;
}

async function CheckIfURLShouldBeBlocked() {
  const siteList = await browser.runtime.sendMessage({
    message: "what-sites-are-added"
  });

  const site = await getRootDomainFromBackground(window.location.href);

  if (Array.isArray(siteList) && site && siteList.includes(site)) {
    checkForTrackers = false;
  } else {
    await contentScriptInit(false);
  }

}

// Cross-browser implementation of element.addEventListener()
function addPassiveWindowOnloadListener() {
  window.addEventListener("load", function() {
    CheckIfURLShouldBeBlocked();
  }, false);
}

addPassiveWindowOnloadListener();

function contentScriptSetTimeout() {
  contentScriptDelay = Math.ceil(contentScriptDelay * 2);
  contentScriptInit(false);
  if (contentScriptDelay > 999999) {
    return false;
  }
  setTimeout(contentScriptSetTimeout, contentScriptDelay);
}
