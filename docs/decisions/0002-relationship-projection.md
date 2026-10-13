# 0002: Evidence-backed relationship queries

Implemented on `codex/relationships` for PR review, 2026-10-13.

The approved graph design needs a relationship model before layout and rendering.
`RelationshipStore` exposes three operations over immutable `CaseStore` data:
`identities`, `graph`, and `connection_events`. The CLI uses the same interface that
the future HTTP adapter will use. No new dependency or persisted case schema is needed.

## Identity and session resolution

| Recorded information | Projection |
| --- | --- |
| Actor ARN | Identity keyed by account and full ARN. Display names never establish identity. |
| AssumedRole with a compatible recorded IAM role issuer | Group under that issuer by default; expose individual sessions on request. |
| AssumedRole without a compatible issuer | Separate session; do not reconstruct the issuer from its name. |
| Session accessKeyId | Use a hashed credential discriminator together with its actor locator/account. Never include the credential value in node metadata. |
| No accessKeyId, recorded session creationDate | Use the recorded creation value as a weaker discriminator; expose `resolution: creation_time`. |
| Neither session discriminator | Keep each unique event's session separate; expose `resolution: event_scoped`. |
| ARN absent, principalId and account present | Account/type/principal locator. |
| AWSService with invokedBy | Account/type/invokedBy locator; recipient account is a fallback. |
| Identity Center onBehalfOf userId and identityStoreArn | Store/user locator, additionally scoped by recorded account/type. |
| Root or AWSAccount with account but no other locator | Account/type locator. |
| No usable locator | Event-scoped unresolved actor; matching names do not merge it. |

Issuer grouping requires compatible partition/account, an STS assumed-role actor ARN,
and an IAM role issuer ARN. These are conservative wrapper choices based on the
recorded identity fields. AWS documents sessionIssuer, optional accessKeyId,
session creationDate, invokedBy and onBehalfOf in the
[CloudTrail identity reference](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-user-identity.html).

Resolution is local to each event. An issuer present on one record does not enrich
other records automatically. Creation time is not guaranteed to uniquely identify a
credential. Known discriminator counts appear as `session_count`; events lacking a
session discriminator appear as `unresolved_session_event_count`. These counts do
not assert that event-scoped records represent distinct real sessions.

## Connections and targets

Connections aggregate distinct event keys by source, target, relationship kind,
AWS service, action and reported outcome. An IP-to-actor connection means that the
log records that source address. It does not establish who owns the IP, shared
identity, causation or compromise. Non-IP source values remain in raw evidence.

Targets come from recorded resource ARNs, plus the explicit request roleArn on STS
AssumeRole variants. Duplicate target ARNs on one record produce one connection.
Resources do not become observed actors just because they are targets. CloudTrail's
[record reference](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-record-contents.html)
describes optional resources; the
[AssumeRole API reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html)
defines the requested role ARN.

When no supported explicit target exists, use a service node scoped by recipient
account and region, with `target_unspecified: true`. Do not extract targets from
error text, arbitrary request fields, or response objects. Linking an AssumeRole
response to later session activity is deferred.

Reported errors retain `failed`; an absent error retains `no_error_reported`.
Neither means a mutation or privilege transition was proven. Counts use unique
case events, never source occurrences or detection matches. One event can support
several connections, so summing connection counts is not a case activity total.

## Query contract and limits

- Graph output has `schema_version: 1`, case/scope metadata, selected event count,
  scanned event count, nodes and connections. Nodes and connections include event
  counts and first/last UTC timestamps. Scope bounds require timezones and use
  inclusive start, exclusive end, matching case event queries.
- IDs are opaque hashes of locators, independent of input order and time bounds.
  They remain stable within projection version 1, including across identical cases.
  Layout and persisted investigation state are outside this module.
- Identity focus includes only that actor's events. Selecting an issuer can include
  its recorded sessions, including when expanded. A shared IP does not pull in peers.
- Identity search covers label, locator and account. Identity and connection-event
  pages are limited to 1..500 entries, default 100, with nonnegative offsets.
- Connection-event pages return event keys and summaries. `CaseStore.evidence`
  supplies original normalized contents and every source occurrence. A connection
  absent from the selected scope raises an error so adapters can show stale evidence.
- Each query scans at most 100,000 unique events in the time window. Graph output
  permits at most 500 nodes and 1,500 connections. Exceeding a budget fails explicitly;
  it never returns an apparently complete truncated graph. These defaults are
  provisional guardrails, not measured browser capacity.
- Projection is recomputed per query. Identity/evidence pages bound response size,
  not the amount of projection work. Node/connection limits are checked after the
  scan and are output limits, not strict memory limits. Large individual records
  and dense resource lists remain an import/processing concern. Caching, indexes,
  background jobs and cancellation need measured workloads before implementation.

## Deferred work

This increment supplies backend graph data and CLI queries. It does not supply HTTP,
graph rendering, service-group expansion, resource pivots, a subgraph window,
detection focus or performance evidence. The next increment is a narrow local HTTP
adapter and Events inspector, followed by graph interactions from the approved design.
