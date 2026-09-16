/* global psl */

const MEGAHRD_CONTAINER_DETAILS = {
  name: "megahaRd",
  color: "toolbar",
  icon: "fence"
};

const MICROSOFT_DOMAINS = [
  // Core Microsoft + account/auth
  "microsoft.com", "www.microsoft.com",
  "microsoftonline.com",
  "microsoft365.com",
  "microsoftcloud.com",
  "cloud.microsoft",
  "live.com",
  "outlook.com",
  "hotmail.com",
  "msauth.net",
  "msauthimages.net",
  "msecnd.net",
  "gfx.ms",
  "aka.ms",
  // Microsoft 365 / Office / collaboration
  "office.com",
  "office365.com",
  "office.net",
  "sharepoint.com",
  "sharepointonline.com",
  "onedrive.com",
  "onenote.com",
  "onenote.net",
  "teams.com",
  "skype.com",
  "skypeassets.com",
  "yammer.com",
  "dynamics.com",
  // Windows / Azure / dev platform
  "windows.com",
  "windows.net",
  "windowsupdate.com",
  "azure.com",
  "azure.net",
  "azureedge.net",
  "cloudapp.net",
  "visualstudio.com",
  "vsassets.io",
  // Search / content
  "msn.com",
  "bing.com",
  "bing.net",
  // GitHub (Microsoft-owned) — code, assets, OAuth apps
  "github.com",
  "githubusercontent.com",
  "githubassets.com",
  "githubapp.com",
  "npmjs.com",
  "nuget.org",
  // Professional network
  "linkedin.com",
  "licdn.com",
  // Gaming: Xbox, Minecraft/Mojang, ZeniMax/Bethesda, Activision Blizzard, King
  "xbox.com",
  "xboxlive.com",
  "xboxapi.com",
  "xboxservices.com",
  "minecraft.net",
  "mojang.com",
  "bethesda.net",
  "activision.com",
  "blizzard.com",
  "battle.net",
  "callofduty.com",
  "king.com"
];

const DEFAULT_SETTINGS = {
  hideRelayEmailBadges: false,
};

const MAC_ADDON_ID = "@testpilot-containers";
const RELAY_ADDON_ID = "private-relay@firefox.com";

let macAddonEnabled = false;
let relayAddonEnabled = false;
let megahardCookieStoreId = null;

// TODO: refactor canceledRequests and tabsWaitingToLoad into tabStates
const canceledRequests = {};
const tabsWaitingToLoad = {};
const tabStates = {};

const microsoftHostREs = [];

async function updateSettings(data){
  await browser.storage.local.set({
    "settings": data
  });
}

async function checkSettings(setting){
  const megahardStorage = await browser.storage.local.get();

  if (!megahardStorage.settings) {
    await browser.storage.local.set({
      "settings": DEFAULT_SETTINGS
    });
    if (setting) {
      return DEFAULT_SETTINGS[setting];
    }
    return DEFAULT_SETTINGS;
  }

  if (setting) {
    return megahardStorage.settings[setting];
  }

  return megahardStorage.settings;

}


async function isRelayAddonEnabled () {
  try {
    const relayAddonInfo = await browser.management.get(RELAY_ADDON_ID);
    if (relayAddonInfo.enabled) {
      return true;
    }
  } catch (_e) {
    return false;
  }
  return false;
}

async function isMACAddonEnabled () {
  try {
    const macAddonInfo = await browser.management.get(MAC_ADDON_ID);
    if (macAddonInfo.enabled) {
      sendJailedDomainsToMAC();
      return true;
    }
  } catch (_e) {
    return false;
  }
  return false;
}

