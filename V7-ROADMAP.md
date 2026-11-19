# ZtotheZ Design Engineering V7 Roadmap

## Objective

V7 converts lessons from permitted books, PDFs, documentation, product experiments, and prior
design tools into an independently authored ZtotheZ decision library. The library will become a
structured, testable source for design-engineering decisions instead of requiring agents to read a
large document archive or treating any external material as authority.

The goal is quality improvement without quality regression: preserve the strongest behavior of the
2.0.0 baseline, restore any lost task coverage, reduce unsupported or false design claims, and make
the resulting rules faster and more deterministic to retrieve.

## Independence And Provenance Rule

Research material is input for learning, comparison, and experience-building only. It must never be
copied wholesale into the repository, package, MCP retrieval roots, or runtime fallback. The
maintained output must be newly authored ZtotheZ concepts, schemas, code, thresholds, examples,
and tests.

Private provenance records may identify the research inputs and transformation decisions so the
development process remains auditable. Public runtime and package content must expose only the
resulting ZtotheZ-owned rules and their permitted evidence classes, not raw source content or
unnecessary external product identifiers.

This is an engineering independence policy, not a legal conclusion or non-infringement guarantee.
Copyright, licensing, trade-secret, patent, and other legal questions require qualified counsel
when material to a release or commercial decision.

## Items

### 0. Corpus Audit And Triage

Status: **Closed for V7: metadata audit complete; owner disposition recorded (0 raw `DataForV5/` files admitted for V7)**

Inventory `DataForV5/` by category, file type, duplication, technical relevance, provenance, and
transformation risk before reading or extracting content. Keep design/UIX, Figma, accessibility,
product engineering, secure development, web security, and penetration-testing material in
separate source domains. Mark unrelated, duplicate, obsolete, unlicensed, secret-bearing, or
unsafe material as excluded rather than allowing its presence to influence the library.

The audit must produce a private, machine-readable disposition registry with source fingerprint,
category, intended use, license/provenance status, extraction status, and exclusion reason. It must
not copy source text into the public repository. Security and pentesting material may inform a
separate security-engineering library later, but it must not silently become UI/UX authority.

The metadata-only auditor is implemented as `npm run v7:corpus-audit` and writes the private report
to `.ztothez-design-runtime/v7-corpus-audit/`. The first audit found 2,936 files, 432 duplicate
groups, 1,085 candidate-extraction files, 131 separate-domain security files, 268 background-only
files, 1,449 files requiring review, and 3 generated/dependency exclusions. No source text was
captured, and no source was admitted to the public authority.

Initial metadata shows approximately 7.0 GB of Learning material, 4.4 GB of Vibe Coding material,
143 MB of UsabilityUIX material, and 66 MB of design PDFs. These sizes are inventory observations,
not evidence that any source is suitable for extraction.

### 1. Restore Baseline Coverage

Status: **Done locally: versioned packaged-contract retention; historical rendering remains unclaimed**

Freeze the local 2.0.0 package behavior and compare it with the current engine. Restore or version
any lost workflow steps, especially SceneStart recovery and checkpoint coverage. A passing test is
not equivalent to the baseline when the contract has become narrower.

`node scripts/capture-v7-baseline.mjs --packaged-contracts` verifies the versioned
`packaged-contract-retention` scope. All 12 packaged journeys and 100 actions remain unchanged:
AegisOPS 3/19, SceneStart 4/67, and Azure Optimizer 5/14. Newly added interaction contracts are
classified separately; this scope does not invent historical interaction or rendering evidence.
The unscoped command still reports the historical limitation.

### 2. Structured Decision Library

Status: **Done locally: unique identities, typed rules, and per-rule provenance fingerprints implemented**

Create a ZtotheZ-owned typed library containing rule identity, task applicability, measurable
thresholds, failure conditions, counterexamples, confidence, evidence class, verification method,
conflict priority, and provenance fingerprints. Rules must support explicit no-match and abstention
outcomes.

The 18 maintained rules use `ZTDE-LIB-*` identities, separate from legacy auditor IDs. Loading
rejects duplicates, invalid provenance fingerprints, oversized files, and repository symlink
escapes. Tests load the library with only its JSON model present, without Markdown source files.

