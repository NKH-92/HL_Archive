// 서버와 정적 브라우저 자산이 공유하는 문서 결과 마크업. 사용자 값은 전달받은 escape로 처리한다.
export function resultRow(item, { selectable = false, selected = false, query = "", returnTo = "/app" } = {}, escape, highlight) {
  const id = Number(item.id);
  const name = item.documentName || "문서명 없음";
  const number = item.documentNumber || "";
  const rawRevision = item.revisionLabel || item.revisionNumber;
  const revision = rawRevision === null || rawRevision === undefined || rawRevision === "" ? "N/A" : /^Rev\./i.test(String(rawRevision)) ? String(rawRevision) : `Rev.${rawRevision}`;
  const location = item.location || {};
  const label = location.label || "위치 미지정";
  const url = `/documents/${id}?returnTo=${encodeURIComponent(returnTo)}`;
  const disposed = item.status === "disposed";
  return `<tr class="viewer-result-row${disposed ? " is-disposed" : ""}" data-document-row data-document-id="${id}" data-document-url="${escape(url)}" data-document-name="${escape(name)}" data-document-number="${escape(number)}" data-document-revision="${escape(revision)}" data-document-category="${escape(item.categoryName || "-")}" data-document-location="${escape(label)}" data-document-status="${disposed ? "폐기" : "보관중"}" data-document-column="${Number(location.columnNumber) || 0}" data-document-shelf="${Number(location.shelfNumber) || 0}">
    ${selectable ? `<td class="check-col" data-label="선택"><label class="bulk-check-target"><input type="checkbox" value="${id}" data-bulk-item aria-label="${escape(name)} 선택"${selected ? " checked" : ""}></label></td>` : ""}
    <td class="viewer-result-name"><a href="${escape(url)}" data-doc-click="${id}">${highlight(name, query, escape)}</a><span class="viewer-result-identity mono"><span class="viewer-result-number">${highlight(number, query, escape)}</span><small>${escape(revision)}</small></span>${disposed ? '<span class="status document-disposed">폐기</span>' : ""}</td>
    <td class="comparison-column result-number-column mono" data-label="문서번호">${highlight(number, query, escape)}</td>
    <td class="comparison-column result-revision-column mono" data-label="개정">${escape(revision)}</td>
    <td class="viewer-result-location" data-label="보관 위치">${escape(label)}</td>
    <td class="viewer-result-category" data-label="대분류">${escape(item.categoryName || "-")}</td>
    <td class="optional-column" data-column="revision-date" data-label="제·개정일" hidden>${escape(item.revisionDate || "-")}</td>
    <td class="viewer-result-action"><button type="button" class="button secondary sm" data-preview-open aria-label="${escape(name)} 빠른 보기">빠른 보기</button></td>
  </tr>`;
}

export function resultTable(rows, selectable = false) {
  return `<div class="viewer-result-table${selectable ? " is-selectable" : ""}"><table aria-label="문서 검색 결과"><thead><tr class="viewer-result-header">${selectable ? '<th scope="col" class="check-col"><span class="sr-only">선택</span></th>' : ""}<th scope="col" class="result-name-heading"><span class="combined-heading">문서명 · 문서번호 · 개정</span><span class="comparison-heading">문서명</span></th><th scope="col" class="comparison-column result-number-column">문서번호</th><th scope="col" class="comparison-column result-revision-column">개정</th><th scope="col" class="result-location-heading">보관 위치</th><th scope="col" class="result-category-heading">대분류</th><th scope="col" data-column="revision-date" hidden>제·개정일</th><th scope="col"><span class="sr-only">빠른 보기</span></th></tr></thead><tbody class="viewer-result-list">${rows}</tbody></table></div>`;
}
