// megahaRd dashboard panel — single-screen, no onboarding.
//
// background.js drives which status we show via storage CURRENT_PANEL:
//   "on-microsoft" | "in-megahard" | "about" | "trackers-detected" | "no-trackers"
// This file renders all of them as one scrollable dashboard:
//   status card + current-site action + site lists + footer links.
//
// Message contract with background.js (must keep in sync):
//   "what-sites-are-added" -> [domains]
//   "remove-domain-from-list" {removeDomain}
//   "get-root-domain" {url} -> root domain
// Custom-site adds write storage directly (same shape background.js uses).

const clearPanel = (wrapper) => {
  const wrapperHeight = wrapper.clientHeight;
  wrapper.style.minHeight = wrapperHeight;

  while (wrapper.firstChild) {
    wrapper.removeChild(wrapper.firstChild);
  }
};

const setUpPanel = () => {
  const page = document.body;
  clearPanel(page);

  const fragment = document.createDocumentFragment();

  // Clear Panel Notification Dot
  try {
    browser.browserAction.setBadgeText({text: ""});
  } catch (_e) {
    // Popup context may not allow badge updates; ignore.
  }

  return { page, fragment };
};

// Hero header: brand mark + localized "megahaRd" headline.
// The logo img carries no uiMessage class so localization leaves it alone.
const addHeader = (wrapper) => {
  const hero = document.createElement("div");
  hero.classList.add("dashboard-hero");
  const logo = document.createElement("img");
  logo.classList.add("dashboard-logo");
  logo.src = browser.runtime.getURL("img/icon.svg");
  logo.alt = "";
  hero.appendChild(logo);
  const el = document.createElement("h1");
  el.id = "megahardContainer";
  el.classList.add("uiMessage", "dashboard-title");
  hero.appendChild(el);
  wrapper.appendChild(hero);
  return el;
};

const addSubhead = (wrapper, panelId) => {
  const normalizedPanelId = (panelId === "about") ? "no-trackers" : panelId;
  const elemId = `${normalizedPanelId}-subhead`;
  const el = document.createElement("h2");
  el.id = elemId;
  // Subhead class drives the ::before fence icon in panel.css.
  el.classList.add("uiMessage", elemId);
  wrapper.appendChild(el);
  return el;
};

const addParagraph = (wrapper, stringId) => {
  const el = document.createElement("p");
  el.id = stringId;
  el.classList.add("uiMessage");
  wrapper.appendChild(el);
  return el;
};

const addDiv = (wrapper, className) => {
  const el = document.createElement("div");
  el.classList.add(className);
  wrapper.appendChild(el);
  return el;
};

// creates grey Microsoft text. Grey fence icon is set in CSS.
const addMicrosoftAndIcon = async () => {
  const el = document.createElement("p");
  el.innerText = "Microsoft";
  el.classList.add("Microsoft-text");
  return el;
};

const getActiveRootDomainFromBackground = async() => {
  // Get active page URL
  const tabsQueryResult = await browser.tabs.query({currentWindow: true, active: true});
  const currentActiveTab = tabsQueryResult && tabsQueryResult[0];
  if (!currentActiveTab || typeof currentActiveTab.url !== "string") {
    return null;
  }

  // Send request to background to parse URL via PSL
  const backgroundResp = await browser.runtime.sendMessage({
    message: "get-root-domain",
    url: currentActiveTab.url
  });

  return backgroundResp;
};

const isSiteInContainer = async(panelId) => {
  if (panelId === "on-microsoft") {
    // Site is on a default megahaRd domain. Show the "remove site" button, in a disabled state.
    return true;
  }

  const addedSitesList = await browser.runtime.sendMessage({
    message: "what-sites-are-added"
  });

  if (!Array.isArray(addedSitesList)) {
    return false;
  }

  const activeRootDomain = await getActiveRootDomainFromBackground();
  if (!activeRootDomain) {
    return false;
  }

  if (addedSitesList.includes(activeRootDomain)) {
    return true;
  }
  return false;
};

const addSiteToContainer = async () => {
  const activeRootDomain = await getActiveRootDomainFromBackground();
  if (!activeRootDomain) {
    window.close();
    return;
  }
  const megahardStorage = await browser.storage.local.get();
  const list = Array.isArray(megahardStorage.domainsAddedToMegahardContainer)
    ? megahardStorage.domainsAddedToMegahardContainer
    : [];
  if (!list.includes(activeRootDomain)) {
    list.push(activeRootDomain);
    await browser.storage.local.set({"domainsAddedToMegahardContainer": list});
  }
  browser.tabs.reload();
  window.close();
};

const removeSiteFromContainer = async (siteName) => {
  let domainToRemove = siteName;
  if (!domainToRemove) {
    domainToRemove = await getActiveRootDomainFromBackground();
  }
  if (domainToRemove) {
    await browser.runtime.sendMessage({
      message: "remove-domain-from-list",
      removeDomain: domainToRemove
    });
  }
  browser.tabs.reload();
  window.close();
};

