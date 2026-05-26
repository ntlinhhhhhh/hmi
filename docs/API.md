# Global success response:

## Response body:

- Endpoint-specific

## Status codes:

- [200 OK] - Operation performed successfully
- [201 Created] - Resource created

# Global error responses:

## Response body:

```json
{
  "error": {
    "type": "<endpoint specific error type>",
    "message": "<endpoint specific error message>"
  }
}
```

## Status codes:

- [400 Bad Request] - Input validation failed
- [401 Unauthorized] - Missing, invalid, or expired session token
- [403 Forbidden] - User doesn't satisfy conditions for operation
- [404 Not Found] - Resource not found
- [409 Conflict] - Data update conflicts with existing data
- [413 Payload Too Large] - Uploaded file exceeds the endpoint limit
- [502 Bad Gateway] - Upstream storage operation failed
- [500 Internal Server Error] - Unexpected server error occurred

# Authentication:

Authenticated endpoints require a persisted session token returned by `POST /auth/signup` or `POST /auth/signin`.

```http
Authorization: Bearer <session_token>
```

The backend resolves the authenticated parent from the session token. Clients must not send parent IDs in protected endpoint paths.

# File storage:

Uploaded files are stored in S3-compatible object storage. In local development, Docker Compose runs MinIO. Avatar URLs returned by the API are short-lived presigned download URLs.

Raw webcam frames are forbidden. Current backend endpoints store only derived emotion/game outcomes and must not accept raw webcam frame uploads.

# External AI services:

The HMI backend does not proxy or authenticate external AI services yet. Frontend can call them directly and send only derived results back to this backend.

- Chatbot service default base URL: `http://localhost:8080`
  - `GET /health`
  - `POST /chat`
- Emotion model service default base URL: `http://localhost:9000`
  - `GET /health`
  - `GET /model/info`
  - `GET /model/download`
  - `POST /model/predict`

The emotion model currently returns labels `happy`, `sad`, `angry`, `fear`, and `neutral`. Backend emotion logs normalize them to `HAPPY`, `SAD`, `ANGRY`, `SCARED`, and `NEUTRAL`. The backend also keeps `STRESSED`, `CALM`, and `SURPRISED` for frontend/system-derived events.

# Health Endpoints:

## Health check

- Endpoint:

```text
GET /health
```

- Description: Checks API and database availability.
- Auth required: No

### Request body:

- None

### Responses:

- [200 OK] - API and database are healthy.

```json
{
  "status": "healthy",
  "timestamp": "2026-05-21T07:14:22.170Z",
  "services": {
    "api": "up",
    "database": "up"
  }
}
```

- [503 Service Unavailable] - Database health check failed.

# Auth Endpoints:

## Sign up

- Endpoint:

```text
POST /auth/signup
```

- Description: Creates a parent account using mandatory email/password credentials and immediately creates a persisted login session. Phone number is optional.
- Auth required: No

### Request body (application/json):

- email (string, Required): Must be a valid email format.
- password (string, Required): Must be at least 8 characters.
- phone_number (string, Optional): Must contain 8 to 15 digits and may start with `+`.
- full_name (string, Optional): Must be 120 characters or fewer.
- Example:

```json
{
  "email": "parent@example.com",
  "password": "StrongPass123!",
  "phone_number": "+84901234567",
  "full_name": "Jane Parent"
}
```

### Responses:

- [201 Created] - Account successfully created.

