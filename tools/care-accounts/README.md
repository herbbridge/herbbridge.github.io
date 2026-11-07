# HerbBridge backend foundation

Status: the Singapore development database has five verified migrations, including
account registration and private room operations. The working account UI is in
`app/`. The public review release is being prepared; publication is tracked in
`../chatgpt update/PROGRESS.md`. This is for fictional data only. Real two-account
verification, independent-session race tests and production readiness remain open.

Canonical workspace source is this `05_Backend` folder. `tools/prepare-review.mjs`
exports an explicit public allowlist to the existing app repository: built assets
in `accounts/` and a source snapshot in `tools/care-accounts/`. Environment files,
credentials and private records are excluded. Only the publishable browser key
is included in the bundle. Use the canonical workspace to prepare releases.

## Contents

- `supabase/migrations/`: five ordered migrations: core schema/access rules,
  existing public medicine identifiers, tool/verification integrity rules, registration and care-room operations.
- `supabase/config.toml`: local development definition; only `public` is exposed.
- `client.mjs`: read-only adapter for the future development account UI. It is
  not yet loaded by the site or the design prototype.
- `.env.example`: development connection placeholders; no actual credentials.
- `tools/check-connection.mjs`: read-only hosted public-catalogue readiness check.
- `tests/`: isolated PostgreSQL/RLS tests and read-adapter tests.

## Local verification

Use Node 22 or newer:

```sh
npm ci --ignore-scripts
npm test
npm run catalog:check
```

`npm test` uses pinned PGlite, executing migrations, roles, grants, policies,
constraints and triggers in an ephemeral PostgreSQL engine. The minimal
`auth.users` and `auth.uid()` test shims are isolated to the test file and must
**never** be applied to Supabase. Fixtures are entirely fictional. No Docker,
hosted database or actual Auth session is required for these tests.

The local checks do not validate Supabase Auth, email, REST/Realtime integration,
provider defaults, independent-session races or production deployment. Those
checks are required after connecting the hosted development project.

## Data model

| Table | Purpose | Client access in this foundation |
|---|---|---|
| profiles | Protected account role and display name | Own profile and connected care counterpart |
| practitioner_accounts | Category and pending/approved/suspended status | Own account and connected counterpart; no self-approval |
| care_rooms | One room per patient; current list version | Owner or approved active member |
| room_memberships | View/edit grant, patient consent, active/revoked state | Owner; approved active practitioner sees own membership |
| medicine_catalog | 35 IDs/names copied from existing public app | Public read; not private or clinical ratings |
| room_medicines | Selected, catalogue-validated items | Room readers |
| medicine_list_versions | Authored snapshots for future versioned saves | Room readers |
| room_events | Authored room history | Room readers |
| room_consents | Access decisions and notice version | Patient or relevant practitioner while authorised |
| patient_tools | Proposed/accepted reminders or checklist settings | Room readers |
| tool_completions | One completion per tool/calendar date | Room readers |
| private practitioner_applications | Registration-reference details | No direct client access |
| private connection_invitations | SHA-256 token hashes and lifecycle fields | No direct client access |
| private verification_events | Operational approval-status history | No direct client access |

All 14 tables have row-level security. Client writes and all anonymous private
reads are denied. Two identity-bound private helpers support read policies;
trigger helpers cannot be executed by API clients. Internal verification
operators receive no automatic patient-room access through these policies.

No client write endpoints exist yet. Step 4 adds confirmed-user enrolment, Step 5
room provisioning, Step 6 invitation/consent endpoints, Steps 7–8 versioned saves
and history. Each must use the caller's actual Auth identity, validate inputs and
write records/history in one transaction. Never expose a privileged key to the UI.

Capacity triggers lock participant profile rows before counting active connections,
reject a fourth practitioner or twenty-first patient, require approved clinicians
and the actual patient's consent ID, and reject duplicate/reassigned membership
identities. Independent-session race tests remain required on hosted PostgreSQL.
Pending invitations are separate records and do not consume capacity.

Tool integrity requires an approved connected editor to propose/configure a tool,
actual patient identity for acceptance and fresh acceptance after settings change.
Revocation/suspension withdraw active/pending tools. SQL checks alone do not send
notifications; a scheduler, notification permission/delivery, endpoint actor checks
and notification-specific history/retry behaviour remain later implementation.
No clinical dose or prescription field is defined.

## Hosted development connection — remaining work

1. Add and connect Supabase in this chat. Select the owning account/organisation,
   region and free-plan development project before any provisioning. Supabase in
   Singapore (ap-southeast-1), free development tier under Ayden’s account, is now
   approved. Hong Kong is a performance target; physical Hong Kong hosting is
   not required. The integration is installed but its database tools are unavailable
   in this chat; dashboard sign-in is pending.
2. Create a **new, dedicated** development project. Keep the live project separate;
   live project creation/region/billing remain unconfigured. Do not reuse the
   public production app's environment for fixtures or database resets.