async function setupMACAddonListeners () {
  browser.runtime.onMessageExternal.addListener((message, sender) => {
    if (sender.id !== MAC_ADDON_ID) {
      return;
    }
    switch (message.method) {
    case "MACListening":
      sendJailedDomainsToMAC();
      break;
    }
  });
  function disabledExtension (info) {
    if (info.id === MAC_ADDON_ID) {
      macAddonEnabled = false;
    }
    if (info.id === RELAY_ADDON_ID) {
      relayAddonEnabled = false;
    }
  }
  function enabledExtension (info) {
    if (info.id === MAC_ADDON_ID) {
      macAddonEnabled = true;
    }
    if (info.id === RELAY_ADDON_ID) {
      relayAddonEnabled = true;
    }
  }
  browser.management.onInstalled.addListener(enabledExtension);
  browser.management.onEnabled.addListener(enabledExtension);
  browser.management.onUninstalled.addListener(disabledExtension);
  browser.management.onDisabled.addListener(disabledExtension);
}

async function sendJailedDomainsToMAC () {
  try {
    return await browser.runtime.sendMessage(MAC_ADDON_ID, {
      method: "jailedDomains",
      urls: MICROSOFT_DOMAINS.map((domain) => {
        return `https://${domain}/`;
      })
    });
  } catch (_e) {
    // We likely might want to handle this case: https://github.com/mozilla/contain-facebook/issues/113#issuecomment-380444165
    return false;
  }
}

async function getMACAssignment (url) {
  if (!macAddonEnabled) {
    return false;
  }

  try {
    const assignment = await browser.runtime.sendMessage(MAC_ADDON_ID, {
      method: "getAssignment",
      url
    });
    return assignment;
  } catch (_e) {
    return false;
  }
}

function cancelRequest (tab, options) {
  // we decided to cancel the request at this point, register canceled request
  canceledRequests[tab.id] = {
    requestIds: {
      [options.requestId]: true
    },
    urls: {
      [options.url]: true
    }
  };

  // since webRequest onCompleted and onErrorOccurred are not 100% reliable
  // we register a timer here to cleanup canceled requests, just to make sure we don't
  // end up in a situation where certain urls in a tab.id stay canceled
  setTimeout(() => {
    if (canceledRequests[tab.id]) {
      delete canceledRequests[tab.id];
    }
  }, 2000);
}

function shouldCancelEarly (tab, options) {
  // we decided to cancel the request at this point
  if (!canceledRequests[tab.id]) {
    cancelRequest(tab, options);
  } else {
    let cancelEarly = false;
    if (canceledRequests[tab.id].requestIds[options.requestId] ||
        canceledRequests[tab.id].urls[options.url]) {
      // same requestId or url from the same tab
      // this is a redirect that we have to cancel early to prevent opening two tabs
      cancelEarly = true;
    }
    // register this requestId and url as canceled too
    canceledRequests[tab.id].requestIds[options.requestId] = true;
    canceledRequests[tab.id].urls[options.url] = true;
    if (cancelEarly) {
      return true;
    }
  }
  return false;
}

function generateMicrosoftHostREs () {
  for (let microsoftDomain of MICROSOFT_DOMAINS) {
    const escapedDomain = microsoftDomain.replace(/\./g, "\\.");
    microsoftHostREs.push(new RegExp(`^(.*\\.)?${escapedDomain}$`));
  }
}

async function clearMicrosoftCookies () {
  // Clear all microsoft cookies
  const containers = await browser.contextualIdentities.query({});
  containers.push({
    cookieStoreId: "firefox-default"
  });

  let macAssignments = [];
  if (macAddonEnabled) {
    const promises = MICROSOFT_DOMAINS.map(async microsoftDomain => {
      const assigned = await getMACAssignment(`https://${microsoftDomain}/`);
      return assigned ? microsoftDomain : null;
    });
    macAssignments = (await Promise.all(promises)).filter(Boolean);
  }

  await Promise.all(MICROSOFT_DOMAINS.map(async microsoftDomain => {
    // dont clear cookies for microsoftDomain if mac assigned (with or without www.)
    if (macAddonEnabled &&
        (macAssignments.includes(microsoftDomain) ||
         macAssignments.includes(`www.${microsoftDomain}`))) {
      return;
    }

    await Promise.all(containers.map(async container => {
      const storeId = container.cookieStoreId;
      if (storeId === megahardCookieStoreId) {
        // Don't clear cookies in the megahaRd Container
        return;
      }

      const cookies = await browser.cookies.getAll({
        domain: microsoftDomain,
        storeId
      });

      await Promise.all(cookies.map(cookie => {
        // cookies.remove needs a URL matching the cookie path
        const cookiePath = cookie.path || "/";
        const cookieUrl = `https://${microsoftDomain}${cookiePath.startsWith("/") ? cookiePath : `/${cookiePath}`}`;
        return browser.cookies.remove({
          name: cookie.name,
          url: cookieUrl,
          storeId
        }).catch(() => false);
      }));
      // Also clear Service Workers as it breaks detecting onBeforeRequest
      await browser.browsingData.remove({hostnames: [microsoftDomain]}, {serviceWorkers: true}).catch(() => false);
    }));
  }));
}

