import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, writeFile, realpath } from "node:fs/promises";
import { basename, extname, relative, resolve, sep, isAbsolute, dirname } from "node:path";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const outputIndex = args.indexOf("--output");
const sourceRoot = resolve(rootIndex >= 0 ? args[rootIndex + 1] : resolve(projectRoot, "DataForV5"));
const outputRoot = resolve(outputIndex >= 0 ? args[outputIndex + 1] : resolve(projectRoot, ".ztothez-design-runtime/v7-corpus-audit"));

function assertContained(root, candidate, label) {
  const relation = relative(root, candidate);
  if (isAbsolute(relation) || relation === ".." || relation.startsWith(`..${sep}`)) throw new Error(`${label} escapes the configured root`);
}

assertContained(resolve(projectRoot, '.ztothez-design-runtime'), outputRoot, 'Private audit output');
let existingParent = outputRoot;
while (true) {
  try {
    if (await realpath(existingParent) !== existingParent) throw new Error('Audit output traverses a symlink');
    break;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    existingParent = dirname(existingParent);
  }
}

function dispositionFor(path) {
  const lower = path.toLowerCase();
  if (/(^|\/)(node_modules|\.git|dist|build|coverage|cache|tmp)(\/|$)/.test(lower)) {
    return { category: "generated-or-dependency", disposition: "exclude", reason: "Generated or dependency content is not a research source." };
  }
  if (lower.includes("usabilityuix") || lower.includes("figma") || /(^|\/)(pdfs)(\/|$)/.test(lower) || /(^|\/)(sda|styles)/i.test(basename(path))) {
    return { category: "uiux-and-design", disposition: "candidate-extraction", reason: "Potential design-engineering input; requires independent authored transformation." };
  }
  if (lower.includes("hacking") || lower.includes("pentest") || lower.includes("security") || lower.includes("cyber")) {
    return { category: "security-engineering", disposition: "separate-domain", reason: "Security material must not silently become UI/UX authority." };
  }
  if (lower.includes("vibecoding")) {
    return { category: "ai-engineering", disposition: "candidate-extraction", reason: "Potential engineering-quality input; requires independent authored transformation." };
  }
  if (lower.includes("training") || lower.includes("coding")) {
    return { category: "product-engineering", disposition: "candidate-extraction", reason: "Potential architecture or delivery input; requires independent authored transformation." };
  }
  if (lower.includes("learning")) {
    return { category: "background-learning", disposition: "background-only", reason: "Broad learning material is not automatically relevant to design engineering." };
  }
  return { category: "unclassified", disposition: "review", reason: "No safe extraction category can be inferred from metadata." };
}

async function walk(directory, root, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      files.push({ path: relative(root, absolute).split(sep).join("/"), type: "symlink", disposition: "exclude", category: "unsafe-link", reason: "Symlinks are excluded from corpus authority." });
    } else if (entry.isDirectory()) {
      await walk(absolute, root, files);
    } else if (entry.isFile()) {
      files.push({ path: relative(root, absolute).split(sep).join("/"), absolute });
    }
  }
  return files;
}

async function fingerprint(path) {
  const hash = createHash("sha256");
  const stream = await createReadStream(path);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

// Stream large files so the audit never loads the corpus into memory.
async function createReadStream(path) {
  const { createReadStream: stream } = await import("node:fs");
  return stream(path);
}

assertContained(await realpath(resolve(projectRoot, 'DataForV5')), await realpath(sourceRoot), "Corpus root");
const entries = await walk(sourceRoot, sourceRoot);
const records = [];
for (const entry of entries) {
  if (entry.type === "symlink") { records.push(entry); continue; }
  const stats = await lstat(entry.absolute);
  const path = entry.path;
  const classification = dispositionFor(path);
  records.push({
    path,
    extension: extname(path).toLowerCase() || "[none]",
    bytes: stats.size,
    sha256: await fingerprint(entry.absolute),
    ...classification,
    sourceTextCaptured: false,
    classificationBasis: "metadata-only",
    intendedUse: classification.disposition === 'exclude' ? 'none' : 'private-learning-review-only',
    licenseStatus: "unverified",
    provenanceStatus: "private-input-not-admitted",
    extractionStatus: "not-extracted",
    publicAdmissionDecision: "withheld",
    admissionReason: "Source identity, permission, content suitability, and independent transformation require separate review.",
  });
}
records.sort((left, right) => left.path.localeCompare(right.path));
const duplicateGroups = new Map();
for (const record of records) {
  if (!record.sha256) continue;
  const group = duplicateGroups.get(record.sha256) ?? [];
  group.push(record.path);
  duplicateGroups.set(record.sha256, group);
}
const duplicates = [...duplicateGroups.entries()]
  .filter(([, paths]) => paths.length > 1)
  .map(([sha256, paths]) => ({ sha256, paths }));
const byDisposition = Object.fromEntries([...new Set(records.map((record) => record.disposition))].sort().map((key) => [key, records.filter((record) => record.disposition === key).length]));
const report = {
  version: "1.0",
  auditId: "v7-private-corpus-disposition",
  sourceRoot: "DataForV5",
  generatedAt: new Date().toISOString(),
  sourceTextCaptured: false,
  publicAdmission: false,
  runtimeUse: false,
  records,
  duplicateGroups: duplicates,
  summary: { files: records.length, bytes: records.reduce((sum, record) => sum + (record.bytes ?? 0), 0), byDisposition },
};
await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, "corpus-disposition.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
const markdown = [
  "# V7 Private Corpus Audit",
  "",
  `- Files: ${report.summary.files}`,
  `- Bytes: ${report.summary.bytes}`,
  `- Duplicate groups: ${duplicates.length}`,
  `- Source text captured: no`,
  `- Public admission: no`,
  "",
  "## Dispositions",
  "",
  ...Object.entries(byDisposition).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "This report is private metadata only. It does not authorize extraction, licensing, publication, or runtime use of any source.",
].join("\n");
await writeFile(resolve(outputRoot, "corpus-disposition.md"), `${markdown}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ status: "metadata-audited", output: relative(projectRoot, outputRoot).split(sep).join("/"), ...report.summary, duplicateGroups: duplicates.length }, null, 2)}\n`);
