# Functional Requirements

Project: HMI web application for helping autistic children recognize emotions.

Source baseline:

- SRS: `hmi.pdf`, version 1.0 draft, dated 2026-05-15.
- Current backend snapshot: Elysia/Bun API, Drizzle/PostgreSQL schema, and `docs/API.md`.

This document treats the SRS as incomplete and possibly inconsistent. Requirements marked **Inferred** are necessary for a production implementation even when the SRS does not state them directly.

## Requirement Status

Priority definitions:

- **P0**: required for a usable and safe MVP.
- **P1**: required for the full SRS scope.
- **P2**: useful extension or operational enhancement.

Implementation status definitions:

- **Implemented**: exposed through current API routes and backed by use cases.
- **Partial**: database/query support exists but the route/use case is incomplete or missing.
- **Missing**: required by the SRS or inferred, but not currently implemented.

Current implemented API surface:

- `GET /health`
- `POST /auth/signup`
- `POST /auth/signin`
- `GET /me`
- `DELETE /auth/session`
- `POST /children`
- `GET /children`
- `POST /children/:childId/emotion-logs`
- `GET /children/:childId/dashboard`

## Assumptions And Resolved Ambiguities

1. Children do not authenticate directly. A parent signs in, selects a child profile, and the child-facing UI submits events under that parent session.
2. Admin users use the same `users` table with `role = ADMIN`. Admin account creation is an internal provisioning flow unless an existing admin creates another admin.
3. AI inference and computer vision run outside this backend. The frontend calls those AI services directly and sends only derived events, scores, durations, and outcomes to this backend. Raw webcam frame upload/storage is forbidden.
4. `game_sessions` in the SRS maps to the implemented `content_sessions` table.
5. `unlock_content_id` on `content_sessions` means a child can only record progress for content that is already unlocked for that child.
6. Password reset must avoid account enumeration. Even though the SRS says to report unknown email/phone, production behavior should return a generic response for reset requests.
7. Content and pet catalog deletion is soft delete. Existing unlocks, sessions, and child pet ownership must remain available for history/reporting unless a separate legal-erasure workflow is approved.
8. Email is the mandatory account identifier. Phone number is an optional secondary identifier that can be used for sign-in only when present.
9. Star balances are child-owned. Parents perform store purchases on behalf of children.
10. "AAC_BOARD" exists in the implementation as an emotion trigger source, but the SRS does not define an AAC board workflow. It is treated as a future supported trigger source.
11. Push notifications require device token registration. The SRS requires notifications but does not define token management, so device APIs are inferred.
12. PDF reports can be generated synchronously for small reports. If report size grows, generation should move to an async job with a downloadable artifact.
13. Registration creates a persisted session immediately; the client should not require a second sign-in after successful signup.
14. Google SSO links to an existing local account when Google returns the same verified email address.
15. A child can earn stars for a content item only once. Later completions can be recorded for progress/history but must award zero additional stars. Fixed rewards are lecture completion = 1 star, correct quiz answer = 2 stars, and successful AI game = 3 stars.
16. Birth year is immutable from the frontend after child profile creation. Difficulty is not recomputed from birth-year changes.
17. Regulation and time-out actions are AI-triggered only. Parents can view results/history but must not manually trigger those interventions through normal product flows.
18. Reports should be human-friendly and readable, using summaries and interpretation rather than raw event dumps as the primary presentation.
19. Admin analytics are aggregate only. Admins must not see child-specific identifiable logs, statistics, or reports.
20. Quiz media, answer emotion list, and correct answer are admin-defined. The child UI renders answer emotions as emojis.
21. Negative emotion alert/regulation threshold is exactly negative emotion duration greater than 60 seconds. No additional stress/meltdown threshold is defined.

## Role And Permission Model

### Public

Can access:

- Health check.
- Parent registration and sign-in.
- Google SSO callback/sign-in.
- Password reset request, verification, and confirmation.

### Parent

Can access only their own account and children:

- Read/update own account.
- Create/list/read/update/delete child profiles.
- Read/update sensory preferences for own children.
- List assigned/unlocked child content.
- Record learning sessions, quiz attempts, AI game results, and emotion logs for own children.
- View dashboards, emotion history, learning history, and reports for own children.
- Spend a child's stars to unlock content or pets.
- Register/delete own device tokens for push notifications.

Parent restrictions:

- Must not send `parent_id` in protected paths. Backend resolves the parent from the session token.
- Must not access another parent's child, content unlocks, pets, logs, sessions, or reports.
- Banned parents cannot use protected endpoints.

### Child

Children are not API principals. Child actions are authorized through the active parent session and selected `childId`.

Allowed child-facing actions through parent session:

- View lectures.
- Answer quizzes.
- Play AI emotion imitation games.
- Earn stars.
- Submit derived emotion logs through the child-facing frontend. Regulation/time-out is triggered by the AI flow, not manually by parents.

### Admin

Can access:

- Content CRUD for lectures, quizzes, and games.
- Pet catalog CRUD.
- User list, user status changes, and account deletion.
- System-level analytics and aggregate dashboards.
- Media asset registration/upload flow.

Admin restrictions:

- Admin must not be treated as a parent for child-profile endpoints unless explicitly modeled as a delegated support role.
- Admin must not access child-specific identifiable logs, statistics, or reports through analytics features.

### External AI Services

The frontend calls AI/computer-vision services directly. This backend does not call those models and does not know model topology, model versions, or inference service credentials.

Can access:

- No direct backend API access by default.
- The child-facing frontend can submit derived AI outcomes to backend endpoints under the authenticated parent session.

## Core Entities And Relationships

### `users`

Parent and admin accounts.

Key fields:

- `id`
- `email`
- `phone_number`
- `password_hash`
- `auth_provider`: `LOCAL`, `GOOGLE`
- `provider_id`
- `full_name`
- `role`: `PARENT`, `ADMIN`
- `status`: `ACTIVE`, `BANNED`
- `last_login_at`

Relationships:

- One parent has many `child_profiles`.
- One user has many `sessions`.
- One user has many `password_reset_codes`.
- Admin users can create many `contents`.

### `sessions`

Persisted login sessions.

Relationships:

- Many sessions belong to one user.

Requirements:

- Store only hashed session tokens.
- Expire sessions.
- Update `last_used_at` when authenticated requests are accepted.
- Delete session on sign-out.

### `password_reset_codes`

OTP/password-reset state.

Requirements:

- Store only hashed OTP/reset codes.
- Enforce expiry, attempt limits, and single use.
- Do not reveal whether an identifier exists during reset request.

### `child_profiles`

Child profile owned by a parent.

Key fields:

- `parent_id`
- `nickname`
- `avatar_url` stores the S3 object key for the child avatar; API responses expose a presigned URL.
- `birth_year`
- `total_stars`

Relationships:

- One child has one `preferences` record.
- One child has many `emotion_logs`.
- One child has many `unlock_content` records.
- One child has many `content_sessions`.
- One child has many `child_pets`.

### `preferences`

Sensory regulation and UI settings for a child.

Existing fields:

- `is_high_contrast`
- `preferences` JSONB

Required typed settings:

- `theme`
- `music_track_id`
- `music_volume`
- `voice_prompt_enabled`
- `high_contrast_enabled`
- `reduced_motion_enabled`
- `brightness_level`
- `timeout_seconds`
- `calming_story_enabled`

### `contents`

Shared content catalog.

Key fields:

- `title`
- `type`: `LECTURE`, `QUIZ`, `GAME`
- `status`: `DRAFT`, `PUBLISHED`
- `created_by`
- `deleted_at` for soft delete

Relationships:

- One content row has exactly one type-specific row: `lectures`, `quizzes`, or `game`.
- One content row can be unlocked by many children through `unlock_content`.

### `lectures`

Lecture media and metadata.

Required fields:

- `media_url`
- `description`
- `difficulty_level`: 1-3
- `is_default`
- **Inferred** `voiceover_url` for narration.
- Fixed reward policy: completed lecture awards 1 star on the first rewarded completion.