async function setupContainer () {
  // Use existing megahaRd container, or create one

  const contexts = await browser.contextualIdentities.query({name: MEGAHRD_CONTAINER_DETAILS.name});
  if (contexts.length > 0) {
    const megahardContext = contexts[0];
    megahardCookieStoreId = megahardContext.cookieStoreId;
    // Make existing megahaRd container the "fence" icon if needed
    if (megahardContext.color !== MEGAHRD_CONTAINER_DETAILS.color ||
        megahardContext.icon !== MEGAHRD_CONTAINER_DETAILS.icon
    ) {
      await browser.contextualIdentities.update(
        megahardCookieStoreId,
        { color: MEGAHRD_CONTAINER_DETAILS.color, icon: MEGAHRD_CONTAINER_DETAILS.icon }
      );
    }
  } else {
    const context = await browser.contextualIdentities.create(MEGAHRD_CONTAINER_DETAILS);
    megahardCookieStoreId = context.cookieStoreId;
  }
  // Initialize domainsAddedToMegahardContainer if needed
  const megahardStorage = await browser.storage.local.get();
  if (!Array.isArray(megahardStorage.domainsAddedToMegahardContainer)) {
    await browser.storage.local.set({"domainsAddedToMegahardContainer": []});
  }
}

async function maybeReopenTab (url, tab, request) {
  const macAssigned = await getMACAssignment(url);
  if (macAssigned) {
    // We don't reopen MAC assigned urls
    return;
  }
  const cookieStoreId = await shouldContainInto(url, tab);
  if (!cookieStoreId) {
    // Tab doesn't need to be contained
    return;
  }

  if (request && shouldCancelEarly(tab, request)) {
    // We need to cancel early to prevent multiple reopenings
    return {cancel: true};
  }

  await browser.tabs.create({
    url,
    cookieStoreId,
    active: tab.active,
    index: tab.index,
    windowId: tab.windowId
  });
  try {
    await browser.tabs.remove(tab.id);
  } catch (_e) {
    // Tab may already be closed; reopen succeeded so ignore.
  }

  return {cancel: true};
}

const rootDomainCache = {};

function getRootDomain(url) {
  let hostname = null;
  try {
    if (typeof url !== "string" || url === "") {
      return null;
    }
    hostname = new URL(url).hostname;
  } catch (_e) {
    return null;
  }
  if (!hostname) { return null; }
  if (hostname in rootDomainCache) {
    return rootDomainCache[hostname];
  }

  const parsedUrl = psl.parse(hostname);
  const rootDomain = parsedUrl.domain || null;

  rootDomainCache[hostname] = rootDomain;
  // After storing 128 entries, delete the oldest each time.
  const keys = Object.keys(rootDomainCache);
  if (keys.length > 128) {
    delete rootDomainCache[keys[0]];
  }
  return rootDomain;

}

