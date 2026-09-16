describe("Add domain to megahaRd Container", () => {
  let webExtension, background;

  beforeEach(async () => {
    webExtension = await loadWebExtension();
    background = webExtension.background;
  });

  async function yieldMessage(message, sender) {
    const results = await background.browser.runtime.onMessage.addListener.yield(message, sender);
    // yield returns array of handler return values (promises for async handlers)
    if (Array.isArray(results)) {
      for (const r of results) {
        if (r && typeof r.then === "function") {
          await r;
        }
      }
      return results;
    }
    if (results && typeof results.then === "function") {
      await results;
    }
    return results;
  }

  describe("runtime message add-domain-to-list", () => {
    beforeEach(async () => {
      await yieldMessage({
        message: "add-domain-to-list"
      }, {
        url: "https://example.com"
      });
    });

    describe("runtime message what-sites-are-added", () => {
      it("should return the added sites", async () => {
        const [promise] = await background.browser.runtime.onMessage.addListener.yield({message: "what-sites-are-added"});
        const sites = await promise;
        expect(sites.includes("example.com")).to.be.true;
      });
    });


    describe("runtime message removeDomain", () => {
      it("should have removed the domain", async () => {
        await yieldMessage({
          message: "remove-domain-from-list",
          removeDomain: "example.com"
        });

        const [promise] = await background.browser.runtime.onMessage.addListener.yield({message: "what-sites-are-added"});
        const sites = await promise;
        expect(sites.includes("example.com")).to.be.false;
      });
    });
  });

});
