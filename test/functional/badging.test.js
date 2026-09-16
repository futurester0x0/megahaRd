describe("Badging", () => {
  beforeEach(async () => {
    const badgesFixture = `moz-extension://${internalUUID}/fixtures/badges.html`;
    await geckodriver.get(badgesFixture);
  });

  it("should badge microsoft elements", async () => {
    await geckodriver.wait(until.elementLocated(
      By.className("mhc-badge")
    ), 5000, "Should have badged the element");
  });
});