function topFrameUrlIsMicrosoftApps(frameAncestorsArray) {
  if (!frameAncestorsArray || frameAncestorsArray.length === 0) {
    // No frame ancestor return false
    return false;
  }

  const frameAncestorsURL = frameAncestorsArray[0].url;
  if (typeof frameAncestorsURL !== "string") {
    return false;
  }

  let ancestorHost = null;
  try {
    ancestorHost = new URL(frameAncestorsURL).hostname.toLowerCase();
  } catch (_e) {
    return false;
  }

  // Only allow frame ancestors that originate from apps.microsoft.com
  // (exact host or subdomain). A startsWith check alone would also match
  // apps.microsoft.com.evil.com, so compare the parsed hostname.
  if (ancestorHost !== "apps.microsoft.com" && !ancestorHost.endsWith(".apps.microsoft.com")) {
    return false;
  }

  return frameAncestorsURL;
}

function safeParseUrl(url) {
  try {
    if (typeof url !== "string" || url === "") {
      return null;
    }
    return new URL(url);
  } catch (_e) {
    return null;
  }
}

function isMicrosoftURL (url) {
  const parsedUrl = safeParseUrl(url);
  if (!parsedUrl || !parsedUrl.host) {
    return false;
  }
  const host = parsedUrl.host.toLowerCase();
  for (let microsoftHostRE of microsoftHostREs) {
    if (microsoftHostRE.test(host)) {
      return true;
    }
  }
  return false;
}

// TODO: refactor parsedUrl "up" so new URL doesn't have to be called so much
// TODO: refactor megahardStorage "up" so browser.storage.local.get doesn't have to be called so much
async function addDomainToMegahardContainer (url) {
  const rootDomain = getRootDomain(url);
  if (!rootDomain) {
    return false;
  }
  const megahardStorage = await browser.storage.local.get();
  if (!Array.isArray(megahardStorage.domainsAddedToMegahardContainer)) {
    megahardStorage.domainsAddedToMegahardContainer = [];
  }
  if (megahardStorage.domainsAddedToMegahardContainer.includes(rootDomain)) {
    return false;
  }
  megahardStorage.domainsAddedToMegahardContainer.push(rootDomain);
  await browser.storage.local.set({"domainsAddedToMegahardContainer": megahardStorage.domainsAddedToMegahardContainer});
  return true;
}

async function removeDomainFromMegahardContainer (domain) {
  if (!domain) {
    return false;
  }
  const megahardStorage = await browser.storage.local.get();
  if (!Array.isArray(megahardStorage.domainsAddedToMegahardContainer)) {
    return false;
  }
  const domainIndex = megahardStorage.domainsAddedToMegahardContainer.indexOf(domain);
  if (domainIndex === -1) {
    return false;
  }
  megahardStorage.domainsAddedToMegahardContainer.splice(domainIndex, 1);
  await browser.storage.local.set({"domainsAddedToMegahardContainer": megahardStorage.domainsAddedToMegahardContainer});
  return true;
}

async function isAddedToMegahardContainer (url) {
  const rootDomain = getRootDomain(url);
  if (!rootDomain) {
    return false;
  }
  const megahardStorage = await browser.storage.local.get();
  if (!Array.isArray(megahardStorage.domainsAddedToMegahardContainer)) {
    return false;
  }
  if (megahardStorage.domainsAddedToMegahardContainer.includes(rootDomain)) {
    return true;
  }
  return false;
}

async function shouldContainInto (url, tab) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    // we only handle URLs starting with http(s)
    return false;
  }
  if (!tab || typeof tab.cookieStoreId === "undefined") {
    return false;
  }

  const hasBeenAddedToMegahardContainer = await isAddedToMegahardContainer(url);

  if (isMicrosoftURL(url) || hasBeenAddedToMegahardContainer) {
    if (tab.cookieStoreId !== megahardCookieStoreId) {
      // Microsoft-URL outside of megahaRd Container Tab
      // Should contain into megahaRd Container
      return megahardCookieStoreId;
    }
  } else if (tab.cookieStoreId === megahardCookieStoreId) {
    // Non-Microsoft-URL inside megahaRd Container Tab
    // Should contain into Default Container
    return "firefox-default";
  }

  return false;
}

