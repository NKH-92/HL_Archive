// 문서고 도면(플로어 플랜)과 랙 지도 렌더링.

import { readBoolean } from "../shared/coercion.js";
import { hasPermission, PERMISSIONS } from "../permissions.js";
import { escapeHtml } from "../ui/html/escape.js";
import { page } from "./layout.js";

// 도면 위 랙 실루엣 한 개. 양면 랙은 좌(N-1면)·우(N-2면) 두 칸을 세로 점선으로 나눈다.
// hit: 랙 전체 강조(검색 일치), hitFace('A'|'B'): 양면 랙에서 해당 면(반쪽)만 강조(문서 상세).
// interactive=false는 특정 문서의 위치만 읽어야 하는 상세·찾기 화면에서 주변 랙 오탭을 막는다.
function floorRackMarkup(rack, {
  hit = false,
  hitFace = "",
  zoneNumber = 0,
  interactive = true,
  layoutKey = ""
} = {}) {
  const classes = ["floor-rack", rack.isSingleSided ? "is-single" : "is-double"];
  if (hit) classes.push("is-hit");
  const faceAttr = !rack.isSingleSided && hitFace ? ` data-face-hit="${escapeHtml(hitFace)}"` : "";
  const faces = rack.isSingleSided
    ? ""
    : `<span class="rack-face rack-face-a"></span><span class="rack-face rack-face-b"></span>`;
  const badgeLabel = !rack.isSingleSided && hitFace
    ? `${rack.rackNumber}-${hitFace === "B" ? 2 : 1}`
    : String(rack.rackNumber);
  const title = rack.isSingleSided
    ? `${rack.code} · 단면 · 면을 바라본 기준 왼쪽 1열`
    : `${rack.code} · 양면 (좌 ${rack.rackNumber}-1 / 우 ${rack.rackNumber}-2) · 각 면을 바라본 기준 왼쪽 1열`;
  const active = hit || Boolean(hitFace);
  const content = `${faces}${active ? `<span class="rack-hit-pin" aria-hidden="true">현재</span>` : ""}<span class="rack-num">${escapeHtml(badgeLabel)}</span>`;
  const common = `class="${classes.join(" ")}"${faceAttr} data-floor-layout="${layoutKey}" data-rack-select data-rack-id="${Number(rack.id)}" data-rack-code="${escapeHtml(rack.code)}" data-rack-description="${escapeHtml(rack.description || "")}" data-rack-type="${rack.isSingleSided ? "단면" : "양면"}" data-rack-faces="${rack.isSingleSided ? 1 : 2}" data-rack-columns="${Number(rack.columnCount || 0)}" data-rack-shelves="${Number(rack.shelfCount || 0)}" data-rack-documents="${Number(rack.documentCount || 0)}" data-zone="${escapeHtml(String(zoneNumber))}" title="${escapeHtml(title)}"`;
  if (!interactive) return `<span ${common} aria-hidden="true">${content}</span>`;
  return `<a ${common} href="/app?rack=${Number(rack.id)}&amp;status=active&amp;sort=location" aria-label="${escapeHtml(title)}">${content}</a>`;
}

