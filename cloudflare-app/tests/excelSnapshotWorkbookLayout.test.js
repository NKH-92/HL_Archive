import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import JSZip from "jszip";

import {
  EXCEL_SNAPSHOT_HEADERS,
  EXCEL_SNAPSHOT_SCHEMA_VERSION
} from "../src/domains/snapshots/domain/workbookSchema.js";
import { excelSnapshotScript } from "../src/views/clientScript/excelSnapshots.js";

function workbookApi() {
  let capturedBlob = null;
  const document = {
    body: { appendChild() {} },
    createElement() {
      return { click() {}, remove() {}, href: "", download: "" };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const url = {
    createObjectURL(blob) {
      capturedBlob = blob;
      return "blob:test";
    },
    revokeObjectURL() {}
  };
  const factory = new Function(
    "window", "document", "Blob", "URL", "setTimeout", "crypto", "TextEncoder",
    `${excelSnapshotScript()}; return { buildExcelSnapshot, readExcelSnapshot };`
  );
  const api = factory(
    { ExcelJS, JSZip },
    document,
    Blob,
    url,
    (callback) => callback(),
    crypto,
    TextEncoder
  );
  return { ...api, captured: () => capturedBlob };
}

function payload() {
  const documents = [1, 2, 3].map((zoneNumber, index) => ({
    rowKey: `HLM-${index + 1}`,
    baseRowVersion: 1,
    documentNumber: `DOC-Z${zoneNumber}`,
    revisionNumber: "Rev.0",
    revisionDate: "2026-08-21",
    disposalDueYear: 2031,
    documentName: `${zoneNumber}구역 문서`,
    category: "PV",
    zoneNumber,
    rackNumber: 1,
    rackColumn: 1,
    shelfNumber: 1,
    rackFace: zoneNumber === 1 ? "단면" : "1면",
    tags: "원본보관",
    note: "",
    status: "보관중"
  }));
  return {
    schemaVersion: EXCEL_SNAPSHOT_SCHEMA_VERSION,
    baseVersion: 7,
    currentSnapshotId: 4,
    exportManifestId: "EXP-1234567890abcdef",
    canonicalExportHash: "a".repeat(64),
    exportedAt: "2026-08-21T00:00:00.000Z",
    documents,
    codes: {
      categories: ["PV"],
      tags: ["원본보관"],
      racks: documents.map((document) => ({
        zoneNumber: document.zoneNumber,
        rackNumber: document.rackNumber,
        code: `${document.zoneNumber}-01`,
        singleSided: document.zoneNumber === 1
      }))
    }
  };
}

test("실제 생성 workbook은 구역 열을 두 시트에 표시하고 O~Q 관리 열을 숨긴다", async () => {
  const api = workbookApi();
  await api.buildExcelSnapshot(payload());
  const blob = api.captured();
  assert.ok(blob);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  const data = workbook.getWorksheet("문서데이터");
  const print = workbook.getWorksheet("인쇄용 관리대장");
  const guide = workbook.getWorksheet("작성안내");
  assert.deepEqual(data.getRow(1).values.slice(1, 15), EXCEL_SNAPSHOT_HEADERS);
  assert.equal(data.getCell("G2").value, 1);
  assert.equal(data.getCell("G2").numFmt, '0"구역"');
  assert.match(data.getCell("G2").dataValidation.formulae[0], /_코드값.*\$B\$2/);
  assert.equal(data.getCell("H2").value, 1);
  assert.match(data.getCell("H2").dataValidation.formulae[0], /_코드값.*\$C\$2/);
  assert.equal(data.getColumn(15).hidden, true);
  assert.equal(data.getColumn(16).hidden, true);
  assert.equal(data.getColumn(17).hidden, true);
  assert.equal(data.autoFilter, "A1:N4");

  assert.deepEqual(print.getRow(4).values.slice(1, 15), EXCEL_SNAPSHOT_HEADERS);
  assert.equal(print.getCell("G5").value, 1);
  assert.equal(print.getCell("G5").numFmt, '0"구역"');
  assert.equal(print.pageSetup.printArea, "A1:N7");
  assert.equal(print.headerFooter.oddFooter, "&C&P / &N&RHLF-GR-04-15 / Rev.2");
  assert.match(String(guide.getCell("B2").value), /한글 14개 열/);
  const rackGuideRow = guide.getRows(1, guide.rowCount).find((row) => row.getCell(1).value === "랙 위치");
  assert.match(String(rackGuideRow?.getCell(2).value), /왼쪽부터 1열, 아래부터 1선반/);

  const parsed = await api.readExcelSnapshot({
    name: "한림_문서고_관리대장_2026-08-21.xlsx",
    size: blob.size,
    arrayBuffer: () => blob.arrayBuffer()
  });
  assert.deepEqual(parsed.rows.map((row) => row.source.zoneNumber), ["1", "2", "3"]);
  assert.equal(parsed.schemaVersion, EXCEL_SNAPSHOT_SCHEMA_VERSION);
});

test("기존 13열 workbook은 최신 대장 재추출 안내와 함께 거부된다", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("문서데이터");
  sheet.addRow(EXCEL_SNAPSHOT_HEADERS.filter((header) => header !== "랙 위치 (구역)"));
  sheet.addRow(["DOC-OLD", "Rev.0", "2026-08-21", 2031, "구파일", "PV", 1, 1, 1, "단면", "", "", "보관중"]);
  const buffer = await workbook.xlsx.writeBuffer();
  const api = workbookApi();
  await assert.rejects(
    api.readExcelSnapshot({
      name: "기존_13열.xlsx",
      size: buffer.byteLength,
      arrayBuffer: async () => buffer
    }),
    /현재 대장을 다시 추출하세요/
  );
});