```json
{
  "message": "Account created successfully.",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "parent@example.com",
    "phone_number": "+84901234567",
    "full_name": "Jane Parent",
    "role": "PARENT",
    "status": "ACTIVE",
    "last_login_at": "2026-05-21T07:14:22.170Z",
    "created_at": "2026-05-21T07:14:22.170Z"
  },
  "session": {
    "id": "223e4567-e89b-12d3-a456-426614174000",
    "session_token": "hmi_session_token_value",
    "expires_at": "2026-06-20T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, MISSING_EMAIL, INVALID_EMAIL, MISSING_PASSWORD, WEAK_PASSWORD, INVALID_PHONE_NUMBER, INVALID_FULL_NAME.
- [409 Conflict] - Possible `type` values: EMAIL_TAKEN, PHONE_NUMBER_TAKEN, IDENTIFIER_ALREADY_IN_USE.

## Google Sign-in

- Endpoint:

```text
POST /auth/google
```

- Description: Authenticates a parent using a Google ID token or authorization code and creates a new persisted login session.
- Auth required: No

### Request body (application/json):

- id_token (string, Optional): Google ID token.
- authorization_code (string, Optional): Google authorization code.
- Note: At least one must be provided.

### Responses:

- [200 OK] - Signed in with Google successfully. (Returns session and user objects)
- [400 Bad Request] - MISSING_TOKEN
- [401 Unauthorized] - INVALID_TOKEN

## Password Reset Request

- Endpoint:

```text
POST /auth/password-reset/request
```

- Description: Requests a password reset code (OTP) sent via email for email identifiers or SMS for phone identifiers.
- Auth required: No

### Request body (application/json):

- identifier (string, Required): Parent email or phone number.

### Responses:

- [200 OK] - Returns success message (to prevent user enumeration).
- [500 Internal Server Error] - DELIVERY_FAILED when TextBee SMS delivery is not configured.
- [502 Bad Gateway] - DELIVERY_FAILED when TextBee rejects or fails the delivery request.

### SMS delivery configuration:

Phone reset OTP delivery uses TextBee. Configure `TEXTBEE_API_KEY` and `TEXTBEE_DEVICE_ID`, keep the TextBee Android app online, and ensure the sender SIM can send SMS to the recipient.

## Password Reset Verify

- Endpoint:

```text
POST /auth/password-reset/verify
```

- Description: Verifies the OTP sent via email or SMS and returns a reset token.
- Auth required: No

### Request body (application/json):

- identifier (string, Required): Parent email or phone number.
- otp (string, Required): The 6-digit code.

### Responses:

- [200 OK] - Code verified successfully. Returns a `reset_token`.
- [400 Bad Request] - INVALID_CODE.

## Password Reset Confirm

- Endpoint:

```text
POST /auth/password-reset/confirm
```

- Description: Sets a new password using a verified reset token.
- Auth required: No

### Request body (application/json):

- identifier (string, Required): Parent email or phone number.
- reset_token (string, Required): The reset token obtained from the verify step.
- new_password (string, Required): New password, at least 8 characters.

### Responses:

- [200 OK] - Password updated successfully.
- [400 Bad Request] - WEAK_PASSWORD, INVALID_CODE.

## Sign in

- Endpoint:

```text
POST /auth/signin
```

- Description: Authenticates a parent and creates a new persisted login session. Accepts either email or phone number as the identifier.
- Auth required: No

### Request body (application/json):

- identifier (string, Required): Parent email or phone number.
- password (string, Required): Parent password.
- Example:

```json
{
  "identifier": "parent@example.com",
  "password": "StrongPass123!"
}
```

### Responses:

- [200 OK] - Signed in successfully.

```json
{
  "message": "Signed in successfully.",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "parent@example.com",
    "phone_number": "+84901234567",
    "full_name": "Jane Parent",
    "role": "PARENT",
    "status": "ACTIVE",
    "last_login_at": "2026-05-21T07:14:22.170Z"
  },
  "session": {
    "id": "223e4567-e89b-12d3-a456-426614174000",
    "session_token": "hmi_session_token_value",
    "expires_at": "2026-06-20T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, MISSING_IDENTIFIER, MISSING_PASSWORD.
- [401 Unauthorized] - Possible `type` values: INVALID_CREDENTIALS, UNSUPPORTED_AUTH_PROVIDER.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED.

## Get current parent

- Endpoint:

```text
GET /me
```

- Description: Returns the authenticated parent and active session metadata.
- Auth required: Yes

### Request body:

- None

### Responses:

- [200 OK] - Current parent returned successfully.

```json
{
  "session": {
    "id": "223e4567-e89b-12d3-a456-426614174000",
    "expires_at": "2026-06-20T07:14:22.170Z"
  },
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "parent@example.com",
    "phone_number": "+84901234567",
    "full_name": "Jane Parent",
    "role": "PARENT",
    "status": "ACTIVE",
    "last_login_at": "2026-05-21T07:14:22.170Z",
    "created_at": "2026-05-21T07:10:00.000Z"
  }
}
```

- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED.

## Update current parent

- Endpoint:

```text
PATCH /me
```

- Description: Updates authenticated account profile fields.
- Auth required: Yes

### Request body (application/json):

- email (string, Optional): Must be a valid email format.
- phone_number (string or null, Optional): Must contain 8 to 15 digits and may start with `+`. `null` or empty string clears the phone number.
- full_name (string or null, Optional): Must be 120 characters or fewer. `null` or empty string clears the full name.
- Example:

```json
{
  "email": "new-parent@example.com",
  "phone_number": "+84901234567",
  "full_name": "Jane Parent"
}
```

### Responses:

- [200 OK] - Account profile updated successfully.

```json
{
  "message": "Account profile updated successfully.",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "new-parent@example.com",
    "phone_number": "+84901234567",
    "full_name": "Jane Parent",
    "role": "PARENT",
    "status": "ACTIVE",
    "last_login_at": "2026-05-21T07:14:22.170Z",
    "created_at": "2026-05-21T07:10:00.000Z",
    "updated_at": "2026-05-21T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, MISSING_UPDATE_FIELDS, INVALID_EMAIL, INVALID_PHONE_NUMBER, INVALID_FULL_NAME.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED.
- [404 Not Found] - Possible `type` values: USER_NOT_FOUND.
- [409 Conflict] - Possible `type` values: EMAIL_TAKEN, PHONE_NUMBER_TAKEN, IDENTIFIER_ALREADY_IN_USE.

## Change password

- Endpoint:

```text
PATCH /me/password
```

- Description: Changes password for an authenticated local account.
- Auth required: Yes

### Request body (application/json):

- current_password (string, Required): Current account password.
- new_password (string, Required): New password, at least 8 characters and different from the current password.
- Example:

```json
{
  "current_password": "StrongPass123!",
  "new_password": "NewStrongPass123!"
}
```

### Responses:

- [200 OK] - Password changed successfully.

```json
{
  "message": "Password changed successfully."
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, MISSING_CURRENT_PASSWORD, MISSING_NEW_PASSWORD, WEAK_PASSWORD, SAME_PASSWORD.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION, INVALID_CURRENT_PASSWORD.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, UNSUPPORTED_AUTH_PROVIDER.
- [404 Not Found] - Possible `type` values: USER_NOT_FOUND.

## Sign out

- Endpoint:

```text
DELETE /auth/session
```

- Description: Invalidates the active session.
- Auth required: Yes

### Request body:

- None

### Responses:

- [200 OK] - Signed out successfully.

```json
{
  "message": "Signed out successfully."
}
```

- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED.

# Child Profile Endpoints:

## Create a child profile

- Endpoint:

```text
POST /children
```

- Description: Creates a child profile for the authenticated parent.
- Auth required: Yes

### Request body (multipart/form-data):

- nickname (string, Required): Child display nickname. Must be 80 characters or fewer.
- birth_year (number, Required): Child birth year. Must be an integer from current year minus 18 through current year.
- avatar (file, Optional): Child avatar image. Supported types: JPEG, PNG, WebP, GIF, AVIF. Maximum size: 5 MB.
- Note: `birth_year` is create-only from the frontend. Future child profile update endpoints must not allow frontend birth-year mutation.
- Example:

```text
nickname=Mina
birth_year=2018
avatar=@mina.png;type=image/png
```

### Responses:

- [201 Created] - Child profile successfully created.

```json
{
  "message": "Child profile created successfully.",
  "child": {
    "id": "323e4567-e89b-12d3-a456-426614174000",
    "parent_id": "123e4567-e89b-12d3-a456-426614174000",
    "nickname": "Mina",
    "avatar_url": "http://127.0.0.1:9000/hmi-media/child-avatars/123e4567-e89b-12d3-a456-426614174000/323e4567-e89b-12d3-a456-426614174000.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
    "birth_year": 2018,
    "total_stars": 0,
    "created_at": "2026-05-21T07:14:22.170Z",
    "updated_at": "2026-05-21T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_FORM_DATA, MISSING_NICKNAME, INVALID_NICKNAME, INVALID_AVATAR_FILE, INVALID_BIRTH_YEAR.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND.
- [413 Payload Too Large] - Possible `type` values: AVATAR_TOO_LARGE.
- [502 Bad Gateway] - Possible `type` values: STORAGE_ERROR.

## List child profiles

- Endpoint:

```text
GET /children
```

- Description: Lists child profiles owned by the authenticated parent.
- Auth required: Yes

### Request body:

- None

### Responses:

- [200 OK] - Child profiles returned successfully.

```json
{
  "children": [
    {
      "id": "323e4567-e89b-12d3-a456-426614174000",
      "parent_id": "123e4567-e89b-12d3-a456-426614174000",
      "nickname": "Mina",
      "avatar_url": "http://127.0.0.1:9000/hmi-media/child-avatars/123e4567-e89b-12d3-a456-426614174000/323e4567-e89b-12d3-a456-426614174000.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
      "birth_year": 2018,
      "total_stars": 12,
      "created_at": "2026-05-21T07:14:22.170Z",
      "updated_at": "2026-05-21T07:14:22.170Z",
      "preferences": {
        "is_high_contrast": false,
        "preferences": {
          "theme": "default"
        }
      }
    }
  ]
}
```

- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND.

## Get child profile

- Endpoint:

```text
GET /children/:childId
```

- Description: Returns one child profile owned by the authenticated parent.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Responses:

- [200 OK] - Child profile returned successfully.

```json
{
  "child": {
    "id": "323e4567-e89b-12d3-a456-426614174000",
    "parent_id": "123e4567-e89b-12d3-a456-426614174000",
    "nickname": "Mina",
    "avatar_url": "http://127.0.0.1:9000/hmi-media/child-avatars/...?...",
    "birth_year": 2018,
    "total_stars": 12,
    "created_at": "2026-05-21T07:14:22.170Z",
    "updated_at": "2026-05-21T07:14:22.170Z",
    "preferences": {
      "is_high_contrast": false,
      "preferences": {
        "theme": "default"
      }
    }
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_CHILD_ID.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND.

## Update child profile

- Endpoint:

```text
PATCH /children/:childId
```

- Description: Updates mutable child profile fields. `birth_year` is immutable from the frontend.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Request body (multipart/form-data):

- nickname (string, Optional): Child display nickname. Must be 80 characters or fewer.
- avatar (file, Optional): Child avatar image. Supported types: JPEG, PNG, WebP, GIF, AVIF. Maximum size: 5 MB.

### Responses:

- [200 OK] - Child profile updated successfully.

```json
{
  "message": "Child profile updated successfully.",
  "child": {
    "id": "323e4567-e89b-12d3-a456-426614174000",
    "parent_id": "123e4567-e89b-12d3-a456-426614174000",
    "nickname": "Mina",
    "avatar_url": "http://127.0.0.1:9000/hmi-media/child-avatars/...?...",
    "birth_year": 2018,
    "total_stars": 12,
    "created_at": "2026-05-21T07:14:22.170Z",
    "updated_at": "2026-05-21T07:20:00.000Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_FORM_DATA, INVALID_CHILD_ID, MISSING_UPDATE_FIELDS, MISSING_NICKNAME, INVALID_NICKNAME, INVALID_AVATAR_FILE.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND.
- [413 Payload Too Large] - Possible `type` values: AVATAR_TOO_LARGE.
- [502 Bad Gateway] - Possible `type` values: STORAGE_ERROR.

## Delete child profile

- Endpoint:

```text
DELETE /children/:childId
```

- Description: Deletes a child profile owned by the authenticated parent and cascades dependent database records.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Request body (application/json):

- confirmation (string, Required): Must be exactly `DELETE`.

### Responses:

- [200 OK] - Child profile deleted successfully.

```json
{
  "message": "Child profile deleted successfully."
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, INVALID_CHILD_ID, MISSING_CONFIRMATION, INVALID_CONFIRMATION.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND.

# Preference Endpoints:

## Get child preferences

- Endpoint:

```text
GET /children/:childId/preferences
```

- Description: Returns sensory/UI preferences for a child profile owned by the authenticated parent.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Responses:

- [200 OK] - Preferences returned successfully.

```json
{
  "preferences": {
    "child_id": "323e4567-e89b-12d3-a456-426614174000",
    "is_high_contrast": false,
    "preferences": {
      "theme": "default",
      "music_volume": 40,
      "high_contrast_enabled": false,
      "reduced_motion_enabled": false
    },
    "created_at": "2026-05-21T07:14:22.170Z",
    "updated_at": "2026-05-21T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_CHILD_ID.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND, PREFERENCES_NOT_FOUND.

## Update child preferences

- Endpoint:

```text
PATCH /children/:childId/preferences
```

- Description: Updates typed child UI preferences for a child profile owned by the authenticated parent.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Request body (application/json):

- is_high_contrast (boolean, Optional): Fast high-contrast flag.
- preferences (object, Optional): Typed settings object. Allowed keys: `theme`, `music_track_id`, `music_volume`, `high_contrast_enabled`, `reduced_motion_enabled`.

```json
{
  "is_high_contrast": true,
  "preferences": {
    "theme": "high_contrast",
    "music_track_id": "calm-1",
    "music_volume": 35,
    "high_contrast_enabled": true,
    "reduced_motion_enabled": true
  }
}
```

### Responses:

- [200 OK] - Preferences updated successfully.
- [400 Bad Request] - Possible `type` values: INVALID_JSON, INVALID_CHILD_ID, MISSING_UPDATE_FIELDS, INVALID_IS_HIGH_CONTRAST, INVALID_PREFERENCES.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND, PREFERENCES_NOT_FOUND.

# Learning Content Endpoints:

## List child contents

- Endpoint:

```text
GET /children/:childId/contents
```

- Description: Lists published, non-deleted learning content for a child, including unlock state and progress summary.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Query parameters:

- type (string, Optional): `LECTURE`, `QUIZ`, or `GAME`.
- difficulty_level (number, Optional): Integer from 1 to 3.
- include_locked (boolean string, Optional): Defaults to `true`. Use `false` to return only unlocked content.

### Responses:

- [200 OK] - Contents returned successfully.

```json
{
  "contents": [
    {
      "id": "723e4567-e89b-12d3-a456-426614174000",
      "title": "Happy Faces",
      "type": "LECTURE",
      "status": "PUBLISHED",
      "created_by": null,
      "created_at": "2026-05-21T07:14:22.170Z",
      "updated_at": "2026-05-21T07:14:22.170Z",
      "deleted_at": null,
      "difficulty_level": 1,
      "unlock_star_cost": 0,
      "is_unlocked": true,
      "unlock": {
        "id": "823e4567-e89b-12d3-a456-426614174000",
        "unlocked_at": "2026-05-21T07:14:22.170Z"
      },
      "progress": {
        "total_sessions": 3,
        "completed_sessions": 2,
        "stars_earned": 1,
        "last_session_at": "2026-05-21T07:20:00.000Z"
      },
      "lecture": {
        "media_url": "content/happy.png",
        "description": "Recognize happy expressions.",
        "difficulty_level": 1,
        "is_default": true
      },
      "quiz": null,
      "game": null
    }
  ]
}
```

- For `GAME` content, `game.prompt_asset_type` can be `ICON`, `IMAGE`, `VIDEO`, or `null`; this supports the current frontend plan of level 1 icon, level 2 image, and level 3 video prompts. `game.prompt_asset_url` stores the optional prompt asset location.

- [400 Bad Request] - Possible `type` values: INVALID_CHILD_ID, INVALID_CONTENT_TYPE, INVALID_DIFFICULTY_LEVEL, INVALID_INCLUDE_LOCKED.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND.

## Get content detail

- Endpoint:

```text
GET /contents/:contentId
```

- Description: Returns a published, non-deleted content item. Optional `child_id` adds unlock state and progress for an owned child.
- Auth required: Yes

### Request parameters:

- contentId (string, Required): UUID of the content.

### Query parameters:

- child_id (string, Optional): UUID of an owned child profile.

### Responses:

- [200 OK] - Content returned successfully. Response shape matches one item from `GET /children/:childId/contents`.
- [400 Bad Request] - Possible `type` values: INVALID_CONTENT_ID, INVALID_CHILD_ID.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: USER_NOT_FOUND, PARENT_NOT_FOUND, CHILD_NOT_FOUND, CONTENT_NOT_FOUND.

## Record lecture content session

- Endpoint:

```text
POST /children/:childId/content-sessions
```

- Description: Records a lecture completion or abandonment for an unlocked published lecture. Quiz and AI game submission rules are still not implemented on this endpoint.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Request body (application/json):

- content_id (string, Required): UUID of an unlocked published lecture.
- idempotency_key (string, Optional): Retry key, 120 characters or fewer. Reusing the same key for the same content returns the existing session.
- duration_seconds (number, Optional): Positive integer duration in seconds.
- status (string, Optional): `COMPLETED` or `ABANDONED`. Defaults to `COMPLETED`.
- started_at (string, Optional): ISO date.
- completed_at (string, Optional): ISO date, not before `started_at`.
- metadata (object, Optional): Extra derived client context. Must be a JSON object, no raw image/frame data.

### Responses:

- [201 Created] - Content session recorded successfully.

```json
{
  "message": "Content session recorded successfully.",
  "session": {
    "id": "923e4567-e89b-12d3-a456-426614174000",
    "child_id": "323e4567-e89b-12d3-a456-426614174000",
    "content_id": "723e4567-e89b-12d3-a456-426614174000",
    "unlock_content_id": "823e4567-e89b-12d3-a456-426614174000",
    "duration_seconds": 120,
    "is_correct": null,
    "stars_earned": 1,
    "status": "COMPLETED",
    "idempotency_key": "lecture-723e4567-run-1",
    "started_at": "2026-05-21T07:10:22.170Z",
    "completed_at": "2026-05-21T07:12:22.170Z",
    "metadata": null,
    "created_at": "2026-05-21T07:12:22.170Z"
  },
  "stars_earned": 1,
  "child_total_stars": 13
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, INVALID_CHILD_ID, MISSING_CONTENT_ID, INVALID_CONTENT_ID, CONTENT_TYPE_NOT_SUPPORTED, INVALID_STATUS, INVALID_DURATION, INVALID_IDEMPOTENCY_KEY, INVALID_STARTED_AT, INVALID_COMPLETED_AT, INVALID_METADATA.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED, CONTENT_LOCKED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND, CONTENT_NOT_FOUND.
- [409 Conflict] - Possible `type` values: IDEMPOTENCY_KEY_CONFLICT.

## Unlock child content

- Endpoint:

```text
POST /children/:childId/contents/:contentId/unlock
```

- Description: Atomically spends a child's stars and creates an unlock record for published content.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.
- contentId (string, Required): UUID of the content.

### Responses:

- [201 Created] - Content unlocked successfully.

```json
{
  "message": "Content unlocked successfully.",
  "child_total_stars": 4,
  "unlock": {
    "id": "823e4567-e89b-12d3-a456-426614174000",
    "child_id": "323e4567-e89b-12d3-a456-426614174000",
    "content_id": "723e4567-e89b-12d3-a456-426614174000",
    "unlocked_at": "2026-05-21T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_CHILD_ID, INVALID_CONTENT_ID.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND, CONTENT_NOT_FOUND.
- [409 Conflict] - Possible `type` values: CONTENT_ALREADY_UNLOCKED, INSUFFICIENT_STARS.

# Pet Store Endpoints:

## List active pets

- Endpoint:

```text
GET /pets
```

- Description: Lists active, non-deleted pets available in the store.
- Auth required: Yes

### Responses:

- [200 OK] - Active pets returned successfully.

```json
{
  "pets": [
    {
      "id": "523e4567-e89b-12d3-a456-426614174000",
      "name": "Calm Cat",
      "description": "A calming companion.",
      "image_url": "pets/calm-cat.png",
      "animation_url": null,
      "unlock_star_cost": 10,
      "status": "ACTIVE",
      "created_at": "2026-05-21T07:14:22.170Z",
      "updated_at": "2026-05-21T07:14:22.170Z"
    }
  ]
}
```

- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED.

## List child pets

- Endpoint:

```text
GET /children/:childId/pets
```

- Description: Lists pets owned by a child profile owned by the authenticated parent.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Responses:

- [200 OK] - Child pets returned successfully.

```json
{
  "child_pets": [
    {
      "id": "623e4567-e89b-12d3-a456-426614174000",
      "child_id": "323e4567-e89b-12d3-a456-426614174000",
      "pet_id": "523e4567-e89b-12d3-a456-426614174000",
      "custom_name": "Mochi",
      "unlocked_at": "2026-05-21T07:14:22.170Z",
      "pet": {
        "id": "523e4567-e89b-12d3-a456-426614174000",
        "name": "Calm Cat",
        "description": "A calming companion.",
        "image_url": "pets/calm-cat.png",
        "animation_url": null,
        "unlock_star_cost": 10,
        "status": "ACTIVE",
        "deleted_at": null
      }
    }
  ]
}
```

- [400 Bad Request] - Possible `type` values: INVALID_CHILD_ID.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND.

## Buy pet

- Endpoint:

```text
POST /children/:childId/pets
```

- Description: Buys an active pet for a child using the child's star balance. Star deduction is atomic with ownership creation.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Request body (application/json):

- pet_id (string, Required): UUID of an active, non-deleted pet.
- custom_name (string, Optional): Custom pet name. Must be 80 characters or fewer.

### Responses:

- [201 Created] - Pet purchased successfully.

```json
{
  "message": "Pet purchased successfully.",
  "child_total_stars": 2,
  "child_pet": {
    "id": "623e4567-e89b-12d3-a456-426614174000",
    "child_id": "323e4567-e89b-12d3-a456-426614174000",
    "pet_id": "523e4567-e89b-12d3-a456-426614174000",
    "custom_name": "Mochi",
    "unlocked_at": "2026-05-21T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, INVALID_CHILD_ID, MISSING_PET_ID, INVALID_PET_ID, INVALID_CUSTOM_NAME.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND, PET_NOT_FOUND.
- [409 Conflict] - Possible `type` values: INSUFFICIENT_STARS, PET_ALREADY_OWNED.

## Rename owned pet

- Endpoint:

```text
PATCH /children/:childId/pets/:childPetId
```

- Description: Renames or clears the custom name for a pet owned by the child.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.
- childPetId (string, Required): UUID of the child-pet ownership record.

### Request body (application/json):

- custom_name (string or null, Required): New custom name. Must be 80 characters or fewer. `null` or empty string clears the custom name.

### Responses:

- [200 OK] - Pet renamed successfully.

```json
{
  "message": "Pet renamed successfully.",
  "child_pet": {
    "id": "623e4567-e89b-12d3-a456-426614174000",
    "child_id": "323e4567-e89b-12d3-a456-426614174000",
    "pet_id": "523e4567-e89b-12d3-a456-426614174000",
    "custom_name": "Mochi",
    "unlocked_at": "2026-05-21T07:14:22.170Z",
    "pet": {
      "id": "523e4567-e89b-12d3-a456-426614174000",
      "name": "Calm Cat",
      "image_url": "pets/calm-cat.png",
      "animation_url": null
    }
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, INVALID_CHILD_ID, INVALID_CHILD_PET_ID, INVALID_CUSTOM_NAME.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND, CHILD_PET_NOT_FOUND.

# Admin Pet Catalog Endpoints:

Admin endpoints require an authenticated user with `role = ADMIN` and `status = ACTIVE`.

## List admin pets

- Endpoint:

```text
GET /admin/pets
```

- Description: Lists non-deleted pet catalog items, including hidden pets.
- Auth required: Yes, admin only

### Query parameters:

- status (string, Optional): `ACTIVE` or `HIDDEN`.
- search (string, Optional): Search by pet name or description, 120 characters or fewer.
- limit (number, Optional): Integer from 1 to 100. Defaults to 50.

### Responses:

- [200 OK] - Pets returned successfully.
- [400 Bad Request] - Possible `type` values: INVALID_STATUS, INVALID_SEARCH, INVALID_LIMIT.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, NOT_ADMIN.
- [404 Not Found] - Possible `type` values: ADMIN_NOT_FOUND.

## Create admin pet

- Endpoint:

```text
POST /admin/pets
```

- Description: Creates a pet catalog item.
- Auth required: Yes, admin only

### Request body (application/json):

- name (string, Required): Pet name, 80 characters or fewer.
- description (string or null, Optional): Description, 500 characters or fewer.
- image_url (string, Required): Image key or URL, 2048 characters or fewer.
- animation_url (string or null, Optional): Animation key or URL, 2048 characters or fewer.
- unlock_star_cost (number, Required): Non-negative integer.
- status (string, Optional): `ACTIVE` or `HIDDEN`. Defaults to `ACTIVE`.

### Responses:

- [201 Created] - Pet catalog item created successfully.

```json
{
  "message": "Pet catalog item created successfully.",
  "pet": {
    "id": "523e4567-e89b-12d3-a456-426614174000",
    "name": "Calm Cat",
    "description": "A calming companion.",
    "image_url": "pets/calm-cat.png",
    "animation_url": null,
    "unlock_star_cost": 10,
    "status": "ACTIVE",
    "created_at": "2026-05-21T07:14:22.170Z",
    "updated_at": "2026-05-21T07:14:22.170Z",
    "deleted_at": null
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, INVALID_NAME, INVALID_DESCRIPTION, INVALID_IMAGE_URL, INVALID_ANIMATION_URL, INVALID_UNLOCK_STAR_COST, INVALID_STATUS.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, NOT_ADMIN.
- [404 Not Found] - Possible `type` values: ADMIN_NOT_FOUND.

## Update admin pet

- Endpoint:

```text
PATCH /admin/pets/:petId
```

- Description: Updates mutable pet catalog fields.
- Auth required: Yes, admin only

### Request parameters:

- petId (string, Required): UUID of the pet catalog item.

### Request body (application/json):

- Any subset of `name`, `description`, `image_url`, `animation_url`, `unlock_star_cost`, and `status`.

### Responses:

- [200 OK] - Pet catalog item updated successfully.
- [400 Bad Request] - Possible `type` values: INVALID_JSON, INVALID_PET_ID, MISSING_UPDATE_FIELDS, INVALID_NAME, INVALID_DESCRIPTION, INVALID_IMAGE_URL, INVALID_ANIMATION_URL, INVALID_UNLOCK_STAR_COST, INVALID_STATUS.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, NOT_ADMIN.
- [404 Not Found] - Possible `type` values: ADMIN_NOT_FOUND, PET_NOT_FOUND.

## Delete admin pet

- Endpoint:

```text
DELETE /admin/pets/:petId
```

- Description: Soft-deletes a pet catalog item by setting `deleted_at` and hiding it from normal store flows. Child ownership history remains intact.
- Auth required: Yes, admin only

### Request parameters:

- petId (string, Required): UUID of the pet catalog item.

### Request body (application/json):

- confirmation (string, Required): Must be exactly `DELETE`.

### Responses:

- [200 OK] - Pet catalog item deleted successfully.
- [400 Bad Request] - Possible `type` values: INVALID_JSON, INVALID_PET_ID, MISSING_CONFIRMATION, INVALID_CONFIRMATION.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, NOT_ADMIN.
- [404 Not Found] - Possible `type` values: ADMIN_NOT_FOUND, PET_NOT_FOUND.

# Admin User Endpoints:

## List admin users

- Endpoint:

```text
GET /admin/users
```

- Description: Lists users for admin review with bounded cursor pagination.
- Auth required: Yes, admin only

### Query parameters:

- role (string, Optional): `PARENT` or `ADMIN`.
- status (string, Optional): `ACTIVE` or `BANNED`.
- search (string, Optional): Search by email, phone number, or full name, 120 characters or fewer.
- cursor (string, Optional): ISO `created_at` cursor returned as `next_cursor`.
- limit (number, Optional): Integer from 1 to 100. Defaults to 50.

### Responses:

- [200 OK] - Users returned successfully.

```json
{
  "users": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "parent@example.com",
      "phone_number": "+84901234567",
      "auth_provider": "LOCAL",
      "full_name": "Nguyen Parent",
      "role": "PARENT",
      "status": "ACTIVE",
      "last_login_at": "2026-05-21T07:14:22.170Z",
      "created_at": "2026-05-21T07:14:22.170Z",
      "updated_at": "2026-05-21T07:14:22.170Z"
    }
  ],
  "next_cursor": null
}
```

- [400 Bad Request] - Possible `type` values: INVALID_ROLE, INVALID_STATUS, INVALID_SEARCH, INVALID_CURSOR, INVALID_LIMIT.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, NOT_ADMIN.
- [404 Not Found] - Possible `type` values: ADMIN_NOT_FOUND.

## Get admin user detail

- Endpoint:

```text
GET /admin/users/:userId
```

- Description: Returns one user plus child count and session summary. Password hashes and provider IDs are never returned.
- Auth required: Yes, admin only

### Request parameters:

- userId (string, Required): UUID of the user.

### Responses:

- [200 OK] - User detail returned successfully.

```json
{
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "parent@example.com",
    "phone_number": "+84901234567",
    "auth_provider": "LOCAL",
    "full_name": "Nguyen Parent",
    "role": "PARENT",
    "status": "ACTIVE",
    "last_login_at": "2026-05-21T07:14:22.170Z",
    "created_at": "2026-05-21T07:14:22.170Z",
    "updated_at": "2026-05-21T07:14:22.170Z"
  },
  "child_count": 1,
  "sessions": {
    "total_sessions": 3,
    "active_sessions": 1,
    "last_used_at": "2026-05-21T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_USER_ID.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, NOT_ADMIN.
- [404 Not Found] - Possible `type` values: ADMIN_NOT_FOUND, USER_NOT_FOUND.

# Tracking Endpoints:

## Record an emotion log

- Endpoint:

```text
POST /children/:childId/emotion-logs
```

- Description: Records a derived emotion event for a child profile owned by the authenticated parent. The backend stores the event only; AI/computer-vision inference runs outside this service.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Request body (application/json):

- emotion_value (string, Optional if `ai_result.emotion` is provided): One of `HAPPY`, `SAD`, `ANGRY`, `STRESSED`, `CALM`, `NEUTRAL`, `SCARED`, `SURPRISED`. Also accepts external model labels `happy`, `sad`, `angry`, `fear`, `neutral` and normalizes them to backend values.
- trigger_source (string, Required): One of `AAC_BOARD`, `GAME`, `QUIZ`, `LECTURE`, `WEBCAM`, `SYSTEM`.
- duration_seconds (number, Optional): Positive integer duration in seconds.
- confidence_score (number, Optional): Normalized confidence from 0 to 1.
- ai_emotion_label (string, Optional): Raw emotion label from the model. Accepted labels: `happy`, `sad`, `angry`, `fear`, `neutral`.
- ai_confidence (number, Optional): Raw model confidence from 0 to 1.
- ai_scores (object, Optional): Per-label model scores. Keys must be supported model labels and values must be numbers from 0 to 1.
- ai_result (object, Optional): Direct model response shape with `emotion`, `confidence`, and `all_scores`. This is a convenience wrapper for the fields above.
- metadata (object, Optional): Extra derived client context. Must be JSON object, no raw image/frame data.
- Example:

```json
{
  "trigger_source": "WEBCAM",
  "duration_seconds": 60,
  "ai_result": {
    "emotion": "fear",
    "confidence": 0.82,
    "all_scores": {
      "happy": 0.02,
      "sad": 0.08,
      "angry": 0.04,
      "fear": 0.82,
      "neutral": 0.04
    }
  },
  "metadata": {
    "source": "model_server",
    "input_size": "64x64 grayscale"
  }
}
```

### Responses:

- [201 Created] - Emotion log recorded successfully.

```json
{
  "message": "Emotion log recorded successfully.",
  "log": {
    "id": "423e4567-e89b-12d3-a456-426614174000",
    "child_id": "323e4567-e89b-12d3-a456-426614174000",
    "emotion_value": "SCARED",
    "trigger_source": "WEBCAM",
    "duration_seconds": 60,
    "confidence_score": 0.82,
    "ai_emotion_label": "fear",
    "ai_confidence": 0.82,
    "ai_scores": {
      "happy": 0.02,
      "sad": 0.08,
      "angry": 0.04,
      "fear": 0.82,
      "neutral": 0.04
    },
    "metadata": {
      "source": "model_server",
      "input_size": "64x64 grayscale"
    },
    "created_at": "2026-05-21T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, INVALID_CHILD_ID, MISSING_EMOTION_VALUE, INVALID_EMOTION_VALUE, EMOTION_AI_RESULT_MISMATCH, MISSING_TRIGGER_SOURCE, INVALID_TRIGGER_SOURCE, INVALID_DURATION, INVALID_CONFIDENCE_SCORE, INVALID_AI_RESULT, INVALID_AI_SCORES, INVALID_METADATA.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, CHILD_NOT_OWNED_BY_PARENT.
- [404 Not Found] - Possible `type` values: CHILD_NOT_FOUND.

## List emotion logs

- Endpoint:

```text
GET /children/:childId/emotion-logs
```

- Description: Lists emotion logs for a child profile owned by the authenticated parent. Supports bounded cursor pagination by `created_at`.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.

### Query parameters:

- emotion (string, Optional): One of the supported backend emotion values or external model labels.
- trigger_source (string, Optional): One of the supported trigger sources.
- from (string, Optional): ISO date lower bound.
- to (string, Optional): ISO date upper bound.
- cursor (string, Optional): ISO `created_at` cursor returned as `next_cursor`.
- limit (number, Optional): Integer from 1 to 100. Defaults to 50.

### Responses:

- [200 OK] - Emotion logs returned successfully.

```json
{
  "logs": [
    {
      "id": "423e4567-e89b-12d3-a456-426614174000",
      "child_id": "323e4567-e89b-12d3-a456-426614174000",
      "emotion_value": "HAPPY",
      "trigger_source": "GAME",
      "duration_seconds": 60,
      "confidence_score": null,
      "ai_emotion_label": null,
      "ai_confidence": null,
      "ai_scores": null,
      "metadata": null,
      "created_at": "2026-05-21T07:14:22.170Z"
    }
  ],
  "next_cursor": null
}
```

- [400 Bad Request] - Possible `type` values: INVALID_CHILD_ID, INVALID_EMOTION_VALUE, INVALID_TRIGGER_SOURCE, INVALID_DATE_RANGE, INVALID_CURSOR, INVALID_LIMIT.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND.

## Get child dashboard

- Endpoint:

```text
GET /children/:childId/dashboard
```

- Description: Returns dashboard metrics for a child profile owned by the authenticated parent.
- Auth required: Yes

### Request parameters:

- childId (string, Required): UUID of the child profile.
- days (number, Optional): Query parameter. Integer from 1 to 90. Defaults to 7.

### Request body:

- None

### Responses:

- [200 OK] - Dashboard returned successfully.

```json
{
  "child": {
    "id": "323e4567-e89b-12d3-a456-426614174000",
    "nickname": "Mina",
    "total_stars": 12,
    "birth_year": 2018
  },
  "learning": {
    "total_sessions": 10,
    "completed_sessions": 8,
    "total_stars": 12,
    "correct_answers": 24,
    "total_quizzes": 30,
    "success_rate": 80
  },
  "emotions": [
    {
      "emotion": "HAPPY",
      "count": 5
    }
  ],
  "chatbot_alerts": {
    "total": 1,
    "recent": [
      {
        "id": "a23e4567-e89b-12d3-a456-426614174000",
        "reason": "The child sent an unusual chatbot message.",
        "notification_status": "SENT",
        "notification_sent_at": "2026-05-21T07:14:22.170Z",
        "notification_error": null,
        "created_at": "2026-05-21T07:14:22.170Z"
      }
    ]
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_CHILD_ID, INVALID_DAYS.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, CHILD_NOT_OWNED_BY_PARENT.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND.

## Export child summary PDF

- Endpoint:

```text
GET /children/:childId/reports/summary.pdf
```

- Description: Exports a human-friendly PDF report for the child. The default range is the last 7 days.
- Auth required: Yes

### Query parameters:

- from (string, Optional): ISO date or timestamp lower bound.
- to (string, Optional): ISO date or timestamp upper bound.
- days (number, Optional): Integer from 1 to 90. Used when `from` is omitted. Defaults to 7.

### Responses:

- [200 OK] - `application/pdf` with `Content-Disposition: attachment`.
- [400 Bad Request] - Possible `type` values: INVALID_FROM, INVALID_TO, INVALID_DAYS, INVALID_DATE_RANGE.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, PARENT_NOT_ACTIVE, CHILD_NOT_OWNED.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND.

The report includes daily activities, completed/quit counts, emotion summary, and chatbot warning alerts.

## List child learning history (content sessions)

- Endpoint:

```text
GET /children/:childId/content-sessions
```

- Description: Returns a paginated list of content sessions (learning history) for a child profile owned by the authenticated parent.
- Auth required: Yes

### Query parameters:

- type (string, Optional): `LECTURE`, `QUIZ`, or `GAME`.
- status (string, Optional): `COMPLETED` or `ABANDONED`.
- from (string, Optional): ISO datetime start boundary.
- to (string, Optional): ISO datetime end boundary.
- limit (number, Optional): Integer from 1 to 100. Defaults to 20.
- cursor (string, Optional): Created at timestamp for pagination.

### Responses:

- [200 OK] - Learning history returned successfully.

```json
{
  "sessions": [
    {
      "id": "e23e4567-e89b-12d3-a456-426614174000",
      "child_id": "323e4567-e89b-12d3-a456-426614174000",
      "content_id": "c23e4567-e89b-12d3-a456-426614174000",
      "unlock_content_id": "u23e4567-e89b-12d3-a456-426614174000",
      "duration_seconds": 120,
      "is_correct": true,
      "stars_earned": 2,
      "status": "COMPLETED",
      "created_at": "2026-05-21T07:14:22.170Z"
    }
  ],
  "next_cursor": null
}
```

## List child star transactions

- Endpoint:

```text
GET /children/:childId/star-transactions
```

- Description: Returns a paginated list of star transactions (ledger history) for a child profile owned by the authenticated parent.
- Auth required: Yes

### Query parameters:

- limit (number, Optional): Integer from 1 to 100. Defaults to 20.
- cursor (string, Optional): Created at timestamp for pagination.

### Responses:

- [200 OK] - Star transactions returned successfully.

```json
{
  "transactions": [
    {
      "id": "t23e4567-e89b-12d3-a456-426614174000",
      "child_id": "323e4567-e89b-12d3-a456-426614174000",
      "amount": -10,
      "type": "PET_PURCHASE",
      "source_id": "523e4567-e89b-12d3-a456-426614174000",
      "created_at": "2026-05-21T07:14:22.170Z"
    }
  ],
  "next_cursor": null
}
```

## Register a parent device for push notifications

- Endpoint:

```text
POST /devices
```

- Description: Registers parent push notification device tokens.
- Auth required: Yes

### Request body (application/json):

- platform (string, Required): `WEB`, `IOS`, or `ANDROID`.
- push_token (string, Required): Unique push token.
- app_instance_id (string, Optional): Unique app installation instance.

```json
{
  "platform": "WEB",
  "push_token": "fcm_token_xyz_123",
  "app_instance_id": "inst_abc_567"
}
```

### Responses:

- [201 Created] - Device token registered.

```json
{
  "id": "d23e4567-e89b-12d3-a456-426614174000",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "platform": "WEB",
  "push_token": "fcm_token_xyz_123",
  "app_instance_id": "inst_abc_567",
  "is_active": true,
  "created_at": "2026-05-21T07:14:22.170Z",
  "updated_at": "2026-05-21T07:14:22.170Z"
}
```

## Delete/deactivate a push device

- Endpoint:

```text
DELETE /devices/:deviceId
```

- Description: Deregisters a device push token.
- Auth required: Yes

### Responses:

- [200 OK] - Device deleted successfully.

```json
{
  "message": "Device unregistered successfully."
}
```

## Record chatbot warning alert

- Endpoint:

```text
POST /children/:childId/alerts
```

- Description: Persists a frontend-classified chatbot warning event and immediately sends push notifications to active parent devices.
- Auth required: Yes

### Request body (application/json):

- reason (string, Required): Warning reason shown as the push notification body. Maximum 1000 characters.

```json
{
  "reason": "The child sent an unusual chatbot message."
}
```

### Responses:

- [201 Created] - Chatbot warning alert recorded successfully.

```json
{
  "message": "Chatbot warning alert recorded successfully.",
  "alert": {
    "id": "a23e4567-e89b-12d3-a456-426614174000",
    "child_id": "323e4567-e89b-12d3-a456-426614174000",
    "reason": "The child sent an unusual chatbot message.",
    "source": "CHATBOT",
    "notification_status": "SENT",
    "notification_sent_at": "2026-05-21T07:14:22.170Z",
    "notification_error": null,
    "created_at": "2026-05-21T07:14:22.170Z"
  }
}
```

- Push title: `HMI - Chatbot Warnings`
- Push body: `reason`

## List parent alerts for a child

- Endpoint:

```text
GET /children/:childId/alerts
```

- Description: Lists persisted chatbot warning alerts for a child profile owned by the authenticated parent.
- Auth required: Yes

### Query parameters:

- from (string, Optional): ISO datetime start boundary.
- to (string, Optional): ISO datetime end boundary.
- cursor (string, Optional): Pagination cursor.
- limit (number, Optional): Integer from 1 to 100. Defaults to 20.

### Responses:

- [200 OK] - Alerts returned successfully.

```json
{
  "alerts": [
    {
      "id": "a23e4567-e89b-12d3-a456-426614174000",
      "child_id": "323e4567-e89b-12d3-a456-426614174000",
      "reason": "The child sent an unusual chatbot message.",
      "source": "CHATBOT",
      "notification_status": "SENT",
      "notification_sent_at": "2026-05-21T07:14:22.170Z",
      "notification_error": null,
      "created_at": "2026-05-21T07:14:22.170Z"
    }
  ],
  "next_cursor": null
}
```

## Upload admin media asset

- Endpoint:

```text
POST /admin/media-assets
```

- Description: Uploads a media file to configured S3-compatible storage and stores metadata.
- Auth required: Yes, admin only

### Request body (multipart/form-data):

- file (file, Required): Non-empty file, maximum 50 MB.
- purpose (string, Required): Caller-defined media purpose, for example `CONTENT_MEDIA` or `PET_IMAGE`.

### Responses:

- [201 Created] - Media asset uploaded successfully.

```json
{
  "message": "Media asset created and uploaded successfully.",
  "media_asset": {
    "id": "m23e4567-e89b-12d3-a456-426614174000",
    "file_name": "lesson.mp4",
    "storage_key": "media-assets/m23e4567-e89b-12d3-a456-426614174000-lesson.mp4",
    "mime_type": "video/mp4",
    "size_bytes": 1024000,
    "purpose": "CONTENT_MEDIA",
    "created_by": "123e4567-e89b-12d3-a456-426614174000",
    "url": "https://storage.example.com/presigned-url",
    "created_at": "2026-05-21T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: MISSING_FILE, INVALID_PURPOSE.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, NOT_ADMIN.
- [413 Payload Too Large] - Possible `type` values: FILE_TOO_LARGE.
- [502 Bad Gateway] - Possible `type` values: STORAGE_ERROR.

## List all content including drafts (Admin)

- Endpoint:

```text
GET /admin/contents
```

- Description: Lists all content in the catalog including drafts and soft-deleted entries.
- Auth required: Yes (Admin role required)

### Query parameters:

- type (string, Optional): `LECTURE`, `QUIZ`, or `GAME`.
- status (string, Optional): `DRAFT` or `PUBLISHED`.
- search (string, Optional): Search query matching titles.
- limit (number, Optional): Integer from 1 to 100. Defaults to 20.
- cursor (string, Optional): Pagination cursor.

### Responses:

- [200 OK] - Content catalog returned successfully.

```json
{
  "contents": [
    {
      "id": "c23e4567-e89b-12d3-a456-426614174000",
      "title": "Emotion Lecture 1",
      "type": "LECTURE",
      "status": "PUBLISHED",
      "created_by": "admin-uuid",
      "lecture": {
        "media_url": "https://example.com/media.mp4",
        "description": "Intro to Happy emotion"
      }
    }
  ],
  "next_cursor": null
}
```

## Create lecture, quiz, or game (Admin)

- Endpoint:

```text
POST /admin/contents
```

- Description: Creates a new learning content item with type-specific details.
- Auth required: Yes (Admin role required)

### Request body (application/json):

- title (string, Required)
- type (string, Required): `LECTURE`, `QUIZ`, or `GAME`.
- status (string, Optional): `DRAFT` or `PUBLISHED`. Defaults to `DRAFT`.
- lecture/quiz/game (object, Required depending on type): Type payload.

```json
{
  "title": "Quiz - Identifying Anger",
  "type": "QUIZ",
  "status": "PUBLISHED",
  "quiz": {
    "mediaUrl": "https://example.com/quiz-anger.jpg",
    "description": "Which face shows anger?",
    "difficultyLevel": 1,
    "answerEmotions": ["HAPPY", "ANGRY", "SAD"],
    "correctEmotion": "ANGRY"
  }
}
```

### Responses:

- [201 Created] - Content successfully created.

```json
{
  "message": "Content created successfully.",
  "content": {
    "id": "q23e4567-e89b-12d3-a456-426614174000",
    "title": "Quiz - Identifying Anger",
    "type": "QUIZ",
    "status": "PUBLISHED",
    "quiz": {
      "media_url": "https://example.com/quiz-anger.jpg",
      "description": "Which face shows anger?",
      "difficulty_level": 1,
      "answer_emotions": ["HAPPY", "ANGRY", "SAD"],
      "correct_emotion": "ANGRY"
    }
  }
}
```

## Read any content detail (Admin)

- Endpoint:

```text
GET /admin/contents/:contentId
```

- Description: Retrieves details of any content, regardless of status.
- Auth required: Yes (Admin role required)

### Responses:

- [200 OK] - Details retrieved successfully.

## Update content and type-specific data (Admin)

- Endpoint:

```text
PATCH /admin/contents/:contentId
```

- Description: Updates general content fields or type-specific fields.
- Auth required: Yes (Admin role required)

### Request body (application/json):

- title (string, Optional)
- status (string, Optional)
- lecture/quiz/game (object, Optional): partial updates.

```json
{
  "title": "Updated Quiz Title",
  "quiz": {
    "difficultyLevel": 2
  }
}
```

### Responses:

- [200 OK] - Content updated successfully.

## Soft-delete content (Admin)

- Endpoint:

```text
DELETE /admin/contents/:contentId
```

- Description: Soft-deletes content. Hides it from children but preserves logs.
- Auth required: Yes (Admin role required)

### Request body (application/json):

- confirmation (string, Required): Must be exactly `DELETE`.

```json
{
  "confirmation": "DELETE"
}
```

### Responses:

- [200 OK] - Content soft-deleted successfully.

## Update user status or role (Admin)

- Endpoint:

```text
PATCH /admin/users/:userId
```

- Description: Updates a user's status (`ACTIVE`, `BANNED`) or role (`PARENT`, `ADMIN`). Prevents self-modification.
- Auth required: Yes (Admin role required)

### Request body (application/json):

- status (string, Optional): `ACTIVE` or `BANNED`.
- role (string, Optional): `PARENT` or `ADMIN`.

```json
{
  "status": "BANNED"
}
```

### Responses:

- [200 OK] - User updated successfully.

## Hard-delete user and cascaded data (Admin)

- Endpoint:

```text
DELETE /admin/users/:userId
```

- Description: Hard-deletes a user and cascades deletion to children, logs, and sessions. Prevents self-deletion.
- Auth required: Yes (Admin role required)

### Request body (application/json):

- confirmation (string, Required): Must be exactly `DELETE`.
- reason (string, Optional)

```json
{
  "confirmation": "DELETE",
  "reason": "GDPR deletion request"
}
```

### Responses:

- [200 OK] - User deleted successfully.

## Return aggregate system analytics (Admin)

- Endpoint:

```text
GET /admin/analytics
```

- Description: Returns system aggregate metrics. Excludes child-identifiable logs.
- Auth required: Yes (Admin role required)

### Query parameters:

- from (string, Optional): ISO datetime start boundary.
- to (string, Optional): ISO datetime end boundary.

### Responses:

- [200 OK] - Analytics data returned successfully.

```json
{
  "users": {
    "total": 100,
    "parents": 95,
    "admins": 5,
    "banned": 2,
    "active": 98
  },
  "children": {
    "total": 120
  },
  "learning": {
    "totalSessions": 500,
    "completedSessions": 400,
    "completionRate": 80,
    "totalQuizzes": 250,
    "correctQuizzes": 180,
    "quizSuccessRate": 72
  },
  "emotions": {
    "HAPPY": 320,
    "SAD": 45,
    "ANGRY": 12
  },
  "alertsCount": 8
}
```
