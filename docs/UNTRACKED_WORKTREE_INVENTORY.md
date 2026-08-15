# Untracked worktree inventory

Snapshot date: 2026-08-16
Branch: `main`
HEAD at capture: `88a370413d0cc15925d6f9b8917461d3ee875a73`
Untracked path count: **2079**

This report is generated from `git ls-files --others --exclude-standard` and classifies every path individually. It is a preservation and owner-review record, not authorization to delete, archive, stage, execute, or deploy anything. Release material must be derived from an exact committed SHA and excludes every untracked path.

## Classification counts

| Bucket | Count | Default decision |
| --- | ---: | --- |
| `ARCHIVE_OR_EXPORT_OWNER_REVIEW` | 4 | PRESERVE pending retention decision; never use as release source. |
| `BMAD_GENERATED` | 269 | PRESERVE; do not stage or package without an explicit project decision. |
| `HISTORICAL_RELEASE_CANDIDATE` | 1584 | PRESERVE for forensics; never execute or stage as current release source. |
| `HISTORICAL_REPORT_OWNER_REVIEW` | 35 | PRESERVE pending owner review; do not promote to current evidence. |
| `INVALID_HISTORICAL_EVIDENCE` | 1 | PRESERVE as untrusted historical material; it cannot establish current attestation. |
| `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | 180 | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `SEMANTIC_CANDIDATE_OWNER_REVIEW` | 5 | PRESERVE pending owner review; do not stage, delete, or execute. |
| `UNREVIEWED_PRESERVE_OWNER_REVIEW` | 1 | PRESERVE pending owner classification; no staging, deletion, or execution. |

## Individual path classification

| Path | Bucket | Decision |
| --- | --- | --- |
| `.agents/skills/bmad-advanced-elicitation/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-advanced-elicitation/assets/methods.csv` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-advanced-elicitation/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-advanced-elicitation/scripts/pick_methods.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-advanced-elicitation/scripts/tests/test_pick_methods.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-agent-analyst/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-agent-analyst/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-agent-architect/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-agent-architect/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-agent-dev/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-agent-dev/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-agent-pm/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-agent-pm/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-agent-ux-designer/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-agent-ux-designer/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-architecture/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-architecture/assets/spine-template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-architecture/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-architecture/references/headless.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-architecture/references/reviewer-gate.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-architecture/scripts/lint_spine.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-architecture/scripts/tests/test_lint_spine.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/assets/brain-icons.json` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/assets/brain-methods.csv` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/assets/brain-selector.html` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/references/converge.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/references/finalize.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/references/headless.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/references/in-chat-techniques.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/references/mode-autonomous.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/references/mode-facilitator.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/references/mode-partner.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/references/resume.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/scripts/brain.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-brainstorming/scripts/tests/test_brain.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/compile-epic-context.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/references/deletion-check.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/review-prompts/edge-case-hunter.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/review-prompts/verification-gap.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/spec-template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/step-01-clarify-and-route.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/step-02-plan.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/step-03-implement.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/step-04-review.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build-auto/workflow.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/compile-epic-context.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/references/deletion-check.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/review-prompts/edge-case-hunter.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/review-prompts/verification-gap.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/spec-template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/step-01-clarify-and-route.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/step-02-plan.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/step-03-implement.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/step-04-review.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/step-05-present.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/step-oneshot.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/sync-sprint-status.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-build/workflow.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-checkpoint-preview/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-checkpoint-preview/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-checkpoint-preview/generate-trail.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-checkpoint-preview/step-01-orientation.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-checkpoint-preview/step-02-walkthrough.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-checkpoint-preview/step-03-detail-pass.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-checkpoint-preview/step-04-testing.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-checkpoint-preview/step-05-wrapup.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-code-review/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-code-review/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-code-review/references/deletion-check.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-code-review/review-prompts/edge-case-hunter.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-code-review/review-prompts/verification-gap.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-code-review/steps/step-01-gather-context.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-code-review/steps/step-02-review.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-code-review/steps/step-03-triage.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-code-review/steps/step-04-present.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-correct-course/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-correct-course/checklist.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-correct-course/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-architecture/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-architecture/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-epics-and-stories/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-epics-and-stories/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-epics-and-stories/steps/step-01-validate-prerequisites.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-epics-and-stories/steps/step-02-design-epics.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-epics-and-stories/steps/step-03-create-stories.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-epics-and-stories/steps/step-04-final-validation.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-epics-and-stories/templates/epics-template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-prd/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-prd/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-story/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-story/checklist.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-story/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-story/discover-inputs.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-create-story/template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-customize/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-customize/scripts/list_customizable_skills.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-customize/scripts/tests/test_list_customizable_skills.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/assets/research.template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/references/draft.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/references/finalize.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/references/html-briefing.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/references/lifecycle.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/references/process.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/references/run.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/references/selection.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/references/synthesis.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/references/verification.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/scripts/recon_kit.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/scripts/tests/test_recon_kit.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/types/academic-lit.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/types/competitive.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/types/domain.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/types/market.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/types/technical.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-deep-recon/types/user-voice.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-dev-auto/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-dev-story/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-dev-story/checklist.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-dev-story/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-document-project/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-domain-research/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-edit-prd/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-edit-prd/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-editorial-review-prose/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-editorial-review-structure/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-editorial-review/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-editorial-review/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-forge-idea/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-forge-idea/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-forge-idea/scripts/resolve_personas.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-forge-idea/scripts/tests/test_resolve_personas.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-generate-project-context/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-help/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-market-research/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-party-mode/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-party-mode/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-party-mode/references/create-party.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-party-mode/references/mode-agent-team.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-party-mode/references/mode-auto.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-party-mode/references/mode-subagent.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-party-mode/references/party-memory.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-party-mode/scripts/resolve_party.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-party-mode/scripts/tests/test_resolve_party.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prd/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prd/assets/headless-schemas.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prd/assets/prd-template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prd/assets/prd-validation-checklist.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prd/assets/validation-report-template.html` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prd/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prd/references/headless.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prd/references/validate.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prfaq/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prfaq/agents/artifact-analyzer.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prfaq/agents/web-researcher.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prfaq/assets/prfaq-template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prfaq/bmad-manifest.json` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prfaq/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prfaq/references/customer-faq.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prfaq/references/internal-faq.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prfaq/references/press-release.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-prfaq/references/verdict.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-product-brief/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-product-brief/assets/brief-template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-product-brief/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-project-context/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-project-context/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-project-context/references/best-practices.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-project-context/references/template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-qa-generate-e2e-tests/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-qa-generate-e2e-tests/checklist.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-qa-generate-e2e-tests/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-quick-dev/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/references/acceptance-verdict.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/references/aggregate-views.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/references/evidence-gathering.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/references/retro-document.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/references/team-discussion.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/scripts/__pycache__/sprint_status.cpython-311.pyc` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/scripts/git_evidence.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/scripts/sprint_status.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/scripts/tests/__pycache__/test_git_evidence.cpython-311-pytest-9.1.1.pyc` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/scripts/tests/__pycache__/test_sprint_status.cpython-311-pytest-9.1.1.pyc` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/scripts/tests/fixtures/sprint-status-template.yaml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/scripts/tests/test_git_evidence.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-retrospective/scripts/tests/test_sprint_status.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review-adversarial-general/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review-edge-case-hunter/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review-verification-gap/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/references/editorial-common.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/references/lens-adversarial.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/references/lens-edge-case-hunter.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/references/lens-prose.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/references/lens-structure.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/references/lens-verification-gap.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/references/structure-models.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/scripts/tests/test_word_metrics.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-review/scripts/word_metrics.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-spec/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-spec/assets/headless-schemas.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-spec/assets/spec-template.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-spec/assets/stories-schema.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-spec/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/references/fix-sprint-status.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/references/generate-tracking.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/references/readiness-gate.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/references/status-view.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/references/validate.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/scripts/__pycache__/sprint_plan.cpython-311.pyc` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/scripts/sprint_plan.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/scripts/tests/__pycache__/test_sprint_plan.cpython-311-pytest-9.1.1.pyc` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/scripts/tests/test_sprint_plan.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-planning/sprint-status-template.yaml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-status/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-sprint-status/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-technical-research/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/color-themes.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/design-directions.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/design-example-editorial.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/design-example-mobile.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/design-example-shadcn.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/excalidraw-wireframe.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/experience-example-mobile.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/experience-example-shadcn.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/headless-schemas.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/key-screens.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/assets/validation-report-template.html` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/references/creative-tools.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/references/design-md-spec.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/references/headless.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-ux/references/validate.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-validate-prd/SKILL.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.agents/skills/bmad-validate-prd/customize.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `.release-candidate-b42ab08a/.dockerignore` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.editorconfig` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.env.example` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.gitattributes` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.github/dependabot.yml` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.github/workflows/ci.yml` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.gitignore` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.gitleaks.toml` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.gitleaksignore` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.node-version` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.npmrc` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.nvmrc` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.prettierignore` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.storybook/main.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/.storybook/preview.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/AGENT_RULES.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/API_CONTRACT.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/AUTH_RBAC_POLICY.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/B0_PRODUCTION_STATUS.txt` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/B0_STAGE3B_EXECUTIVE_SUMMARY.txt` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/B0_STAGE3B_INTERNAL_PRICING_REPORT.txt` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/B0_STAGE3B_SUMMARY.txt` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/DB_MIGRATION_POLICY.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/DESIGN.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/Dockerfile` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/FRONTEND_RULES.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/MCP_SECURITY_POLICY.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/OBSERVABILITY_POLICY.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/ORIGINAL_REQUIREMENTS_SUMMARY.txt` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/PROJECT_FAILURE_LEDGER.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/README-DEMO.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/README.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/RELEASE_CHECKLIST.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/RUN-DEMO.ps1` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/STOP-DEMO.ps1` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/TESTING_STRATEGY.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/VERIFY-DEMO.ps1` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/WAVE1_SUMMARY.txt` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/eslint.config.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/admin/admin-access.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/admin/admin-access.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/admin/admin.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/app.module.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/auth/actor-context.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/auth/admin-permission.guard.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/auth/admin-session.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/auth/auth-fastify-bridge.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/auth/auth.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/auth/auth.module.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/auth/auth.providers.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/auth/customer-session.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/auth/permissions.decorator.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/auth/provider-readiness.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/admin-booking-date-filter.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/admin-booking-operations.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/admin-booking.errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/arrival-access-config.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/booking-detail.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/booking-hold-status.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/booking-hold.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/booking.module.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/cookie.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/coupon-delivery.errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/guest-access-logout.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/guest-access-otp.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/ip.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/repositories/admin-booking.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/repositories/booking-detail.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/repositories/coupon-delivery.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/repositories/guest-access.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/repositories/guest-session.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/repositories/room-operations.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/room-operations.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/secrets.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/admin-booking-access-pass.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/admin-booking-lifecycle.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/arrival-access-config.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/booking-access-pass.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/booking-detail.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/booking-hold-status.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/booking-hold.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/coupon-delivery.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/guest-access-otp-request.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/guest-access-otp-verify.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/guest-logout.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/guest-session.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/services/room-operations.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/booking/stay-representation.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/catalog/audit.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/catalog/catalog.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/catalog/catalog.errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/catalog/catalog.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/catalog/catalog.safety.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/catalog/catalog.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/catalog/property-context.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/coupons/coupon.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/coupons/coupon.errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/coupons/coupon.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/coupons/coupon.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/customer/claim-booking.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/customer/claim-booking.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/customer/customer-audit.adapter.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/customer/customer-booking.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/customer/customer-bookings.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/customer/customer-profile.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/customer/customer-profile.schema.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/customer/customer-profile.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/customer/customer.module.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/database/database.module.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/database/database.provider.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/errors/problem-details.filter.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/health/health.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/health/health.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/http-adapter.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/main.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/admin-payment-provider.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/admin-payment-reconciliation.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/admin-payment-reconciliation.errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/admin-payment-reconciliation.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/momo-payment.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/momo-return.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/momo-webhook.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/payment-provider-settings.errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/payment-provider.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/payment-status.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/payment.errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/payment.module.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/payment.tokens.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/providers/momo/momo.adapter.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/providers/momo/momo.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/providers/momo/momo.contracts.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/providers/momo/momo.errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/providers/momo/momo.signature.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/providers/vnpay/vnpay.adapter.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/providers/vnpay/vnpay.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/providers/vnpay/vnpay.contracts.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/providers/vnpay/vnpay.errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/providers/vnpay/vnpay.signature.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/repositories/admin-payment.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/repositories/payment-status.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/services/admin-payment-reconciliation.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/services/momo-payment-initiation.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/services/payment-provider-settings.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/services/payment-simulator-mapping.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/services/payment-status.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/services/vnpay-payment-initiation.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/vnpay-payment.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/vnpay-return.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/payment/vnpay-webhook.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/multi-night.gate.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.admin.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.composer.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.domain.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.events.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.gate.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.http.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.lookup.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing-policy/pricing-policy.validator.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/availability.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/availability.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/availability.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/cheapest-eligible-pricing.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/coupon.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/flexible-stay-resolver.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/multi-night-offer.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/nearby-availability.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/nearby-availability.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/nearby-availability.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/pricing-engine.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/quote.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/quote.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/quote.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/rate-plan.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/rate-plan.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/rate-plan.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/recommendation.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/recommendation.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/recommendation.routes.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/recommendation.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/selection-rule-matcher.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/pricing/stay-policy.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/public-catalog/public-room-catalog.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/public-catalog/public-room-catalog.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/public-catalog/public-room-catalog.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/reporting/admin-operational-report.controller.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/reporting/admin-operational-report.repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/reporting/admin-operational-report.service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/reporting/reporting.module.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/translation/google-description-translator.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/src/trusted-proxy.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/actor-context.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/admin-access.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/admin-permission.guard.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/admin-route-permission-inventory.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/admin-session.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/admin.controller.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/audit-phase8a/audit-exhaustive-verification.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/audit-phase8a/audit-independent-oracle.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/audit-phase8a/audit-momo-oracle.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/audit-phase8a/audit-payment-signature-conformance.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/audit-phase8a/audit-property-random.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/audit-phase8a/audit-vnpay-oracle.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/audit-phase8b/audit-exhaustive-cheapest.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/audit-phase8b/audit-property-cheapest.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/auth-fastify-bridge.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/auth.providers.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/availability.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/admin-booking-access-pass.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/admin-booking-date-filter.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/admin-booking-operations.controller.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/booking-access-pass.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/booking-detail.controller.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/booking-detail.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/booking-hold-status.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/booking-hold.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/cookie.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/coupon-delivery.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/guest-access-otp-request.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/guest-access-otp-verify.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/guest-logout.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/guest-session.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/ip.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/room-operations.controller.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/room-operations.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/booking/secrets.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/catalog-archive-safety.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/catalog.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/component-uuid-validation.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/customer-session.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/customer/customer-profile.schema.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/database-boundary.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/database.provider.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/health.controller.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/health.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/http-adapter.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/admin-booking-lifecycle.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/app-bootstrap.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/arrival-access-config.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/availability.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/catalog-archive-safety.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/cheapest-pricing-pg.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/coupon-admin.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/coupon-delivery.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/coupon-quote.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/customer-module.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/customer-oauth.deterministic.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/gate-b9-race-matrix.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/maintenance.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/momo-payment.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/multi-night-offer.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/nearby-availability-priceability.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/nearby-availability.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/phase8i-reporting-fixtures.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/pricing-policy-production-remediation.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/pricing-policy-runtime.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/property-authority.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/property-authorization.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/property-price-tier.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/public-booking.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/quote.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/rate-plan-early-bird-flex.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/rate-plan.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/room-types-amenities.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/rooms.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/staff-manager-authorization.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/integration/vertical-api.integration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/multi-night-quote-component-uuid.regression.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/oauth/oidc-test-server.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/admin-payment-reconciliation.controller.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/admin-payment-reconciliation.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/gate-b1-cryptographic-conformance.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/gate-b1-momo.oracle.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/gate-b1-vnpay.oracle.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/momo.adapter.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/momo.query.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/payment-provider-simulator-runner.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/payment-status.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/payment.module.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/vnpay.adapter.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/payment/vnpay.query.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/phase3-test-commands.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/playwright-database-setup.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/playwright-global-setup.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/playwright-server-startup.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/pricing-cheapest.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/pricing-engine.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/pricing-policy-bootstrap-auth.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/pricing-policy-uuid-validator.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/pricing-policy.composer.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/pricing-policy.gate.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/pricing-policy.lookup.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/pricing-policy.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/pricing-policy.validator.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/problem-details.filter.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/property-context.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/provider-readiness.controller.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/public-room-catalog.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/quote.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/rate-plan.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/recommendation-engine.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/reporting/admin-operational-report.controller.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/reporting/admin-operational-report.repository.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/reporting/admin-operational-report.service.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/stay-policy.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/translation/google-description-translator.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/test/trusted-proxy.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/api/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/payment-demo/main.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/payment-demo/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/payment-demo/test/environment.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/payment-demo/test/payment-flow.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/payment-demo/test/production-deployment-environment.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/components.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/eslint.config.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/next-env.d.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/next.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/postcss.config.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/hospitality/executive-suite.png` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/hospitality/family-suite.png` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/hospitality/hero-suite.png` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-009-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-009-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-009-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-018-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-018-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-018-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-027-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-027-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-027-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-036-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-036-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-036-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-046-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-046-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-046-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-064-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-064-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-064-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-073-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-073-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-073-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-083-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-083-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/common/common-083-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-005-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-005-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-005-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-016-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-016-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-016-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-021-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-021-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-021-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-032-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-032-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-032-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-038-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-038-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-038-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-043-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-043-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-043-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-049-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-049-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/haven/haven-049-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-015-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-015-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-015-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-020-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-020-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-020-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-025-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-025-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-025-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-030-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-030-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-030-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-035-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-035-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-035-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-046-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-046-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/nami/nami-046-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-006-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-006-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-006-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-020-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-020-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-020-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-027-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-027-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-027-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-034-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-034-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-034-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-041-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-041-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-041-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-048-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-048-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-048-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-062-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-062-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/phu-van/phu-van-062-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-000-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-000-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-000-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-007-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-007-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-007-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-014-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-014-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-014-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-022-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-022-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-022-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-044-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-044-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-044-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-066-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-066-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/rose/rose-066-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-000-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-000-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-000-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-011-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-011-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-011-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-017-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-017-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-017-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-023-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-023-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-023-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-035-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-035-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-035-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-041-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-041-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sabi/sabi-041-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-000-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-000-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-000-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-005-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-005-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-005-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-017-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-017-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-017-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-028-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-028-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-028-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-040-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-040-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-040-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-052-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-052-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sudal/sudal-052-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-000-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-000-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-000-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-013-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-013-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-013-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-020-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-020-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-020-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-027-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-027-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-027-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-033-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-033-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-033-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-040-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-040-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-040-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-054-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-054-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/sunset/sunset-054-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-000-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-000-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-000-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-027-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-027-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-027-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-055-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-055-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-055-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-068-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-068-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-068-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-096-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-096-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-096-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-110-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-110-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-110-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-124-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-124-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/wabi/wabi-124-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-000-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-000-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-000-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-012-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-012-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-012-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-025-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-025-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-025-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-038-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-038-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-038-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-044-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-044-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-044-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-050-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-050-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-050-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-057-card.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-057-hero.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/public/images/peace-home/yuki/yuki-057-thumb.webp` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/account/bookings/[bookingCode]/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/account/bookings/customer-bookings-client.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/account/bookings/customer-bookings-client.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/account/bookings/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/account/layout.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/account/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/account/profile/customer-profile-client.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/account/profile/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/account/settings/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/accounts/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/amenities/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/audit/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/bookings/[bookingCode]/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/bookings/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/coupons/[couponId]/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/coupons/new/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/coupons/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/customer-accounts/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/departments/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/housekeeping/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/layout.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/maintenance/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/operational-reviews/[reviewId]/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/operational-reviews/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/payment-providers/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/payments/[paymentId]/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/payments/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/price-tiers/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/pricing-policies/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/profile/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/property/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/rate-plans/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/room-operations/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/room-types/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/rooms/[id]/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/rooms/new/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/rooms/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/(protected)/scanner/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/error.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/forbidden/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/layout.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/admin/login/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/api/admin/me/route.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/api/auth/sign-in/email/route.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/api/auth/sign-out/route.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/booking/manage/[bookingCode]/claim-client.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/booking/manage/[bookingCode]/guest-route-client.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/booking/manage/[bookingCode]/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/booking/manage/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/booking/quote/[quoteId]/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/booking/search/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/globals.css` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/health/route.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/icon.svg` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/layout.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/locale/route.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/login/customer-login-admin-state.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/login/customer-login-client.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/login/customer-login-presentation.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/login/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/rooms/[roomTypeId]/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/app/rooms/page.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/account-language-settings.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/admin-logout-button.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/admin-navigation.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/admin/admin-ui.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/amenity-manager.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/arrival-access-config-editors.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/availability-search-form.stories.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/availability-search-form.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/availability-search-results.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/booking-access-pass-panel.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/booking-access-scanner.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/booking-detail-panel.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/cancellation-policy-summary.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/catalog-table.stories.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/catalog-table.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/confirmed-success-panel.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/coupon-delivery-action.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/coupon-detail.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/coupon-form.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/coupon-input.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/coupon-list.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/coupon-summary.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/customer-booking-actions.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/hold-success-panel.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/housekeeping-workboard.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/landing-availability-search.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/locale-provider.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/locale-switch.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/maintenance-manager.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/operational-report-dashboard.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/operational-report-dashboard.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/otp-request-panel.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/otp-verify-panel.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/payment-provider-manager.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/payment-provider-selector.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/payment-status-summary.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/price-tier-manager.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/pricing-policy-manager.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/property-editor.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/public-header.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/public-header.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/public-landing.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/quote-contact-form.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/quote-summary.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/quote-view.stories.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/quote-view.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/rate-plan-manager.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/room-creator.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/room-detail-admin.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/room-detail-quote-action.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/room-housekeeping-manager.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/room-operations-board.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/room-operations-board.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/room-type-manager.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/session-logout-button.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/stay-time-recommendations.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/alert-dialog.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/alert.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/avatar.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/badge.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/breadcrumb.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/button.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/card.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/checkbox.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/command.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/dialog.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/dropdown-menu.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/empty.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/field.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/input.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/label.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/navigation-menu.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/pagination.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/popover.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/scroll-area.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/select.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/separator.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/sheet.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/sidebar.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/skeleton.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/sonner.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/spinner.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/table.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/tabs.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/textarea.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/toggle-group.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/toggle.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/components/ui/tooltip.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/content/peace-home-media-provenance.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/content/peace-home-physical-rooms.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/content/peace-home-physical-rooms.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/content/public-hospitality-content.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/hooks/use-mobile.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/admin-api.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/admin-booking-filter-state.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/admin-booking-filter-state.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/admin-natural-sort.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/admin-natural-sort.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/admin-navigation.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/admin-session-server.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/admin-session-server.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/booking-api.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/booking-search-state.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/booking-search-state.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/catalog-safety.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/i18n/messages.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/internal-api.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/internal-api.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/payment-redirect.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/public-api-origin.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/public-api-origin.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/public-catalog-state.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/public-room-catalog.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/public-room-catalog.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/server-time.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/session-cookie.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/lib/utils.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/src/middleware.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/account-language-settings.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/admin-bookings-api.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/admin-error-page.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/admin-navigation.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/admin-payment-detail-page.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/admin-payments-api.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/admin-payments-page.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/admin-ui-interactions.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/availability-search-results.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/booking-access-pass-panel.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/booking-access-scanner.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/booking-api.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/booking-detail-coupon-summary.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/booking-detail-panel.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/booking-search-state.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/catalog-safety.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/catalog-table.a11y.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/confirmed-success-panel.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/coupon-delivery-action.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/coupon-detail.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/coupon-form.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/coupon-input.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/coupon-summary.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/customer-bookings.a11y.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/customer-login-localization.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/customer-profile-localization.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/guest-booking-route.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/hold-coupon-summary.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/hold-success-panel.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/hourly-interval.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/i18n-critical-copy.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/i18n.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/jest-axe.d.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/locale-route.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/login/customer-login-presentation.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/otp-panels.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/payment-localization.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/payment-redirect.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/payment-status-summary.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/phase2-1-customer-booking-a11y.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/phase8h-operations.a11y.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/phase8i-critical-surfaces.a11y.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/public-catalog-state.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/public-homepage.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/public-nearby-api.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/public-pricing.a11y.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/quote-contact-form.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/quote-summary.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/quote-view-coupon.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/room-housekeeping-manager.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/server-time.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/session-cookie.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/stay-time-recommendations.test.tsx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/test/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/vitest.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/web/vitest.setup.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/access/demo-access-credential-provider.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/message-id.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/otp-context.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/otp-skip-rules.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/otp-skip-rules.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/skip-rules.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/smtp-transport.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/templates/access-credential-delivery.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/templates/booking-confirmation.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/templates/coupon-delivery.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/templates/hold-confirmation.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/templates/otp-challenge.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/email/templates/otp-challenge.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/jobs/expire-stale-holds.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/jobs/issue-access-credentials.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/jobs/process-housekeeping-reminders.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/jobs/process-outbox.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/jobs/process-reconciliation.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/lifecycle.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/main.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/outbox/claim-outbox-batch.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/outbox/finalize-outbox.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/outbox/reclaim-expired-leases.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/reconciliation/process-reconciliation.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/reconciliation/process-reconciliation.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/reconciliation/query-provider.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/scheduler/worker-runner.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/scheduler/worker-runner.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/scheduler/worker-scheduler.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/scheduler/worker-scheduler.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/worker-config.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/src/worker-config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/access-credential-timing.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/email/access-credential-delivery-template.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/email/booking-confirmation-template.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/email/coupon-delivery-template.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/email/message-id.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/email/skip-rules.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/email/smtp-transport.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/email/template-hold-confirmation.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/expire-stale-holds-coupon.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/expire-stale-holds.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/fixtures/hold-expiration-fixtures.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/fixtures/outbox-fixtures.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/fixtures/outbox-types.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/jobs/coupon-delivery-outbox.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/jobs/process-outbox-otp.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/jobs/process-outbox.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/lifecycle.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/outbox/claim-outbox-batch.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/outbox/finalize-outbox.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/outbox/reclaim-expired-leases.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/payment-expiry-race.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/test/process-housekeeping-reminders.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/apps/worker/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/candidate-image.tar` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/compose.yaml` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/count-business.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/count-policy.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/deploy/.env.production.example` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/deploy/Caddyfile` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/deploy/README.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/deploy/environment-schema.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/deploy/release-manifest.example.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/deploy/release-manifest.schema.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docker-compose.production.yml` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/admin-v2/ADMIN_CODEGRAPH_AND_ROUTE_INVENTORY.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/admin-v2/ADMIN_FINAL_CLOSURE_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/admin-v2/BOOKING_DATE_FILTER_CONTRACT.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/admin-v2/CURRENT_UI_AUDIT.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/admin-v2/DESIGN_SYSTEM.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/admin-v2/FINAL_VISUAL_ACCEPTANCE.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/admin-v2/FINAL_VISUAL_ACCEPTANCE_V2.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/admin-v2/PAGE_ACCEPTANCE_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/admin-v2/RBAC_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0001-modular-monolith.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0002-postgresql.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0003-rest-openapi.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0004-payment-adapter.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0005-data-driven-pricing-selection.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0006-payment-core-settlement.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0007-google-customer-identity.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0008-booking-ownership-claim.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0009-admin-booking-lifecycle.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0010-cheapest-eligible-pricing.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0011-payment-settlement-reconciliation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0013-client-requirement-acceptance.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0014-full-product-activation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/adr/ADR-0015-live-provider-activation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/container-diagram.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/architecture/system-context.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/WAVE1_CURRENT_RELEASE_PIPELINE.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/api-source-map-pricing-availability-booking-customer.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/current-integration-recovery.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-closure-codegraph.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-closure/AUDIT_RECONCILIATION.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-system/CURRENT_ROOM_STATE_MODEL.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-system/DEFECT_LEDGER.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-system/EXECUTIVE_AUDIT_SUMMARY.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-system/FEATURE_EVIDENCE_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-system/LIFECYCLE_TEST_RESULTS.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-system/PRODUCTION_ACCEPTANCE.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-system/RBAC_PRODUCTION_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-system/REMAINING_GAPS.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/final-system/ROUTE_FEATURE_INVENTORY.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/p0-final-codegraph.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-5-final-audit.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-7-customer-requirement-reconciliation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-7f-validation-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-7g-validation-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/artifacts/backup-drill/result.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/artifacts/pricing-boundary-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/artifacts/pricing-counterexamples.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/artifacts/pricing-exhaustive-summary.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/artifacts/pricing-property-random.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/combo-recommendation-analysis.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/evidence-index.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/gap-register.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/master-production-readiness-audit.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/migration-backup-restore-audit.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/next-phase-roadmap.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/payment-gateway-assurance.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/payment-provider-spec-traceability.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/performance-capacity-baseline.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/pricing-algorithm-verification.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/pricing-rule-provenance-matrix.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/reliability-observability-audit.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/risk-register.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/scalability-extensibility-audit.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8a/security-privacy-audit.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8b-validation-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8b/artifacts/exhaustive-audit.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8b/artifacts/property-based-audit.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8b1-validation-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8b1/admin-configurability-matrix.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8c-validation-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8c/cross-provider-race-matrix.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8c/cryptographic-vectors.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8c/payment-provider-spec-traceability.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8c1/hardcode-register.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8c1/hardcode-summary.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8c1/ui-page-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8c1/ui-quality-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d/client-requirement-matrix.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d/endpoint-inventory.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d/ui-minimalism-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d/ui-requirement-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d/validation-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d2/accessibility-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d2/mixed-language-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d2/responsive-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d2/ui-page-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d3/public-entry-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8d3/web-route-map.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8e/fe-be-parity-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8e/feature-flag-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8e/product-capability-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8e/ui-state-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8e/validation-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8f/playwright-baseline-audit.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8f/provider-config-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8f/provider-route-contract-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8f/provider-security-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8f/provider-ui-state-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8f/validation-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8g/current-ui-audit.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8g/visual-fidelity-ledger.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8h/client-workbook-parity-matrix.csv` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8h/client-workbook-parity-matrix.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8h/payment-collection-gap.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8h/pricing-adjustment-reconciliation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8h/visual-fidelity-ledger.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8i/accessibility-measurement.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8i/endpoint-reconciliation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8i/external-acceptance-report.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8i/phase-8h-independent-review.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8i/report-metric-contract.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/phase-8i/visual-uat-ledger.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/audit/project-production-readiness-reconciliation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/contracts/errors.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/contracts/routes.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/customer-v2/CUSTOMER_DATA_PROVENANCE_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/customer-v2/CUSTOMER_INTERACTION_LEDGER.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/customer-v2/CUSTOMER_STYLE_CONTRACT.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/design/ADMIN_ROUTE_COVERAGE_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/design/references/phase-8g-hospitality-product-concept.png` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/domain/booking-state-machine.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/domain/business-invariants.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/domain/coupon-rules.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/domain/glossary.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/domain/payment-state-machine.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/domain/pricing-rules.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/admin-api-contract.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/admin-bootstrap-runbook.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/admin-catalog-architecture.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/architecture-map.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/auth-architecture.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/availability-architecture.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/ci-pipeline.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/database-architecture.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/database-schema.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/environment-contract.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/local-development.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/migration-runbook.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/payment-architecture.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/phase-1-validation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/phase-2-validation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/phase-3-validation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/phase-4-validation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/pricing-architecture.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/pricing-decision-matrix.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/quote-architecture.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/engineering/seed-data.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/backend-db-flow-capability-audit.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/cursor-inline-search-settings-and-flow.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/cursor-runtime-product-parity-final.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/cursor-ui-takeover-final.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/final-customer-ui-rebuild.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/final-delivery-master.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/final-local-demo-acceptance.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/final-product-flow-and-shadcn-rebuild.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/final-same-day-demo-closure.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-0-local-demo-baseline.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-1-browser-api-seams.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-2-customer-browser-vertical.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-3a-admin-authority-foundation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-3b1-catalog-archive-safety.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-5-demo-handoff.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-6-demo-release-candidate.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-7b-hardening-and-next-roadmap.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-7c-payment-core.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-7d-momo-sandbox-adapter.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-7f-google-customer-identity.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-7f-verdicts.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-7g-admin-booking-operations.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-7g-verdicts.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8a-production-readiness-audit.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8b-cheapest-pricing-recommendations.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8b-verdicts.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8b1-final-verdict.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8b1-pricing-product-vertical.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8b1-verdicts.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8c-payment-settlement-reconciliation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8c-verdicts.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8d-client-acceptance.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8d-verdicts.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8e-full-product-activation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8e-verdicts.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8f-live-provider-activation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8f-verdicts.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8i-client-acceptance.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/phase-8i-verdicts.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/handoffs/vertical-customer-flow-closure.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/integration/PEACENEST_CHATBOT_API_HANDOFF.docx` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/integration/peacenest-chatbot-openapi.sanitized.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/integration/peacenest-chatbot.environment.template.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/integration/peacenest-chatbot.postman_collection.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/openapi/admin-v1.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/openapi/operations-v1.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/openapi/public-v1.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/00_BASELINE.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/01_CUSTOMER_FEEDBACK_DECISIONS.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/02_DOMAIN_MODEL.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/03_STATE_MACHINES.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/04_RBAC_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/05_HOUSEKEEPING_SPEC.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/06_ACCESS_CONTROL_SPEC.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/07_MULTI_PROPERTY_SPEC.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/08_PRICING_OPTIMIZER_SPEC.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/09_UI_INFORMATION_ARCHITECTURE.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/10_API_CONTRACT_CHANGES.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/11_MIGRATION_PLAN.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/12_TEST_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/13_ROLLOUT_AND_ROLLBACK.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/14_IMPLEMENTATION_PLAN.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/15_RISK_REGISTER.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/operations-v3/16_MULTI_NIGHT_TRACE_AND_B0_SPEC.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/product/product-scope.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/product/user-journeys.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/product/user-roles.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/client-uat-data.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/google-oauth-local.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/local-full-feature-setup.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/momo-sandbox.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/phase-5-demo.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/phase-5.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/phase-6-local-demo.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/phase-7g-admin-operations-demo.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/phase-8b1-pricing-product-vertical.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/phase-8c-payment-reconciliation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/production-smtp.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/public-provider-callbacks.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/ssl-and-callback-setup.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/stable-sandbox-callback.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/runbooks/vnpay-sandbox.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/security/AUTH_RBAC_POLICY.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/security/threat-model.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/DEPENDENCY_SECURITY_TRIAGE.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/MASTER_COMPLETION_BACKLOG.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/MASTER_EXECUTION_PLAN.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/ORIGINAL_ACCEPTANCE_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/ORIGINAL_GOLDEN_FLOW_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/ORIGINAL_REQUIREMENTS_COMPLETION_PLAN.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/ORIGINAL_REQUIREMENTS_GAP_MATRIX.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/ORIGINAL_REQUIREMENTS_GAP_REPORT.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/PEACENEST_PRODUCTION_RELEASE_RECONCILIATION_PLAN.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/W6_MULTI_PROPERTY_IMPLEMENTATION_DESIGN.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/WAVE0_PRODUCTION_TRUTH.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/WAVE1_RELEASE_INTEGRITY_REPORT.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/stabilization/WAVE1_RELEASE_REHEARSAL.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-21-phase-3-secure-admin-catalog.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-22-phase-4-pricing-availability.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-22-phase-5-booking-hold-guest-access.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-25-phase-6-coupon-core.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-26-phase-7c-payment-core.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-26-phase-7d-momo-sandbox-adapter.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-26-phase-7e-dual-provider-payment-delivery.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-27-phase-7f-google-customer-identity.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-27-phase-7g-admin-booking-operations.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-27-phase-8b-cheapest-pricing-recommendations.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-28-phase-8b1-pricing-product-vertical.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-28-phase-8c-payment-settlement-reconciliation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-28-phase-8d-client-acceptance.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-29-phase-8e-full-product-activation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-29-phase-8g-hospitality-product-ui.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-29-phase-8h-client-operations-parity.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-29-phase-8i-client-uat-closure.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-07-30-final-customer-ui-rebuild.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-08-10-rm-504-dependency-security-closure.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-08-10-wave1-release-integrity.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-08-12-production-release-reconciliation.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-08-13-peacenest-admin-final-closure.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-08-13-peacenest-customer-v2.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/plans/2026-08-14-universal-free-time-pricing-composition.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-21-phase-3-secure-admin-catalog-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-22-phase-4-pricing-availability-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-22-phase-5-booking-hold-guest-access-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-25-phase-6-coupon-concurrency-hardening-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-25-phase-6-coupon-core-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-25-phase-6d-public-coupon-web-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-27-phase-7g-admin-booking-operations-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-27-phase-8b-cheapest-pricing-recommendations-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-28-phase-8b1-pricing-product-vertical-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-28-phase-8c-payment-settlement-reconciliation-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-28-phase-8d-client-acceptance-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-29-phase-8e-full-product-activation-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-29-phase-8g-hospitality-product-ui-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-29-phase-8h-client-operations-parity-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-30-final-customer-ui-rebuild-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-07-30-room-management-ui-ux-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-08-10-wave1-release-integrity-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/2026-08-13-peacenest-customer-v2-design.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/superpowers/specs/PHASE5-DESIGN-CORRECTIONS.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/uat/phase-8i-client-uat-checklist.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/docs/uat/phase-8i-client-uat-results.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/eslint.config.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/extract-policy.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/infrastructure/docker/README.md` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/scripts/bootstrap-admin.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/src/auth-factory.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/src/bootstrap.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/src/database-bootstrap.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/src/google-auth.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/src/index.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/src/permissions.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/test/auth-factory-security.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/test/bootstrap-credentials.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/test/bootstrap.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/test/google-auth.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/test/permissions.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/auth/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/eslint.config.js` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/arrival-access-crypto.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/booking-access-pass.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/booking-code.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/booking-code.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/cancellation-policy.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/cancellation-policy.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/challenge-ref.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/challenge-ref.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/contact.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/contact.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/coupon/coupon-calculator.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/coupon/coupon-code.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/coupon/coupon-errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/coupon/coupon-types.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/coupon/index.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/digest.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/digest.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/domain-labels.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/index.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/otp.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/otp.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/payment/adapter.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/payment/errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/payment/index.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/payment/payment-service.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/payment/reconciliation.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/payment/types.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/repository/availability.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/repository/booking-repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/repository/contact-repository.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/repository/coupon-reservation.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/services/create-booking-hold.retry.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/services/create-booking-hold.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/services/create-booking-hold.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/strings.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/src/strings.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/arrival-access-crypto.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/audit-phase8a/audit-payment-settlement.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/concurrency/concurrency-fixtures.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/concurrency/coupon-quota-race.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/concurrency/exclusion-rollback.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/concurrency/gate-b9-cross-provider-race.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/concurrency/last-room-race.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/concurrency/payment-event-race.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/concurrency/same-quote-different-contact.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/concurrency/same-quote-equivalent-contact.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/concurrency/stale-release-before-quota.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/concurrency/two-room-race.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/coupon/coupon-calculator.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/coupon/coupon-code.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/coupon/coupon-evaluation.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/coupon/coupon-redemption.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/coupon/coupon-stacking.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/fixtures/booking-hold-fixtures.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/payment/payment-creation.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/payment/payment-domain.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/payment/payment-settlement.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/payment/reconciliation-policy.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/test/payment/reconciliation.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/booking/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/config/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/config/src/index.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/config/test/environment.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/config/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/admin-booking-operations.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/admin-operational-reporting.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/admin-payment-reconciliation.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/admin-room-operations.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/admin.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/arrival-access-config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/booking/booking-detail.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/booking/booking-status.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/booking/hold.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/booking/index.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/booking/logout.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/booking/momo-payment.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/booking/otp-request.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/booking/otp-verify.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/booking/payment-providers.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/booking/payment-status.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/coupon.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/customer.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/index.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/pricing.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/src/public-room-catalog.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/admin-booking-coupon-delivery.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/admin-contracts.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/admin-payment-reconciliation-contracts.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/booking-authority-fields.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/booking-detail-cookie-auth.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/error-codes.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/hold-request-authority-fields.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/no-session-token-in-responses.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/no-todo-skip-markers.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/openapi-admin-routes.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/openapi-public-routes.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/openapi-reproducibility.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/openapi-unique-operation-ids.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/otp-schema-match.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/pricing-contracts.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/quote-booking-price-contract.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/test/source-test-discovery.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/contracts/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0000_silly_jocasta.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0001_custom_invariants.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0002_tiny_ultragirl.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0003_gorgeous_punisher.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0004_natural_paper_doll.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0005_ambiguous_blazing_skull.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0006_phase5_custom_invariants.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0007_phase6_coupon_core.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0008_phase6_coupon_invariants.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0009_swift_polaris.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0010_phase6_coupon_reference_closure.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0011_phase7b_data_driven_pricing.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0012_many_kylun.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0013_sad_mathemanic.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0014_phase7f_google_customer_identity.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0015_phase7g_admin_booking_operations.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0016_workable_captain_cross.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0017_optimal_freak.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0018_phase8c_schema_metadata_repair.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0019_phase8d_coupon_delivery.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0020_panoramic_mantis.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0021_customer_ready_operations.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0022_booking_access_pass.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0023_clumsy_karma.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0024_nappy_rage.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0025_chief_proemial_gods.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0026_outstanding_mimic.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0027_superb_sumo.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0028_admin_v2_membership_bootstrap.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0029_operations_v3_pricing_policy_release.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0030_good_malcolm_colcord.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0031_cool_mandarin.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0032_soft_wraith.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0033_curious_brother_voodoo.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0034_admin_property_memberships.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0035_add_operational_profiles.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0036_physical_room_notes.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0037_maintenance_profiles.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0038_young_rachel_grey.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0039_customer_v2_confirmation_delivery.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/0040_colossal_human_torch.sql` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0000_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0001_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0002_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0003_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0004_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0005_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0006_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0007_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0008_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0009_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0010_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0011_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0012_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0013_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0014_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0015_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0016_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0017_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0018_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0019_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0020_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0021_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0022_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0023_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0024_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0025_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0026_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0027_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0028_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0029_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0030_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0031_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0032_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0033_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0034_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0035_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0036_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0037_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0038_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0039_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/0040_snapshot.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/meta/_journal.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/drizzle/migration-provenance.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/eslint.config.js` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/scripts/check-migration-identity.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/scripts/demo-lifecycle.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/scripts/demo-seed.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/scripts/import-client-rooms.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/scripts/migrate.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/scripts/seed-development.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/scripts/status.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/src/client-room-import.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/src/client.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/src/errors.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/src/index.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/src/migrations.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/src/schema-status.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/src/schema.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/src/seed-development.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/src/testing.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/audit-outbox.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/booking-constraints.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/catalog-ownership.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/client-room-import.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/helpers.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/historical-migration-identity.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/inventory-overlap.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/migration-0034-admin-property-memberships.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/migration-0038-staff-manager.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/migration-folder.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/migration-readiness.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase5-migration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase5-schema-integrity.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase6-coupon-concurrency-hardening.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase6-coupon-first-reference-races-concurrent.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase6-coupon-first-reference-races.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase6-coupon-service-disable-vs-hold-race.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase6-migration-0010-catalog.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase7c-payment-schema.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase8b1-migration-0016-upgrade.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase8c-payment-reconciliation.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/phase8d-migration-0019-upgrade.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/pricing-policy-migration-upgrade.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/pricing-policy-release-migration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/pricing.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/quote-schema.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/seed-development.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/snapshot-lineage.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/integration/test-database-cleanup.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/unit/admin-v2-migration.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/unit/client-room-import.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/unit/payment-provider-settings-schema.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/unit/seed-url-guard.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/unit/source-test-discovery.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/test/unit/test-database-guard.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/database/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/eslint-config/base.js` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/eslint-config/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/observability/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/observability/src/index.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/observability/test/logger.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/observability/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/typescript-config/base.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/typescript-config/nestjs.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/typescript-config/nextjs.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/typescript-config/node.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/packages/typescript-config/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/playwright.b0.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/playwright.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/playwright.public-release.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/playwright.rehearse.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/playwright.unavailable.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/playwright.verify.config.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/pnpm-lock.yaml` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/pnpm-workspace.yaml` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/prettier.config.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/production-policy-extract.txt` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/release-source.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/check-endpoints.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/check-features.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/check-gitleaks-fixtures.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/check-google-oauth-config.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/check-i18n-critical.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/check-openapi-structure.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/check-providers.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/check-providers.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/command-executable.d.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/command-executable.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/database/refresh-migration-provenance.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/demo-constants.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/eslint.config.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/lifecycle-test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/lifecycle.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/payment-canary-fixtures.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/payment-canary-fixtures.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/payment.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/preflight.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/protected-port-state.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/protected-port-state.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/rehearse.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/runner-safety.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/runner-safety.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/self-contained-smoke.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/smoke.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/start-local.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/start.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/stop.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/demo/verify.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/backup-postgres.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/preflight.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/restore-disposable-postgres.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/status.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/validate-production-environment.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/validate-public-build-config.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/validate-public-build-config.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/verify-production-runtime.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/verify-public-assets.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/verify-public-assets.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/web-public-assets.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/write-runtime-package-manifests.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/deploy/write-runtime-package-manifests.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/endpoint-inventory.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/endpoint-inventory.test.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/fix-protected-imports.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/generate-openapi.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/generate-operations-openapi.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/generate-public-openapi.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/load/public-read-k6.js` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/package-demo.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/package-demo.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/playwright-runtime.d.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/playwright-runtime.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/playwright-runtime.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/attest-release.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/backup-evidence.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/capture-recovery-baseline.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/check-release-topology.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/create-backup-evidence.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/deploy-release.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/generate-release-manifest.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/attestation.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/canonical.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/docker-snapshot.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/environment.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/manifest.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/migrations.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/production-policy.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/production-recovery.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/production-runtime.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/release-state.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/lib/topology.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/materialize-release-from-git.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/materialize-release-from-git.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/production-dependency-closure.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/production-policy.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/production-recovery-rehearsal.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/production-recovery.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/production-release-cli.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/production-release-state.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/production-rollback.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/production-runtime.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/recovery-baseline.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/rehearse-compose-workload.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/rehearse-production-recovery.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/rehearse-release.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/release-attestation.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/release-cli.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/release-environment.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/release-manifest.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/release-rehearsal.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/release-state.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/release-topology.test.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/render-service-environments.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/rollback-release.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/run-tests.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/validate-release-environment.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/release/verify-release-manifest.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/run-playwright.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/run-provider-live-acceptance.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/run-tests.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/validate-admin-coupon-schema.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/verify-peace-home-media.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/scripts/with-local-env.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/source.tar` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/source2.tar` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/_fixtures/booking-otp.d.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/_fixtures/booking-otp.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/_fixtures/payment-provider-simulator.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/_fixtures/payment-redirect-helper.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/_fixtures/payment-test-helpers.d.mts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/_fixtures/payment-test-helpers.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-amenity.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-auth.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-booking-date-filter.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-catalog.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-coupon.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-credentials.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-edit-flows.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-maintenance.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-price-tier.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-property.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-rate-plan.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-room-type.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-room.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-v2-responsive.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-v2-visual-acceptance.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/admin-v3-authenticated-qa.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/api-unavailable.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/availability-quote.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/contracts-runtime-resolution.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/customer-identity-browser.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/customer-identity.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/final-demo-screenshots.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/final-local-demo-acceptance.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/foundation.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/landing-nearby-journey.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/multi-night-b0.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/one-step-payment-qr.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/operations-v3-golden-flow.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/payment-gate-b11-b12.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/payment-provider-operations.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-3a-admin-server-gate.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-7g-admin-booking-operations.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-8b1-admin-rate-plan.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-8b1-stay-time-recommendations.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-8d-coupon-delivery.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-8d2-localization.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-8d3-public-entry.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-8h-reporting.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-8h-room-operations.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-8h-visual-evidence.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase-8i-visual-uat.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase1-browser-api-seams.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase2-1-a11y-browser.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase2-1-strict-responsive-overflow.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase2-customer-browser-vertical.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/phase6d-public-coupon.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/public-booking-vertical-flow.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/public-release.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/public-room-catalog.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/public-search-helpers.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/room-status-viewer.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/verify-admin-contract.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/verify-admin-pages.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/verify-enable-providers.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/verify-login-flow.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/verify-screenshots.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/e2e/worker-oneshot.spec.ts` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/eslint.config.mjs` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/package.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tests/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/tsconfig.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `.release-candidate-b42ab08a/turbo.json` | `HISTORICAL_RELEASE_CANDIDATE` | PRESERVE for forensics; never execute or stage as current release source. |
| `0030_b0_bootstrap_template.sql` | `SEMANTIC_CANDIDATE_OWNER_REVIEW` | PRESERVE pending owner review; do not stage, delete, or execute. |
| `0030_b0_production_bootstrap.sql` | `SEMANTIC_CANDIDATE_OWNER_REVIEW` | PRESERVE pending owner review; do not stage, delete, or execute. |
| `AUTH_BLOCKER_RESOLUTION.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_POST_REMEDIATION_RECONCILIATION_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_PRODUCTION_RECONCILIATION_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE2_COMPLETION_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE3_EXECUTION_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE3_FINAL_CLOSURE_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE3_RUNTIME_ACTIVATION_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE4_P1_PRODUCTION_REMEDIATION_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE4_P1_REMEDIATION_CANDIDATE_CLOSURE.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE4_P1_REMEDIATION_COMPLETION_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE4_P1_ROOT_CAUSE_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE4_PUBLIC_MULTI_NIGHT_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE4_ROLLBACK_DEFECT_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `B0_STAGE4_SSH_BLOCKER.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `Caddyfile-correct` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `Caddyfile-fixed` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `HOUSEKEEPING_HANDOFF_FINAL_REPORT.md` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `HOUSEKEEPING_PRODUCTION_DEPLOYMENT_FINAL_REPORT.md` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `HOUSEKEEPING_PRODUCTION_DEPLOYMENT_FINAL_REPORT_V2.md` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `HOUSEKEEPING_PRODUCTION_REPAIR_PLAN.md` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `OPERATIONS_V3_COMPLETION_REPORT.md` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `OPERATIONS_V3_MATRIX_RECONCILIATION.md` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `PEACENEST_FULL_SYSTEM_AUDIT_REPORT.md` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `PEACENEST_FULL_SYSTEM_AUDIT_SUMMARY.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `PEACENEST_REMEDIATION_PLAN.md` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `RELEASE_ATTESTATION_2026-08-15.md` | `INVALID_HISTORICAL_EVIDENCE` | PRESERVE as untrusted historical material; it cannot establish current attestation. |
| `STAGE1_ACCEPTANCE_CLOSURE.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `STAGE2.5_CONFORMANCE_AUDIT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `STAGE3_PREFLIGHT_REPORT.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `STAGE3_PREFLIGHT_SUMMARY.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `_bmad-output/implementation-artifacts/spec-final-release-closure-security-transfer-cleanup-handoff.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/_config/bmad-help.csv` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/_config/files-manifest.csv` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/_config/manifest.yaml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/_config/skill-manifest.csv` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/bmm/config.yaml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/bmm/module-help.csv` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/bmm/v6-shims/README.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/config.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/config.user.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/core/config.yaml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/core/module-help.csv` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/core/v6-shims/README.md` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/custom/.gitignore` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/custom/config.toml` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/render/.gitignore` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/scripts/config_utils.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/scripts/memlog.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/scripts/render_skill.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/scripts/resolve_config.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `_bmad/scripts/resolve_customization.py` | `BMAD_GENERATED` | PRESERVE; do not stage or package without an explicit project decision. |
| `audit-confirmation-backlog.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `audit-otp-backlog.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-reconciliation-check.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-reconciliation-queries-v2.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-reconciliation-queries.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-reconciliation.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage2-bootstrap-direct.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage2-bootstrap.ts` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-auto-bootstrap.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-bootstrap-policy.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-bootstrap-simple.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-disable-gate.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-disable-gate.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-find-v1.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-integrated-bootstrap.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-operator-auth.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-publish-v2.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-supersede-v1.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-trigger-policy.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-validate-preview.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-validate-v2.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-verify-supersession.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-verify-v4-simple.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-stage4-verify-v4.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-verify-admin-session.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `b0-verify-existing-session.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `backup-prod.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `baseline-home.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `build-release.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `canary-snapshot.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `canary2-after.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `canary2-snapshot.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `check-all-pending-events.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-booking-contact.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-booking-correct.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-booking-email.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-booking-final.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-booking-for-otp.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-booking-full.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-booking-simple.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-db-schema.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-digest.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-eligible-bookings.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-gates.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-latest-otp.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-migration-state.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-migration-tail.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-migrations.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-otp-challenges.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-outbox-schema.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-outbox-status-values.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-outbox-summary.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-outbox.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-payment-providers.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-policy-counts.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-policy-tables.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-prices.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-pricing-policy-tables.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-pricing-policy.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-pricing-policy.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-pricing-tables.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-prod-db.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-prod-policy-counts.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-prod-policy.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-prod-state.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-production-prices-v2.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-production-prices-v3.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-production-prices.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-production.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-recent-errors-fixed.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-recent-errors.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-room-number-normalization.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-room-status-enum.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-supersession-state.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-tier-columns.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `check-v1-components.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `compute-email-digest.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `compute-source-fingerprint.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `copy-envs.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `count-contacts.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `create-huyle-booking.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `create-release-dir.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `create-synthetic-booking.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `create-synthetic-otp-test-booking.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `current-Caddyfile.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `deploy-1800906-wrapper.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-1800906.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-6075e37.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-620f51f-v2-wrapper.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-620f51f-v2.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-620f51f.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-b1a9e2c-wrapper.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-b1a9e2c.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-c7aa4f6-wrapper.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-c7aa4f6.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-e087bce.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `deploy-release.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `describe-booking-contacts.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `describe-bookings.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `describe-outbox.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `docs/customer-v2/CUSTOMER_ROUTE_MATRIX.md` | `SEMANTIC_CANDIDATE_OWNER_REVIEW` | PRESERVE pending owner review; do not stage, delete, or execute. |
| `docs/operations-v3.zip` | `ARCHIVE_OR_EXPORT_OWNER_REVIEW` | PRESERVE pending retention decision; never use as release source. |
| `e087bce.tar` | `ARCHIVE_OR_EXPORT_OWNER_REVIEW` | PRESERVE pending retention decision; never use as release source. |
| `execute-stage2-bootstrap-production.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `execute-stage2-bootstrap.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `final-outbox-state.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `final-verification.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `final-verify.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `find-access-tables.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `find-huyle-bookings.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `find-operator-otp-test-booking.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `fix-pg-pwd.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `generate-bootstrap-sql.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `get-admin-user.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `get-all-bootstrap-prices.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `get-plans-for-bootstrap.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `get-property-details.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `get-property-for-bootstrap.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `get-test-property-room.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `get-v1-bootstrap-source.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `get-v4-prices.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `initiate-payment-huyle.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `investigate-extra-rooms.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `list-rate-plans.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `list-tables.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `otp-request-huyle.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `otp-verify-huyle.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `package-release.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `pre-deploy-audit.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `prod-verify-v1.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `production-data-repair-revised.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `production-data-repair.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `production-policy-data.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `query-prod.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `query.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `rebuild-correct-sha.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `rebuild-fixed.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `reconstruct-policy.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `release-6075e37.tar.gz` | `ARCHIVE_OR_EXPORT_OWNER_REVIEW` | PRESERVE pending retention decision; never use as release source. |
| `release-88ece32.tar` | `ARCHIVE_OR_EXPORT_OWNER_REVIEW` | PRESERVE pending retention decision; never use as release source. |
| `repro-build-contracts.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `repro-full-build.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `repro-install.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `repro-manifest.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `repro-prod-install.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `restart-services.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `room-codes-rooms.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `scripts/deploy/check-compose-env.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/check-compose-env2.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/check-compose-env3.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/check-migrate.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/check-pg.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/check-svcenv.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/commit-changes.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/commit-flake-fix.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/grep-log.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/prod-housekeeping.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/prod-identity.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/show-compose.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/stage-changes.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/stage-changes.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/deploy/test-sed.ps1` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `scripts/release/classify-untracked-worktree.mjs` | `UNREVIEWED_PRESERVE_OWNER_REVIEW` | PRESERVE pending owner classification; no staging, deletion, or execution. |
| `stage1-acceptance.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `stage2.5-comparison-matrix.txt` | `HISTORICAL_REPORT_OWNER_REVIEW` | PRESERVE pending owner review; do not promote to current evidence. |
| `stage3-preflight.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-api-health.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-availability.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-bootstrap-short.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-dark-multi-night.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-dark-multi-night.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-hourly-request.json` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-momo-reachability.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-otp-correct-path.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-otp-request.js` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-otp-retry.mjs` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-overnight-availability.json` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `test-public-availability.json` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `tests/e2e/operations-v3-admin-responsive-a11y.spec.ts` | `SEMANTIC_CANDIDATE_OWNER_REVIEW` | PRESERVE pending owner review; do not stage, delete, or execute. |
| `tests/e2e/stage3-auth-integration.spec.ts` | `SEMANTIC_CANDIDATE_OWNER_REVIEW` | PRESERVE pending owner review; do not stage, delete, or execute. |
| `update-and-check.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `update-digest.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `update-email-digest.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `v1-acceptance.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `verify-bootstrap.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `verify-confirmation-delivery.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `verify-db-state.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `verify-deployment.sh` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `verify-no-new-data.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `verify-no-stale-otp.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `verify-policy-state.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `verify-price-mapping.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `verify-synthetic-booking.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |
| `verify-worker-validation.sql` | `ROOT_OR_DEPLOY_HELPER_OWNER_REVIEW` | PRESERVE pending exact-path owner classification; never execute as governed tooling. |

## Safety boundary

- Unknown and semantic paths remain preserved until an owner makes an exact-path decision.
- Do not run root `b0-*`, `check-*`, `deploy-*.sh`, `verify-*`, stage/repro/bootstrap helpers, historical archives, or any path listed above as production tooling.
- A candidate approved for source must be reviewed, tested, and committed before release materialization. A disposable path may be removed only after its absolute target and owner approval are recorded separately.