async function maybeReopenAlreadyOpenTabs () {
  const tabsOnUpdated = (tabId, changeInfo, tab) => {
    if (changeInfo.url && tabsWaitingToLoad[tabId]) {
      // Tab we're waiting for switched it's url, maybe we reopen
      delete tabsWaitingToLoad[tabId];
      if (tab && tab.url) {
        maybeReopenTab(tab.url, tab).catch(() => false);
      }
    }
    if (tab && tab.status === "complete" && tabsWaitingToLoad[tabId]) {
      // Tab we're waiting for completed loading
      delete tabsWaitingToLoad[tabId];
    }
    if (!Object.keys(tabsWaitingToLoad).length) {
      // We're done waiting for tabs to load, remove event listener
      browser.tabs.onUpdated.removeListener(tabsOnUpdated);
    }
  };

  // Query for already open Tabs
  const tabs = await browser.tabs.query({});
  tabs.map(tab => {
    if (!tab || typeof tab.url !== "string") {
      return;
    }
    if (tab.url === "about:blank") {
      if (tab.status !== "loading") {
        return;
      }
      // about:blank Tab is still loading, so we indicate that we wait for it to load
      // and register the event listener if we haven't yet.
      //
      // This is a workaround until platform support is implemented:
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1447551
      // https://github.com/mozilla/multi-account-containers/issues/474
      tabsWaitingToLoad[tab.id] = true;
      if (!browser.tabs.onUpdated.hasListener(tabsOnUpdated)) {
        browser.tabs.onUpdated.addListener(tabsOnUpdated);
      }
    } else {
      // Tab already has an url, maybe we reopen
      maybeReopenTab(tab.url, tab).catch(() => false);
    }
  });
}

function stripMsclkid(url) {
  const parsed = safeParseUrl(url);
  if (!parsed) {
    return url;
  }
  parsed.searchParams.delete("msclkid");
  return parsed.href;
}

async function getActiveTab () {
  const tabs = await browser.tabs.query({currentWindow: true, active: true});
  return tabs && tabs[0] ? tabs[0] : null;
}

async function windowFocusChangedListener (windowId) {
  if (windowId !== browser.windows.WINDOW_ID_NONE) {
    const activeTab = await getActiveTab();
    if (activeTab) {
      updateBrowserActionIcon(activeTab).catch(() => false);
    }
  }
}

function tabUpdateListener (tabId, changeInfo, tab) {
  if (!tab) {
    return;
  }
  if (changeInfo && (changeInfo.status || changeInfo.url)) {
    updateBrowserActionIcon(tab).catch(() => false);
  }
}

async function updateBrowserActionIcon (tab) {
  if (!tab) {
    return;
  }

  if (typeof tab.id !== "undefined") {
    browser.browserAction.setBadgeText({text: "", tabId: tab.id});
  } else {
    browser.browserAction.setBadgeText({text: ""});
  }

  const url = typeof tab.url === "string" ? tab.url : "";
  if (!url) {
    await browser.storage.local.set({"CURRENT_PANEL": "no-trackers"});
    return;
  }
  const hasBeenAddedToMegahardContainer = await isAddedToMegahardContainer(url);
  const aboutPageURLCheck = url.startsWith("about:");

  if (isMicrosoftURL(url)) {
    // TODO: change panel logic from browser.storage to browser.runtime.onMessage
    // so the panel.js can "ask" background.js which panel it should show
    await browser.storage.local.set({"CURRENT_PANEL": "on-microsoft"});
    if (typeof tab.id !== "undefined") {
      browser.browserAction.setPopup({tabId: tab.id, popup: "./panel.html"});
    }
  } else if (hasBeenAddedToMegahardContainer) {
    await browser.storage.local.set({"CURRENT_PANEL": "in-megahard"});
    if (typeof tab.id !== "undefined") {
      browser.browserAction.setPopup({tabId: tab.id, popup: "./panel.html"});
    }
  } else if (aboutPageURLCheck) {
    // Sets CURRENT_PANEL if current URL is an internal about: page
    await browser.storage.local.set({"CURRENT_PANEL": "about"});
    if (typeof tab.id !== "undefined") {
      browser.browserAction.setPopup({tabId: tab.id, popup: "./panel.html"});
    }
  } else {
    const tabState = tabStates[tab.id];
    const panelToShow = (tabState && tabState.trackersDetected) ? "trackers-detected" : "no-trackers";
    await browser.storage.local.set({"CURRENT_PANEL": panelToShow});
    if (typeof tab.id !== "undefined") {
      browser.browserAction.setPopup({tabId: tab.id, popup: "./panel.html"});
    }
    browser.browserAction.setBadgeBackgroundColor({color: "#0078D4"});
    if ( panelToShow === "trackers-detected" ) {
      browser.browserAction.setBadgeText({text: "!"});
    }
  }
}