export function floorPlanView(regions, hits = new Set()) {
  const activeRackCount = regions.reduce((sum, region) => sum + region.racks.filter((rack) => hits.has(rack.code)).length, 0);
  const layoutRules = [];
  const regionMarkup = regions.map((region, regionIndex) => {
    const regionKey = `floor-plan-region-${regionIndex}`;
    layoutRules.push(regionLayoutRule(regionKey, region));
    const racks = region.racks.map((rack, rackIndex) => {
      const rackKey = `${regionKey}-rack-${rackIndex}`;
      layoutRules.push(rackLayoutRule(rackKey, rack));
      return floorRackMarkup(rack, {
        hit: hits.has(rack.code),
        zoneNumber: region.zoneNumber,
        layoutKey: rackKey
      });
    }).join("");
    return `
      <section class="floor-region" data-floor-layout="${regionKey}" aria-label="${escapeHtml(region.label)}">
        <span class="floor-region-label">${escapeHtml(region.label)}</span>
        ${region.zoneNumber === 1 ? `<span class="floor-wall-marker">벽면 ↑</span>` : ""}
        ${racks}
      </section>
    `;
  }).join("");
  return `
    <style>${layoutRules.join("")}</style>
    <div class="floor-plan-shell">
      <div class="floor-plan-tools">
        <label class="floor-rack-search"><span class="sr-only">구역·랙 검색</span><input type="search" data-floor-rack-search placeholder="구역 또는 랙 코드 검색"></label>
        <div class="button-group"><button type="button" class="button secondary sm" data-floor-plan-fit>화면 맞춤</button><button type="button" class="button secondary sm" data-floor-plan-zoom aria-pressed="false">도면 확대</button></div>
      </div>
      <div class="floor-plan-scroll" data-floor-plan-scroll tabindex="0" aria-label="문서고 랙 도면. 확대 보기에서는 좌우로 스크롤하여 모든 랙을 확인할 수 있습니다.">
        <div class="floor-plan-media">
          <img src="/images/Archive.png" alt="한림 문서고 도면">
          ${regionMarkup}
        </div>
      </div>

      <div class="floor-plan-summary">
        ${activeRackCount ? `<span>일치 랙 ${activeRackCount}개</span>` : ""}
        <span><i class="legend-box"></i>양면 랙</span>
        <span><i class="legend-box single"></i>단면 랙</span>
        ${regions.some((region) => region.zoneNumber === 1) ? `<span>1구역 위쪽 = 벽면</span>` : ""}
        <span>각 면을 바라본 기준 = 왼쪽 1열 · 아래 1선반</span>
        ${activeRackCount ? `<span><i class="legend-box hit"></i>검색 위치</span>` : ""}
      </div>
      <div class="zone-list">
        ${regions.map((region) => `<a href="/app?zone=${region.zoneNumber}&amp;sort=location"><strong>${escapeHtml(region.label)}</strong><span>${region.racks.length}개 랙</span></a>`).join("")}
      </div>
    </div>
  `;
}

// 한 구역만 확대한 도면. 전체 도면 이미지를 스케일·이동해 해당 구역이 뷰포트를 꽉 채운다.
// 구역의 픽셀 비율(1024*W : 797*H)을 뷰포트 aspect-ratio로 두면 CSS 스케일이 왜곡 없이 맞아떨어진다.
export function zoneFloorPlanView(region, { hitCode = "", hitFace = "", interactive = true, spotlight = false } = {}) {
  const aspectW = Math.max(1, Math.round(1024 * region.widthPct));
  const aspectH = Math.max(1, Math.round(797 * region.heightPct));
  const scope = `floor-zone-${Number(region.zoneNumber) || 0}`;
  const zoomKey = `${scope}-zoom`;
  const canvasKey = `${scope}-canvas`;
  const regionKey = `${scope}-region`;
  const layoutRules = [
    layoutRule(zoomKey, {
      "--z-aw": cssNumber(aspectW, 1),
      "--z-ah": cssNumber(aspectH, 1)
    }),
    layoutRule(canvasKey, {
      "--zw": cssNumber(region.widthPct, 1),
      "--zh": cssNumber(region.heightPct, 1),
      "--zl": cssNumber(region.leftPct),
      "--zt": cssNumber(region.topPct)
    }),
    regionLayoutRule(regionKey, region)
  ];
  const racks = region.racks.map((rack, rackIndex) => {
    const rackKey = `${scope}-rack-${rackIndex}`;
    layoutRules.push(rackLayoutRule(rackKey, rack));
    const isHitRack = rack.code === hitCode;
    return floorRackMarkup(rack, {
      hit: isHitRack && (rack.isSingleSided || !hitFace),
      hitFace: isHitRack && !rack.isSingleSided ? hitFace : "",
      zoneNumber: region.zoneNumber,
      interactive,
      layoutKey: rackKey
    });
  }).join("");
  return `
    <style>${layoutRules.join("")}</style>
    <div class="floor-zoom${spotlight ? " is-spotlight" : ""}" data-floor-layout="${zoomKey}">
      <div class="floor-zoom-canvas" data-floor-layout="${canvasKey}">
        <img class="floor-zoom-img" src="/images/Archive.png" alt="${escapeHtml(region.label)} 도면">
        <section class="floor-region" data-floor-layout="${regionKey}" aria-label="${escapeHtml(region.label)}">
          <span class="floor-region-label">${escapeHtml(region.label)}</span>
          ${region.zoneNumber === 1 ? `<span class="floor-wall-marker">벽면 ↑</span>` : ""}
          ${racks}
        </section>
      </div>
    </div>
  `;
}