### `quizzes`

Quiz media and answer metadata.

Existing field:

- `answer_emotions`: admin-defined list of emotion identifiers shown to the child as emoji answers.
- `correct_emotion`

Requirements:

- `correct_emotion` must be one of `answer_emotions`.
- The final emotion catalog is still TODO, so stored values remain string identifiers until that catalog is finalized.
- Fixed reward policy: correct quiz answer awards 2 stars on the first rewarded completion.
- **Inferred** optional hint text/audio.

### `game`

AI imitation game metadata.

Required fields:

- `target_emotion`
- `time_limit_seconds`
- `difficulty_level`
- `is_default`
- `unlock_star_cost`

Missing required fields:

- **TODO** `detection_confidence_threshold`.
- Fixed reward policy: successful AI game awards 3 stars on the first rewarded completion.

### `unlock_content`

Join table of child-owned unlocked content.

Requirements:

- Unique pair `(child_id, content_id)`.
- Default content is unlocked when a child profile is created.
- Paid content unlocks must atomically deduct stars and insert unlock record.

### `content_sessions`

Learning/play history.

Key fields:

- `child_id`
- `unlock_content_id`
- `duration_seconds`
- `is_correct`
- `stars_earned`
- `ai_match_score`
- `status`: `COMPLETED`, `ABANDONED`

Missing required fields:

- **Inferred** `selected_emotion` for quiz attempts.
- **Inferred** `idempotency_key` to prevent duplicate rewards from retrying clients.
- **Inferred** `started_at` and `completed_at` for accurate usage time.
- Unique rewarded completion per `(child_id, unlock_content_id)`: repeated completions must record `stars_earned = 0`.

### `emotion_logs`

Emotion and behavior history.

Key fields:

- `emotion_value`
- `trigger_source`
- `duration_seconds`
- `created_at`

Required values:

- Emotion: `HAPPY`, `SAD`, `ANGRY`, `STRESSED`, `CALM`, `NEUTRAL`, `SCARED`, `SURPRISED`.
- Trigger source: `AAC_BOARD`, `GAME`, `QUIZ`, `LECTURE`, `WEBCAM`, `SYSTEM`.

Missing required fields:

- **Inferred** `confidence_score`.
- **Inferred** `session_id` or `content_session_id`.
- **Inferred** `metadata` for rage-click count, face detection state, or frontend observation context.

### `pets`

Store catalog of virtual pets.

Key fields:

- `name`
- `description`
- `image_url`
- `animation_url`
- `unlock_star_cost`
- `status`: `ACTIVE`, `HIDDEN`
- `deleted_at` for soft delete

### `child_pets`

Child-owned pets.

Key fields:

- `child_id`
- `pet_id`
- `custom_name`
- `unlocked_at`

### Inferred Entities

The following entities are required for complete implementation:

- `device_tokens`: parent device push tokens with platform, token hash, active status, and timestamps.
- `regulation_events`: records of automatic calming interventions, actions taken, duration, and source emotion event.
- `star_transactions`: immutable ledger for star earning/spending, reason, related entity, and balance after transaction.
- `media_assets`: uploaded media metadata, storage key, MIME type, size, owner, and status.
- `quiz_options`: answer options for quizzes if not stored as typed JSON.
- `audit_logs`: admin actions, soft deletes, legal hard deletes, account bans, and sensitive report exports.

## Use Cases

### UC-AUTH-01: Register Parent Account

- Actors: Parent.
- Preconditions: Parent is not authenticated. Email/phone/Google identity is not already linked.
- Main flow:
  1. Parent opens registration.
  2. Parent chooses email/password or Google SSO. Phone number can be supplied as an optional secondary identifier.
  3. Backend validates email uniqueness, optional phone uniqueness, and input format.
  4. Backend hashes password for local registration or verifies Google identity for SSO.
  5. Backend creates `users` with `role = PARENT` and `status = ACTIVE`.
  6. Backend creates a persisted session and updates `last_login_at`.
  7. Backend returns the created user and session token.
- Alternative/error flows:
  - Duplicate email or phone returns `409`.
  - Weak password or invalid identifier returns `400`.
  - Google token verification failure returns `401`.
  - Provider account already linked returns `409`.
- Postconditions: Parent account and active session exist.
- Related API endpoints: `POST /auth/signup`, `POST /auth/google`.
- Priority: P0.
- Current status: Partial. Email/password signup with immediate session exists. Google registration/linking is missing.

### UC-AUTH-02: Sign In

- Actors: Parent, Admin.
- Preconditions: Account exists and is active.
- Main flow:
  1. User submits email or phone identifier and password, or submits Google SSO proof.
  2. Backend verifies credentials/provider.
  3. For Google SSO, backend links to an existing local account with the same verified email if one exists.
  4. Backend rejects banned accounts.
  5. Backend creates a persisted session and updates `last_login_at`.
  6. Backend returns user and session token.
  7. Client routes parent to child profile selection or admin to admin dashboard.
- Alternative/error flows:
  - Invalid credentials return `401`.
  - Unsupported auth provider for the chosen method returns `401`.
  - Banned account returns `403`.
- Postconditions: Active session exists.
- Related API endpoints: `POST /auth/signin`, `POST /auth/google`, `GET /me`.
- Priority: P0.
- Current status: Partial. Local email/phone identifier sign-in exists. Google SSO is missing.

### UC-AUTH-03: Sign Out

- Actors: Parent, Admin.
- Preconditions: User is authenticated.
- Main flow:
  1. User signs out.
  2. Backend invalidates the current session token.
  3. Client clears local session state.
- Alternative/error flows:
  - Missing or expired session returns `401`.
- Postconditions: Session cannot be used again.
- Related API endpoints: `DELETE /auth/session`.
- Priority: P0.
- Current status: Implemented.

### UC-AUTH-04: Recover Forgotten Password

- Actors: Parent.
- Preconditions: Parent has a local email/password account.
- Main flow:
  1. Parent requests password reset with email or phone.
  2. Backend creates a short-lived OTP/reset code if the identifier exists.
  3. Backend sends OTP/link through email or SMS.
  4. Parent submits OTP.
  5. Backend verifies OTP and returns a reset token or marks the code verified.
  6. Parent submits a new password.
  7. Backend hashes and stores the new password, marks reset code used, and optionally invalidates existing sessions.
- Alternative/error flows:
  - Unknown identifier returns generic success for enumeration resistance.
  - Expired or incorrect OTP returns `400`.
  - Too many attempts returns `429` or `403`.
  - Google-only account returns a provider-specific message.
- Postconditions: New password is active.
- Related API endpoints: `POST /auth/password-reset/request`, `POST /auth/password-reset/verify`, `POST /auth/password-reset/confirm`.
- Priority: P0.
- Current status: Partial. Routes/use cases and email/SMS OTP delivery exist; rate limiting and attempt counter hardening are still missing.

### UC-AUTH-05: View And Update Own Account

- Actors: Parent, Admin.
- Preconditions: User is authenticated.
- Main flow:
  1. User requests current account.
  2. User updates full name, phone number, email, or password.
  3. Backend validates uniqueness and current password when changing sensitive fields.
  4. Backend persists changes and returns updated user.
- Alternative/error flows:
  - Duplicate email/phone returns `409`.
  - Wrong current password returns `401`.
  - Banned account returns `403`.
- Postconditions: Account profile is updated.
- Related API endpoints: `GET /me`, `PATCH /me`, `PATCH /me/password`.
- Priority: P1.
- Current status: Partial. `GET /me` exists. Update APIs are missing.

### UC-CHILD-01: Create Child Profile

- Actors: Parent.
- Preconditions: Parent is authenticated and active.
- Main flow:
  1. Parent submits nickname, birth year, and optional avatar file.
  2. Backend validates input and ownership.
  3. Backend derives target difficulty from age.
  4. Backend uploads the avatar file to S3 storage when provided.
  5. Backend creates `child_profiles`.
  6. Backend creates default `preferences`.
  7. Backend unlocks default lectures, quizzes, and games for the derived difficulty.
  8. Backend returns the child profile with a presigned avatar URL when an avatar exists.
