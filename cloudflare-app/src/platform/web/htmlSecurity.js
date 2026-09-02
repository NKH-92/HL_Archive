import { escapeHtml } from "../../ui/html/escape.js";

export function secureHtmlDocument(html, { nonce, csrfToken = "", demoReadOnly = false, mustChangePassword = false }) {
  const source = String(html);
  let output = "";
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("<", cursor);
    if (start < 0) return output + source.slice(cursor);
    output += source.slice(cursor, start);
    const tag = readOpeningTag(source, start);
    if (!tag) { output += "<"; cursor = start + 1; continue; }
    let opening = tag.source;
    if ((tag.name === "script" || tag.name === "style") && !tag.attributes.has("nonce")) {
      opening = addAttribute(opening, `nonce="${escapeHtml(nonce)}"`);
    }
    if (tag.name === "form" && tag.attributes.get("method")?.toLowerCase() === "post" && demoReadOnly) {
      const action = tag.attributes.get("action") || "";
      const allowed = action === "/logout" || (action === "/account/password" && mustChangePassword);
      if (!allowed) {
        opening = addAttribute(opening, "inert aria-disabled=\"true\" data-demo-disabled=\"true\"");
      }
    }
    if (tag.name === "a" && demoReadOnly && isBlockedDemoDownload(tag.attributes.get("href") || "")) {
      opening = addAttribute(opening, "hidden data-demo-blocked-download=\"true\"");
    }
    output += opening;
    if (tag.name === "form" && tag.attributes.get("method")?.toLowerCase() === "post" && csrfToken) {
      output += `<input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">`;
    }
    if (tag.name === "script" || tag.name === "style") {
      const rawTextEnd = findRawTextElementEnd(source, tag.end, tag.name);
      output += source.slice(tag.end, rawTextEnd);
      cursor = rawTextEnd;
      continue;
    }
    cursor = tag.end;
  }
  return output;
}

function isBlockedDemoDownload(href) {
  const path = String(href).split("?", 1)[0];
  return path === "/documents/export.csv"
    || path === "/api/document-snapshot/export"
    || /^\/document-snapshot-exports\/[^/]+\/rows$/.test(path)
    || /^\/sets\/\d+\/export(?:\.csv)?$/.test(path)
    || /^\/disposal-batches\/\d+\/export\.csv$/.test(path)
    || /^\/document-import-jobs\/\d+\/failures\.csv$/.test(path);
}

export function scanHtmlOpeningTags(html) {
  const tags = [];
  const source = String(html);
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("<", cursor);
    if (start < 0) break;
    const tag = readOpeningTag(source, start);
    if (!tag) { cursor = start + 1; continue; }
    tags.push(Object.freeze({ name: tag.name, attributes: Object.freeze(Object.fromEntries(tag.attributes)) }));
    if (tag.name === "script" || tag.name === "style") {
      cursor = findRawTextElementEnd(source, tag.end, tag.name);
      continue;
    }
    cursor = tag.end;
  }
  return Object.freeze(tags);
}

function readOpeningTag(source, start) {
  if (source[start + 1] === "/" || source[start + 1] === "!" || source[start + 1] === "?") return null;
  let index = start + 1;
  while (/\s/.test(source[index] || "")) index += 1;
  const nameStart = index;
  while (/[A-Za-z0-9:-]/.test(source[index] || "")) index += 1;
  if (index === nameStart) return null;
  const name = source.slice(nameStart, index).toLowerCase();
  let quote = "";
  for (; index < source.length; index += 1) {
    const char = source[index];
    if (quote) { if (char === quote) quote = ""; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === ">") {
      const tagSource = source.slice(start, index + 1);
      return { name, source: tagSource, end: index + 1, attributes: readAttributes(tagSource, name) };
    }
  }
  return null;
}

function readAttributes(tagSource, name) {
  const attributes = new Map();
  let index = 1 + name.length;
  while (index < tagSource.length - 1) {
    while (/\s|\//.test(tagSource[index] || "")) index += 1;
    const start = index;
    while (/[^\s=/>]/.test(tagSource[index] || "")) index += 1;
    if (index === start) break;
    const key = tagSource.slice(start, index).toLowerCase();
    while (/\s/.test(tagSource[index] || "")) index += 1;
    let value = "";
    if (tagSource[index] === "=") {
      index += 1;
      while (/\s/.test(tagSource[index] || "")) index += 1;
      const quote = tagSource[index] === '"' || tagSource[index] === "'" ? tagSource[index++] : "";
      const valueStart = index;
      if (quote) while (index < tagSource.length && tagSource[index] !== quote) index += 1;
      else while (/[^\s>]/.test(tagSource[index] || "")) index += 1;
      value = tagSource.slice(valueStart, index);
      if (quote) index += 1;
    }
    attributes.set(key, value);
  }
  return attributes;
}

function addAttribute(opening, attribute) {
  const insertAt = opening.endsWith("/>") ? opening.length - 2 : opening.length - 1;
  return `${opening.slice(0, insertAt)} ${attribute}${opening.slice(insertAt)}`;
}

function findRawTextElementEnd(source, contentStart, name) {
  const lowerSource = source.toLowerCase();
  const marker = `</${name}`;
  let closingStart = lowerSource.indexOf(marker, contentStart);
  while (closingStart >= 0) {
    const boundary = lowerSource[closingStart + marker.length] || "";
    if (!boundary || /[\s>]/.test(boundary)) {
      const closingEnd = source.indexOf(">", closingStart + marker.length);
      return closingEnd < 0 ? source.length : closingEnd + 1;
    }
    closingStart = lowerSource.indexOf(marker, closingStart + marker.length);
  }
  return source.length;
}
