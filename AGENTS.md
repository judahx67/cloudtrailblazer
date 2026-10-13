# Cloudtrailblazer agent anchor

Read this file before working on the project. These instructions apply to the wrapper
repository; `upstream/suzaku/` is a separate, unmodified dependency checkout.

## Start here

1. Read `docs/project-state.md` for the current milestone, verification and next work.
2. Read `README.md` for setup and the relevant files in `docs/decisions/` for accepted decisions.
3. Consult `docs/project-shape.md` for broader direction. Its proposed features and
   candidate technologies are not evidence that those features exist or are settled.
4. Check Git status and inspect the relevant implementation before changing anything.
   Preserve unrelated work. The user's latest instructions take precedence over this file.

## Product philosophy

Build a local-first web investigation workbench around Suzaku, beginning with AWS
CloudTrail. Suzaku handles detections; the wrapper owns cases, relationships and the
investigation experience. This is a sustained project: favor deliberate, reviewable
increments with fully described behavior over rushing to a broad demo.

The graph prioritizes relationships and legibility. It may group activity and omit
visual detail for aesthetics, while preserving the evidence and meaning behind it.
Every displayed connection must lead to its supporting events. Failed calls remain
attempts; shared IPs do not establish shared identity; event order does not establish
causation. Missing information must not become invented relationships.

## Design philosophy

- Aim for a terminal-like workbench: simple lines, flat matte surfaces, muted pastel
  accents, compact typography and square controls.
- No decorative gradients, rounded card collections, shadows, floating elements or
  ornamental animation. Panning and zooming should respond directly to input.
- Use concise labels and counts. Put secondary explanations in hover/focus tooltips
  or the selected-item inspector. Essential state and errors stay visible.
- Controls must serve an investigation task. Avoid generic dashboard decoration.
- Ground new UI elements in the user's stated constraints, actual workflows and
  reviewed examples. Do not invent a visual direction from agent intuition.
- Before a new screen, describe its task, information hierarchy, controls and states.
  Implement within the established direction; bring a substantial design departure
  to the user with a concrete sketch or comparison.
- Use color consistently and pair it with labels, markers or outlines. Support
  keyboard focus and access to information otherwise revealed by hover.

## Engineering approach

- Work in small milestones. State the intended outcome and acceptance criteria;
  complete the authorized scope and report its result before expanding it.
- Flesh out semantics before implementation: inputs, outputs, identities, aggregation,
  missing data, failures and the path back to evidence.
- Keep case storage, detection jobs and relationship projection behind small module
  interfaces. CLI and eventual HTTP/UI adapters should use those interfaces.
- Preserve source bytes, hashes and occurrence provenance. Deduplicate full event
  content, never CloudTrail eventID alone; retain conflicting records separately.
- Keep raw events separate from findings. Multiple rule matches must not inflate
  activity counts. Treat correlations separately from ordinary event findings.
- Keep processing local by default and browser payloads bounded. Measure import,
  query, layout and rendering costs separately before making performance claims.
- Do not modify upstream, silently update its pinned revision, or execute rule updates
  as a side effect of unrelated work. Record engine/rules versions when jobs exist.
- Use locked dependencies. Add libraries for a demonstrated need, not hypothetical
  future features. Record consequential architecture decisions in `docs/decisions/`.
- Test meaningful behavior at module interfaces, especially evidence preservation,
  identity ambiguity, failures and aggregation. Match verification to the change;
  documentation-only changes need document/diff checks, not an unnecessary test rerun.
- For code changes, run relevant tests during development and the complete suite,
  lint and formatting checks before reporting completion. Report skips and limits.
- Keep case data, caches and local environments out of Git. Save completed milestones
  as local commits; do not push or publish unless the user requests it.

## Reporting to the project manager / technical lead

Report after each completed step or milestone. During longer work, give concise updates
when a material finding, blocker or change of direction appears. Write for someone
deciding project direction: lead with the outcome and its significance, not a tool log.

Each completion report must cover:

- **Current state:** what the project can do now and the milestone's completion status.
- **Added or changed:** concrete capabilities/artifacts and why they matter; include
  useful file links and the checkpoint commit when available.
- **Validation:** what was checked, results, and anything unverified or skipped.
- **Open items:** material limitations, risks or decisions still needed. Distinguish
  known issues from planned work; say when there are no new blockers.
- **Next step:** one recommended increment and any decision the user actually needs
  to make. Do not request approval for routine choices already within scope.

Use compact paragraphs or a short list; avoid unnecessary implementation detail.
Distinguish implemented behavior, accepted decisions and proposals. Never imply that
tests prove large-data performance or that a backend milestone includes a working UI.

## Keep the anchor current

Update `docs/project-state.md` after every completed milestone or material scope change.
Include the current capabilities, latest validation, limitations and next increment.
Maintain its short milestone history so a new agent can see how the project arrived
here. Record implementation checkpoints there; the current documentation commit does
not need to refer to its own hash.

Keep enduring principles in this file, accepted decisions in `docs/decisions/`, setup
in `README.md`, and changing progress in `docs/project-state.md`. Update these documents
when behavior or direction changes. Do not leave contradictory project guidance behind.