- Alternative/error flows:
  - Missing nickname or invalid birth year returns `400`.
  - Unsupported avatar type returns `400`; avatar over 5 MB returns `413`; S3 upload failure returns `502`.
  - Non-parent account returns `404` or `403`.
  - No default content exists: child is still created and content list is empty.
- Postconditions: Child profile exists and is selectable.
- Related API endpoints: `POST /children`, `GET /children`.
- Priority: P0.
- Current status: Implemented for creation and default preference/unlock query logic.

### UC-CHILD-02: Select/List Child Profiles

- Actors: Parent.
- Preconditions: Parent is authenticated.
- Main flow:
  1. Parent requests owned child profiles.
  2. Backend returns children with preferences summary and star balance.
  3. Client lets parent/child select one active profile for learning.
- Alternative/error flows:
  - Banned parent returns `403`.
  - Parent has no children: return empty list.
- Postconditions: Client can enter child-specific flows.
- Related API endpoints: `GET /children`, `GET /children/:childId`.
- Priority: P0.
- Current status: Partial. List exists. Detail endpoint is missing.

### UC-CHILD-03: Update Or Delete Child Profile

- Actors: Parent.
- Preconditions: Parent owns the child profile.
- Main flow:
  1. Parent edits nickname or avatar file. Birth year is not editable from the frontend.
  2. Backend validates fields and updates profile.
  3. If deleting, backend requires explicit confirmation.
  4. Backend deletes child profile and cascades dependent data.
- Alternative/error flows:
  - Child not found returns `404`.
  - Child not owned by parent returns `403`.
  - Delete confirmation missing returns `400`.
- Postconditions: Profile is updated or removed. Content difficulty is not recomputed from later birth-year changes.
- Related API endpoints: `PATCH /children/:childId`, `DELETE /children/:childId`.
- Priority: P1.
- Current status: Partial. Query helpers exist. Routes/use cases are missing.

### UC-PREF-01: Configure Sensory Preferences

- Actors: Parent.
- Preconditions: Parent owns the child profile.
- Main flow:
  1. Parent opens child preferences.
  2. Parent sets high contrast, reduced motion, calming music, voice prompts, volume, brightness, theme, and timeout duration.
  3. Backend validates preference schema.
  4. Backend persists preferences.
  5. Child-facing UI uses preferences during learning and regulation.
- Alternative/error flows:
  - Invalid values return `400`.
  - Child not owned by parent returns `403`.
- Postconditions: Child-specific sensory configuration is stored.
- Related API endpoints: `GET /children/:childId/preferences`, `PATCH /children/:childId/preferences`.
- Priority: P0.
- Current status: Partial. Table exists and create profile initializes defaults. Routes/use cases are missing.

### UC-CONTENT-01: Browse Available Content

- Actors: Parent, Child.
- Preconditions: Parent is authenticated and child profile is selected.
- Main flow:
  1. Client requests available content for a child.
  2. Backend returns published, non-deleted content with unlocked state, type-specific data, difficulty, cost, and progress summary.
  3. Client renders lectures, quizzes, and games suitable for the child.
- Alternative/error flows:
  - Child not found returns `404`.
  - Child not owned by parent returns `403`.
  - No content available returns an empty list.
- Postconditions: Child can choose an unlocked learning item.
- Related API endpoints: `GET /children/:childId/contents`, `GET /contents/:contentId`.
- Priority: P0.
- Current status: Partial. Query helper exists. Routes/use cases are missing.

### UC-LEARN-01: Complete Lecture

- Actors: Child through parent session.
- Preconditions: Child profile is selected. Lecture is published and unlocked.
- Main flow:
  1. Child starts lecture media.
  2. Client plays image/video and voiceover.
  3. Child completes required viewing duration.
  4. Client submits completed content session.
  5. Backend validates unlock, records session, and awards stars only if this child has not already earned stars for the lecture.
- Alternative/error flows:
  - Child leaves early: client records `ABANDONED`; no stars are awarded.
  - Content is locked or unpublished returns `403` or `404`.
  - Duplicate completion retry with same idempotency key returns original result.
- Postconditions: Progress is recorded. Stars increase only for the first rewarded completion of the lecture.
- Related API endpoints: `GET /children/:childId/contents`, `POST /children/:childId/content-sessions`.
- Priority: P0.
- Current status: Partial. Table/query helper exists. Route/use case is missing.

### UC-LEARN-02: Answer Quiz

- Actors: Child through parent session.
- Preconditions: Quiz is published and unlocked.
- Main flow:
  1. Client displays quiz media and answer options.
  2. Child selects one emoji-rendered emotion answer from the admin-defined answer list.
  3. Client submits answer.
  4. Backend validates selected answer against `answer_emotions` and `correct_emotion`.
  5. If correct, backend records session and awards stars only if this child has not already earned stars for the quiz.
  6. If incorrect, backend records attempt according to policy and returns hint/try-again guidance.
- Alternative/error flows:
  - Selected emotion not present in the quiz answer list returns `400`.
  - Timeout/no interaction may be recorded as `ABANDONED`.
  - Locked content returns `403`.
- Postconditions: Attempt is stored for dashboard statistics.
- Related API endpoints: `GET /children/:childId/contents`, `POST /children/:childId/content-sessions`.
- Priority: P0.
- Current status: Missing. Current schema lacks answer options and no session route exists.

### UC-LEARN-03: Play AI Emotion Imitation Game

- Actors: Child through parent session, external AI service called by the frontend.
- Preconditions: Game is published and unlocked. Webcam permission is granted on client.
- Main flow:
  1. Client displays target emotion.
  2. Child imitates expression during time limit.
  3. Frontend calls the external AI service and receives match score/confidence.
  4. Client submits the derived AI game result.
  5. Backend validates score range, configured detection confidence threshold, unlock state, and first-reward rule.
  6. Backend records session and awards stars if the result passes the configured AI confidence threshold and this child has not already earned stars for the game.
- Alternative/error flows:
  - No face detected: client prompts child and may submit abandoned/failed attempt.
  - Negative emotion detected: trigger sensory regulation use cases.
  - Invalid score payload returns `400`; backend does not call or authenticate the AI service directly.
- Postconditions: AI attempt is recorded. Stars increase only for the first rewarded completion of the game.
- Related API endpoints: `POST /children/:childId/content-sessions`, `POST /children/:childId/emotion-logs`, `POST /children/:childId/regulation-events`.
- Priority: P1.
- Current status: Partial. Database fields exist. Route/use case is missing; backend should store derived AI results only.

### UC-ECON-01: Unlock Paid Content With Stars

- Actors: Parent.
- Preconditions: Parent owns child. Content is published, locked, and has a star cost. Child has enough stars.
- Main flow:
  1. Parent selects locked content.
  2. Backend validates child ownership, content state, and current star balance.
  3. Backend atomically deducts stars and inserts `unlock_content`.
  4. Backend records star transaction.
  5. Backend returns new balance and unlock record.
- Alternative/error flows:
  - Insufficient stars returns `409`.
  - Content already unlocked returns `409` or idempotent success.
  - Concurrent purchase race must not produce negative stars.
- Postconditions: Content is available to child.
- Related API endpoints: `POST /children/:childId/contents/:contentId/unlock`.
- Priority: P1.
- Current status: Partial. Query helper exists but lacks route and balance-safety use case.

### UC-ECON-02: Buy And Manage Virtual Pet

- Actors: Parent, Child.
- Preconditions: Parent owns child. Pet is active. Child has enough stars.
- Main flow:
  1. Parent views active pet store.
  2. Parent buys a pet for a child and optionally sets a custom name.
  3. Backend validates balance and duplicate ownership.
  4. Backend atomically deducts stars, inserts `child_pets`, and records star transaction.
  5. Child can view owned pets.