### 3. Independent Research Transformation

Status: **Closed for V7: all 18 rules independently reconciled from maintained first-party docs (`compile-decision-provenance.mjs` pass, 0 drift; 0 raw corpus files admitted)**

Use permitted research material in a controlled scratch process. Extract observations and lessons,
then author new rules without copying source wording, source code, taxonomies, schemas, identifiers,
datasets, or visual assets. Admit each resulting rule individually through the existing authority
and provenance checks.

`scripts/compile-decision-provenance.mjs` maintains an individual reconciliation rationale,
first-party source digests, rule fingerprint, project-policy classification, and an explicit
AI-assisted review class for each rule. Its check mode detects drift. These records describe the
current policy reconciliation, not a certification of historical authorship or raw-book ingestion.
Raw corpus content admission still depends on Item 0 review and the private research policy.

### 4. Library Retrieval And Decision Engine

Status: **Done locally: ranked retrieval, scoped evaluation, conflict handling, and CLI/MCP integration implemented**

Implement deterministic ranking, task-signal matching, conflict resolution, confidence reporting,
and no-match behavior over the structured library. Keep the existing Markdown workflow and V5
authority active until the new engine proves parity.

`search_decision_rules` and `zz-design query-library --json` share the ranked selector. Results
carry matched terms and relevance confidence, not evidence probabilities. Exact IDs resolve
directly. Weak incidental matches return no-match. Explicit policy conflicts abstain without
overwriting independent failures. `evaluate_decision` reports its supplied-signal evidence scope.

### 5. Quality And Anti-Slop Qualification

Status: **Done: automated, AI-assisted (18/18 rules across all 3 pilots + all 3 private holdouts), and owner visual fidelity review (`OWNER-REVIEW.md`, 2026-11-19) all PASS**

Benchmark the library against the 2.0.0 baseline, current V5 behavior, AegisOPS, SceneStart, Azure
Optimizer, and the private authorized holdout cohort. Measure task completeness, accessibility,
state recovery, information hierarchy, truthful disclosure, maintainability, abstention, and false
claim rejection.

All 18 rules have positive, negative, and missing-signal regression cases. The versioned
observation importer supports every category and binds records to a product, source digest, rule
fingerprint, and artifact checksum. It preserves automated, AI-assisted, owner, expert, and user
evidence classes. A checksum does not certify an observation or the identity of its author.
The private holdout reader validates registry and cohort binding without executing projects.

The September 8 fresh run covers all 13 maintained pilot profiles at 320, 768, and 1440 pixels.
Versioned normal-text contrast and target-size samples extend supported runtime rules from two to
four. Export checks now reject empty files and can assert text or parsed JSON fields. The V7 pilot
overlay adds payload assertions without rewriting the retained baseline journey contracts.
SceneStart's narrow-layout, serialization, import, playback, and readme defects were repaired in
the maintained fixture; the original application was not changed. Offline playback passed pixel,
identity, pause, reduced-motion, overflow, and network checks at 320 and 1440 pixels.

Run `node scripts/capture-v7-pilots.mjs` for a fresh private capture. Set
`ZTDE_V7_PILOT_REPORT` to its relative `pilot-report.json` path inside the private runtime directory
when running the shadow capture. The reader verifies cohort, profile, source, library, contract,
and artifact bindings and recomputes decisions instead of trusting a stored aggregate pass.
See [V7-REVIEW-NEXT.md](V7-REVIEW-NEXT.md) for the actual remaining review tasks and evidence links.

The owner completed the repaired-fixture recheck on 2026-09-11 and reported PASS for AegisOPS,
SceneStart, and Azure Optimizer. The private attributable record does not convert the fixtures into
visual replicas of the original products. A comparison with the owner-controlled live products
confirmed that the shared generated fixture shell omits product-specific branding, navigation,
information density, and signature composition. Existing browser profiles do not measure that
parity. Product-fidelity evidence must be versioned separately rather than inferred from journey
or accessibility passes.

