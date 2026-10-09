# Remote snapshot — 2026-10-09

Production alias: https://interal.vercel.app; deployment dpl_Era2Mu6evrdJF1zXwa68jZPFJGqx; branch main; SHA b266c92f00d111c1df53da05221fefac0db1dc3a. Vercel connector reports READY and target production. Live byte comparisons are in LIVE-ASSETS.txt.

PR #652: {"number":652,"state":"closed","merged":true,"head":"1c04d9ae48d079b56b6c37f854f96280b1915a10","base":"fix/associative-component-membership-20261001"}. This does not imply v6 is the production data source; candidate-index-loader.js still points to family-index-v5.

Open PR snapshot (REST, all results in one page):

```json
+[
  {
    "number": 651,
    "title": "Review associative national families and materialize action with preserved source evidence",
    "head": "fix/associative-component-membership-20261001",
    "headSHA": "9fff76431a86a06df6db69b64d7f2ca4c871f1b7",
    "base": "fix/associative-information-20260930"
  },
  {
    "number": 650,
    "title": "Consolidate information family and remove suffix contamination",
    "head": "fix/associative-information-20260930",
    "headSHA": "3da2717f7de702f68cf465c7434e15ff7abd2d50",
    "base": "main"
  },
  {
    "number": 542,
    "title": "Limit Qwen review requests per calculation run",
    "head": "codex/fix-review-request-configuration-in-associativvordes",
    "headSHA": "30a19cd5044574987a0d9efe26355c57ddc43b9d",
    "base": "main"
  },
  {
    "number": 511,
    "title": "Publish corrected static associative search index",
    "head": "publish/associative-search-index-29658420330",
    "headSHA": "a84525f5ee90063bd041b5a88426ded3ae660e9c",
    "base": "main"
  },
  {
    "number": 508,
    "title": "Prepare corrected static associative search publication",
    "head": "fix/static-associative-search-correctness",
    "headSHA": "229c6173ea1fb2d14df72030f84cc69b8a3d3f3f",
    "base": "main"
  },
  {
    "number": 447,
    "title": "Normalize PI handling and add shared card-schema utilities",
    "head": "codex/fix-card-schema-validation-and-handling",
    "headSHA": "95537e4dbe23ad3411efb7a0282375182a96dbb9",
    "base": "main"
  },
  {
    "number": 419,
    "title": "Fix Interal card generation and Qwen/validation flows",
    "head": "codex/fix-functional-errors-in-interal-site",
    "headSHA": "67a3216460515120d1c16f11db17d3dcff79ad4e",
    "base": "main"
  },
  {
    "number": 358,
    "title": "Add Affixes tool card to homepage",
    "head": "codex/-affixes",
    "headSHA": "d8faabfc33862c355000426e38d71dc9e6de5702",
    "base": "main"
  },
  {
    "number": 316,
    "title": "Add explicit page state autosave via InteralPageState",
    "head": "codex/implement-explicit-localstorage-autosave-system",
    "headSHA": "48058abb8b13867e2e40a3368f3b399c283eb7c5",
    "base": "main"
  },
  {
    "number": 253,
    "title": "Update page action icons (download, magnifier, determinator add)",
    "head": "codex/replace-plus-in-determinator-of-valen-typ",
    "headSHA": "f830da92d9bf5dfc00ba7496c3f3b27de82c76e8",
    "base": "main"
  },
  {
    "number": 252,
    "title": "Update UI icons: add JSON download button, magnifier in registry, replace plus icon",
    "head": "codex/-json",
    "headSHA": "bc12e065db4c74776d033e0c7415a9e7db038c5e",
    "base": "main"
  },
  {
    "number": 251,
    "title": "Update action icons across tools",
    "head": "codex/download-json-card-and-replace-icons",
    "headSHA": "68c6aaab97cd9c5a67bca06524521ca2f879aced",
    "base": "main"
  },
  {
    "number": 247,
    "title": "Fix determinator result rendering",
    "head": "codex/update-renderresult-and-css-styles",
    "headSHA": "03aba17f1b628b14acc6cb9e11d949be90c8e155",
    "base": "main"
  },
  {
    "number": 236,
    "title": "Add Giscus discussions to registre cards",
    "head": "codex/add-giscus-modal-to-registre-card",
    "headSHA": "ea5a392aaf0de2c4607a8a4c910e944573e5968d",
    "base": "main"
  },
  {
    "number": 61,
    "title": "Restore full-width mobile language buttons in side menu",
    "head": "codex-d89v87",
    "headSHA": "087ca7fe4708d88b115f2026d5913e758be8e9ca",
    "base": "main"
  }
]
```

Full remote branch heads are recorded in REMOTE-BRANCHES.txt. The connector branch search first page is incomplete and is not used as a complete inventory. Local checkout was clean before the audit. No AGENTS.md was found in the cloned tree; no PR template was found. .github/workflows/tests.yml runs checks on pull requests and does not prohibit a documentation-only PR. Existing PRs are not modified.