function regionLayoutRule(key, region) {
  return layoutRule(key, {
    "--top": `${cssNumber(region.topPct)}%`,
    "--left": `${cssNumber(region.leftPct)}%`,
    "--width": `${cssNumber(region.widthPct)}%`,
    "--height": `${cssNumber(region.heightPct)}%`
  });
}

function rackLayoutRule(key, rack) {
  return layoutRule(key, {
    "--rack-left": `${cssNumber(rack.leftPct)}%`,
    "--rack-width": `${cssNumber(rack.widthPct, 6)}%`
  });
}

function layoutRule(key, declarations) {
  const body = Object.entries(declarations).map(([name, value]) => `${name}:${value};`).join("");
  return `[data-floor-layout="${key}"]{${body}}`;
}

function cssNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function archiveMap(racks, hits) {
  // 랙이 있는 구역만 그린다 (현재는 1구역뿐, 증설 시 자동 확장).
  const zones = [...new Set(racks.map((rack) => Number(rack.zone_number)))].sort((a, b) => a - b);
  return `
    <div class="archive-map">
      ${zones.map((zone) => {
        const zoneRacks = racks.filter((rack) => Number(rack.zone_number) === zone);
        return `<section class="rack-zone" aria-label="${zone}구역"><h3>${zone}구역</h3><div class="rack-zone-grid">
          ${zoneRacks.map((rack) => {
            const hitA = hits.has(`${rack.code}:A`);
            const hitB = hits.has(`${rack.code}:B`);
            const isHit = hitA || hitB;
            const single = readBoolean(rack.is_single_sided);
            const faceSummary = single
              ? `단면${hitA ? " 일치" : ""}`
              : `${rack.rack_number}-1${hitA ? " 일치" : ""} · ${rack.rack_number}-2${hitB ? " 일치" : ""}`;
            return `<a class="rack-tile ${isHit ? "is-hit" : ""}" href="/app?rack=${Number(rack.id)}&amp;status=active&amp;sort=location" title="${escapeHtml(rack.code)} ${rack.document_count || 0}건">
              <strong>${rack.rack_number}</strong>
              <span>${escapeHtml(rack.code)}</span>
              <small>${faceSummary}</small>
            </a>`;
          }).join("")}
        </div></section>`;
      }).join("")}
    </div>
  `;
}