const addLearnMoreLink = (fragment) => {
  const link = document.createElement("a");
  link.id = "learn-more";
  link.classList.add("uiMessage", "open-sumo");
  link.rel = "noopener noreferrer";
  link.href = "https://support.mozilla.org/kb/containers";
  fragment.appendChild(link);
  link.addEventListener("click", (e) => {
    e.preventDefault();
    browser.tabs.create({
      url: "https://support.mozilla.org/kb/containers"
    });
    window.close();
  });
};

const addRepoLink = (fragment) => {
  const link = document.createElement("a");
  link.classList.add("dashboard-footer-link");
  link.rel = "noopener noreferrer";
  link.href = "https://github.com/futurester0x0/megahaRd";
  link.textContent = "futurester0x0/megahaRd";
  fragment.appendChild(link);
  link.addEventListener("click", (e) => {
    e.preventDefault();
    browser.tabs.create({
      url: "https://github.com/futurester0x0/megahaRd"
    });
    window.close();
  });
};

// Fallback when the background page cannot be reached (should not happen in
// production; containment itself is driven by MICROSOFT_DOMAINS in
// background.js, exposed via the "get-microsoft-domains" message).
const FALLBACK_MICROSOFT_SITES = [
  "microsoft.com",
  "outlook.com",
  "office.com",
  "github.com",
  "xbox.com",
  "linkedin.com",
];

const getMicrosoftDomainsFromBackground = async() => {
  try {
    const domains = await browser.runtime.sendMessage({
      message: "get-microsoft-domains"
    });
    if (Array.isArray(domains) && domains.length > 0) {
      return domains.filter((domain) => typeof domain === "string" && domain);
    }
  } catch (_e) {
    // Fall through to the bundled fallback list.
  }
  return [...FALLBACK_MICROSOFT_SITES];
};

// Neutral letter tile (themed via .site-avatar in panel.css). Deliberately no
// per-domain colors and no remote favicons (which would leak panel opens).
const addSiteAvatar = (row, site) => {
  const iconDiv = addDiv(row, "allowed-site-icon");
  iconDiv.classList.add("site-avatar");
  iconDiv.textContent = site.charAt(0).toUpperCase();
  return iconDiv;
};

const appendSiteRow = (listsWrapper, site, removable) => {
  const row = addDiv(listsWrapper, "allowed-site-wrapper");
  if (!removable) {
    row.classList.add("default-allowed-site");
  }
  addSiteAvatar(row, site);
  const siteSpan = document.createElement("span");
  siteSpan.classList.add("site-name");
  siteSpan.textContent = site;
  row.appendChild(siteSpan);
  if (removable) {
    const button = document.createElement("button");
    button.classList.add("remove-site");
    button.setAttribute("aria-label", `Remove ${site}`);
    button.dataset.sitename = site;
    button.addEventListener("click", () => removeSiteFromContainer(site));
    row.appendChild(button);
  }
};

const makeSiteList = (listsWrapper, siteList, {removable} = {removable: false}) => {
  if (!Array.isArray(siteList) || siteList.length === 0) {
    const emptyWrapper = addDiv(listsWrapper, "allowed-site-wrapper");
    const emptySpan = document.createElement("span");
    emptySpan.id = "no-sites-added";
    emptySpan.classList.add("uiMessage");
    emptyWrapper.appendChild(emptySpan);
    return;
  }

  for (const site of siteList) {
    if (typeof site !== "string" || !site) {
      continue;
    }
    appendSiteRow(listsWrapper, site, removable);
  }
};

// Breaks strings with nested bold words out into separate spans
// and appends these to the wrapping paragraph element so that we
// don't have to use .innerHTML.

// Bold text must extend to the end of the string.
const formatText = (text, el) => {
  if (typeof text !== "string") {
    return;
  }
  const textChunks = text.split("*SPANSTART");
  if (textChunks.length < 2) {
    const span = document.createElement("span");
    span.textContent = text;
    el.appendChild(span);
    return;
  }

  let span = document.createElement("span");
  span.textContent = textChunks[0];
  el.appendChild(span);

  let nestedBoldText = textChunks[1].replace("*SPANEND", "");

  span = document.createElement("span");
  span.textContent = nestedBoldText;
  span.classList.add("bold");
  el.appendChild(span);
};

const getLocalizedStrings = async() => {
  const tabsQueryResult = await browser.tabs.query({currentWindow: true, active: true});
  const currentActiveTab = tabsQueryResult && tabsQueryResult[0];
  let currentHostname = "";
  if (currentActiveTab && typeof currentActiveTab.url === "string") {
    try {
      currentHostname = new URL(currentActiveTab.url).hostname;
    } catch (_e) {
      currentHostname = "";
    }
  }

  const uiMessages = document.querySelectorAll(".uiMessage");

  for (const el of uiMessages) {
    if (!el.id) {
      continue;
    }
    if (el.id.endsWith("Header") && currentHostname === "") {
      el.textContent = browser.i18n.getMessage("onUnknownSiteHeader");
      continue;
    }
    const text = browser.i18n.getMessage(el.id, currentHostname) || "";
    if (text.includes("*SPAN")) {
      formatText(text, el);
    } else {
      el.textContent = text;
    }
  }
};

