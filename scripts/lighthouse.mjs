/**
 * Auditoria Lighthouse reprodutível.
 *
 * - Serve o build otimizado (`dist/`) com `vite preview` — mocks ativos, cenário padrão.
 * - Audita Início e Detalhe do NFT, perfis mobile e desktop, 3 medições cada.
 * - Salva relatórios HTML/JSON por execução e um resumo com a MEDIANA de cada
 *   categoria + LCP, CLS e TBT em lighthouse/summary.{md,json}.
 *
 * Uso: npm run lighthouse   (faz o build antes)
 * Variáveis: LH_RUNS (padrão 3), CHROME_PATH (padrão: Chromium do Playwright)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, release, totalmem, type as osType } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { preview } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "lighthouse");
const reportsDir = join(outDir, "reports");
mkdirSync(reportsDir, { recursive: true });

const RUNS = Number(process.env.LH_RUNS ?? 3);
const PORT = 4173;
const PAGES = [
  { name: "inicio", path: "/" },
  { name: "detalhe", path: "/nft/emerald-ape-042" },
];
const PROFILES = [
  { name: "mobile", config: undefined }, // padrão do Lighthouse: Moto G Power, 4G lento, CPU 4×
  { name: "desktop", config: desktopConfig },
];
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const server = await preview({
  root,
  preview: { port: PORT, strictPort: true },
  logLevel: "warn",
});
const chromePath = process.env.CHROME_PATH ?? chromium.executablePath();
const chrome = await chromeLauncher.launch({
  chromePath,
  chromeFlags: ["--headless=new", "--no-sandbox"],
});

const results = [];
try {
  for (const page of PAGES) {
    for (const profile of PROFILES) {
      const runs = [];
      for (let i = 1; i <= RUNS; i++) {
        const url = `http://localhost:${PORT}${page.path}`;
        const result = await lighthouse(
          url,
          {
            port: chrome.port,
            output: ["html", "json"],
            logLevel: "error",
            onlyCategories: CATEGORIES,
          },
          profile.config,
        );
        const [html, json] = result.report;
        const base = `${page.name}-${profile.name}-${i}`;
        writeFileSync(join(reportsDir, `${base}.html`), html);
        writeFileSync(join(reportsDir, `${base}.json`), json);
        const lhr = result.lhr;
        const run = {
          scores: Object.fromEntries(
            CATEGORIES.map((c) => [
              c,
              Math.round((lhr.categories[c]?.score ?? 0) * 100),
            ]),
          ),
          lcp: lhr.audits["largest-contentful-paint"].numericValue,
          cls: lhr.audits["cumulative-layout-shift"].numericValue,
          tbt: lhr.audits["total-blocking-time"].numericValue,
        };
        runs.push(run);
        console.log(
          `${base}: ${JSON.stringify(run.scores)} LCP=${Math.round(run.lcp)}ms CLS=${run.cls.toFixed(3)} TBT=${Math.round(run.tbt)}ms`,
        );
      }
      results.push({
        page: page.name,
        profile: profile.name,
        median: {
          ...Object.fromEntries(
            CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))]),
          ),
          lcpMs: Math.round(median(runs.map((r) => r.lcp))),
          cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
          tbtMs: Math.round(median(runs.map((r) => r.tbt))),
        },
        runs,
      });
    }
  }
} finally {
  await chrome.kill();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

const pkg = (name) =>
  JSON.parse(
    readFileSync(join(root, "node_modules", name, "package.json"), "utf8"),
  ).version;
const environment = {
  date: new Date().toISOString(),
  lighthouse: pkg("lighthouse"),
  chromium: chromePath,
  playwright: pkg("@playwright/test"),
  vite: pkg("vite"),
  node: process.version,
  os: `${osType()} ${release()}`,
  cpu: `${cpus()[0]?.model} (${cpus().length} threads)`,
  memoryGb: Math.round(totalmem() / 1024 ** 3),
  runsPerPageAndProfile: RUNS,
  server: "vite preview (build de produção, mocks MSW ativos, cenário padrão)",
};
writeFileSync(
  join(outDir, "summary.json"),
  JSON.stringify({ environment, results }, null, 2),
);

const target = {
  performance: 90,
  accessibility: 95,
  "best-practices": 95,
  seo: 90,
};
const mark = (c, v) => (v >= target[c] ? `${v} ✅` : `${v} ⚠️`);
const lines = [
  "# Lighthouse — medianas",
  "",
  `Gerado em ${environment.date} · Lighthouse ${environment.lighthouse} · Node ${environment.node} · ${environment.os}`,
  "",
  "| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...results.map(
    (r) =>
      `| ${r.page} | ${r.profile} | ${mark("performance", r.median.performance)} | ${mark("accessibility", r.median.accessibility)} | ${mark("best-practices", r.median["best-practices"])} | ${mark("seo", r.median.seo)} | ${r.median.lcpMs} ms | ${r.median.cls} | ${r.median.tbtMs} ms |`,
  ),
  "",
  "## Ambiente",
  "",
  ...Object.entries(environment).map(([k, v]) => `- **${k}**: ${v}`),
  "",
];
writeFileSync(join(outDir, "summary.md"), lines.join("\n"));
console.log(`\nResumo salvo em ${join(outDir, "summary.md")}`);