export function floorPlanPage({ session, floorPlan = [] }) {
  const canManageMasters = hasPermission(session, PERMISSIONS.MANAGE_MASTERS);
  const rackCount = floorPlan.reduce((sum, region) => sum + region.racks.length, 0);
  const zoneRows = floorPlan.map((region) => ({
    zoneNumber: Number(region.zoneNumber),
    label: region.label,
    rackCount: region.racks.length,
    documentCount: region.racks.reduce((sum, rack) => sum + Number(rack.documentCount || 0), 0)
  }));
  return page("문서고 도면", `
    <section class="page-head floor-plan-page-head">
      <div>
        <nav class="breadcrumb" aria-label="경로"><a href="/app">문서검색</a><span>/</span><span>문서고 도면</span></nav>
        <h1>문서고 도면</h1>
        <p>구역과 랙의 실제 배치를 확인하고, 랙을 선택해 해당 위치의 문서를 검색합니다.</p>
      </div>
      <div class="button-group"><button type="button" class="button secondary" data-print><i class="fa-solid fa-print" aria-hidden="true"></i>도면 인쇄</button><a class="button action-button" href="/app"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>위치 검색</a></div>
    </section>
    <section class="panel floor-plan-summary" aria-label="문서고 운영 요약">
      <div><strong>현재 ${floorPlan.length}개 구역 · ${rackCount}개 랙을 운영 중입니다.</strong><p>선택한 랙에서 보관 중인 문서 목록으로 바로 이동할 수 있습니다.</p></div>
    </section>
    <div class="floor-plan-layout">
      <section class="panel archive-floor-plan-page" aria-label="문서고 전체 도면">
        <p class="mobile-floor-plan-note">랙 목록에서 충분히 큰 항목으로 랙을 선택하고, 아래 도면에서 실제 배치를 확인하세요.</p>
        ${floorPlan.length
          ? floorPlanView(floorPlan)
          : `<div class="empty-state"><i class="fa-regular fa-folder-open" aria-hidden="true"></i><p>표시할 랙 도면이 없습니다.</p></div>`}
      </section>
      ${zoneRows.length ? `<aside class="panel floor-plan-side" aria-labelledby="zone-overview-title">
        <div class="section-title"><h2 id="zone-overview-title">구역·랙 목록</h2><span class="count-badge">${rackCount}개 랙</span></div>
        <div class="zone-overview">${floorPlan.map((region, regionIndex) => `<details${regionIndex === 0 ? " open" : ""}><summary><span><strong>${escapeHtml(region.label)}</strong><small>${region.racks.reduce((sum, rack) => sum + Number(rack.documentCount || 0), 0).toLocaleString("ko-KR")}건</small></span><span>${region.racks.length}개 랙</span></summary><div class="zone-rack-links">${region.racks.map((rack) => `<a href="/app?rack=${Number(rack.id)}&amp;status=active&amp;sort=location" data-rack-select data-rack-id="${Number(rack.id)}" data-rack-code="${escapeHtml(rack.code)}" data-rack-description="${escapeHtml(rack.description || "")}" data-rack-type="${rack.isSingleSided ? "단면" : "양면"}" data-rack-faces="${rack.isSingleSided ? 1 : 2}" data-rack-columns="${Number(rack.columnCount || 0)}" data-rack-shelves="${Number(rack.shelfCount || 0)}" data-rack-documents="${Number(rack.documentCount || 0)}" data-zone="${Number(region.zoneNumber)}"><span class="mono">${escapeHtml(rack.code)}</span><span>${Number(rack.documentCount || 0).toLocaleString("ko-KR")}건</span></a>`).join("")}</div></details>`).join("")}</div>
        <section class="floor-rack-inspector" data-rack-inspector aria-live="polite" tabindex="-1">
          <button type="button" class="icon-button floor-rack-inspector-close" data-rack-inspector-close aria-label="랙 정보 닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
          <p class="muted" data-rack-inspector-empty>도면이나 목록에서 랙을 선택하세요.</p>
          <div data-rack-inspector-content hidden>
            <div class="section-title"><h2 data-rack-inspector-title>랙 정보</h2><span class="count-badge" data-rack-inspector-type></span></div>
            <dl class="floor-rack-facts">
              <div class="floor-rack-description"><dt>설명</dt><dd data-rack-inspector-description>설명 없음</dd></div>
              <div><dt>구조</dt><dd data-rack-inspector-structure>-</dd></div>
              <div><dt>활성 문서</dt><dd data-rack-inspector-count>-</dd></div>
            </dl>
            <div class="button-group">
              <a class="button" data-rack-inspector-documents href="/app">문서 보기</a>
              ${canManageMasters ? `<a class="button secondary" data-rack-inspector-edit href="/racks">기준정보 편집</a>` : ""}
            </div>
          </div>
        </section>
      </aside>` : ""}
    </div>
    <script>
      (function () {
        var button = document.querySelector('[data-floor-plan-zoom]');
        var scroll = document.querySelector('[data-floor-plan-scroll]');
        var fit = document.querySelector('[data-floor-plan-fit]');
        var search = document.querySelector('[data-floor-rack-search]');
        var inspector = document.querySelector('[data-rack-inspector]');
        var lastRackTrigger = null;
        var mobileRackList = window.matchMedia('(max-width: 760px)');
        var mapRackLinks = Array.from(document.querySelectorAll('.floor-plan-media [data-rack-select]'));
        var syncMapInteraction = function () {
          mapRackLinks.forEach(function (link) {
            if (mobileRackList.matches) {
              link.setAttribute('tabindex', '-1');
              link.setAttribute('aria-hidden', 'true');
            } else {
              link.removeAttribute('tabindex');
              link.removeAttribute('aria-hidden');
            }
          });
        };
        syncMapInteraction();
        mobileRackList.addEventListener?.('change', syncMapInteraction);
        var selectRack = function (link) {
          if (!inspector) return;
          lastRackTrigger = link;
          var code = link.getAttribute('data-rack-code') || '';
          var id = link.getAttribute('data-rack-id') || '';
          inspector.classList.add('is-open');
          inspector.querySelector('[data-rack-inspector-empty]').hidden = true;
          inspector.querySelector('[data-rack-inspector-content]').hidden = false;
          inspector.querySelector('[data-rack-inspector-title]').textContent = code;
          inspector.querySelector('[data-rack-inspector-type]').textContent = link.getAttribute('data-rack-type') || '';
          inspector.querySelector('[data-rack-inspector-description]').textContent = link.getAttribute('data-rack-description') || '설명 없음';
          inspector.querySelector('[data-rack-inspector-structure]').textContent = (link.getAttribute('data-rack-faces') || '1') + '면 · ' + (link.getAttribute('data-rack-columns') || '0') + '열 · ' + (link.getAttribute('data-rack-shelves') || '0') + '단';
          inspector.querySelector('[data-rack-inspector-count]').textContent = Number(link.getAttribute('data-rack-documents') || 0).toLocaleString('ko-KR') + '건';
          inspector.querySelector('[data-rack-inspector-documents]').href = '/app?rack=' + encodeURIComponent(id) + '&status=active&sort=location';
          var edit = inspector.querySelector('[data-rack-inspector-edit]');
          if (edit) edit.href = '/racks/' + encodeURIComponent(id) + '/edit';
          document.querySelectorAll('[data-rack-select]').forEach(function (item) { item.classList.toggle('is-selected', item.getAttribute('data-rack-id') === id); });
          if (window.matchMedia('(max-width: 760px)').matches) inspector.focus();
        };
        document.querySelectorAll('[data-rack-select]').forEach(function (link) {
          link.addEventListener('click', function (event) { event.preventDefault(); selectRack(link); });
        });
        button?.addEventListener('click', function () {
          var expanded = scroll?.classList.toggle('is-zoomed') || false;
          button.setAttribute('aria-pressed', expanded ? 'true' : 'false');
          button.textContent = expanded ? '전체 보기' : '도면 확대';
          if (!expanded && scroll) scroll.scrollLeft = 0;
        });
        fit?.addEventListener('click', function () {
          scroll?.classList.remove('is-zoomed');
          if (scroll) scroll.scrollLeft = 0;
          if (button) { button.setAttribute('aria-pressed', 'false'); button.textContent = '도면 확대'; }
        });
        search?.addEventListener('input', function () {
          var query = search.value.trim().toLocaleLowerCase('ko-KR');
          document.querySelectorAll('[data-rack-select]').forEach(function (item) {
            var haystack = ((item.getAttribute('data-zone') || '') + '구역 ' + (item.getAttribute('data-rack-code') || '')).toLocaleLowerCase('ko-KR');
            item.hidden = Boolean(query) && haystack.indexOf(query) === -1;
          });
        });
        var closeInspector = function () {
          inspector.classList.remove('is-open');
          lastRackTrigger?.focus();
        };
        inspector?.querySelector('[data-rack-inspector-close]')?.addEventListener('click', closeInspector);
        inspector?.addEventListener('keydown', function (event) {
          if (event.key === 'Escape') { event.preventDefault(); closeInspector(); }
        });
      })();
    </script>
  `, session);
}
