describe("Security and edge cases", () => {
  let webExtension, background;

  beforeEach(async () => {
    webExtension = await loadWebExtension();
    background = webExtension.background;
  });

  async function yieldMessage(message, sender) {
    const results = await background.browser.runtime.onMessage.addListener.yield(message, sender);
    if (Array.isArray(results)) {
      const [first] = results;
      if (first && typeof first.then === "function") {
        return first;
      }
      return first;
    }
    return results;
  }

  describe("frameAncestor allowlist", () => {
    it("should not trust apps.microsoft.com.evil.com", async () => {
      const promise = background.browser.webRequest.onBeforeRequest.addListener.secondCall.yield({
        url: "https://msecnd.net",
        originUrl: "https://example.com",
        frameAncestors: [{url: "https://apps.microsoft.com.evil.com/"}]
      });

      expect(await promise).to.deep.equal({cancel: true});
    });

    it("should trust apps.microsoft.com", async () => {
      const promise = background.browser.webRequest.onBeforeRequest.addListener.secondCall.yield({
        url: "https://msecnd.net",
        originUrl: "https://example.com",
        frameAncestors: [{url: "https://apps.microsoft.com/store"}]
      });

      expect(await promise).to.deep.equal({});
    });

    it("should trust subdomains of apps.microsoft.com", async () => {
      const promise = background.browser.webRequest.onBeforeRequest.addListener.secondCall.yield({
        url: "https://msecnd.net",
        originUrl: "https://example.com",
        frameAncestors: [{url: "https://sub.apps.microsoft.com/"}]
      });

      expect(await promise).to.deep.equal({});
    });

    it("should not crash on malformed frameAncestors", async () => {
      const promise = background.browser.webRequest.onBeforeRequest.addListener.secondCall.yield({
        url: "https://msecnd.net",
        originUrl: "https://example.com",
        frameAncestors: [{url: "not a url"}]
      });

      expect(await promise).to.deep.equal({cancel: true});
    });
  });

  describe("custom domain list guards", () => {
    it("should ignore duplicate adds", async () => {
      await yieldMessage({message: "add-domain-to-list"}, {url: "https://example.com"});
      await yieldMessage({message: "add-domain-to-list"}, {url: "https://www.example.com"});
      const sites = await yieldMessage({message: "what-sites-are-added"});

      expect(sites.filter((site) => site === "example.com").length).to.equal(1);
    });

    it("should ignore invalid urls", async () => {
      await yieldMessage({message: "add-domain-to-list"}, {url: "about:blank"});
      await yieldMessage({message: "add-domain-to-list"}, {});
      const sites = await yieldMessage({message: "what-sites-are-added"});

      expect(sites).to.deep.equal([]);
    });

    it("should not remove the last entry when removing an unknown domain", async () => {
      await yieldMessage({message: "add-domain-to-list"}, {url: "https://example.com"});
      await yieldMessage({message: "remove-domain-from-list", removeDomain: "nosuchdomain.test"});
      const sites = await yieldMessage({message: "what-sites-are-added"});

      expect(sites).to.deep.equal(["example.com"]);
    });
  });

  describe("root domain parsing", () => {
    it("should return null for invalid urls instead of throwing", async () => {
      expect(await yieldMessage({message: "get-root-domain", url: "about:blank"})).to.equal(null);
      expect(await yieldMessage({message: "get-root-domain", url: "not a url"})).to.equal(null);
      expect(await yieldMessage({message: "get-root-domain"})).to.equal(null);
    });

    it("should parse multi-level public suffixes", async () => {
      expect(await yieldMessage({message: "get-root-domain", url: "https://sub.example.co.uk/path"})).to.equal("example.co.uk");
    });
  });

  describe("settings roundtrip", () => {
    it("should return defaults and single settings", async () => {
      const all = await yieldMessage({message: "check-settings"});

      expect(all).to.deep.equal({hideRelayEmailBadges: false});
      expect(await yieldMessage({message: "check-settings", setting: "hideRelayEmailBadges"})).to.equal(false);
    });

    it("should persist updated settings", async () => {
      await yieldMessage({message: "update-settings", settings: {hideRelayEmailBadges: true}});

      expect(await yieldMessage({message: "check-settings", setting: "hideRelayEmailBadges"})).to.equal(true);
    });
  });

  describe("microsoft domain inventory", () => {
    it("should expose the sorted containment list", async () => {
      const domains = await yieldMessage({message: "get-microsoft-domains"});

      expect(domains).to.be.an("array");
      expect(domains).to.include("microsoft.com");
      expect(domains).to.include("github.com");
      expect([...domains].sort()).to.deep.equal(domains);
    });
  });
});
