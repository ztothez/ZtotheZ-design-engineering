# ZtotheZ Design Engineering

[![Quality](https://img.shields.io/badge/quality-v3.1.0-blue)](#) [![npm](https://img.shields.io/npm/v/@ztothez/design-engineering)](#) [![GitHub](https://github.com/ztothez/ztothez-design-engineering)](#)

ZtotheZ Design Engineering is a local-first MCP server and deterministic quality gate for building production UI and UX systems. It combines governance, product semantics, software architecture, usability evaluation, browser verification, and evidence-backed acceptance criteria.

This project focuses on design engineering instead of style recommendation. It checks whether an interface supports real tasks, exposes coherent states, uses maintainable component boundaries, remains accessible, and produces verifiable evidence.

**Version 3.1.0 delivers the V7 Structured Decision Library**: 18 typed `ZTDE-LIB-*` decision rules with per-rule SHA-256 provenance, ranked retrieval (`search_decision_rules`), deterministic scoped evaluation (`evaluate_decision`), product-fidelity verification (`verify-product-fidelity`), and full pilot & private-holdout qualification.

## Current Capabilities

**Core Governance**
- Explicit knowledge admission manifest with file-level tracking and SHA-256 digests
- Public-knowledge boundary definition (scope separation between internal and distributable assets)
- Public-knowledge inventory with full filing, aliases, and retrieval scope
- Deterministic rule registry compiled from governance, design-intelligence, and architecture sources
- Authority compilation with traceable derivation and versioned decision library
- Shadow evaluation: qualification of V6 behavior against V5 authority without cutover

**Product Design**
- Versioned product design briefs that block generation when users, tasks, data behavior, recovery, assumptions, or acceptance evidence are materially undefined
- Versioned design-deliverable manifests with deterministic visual direction, semantic token, typography, composition, density, state, motion, chart, rendered-evidence, contrast, provenance, icon, and presentation validation
- Versioned interface-trust contracts for data mode, connection, result origin, freshness, fallback disclosure, and provenance-preserving records
- Versioned operational information-design contracts for decision metrics, evidence-backed findings, chart purpose, hierarchy, exceptional states, and scalable collections

**Architecture & Audit**
- Repository architecture audits for coupling, component size, raw design values, mock production paths, network states, accessible names, and placeholder interactions
- Bounded nine-stage interface workflow linking product task, truthful state, information hierarchy, interaction states, visual direction, semantic tokens, implementation, automated evidence, and attributable human review
- Structured heuristic reviews with evidence provenance and severity-based acceptance candidates
- Source-removal qualification: verification that obsolete dependencies and research materials are absent from package and public distribution

**Browser Verification**
- Browser verification for responsive layout, clipping, overlap, focus, contrast, target sizing, keyboard behavior, text resizing, reflow, reduced motion, media, console errors, and network failures
- Opt-in browser contracts for persistent data-mode disclosure, trust-stage and fixture-state coverage, chart names and alternatives, masked dynamic regions, and checksum-based screenshot regression detection
- Product contracts with declarative task journeys and acceptance criteria
- Interaction and recovery contracts for task completion, state preservation, keyboard navigation, and offline fallback behavior

**Benchmarking & Evaluation**
- Executable AegisOPS, SceneStart, and Azure Optimizer benchmark contracts and delivery pilots
- Versioned positive and negative corpus benchmarks with provenance, per-dimension scoring, recommendation MRR, and explicit abstention checks
- Knowledge-quality evaluation: deterministic scoring of retrieval index coverage, accuracy, and framework alignment
- Holdout evaluation: independent assessment of qualified capabilities against unseen test cases

**Delivery & Distribution**
- Consolidated quality gates and multi-profile release decisions
- Exact provenance and dependency inventories with active-reference isolation checks
- Self-contained offline runtime with approved knowledge, a serialized retrieval index, production dependencies, and SHA-256 integrity evidence
- GitHub Actions verification with retained fixture evidence
- Local-only portfolio registry and disposable snapshot boundary for non-destructive cross-product benchmarking
- Deterministic packaging with explicit file allowlists and archive-removal verification

**Knowledge Retrieval**
- Ranked BM25 knowledge retrieval with source paths, excerpts, and confidence scores
- Exact filename reads from approved knowledge base
- Versioned retrieval scope containing only explicitly approved distributable files (excludes local research and legacy archives)
- MCP search tool with category filtering and deterministic result ordering

## What's New in V3.1.0 (V7 Decision Library)

- **Structured Decision Library (`model/decision-library.json`)**: 18 independently authored `ZTDE-LIB-*` rules covering accessibility, responsive reflow, state recovery, semantic tokens, heading hierarchy, truthful disclosure, and maintainability — each with measurable thresholds, counterexamples, verification methods, and SHA-256 provenance fingerprints.
- **New MCP Tools**: `search_decision_rules` (deterministic ranked rule retrieval with explicit no-match abstention) and `evaluate_decision` (conflict-aware decision evaluation with declared evidence scope).
- **New CLI Commands**: `zz-design query-library`, `zz-design qualify-decisions`, and `zz-design verify-product-fidelity`.
- **Product-Fidelity Verification**: Distinct product-shell contracts and automated multi-width checks (`375px`, `768px`, `1440px`) for AegisOPS, SceneStart, and Azure Optimizer, backed by owner visual review.
- **Full V7 Qualification**: 13/13 pilot profiles, 18/18 decision rules qualified across all 3 pilots and all 3 private holdout projects, zero-drift provenance, and **247/247** root tests passing.

## What's New in V3.0.0

- **Governance Model**: Complete restructure of authority from versioned documents to compiled JSON with provenance tracking
- **Shadow Evaluation**: V6 qualifications performed against V5 authority; no cutover without separate approval
- **Knowledge Admission**: Explicit manifest of what enters the system, with SHA-256 digests and filing metadata
- **Boundary Definition**: Clear separation between knowledge admitted for analysis vs. knowledge safe for distribution
- **Inventory Tracking**: Complete public-knowledge inventory with aliases, categories, and retrieval index mapping
- **Rule Registry**: Unified rule compilation from all sources with version tracking and policy precedence
- **Authority Compilation**: Deterministic compiler that derives authority from admission, boundary, inventory, and rules
- **Provenance Tracking**: All major outputs now record source files and digests
- **Migration Qualification**: Formal V5-to-V6 migration report with 204/204 tests passing, all gates verified, evidence cleaned and curated

## Requirements

- Node.js 22 or newer
- npm
- Chromium for browser verification
- Linux, macOS, or Windows with a Chromium executable supported by Playwright

## Quick Start

Install the verified public release:

```bash
npm install -g @ztothez/design-engineering@3.1.0
zz-design --version
```

The matching package archive, checksums, offline manifest, and retrieval index are attached to the v3.1.0 GitHub Release.

Build and test from source:

```bash
git clone https://github.com/ztothez/ztothez-design-engineering.git
cd ztothez-design-engineering
npm ci
npx --no-install playwright-core install chromium
npm run build
npm test
```

Build, install, and verify the distributable package:

```bash
npm run package:smoke
npm run release:pack
npm run release:check
npm install -g ./.ztothez-design-release/ztothez-design-engineering-3.1.0.tgz
zz-design --version
```

See `docs/installation.md` for source and package installation plus exact setup for Codex, Claude Code, Cursor, Windsurf, Antigravity, GitHub Copilot, Kiro, Qoder, and Lovable.

Start the stdio MCP server:

```bash
npm start
```

The server writes diagnostics to standard error. Standard output remains reserved for MCP JSON-RPC messages.

## MCP Configuration

Build the project first, then register the compiled entrypoint as a stdio MCP server. Use absolute paths in agent configuration files.

```json
{
  "mcpServers": {
    "ztothez-design-engineering": {
      "command": "node",
      "args": [
        "/absolute/path/to/ztothez-design-engineering/dist/cli/index.js"
      ],
      "env": {
        "ZTOTHEZ_DESIGN_ENGINEERING_ROOT": "/absolute/path/to/ztothez-design-engineering"
      }
    }
  }
}
```

Use the equivalent stdio MCP fields in Claude Code, Cursor, Windsurf, Antigravity, GitHub Copilot, Kiro, Codex, Qoder, or another MCP-capable environment. Lovable Desktop can register the same executable as a custom local MCP server.

The package declares two equivalent MCP executable names:
- `ztothez-design`
- `zz-design`

The release archive is checked against an explicit distribution allowlist and installed into an empty temporary project during `npm run package:smoke`. Raw research and historical sources are not included. `npm run release:check` verifies the offline runtime, checksums, approved retrieval index, and launch path without using the repository's installed packages.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `search_design_knowledge` | Search approved knowledge with deterministic BM25 ranking, source paths, excerpts, confidence, and explicit no-match output. |
| `evaluate_corpus_benchmark` | Score maintained positive and negative cases for retrieval, abstention, architecture, task completeness, and anti-slop behavior. |
| `get_architecture_spec` | List or read approved architecture guidance. |
| `get_figma_system_rules` | List or read Figma and design-system guidance. |
| `get_design_intelligence` | List or read maintained brand, asset, icon, presentation, licensing, and visual-accessibility modules. |
| `validate_product_design_brief` | Validate evidence-backed product intent, primary audiences, outcomes, tasks, data, states, assumptions, requirements, and generation readiness. |
| `compile_design_plan` | Deterministically compile a valid brief into traceable architecture, contract, token, responsive, asset, stage, and verification decisions. |
| `validate_design_deliverable` | Validate visual polish, semantic tokens, responsive composition, states, motion, charts, evidence readiness, contrast, provenance, icons, and presentations. |
| `validate_interface_trust` | Validate operational claims, source traceability, fallback and stale states, disconnected recovery, and history or export provenance. |
| `validate_information_design` | Validate metrics, findings, chart decisions, value states, large collections, operational hierarchy, and answer-flow tasks. |
| `evaluate_interface_comparison` | Validate anonymous comparison methods, required stages, retained claim evidence, and attributable human or representative-user records. |
| `get_dashboard_pattern` | List or read approved dashboard and UX patterns. |
| `get_usability_evaluation` | List or read usability-evaluation guidance and schemas. |
| `validate_product_contract` | Validate a product archetype, primary tasks, recovery states, narrow paths, sources, journeys, and cross-references. |
| `evaluate_heuristic_review` | Validate a structured review and derive candidates from unresolved severity 3 and 4 findings. |
| `audit_repository_architecture` | Scan a repository against deterministic architecture and anti-slop rules. |
| `verify_ui_runtime` | Run browser checks and capture runtime evidence. |
| `run_design_quality_gate` | Combine contract, audit, runtime, acceptance, and human evidence into one decision. |
| `aggregate_design_quality_gates` | Combine required journey-profile reports into a release decision. |
| `list_portfolio_projects` | List explicitly enabled local benchmark IDs and effective capabilities without source roots. |
| `get_portfolio_benchmark_report` | Read a completed local benchmark summary without starting commands. |

Knowledge tools enforce category boundaries, Markdown-only reads, file-size limits, and path-traversal protection. `SKILL.md` remains authoritative when supporting documents conflict.

Search before opening deep reference files:

```bash
zz-design search-design-knowledge \
  --query "semantic design tokens for operational status states" \
  --categories skill design-intelligence architecture \
  --limit 5
```

The search index is defined by `knowledge-base/retrieval-scope.yaml`. A no-match response is a valid result. Do not replace it with content from ignored research or legacy archives.

## Command Line Workflows

**Governance and Authority**

Validate and compile the governance model:

```bash
npm run compile-authority -- --project-root .
npm run validate-public-content -- --project-root .
```

Evaluate knowledge quality:

```bash
npm run evaluate-knowledge-quality -- \
  --admission governance/knowledge-admission.json \
  --inventory governance/public-knowledge-inventory.json
```

Qualify source removal:

```bash
npm run qualify-source-removal -- --project-root .
```

**Design Validation**

Validate a product design brief before planning generation:

```bash
npm run validate-brief -- \
  --brief knowledge-base/design-intelligence/product-design-brief.template.yaml
```

Compile the validated brief into a deterministic, traceable design plan:

```bash
npm run compile-plan -- \
  --brief knowledge-base/design-intelligence/product-design-brief.template.yaml \
  --project-root . \
  --json
```

Validate a design-intelligence deliverable:

```bash
npm run validate-design -- \
  --manifest knowledge-base/design-intelligence/design-deliverable.template.yaml
```

Validate interface trust and data provenance:

```bash
npm run validate-trust -- \
  --contract knowledge-base/design-intelligence/interface-trust.template.yaml
```

Validate operational information design:

```bash
npm run validate-information -- \
  --contract knowledge-base/design-intelligence/information-design.template.yaml
```

**Quality Gates and Evaluation**

Audit a repository:

```bash
npm run audit -- --repo PATH_TO_APPLICATION --fail-on error
```

Run a complete profile quality gate:

```bash
npm run quality-gate -- \
  --contract knowledge-base/benchmarks/aegisops/product-contract.yaml \
  --repo PATH_TO_APPLICATION \
  --project-root . \
  --url http://127.0.0.1:3000 \
  --profile responsive-overview \
  --output .ztothez-design-quality-gate/responsive-overview \
  --fail-on error
```

Evaluate the maintained system corpus:

```bash
npm run evaluate-corpus
```

Verify a running interface:

```bash
npm run verify-ui -- \
  --url http://127.0.0.1:3000 \
  --journeys knowledge-base/benchmarks/aegisops/journeys.json \
  --profile responsive-overview \
  --output .ztothez-design-runtime/responsive-overview
```

**Portfolio and Benchmarking**

Validate and inventory the local portfolio registry:

```bash
zz-design portfolio validate-registry
zz-design portfolio inventory
```

Create, verify, and delete a disposable snapshot:

```bash
zz-design portfolio snapshot --project scenestart
```

Run a complete isolated baseline:

```bash
zz-design portfolio baseline --project scenestart --run scenestart-baseline
```

**Generation and Repair**

Generate a new independent React and TypeScript fixture from a ready plan:

```bash
mkdir -p .ztothez-design-generated
zz-design generate-react \
  --plan path/to/ready-design-plan.json \
  --generation-root .ztothez-design-generated \
  --output .ztothez-design-generated/example-app \
  --portfolio-registry .ztothez-design-local/portfolio-registry.yaml \
  --json
```

Repair one supported finding in a generated fixture:

```bash
zz-design repair-react \
  --request path/to/repair-request.yaml \
  --generation-root .ztothez-design-generated \
  --target .ztothez-design-generated/example-app \
  --portfolio-registry .ztothez-design-local/portfolio-registry.yaml \
  --contract knowledge-base/benchmarks/aegisops/product-contract.yaml \
  --project-root . \
  --url http://127.0.0.1:4173 \
  --profile responsive-overview \
  --output .ztothez-design-repair/example \
  --fail-on warning
```

Run `npm run COMMAND -- --help` for the complete options supported by each CLI workflow.

## Evidence Model

The system keeps evidence types distinct:

- **Automated evidence** records deterministic source, contract, browser, network, and state checks
- **AI-assisted expert evidence** identifies likely usability risks but does not represent user behavior
- **Human-expert evidence** requires an attributable reviewer
- **Representative-user evidence** records observed task performance with appropriate study context

AI agents must never create human attestations or present generated observations as representative-user evidence. Open severity 3 and 4 heuristic findings become acceptance-criterion candidates that require review before contract integration.

## Knowledge Precedence

Use sources in this order:

1. Current product requirements and repository behavior
2. Root `SKILL.md`
3. The selected benchmark contract and manifest
4. Maintained files in `knowledge-base/`
5. Public standards or official platform documentation when the maintained corpus has a declared gap

Historical research is outside the supported workflow. It is not a runtime dependency, retrieval fallback, implementation authority, or source to copy into production code.

## Repository Layout

| Path | Purpose |
|------|---------|
| `SKILL.md` | Authoritative Agent Skill instructions |
| `src/server.ts` | MCP server and tool registration |
| `src/authority/` | Authority compilation, loading, validation, and schema |
| `src/shadow/` | Shadow evaluation engine and reporting |
| `src/v5-migration/` | V5-to-V6 migration qualification and testing |
| `src/source-removal/` | Source-removal evaluation and verification |
| `src/knowledge-quality/` | Knowledge quality scoring and reporting |
| `src/public-content/` | Public-content policy validation |
| `src/audit/` | Static repository audit engine |
| `src/runtime/` | Browser verification and evidence capture |
| `src/contracts/` | Product-contract and journey validation |
| `src/heuristics/` | Structured heuristic-review evaluation |
| `src/design-intelligence/` | Design-deliverable schema, provenance, token, contrast, icon, and presentation validation |
| `src/interface-trust/` | Interface-state truth, claim-source traceability, and history or export provenance validation |
| `src/information-design/` | Operational metric, finding, chart, hierarchy, collection, and answer-flow validation |
| `src/product-brief/` | Evidence-backed product intake and generation-readiness validation |
| `src/comparison/` | Anonymous comparison, claim-ledger, evidence-integrity, and release-readiness validation |
| `src/corpus/` | Versioned corpus loading, deterministic case evaluation, scoring, and reporting |
| `src/retrieval/` | Approved-scope Markdown indexing and deterministic BM25 search |
| `src/quality-gate/` | Consolidated profile quality gate |
| `src/repair/` | Finding-bound generated-fixture repair, rollback, and before/after evidence |
| `src/aggregate/` | Multi-profile release aggregation |
| `governance/` | Knowledge admission, boundary, inventory, and rule-registry manifests with schemas |
| `model/` | Compiled authority and design-engineering model with schemas |
| `cli/` | Stdio server and command-line entrypoints |
| `knowledge-base/` | Approved maintained guidance, schemas, benchmarks, provenance, and dependency records |
| `tests/` | Contract, MCP, audit, runtime, governance, and quality-gate regression tests |
| `ci/` | Deterministic fixture and product-workflow example |
| `.github/workflows/quality.yml` | Active repository quality workflow |

## Development

```bash
npm run build
npm run typecheck
npm test
npm run independence:check
npm run release:check
```

The active GitHub workflow also validates clean-room isolation, both benchmark contracts, the maintained corpus, packed installation, offline release, an archive-free workspace mirror, and the deterministic browser fixture gate. It uploads the resulting evidence. See `ci/README.md` before adapting the multi-profile workflow to a product repository.

## Project Status

**V1–V3**: All roadmap items implemented. See `ROADMAP.md`, `V2-ROADMAP.md`, `V3-ROADMAP.md`, and `V3-HANDOFF.md` for evidence boundaries.

**V4**: All nine items implemented and qualified, covering evidence-gated product briefs, deterministic planning, contained fixture generation, visual composition checks, bounded repair, interaction and recovery contracts, three delivery pilots, locked holdout evaluation, package installation, offline release, and clean-room independence.

**V5**: Established migration pathway and authority model. Version 2.0.5 removes obsolete named reference markers from public tests and ignore rules, replaces them with explicit approved-path checks, and retains distribution-wide independence scanning.

**V6 (Current—3.0.0)**: Complete governance and authority restructure with formal qualification:
- Knowledge admission manifest with SHA-256 digests
- Public-knowledge boundary and inventory with full retrieval-scope tracking
- Compiled authority model with deterministic derivation
- Shadow evaluation against V5 authority (no cutover without separate approval)
- V5-to-V6 migration qualification: 204/204 tests passing, all verification gates passed
- Evidence curated: 276 staged files (87 additions, 25 modifications, 164 deletions)
- Authority remains V5; V6 capabilities qualified in shadow mode

These results do not claim representative-user or universal design validation, and publishing the package does not activate the separate website.

## Keywords

design-engineering, mcp, product-design, quality-gate, ui, governance, authority-model, shadow-evaluation, knowledge-admission
