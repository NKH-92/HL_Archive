// 정적 app.js 생성 시 클라이언트 조각의 실행 순서를 고정하는 조립 모듈.

import { escapeHtml } from "../ui/html/escape.js";
import { bootstrapScript } from "./clientScript/bootstrap.js";
import { bulkCommandScript } from "./clientScript/bulkCommands.js";
import { documentDetailScript } from "./clientScript/documentDetail.js";
import { instantSearchScript } from "./clientScript/instantSearch.js";
import { masterManagementScript } from "./clientScript/masterManagement.js";
import { navigationFeedbackScript } from "./clientScript/navigationFeedback.js";
import { suggestionScript } from "./clientScript/suggestions.js";
import { workspaceInteractionScript } from "./clientScript/workspaceInteractions.js";

// 검색 코어는 build 단계에서 독립 browser ESM asset으로 생성한다.
export function searchCoreScript() {
  return `<script type="module" src="/assets/search-core.js"></script>`;
}

// escapeHtmlClient는 서버 escapeHtml 소스를 그대로 내려보낸다(이스케이프 규칙 단일 출처).
// 각 조각은 하나의 DOMContentLoaded 콜백 안에서 기존 순서대로 이어진다.
export function clientScript() {
  return [
    "",
    bootstrapScript(escapeHtml.toString()),
    suggestionScript(),
    bulkCommandScript(),
    documentDetailScript(),
    navigationFeedbackScript(),
    masterManagementScript(),
    instantSearchScript(),
    workspaceInteractionScript(),
    "    });",
    "  "
  ].join("\n");
}