- Alternative/error flows:
  - Insufficient stars returns `409`.
  - Pet hidden or not found returns `404`.
  - Pet already owned returns `409` or idempotent success.
  - Invalid custom name returns `400`.
- Postconditions: Child owns pet and star balance is reduced.
- Related API endpoints: `GET /pets`, `GET /children/:childId/pets`, `POST /children/:childId/pets`, `PATCH /children/:childId/pets/:childPetId`.
- Priority: P1.
- Current status: Partial. Tables/query helpers exist. Routes/use cases are missing.

### UC-TRACK-01: Record Emotion Or Behavior Event

- Actors: Child-facing client using derived AI/frontend observations.
- Preconditions: Parent owns child. Client has consent and permission to observe the relevant source.
- Main flow:
  1. Client receives or derives emotion/behavior from webcam, game, quiz, lecture, AAC board, or system event.
  2. Client sends emotion, trigger source, duration, confidence, and metadata.
  3. Backend validates ownership and enums.
  4. Backend stores `emotion_logs`.
  5. Backend stores the event for dashboards/reports. AI-triggered regulation decisions remain outside this backend unless a later integration is approved.
- Alternative/error flows:
  - Invalid emotion/source returns `400`.
  - Child not owned returns `403`.
  - Prolonged negative emotion can trigger parent notification after the notification policy is implemented.
- Postconditions: Event is available for dashboard and reports.
- Related API endpoints: `POST /children/:childId/emotion-logs`, `GET /children/:childId/emotion-logs`.
- Priority: P0.
- Current status: Partial. Create route exists. List route and extended metadata are missing.

### UC-REG-01: Automatic Sensory Regulation

- Actors: External AI flow, child-facing client.
- Preconditions: Client detects stress, crying, angry expression, rage clicks, or absence from seat. Child preferences exist.
- Main flow:
  1. External AI flow identifies a negative emotion lasting more than 60 seconds.
  2. Client records the derived emotion log.
  3. Client applies sensory preferences: reduce brightness, pause animation, lower/stops background audio, play calming music/voice, or switch theme.
  4. Client records a regulation event with action details when the route exists.
  5. If child returns to calm state, client resumes lesson.
- Alternative/error flows:
  - Negative emotion persists longer than 60 seconds: send parent push notification.
  - Preference config missing: use safe defaults.
- Postconditions: Intervention is auditable and child UI is adjusted.
- Related API endpoints: `POST /children/:childId/emotion-logs`, `POST /children/:childId/regulation-events`, `GET /children/:childId/preferences`.
- Priority: P0.
- Current status: Missing except raw emotion log creation.

### UC-REG-02: Time-Out Mode

- Actors: External AI flow, child-facing client.
- Preconditions: AI determines a negative emotion has lasted more than 60 seconds.
- Main flow:
  1. Client enters minimal UI mode.
  2. Client displays calm countdown or calming story.
  3. Client pauses active lesson/game session.
  4. Backend records timeout regulation event.
  5. Client exits timeout after countdown or after calm signal.
- Alternative/error flows:
  - Child stays distressed: extend timeout according to policy and notify parent.
  - Active content session is abandoned if timeout exceeds allowed duration.
- Postconditions: Timeout history is stored and visible to parent.
- Related API endpoints: `POST /children/:childId/regulation-events`, `POST /children/:childId/content-sessions`.
- Priority: P1.
- Current status: Missing.

### UC-NOTIF-01: Notify Parent About Prolonged Negative Emotion

- Actors: System, Parent.
- Preconditions: Parent has registered a device token. Negative emotion lasts more than 60 seconds.
- Main flow:
  1. Backend identifies eligible alert from emotion log/regulation event.
  2. Backend creates notification event.
  3. Backend sends push notification to active parent devices.
  4. Backend records delivery status.
- Alternative/error flows:
  - No device token: store alert for dashboard only.
  - Push provider failure: retry with backoff and retain failure status.
  - Duplicate alert within cooldown: suppress duplicate notification.
- Postconditions: Parent is alerted or alert is retained for later view.
- Related API endpoints: `POST /devices`, `DELETE /devices/:deviceId`, `GET /children/:childId/alerts`.
- Priority: P1.
- Current status: Missing.

### UC-DASH-01: View Child Dashboard

- Actors: Parent.
- Preconditions: Parent owns child.
- Main flow:
  1. Parent opens dashboard for a child.
  2. Backend aggregates learning sessions, correct quiz rate, total stars, emotion counts, meltdown alerts, and usage time.
  3. Backend returns data for week/month ranges.
  4. Client displays charts and empty states.
- Alternative/error flows:
  - No data returns zero metrics and empty arrays.
  - Invalid range returns `400`.
  - Child not owned returns `403`.
- Postconditions: Parent can review progress and emotional trends.
- Related API endpoints: `GET /children/:childId/dashboard`.
- Priority: P0.
- Current status: Implemented basic version.

### UC-DASH-02: Export PDF Report

- Actors: Parent.
- Preconditions: Parent owns child.
- Main flow:
  1. Parent selects date range and report type.
  2. Backend aggregates child profile, learning stats, emotion chart data, meltdown events, and usage summary.
  3. Backend generates a human-friendly PDF with readable summaries, charts, and interpretation before raw logs.
  4. Client downloads PDF.
- Alternative/error flows:
  - No data: generate report with empty-state summary.
  - Date range too large returns `400`.
  - PDF generation failure returns `500` or async job failure state.
- Postconditions: Parent receives report artifact.
- Related API endpoints: `GET /children/:childId/reports/summary.pdf`.
- Priority: P1.
- Current status: Missing.

### UC-ADMIN-01: Manage Learning Content

- Actors: Admin.
- Preconditions: Admin is authenticated.
- Main flow:
  1. Admin lists content.
  2. Admin creates lecture, quiz, or game with title, status, media, difficulty, default flag, quiz answer emotion list, quiz correct answer, or game target emotion.
  3. Backend validates type-specific payload.
  4. Backend stores `contents` and exactly one type-specific row in a transaction.
  5. Admin publishes, edits, or soft-deletes content by setting `deleted_at`.
- Alternative/error flows:
  - Upload/media format invalid returns `400`.
  - Type-specific payload missing returns `400`.
  - Deleting content hides it from future child browsing/default unlock while preserving historical unlock/session rows.
- Postconditions: Published, non-deleted content is available for children or default unlock.
- Related API endpoints: `GET /admin/contents`, `POST /admin/contents`, `GET /admin/contents/:contentId`, `PATCH /admin/contents/:contentId`, `DELETE /admin/contents/:contentId`, `POST /admin/media-assets`.
- Priority: P0.
- Current status: Partial. Tables exist. Routes/use cases are missing.

### UC-ADMIN-02: Manage Pet Catalog

- Actors: Admin.
- Preconditions: Admin is authenticated.
- Main flow:
  1. Admin lists pets.
  2. Admin creates or updates pet name, image, animation, cost, and status.
  3. Backend validates cost and media.
  4. Admin can hide or soft-delete pets.
- Alternative/error flows:
  - Pet in use is soft-deleted or hidden; child ownership history is preserved.
  - Duplicate or invalid media returns `400`.
- Postconditions: Pet store reflects admin changes.
- Related API endpoints: `GET /admin/pets`, `POST /admin/pets`, `PATCH /admin/pets/:petId`, `DELETE /admin/pets/:petId`.
- Priority: P1.
- Current status: Partial. Tables exist. Routes/use cases are missing.

### UC-ADMIN-03: Manage Users

- Actors: Admin.
- Preconditions: Admin is authenticated.
- Main flow:
  1. Admin searches users by email, phone, role, or status.
  2. Admin views user profile and child summary.
  3. Admin bans/unbans a user by updating status.
  4. Admin deletes a user if policy/legal request requires hard deletion.
- Alternative/error flows:
  - Admin cannot delete or ban self without a separate guarded flow.
  - User not found returns `404`.
  - Deletion requires confirmation and audit log.
- Postconditions: User status or data is changed.
- Related API endpoints: `GET /admin/users`, `GET /admin/users/:userId`, `PATCH /admin/users/:userId`, `DELETE /admin/users/:userId`.
- Priority: P1.
- Current status: Missing.

