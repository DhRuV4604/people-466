/**
 * Renders the Markdown in docs/ (and README.md) to print-ready PDFs.
 *
 * Kept out of the project's dependency tree on purpose: `marked` is resolved
 * from wherever it happens to be installed (see resolveMarked below) and the
 * print step drives the Chrome already on this machine rather than pulling in
 * Puppeteer, which would add ~300MB to a repo that does not otherwise need it.
 *
 *   node scripts/docs-to-pdf.mjs            # all docs
 *   node scripts/docs-to-pdf.mjs api.md     # just one
 *
 * PDFs land in docs/pdf/. The .md files are never modified.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = join(root, 'docs');
const outDir = join(docsDir, 'pdf');
const tmpDir = join(root, '.docs-pdf-tmp');

/**
 * Find `marked`, installing it into a scratch directory if it is not already
 * somewhere resolvable. Spawning `npx` is not an option: Node refuses to spawn
 * a `.cmd` shim without a shell, so on Windows that fails with EINVAL.
 */
function resolveMarked() {
  const scratch = join(tmpdir(), 'peoplepay360-docs-pdf');
  const scratchEntry = `file:///${join(scratch, 'x.js').replace(/\\/g, '/')}`;

  const load = () => {
    for (const from of [import.meta.url, scratchEntry]) {
      try {
        return createRequire(from)('marked').marked;
      } catch {
        /* try the next location */
      }
    }
    return null;
  };

  const found = load();
  if (found) return found;

  // npm ships beside the node binary; requiring it by name does not resolve
  // from here, and spawning the `npm.cmd` shim would fail with EINVAL because
  // Node will not spawn a .cmd without a shell.
  const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (!existsSync(npmCli)) {
    throw new Error(`marked is not installed and npm was not found at ${npmCli}`);
  }

  console.log('  ...  installing marked (one time, outside this repo)');
  mkdirSync(scratch, { recursive: true });
  if (!existsSync(join(scratch, 'package.json'))) {
    writeFileSync(join(scratch, 'package.json'), '{"name":"docs-pdf","private":true}');
  }
  execFileSync(
    process.execPath,
    [npmCli, 'install', 'marked@15', '--no-audit', '--no-fund', '--loglevel', 'error'],
    { cwd: scratch, stdio: 'pipe' }
  );

  const installed = load();
  if (!installed) throw new Error('marked was installed but still could not be loaded');
  return installed;
}

const marked = resolveMarked();

/** Chrome, wherever this machine keeps it. */
function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      'No Chrome or Edge found. Set CHROME_PATH to the browser executable and re-run.'
    );
  }
  return found;
}

/**
 * Print stylesheet. The priorities are a readable body size, tables that do not
 * spill off the page, and code blocks that wrap rather than clip — a payroll
 * formula running past the page edge would be worse than useless.
 */
const CSS = `
  @page { size: A4; margin: 18mm 16mm; }

  * { box-sizing: border-box; }

  body {
    font: 10.5pt/1.6 "Segoe UI", -apple-system, system-ui, sans-serif;
    color: #1a1a1a;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1, h2, h3, h4 { line-height: 1.25; font-weight: 650; margin: 1.5em 0 .6em; }
  h1 {
    font-size: 21pt;
    margin-top: 0;
    padding-bottom: .35em;
    border-bottom: 2.5px solid #2563eb;
    color: #14306e;
  }
  /*
   * H2s deliberately do NOT force a page break. Forcing one leaves a large
   * blank gap whenever a section ends early, which wastes pages and reads as a
   * rendering fault. The extra top margin is enough to separate sections.
   */
  h2 {
    font-size: 15pt;
    color: #14306e;
    padding-bottom: .25em;
    border-bottom: 1px solid #d8dee9;
    margin-top: 2em;
  }
  h3 { font-size: 12pt; color: #1e40af; }
  h4 { font-size: 10.5pt; color: #334155; }

  /* A heading stranded at the foot of a page reads as a mistake. */
  h1, h2, h3, h4 { break-after: avoid; break-inside: avoid; }
  p, li { orphans: 3; widows: 3; }

  a { color: #1d4ed8; text-decoration: none; }

  code {
    font: .875em/1.5 "Cascadia Code", Consolas, monospace;
    background: #f1f5f9;
    padding: .12em .38em;
    border-radius: 3px;
    color: #b91c1c;
  }

  pre {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3px solid #2563eb;
    border-radius: 4px;
    padding: .8em 1em;
    /* Diagrams and formulas must wrap, never clip. */
    white-space: pre-wrap;
    word-wrap: break-word;
    break-inside: avoid;
    font-size: 8.5pt;
    line-height: 1.45;
  }
  pre code { background: none; padding: 0; color: #0f172a; font-size: inherit; }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 9pt;
    break-inside: auto;
  }
  /* Repeat the header when a long table crosses a page. */
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td {
    border: 1px solid #dbe2ea;
    padding: .45em .6em;
    text-align: left;
    vertical-align: top;
  }
  th { background: #eef2f7; font-weight: 650; color: #14306e; }
  tr:nth-child(even) td { background: #fafbfc; }
  td code { font-size: .84em; }

  blockquote {
    margin: 1em 0;
    padding: .6em 1em;
    border-left: 3px solid #93b4f7;
    background: #f5f8ff;
    color: #33415a;
  }
  blockquote p { margin: .3em 0; }

  ul, ol { padding-left: 1.5em; }
  li { margin: .25em 0; }

  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 1.8em 0; }

  img { max-width: 100%; }
`;

function toHtml(markdown, title) {
  const body = marked(markdown, { gfm: true, breaks: false });

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${title}</title>
<style>${CSS}</style>
</head><body>${body}</body></html>`;
}

function main() {
  const chrome = findChrome();
  const requested = process.argv.slice(2);

  const files = (
    requested.length > 0
      ? requested.map((f) => (f.includes('/') || f.includes('\\') ? f : join('docs', f)))
      : [
          'README.md',
          ...readdirSync(docsDir)
            .filter((f) => f.endsWith('.md'))
            .sort()
            .map((f) => join('docs', f)),
        ]
  ).map((f) => resolve(root, f));

  mkdirSync(outDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  let failed = 0;

  for (const file of files) {
    const name = basename(file, '.md');
    if (!existsSync(file)) {
      console.error(`  SKIP  ${name} — no such file`);
      failed++;
      continue;
    }

    const html = join(tmpDir, `${name}.html`);
    const pdf = join(outDir, `${name}.pdf`);

    try {
      writeFileSync(html, toHtml(readFileSync(file, 'utf8'), name), 'utf8');

      execFileSync(
        chrome,
        [
          '--headless',
          '--disable-gpu',
          '--no-sandbox',
          '--no-pdf-header-footer',
          `--print-to-pdf=${pdf}`,
          // Chrome will not read a plain path here on Windows.
          `file:///${html.replace(/\\/g, '/')}`,
        ],
        { stdio: 'pipe', timeout: 120_000 }
      );

      if (!existsSync(pdf)) throw new Error('Chrome produced no file');
      console.log(`  OK    ${name}.pdf`);
    } catch (err) {
      console.error(`  FAIL  ${name} — ${err.message.split('\n')[0]}`);
      failed++;
    }
  }

  rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n${files.length - failed}/${files.length} written to docs/pdf/`);
  if (failed > 0) process.exitCode = 1;
}

main();
