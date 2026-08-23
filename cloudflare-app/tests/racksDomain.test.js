import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_FLOOR_PLAN_REGIONS,
  DEFAULT_RACK_COLUMNS,
  DEFAULT_RACK_SHELVES,
  buildFloorPlanLayout,
  displayedColumns,
  locationLabel,
  normalizeRackFace,
  rackColumnOrigin,
  rackFaceLabel,
  rackViewOrientation
} from "../src/domains/racks/index.js";
import { createRackConfigurationPlan, createRackCreatePlan, createRackResizePlan } from "../src/domains/racks/infrastructure/rackMutationPlans.js";
import { presentSlotOption } from "../src/domains/racks/web/presenters.js";

test("rack 실물 규격은 7열 × 6선반이고 저장 face는 A/B를 유지한다", () => {
  assert.equal(DEFAULT_RACK_COLUMNS, 7);
  assert.equal(DEFAULT_RACK_SHELVES, 6);
  assert.equal(normalizeRackFace("1면"), "A");
  assert.equal(normalizeRackFace("2"), "B");
  assert.equal(rackFaceLabel({ rack_number: 13, is_single_sided: 1, rack_face: "A" }), "13");
  assert.equal(locationLabel({ zone_number: 1, rack_number: 13, is_single_sided: 0, rack_face: "B", column_number: 7, shelf_number: 6 }), "1구역 / 13-2번 랙 / 7열 / 6선반");
});

test("모든 단면·양면은 바라본 기준으로 왼쪽부터 열을 표시한다", () => {
  const special = { zone_number: 1, rack_number: 1, is_single_sided: 1 };
  assert.equal(rackColumnOrigin(special, "A"), "left");
  assert.deepEqual(displayedColumns(special, "A"), [1, 2, 3, 4, 5, 6, 7]);
  const double = { zone_number: 1, rack_number: 2, is_single_sided: 0 };
  assert.deepEqual(displayedColumns(double, "A"), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(displayedColumns(double, "B"), [1, 2, 3, 4, 5, 6, 7]);
  assert.match(rackViewOrientation(special, "A").description, /왼쪽이 1열/);
  assert.match(rackViewOrientation(double, "B").description, /2면을 바라본 기준/);
});

test("floor plan geometry와 slot presenter는 운영 좌표·label을 유지한다", () => {
  assert.deepEqual(DEFAULT_FLOOR_PLAN_REGIONS.map(({ top_pct, left_pct, width_pct, height_pct }) => [top_pct, left_pct, width_pct, height_pct]), [
    [3.2, 4.7, 47.5, 38.2], [55.8, 2.5, 43.9, 38.9], [55.8, 52.2, 39.1, 38.9]
  ]);
  const layout = buildFloorPlanLayout([{ id: 2, zone_number: 1, rack_number: 2, code: "1-02", is_single_sided: 0 }]);
  assert.equal(layout.length, 1);
  assert.equal(layout[0].racks[0].leftPct, 100 / 13 / 2);
  assert.equal(presentSlotOption({ zone_number: 1, rack_number: 2, column_number: 7, shelf_number: 6, is_single_sided: 1 }).label, "1구역 / 2번랙 / 7열 / 6선반 / 단면");
});

test("floor plan layout은 영역 범위를 보정하고 문서가 있는 rack만 구역별로 자동 배치한다", () => {
  const layout = buildFloorPlanLayout([
    { id: 1, code: "1-01", zone_number: 1, rack_number: 1, active_document_count: 3, is_single_sided: 0 },
    { id: 2, code: "1-02", zone_number: 1, rack_number: 2, active_document_count: 1, is_single_sided: 1 },
    { id: 3, code: "3-01", zone_number: 3, rack_number: 1, active_document_count: 2, is_single_sided: 0 }
  ], [
    { region_key: "zone-1", label: "1구역", description: "", top_pct: -5, left_pct: 12, width_pct: 38, height_pct: 40, default_rack_count: 4 },
    { region_key: "zone-2", label: "2구역", description: "", top_pct: 55, left_pct: 5, width_pct: 40, height_pct: 38, default_rack_count: 10 },
    { region_key: "zone-3", label: "3구역", description: "", top_pct: 55, left_pct: 52, width_pct: 160, height_pct: 38, default_rack_count: 2 }
  ]);

  assert.deepEqual(layout.map((region) => region.key), ["zone-1", "zone-3"]);
  assert.equal(layout[0].topPct, 0);
  assert.equal(layout[1].widthPct, 100);
  assert.deepEqual(layout[0].racks.map((rack) => rack.code), ["1-01", "1-02"]);
  assert.ok(layout[0].racks[0].leftPct < layout[0].racks[1].leftPct);
  assert.equal(layout[1].racks[0].documentCount, 2);
});

test("rack resize/create/config plan은 고정 statement 순서와 무료티어 예산을 표현한다", () => {
  const statements = Array.from({ length: 4 }, (_, index) => ({ index }));
  const resize = createRackResizePlan(statements, "rack:1:7x6");
  assert.deepEqual(resize.describe().steps.map((step) => step.name), ["rack.audit.update", "rack.update", "rack.slots.deactivate-outside", "rack.slots.upsert-grid"]);
  assert.equal(resize.describe().budget, 4);
  assert.deepEqual(createRackCreatePlan(statements.slice(0, 3), "rack:1-01").execution().statements, statements.slice(0, 3));
  assert.equal(createRackConfigurationPlan(statements).describe().statements, 4);
});
