// page()의 기존 import 경로와 CSS 출력 순서를 유지하는 전역 스타일 호환 파사드.

import { workspaceStyles } from "./styles/workspace.js";
import { iconStyles } from "./icons.js";
import { adminStyles } from "./styles/admin.js";
import { baseStyles } from "./styles/base.js";
import { floorPlanStyles } from "./styles/floorPlan.js";
import { experienceStyles } from "./styles/experience.js";
import { responsivePrintStyles } from "./styles/responsivePrint.js";
import { searchStyles } from "./styles/search.js";
import { searchHomeStyles } from "./styles/searchHome.js";
import { tokenStyles } from "./styles/tokens.js";
import { workflowStyles } from "./styles/workflow.js";

const styleFragments = Object.freeze([
  tokenStyles,
  baseStyles,
  searchStyles,
  floorPlanStyles,
  adminStyles,
  workflowStyles,
  searchHomeStyles,
  experienceStyles,
  responsivePrintStyles,
  workspaceStyles
]);

export function styles() {
  return [iconStyles(), ...styleFragments.map((fragment) => fragment()), "  "].join("\n");
}
