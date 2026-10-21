"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("notification history client script is loaded outside inline JavaScript templates", () => {
  const view = fs.readFileSync(path.join(__dirname, "..", "views", "admin.ejs"), "utf8");
  const scriptTag = '<script src="/js/notification-history.js?v=delivery-history-20261022" defer></script>';
  const scriptIndex = view.indexOf(scriptTag);
  assert.notEqual(scriptIndex, -1, "history client script must be included once");
  assert.equal(view.indexOf(scriptTag, scriptIndex + scriptTag.length), -1, "history client script must not be duplicated");
  assert.ok(scriptIndex > view.lastIndexOf("</script>", scriptIndex), "history client script must be outside all inline scripts/template literals");
  assert.ok(scriptIndex < view.lastIndexOf("</body>"), "history client script must be loaded before the document body closes");
  const printTemplateStart = view.indexOf('<div class="slip">${card.innerHTML}</div>');
  assert.notEqual(printTemplateStart, -1, "print template marker must remain intact");
  const printTemplateEnd = view.indexOf("</body></html>`);", printTemplateStart);
  assert.notEqual(printTemplateEnd, -1, "print template must close cleanly");
  assert.ok(scriptIndex > printTemplateEnd, "history script must not be injected into the printable receipt HTML template");
});
