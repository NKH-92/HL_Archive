// generated from src/views/clientScript/excelSnapshots.js; do not edit
document.addEventListener('DOMContentLoaded', function () {
      var excelRoot = document.querySelector('[data-excel-snapshot]');
      var excelUploadForm = document.querySelector('[data-excel-snapshot-upload]');
      var excelHeaders = ["문서번호","개정번호","제/개정일","폐기 예정 년도","문서명","문서종류","랙 위치 (구역)","랙 위치 (번호)","랙 위치 (열)","랙 위치 (선반)","랙 위치 (단면)","태그","비고","상태"];
      var excelSchemaVersion = 4;
      var excelCachedFile = null;
      var excelCachedParsed = null;
      var excelSnapshotMaxFileBytes = 20971520;
      var excelSnapshotMaxZipEntries = 500;
      var excelSnapshotMaxZipUncompressedBytes = 104857600;
      var excelSnapshotMaxItems = 30000;
      var excelSnapshotDeltaMaxItems = 1000;
      var excelSnapshotMembershipChunkSize = 1000;
      var excelCsvFormulaPrefix = new RegExp("^[\\s\\u0000-\\u001F\\u007F-\\u009F]*[=+\\-@]");

      function excelCellText(cell) {
        var value = cell && cell.value;
        if (value === null || value === undefined) return '';
        if (value instanceof Date) {
          return excelUtcDateOnly(value);
        }
        if (typeof value === 'object' && value.result !== undefined) value = value.result;
        if (typeof value === 'object' && Array.isArray(value.richText)) return value.richText.map(function (part) { return part.text || ''; }).join('').trim();
        if (typeof value === 'object' && value.text !== undefined) return String(value.text).trim();
        return String(value).trim();
      }

      function excelUtcDateOnly(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        var year = date.getUTCFullYear();
        var month = String(date.getUTCMonth() + 1).padStart(2, '0');
        var day = String(date.getUTCDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
      }

      function excelDateOnlyToUtcDate(value) {
        var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        var year = Number(match[1]);
        var month = Number(match[2]);
        var day = Number(match[3]);
        var date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
        return date;
      }

      function excelDateText(cell, workbook) {
        var value = cell && cell.value;
        if (value instanceof Date) return excelUtcDateOnly(value);
        if (typeof value === 'number' && Number.isFinite(value)) {
          if (Number.isInteger(value) && value >= 1000 && value <= 9999) return String(value);
          var date1904 = !!(workbook && workbook.properties && workbook.properties.date1904);
          var epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
          var date = new Date(epoch + Math.round(value * 86400000));
          return excelUtcDateOnly(date);
        }
        return excelCellText(cell);
      }

      async function excelRowBaseHash(source) {
        var canonical = JSON.stringify([
          source.documentNumber || '', source.revisionNumber || '', source.revisionDate || '',
          source.disposalDueYear || '', source.documentName || '', source.category || '',
          source.zoneNumber || '', source.rackNumber || '', source.rackColumn || '', source.shelfNumber || '',
          source.rackFace || '', source.tags || '', source.note || '', source.status || ''
        ]);
        var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
        return Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
      }

      function excelDataSheet(workbook) {
        var preferred = workbook.getWorksheet('문서데이터') || workbook.getWorksheet('업로드양식');
        var candidates = preferred ? [preferred].concat(workbook.worksheets.filter(function (sheet) { return sheet !== preferred; })) : workbook.worksheets;
        for (var i = 0; i < candidates.length; i += 1) {
          var matches = excelHeaders.every(function (header, index) { return excelCellText(candidates[i].getCell(1, index + 1)) === header; });
          if (matches) return candidates[i];
        }
        return null;
      }

      function excelMeta(workbook) {
        var sheet = workbook.getWorksheet('_시스템정보');
        if (!sheet) return { hasSystemInfo: false, baseVersion: 0, schemaVersion: 0, currentSnapshotId: 0, exportManifestId: '', canonicalExportHash: '', exportedAt: '' };
        var values = {};
        sheet.eachRow(function (row) { values[excelCellText(row.getCell(1))] = excelCellText(row.getCell(2)); });
        return {
          hasSystemInfo: true,
          baseVersion: Number(values.baseVersion || 0),
          schemaVersion: Number(values.schemaVersion || 0),
          currentSnapshotId: Number(values.currentSnapshotId || 0),
          exportManifestId: values.exportManifestId || values.sourceExportId || '',
          canonicalExportHash: values.canonicalExportHash || '',
          exportedAt: values.exportedAt || ''
        };
      }


      function excelRelationshipSourceDirectory(relationshipPath) {
        if (relationshipPath === '_rels/.rels') return [];
        var marker = '/_rels/';
        var markerIndex = relationshipPath.indexOf(marker);
        if (markerIndex < 0) return [];
        var source = relationshipPath.slice(0, markerIndex).split('/');
        source.push(relationshipPath.slice(markerIndex + marker.length, -'.rels'.length));
        source.pop();
        return source;
      }

      function excelRelativeRelationshipTarget(relationshipPath, absoluteTarget) {
        var source = excelRelationshipSourceDirectory(relationshipPath);
        var target = absoluteTarget.replace(/^\/+/, '').split('/');
        var common = 0;
        while (common < source.length && common < target.length && source[common] === target[common]) common += 1;
        var relative = [];
        for (var index = common; index < source.length; index += 1) relative.push('..');
        return relative.concat(target.slice(common)).join('/');
      }

      async function excelNormalizeOpenXml(buffer) {
        if (!window.JSZip) return { changed: false, buffer: buffer };
        var zip = await window.JSZip.loadAsync(buffer);
        var names = Object.keys(zip.files);
        var namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        var changed = false;
        for (var index = 0; index < names.length; index += 1) {
          var name = names[index];
          var entry = zip.files[name];
          if (!entry || entry.dir || (!name.endsWith('.xml') && !name.endsWith('.rels'))) continue;
          var original = await entry.async('string');
          var compatible = original;
          if (name.endsWith('.xml') && compatible.indexOf('xmlns:x="' + namespace + '"') >= 0) {
            compatible = compatible
              .replace(/<(\/?)x:/g, '<$1')
              .replace(' xmlns:x="' + namespace + '"', ' xmlns="' + namespace + '"');
          }
          if (name.endsWith('.rels')) {
            compatible = compatible.replace(/Target=(["'])\/(xl\/[^"'#?]+)\1/g, function (_, quote, target) {
              return 'Target=' + quote + excelRelativeRelationshipTarget(name, target) + quote;
            });
          }
          if (compatible !== original) {
            zip.file(name, compatible);
            changed = true;
          }
        }
        if (!changed) return { changed: false, buffer: buffer };
        return { changed: true, buffer: await zip.generateAsync({ type: 'arraybuffer' }) };
      }

      async function excelAssertZipSafety(buffer, maxUncompressedBytes, maxEntries) {
        if (!window.JSZip) throw new Error('엑셀 ZIP 안전성 검사 모듈을 불러오지 못했습니다. 화면을 새로고침하세요.');
        var zip = await window.JSZip.loadAsync(buffer);
        var entries = Object.keys(zip.files);
        if (entries.length > maxEntries) throw new Error('엑셀 ZIP 항목 수가 안전 한도를 초과했습니다.');
        var total = 0;
        for (var index = 0; index < entries.length; index += 1) {
          var entry = zip.files[entries[index]];
          if (!entry || entry.dir) continue;
          var size = Number(entry._data && entry._data.uncompressedSize);
          if (!Number.isFinite(size) || size < 0) throw new Error('엑셀 ZIP 항목 크기를 검증할 수 없습니다.');
          total += size;
          if (total > maxUncompressedBytes) throw new Error('엑셀 압축 해제 크기가 50MB 안전 한도를 초과했습니다.');
        }
      }

      async function excelLoadWorkbook(buffer) {
        var workbook = new window.ExcelJS.Workbook();
        try {
          await workbook.xlsx.load(buffer);
          return workbook;
        } catch (originalError) {
          var normalized;
          try {
            normalized = await excelNormalizeOpenXml(buffer);
          } catch {
            throw originalError;
          }
          if (!normalized.changed) throw originalError;
          workbook = new window.ExcelJS.Workbook();
          try {
            await workbook.xlsx.load(normalized.buffer);
            return workbook;
          } catch (normalizedError) {
            throw new Error('엑셀 파일 구조를 읽을 수 없습니다. Excel에서 다시 저장한 뒤 시도하세요. (' + normalizedError.message + ')');
          }
        }
      }


      async function readExcelSnapshot(file) {
        if (!window.ExcelJS) throw new Error('엑셀 처리 모듈을 불러오지 못했습니다. 화면을 새로고침하세요.');
        if (!file || !/\.xlsx$/i.test(file.name || '')) throw new Error('xlsx 형식의 엑셀 파일을 선택하세요.');
        if (!Number.isInteger(file.size) || file.size < 1) throw new Error('원본 엑셀 파일 크기를 확인할 수 없습니다.');
        if (file.size > excelSnapshotMaxFileBytes) throw new Error('엑셀 파일은 10MB 이하여야 합니다.');
        var buffer = await file.arrayBuffer();
        await excelAssertZipSafety(buffer, excelSnapshotMaxZipUncompressedBytes, excelSnapshotMaxZipEntries);
        var workbook = await excelLoadWorkbook(buffer);
        var sheet = excelDataSheet(workbook);
        if (!sheet) throw new Error('schema v4 한글 14개 열이 순서대로 있는 최신 문서데이터 시트를 찾을 수 없습니다. 현재 대장을 다시 추출하세요.');
        var meta = excelMeta(workbook);
        var rows = [];
        var originalKeyCount = 0;
        for (var rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
          var row = sheet.getRow(rowNumber);
          var visible = excelHeaders.map(function (_, index) { return excelCellText(row.getCell(index + 1)); });
          if (visible.every(function (value) { return !value; })) continue;
          var originalKey = excelCellText(row.getCell(15));
          if (originalKey) originalKeyCount += 1;
          var source = {
            documentNumber: visible[0], revisionNumber: visible[1], revisionDate: excelDateText(row.getCell(3), workbook),
            disposalDueYear: visible[3], documentName: visible[4], category: visible[5], zoneNumber: visible[6],
            rackNumber: visible[7], rackColumn: visible[8], shelfNumber: visible[9], rackFace: visible[10],
            tags: visible[11], note: visible[12], status: visible[13]
          };
          rows.push({
            rowNumber: rowNumber,
            sourceRowKey: originalKey || '',
            membershipRowKey: originalKey || ('TMP-CLIENT-' + crypto.randomUUID()),
            baseRowVersion: Number(excelCellText(row.getCell(16)) || 0),
            baseHash: excelCellText(row.getCell(17)).toLowerCase(),
            source: source
          });
        }
        if (!rows.length) throw new Error('엑셀에 동기화할 문서가 없습니다.');
        if (rows.length > excelSnapshotMaxItems) throw new Error('엑셀 문서는 최대 ' + excelSnapshotMaxItems.toLocaleString('ko-KR') + '건까지 동기화할 수 있습니다.');
        if (meta.hasSystemInfo) {
          if (!meta.schemaVersion) throw new Error('관리 파일의 schemaVersion이 없습니다.');
          if (!meta.baseVersion) throw new Error('관리 파일의 baseVersion이 없습니다.');
          if (!meta.currentSnapshotId && !meta.exportManifestId) throw new Error('관리 파일의 currentSnapshotId 또는 exportManifestId가 필요합니다.');
          if (meta.exportManifestId && !/^[a-f0-9]{64}$/i.test(meta.canonicalExportHash)) throw new Error('관리 파일의 canonicalExportHash가 없거나 올바르지 않습니다.');
        }
        await Promise.all(rows.map(async function (row) {
          row.currentHash = await excelRowBaseHash(row.source);
          row.isDelta = meta.schemaVersion < 2 || !row.sourceRowKey || !row.baseHash || row.currentHash !== row.baseHash;
        }));
        var digest = await crypto.subtle.digest('SHA-256', buffer);
        var hash = Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
        return {
          rows: rows,
          hash: hash,
          mode: meta.hasSystemInfo ? 'managed' : 'bootstrap',
          baseVersion: meta.baseVersion,
          schemaVersion: meta.hasSystemInfo ? meta.schemaVersion : excelSchemaVersion,
          currentSnapshotId: meta.currentSnapshotId,
          exportManifestId: meta.exportManifestId,
          canonicalExportHash: meta.canonicalExportHash,
          exportedAt: meta.exportedAt,
          hasRowKeys: originalKeyCount === rows.length
        };
      }

      function excelSummary(parsed, file) {
        var node = document.querySelector('[data-excel-file-summary]');
        if (!node) return;
        node.hidden = false;
        var size = file.size >= 1048576 ? (file.size / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(file.size / 1024)) + 'KB';
        node.textContent = file.name + ' · ' + size + ' · ' + parsed.rows.length.toLocaleString('ko-KR') + '행' + (parsed.mode === 'managed' ? ' · 기준 버전 ' + parsed.baseVersion : ' · bootstrap(메타데이터 없음)');
        var root = document.querySelector('[data-excel-snapshot]');
        var currentVersion = Number(root && root.getAttribute('data-current-version') || 0);
        var base = document.querySelector('[data-excel-base-version]');
        var latest = document.querySelector('[data-excel-latest]');
        var exported = document.querySelector('[data-excel-exported-at]');
        var stale = document.querySelector('[data-excel-stale-warning]');
        if (base) base.textContent = parsed.baseVersion ? 'V' + parsed.baseVersion : '메타데이터 없음';
        if (exported) exported.textContent = parsed.exportedAt || '기록 없음';
        if (latest) latest.textContent = parsed.baseVersion && parsed.baseVersion === currentVersion ? '현재 버전과 일치' : parsed.baseVersion ? '현재 버전과 불일치' : '서버 검증 필요';
        if (stale) stale.hidden = !(parsed.baseVersion && currentVersion && parsed.baseVersion < currentVersion);
      }

      function excelProgress(done, total, message) {
        var wrap = document.querySelector('[data-excel-progress]');
        var bar = document.querySelector('[data-excel-progress-bar]');
        var text = document.querySelector('[data-excel-message]');
        var percent = Math.max(0, Math.min(100, Math.round(done / Math.max(total, 1) * 100)));
        if (wrap) wrap.hidden = false;
        if (bar) bar.value = percent;
        if (text && message) text.textContent = message;
      }

      function excelRenderErrors(errors) {
        var panel = document.querySelector('[data-excel-errors]');
        var table = panel && panel.querySelector('[data-snapshot-error-table] tbody');
        if (!panel || !table) return;
        var items = Array.isArray(errors) ? errors : [];
        table.textContent = '';
        items.forEach(function (error, index) {
          var row = document.createElement('tr');
          if (index >= 20) row.hidden = true;
          var labels = ['행', '필드', '코드', '오류'];
          [error.rowNumber || '-', error.field || '-', error.code || 'SNAPSHOT_INVALID_FIELD', error.message || '검증 오류'].forEach(function (value, cellIndex) {
            var cell = document.createElement('td');
            cell.setAttribute('data-label', labels[cellIndex]);
            cell.textContent = String(value);
            row.appendChild(cell);
          });
          table.appendChild(row);
        });
        panel.hidden = items.length === 0;
        var count = panel.querySelector('[data-excel-error-count]');
        if (count) count.textContent = items.length.toLocaleString('ko-KR') + '건';
        var summary = panel.querySelector('[data-excel-error-summary]');
        if (summary) summary.textContent = items.length > 20 ? '앞의 20건을 표시합니다. 외 ' + (items.length - 20).toLocaleString('ko-KR') + '건은 CSV에서 확인하세요.' : '검증 오류를 수정한 뒤 다시 업로드하세요.';
      }

      function excelCsvCell(value) {
        var text = String(value || '');
        if (excelCsvFormulaPrefix.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
      }

      document.querySelectorAll('[data-snapshot-errors-csv]').forEach(function (button) {
        button.addEventListener('click', function () {
          var table = button.closest('[data-excel-errors]')?.querySelector('[data-snapshot-error-table]');
          if (!table) return;
          var lines = [['행', '필드', '코드', '오류']];
          table.querySelectorAll('tbody tr').forEach(function (row) {
            lines.push(Array.from(row.cells).map(function (cell) { return cell.textContent || ''; }));
          });
          var csv = '﻿' + lines.map(function (line) { return line.map(excelCsvCell).join(','); }).join('\r\n');
          var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          var link = document.createElement('a');
          link.href = url; link.download = '엑셀_대장_검증오류.csv'; document.body.appendChild(link); link.click(); link.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });
      });

      async function excelPost(path, data) {
        var csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        var payload = new URLSearchParams(Object.assign({ csrf_token: csrf }, data || {}));
        var response = await fetch(path, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload });
        var result = await response.json().catch(function () { return { ok: false, message: '서버 응답을 읽을 수 없습니다.' }; });
        if (!response.ok || !result.ok) {
          var requestError = new Error(result.message || '엑셀 동기화를 처리할 수 없습니다.');
          requestError.snapshotResult = result;
          throw requestError;
        }
        return result;
      }

      if (excelUploadForm) {
        var fileInput = excelUploadForm.querySelector('input[type="file"]');
        fileInput?.addEventListener('change', async function () {
          try {
            excelCachedFile = fileInput.files && fileInput.files[0];
            excelCachedParsed = await readExcelSnapshot(excelCachedFile);
            excelSummary(excelCachedParsed, excelCachedFile);
            var bootstrapPanel = document.querySelector('[data-excel-bootstrap]');
            if (bootstrapPanel) {
              bootstrapPanel.hidden = excelCachedParsed.mode !== 'bootstrap';
              bootstrapPanel.querySelectorAll('input').forEach(function (input) { input.required = excelCachedParsed.mode === 'bootstrap'; });
            }
            var message = document.querySelector('[data-excel-message]');
            if (message) message.textContent = '열 제목과 파일 구조를 확인했습니다. 버튼을 누르면 서버 검증을 시작합니다.';
          } catch (error) {
            excelCachedParsed = null;
            excelRenderErrors(error.snapshotResult && error.snapshotResult.errors);
            var message = document.querySelector('[data-excel-message]');
            if (message) message.textContent = error.message;
          }
        });
        excelUploadForm.addEventListener('submit', async function (event) {
          event.preventDefault();
          var button = excelUploadForm.querySelector('[data-excel-upload-button]');
          var created = null;
          var recovery = document.querySelector('[data-excel-recovery]');
          function showRecovery(snapshotId) {
            if (!recovery || !snapshotId) return;
            var text = document.createElement('span');
            text.textContent = '동기화 작업 #' + snapshotId + '이 생성되었습니다. 전송이 중단돼도 이 작업 화면에서 상태를 확인하거나 취소할 수 있습니다. ';
            var link = document.createElement('a');
            link.href = '/document-snapshots/' + snapshotId;
            link.textContent = '작업 화면 열기';
            recovery.replaceChildren(text, link);
            recovery.hidden = false;
          }
          try {
            var file = fileInput.files && fileInput.files[0];
            if (!file) throw new Error('업로드할 엑셀 파일을 선택하세요.');
            if (!excelCachedParsed || excelCachedFile !== file) excelCachedParsed = await readExcelSnapshot(file);
            var syncReasonInput = excelUploadForm.elements.namedItem('syncReason');
            var syncReason = syncReasonInput ? syncReasonInput.value.trim() : '';
            if (syncReason.length < 10 || syncReason.length > 500) {
              syncReasonInput?.focus();
              throw new Error('동기화 사유는 10자 이상 500자 이하로 입력하세요.');
            }
            button.disabled = true;
            excelProgress(1, excelCachedParsed.rows.length + 2, '동기화 작업을 준비하고 있습니다.');
            var bootstrapConfirmation = '';
            var backupConfirmed = '';
            if (excelCachedParsed.mode === 'bootstrap') {
              var bootstrapInput = excelUploadForm.elements.namedItem('bootstrapConfirmation');
              var backupInput = excelUploadForm.elements.namedItem('backupConfirmed');
              bootstrapConfirmation = bootstrapInput ? bootstrapInput.value.trim() : '';
              if (bootstrapConfirmation !== 'BOOTSTRAP') throw new Error('bootstrap 확인문구가 일치하지 않아 취소했습니다.');
              backupConfirmed = backupInput && backupInput.checked ? '1' : '';
              if (!backupConfirmed) throw new Error('운영 backup 확인이 없어 bootstrap을 취소했습니다.');
            }
            created = await excelPost('/document-snapshots', {
              sourceName: file.name,
              sourceHash: excelCachedParsed.hash,
              clientSourceHash: excelCachedParsed.hash,
              sourceSize: String(file.size),
              totalCount: String(excelCachedParsed.rows.length),
              schemaVersion: String(excelCachedParsed.schemaVersion || 1),
              baseVersion: excelCachedParsed.baseVersion ? String(excelCachedParsed.baseVersion) : '',
              currentSnapshotId: excelCachedParsed.currentSnapshotId ? String(excelCachedParsed.currentSnapshotId) : '',
              exportManifestId: excelCachedParsed.exportManifestId || '',
              canonicalExportHash: excelCachedParsed.canonicalExportHash || '',
              syncReason: syncReason,
              mode: excelCachedParsed.mode,
              hasRowKeys: excelCachedParsed.hasRowKeys ? '1' : '',
              bootstrapConfirmation: bootstrapConfirmation,
              backupConfirmed: backupConfirmed
            });
            showRecovery(created.id);
            // 최초 bootstrap은 모든 행을 실제 source row로 staging하므로 동일 최대 30,000행 membership을
            // 한 번 더 저장할 이유가 없다. managed v2만 unchanged 행 복원을 위해 membership을 보낸다.
            if (excelCachedParsed.schemaVersion >= 2 && excelCachedParsed.mode !== 'bootstrap') {
              for (var membershipIndex = 0; membershipIndex < excelCachedParsed.rows.length; membershipIndex += excelSnapshotMembershipChunkSize) {
                var membershipChunk = excelCachedParsed.rows.slice(membershipIndex, membershipIndex + excelSnapshotMembershipChunkSize).map(function (entry) {
                  return {
                    rowNumber: entry.rowNumber,
                    rowKey: entry.membershipRowKey,
                    baseRowVersion: entry.baseRowVersion || '',
                    baseHash: entry.baseHash || ''
                  };
                });
                await excelPost('/document-snapshots/' + created.id + '/membership', { rows: JSON.stringify(membershipChunk) });
                excelProgress(Math.min(membershipIndex + membershipChunk.length, excelCachedParsed.rows.length), excelCachedParsed.rows.length + 2, '전체 membership을 안전하게 나누어 전송하고 있습니다.');
              }
            }
            var deltaRows = excelCachedParsed.schemaVersion >= 2
              ? excelCachedParsed.rows.filter(function (entry) { return entry.isDelta; })
              : excelCachedParsed.rows;
            if (excelCachedParsed.mode !== 'bootstrap' && deltaRows.length > excelSnapshotDeltaMaxItems) {
              throw new Error('일상 변경 영향은 최대 ' + excelSnapshotDeltaMaxItems.toLocaleString('ko-KR') + '건입니다. 최신 대장을 기준으로 작업을 나누세요.');
            }
            var chunkSize = 50;
            for (var index = 0; index < deltaRows.length; index += chunkSize) {
              var chunk = deltaRows.slice(index, index + chunkSize).map(function (entry) {
                return {
                  rowNumber: entry.rowNumber,
                  sourceRowKey: entry.sourceRowKey || '',
                  source: entry.source
                };
              });
              await excelPost('/document-snapshots/' + created.id + '/rows', { rows: JSON.stringify(chunk) });
              excelProgress(Math.min(index + chunk.length, deltaRows.length), Math.max(deltaRows.length, 1) + 2, '변경된 엑셀 행을 안전하게 나누어 전송하고 있습니다.');
            }
            excelProgress(excelCachedParsed.rows.length + 1, excelCachedParsed.rows.length + 2, '대분류, 태그, 랙 위치와 변경 내역을 검증하고 있습니다.');
            await excelPost('/document-snapshots/' + created.id + '/prepare', {});
            excelProgress(excelCachedParsed.rows.length + 2, excelCachedParsed.rows.length + 2, '검증을 완료했습니다.');
            location.href = '/document-snapshots/' + created.id;
          } catch (error) {
            button.disabled = false;
            excelRenderErrors(error.snapshotResult && error.snapshotResult.errors);
            var message = document.querySelector('[data-excel-message]');
            if (message) message.textContent = error.message + (created?.id ? ' 생성된 작업에서 상태를 확인하고 안전하게 다시 시작하세요.' : '');
          }
        });
      }

      function excelHeaderStyle(row) {
        row.height = 28;
        row.eachCell(function (cell) {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: '맑은 고딕', size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = { bottom: { style: 'medium', color: { argb: 'FF17365D' } } };
        });
      }

      function excelDataValues(document) {
        var revisionDate = document.revisionDate ? excelDateOnlyToUtcDate(document.revisionDate) : '';
        return [document.documentNumber || 'N/A', document.revisionNumber || 'N/A', revisionDate || document.revisionDate || 'N/A', document.disposalDueYear || 'N/A', document.documentName,
          document.category, document.zoneNumber, document.rackNumber, document.rackColumn, document.shelfNumber, document.rackFace,
          document.tags || 'N/A', document.note || 'N/A', document.status, document.rowKey, document.baseRowVersion || '', document.baseHash || ''];
      }

      async function buildExcelSnapshot(payload) {
        if (!window.ExcelJS) throw new Error('엑셀 처리 모듈을 불러오지 못했습니다.');
        var workbook = new window.ExcelJS.Workbook();
        workbook.creator = '한림문서고';
        workbook.lastModifiedBy = '한림문서고';
        workbook.created = new Date();
        workbook.modified = new Date();
        workbook.calcProperties.fullCalcOnLoad = true;

        payload.documents = await Promise.all(payload.documents.map(async function (document) {
          var values = excelDataValues(document);
          var source = {
            documentNumber: String(values[0] || ''), revisionNumber: String(values[1] || ''),
            revisionDate: document.revisionDate || '', disposalDueYear: String(values[3] || ''),
            documentName: String(values[4] || ''), category: String(values[5] || ''),
            zoneNumber: String(values[6] || ''), rackNumber: String(values[7] || ''), rackColumn: String(values[8] || ''),
            shelfNumber: String(values[9] || ''), rackFace: String(values[10] || ''),
            tags: String(values[11] || ''), note: String(values[12] || ''), status: String(values[13] || '')
          };
          return Object.assign({}, document, { baseHash: await excelRowBaseHash(source) });
        }));
        var data = workbook.addWorksheet('문서데이터', { views: [{ state: 'frozen', ySplit: 1 }] });
        data.columns = [
          { width: 18 }, { width: 12 }, { width: 13 }, { width: 15 }, { width: 32 }, { width: 16 },
          { width: 14 }, { width: 14 }, { width: 13 }, { width: 15 }, { width: 15 }, { width: 24 }, { width: 30 }, { width: 12 },
          { width: 40, hidden: true }, { width: 16, hidden: true }, { width: 66, hidden: true }
        ];
        data.addRow(excelHeaders.concat(['_엑셀관리ID', '_기준행버전', '_기준행해시']));
        excelHeaderStyle(data.getRow(1));
        payload.documents.forEach(function (document) { data.addRow(excelDataValues(document)); });
        data.autoFilter = { from: 'A1', to: 'N' + Math.max(1, payload.documents.length + 1) };
        data.getColumn(3).numFmt = 'yyyy-mm-dd';
        data.getColumn(4).numFmt = '0';
        data.getColumn(7).numFmt = '0"구역"';
        data.getColumn(8).numFmt = '0'; data.getColumn(9).numFmt = '0'; data.getColumn(10).numFmt = '0';
        data.getColumn(15).hidden = true; data.getColumn(16).hidden = true; data.getColumn(17).hidden = true;
        for (var rowIndex = 2; rowIndex <= payload.documents.length + 1; rowIndex += 1) {
          var row = data.getRow(rowIndex);
          row.height = 22;
          row.eachCell({ includeEmpty: true }, function (cell, column) {
            cell.font = { name: '맑은 고딕', size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: [2,3,4,7,8,9,10,11,14].indexOf(column) >= 0 ? 'center' : 'left' };
            cell.border = { bottom: { style: 'hair', color: { argb: 'FFD9E2F3' } } };
          });
        }

        var codes = workbook.addWorksheet('_코드값', { state: 'veryHidden' });
        var zoneNumbers = Array.from(new Set(payload.codes.racks.map(function (rack) { return Number(rack.zoneNumber); }))).filter(Boolean).sort(function (a, b) { return a - b; });
        var rackNumbers = Array.from(new Set(payload.codes.racks.map(function (rack) { return Number(rack.rackNumber); }))).filter(Boolean).sort(function (a, b) { return a - b; });
        codes.addRow(['문서종류','구역','랙번호','랙 단면','상태','태그']);
        var codeLength = Math.max(payload.codes.categories.length, zoneNumbers.length, rackNumbers.length, payload.codes.tags.length, 2);
        for (var codeIndex = 0; codeIndex < codeLength; codeIndex += 1) {
          codes.addRow([
            payload.codes.categories[codeIndex] || '',
            zoneNumbers[codeIndex] || '',
            rackNumbers[codeIndex] || '',
            ['단면','1면','2면'][codeIndex] || '',
            ['보관중','폐기'][codeIndex] || '',
            payload.codes.tags[codeIndex] || ''
          ]);
        }
        var validationEnd = Math.max(payload.documents.length + 51, 100);
        for (var validationRow = 2; validationRow <= validationEnd; validationRow += 1) {
          data.getCell(validationRow, 6).dataValidation = {
            type: 'list', allowBlank: true, showErrorMessage: false, showInputMessage: true,
            promptTitle: '문서종류', prompt: '목록에서 선택하거나 새 문서종류를 직접 입력할 수 있습니다.',
            formulae: ["'_코드값'!$A$2:$A$" + (payload.codes.categories.length + 1)]
          };
          data.getCell(validationRow, 7).dataValidation = { type: 'list', allowBlank: false, formulae: ["'_코드값'!$B$2:$B$" + (zoneNumbers.length + 1)] };
          data.getCell(validationRow, 8).dataValidation = { type: 'list', allowBlank: false, formulae: ["'_코드값'!$C$2:$C$" + (rackNumbers.length + 1)] };
          data.getCell(validationRow, 11).dataValidation = { type: 'list', allowBlank: false, formulae: ["'_코드값'!$D$2:$D$4"] };
          data.getCell(validationRow, 14).dataValidation = { type: 'list', allowBlank: false, formulae: ["'_코드값'!$E$2:$E$3"] };
        }

        var print = workbook.addWorksheet('인쇄용 관리대장', { views: [{ state: 'frozen', ySplit: 4 }] });
        var printDocuments = payload.documents.filter(function (document) { return String(document.status || '') !== '폐기'; });
        print.mergeCells('A1:N1');
        print.getCell('A1').value = '한림 문서고 관리대장';
        print.getCell('A1').font = { name: '맑은 고딕', bold: true, size: 18, color: { argb: 'FF17365D' } };
        print.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        print.getRow(1).height = 34;
        print.mergeCells('A2:J3');
        [
          ['K2:L2', 'K3:L3', '담당자\nThe Person in charge'],
          ['M2:N2', 'M3:N3', '확인자\nConfirmed by']
        ].forEach(function (signatureBlock) {
          print.mergeCells(signatureBlock[0]);
          print.mergeCells(signatureBlock[1]);
          var labelCell = print.getCell(signatureBlock[0].split(':')[0]);
          var signatureCell = print.getCell(signatureBlock[1].split(':')[0]);
          labelCell.value = signatureBlock[2];
          labelCell.font = { name: '맑은 고딕', size: 10, color: { argb: 'FF000000' } };
          labelCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          signatureCell.alignment = { horizontal: 'center', vertical: 'middle' };
          [labelCell, signatureCell].forEach(function (cell) {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
            };
          });
        });
        print.getRow(2).height = 60;
        print.getRow(3).height = 60;
        print.addRow(excelHeaders);
        excelHeaderStyle(print.getRow(4));
        printDocuments.forEach(function (document) { print.addRow(excelDataValues(document).slice(0, 14)); });
        print.columns = data.columns.slice(0, 14).map(function (column) { return { width: column.width }; });
        print.getColumn(3).numFmt = 'yyyy-mm-dd';
        print.getColumn(7).numFmt = '0"구역"';
        for (var printRow = 5; printRow <= printDocuments.length + 4; printRow += 1) {
          print.getRow(printRow).height = 21;
          print.getRow(printRow).eachCell({ includeEmpty: true }, function (cell, column) {
            cell.font = { name: '맑은 고딕', size: 8 };
            cell.alignment = { vertical: 'middle', horizontal: [2,3,4,7,8,9,10,11,14].indexOf(column) >= 0 ? 'center' : 'left', shrinkToFit: true };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } } };
          });
        }
        var printLastRow = Math.max(4, printDocuments.length + 4);
        print.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
          printArea: 'A1:N' + printLastRow, printTitlesRow: '1:4',
          margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
        print.headerFooter.oddHeader = '&L별첨 15. 문서 목록 Document List';
        print.headerFooter.oddFooter = '&C&P / &N&RHLF-GR-04-15 / Rev.2';

        var guide = workbook.addWorksheet('작성안내');
        guide.columns = [{ width: 24 }, { width: 90 }];
        guide.addRow(['항목','작성 방법']); excelHeaderStyle(guide.getRow(1));
        [
          ['문서데이터','첫 행의 한글 14개 열 제목과 순서를 변경하지 마세요. 필터·정렬과 행 추가는 가능합니다.'],
          ['선택 입력','문서번호, 제/개정일, 폐기 예정 년도, 문서종류, 태그, 비고는 공란 또는 N/A로 입력할 수 있으며 다음 추출에는 N/A로 표시됩니다.'],
          ['개정번호','숫자만 입력합니다(예: 3). 화면에는 Rev.3으로 표시됩니다. 묶음 바인더처럼 개정번호가 없는 문서는 공란 또는 N/A로 입력하며 화면과 다음 추출에는 N/A로 표시됩니다.'],
          ['제/개정일','연도만 아는 경우 YYYY(예: 2026)로 입력할 수 있습니다. 전체 날짜는 YYYY-MM-DD 또는 YYYY.MM.DD로 입력하며 점 표기는 하이픈 표기로 자동 변환됩니다.'],
          ['문서종류','등록된 목록에서 선택하거나 새 문서종류를 직접 입력할 수 있습니다. 새 이름은 업로드 검토에 표시되고 최종 반영 시 기준정보에 자동 등록됩니다.'],
          ['숨김 관리 정보','O~Q열은 문서 이력, 기준 버전, 변경 탐지를 위한 시스템 값입니다. 열을 삭제하거나 값을 복사하지 마세요. 인쇄에는 나오지 않습니다.'],
          ['태그','여러 태그는 세미콜론(;)으로 구분합니다. 관리자 화면에 등록된 태그만 사용할 수 있습니다.'],
          ['랙 위치','구역은 1~3 중 하나를 선택하고, 현재 운영 중인 구역·랙·열·선반 조합과 랙의 단면/양면 규칙을 사용합니다. 모든 면은 바라본 기준으로 왼쪽부터 1열, 아래부터 1선반입니다.'],
          ['상태','보관중 또는 폐기만 입력합니다.'],
          ['동기화','업로드 후 추가·변경·제외 내역을 확인하고 현재 대장으로 반영하세요. 오류가 있으면 기존 대장은 바뀌지 않습니다.'],
          ['인쇄','인쇄용 관리대장 시트는 폐기 문서를 제외하며, A4 가로, A~N열 한 페이지 너비와 마지막 데이터 행까지로 설정되어 있습니다.']
        ].forEach(function (row) { guide.addRow(row); });
        guide.eachRow(function (row, index) { if (index > 1) { row.height = 34; row.eachCell(function (cell) { cell.alignment = { vertical: 'middle', wrapText: true }; cell.font = { name: '맑은 고딕', size: 10 }; }); } });

        var meta = workbook.addWorksheet('_시스템정보', { state: 'veryHidden' });
        meta.addRows([
          ['schemaVersion', payload.schemaVersion],
          ['baseVersion', payload.baseVersion],
          ['currentSnapshotId', payload.currentSnapshotId || ''],
          ['exportManifestId', payload.exportManifestId || ''],
          ['canonicalExportHash', payload.canonicalExportHash || ''],
          ['exportedAt', payload.exportedAt],
          ['rowCount', payload.documents.length]
        ]);
        var output = await workbook.xlsx.writeBuffer();
        var blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = '한림_문서고_관리대장_' + payload.exportedAt.slice(0, 10) + '.xlsx';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
      }

      document.querySelectorAll('[data-excel-export]').forEach(function (button) {
        button.addEventListener('click', async function () {
          var original = button.textContent;
          try {
            button.disabled = true; button.textContent = '엑셀 생성 중...';
            var payload = await excelPost('/document-snapshot-exports', {});
            var documents = [];
            var exportPage = 1;
            var hasMore = true;
            while (hasMore) {
              button.textContent = '엑셀 자료 ' + exportPage + '쪽 받는 중...';
              var response = await fetch('/document-snapshot-exports/' + encodeURIComponent(payload.exportManifestId) + '/rows?page=' + exportPage, { headers: { Accept: 'application/json' } });
              var pagePayload = await response.json();
              if (!response.ok || !pagePayload.ok) throw new Error(pagePayload.message || '현재 대장 page를 불러올 수 없습니다.');
              documents = documents.concat(pagePayload.documents || []);
              hasMore = !!pagePayload.hasMore;
              exportPage += 1;
            }
            var finalized = await excelPost('/document-snapshot-exports/' + encodeURIComponent(payload.exportManifestId) + '/finalize', {});
            payload.canonicalExportHash = finalized.canonicalExportHash;
            payload.documents = documents;
            await buildExcelSnapshot(payload);
          } catch (error) {
            if (window.showAppMessage) window.showAppMessage(error.message, true);
          } finally {
            button.disabled = false; button.textContent = original;
          }
        });
      });

});