### UC-ADMIN-04: View System Analytics

- Actors: Admin.
- Preconditions: Admin is authenticated.
- Main flow:
  1. Admin opens system analytics.
  2. Backend returns aggregate user counts, active child count, content completion rates, quiz success rates, emotion aggregate counts, and alert counts based on the 60-second negative-emotion threshold.
  3. Backend excludes child-specific identifiable logs, statistics, and reports.
- Alternative/error flows:
  - Invalid date range returns `400`.
  - No data returns zero metrics.
- Postconditions: Admin can monitor system adoption and content effectiveness.
- Related API endpoints: `GET /admin/analytics`.
- Priority: P2.
- Current status: Missing.

## API Endpoint Catalog

All protected endpoints use:

```http
Authorization: Bearer <session_token>
```

Standard error body:

```json
{
  "error": {
    "type": "ERROR_TYPE",
    "message": "Human-readable message."
  }
}
```

### Health

| Method | Path      | Purpose                              | Auth/Authz | Request | Response                                                                                     | Error responses                  | Validation | Related use cases      | Status      |
| ------ | --------- | ------------------------------------ | ---------- | ------- | -------------------------------------------------------------------------------------------- | -------------------------------- | ---------- | ---------------------- | ----------- |
| `GET`  | `/health` | Check API and database availability. | Public.    | None.   | `{ "status": "healthy", "timestamp": "...", "services": { "api": "up", "database": "up" } }` | `503` when database check fails. | None.      | Operational readiness. | Implemented |

### Authentication And Account

| Method   | Path                           | Purpose                                                                           | Auth/Authz                      | Request                                                                   | Response                                                         | Error responses                                                                                                   | Validation                                                                                                                                | Related use cases      | Status                           |
| -------- | ------------------------------ | --------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------- |
| `POST`   | `/auth/signup`                 | Create parent account with local credentials and immediate session.               | Public.                         | Body: `email`, `password`, optional `phone_number`, optional `full_name`. | `201` with `message`, `user`, and `session` including raw token. | `400` invalid JSON/email/password/phone/full name. `409` email or phone taken.                                    | Email format; password length >= 8; phone 8-15 digits with optional `+`; full name <= 120 chars.                                          | UC-AUTH-01             | Implemented for email/password.  |
| `POST`   | `/auth/signin`                 | Authenticate local parent/admin using email or phone identifier.                  | Public.                         | Body: `identifier`, `password`.                                           | `200` with `message`, `user`, and `session` including raw token. | `400` missing identifier/password. `401` invalid credentials or unsupported provider. `403` banned account.       | Identifier non-empty; password non-empty.                                                                                                 | UC-AUTH-02             | Implemented for local auth.      |
| `POST`   | `/auth/google`                 | Authenticate or register using Google SSO, linking verified-email local accounts. | Public.                         | Body: `id_token` or OAuth `authorization_code`, optional `redirect_uri`.  | `200` or `201` with `user` and `session`.                        | `400` invalid request. `401` invalid Google credential. `403` banned account. `409` provider conflict.            | Verify issuer, audience, expiry, email verification, provider ID uniqueness; link same verified email to local account.                   | UC-AUTH-01, UC-AUTH-02 | Missing                          |
| `GET`    | `/me`                          | Return current user and session metadata.                                         | Authenticated parent/admin.     | None.                                                                     | `200` with `session` and `user`.                                 | `401` missing/invalid session. `403` banned account.                                                              | Session token must be valid and unexpired.                                                                                                | UC-AUTH-02, UC-AUTH-05 | Implemented                      |
| `PATCH`  | `/me`                          | Update account profile fields.                                                    | Authenticated parent/admin.     | Body: optional `email`, `phone_number`, `full_name`.                      | `200` with updated `user`.                                       | `400` invalid fields. `401` invalid session. `403` banned account. `409` email/phone taken.                       | Email/phone formats; full name <= 120 chars; at least one field. Email/phone changes should require reauth or verification in production. | UC-AUTH-05             | Implemented                      |
| `PATCH`  | `/me/password`                 | Change password while signed in.                                                  | Authenticated local/phone user. | Body: `current_password`, `new_password`.                                 | `200` message.                                                   | `400` weak new password. `401` wrong current password. `403` banned account or provider account without password. | Current password required; new password >= 8 chars and different from current.                                                            | UC-AUTH-05             | Implemented                      |
| `DELETE` | `/auth/session`                | Sign out current session.                                                         | Authenticated parent/admin.     | None.                                                                     | `200` message.                                                   | `401` missing/invalid session. `403` banned account.                                                              | Session token must exist.                                                                                                                 | UC-AUTH-03             | Implemented                      |
| `POST`   | `/auth/password-reset/request` | Request OTP/link for forgotten password through email or SMS.                     | Public.                         | Body: `identifier` email or phone.                                        | `200` generic message.                                           | `400` invalid identifier. `500` SMS config missing. `502` SMS provider failure. `429` too many requests.          | Do not reveal whether account exists; rate-limit by identifier/IP; only local/phone accounts.                                             | UC-AUTH-04             | Partial: missing rate limit.     |
| `POST`   | `/auth/password-reset/verify`  | Verify OTP and issue reset token.                                                 | Public.                         | Body: `identifier`, `otp`.                                                | `200` with short-lived `reset_token`.                            | `400` invalid/expired OTP. `429` too many attempts.                                                               | OTP format; expiry; attempt count.                                                                                                        | UC-AUTH-04             | Partial: attempt hardening TODO. |
| `POST`   | `/auth/password-reset/confirm` | Set new password using reset token.                                               | Public.                         | Body: `reset_token`, `new_password`.                                      | `200` message.                                                   | `400` invalid token/weak password. `401` expired token.                                                           | Token single-use; new password >= 8 chars; invalidate used code and optionally sessions.                                                  | UC-AUTH-04             | Implemented                      |
| `POST`   | `/devices`                     | Register a parent device for push notifications.                                  | Authenticated parent.           | Body: `platform`, `push_token`, optional `app_instance_id`.               | `201` with `device`.                                             | `400` invalid platform/token. `401` invalid session. `403` banned account. `409` token conflict.                  | Platform enum: `WEB`, `IOS`, `ANDROID`; token non-empty; one active record per token.                                                     | UC-NOTIF-01            | Missing, inferred                |
| `DELETE` | `/devices/:deviceId`           | Delete/deactivate a push device.                                                  | Authenticated owner parent.     | Path: `deviceId`.                                                         | `200` message.                                                   | `400` invalid UUID. `401` invalid session. `403` not owner. `404` not found.                                      | Device must belong to authenticated parent.                                                                                               | UC-NOTIF-01            | Missing, inferred                |

### Child Profiles And Preferences

