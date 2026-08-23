import { readBoolean } from "../../../shared/coercion.js";

export function rackColumnOrigin() {
  return "left";
}

export function rackViewOrientation(rack, face = rack?.rack_face || "A") {
  const single = readBoolean(rack?.is_single_sided);
  const faceLabel = single ? "단면랙" : `${face === "B" ? "2면" : "1면"}`;
  return Object.freeze({
    origin: "left",
    originLabel: "왼쪽",
    description: `${faceLabel}을 바라본 기준으로 왼쪽이 1열입니다.`
  });
}

export function displayedColumns(rack, face = "A", count = DEFAULT_COLUMNS) {
  return Array.from({ length: count }, (_, index) => index + 1);
}

const DEFAULT_COLUMNS = 7;
