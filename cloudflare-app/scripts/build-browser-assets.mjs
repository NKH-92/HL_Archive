import { mkdir, readFile, writeFile } from "node:fs/promises";
import { clientScript } from "../src/views/clientScript.js";
import { excelSnapshotScript } from "../src/views/clientScript/excelSnapshots.js";
import { styles } from "../src/views/styles.js";

const sourceUrl = new URL("../src/searchCore.js", import.meta.url);
const outputUrl = new URL("../public/assets/search-core.js", import.meta.url);
const source = (await readFile(sourceUrl, "utf8")).replaceAll("\r\n", "\n");
const generated = `// generated from src/searchCore.js; do not edit\n${source}`;
const stripTrailingWhitespace = (value) => value.replaceAll("\r\n", "\n").replace(/[ \t]+$/gm, "");
const resultMarkup = (await readFile(new URL("../src/views/searchResultMarkup.js", import.meta.url), "utf8")).replace(/^export /gm, "");
const sharedResults = `(() => {\n${resultMarkup}\nwindow.HanlimResults = { resultRow, resultTable };\n})();\n`;
const appScript = `// generated from src/views/clientScript.js; do not edit\n${stripTrailingWhitespace(sharedResults + clientScript())}\n`;
const excelAppScript = `// generated from src/views/clientScript/excelSnapshots.js; do not edit\ndocument.addEventListener('DOMContentLoaded', function () {${stripTrailingWhitespace(excelSnapshotScript())}\n});\n`;
const appStyles = `/* generated from src/views/styles.js; do not edit */\n${stripTrailingWhitespace(styles())}\n`;
const appScriptUrl = new URL("../public/assets/app.js", import.meta.url);
const excelAppScriptUrl = new URL("../public/assets/excel-app.js", import.meta.url);
const appStylesUrl = new URL("../public/assets/app.css", import.meta.url);
const excelSourceUrl = new URL("../node_modules/exceljs/dist/exceljs.min.js", import.meta.url);
const excelAssetUrl = new URL("../public/assets/exceljs.min.js", import.meta.url);
const excelAsset = await readFile(excelSourceUrl, "utf8");
const zipSourceUrl = new URL("../node_modules/jszip/dist/jszip.min.js", import.meta.url);
const zipAssetUrl = new URL("../public/assets/jszip.min.js", import.meta.url);
const zipAsset = await readFile(zipSourceUrl, "utf8");

if (process.argv.includes("--check")) {
  const [current, currentScript, currentExcelApp, currentStyles, currentExcel, currentZip] = await Promise.all([
    readFile(outputUrl, "utf8").catch(() => ""),
    readFile(appScriptUrl, "utf8").catch(() => ""),
    readFile(excelAppScriptUrl, "utf8").catch(() => ""),
    readFile(appStylesUrl, "utf8").catch(() => ""),
    readFile(excelAssetUrl, "utf8").catch(() => ""),
    readFile(zipAssetUrl, "utf8").catch(() => "")
  ]);
  if (current.replaceAll("\r\n", "\n") !== generated ||
      currentScript.replaceAll("\r\n", "\n") !== appScript ||
      currentExcelApp.replaceAll("\r\n", "\n") !== excelAppScript ||
      currentStyles.replaceAll("\r\n", "\n") !== appStyles ||
      currentExcel !== excelAsset ||
      currentZip !== zipAsset) {
    console.error("browser 정적 asset이 source와 다릅니다. npm run build:browser를 실행하세요.");
    process.exitCode = 1;
  } else {
    console.log("✓ browser search/CSS/JS asset 일치");
  }
} else {
  await mkdir(new URL("../public/assets/", import.meta.url), { recursive: true });
  await writeFile(outputUrl, generated, "utf8");
  await writeFile(appScriptUrl, appScript, "utf8");
  await writeFile(excelAppScriptUrl, excelAppScript, "utf8");
  await writeFile(appStylesUrl, appStyles, "utf8");
  await writeFile(excelAssetUrl, excelAsset, "utf8");
  await writeFile(zipAssetUrl, zipAsset, "utf8");
  console.log("✓ browser search/CSS/JS asset 생성");
}
