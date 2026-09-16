describe("Container", () => {
  let webExtension, background;

  describe("Add-on initializes", () => {
    describe("No Container with name megahaRd exists", () => {
      beforeEach(async () => {
        webExtension = await loadWebExtension();
        background = webExtension.background;
      });

      it("should create a new megahaRd Container", () => {
        expect(background.browser.contextualIdentities.create).to.have.been.calledWithMatch({
          name: "megahaRd"
        });
      });
    });

    describe("Container with name megahaRd already exists", () => {
      beforeEach(async () => {
        webExtension = await loadWebExtension({
          async beforeParse(window) {
            await window.browser.contextualIdentities._create({
              name: "megahaRd"
            });
          }
        });
        background = webExtension.background;
      });

      it("should not create a new Container", () => {
        expect(background.browser.contextualIdentities.create).to.not.have.been.called;
      });
    });
  });
});