async function containMicrosoft (request) {
  if (!request || typeof request.tabId === "undefined") {
    return;
  }
  if (tabsWaitingToLoad[request.tabId]) {
    // Cleanup just to make sure we don't get a race-condition with startup reopening
    delete tabsWaitingToLoad[request.tabId];
  }

  // Listen to requests and open Microsoft into its Container,
  // open other sites into the default tab context
  if (request.tabId === -1) {
    // Request doesn't belong to a tab
    return;
  }

  let tab = null;
  try {
    tab = await browser.tabs.get(request.tabId);
  } catch (_e) {
    // Tab closed mid-flight
    return;
  }
  if (!tab) {
    return;
  }
  updateBrowserActionIcon(tab).catch(() => false);

  const parsedUrl = safeParseUrl(request.url);
  if (!parsedUrl) {
    return;
  }
  if (parsedUrl.searchParams.has("msclkid")) {
    return {redirectUrl: stripMsclkid(request.url)};
  }

  return maybeReopenTab(request.url, tab, request);
}

// Lots of this is borrowed from old blok code:
// https://github.com/mozilla/blok/blob/main/src/js/background.js
function notifyContentScript(tabId, message) {
  try {
    const result = browser.tabs.sendMessage(tabId, message);
    if (result && typeof result.catch === "function") {
      result.catch(() => false);
    }
  } catch (_e) {
    // No content script in this tab (system pages, unloaded tabs, etc.)
  }
}

async function blockMicrosoftSubResources (requestDetails) {
  if (requestDetails.type === "main_frame") {
    tabStates[requestDetails.tabId] = { trackersDetected: false };
    return {};
  }

  if (typeof requestDetails.originUrl === "undefined") {
    return {};
  }

  const urlIsMicrosoft = isMicrosoftURL(requestDetails.url);
  // If this request isn't going to Microsoft, let's return {} ASAP
  if (!urlIsMicrosoft) {
    return {};
  }

  const originUrlIsMicrosoft = isMicrosoftURL(requestDetails.originUrl);

  if (originUrlIsMicrosoft) {
    const message = {msg: "microsoft-domain"};
    // Send the message to the content_script
    notifyContentScript(requestDetails.tabId, message);
    return {};
  }

  const frameAncestorUrlIsMicrosoftApps = topFrameUrlIsMicrosoftApps(requestDetails.frameAncestors);

  if (frameAncestorUrlIsMicrosoftApps) {
    const message = {msg: "microsoft-domain"};
    // Send the message to the content_script
    notifyContentScript(requestDetails.tabId, message);
    return {};
  }

  const hasBeenAddedToMegahardContainer = await isAddedToMegahardContainer(requestDetails.originUrl);

  if ( urlIsMicrosoft && !originUrlIsMicrosoft ) {
    if (!hasBeenAddedToMegahardContainer ) {
      const message = {msg: "blocked-microsoft-subresources"};
      // Send the message to the content_script
      notifyContentScript(requestDetails.tabId, message);

      tabStates[requestDetails.tabId] = { trackersDetected: true };
      return {cancel: true};
    } else {
      const message = {msg: "allowed-microsoft-subresources"};
      // Send the message to the content_script
      notifyContentScript(requestDetails.tabId, message);
      return {};
    }
  }
  return {};
}