3. Apply these migrations in filename order and check provider security advice.
   With an authenticated CLI, link the confirmed development project and inspect
   `supabase db push --dry-run` before applying. No CLI is installed/configured by
   this work; a connected Supabase tool can also apply ordered migrations.
4. Configure email confirmation, exact development redirect URLs and operator
   access. Production URLs, mail provider and sign-in UI are handled later.
5. Copy `.env.example` to ignored `.env.local`. Enter only the development URL,
   public publishable key and expected development project reference. Manage
   passwords, private tokens and secret/service-role keys through the provider or
   a protected credential store, never these docs, frontend files or chat.
6. Run `node --env-file=.env.local tools/check-connection.mjs`. This verifies a
   public catalogue response only. Then validate the same permissions through
   real Auth sessions and the Data API before marking Step 3 complete.
7. Connect the development UI and finish the separate live-environment setup.
   Do not publish the account UI until the relevant implementation checks pass.

Do not run a reset or apply these initial migrations against an existing database
with unknown contents. They deliberately fail on conflicting existing objects.

## Public catalogue changes

`node tools/catalog.mjs` regenerates the catalogue migration from the app's
`data/herbs.json` and `data/drugs.json`. `npm run catalog:check` detects drift.
Once applied to a shared environment, keep migrations immutable: record subsequent
catalogue changes in a new migration and update the generator/check accordingly.
No patient fixtures or demonstration accounts are included in deployable migrations.

## References

The schema uses Supabase's documented [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [function hardening](https://supabase.com/docs/guides/database/functions).
Keep environments separate following [Supabase environment guidance](https://supabase.com/docs/guides/deployment/managing-environments).
Local testing uses [PGlite](https://pglite.dev/docs/); it is not the hosted runtime.

## Current hosted state — 7 November 2026

The historical preparation instructions above are superseded for development:
`herbbridge-dev` is created on the Free plan in Singapore, project reference
`ugmmxboczyblmzxmfrni`, in organisation `herbbridge`.

All three migrations are applied, with matching SHA-256 hashes registered in
`supabase_migrations.schema_migrations`. The SQL editor was used because the
installed integration's database tools were unavailable. Migration metadata was
registered only after successful application and verification; it does not
re-execute migrations. Do not reapply initial files or regenerate applied SQL.

- `deployments/development.json` records actual development state and hashes.
- `tools/verify-hosted.sql` passed **32/32 checks** on hosted PostgreSQL. It uses a
  fixture subtransaction which deliberately rolls back, then checks no fixture
  users/profiles/rooms remain. It does not validate signed JWTs or REST sessions.
- `tools/smoke-api.mjs` passed **13/13 anonymous REST/CORS checks** with the public
  key. Run with `node --env-file=.env.local tools/smoke-api.mjs`.
- `.env.local` contains the development URL/public publishable key only, with
  owner-only permissions. No privileged key or database password is stored.
- Hosted Auth Site URL: `http://127.0.0.1:8012/`. Email confirmation is enabled,
  anonymous sign-ins disabled. No wildcard redirects or public-site callbacks.

A real account UI, actual Auth/email journeys, subscriptions, independent-session
race tests and a separate live database are still outstanding. The public website
and page-memory design prototype do not yet use this database.

Sources for migration tracking: [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)
and the [CLI migration table definition](https://pkg.go.dev/github.com/supabase/cli/pkg/migration).

## Actual account app — 7 November 2026

`npm run dev` builds/serves the real development account UI at 127.0.0.1:8012.
Run from this folder with `.env.local` configured; use this custom server rather
than exposing the backend directory with a generic file server. `npm run build`
rebuilds the three served assets without starting a second server.

Source is in `app/`; official Supabase JS handles Auth/PKCE. Session tokens stay
in sessionStorage and only PKCE state/preferences use localStorage. No room data
or passwords are cached. Browser password creation/submission remains user-owned.

The fourth migration adds confirmed, identity-bound one-time enrolment; it is
applied and recorded with matching source hashes. Practitioners start pending;
no room is automatically created yet. See ../chatgpt update/STEP-04-ACCOUNTS.md
for scope, evidence and remaining real-email/account verification. Automated
browser tests mock all Auth traffic and must not be described as live Auth tests.


## Independent-connection checks — 7 November 2026

`tools/check-concurrency.mjs` runs seven deterministic races using separate real
PostgreSQL connections against the same migrations. It checks a stale save,
patient capacity, practitioner capacity, single-use invitation consumption,
disconnection, editing downgrade and suspension while a save is waiting. Result:
21/21 checks passed on local PostgreSQL 17.11. Hosted-session race verification
and the real patient/practitioner browser journey remain separate checks.

The runtime is optional and installed outside the application. To reproduce:

```sh
npm install --prefix /private/tmp/herbbridge-pg-test --save-exact embedded-postgres@17.11.0-beta.19
HERBBRIDGE_PG_TEST_RUNTIME=/private/tmp/herbbridge-pg-test node tools/check-concurrency.mjs
```

The test uses loopback only, a random temporary password, fictional users and a
new temporary cluster. It does not read `.env.local` or connect to Supabase. It
stops the cluster and removes its fictional data in `finally`.
