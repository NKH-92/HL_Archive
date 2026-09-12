import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { workspaceInteractionScript } from "../src/views/clientScript/workspaceInteractions.js";

test("검색은 이전 비교 보기 설정과 무관하게 기본 보기로 시작하고 사용자가 전환할 수 있다", () => {
  const classes = new Set(["is-comparison"]);
  const events = {};
  const toggle = { checked: true, addEventListener: (type, listener) => { events[type] = listener; } };
  const workspace = { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } };
  const context = {
    window: { addEventListener() {} },
    document: {
      querySelector: (selector) => selector === "[data-comparison-toggle]" ? toggle : selector === "[data-viewer-app]" ? workspace : null,
      addEventListener() {}
    },
    localStorage: { getItem: () => "true", setItem() {} }
  };
  vm.runInNewContext(workspaceInteractionScript(), context);
  assert.equal(toggle.checked, false);
  assert.equal(classes.has("is-comparison"), false);
  toggle.checked = true;
  events.change();
  assert.equal(classes.has("is-comparison"), true);
  toggle.checked = false;
  events.change();
  assert.equal(classes.has("is-comparison"), false);
});