A separately bounded product-fidelity verifier is now implemented. Candidate contracts remain
under `tests/fixtures/product-fidelity/` and are not admitted as V5 knowledge authority. They
declare product identity, navigation, information hierarchy, task, recovery, and data-boundary
cues for AegisOPS, SceneStart, and Azure Optimizer at 375, 768, and 1440 pixels. The three
repository-owned fixtures now use distinct security-operations, creative-studio, and cloud-cost
shells while preserving the previously accepted interactions. `npm run v7:fidelity` reports an
automated PASS for all three candidates and explicitly leaves brand fit, information hierarchy,
visual rhythm, domain fit, and responsive composition for owner review. Structural selectors and
non-overlap checks do not prove visual quality or parity with the live products.

### 6. Shadow Migration And Controlled Cutover

Status: **Owner cutover APPROVED (2026-11-19); ready for final check, version bump, and release**

Run the library beside V5. Cut over only after deterministic parity, holdout qualification,
package and offline checks, provenance review, and explicit owner approval. No npm publication,
GitHub action, website deployment, or authority activation is implied by V7 implementation.

*Note: The V7 Decision Engine remains shadow-only. An AI-generated walkthrough or implementation
summary is not owner approval and does not activate V7 authority.*

## Completion Rule

V7 is not complete. The structured ZtotheZ library must be independently authored, reproducible,
tested, package-safe, offline-capable, demonstrably no worse than the 2.0.0 baseline, and accepted
through a separately recorded owner decision. Raw research documents remain research inputs and do
not become runtime dependencies.

## Current Blocking Evidence

Owner review on 2026-09-08 identified Studio layout, Azure section-spacing, and AegisOPS Enter
submission defects. Local fixture repairs passed 239 root tests, all required sequential gates,
24 targeted live regression cases, 13 refreshed pilot profiles, and offline export checks.
The current pilot capture is `v7-pilots-2026-09-08T20-40-05-987Z`; earlier captures remain historical.
The follow-up repaired missing Azure analysis content and AegisOPS configuration/retry feedback.
All 13 profiles pass after explicitly declaring one controlled health failure in the recovery
interaction contract. This does not change the historical version 1.0 journeys or suppress
unexpected errors. The original failed capture is retained.
See `V7-REVIEW-NEXT.md` for review evidence. Original human FAIL observations remain retained;
the owner supplied a new post-fix PASS on 2026-09-11. That bounded result does not change V6
acceptance, establish original-product visual fidelity, or change V5 authority.

The fresh pilot reports include `320px` evidence for AegisOPS, SceneStart, and Azure Optimizer.
The adapter supports `ZTDE-LIB-RESP-001`, `ZTDE-LIB-RESP-002`, `ZTDE-LIB-A11Y-001`, and
`ZTDE-LIB-A11Y-002`, not the remaining 14 library rules. A passing subset does not qualify the
whole product. Other accessibility, state recovery, token, hierarchy, truthful-disclosure, and
maintainability rules still require bound observations or reviews. The structured review importer
now exists, but missing observations are not filled automatically. Page declarations and legacy
unproven decision signals are not measurements.

Private holdout evidence must remain private, but privacy does not prevent local qualification.
The private reader has verified the retained three-project holdout against the current registry.
Those reports do not contain the new decision observations, so their V7 product qualification
remains unresolved. Set `ZTDE_V7_HOLDOUT_REPORT` to a relative report path within the private
benchmark root to include that check. No private evidence is served by the new MCP tools.
The baseline comparison now checks all three products' ordered actions and assertions, with an
explicit versioned scope for the evidence present in the 2.0.0 package.

## Completion Sequence

1. Complete Item 0 content suitability and permission dispositions for any raw inputs proposed
   for transformation. The current library does not need those inputs to run.
2. Supply and inspect Item 5 observations for the remaining product and holdout categories.
   Import them through `zz-design qualify-decisions`; retain incomplete or failing results.
3. Review the candidate product-fidelity screenshots and record PASS, FAIL, or NOT TESTED for
   each declared human-review category. Do not admit the contracts into maintained authority
   merely because their automated selectors pass.
4. Review the per-rule policy reconciliation records without treating them as historical
   authorship certification. Raw-source admission is a separate decision.
5. Rerun package, offline, product, and holdout qualification. Present retained reports for the
   separate Item 6 owner cutover decision; do not activate or publish V7 implicitly.