| Method   | Path                             | Purpose                                        | Auth/Authz                   | Request                                                                  | Response                                                     | Error responses                                                                                                                                                           | Validation                                                                                                                                                         | Related use cases     | Status      |
| -------- | -------------------------------- | ---------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ----------- |
| `POST`   | `/children`                      | Create child profile for authenticated parent. | Authenticated parent.        | Multipart fields: `nickname`, `birth_year`, optional `avatar` file.      | `201` with `message` and `child`; `avatar_url` is presigned. | `400` invalid nickname/avatar/birth year. `401` invalid session. `403` banned or inactive parent. `404` parent not found. `413` avatar too large. `502` S3 upload failed. | Nickname non-empty <= 80 chars; avatar must be JPEG/PNG/WebP/GIF/AVIF <= 5 MB; birth year from current year - 18 through current year.                             | UC-CHILD-01           | Implemented |
| `GET`    | `/children`                      | List child profiles owned by parent.           | Authenticated parent.        | None.                                                                    | `200` with `children[]`, including preference summary.       | `401` invalid session. `403` banned/inactive parent. `404` parent not found.                                                                                              | Parent comes from session.                                                                                                                                         | UC-CHILD-02           | Implemented |
| `GET`    | `/children/:childId`             | Return one child profile.                      | Authenticated owning parent. | Path: `childId`.                                                         | `200` with `child`, preferences, and star balance.           | `400` invalid UUID. `401` invalid session. `403` child not owned. `404` child not found.                                                                                  | UUID format and ownership.                                                                                                                                         | UC-CHILD-02           | Implemented |
| `PATCH`  | `/children/:childId`             | Update child profile.                          | Authenticated owning parent. | Path: `childId`. Multipart body with optional `nickname`, `avatar` file. | `200` with updated `child`; `avatar_url` is presigned.       | `400` invalid body/UUID/avatar. `401` invalid session. `403` child not owned. `404` child not found. `413` avatar too large. `502` S3 upload failed.                      | Same mutable field limits as create; at least one field. `birth_year` is create-only from frontend.                                                                | UC-CHILD-03           | Implemented |
| `DELETE` | `/children/:childId`             | Delete child profile and dependent data.       | Authenticated owning parent. | Path: `childId`. Body: `confirmation` exactly `DELETE`.                  | `200` message.                                               | `400` missing confirmation/invalid UUID. `401` invalid session. `403` child not owned. `404` child not found.                                                             | Require explicit confirmation. Cascade deletes logs, preferences, sessions, unlocks, pets.                                                                         | UC-CHILD-03           | Implemented |
| `GET`    | `/children/:childId/preferences` | Read sensory preferences.                      | Authenticated owning parent. | Path: `childId`.                                                         | `200` with `preferences`.                                    | `400` invalid UUID. `401` invalid session. `403` child not owned. `404` child/preference not found.                                                                       | Ownership required.                                                                                                                                                | UC-PREF-01, UC-REG-01 | Missing     |
| `PATCH`  | `/children/:childId/preferences` | Update sensory preferences.                    | Authenticated owning parent. | Body: optional `is_high_contrast`, typed `preferences` object.           | `200` with updated `preferences`.                            | `400` invalid preference schema. `401` invalid session. `403` child not owned. `404` child not found.                                                                     | Validate known keys: theme, volume 0-100, brightness 0-100, timeout seconds positive, booleans for reduced motion/voice prompts. Reject unsupported unsafe values. | UC-PREF-01, UC-REG-01 | Missing     |

### Learning Content And Sessions

| Method | Path                                            | Purpose                                                                        | Auth/Authz                                                        | Request                                                                                                                                                | Response                                                                                                                              | Error responses                                                                                                                                                          | Validation                                                                                                                                                                                                                                | Related use cases                                    | Status  |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------- |
| `GET`  | `/children/:childId/contents`                   | List content available to a child, including locked/unlocked state.            | Authenticated owning parent.                                      | Path: `childId`. Query: optional `type`, `difficulty_level`, `include_locked`, `status` for admins only.                                               | `200` with `contents[]`. Each item includes base content, type-specific payload, `is_unlocked`, `unlock_star_cost`, progress summary. | `400` invalid filters. `401` invalid session. `403` child not owned. `404` child not found.                                                                              | Type enum; difficulty 1-3; only published, non-deleted content for parents/children.                                                                                                                                                      | UC-CONTENT-01, UC-LEARN-01, UC-LEARN-02, UC-LEARN-03 | Missing |
| `GET`  | `/contents/:contentId`                          | Read content detail.                                                           | Authenticated parent for published content; admin for any status. | Path: `contentId`. Optional query `child_id` to include unlock state.                                                                                  | `200` with content detail.                                                                                                            | `400` invalid UUID. `401` invalid session. `403` locked/not authorized. `404` not found.                                                                                 | Parent can only read published content and must own `child_id` if provided.                                                                                                                                                               | UC-CONTENT-01                                        | Missing |
| `POST` | `/children/:childId/content-sessions`           | Record lecture completion, quiz attempt, AI game result, or abandoned session. | Authenticated owning parent.                                      | Body: `content_id`, optional `idempotency_key`, `duration_seconds`, `status`, optional `selected_emotion`, `is_correct`, `ai_match_score`, `metadata`. | `201` with `session`, `stars_earned`, `child_total_stars`.                                                                            | `400` invalid fields. `401` invalid session. `403` child not owned or content locked. `404` child/content not found. `409` duplicate idempotency key or reward conflict. | Content must be published, non-deleted, and unlocked; duration positive if present; status `COMPLETED` or `ABANDONED`; score 0-100. Fixed rewards: lecture 1, correct quiz 2, successful AI game 3; award at most once per child/content. | UC-LEARN-01, UC-LEARN-02, UC-LEARN-03, UC-REG-02     | Missing |
| `GET`  | `/children/:childId/content-sessions`           | List learning history.                                                         | Authenticated owning parent.                                      | Query: optional `type`, `from`, `to`, `limit`, `cursor`.                                                                                               | `200` with paginated `sessions[]`.                                                                                                    | `400` invalid range/pagination. `401` invalid session. `403` child not owned. `404` child not found.                                                                     | Limit capped, for example <= 100. Date range valid.                                                                                                                                                                                       | UC-DASH-01                                           | Missing |
| `POST` | `/children/:childId/contents/:contentId/unlock` | Spend stars to unlock paid content.                                            | Authenticated owning parent.                                      | Path: `childId`, `contentId`. Optional body: `idempotency_key`.                                                                                        | `201` with `unlock`, `child_total_stars`, `star_transaction`.                                                                         | `400` invalid UUID. `401` invalid session. `403` child not owned. `404` child/content not found. `409` insufficient stars or already unlocked.                           | Content must be published; cost >= 0; atomic update must ensure `total_stars >= cost`.                                                                                                                                                    | UC-ECON-01                                           | Missing |

### Pets And Store

| Method  | Path                                  | Purpose                     | Auth/Authz                   | Request                                 | Response                                        | Error responses                                                                                                                         | Validation                                                                         | Related use cases | Status      |
| ------- | ------------------------------------- | --------------------------- | ---------------------------- | --------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------- | ----------- |
| `GET`   | `/pets`                               | List active pets in store.  | Authenticated parent/admin.  | None.                                   | `200` with `pets[]`.                            | `401` invalid session. `403` banned account.                                                                                            | Returns only `ACTIVE`, non-deleted pets.                                           | UC-ECON-02        | Implemented |
| `GET`   | `/children/:childId/pets`             | List pets owned by a child. | Authenticated owning parent. | Path: `childId`.                        | `200` with `child_pets[]` and pet details.      | `400` invalid UUID. `401` invalid session. `403` child not owned. `404` child not found.                                                | Ownership required.                                                                | UC-ECON-02        | Implemented |
| `POST`  | `/children/:childId/pets`             | Buy pet for child.          | Authenticated owning parent. | Body: `pet_id`, optional `custom_name`. | `201` with `child_pet` and `child_total_stars`. | `400` invalid body. `401` invalid session. `403` child not owned. `404` child/pet not found. `409` insufficient stars or already owned. | Pet must be active and non-deleted; custom name <= 80 chars; atomic balance check. | UC-ECON-02        | Implemented |
| `PATCH` | `/children/:childId/pets/:childPetId` | Rename owned pet.           | Authenticated owning parent. | Body: `custom_name`.                    | `200` with updated `child_pet`.                 | `400` invalid name/UUID. `401` invalid session. `403` child not owned. `404` pet ownership not found.                                   | Name may be cleared; if present <= 80 chars.                                       | UC-ECON-02        | Implemented |

### Tracking, Regulation, Alerts, Reports

