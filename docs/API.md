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

- emotion_value (string, Required): One of `HAPPY`, `SAD`, `ANGRY`, `STRESSED`, `CALM`, `NEUTRAL`, `SCARED`, `SURPRISED`.
- trigger_source (string, Required): One of `AAC_BOARD`, `GAME`, `QUIZ`, `LECTURE`, `WEBCAM`, `SYSTEM`.
- duration_seconds (number, Optional): Positive integer duration in seconds.
- Example:

```json
{
  "emotion_value": "HAPPY",
  "trigger_source": "GAME",
  "duration_seconds": 60
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
    "emotion_value": "HAPPY",
    "trigger_source": "GAME",
    "duration_seconds": 60,
    "created_at": "2026-05-21T07:14:22.170Z"
  }
}
```

- [400 Bad Request] - Possible `type` values: INVALID_JSON, INVALID_CHILD_ID, MISSING_EMOTION_VALUE, INVALID_EMOTION_VALUE, MISSING_TRIGGER_SOURCE, INVALID_TRIGGER_SOURCE, INVALID_DURATION.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, CHILD_NOT_OWNED_BY_PARENT.
- [404 Not Found] - Possible `type` values: CHILD_NOT_FOUND.

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
  "meltdown_alerts": [
    {
      "id": "423e4567-e89b-12d3-a456-426614174000",
      "emotion_value": "STRESSED",
      "trigger_source": "WEBCAM",
      "duration_seconds": 300,
      "created_at": "2026-05-21T07:14:22.170Z"
    }
  ]
}
```

- [400 Bad Request] - Possible `type` values: INVALID_CHILD_ID, INVALID_DAYS.
- [401 Unauthorized] - Possible `type` values: MISSING_SESSION_TOKEN, INVALID_SESSION.
- [403 Forbidden] - Possible `type` values: ACCOUNT_BANNED, CHILD_NOT_OWNED_BY_PARENT.
- [404 Not Found] - Possible `type` values: PARENT_NOT_FOUND, CHILD_NOT_FOUND.