function setupWebRequestListeners() {
  browser.webRequest.onCompleted.addListener((options) => {
    if (canceledRequests[options.tabId]) {
      delete canceledRequests[options.tabId];
    }
  },{urls: ["<all_urls>"], types: ["main_frame"]});
  browser.webRequest.onErrorOccurred.addListener((options) => {
    if (canceledRequests[options.tabId]) {
      delete canceledRequests[options.tabId];
    }
  },{urls: ["<all_urls>"], types: ["main_frame"]});

  // Add the main_frame request listener
  browser.webRequest.onBeforeRequest.addListener(containMicrosoft, {urls: ["<all_urls>"], types: ["main_frame"]}, ["blocking"]);

  // Add the sub-resource request listener
  browser.webRequest.onBeforeRequest.addListener(blockMicrosoftSubResources, {urls: ["<all_urls>"]}, ["blocking"]);
}

function setupWindowsAndTabsListeners() {
  browser.tabs.onUpdated.addListener(tabUpdateListener);
  browser.tabs.onRemoved.addListener(tabId => {
    delete tabStates[tabId];
    delete canceledRequests[tabId];
    delete tabsWaitingToLoad[tabId];
  });
  browser.windows.onFocusChanged.addListener(windowFocusChangedListener);
}

async function checkIfTrackersAreDetected(sender) {
  const activeTab = await getActiveTab();
  if (!activeTab || !sender || !sender.tab) {
    return false;
  }
  const tabState = tabStates[activeTab.id];
  const trackersDetected = Boolean(tabState && tabState.trackersDetected);
  const onActiveTab = (activeTab.id === sender.tab.id);
  // Check if trackers were blocked,scoped to the active tab.
  return Boolean(onActiveTab && trackersDetected);
}

(async function init () {
  await setupMACAddonListeners();
  macAddonEnabled = await isMACAddonEnabled();
  relayAddonEnabled = await isRelayAddonEnabled();

  try {
    await setupContainer();
  } catch (error) {
    // TODO: Needs backup strategy
    // Sometimes this add-on is installed but doesn't get a megahardCookieStoreId ?
    console.error(error);
    return;
  }
  clearMicrosoftCookies().catch(() => false);
  generateMicrosoftHostREs();
  setupWebRequestListeners();
  setupWindowsAndTabsListeners();

  async function messageHandler(request, sender) {
    if (!request || typeof request.message === "undefined") {
      return undefined;
    }
    switch (request.message) {
    case "what-sites-are-added":
      return browser.storage.local.get().then(megahardStorage => {
        if (Array.isArray(megahardStorage.domainsAddedToMegahardContainer)) {
          return megahardStorage.domainsAddedToMegahardContainer;
        }
        return [];
      });
    case "get-microsoft-domains":
      // Single source of truth for the contained Microsoft-owned domains.
      return [...MICROSOFT_DOMAINS].sort();
    case "remove-domain-from-list":
      await removeDomainFromMegahardContainer(request.removeDomain);
      break;
    case "add-domain-to-list": {
      // Prefer explicit page URL from the caller (extension iframes report
      // their own moz-extension:// URL as sender.url). Fall back to the
      // sender tab URL for backwards compatibility.
      const pageUrl = request.url || (sender && sender.tab && sender.tab.url) || (sender && sender.url);
      await addDomainToMegahardContainer(pageUrl);
      break;
    }
    case "get-root-domain":
      return getRootDomain(request.url);
    case "get-relay-enabled":
      return relayAddonEnabled;
    case "update-settings":
      await updateSettings(request.settings);
      break;
    case "check-settings":
      return checkSettings(request.setting);
    case "are-trackers-detected":
      return await checkIfTrackersAreDetected(sender);
    default:
      console.warn("Unexpected message!", request && request.message);
      return undefined;
    }
  }

  browser.runtime.onMessage.addListener(messageHandler);

  maybeReopenAlreadyOpenTabs().catch(() => false);

  const activeTab = await getActiveTab();
  if (activeTab) {
    updateBrowserActionIcon(activeTab).catch(() => false);
  }
})();