const appendFragmentAndSetHeight = (page, fragment) => {
  page.appendChild(fragment);
  page.style.minHeight = 0;
};

// Single-screen dashboard for every CURRENT_PANEL value.
const VALID_PANELS = ["on-microsoft", "in-megahard", "about", "trackers-detected", "no-trackers"];
const buildDashboardPanel = async(panelId) => {
  if (!VALID_PANELS.includes(panelId)) {
    panelId = "no-trackers";
  }
  const { page, fragment } = setUpPanel();
  page.id = panelId;
  addHeader(fragment);

  // ---- Status card ----
  const statusCard = addDiv(fragment, "dashboard-card");
  statusCard.classList.add("dashboard-status-card");
  const statusDot = addDiv(statusCard, "dashboard-status-dot");
  if (["on-microsoft", "in-megahard"].includes(panelId)) {
    statusDot.classList.add("dashboard-status-contained");
    statusCard.classList.add("is-contained");
  } else if (panelId === "trackers-detected") {
    statusDot.classList.add("dashboard-status-blocked");
    statusCard.classList.add("is-blocked");
  } else {
    statusDot.classList.add("dashboard-status-clear");
    statusCard.classList.add("is-clear");
  }
  addSubhead(statusCard, panelId);

  if (panelId === "on-microsoft") {
    const el = await addMicrosoftAndIcon(statusCard);
    statusCard.appendChild(el);
  }

  // Because strings are named based on CURRENT_PANEL/panelID, this adds the
  // same paragraph No Trackers Detected pages get for About: pages.
  if (panelId === "about") {
    addParagraph(statusCard, "no-trackers-p1");
  } else {
    addParagraph(statusCard, `${panelId}-p1`);
  }

  if (panelId === "on-microsoft") {
    addParagraph(statusCard, `${panelId}-p2`);
  }

  if (["trackers-detected", "in-megahard", "no-trackers"].includes(panelId)) {
    addLearnMoreLink(statusCard);
  }

  // ---- Current site action ----
  const actionCard = addDiv(fragment, "dashboard-card");
  const siteRow = addDiv(actionCard, "dashboard-site-row");
  const siteName = document.createElement("span");
  siteName.classList.add("site-name", "dashboard-current-site");
  try {
    siteName.textContent = (await getActiveRootDomainFromBackground()) || "";
  } catch (_e) {
    siteName.textContent = "";
  }
  siteRow.appendChild(siteName);

  const actionButton = document.createElement("button");
  actionButton.classList.add("uiMessage", "dashboard-btn");
  actionCard.appendChild(actionButton);

  const siteInContainer = await isSiteInContainer(panelId);
  if (siteInContainer) {
    actionButton.id = "button-remove-site";
    if (panelId === "on-microsoft") {
      // Microsoft-owned sites cannot leave the container.
      actionButton.classList.add("disabled-button");
      const tip = document.createElement("div");
      tip.id = "button-remove-site-tooltip";
      tip.classList.add("uiMessage");
      actionCard.appendChild(tip);
    } else {
      actionButton.addEventListener("click", () => removeSiteFromContainer());
    }
  } else {
    actionButton.id = "button-allow-site";
    if (panelId === "about") {
      // Internal pages cannot be added.
      actionButton.classList.add("disabled-button");
    } else {
      actionButton.addEventListener("click", addSiteToContainer);
    }
  }

  // ---- Site lists ----
  const listsCard = addDiv(fragment, "dashboard-card");
  const includedHead = document.createElement("h3");
  includedHead.id = "sites-included";
  includedHead.classList.add("uiMessage");
  listsCard.appendChild(includedHead);
  makeSiteList(listsCard, await getMicrosoftDomainsFromBackground(), {removable: false});

  const allowedHead = document.createElement("h3");
  allowedHead.id = "sites-allowed";
  allowedHead.classList.add("uiMessage", "sites-allowed");
  listsCard.appendChild(allowedHead);
  let customSites = [];
  try {
    const storedSites = await browser.runtime.sendMessage({
      message: "what-sites-are-added"
    });
    if (Array.isArray(storedSites)) {
      customSites = storedSites;
    }
  } catch (_e) {
    customSites = [];
  }
  makeSiteList(listsCard, customSites, {removable: true});

  // ---- Footer ----
  const footer = addDiv(fragment, "dashboard-footer");
  addRepoLink(footer);

  getLocalizedStrings().catch(() => false);
  appendFragmentAndSetHeight(page, fragment);
};

document.addEventListener("DOMContentLoaded", async () => {
  const storage = await browser.storage.local.get();
  const currentPanel = storage.CURRENT_PANEL || "no-trackers";
  return buildDashboardPanel(currentPanel);
});
