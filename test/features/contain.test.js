describe("Contain", () => {
  let webExtension, background, megahardContainer;

  beforeEach(async () => {
    webExtension = await loadWebExtension();
    background = webExtension.background;
    megahardContainer = webExtension.megahardContainer;
  });

  describe("All requests stripped of msclkid param", () => {
    const responses = {};
    beforeEach(async () => {
    });

    it("should redirect non-Microsoft urls with msclkid stripped", async () => {
      await background.browser.tabs._create({url: "https://github.com/?msclkid=123"}, {responses});
      expect(background.browser.tabs.create).to.not.have.been.called;
      const [promise] = responses.webRequest.onBeforeRequest;
      const result = await promise;
      expect(result.redirectUrl).to.equal("https://github.com/");
    });

    it("should preserve other url params", async () => {
      await background.browser.tabs._create({url: "https://github.com/futurester0x0/megahaRd/issues?q=is%3Aissue+is%3Aopen+track&msclkid=123"}, {responses});
      expect(background.browser.tabs.create).to.not.have.been.called;
      const [promise] = responses.webRequest.onBeforeRequest;
      const result = await promise;
      expect(result.redirectUrl).to.equal("https://github.com/futurester0x0/megahaRd/issues?q=is%3Aissue+is%3Aopen+track");
    });

    it("should redirect Microsoft urls with msclkid stripped", async () => {
      await background.browser.tabs._create({url: "https://www.microsoft.com/help/securitynotice?msclkid=123"}, {responses});
      expect(background.browser.tabs.create).to.not.have.been.called;
      const [promise] = responses.webRequest.onBeforeRequest;
      const result = await promise;
      expect(result.redirectUrl).to.equal("https://www.microsoft.com/help/securitynotice");
    });
  });

  describe("Incoming requests to Microsoft Domains outside of megahaRd Container", () => {
    const responses = {};
    beforeEach(async () => {
      await background.browser.tabs._create({
        url: "https://www.microsoft.com"
      }, {
        responses
      });
    });

    it("should be reopened in megahaRd Container", async () => {
      expect(background.browser.tabs.create).to.have.been.calledWithMatch({
        url: "https://www.microsoft.com",
        cookieStoreId: megahardContainer.cookieStoreId
      });
    });

    it("should be canceled", async () => {
      const [promise] = responses.webRequest.onBeforeRequest;
      const result = await promise;
      expect(result.cancel).to.be.true;
    });
  });

  describe("Incoming requests to Non-Microsoft Domains inside megahaRd Container", () => {
    const responses = {};
    beforeEach(async () => {
      await background.browser.tabs._create({
        url: "https://example.com",
        cookieStoreId: megahardContainer.cookieStoreId
      }, {
        responses
      });
    });

    it("should be reopened in Default Container", async () => {
      expect(background.browser.tabs.create).to.have.been.calledWithMatch({
        url: "https://example.com",
        cookieStoreId: "firefox-default"
      });
    });

    it("should be canceled", async () => {
      const [promise] = responses.webRequest.onBeforeRequest;
      const result = await promise;
      expect(result.cancel).to.be.true;
    });
  });


  describe("Incoming requests that don't start with http", () => {
    const responses = {};
    beforeEach(async () => {
      await background.browser.tabs._create({
        url: "ftp://www.microsoft.com"
      }, {
        responses
      });
    });

    it("should be ignored", async () => {
      expect(background.browser.tabs.create).to.not.have.been.called;
      const [promise] = responses.webRequest.onBeforeRequest;
      const result = await promise;
      expect(result).to.be.undefined;
    });
  });


  describe("Incoming requests that don't belong to a tab", () => {
    const responses = {};
    beforeEach(async () => {
      await background.browser.tabs._create({
        url: "https://www.microsoft.com",
        id: -1
      }, {
        responses
      });
    });

    it("should be ignored", async () => {
      expect(background.browser.tabs.create).to.not.have.been.called;
      const [promise] = responses.webRequest.onBeforeRequest;
      const result = await promise;
      expect(result).to.be.undefined;
    });
  });
});
