// 전역 CSS의 랙과 도면 조각. 순서는 styles.js에서 고정한다.

export function floorPlanStyles() {
  return `    .rack-zone { border-radius: var(--r-md); padding: var(--sp-4); background: var(--gray-50); }
    .rack-zone h3 { margin: 0 0 var(--sp-2); }
    .rack-zone-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: var(--sp-2); }
    .rack-tile { min-height: 68px; display: grid; place-items: center; gap: 0; padding: var(--sp-2); border-radius: var(--r-sm); background: var(--surface); border: 1px solid var(--line); text-decoration: none; text-align: center; font-size: 12.5px; transition: border-color .15s ease; }
    .rack-tile:hover { border-color: var(--gray-400); }
    .rack-tile.is-hit { background: var(--primary); border-color: var(--primary); color: var(--surface); font-weight: 700; }
    .legend-box { display: inline-block; width: 8px; height: 13px; border-radius: 2px; background: var(--surface); border: 1px solid var(--gray-300); margin-right: var(--sp-1); }
    .legend-box.single { box-shadow: inset 2px 0 0 var(--gray-300); }
    .legend-box.hit { background: var(--primary); border-color: var(--primary); }

    .floor-plan-shell { display: grid; gap: var(--sp-2); }
    .floor-plan-tools { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); color: var(--gray-500); font-size: 12.5px; }
    .floor-rack-search { flex: 1 1 260px; max-width: 420px; }
    .floor-plan-page-head p { max-width: 720px; margin: var(--sp-1) 0 0; color: var(--gray-500); font-size: 13px; }
    .mobile-floor-plan-note { display: none; }
    .archive-floor-plan-page { overflow: hidden; }
    .floor-plan-scroll { width: 100%; overflow-x: auto; padding-bottom: var(--sp-1); scrollbar-gutter: stable; }
    /* aspect-ratio는 반드시 도면 이미지 원본 비율(1024x797)과 같아야 퍼센트 오버레이가 어긋나지 않는다. */
    .floor-plan-media { position: relative; overflow: hidden; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--gray-100); aspect-ratio: 1024 / 797; }
    .floor-plan-media img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .floor-region { position: absolute; top: var(--top); left: var(--left); width: var(--width); height: var(--height); border: 1.5px solid rgba(30, 85, 196, .45); border-radius: var(--r-sm); background: rgba(30, 85, 196, .05); }
    .floor-region-label { position: absolute; top: var(--sp-1); left: var(--sp-1); padding: 0 var(--sp-2); line-height: 18px; border-radius: 999px; background: rgba(255, 255, 255, .92); color: var(--primary); font-size: 11px; font-weight: 700; }
    .floor-wall-marker { position: absolute; top: var(--sp-1); left: 50%; z-index: 3; transform: translateX(-50%); padding: 0 var(--sp-2); line-height: 18px; border-radius: 999px; background: var(--gray-800); color: var(--surface); font-size: 10px; font-weight: 700; white-space: nowrap; }
    /* 랙 실루엣: 세로로 긴 막대가 구역 안에 좌→우로 늘어선다 (실제 배치 반영). */
    .floor-rack { position: absolute; left: var(--rack-left); top: 50%; transform: translate(-50%, -50%); width: var(--rack-width, 6%); min-width: 8px; height: 72%; display: flex; align-items: center; justify-content: center; border-radius: 3px; overflow: visible; background: var(--surface); box-shadow: inset 0 0 0 1px var(--gray-300); color: var(--gray-600); text-decoration: none; font-weight: 700; transition: box-shadow .12s ease, background .12s ease; }
    .floor-rack .rack-num { position: absolute; top: calc(100% + var(--sp-1)); left: 50%; z-index: 4; transform: translateX(-50%); display: grid; place-items: center; min-width: var(--sp-6); height: var(--sp-6); padding: 0 var(--sp-1); border: 1px solid var(--gray-300); border-radius: 999px; background: var(--surface); color: var(--gray-900); box-shadow: var(--shadow-1); font-family: var(--font-mono); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; letter-spacing: 0; white-space: nowrap; }
    /* 양면 랙: 좌(N-1면)·우(N-2면)를 세로 점선으로 나눈다. */
    .floor-rack .rack-face { position: absolute; top: 0; bottom: 0; width: 50%; pointer-events: none; transition: background .12s ease; }
    .floor-rack .rack-face-a { left: 0; border-right: 1px dashed var(--gray-400); }
    .floor-rack .rack-face-b { right: 0; }
    /* 면 단위 강조(문서 상세): 문서가 있는 반쪽만 파랗게. */
    .floor-rack[data-face-hit="A"] .rack-face-a,
    .floor-rack[data-face-hit="B"] .rack-face-b { background: var(--primary); }
    .floor-rack[data-face-hit] .rack-num,
    .floor-rack.is-hit .rack-num { border-color: var(--primary); background: var(--primary); color: var(--surface); box-shadow: 0 0 0 3px var(--ring); }
    .floor-rack:focus-visible .rack-num { border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
    .floor-rack:hover { background: var(--gray-100); box-shadow: inset 0 0 0 1.5px var(--gray-400); z-index: 2; }
    .floor-rack.is-single { box-shadow: inset 3px 0 0 var(--gray-300), inset 0 0 0 1px var(--gray-300); }
    .floor-rack.is-hit, .floor-rack.is-single.is-hit { background: var(--primary); color: var(--surface); box-shadow: 0 0 0 2px var(--ring); z-index: 1; }
    .floor-rack.is-hit .rack-face-a { border-right-color: rgba(255, 255, 255, .6); }
    .floor-rack.is-hit:hover { background: var(--primary-strong); }
    .floor-rack.is-selected { z-index: 3; background: var(--primary-soft); box-shadow: 0 0 0 3px var(--ring), inset 0 0 0 1px var(--primary); }
    .rack-hit-pin { position: absolute; left: 50%; bottom: calc(100% + var(--sp-2)); z-index: 6; transform: translateX(-50%); padding: var(--sp-1) var(--sp-2); border-radius: 999px; background: var(--action); color: var(--action-ink); font-size: 10px; font-weight: 800; line-height: 1; white-space: nowrap; box-shadow: var(--shadow-1); }

    /* 구역 확대 도면(문서 상세): 전체 도면을 스케일·이동해 한 구역만 채운다. */
    .floor-zoom { position: relative; width: 100%; overflow: hidden; border-radius: var(--r-md); border: 1px solid var(--gray-100); background: var(--surface); aspect-ratio: var(--z-aw) / var(--z-ah); }
    .floor-zoom-canvas { position: absolute; width: calc(10000% / var(--zw)); height: calc(10000% / var(--zh)); left: calc(var(--zl) * -100% / var(--zw)); top: calc(var(--zt) * -100% / var(--zh)); }
    .floor-zoom-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; display: block; }
    .floor-zoom.is-spotlight .floor-rack:not(.is-hit):not([data-face-hit]) { opacity: .28; }
    .floor-zoom.is-spotlight .floor-rack.is-hit,
    .floor-zoom.is-spotlight .floor-rack[data-face-hit] { z-index: 5; box-shadow: 0 0 0 3px var(--action-soft), inset 0 0 0 2px var(--action-ink); }
    .floor-zoom.is-spotlight .floor-rack.is-hit { background: var(--action); color: var(--action-ink); }
    .floor-zoom.is-spotlight .floor-rack[data-face-hit="A"] .rack-face-a,
    .floor-zoom.is-spotlight .floor-rack[data-face-hit="B"] .rack-face-b { background: var(--action); }
    .floor-zoom.is-spotlight .floor-rack[data-face-hit] .rack-num,
    .floor-zoom.is-spotlight .floor-rack.is-hit .rack-num { border-color: var(--action); background: var(--action); color: var(--action-ink); box-shadow: 0 0 0 3px var(--action-soft); }
    .floor-plan-summary, .zone-list { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: center; color: var(--gray-500); font-size: 12.5px; }
    .floor-plan-summary span, .zone-list a { display: inline-flex; align-items: center; gap: var(--sp-1); padding: var(--sp-1) var(--sp-3); border-radius: 999px; background: var(--gray-100); text-decoration: none; font-weight: 600; }
    .zone-list a:hover { background: var(--primary-soft); color: var(--primary); }
    .zone-overview details { border-bottom: 1px solid var(--gray-100); }
    .zone-overview details:last-child { border-bottom: 0; }
    .zone-overview summary { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding: var(--sp-3) 0; cursor: pointer; }
    .zone-rack-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-2); padding: 0 0 var(--sp-3); }
    .zone-rack-links a { padding: var(--sp-2); border: 1px solid var(--line); border-radius: var(--r-md); }
    .zone-rack-links a.is-selected { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
    .floor-rack-inspector { position: sticky; top: var(--sp-4); display: grid; gap: var(--sp-3); margin-top: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--line); }
    .floor-rack-inspector-close { display: none; justify-self: end; }
    .floor-rack-facts { display: grid; gap: var(--sp-2); margin: 0; }
    .floor-rack-facts div { display: flex; justify-content: space-between; gap: var(--sp-3); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--gray-100); }
    .floor-rack-facts dt { color: var(--gray-500); font-size: 12px; }
    .floor-rack-facts dd { margin: 0; font-weight: 700; }
    .floor-rack-facts .floor-rack-description { display: grid; justify-content: stretch; }
    .floor-rack-description dd { color: var(--gray-700); font-weight: 500; line-height: 1.55; overflow-wrap: anywhere; }
`;
}