| Method | Path                                     | Purpose                                              | Auth/Authz                                           | Request                                                                                                                 | Response                                                       | Error responses                                                                                                     | Validation                                                                                                                                                            | Related use cases                   | Status                        |
| ------ | ---------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------- |
| `POST` | `/children/:childId/emotion-logs`        | Record derived emotion/behavior event.               | Authenticated owning parent.                         | Body: `emotion_value`, `trigger_source`, optional `duration_seconds`, inferred optional `confidence_score`, `metadata`. | `201` with `log`.                                              | `400` invalid UUID/emotion/source/duration. `401` invalid session. `403` child not owned. `404` child not found.    | Emotion/source enums; duration positive integer; confidence convention is TODO. Backend does not call AI services and must not accept raw webcam frames.              | UC-TRACK-01, UC-REG-01, UC-NOTIF-01 | Implemented basic create only |
| `GET`  | `/children/:childId/emotion-logs`        | List child emotion history.                          | Authenticated owning parent.                         | Query: optional `from`, `to`, `emotion`, `trigger_source`, `limit`, `cursor`.                                           | `200` with paginated `logs[]`.                                 | `400` invalid filters. `401` invalid session. `403` child not owned. `404` child not found.                         | Limit cap; valid date range; enum filters.                                                                                                                            | UC-TRACK-01, UC-DASH-01             | Missing                       |
| `POST` | `/children/:childId/regulation-events`   | Record AI-triggered sensory regulation intervention. | Authenticated owning parent via child-facing client. | Body: `trigger_emotion_log_id`, `action`, `started_at`, optional `ended_at`, `duration_seconds`, `metadata`.            | `201` with `regulation_event`.                                 | `400` invalid body. `401` invalid session. `403` child not owned. `404` child/log not found.                        | Action enum: `REDUCE_BRIGHTNESS`, `PAUSE_ANIMATION`, `PLAY_CALMING_AUDIO`, `VOICE_PROMPT`, `TIMEOUT`, `SHOW_STORY`, `RESUME`. Parent manual trigger is not supported. | UC-REG-01, UC-REG-02                | Missing, inferred             |
| `GET`  | `/children/:childId/regulation-events`   | List regulation history.                             | Authenticated owning parent.                         | Query: optional `from`, `to`, `action`, `limit`, `cursor`.                                                              | `200` with paginated `regulation_events[]`.                    | `400` invalid filters. `401` invalid session. `403` child not owned. `404` child not found.                         | Limit cap and date range.                                                                                                                                             | UC-REG-01, UC-REG-02, UC-DASH-01    | Missing, inferred             |
| `GET`  | `/children/:childId/alerts`              | List parent alerts for a child.                      | Authenticated owning parent.                         | Query: optional `from`, `to`, `status`, `limit`, `cursor`.                                                              | `200` with `alerts[]`.                                         | `400` invalid filters. `401` invalid session. `403` child not owned. `404` child not found.                         | Alerts are generated only when a negative emotion duration is greater than 60 seconds.                                                                                | UC-NOTIF-01, UC-DASH-01             | Missing, inferred             |
| `GET`  | `/children/:childId/dashboard`           | Return child learning and emotion dashboard.         | Authenticated owning parent.                         | Query: `days` optional integer 1-90.                                                                                    | `200` with `child`, `learning`, `emotions`, `meltdown_alerts`. | `400` invalid UUID/days. `401` invalid session. `403` child not owned. `404` parent/child not found.                | Days default 7; max 90.                                                                                                                                               | UC-DASH-01                          | Implemented basic version     |
| `GET`  | `/children/:childId/reports/summary.pdf` | Export human-friendly PDF report.                    | Authenticated owning parent.                         | Query: optional `from`, `to`, `days`, `include_emotions`, `include_learning`.                                           | `200` `application/pdf`.                                       | `400` invalid range. `401` invalid session. `403` child not owned. `404` child not found. `500` generation failure. | Date range bounded; default report range defined, for example 30 days. Prefer readable summaries/charts over raw logs. Audit export event.                            | UC-DASH-02                          | Missing                       |

### Admin

| Method   | Path                         | Purpose                                    | Auth/Authz           | Request                                                                                                             | Response                                                   | Error responses                                                                                              | Validation                                                                                                                                         | Related use cases        | Status            |
| -------- | ---------------------------- | ------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------- |
| `GET`    | `/admin/contents`            | List all content including drafts.         | Authenticated admin. | Query: optional `type`, `status`, `difficulty_level`, `search`, `limit`, `cursor`.                                  | `200` with paginated `contents[]`.                         | `400` invalid filters. `401` invalid session. `403` not admin.                                               | Enum filters; limit cap.                                                                                                                           | UC-ADMIN-01              | Missing           |
| `POST`   | `/admin/contents`            | Create lecture, quiz, or game.             | Authenticated admin. | Body: base `title`, `type`, `status`; type payload for `lecture`, `quiz`, or `game`.                                | `201` with created content detail.                         | `400` invalid payload. `401` invalid session. `403` not admin. `409` duplicate title if uniqueness is added. | Exactly one type payload matching `type`; difficulty 1-3; game time limit > 0; star costs >= 0; quiz `answer_emotions` includes `correct_emotion`. | UC-ADMIN-01              | Missing           |
| `GET`    | `/admin/contents/:contentId` | Read any content detail.                   | Authenticated admin. | Path: `contentId`.                                                                                                  | `200` with content detail.                                 | `400` invalid UUID. `401` invalid session. `403` not admin. `404` not found.                                 | UUID format.                                                                                                                                       | UC-ADMIN-01              | Missing           |
| `PATCH`  | `/admin/contents/:contentId` | Update content and type-specific data.     | Authenticated admin. | Body: partial base and type-specific fields.                                                                        | `200` with updated content detail.                         | `400` invalid fields. `401` invalid session. `403` not admin. `404` not found.                               | Cannot change type unless implemented as delete/recreate; validate status transitions.                                                             | UC-ADMIN-01              | Missing           |
| `DELETE` | `/admin/contents/:contentId` | Soft-delete content.                       | Authenticated admin. | Path: `contentId`; body confirmation.                                                                               | `200` message.                                             | `400` missing confirmation/invalid UUID. `401` invalid session. `403` not admin. `404` not found.            | Require confirmation and audit log. Set `deleted_at`; preserve unlock/session history.                                                             | UC-ADMIN-01              | Missing           |
| `POST`   | `/admin/media-assets`        | Register or upload media for content/pets. | Authenticated admin. | Multipart file or body with `file_name`, `mime_type`, `size_bytes`, `purpose`.                                      | `201` with `media_asset` or signed upload URL.             | `400` unsupported MIME/size. `401` invalid session. `403` not admin. `413` too large.                        | Allow image/video/audio/Lottie types defined by product; virus scanning/storage validation inferred.                                               | UC-ADMIN-01, UC-ADMIN-02 | Missing, inferred |
| `GET`    | `/admin/pets`                | List all pets including hidden.            | Authenticated admin. | Query: optional `status`, `search`, `limit`, `cursor`.                                                              | `200` with `pets[]`.                                       | `400` invalid filters. `401` invalid session. `403` not admin.                                               | Status enum; limit cap.                                                                                                                            | UC-ADMIN-02              | Missing           |
| `POST`   | `/admin/pets`                | Create pet.                                | Authenticated admin. | Body: `name`, optional `description`, `image_url`, optional `animation_url`, `unlock_star_cost`, optional `status`. | `201` with `pet`.                                          | `400` invalid body. `401` invalid session. `403` not admin.                                                  | Name non-empty; image required; cost >= 0; status `ACTIVE` or `HIDDEN`.                                                                            | UC-ADMIN-02              | Missing           |
| `PATCH`  | `/admin/pets/:petId`         | Update pet catalog item.                   | Authenticated admin. | Body: partial pet fields.                                                                                           | `200` with updated `pet`.                                  | `400` invalid UUID/body. `401` invalid session. `403` not admin. `404` not found.                            | Same field validation as create; at least one field.                                                                                               | UC-ADMIN-02              | Missing           |
| `DELETE` | `/admin/pets/:petId`         | Soft-delete or hide pet.                   | Authenticated admin. | Path: `petId`; body confirmation or `mode`.                                                                         | `200` message.                                             | `400` invalid UUID/confirmation. `401` invalid session. `403` not admin. `404` not found.                    | Prefer `status = HIDDEN` for reversible hiding or set `deleted_at` for delete; preserve child ownership history.                                   | UC-ADMIN-02              | Missing           |
| `GET`    | `/admin/users`               | Search users.                              | Authenticated admin. | Query: optional `role`, `status`, `search`, `limit`, `cursor`.                                                      | `200` with paginated `users[]`.                            | `400` invalid filters. `401` invalid session. `403` not admin.                                               | Role/status enum; search by email/phone/full name.                                                                                                 | UC-ADMIN-03              | Missing           |
| `GET`    | `/admin/users/:userId`       | Read user detail.                          | Authenticated admin. | Path: `userId`.                                                                                                     | `200` with user, child count, session summary, and status. | `400` invalid UUID. `401` invalid session. `403` not admin. `404` not found.                                 | UUID format.                                                                                                                                       | UC-ADMIN-03              | Missing           |
| `PATCH`  | `/admin/users/:userId`       | Update user status or role.                | Authenticated admin. | Body: optional `status`, optional `role`.                                                                           | `200` with updated `user`.                                 | `400` invalid body. `401` invalid session. `403` not admin or unsafe self-change. `404` not found.           | Status enum; role enum; protect last admin/self-ban cases.                                                                                         | UC-ADMIN-03              | Missing           |
| `DELETE` | `/admin/users/:userId`       | Hard-delete user and cascaded data.        | Authenticated admin. | Body: confirmation and reason.                                                                                      | `200` message.                                             | `400` missing confirmation. `401` invalid session. `403` not admin or unsafe self-delete. `404` not found.   | Require audit log; enforce cascade; consider legal retention policy before production.                                                             | UC-ADMIN-03              | Missing           |
| `GET`    | `/admin/analytics`           | Return aggregate system analytics.         | Authenticated admin. | Query: optional `from`, `to`, `granularity`.                                                                        | `200` with aggregate metrics.                              | `400` invalid range. `401` invalid session. `403` not admin.                                                 | Date range bounded; aggregate only. Must not expose child-specific identifiable logs/statistics/reports.                                           | UC-ADMIN-04              | Missing           |

