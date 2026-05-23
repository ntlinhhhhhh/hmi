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