## Missing Or Ambiguous SRS Points

### Missing From Current Implementation

1. Google SSO registration/sign-in.
2. Password reset request/verify/confirm routes.
3. Device token registration and push notification delivery.
4. Preferences read/update routes and typed preference schema.
5. Content browse/detail routes for child learning UI.
6. Content session completion route for lectures, quizzes, games, and abandoned sessions.
7. Content session idempotency use case around fixed star rewards.
8. Star spending route for content unlocks.
9. Immutable star ledger for debugging balance changes.
10. AI game scoring contract and detection confidence threshold.
11. Final emotion catalog.
12. Emotion log listing/filtering.
13. Regulation event model and routes.
14. Alert model, alert cooldown, and notification status tracking.
15. PDF report export.
16. Admin content CRUD.
17. Admin pet CRUD.
18. Admin user management.
19. Admin system analytics.
20. Media asset upload/registration.
21. Audit logging for admin changes, soft deletes, bans, and report exports.
22. Pagination/cursor support for list endpoints.
23. Rate limiting for auth, password reset, emotion logging, and AI event ingestion.
24. RBAC middleware for parent/admin/system authorization.
25. Webcam consent and raw-frame ban enforcement.

### Ambiguous In The SRS

Resolved:

1. Registration creates a persisted session immediately.
2. Email is mandatory; phone number is optional.
3. Google SSO links to a local account with the same verified email.
4. Stars cannot be earned repeatedly from the same content.
5. AI inference/computer vision runs in separate frontend-called services; backend stores only derived outcomes.
6. Content and pets are soft-deleted.
7. Regulation/time-out is AI-triggered only.
8. Reports should be human-friendly and readable.
9. Birth year is frontend-immutable; content difficulty is not recomputed from birth-year changes.
10. Admins see aggregate analytics only, not child-specific identifiable logs/statistics/reports.
11. Fixed star rewards are lecture completion = 1, correct quiz answer = 2, and successful AI game = 3.
12. Raw webcam frame upload/storage is forbidden.
13. Stress/meltdown detection has no threshold beyond negative emotion duration greater than 60 seconds.
14. Admin defines quiz media, answer emotion list, and correct answer; the child sees answer emotions as emojis.

Open questions for the undecided SRS points:

1. What AI game detection confidence threshold defines an accepted successful detection?
2. What is the canonical emotion catalog for quizzes, emotion logs, AI game targets, emoji rendering, and reports?

## Implementation Notes For Future Developers

1. Add role-aware middleware:
   - `requireAuth` already resolves the session.
   - Add `requireRole("PARENT")`, `requireRole("ADMIN")`, and ownership guards for `childId`.
2. Keep parent IDs out of protected routes and request bodies. Resolve the parent from the session.
3. Use transactions for all star-affecting operations:
   - Finish session and award stars.
   - Unlock content.
   - Buy pet.
   - Write `star_transactions` in the same transaction.
4. Prevent negative star balances with conditional updates:
   - Example policy: `UPDATE child_profiles SET total_stars = total_stars - cost WHERE id = $childId AND total_stars >= cost`.
   - If no row updates, return `409 INSUFFICIENT_STARS`.
5. Add idempotency keys for reward and purchase endpoints. Mobile/web clients will retry under bad networks.
6. Do not trust client-submitted `stars_earned`. Backend must derive rewards from fixed content policy: lecture completion = 1, correct quiz answer = 2, successful AI game = 3, and must award stars at most once per `(child_id, content_id)`.
7. Do not trust client-submitted `is_correct` for quizzes. Backend must compare selected answer to stored correct answer/options.
8. Define a strict `preferences` TypeScript type. Avoid loose `any` in preference metadata.
9. Validate admin-defined quiz `answer_emotions` before building the quiz API. `correct_emotion` must be present in `answer_emotions`; final allowed values depend on the TODO emotion catalog.
10. Treat AI scores as frontend-submitted derived outcomes. This backend does not call AI services directly, so reward endpoints need strict score range validation, idempotency, and first-reward enforcement.
11. Store derived webcam events, not raw frames. Raw webcam frame upload/storage is forbidden even if other media upload is introduced.
12. Use cursor pagination for logs, sessions, users, content, and admin analytics. Offset pagination is acceptable only for small admin lists.
13. Keep the existing error envelope from `docs/API.md` for all endpoints.
14. Add rate limits:

- Auth and password reset by IP and identifier.
- Emotion/regulation logs by child and session.
- Admin media upload by admin and file size.

15. Add audit logs for:

- Admin user bans/unbans.
- Admin hard deletes.
- Content publish/soft delete.
- Report exports.
- Password reset completion.

16. For report generation, start with synchronous PDF for bounded date ranges. Move to async jobs if generation exceeds API latency targets.
17. Keep dashboard queries aggregate-first. Avoid loading all logs into memory for weekly/monthly charts.
18. Add indexes before high-volume launch:

- `content_sessions(child_id, created_at desc)` already exists.
- `emotion_logs(child_id, created_at desc)` already exists.
- Add indexes for `device_tokens(user_id)`, `alerts(child_id, created_at desc)`, `star_transactions(child_id, created_at desc)`, and `audit_logs(actor_user_id, created_at desc)`.

19. Content and pet delete routes should set `deleted_at` and exclude those rows from normal browse/store flows. Hard delete should be reserved for an explicit legal-erasure workflow.
20. Keep admin content creation transactional: insert `contents` and exactly one detail row or rollback all changes.

## Recommended Build Order

1. P0 auth completion: password reset, Google SSO, RBAC middleware.
2. P0 child/profile completion: child detail/update/delete and preferences endpoints.
3. P0 content consumption: child content list/detail and content session completion with backend reward policy.
4. P0 tracking/dashboard: emotion log list, dashboard hardening, regulation events.
5. P1 economy/store: atomic content unlocks, pets, and star ledger.
6. P1 notifications/reports: device tokens, alerts, PDF export.
7. P1 admin: content CRUD, media assets, pet CRUD, user management.
8. P2 analytics and operational hardening.
