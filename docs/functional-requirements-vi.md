# Tài liệu Yêu cầu Chức năng

Dự án: Ứng dụng web HMI hỗ trợ trẻ tự kỷ nhận diện cảm xúc.

Nguồn cơ sở:

- SRS: `hmi.pdf`, phiên bản 1.0 draft, ngày 2026-05-15.
- Hiện trạng backend: Elysia/Bun API, Drizzle/PostgreSQL schema, và `docs/API.md`.

Tài liệu này xem SRS là chưa hoàn chỉnh và có thể chưa nhất quán. Các yêu cầu được đánh dấu **Suy luận** là yêu cầu cần thiết cho triển khai production, dù SRS không nêu rõ.

## Trạng thái Yêu cầu

Định nghĩa độ ưu tiên:

- **P0**: bắt buộc cho MVP an toàn và dùng được.
- **P1**: bắt buộc cho phạm vi đầy đủ của SRS.
- **P2**: mở rộng hữu ích hoặc tăng cường vận hành.

Định nghĩa trạng thái triển khai:

- **Đã triển khai**: đã có route API hiện tại và use case xử lý tương ứng.
- **Một phần**: đã có bảng/query hoặc một phần logic, nhưng route/use case chưa hoàn chỉnh hoặc chưa có.
- **Thiếu**: SRS yêu cầu hoặc được suy luận là cần thiết, nhưng hiện chưa triển khai.

API hiện đã có:

- `GET /health`
- `POST /auth/signup`
- `POST /auth/signin`
- `GET /me`
- `DELETE /auth/session`
- `POST /children`
- `GET /children`
- `POST /children/:childId/emotion-logs`
- `GET /children/:childId/dashboard`

## Giả định và Cách xử lý Mơ hồ

1. Trẻ không đăng nhập trực tiếp. Phụ huynh đăng nhập, chọn hồ sơ trẻ, và giao diện dành cho trẻ gửi sự kiện dưới phiên đăng nhập của phụ huynh.
2. Admin dùng chung bảng `users` với `role = ADMIN`. Tạo tài khoản admin là luồng nội bộ, trừ khi sau này có chức năng admin hiện hữu tạo admin mới.
3. Computer Vision chạy trên trình duyệt hoặc một AI service riêng. Backend chỉ lưu sự kiện, điểm số, thời lượng và kết quả đã suy ra, không lưu frame webcam thô nếu chưa có yêu cầu đồng ý/lưu media rõ ràng.
4. `game_sessions` trong SRS được ánh xạ thành bảng `content_sessions` hiện có.
5. `unlock_content_id` trong `content_sessions` nghĩa là trẻ chỉ được ghi nhận tiến độ cho nội dung đã mở khóa.
6. Reset mật khẩu phải chống dò tài khoản. Dù SRS nói báo lỗi khi email/số điện thoại không tồn tại, hành vi production nên trả về thông báo chung cho yêu cầu reset.
7. SRS yêu cầu xóa cứng kèm cascade dữ liệu. Tài liệu này giữ hành vi đó, nhưng yêu cầu xác nhận, phân quyền và audit log khi phù hợp.
8. SRS nêu đăng nhập bằng số điện thoại + mật khẩu. Hiện signup vẫn bắt buộc email, nên đăng ký chỉ bằng số điện thoại còn thiếu.
9. Số sao thuộc về từng hồ sơ trẻ. Phụ huynh thực hiện mua/mở khóa phần thưởng thay cho trẻ.
10. `AAC_BOARD` có trong mã nguồn như một nguồn trigger cảm xúc, nhưng SRS chưa định nghĩa workflow AAC board. Tài liệu này xem đây là nguồn trigger có thể hỗ trợ về sau.
11. Push notification cần quản lý device token. SRS yêu cầu gửi thông báo nhưng không định nghĩa quản lý token, nên các API thiết bị được suy luận thêm.
12. Báo cáo PDF có thể tạo đồng bộ cho báo cáo nhỏ. Nếu báo cáo lớn, nên chuyển sang async job và artifact tải về.

## Mô hình Vai trò và Quyền hạn

### Public

Được phép truy cập:

- Health check.
- Đăng ký và đăng nhập phụ huynh.
- Google SSO callback/sign-in.
- Yêu cầu, xác minh và xác nhận reset mật khẩu.

### Phụ huynh

Chỉ được truy cập tài khoản và hồ sơ trẻ của chính mình:

- Đọc/cập nhật tài khoản của mình.
- Tạo/liệt kê/đọc/cập nhật/xóa hồ sơ trẻ.
- Đọc/cập nhật cấu hình điều hòa cảm giác của con.
- Liệt kê nội dung đã được gán hoặc đã mở khóa cho con.
- Ghi nhận phiên học, lượt quiz, kết quả game AI và emotion log của con.
- Xem dashboard, lịch sử cảm xúc, lịch sử học tập và báo cáo của con.
- Dùng sao của con để mở khóa nội dung hoặc mua pet.
- Đăng ký/xóa device token của chính phụ huynh để nhận push notification.

Ràng buộc:

- Client không gửi `parent_id` trong path/body của endpoint protected. Backend lấy phụ huynh từ session token.
- Không được truy cập child, unlock, pet, log, session hoặc report thuộc phụ huynh khác.
- Tài khoản bị ban không được dùng endpoint protected.

### Trẻ

Trẻ không phải API principal. Hành động của trẻ được authorize thông qua phiên phụ huynh đang active và `childId` được chọn.

Các hành động child-facing được phép thông qua phiên phụ huynh:

- Xem bài giảng.
- Trả lời quiz.
- Chơi game AI bắt chước cảm xúc.
- Nhận sao.
- Kích hoạt emotion/regulation log.

### Admin

Được phép truy cập:

- CRUD nội dung bài giảng, quiz và game.
- CRUD danh mục pet.
- Danh sách người dùng, đổi trạng thái người dùng và xóa tài khoản.
- Dashboard/analytics tổng quan hệ thống.
- Luồng đăng ký/upload media asset.

Ràng buộc admin:

- Admin không được xem như phụ huynh trong endpoint hồ sơ trẻ, trừ khi sau này mô hình hóa vai trò hỗ trợ riêng.
- Truy cập PII cấp trẻ của admin phải giới hạn theo nhu cầu vận hành và có audit.

### System hoặc AI Service

**Suy luận.** AI/regulation service có thể cần service credential nếu gửi event từ server-side.

Được phép:

- Ghi nhận emotion event, AI score và regulation event cho trẻ khi được authorize bằng phiên phụ huynh hoặc service token.
- Kích hoạt gửi cảnh báo phụ huynh khi cảm xúc tiêu cực vượt ngưỡng thời lượng cấu hình.

## Thực thể Cốt lõi và Quan hệ

### `users`

Tài khoản phụ huynh và admin.

Trường chính:

- `id`
- `email`
- `phone_number`
- `password_hash`
- `auth_provider`: `LOCAL`, `GOOGLE`, `PHONE`
- `provider_id`
- `full_name`
- `role`: `PARENT`, `ADMIN`
- `status`: `ACTIVE`, `BANNED`
- `last_login_at`

Quan hệ:

- Một phụ huynh có nhiều `child_profiles`.
- Một user có nhiều `sessions`.
- Một user có nhiều `password_reset_codes`.
- Admin có thể tạo nhiều `contents`.

### `sessions`

Phiên đăng nhập đã lưu.

Quan hệ:

- Nhiều session thuộc về một user.

Yêu cầu:

- Chỉ lưu hash của session token.
- Session phải có hạn dùng.
- Cập nhật `last_used_at` khi request authenticated được chấp nhận.
- Xóa session khi sign out.

### `password_reset_codes`

Trạng thái OTP/reset mật khẩu.

Yêu cầu:

- Chỉ lưu hash của OTP/reset code.
- Có expiry, giới hạn số lần thử và chỉ dùng một lần.
- Không tiết lộ identifier có tồn tại hay không khi request reset.

### `child_profiles`

Hồ sơ trẻ thuộc một phụ huynh.

Trường chính:

- `parent_id`
- `nickname`
- `avatar_url`
- `birth_year`
- `total_stars`

Quan hệ:

- Một trẻ có một bản ghi `preferences`.
- Một trẻ có nhiều `emotion_logs`.
- Một trẻ có nhiều `unlock_content`.
- Một trẻ có nhiều `content_sessions`.
- Một trẻ có nhiều `child_pets`.

### `preferences`

Cấu hình điều hòa cảm giác và UI cho từng trẻ.

Trường hiện có:

- `is_high_contrast`
- `preferences` JSONB

Các setting cần typed rõ:

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

Kho nội dung chung.

Trường chính:

- `title`
- `type`: `LECTURE`, `QUIZ`, `GAME`
- `status`: `DRAFT`, `PUBLISHED`
- `created_by`

Quan hệ:

- Một content có đúng một row chi tiết theo loại: `lectures`, `quizzes` hoặc `game`.
- Một content có thể được nhiều trẻ mở khóa qua `unlock_content`.

### `lectures`

Metadata và media của bài giảng.

Trường cần có:

- `media_url`
- `description`
- `difficulty_level`: 1-3
- `is_default`
- **Suy luận** `voiceover_url` cho lồng tiếng.
- **Suy luận** `reward_stars` cho chính sách thưởng sao khi hoàn thành.

### `quizzes`

Metadata media và đáp án của quiz.

Trường hiện có:

- `correct_emotion`

Thiếu mô hình bắt buộc:

- **Suy luận** danh sách đáp án quiz. Schema hiện chỉ có cảm xúc đúng, chưa đủ để render hoặc validate danh sách đáp án. Cần thêm `quiz_options` hoặc JSON typed.
- **Suy luận** `reward_stars`.
- **Suy luận** hint dạng text/audio.

### `game`

Metadata game AI bắt chước cảm xúc.

Trường cần có:

- `target_emotion`
- `time_limit_seconds`
- `difficulty_level`
- `is_default`
- `unlock_star_cost`

Trường còn thiếu:

- **Suy luận** `success_threshold_score`.
- **Suy luận** `reward_stars`.
- **Suy luận** metadata model/version cho tương thích AI scoring.

### `unlock_content`

Bảng join lưu nội dung trẻ đã mở khóa.

Yêu cầu:

- Unique cặp `(child_id, content_id)`.
- Nội dung mặc định được mở khóa khi tạo hồ sơ trẻ.
- Mở khóa nội dung trả phí phải trừ sao và tạo unlock record trong cùng transaction.

### `content_sessions`

Lịch sử học/chơi.

Trường chính:

- `child_id`
- `unlock_content_id`
- `duration_seconds`
- `is_correct`
- `stars_earned`
- `ai_match_score`
- `status`: `COMPLETED`, `ABANDONED`

Trường bắt buộc còn thiếu:

- **Suy luận** `selected_emotion` cho lượt quiz.
- **Suy luận** `idempotency_key` để tránh thưởng trùng khi client retry.
- **Suy luận** `started_at` và `completed_at` để tính thời gian sử dụng chính xác.

### `emotion_logs`

Lịch sử cảm xúc và hành vi.

Trường chính:

- `emotion_value`
- `trigger_source`
- `duration_seconds`
- `created_at`

Giá trị yêu cầu:

- Emotion: `HAPPY`, `SAD`, `ANGRY`, `STRESSED`, `CALM`, `NEUTRAL`, `SCARED`, `SURPRISED`.
- Trigger source: `AAC_BOARD`, `GAME`, `QUIZ`, `LECTURE`, `WEBCAM`, `SYSTEM`.

Trường bắt buộc còn thiếu:

- **Suy luận** `confidence_score`.
- **Suy luận** `session_id` hoặc `content_session_id`.
- **Suy luận** `metadata` cho rage-click count, trạng thái nhận diện khuôn mặt hoặc AI model version.

### `pets`

Danh mục pet trong store.

Trường chính:

- `name`
- `description`
- `image_url`
- `animation_url`
- `unlock_star_cost`
- `status`: `ACTIVE`, `HIDDEN`

### `child_pets`

Pet mà trẻ sở hữu.

Trường chính:

- `child_id`
- `pet_id`
- `custom_name`
- `unlocked_at`

### Thực thể suy luận thêm

Các thực thể sau cần có để triển khai đầy đủ:

- `device_tokens`: push token của thiết bị phụ huynh, platform, token hash, active status và timestamp.
- `regulation_events`: lịch sử can thiệp điều hòa, action đã thực hiện, thời lượng và emotion event nguồn.
- `star_transactions`: ledger bất biến cho sao kiếm được/chi tiêu, lý do, entity liên quan và số dư sau giao dịch.
- `media_assets`: metadata media upload, storage key, MIME type, dung lượng, owner và trạng thái.
- `quiz_options`: danh sách đáp án quiz nếu không lưu bằng JSON typed.
- `audit_logs`: hành động admin, hard delete, ban tài khoản và export báo cáo nhạy cảm.

## Use Cases

### UC-AUTH-01: Đăng ký tài khoản phụ huynh

- Actors: Phụ huynh.
- Preconditions: Phụ huynh chưa authenticated. Email/phone/Google identity chưa được liên kết.
- Main flow:
  1. Phụ huynh mở màn hình đăng ký.
  2. Chọn email/password, phone/password hoặc Google SSO.
  3. Backend validate format input và tính duy nhất của identifier.
  4. Backend hash password cho local/phone registration hoặc verify Google identity cho SSO.
  5. Backend tạo `users` với `role = PARENT` và `status = ACTIVE`.
  6. Backend trả về user đã tạo. Product có thể yêu cầu đăng nhập sau đăng ký hoặc trả session ngay.
- Alternative/error flows:
  - Email hoặc phone trùng trả `409`.
  - Password yếu hoặc identifier không hợp lệ trả `400`.
  - Google token verify thất bại trả `401`.
  - Provider account đã liên kết trả `409`.
- Postconditions: Tài khoản phụ huynh tồn tại.
- Related API endpoints: `POST /auth/signup`, `POST /auth/google`.
- Priority: P0.
- Current status: Một phần. Đã có signup email/password. Thiếu phone-only và Google registration.

### UC-AUTH-02: Đăng nhập

- Actors: Phụ huynh, Admin.
- Preconditions: Tài khoản tồn tại và active.
- Main flow:
  1. User gửi email hoặc số điện thoại kèm mật khẩu, hoặc gửi chứng thực Google SSO.
  2. Backend verify credential/provider.
  3. Backend từ chối tài khoản bị ban.
  4. Backend tạo persisted session và cập nhật `last_login_at`.
  5. Backend trả về user và session token.
  6. Client điều hướng phụ huynh đến chọn hồ sơ trẻ hoặc admin đến dashboard quản trị.
- Alternative/error flows:
  - Sai thông tin đăng nhập trả `401`.
  - Tài khoản dùng provider khác với phương thức đăng nhập trả `401`.
  - Tài khoản bị ban trả `403`.
- Postconditions: Có active session.
- Related API endpoints: `POST /auth/signin`, `POST /auth/google`, `GET /me`.
- Priority: P0.
- Current status: Một phần. Đã có local email/phone identifier sign-in. Thiếu Google SSO.

### UC-AUTH-03: Đăng xuất

- Actors: Phụ huynh, Admin.
- Preconditions: User đã authenticated.
- Main flow:
  1. User chọn sign out.
  2. Backend vô hiệu hóa session token hiện tại.
  3. Client xóa session state local.
- Alternative/error flows:
  - Thiếu hoặc hết hạn session trả `401`.
- Postconditions: Session không dùng lại được.
- Related API endpoints: `DELETE /auth/session`.
- Priority: P0.
- Current status: Đã triển khai.

### UC-AUTH-04: Khôi phục mật khẩu

- Actors: Phụ huynh.
- Preconditions: Phụ huynh có tài khoản local hoặc phone-password.
- Main flow:
  1. Phụ huynh yêu cầu reset bằng email hoặc số điện thoại.
  2. Backend tạo OTP/reset code ngắn hạn nếu identifier tồn tại.
  3. Backend gửi OTP/link qua email hoặc SMS.
  4. Phụ huynh gửi OTP.
  5. Backend verify OTP và trả reset token hoặc đánh dấu code đã verified.
  6. Phụ huynh gửi mật khẩu mới.
  7. Backend hash và lưu mật khẩu mới, đánh dấu reset code đã dùng, và có thể invalidate session cũ.
- Alternative/error flows:
  - Identifier không tồn tại vẫn trả generic success để chống enumeration.
  - OTP sai hoặc hết hạn trả `400`.
  - Quá nhiều lần thử trả `429` hoặc `403`.
  - Tài khoản chỉ dùng Google trả thông báo theo provider.
- Postconditions: Mật khẩu mới có hiệu lực.
- Related API endpoints: `POST /auth/password-reset/request`, `POST /auth/password-reset/verify`, `POST /auth/password-reset/confirm`.
- Priority: P0.
- Current status: Một phần. Có bảng DB. Thiếu route/use case.

### UC-AUTH-05: Xem và cập nhật tài khoản

- Actors: Phụ huynh, Admin.
- Preconditions: User đã authenticated.
- Main flow:
  1. User yêu cầu thông tin tài khoản hiện tại.
  2. User cập nhật họ tên, số điện thoại, email hoặc mật khẩu.
  3. Backend validate uniqueness và yêu cầu mật khẩu hiện tại khi đổi field nhạy cảm.
  4. Backend lưu thay đổi và trả user đã cập nhật.
- Alternative/error flows:
  - Email/phone trùng trả `409`.
  - Mật khẩu hiện tại sai trả `401`.
  - Tài khoản bị ban trả `403`.
- Postconditions: Hồ sơ tài khoản được cập nhật.
- Related API endpoints: `GET /me`, `PATCH /me`, `PATCH /me/password`.
- Priority: P1.
- Current status: Một phần. Có `GET /me`. Thiếu API cập nhật.

### UC-CHILD-01: Tạo hồ sơ trẻ

- Actors: Phụ huynh.
- Preconditions: Phụ huynh đã authenticated và active.
- Main flow:
  1. Phụ huynh gửi nickname, năm sinh và avatar tùy chọn.
  2. Backend validate input và quyền sở hữu.
  3. Backend suy ra difficulty mục tiêu từ tuổi.
  4. Backend tạo `child_profiles`.
  5. Backend tạo `preferences` mặc định.
  6. Backend mở khóa lecture, quiz và game mặc định theo difficulty.
  7. Backend trả hồ sơ trẻ.
- Alternative/error flows:
  - Thiếu nickname hoặc năm sinh không hợp lệ trả `400`.
  - Account không phải phụ huynh trả `404` hoặc `403`.
  - Không có default content: vẫn tạo trẻ và danh sách content rỗng.
- Postconditions: Hồ sơ trẻ tồn tại và chọn được.
- Related API endpoints: `POST /children`, `GET /children`.
- Priority: P0.
- Current status: Đã triển khai tạo profile và logic query tạo preference/unlock mặc định.

### UC-CHILD-02: Chọn/liệt kê hồ sơ trẻ

- Actors: Phụ huynh.
- Preconditions: Phụ huynh đã authenticated.
- Main flow:
  1. Phụ huynh yêu cầu danh sách hồ sơ trẻ của mình.
  2. Backend trả children kèm tóm tắt preferences và số sao.
  3. Client cho phụ huynh/trẻ chọn một profile active để học.
- Alternative/error flows:
  - Phụ huynh bị ban trả `403`.
  - Không có hồ sơ trẻ: trả danh sách rỗng.
- Postconditions: Client có thể vào child-specific flows.
- Related API endpoints: `GET /children`, `GET /children/:childId`.
- Priority: P0.
- Current status: Một phần. Có list. Thiếu detail endpoint.

### UC-CHILD-03: Cập nhật hoặc xóa hồ sơ trẻ

- Actors: Phụ huynh.
- Preconditions: Phụ huynh sở hữu hồ sơ trẻ.
- Main flow:
  1. Phụ huynh sửa nickname, avatar hoặc năm sinh.
  2. Backend validate và cập nhật hồ sơ.
  3. Nếu xóa, backend yêu cầu xác nhận rõ ràng.
  4. Backend xóa hồ sơ trẻ và cascade dữ liệu phụ thuộc.
- Alternative/error flows:
  - Không tìm thấy child trả `404`.
  - Child không thuộc phụ huynh trả `403`.
  - Thiếu xác nhận xóa trả `400`.
- Postconditions: Hồ sơ được cập nhật hoặc xóa.
- Related API endpoints: `PATCH /children/:childId`, `DELETE /children/:childId`.
- Priority: P1.
- Current status: Một phần. Có query helper. Thiếu route/use case.

### UC-PREF-01: Cấu hình điều hòa cảm giác

- Actors: Phụ huynh.
- Preconditions: Phụ huynh sở hữu hồ sơ trẻ.
- Main flow:
  1. Phụ huynh mở cấu hình của trẻ.
  2. Phụ huynh đặt high contrast, reduced motion, nhạc xoa dịu, voice prompt, volume, brightness, theme và thời lượng timeout.
  3. Backend validate schema preferences.
  4. Backend lưu preferences.
  5. UI child-facing dùng preferences trong quá trình học và regulation.
- Alternative/error flows:
  - Giá trị không hợp lệ trả `400`.
  - Child không thuộc phụ huynh trả `403`.
- Postconditions: Cấu hình sensory theo từng trẻ được lưu.
- Related API endpoints: `GET /children/:childId/preferences`, `PATCH /children/:childId/preferences`.
- Priority: P0.
- Current status: Một phần. Có bảng và create profile tạo default. Thiếu route/use case.

### UC-CONTENT-01: Xem nội dung khả dụng

- Actors: Phụ huynh, Trẻ.
- Preconditions: Phụ huynh authenticated và đã chọn hồ sơ trẻ.
- Main flow:
  1. Client yêu cầu danh sách content cho trẻ.
  2. Backend trả content published, trạng thái unlock, dữ liệu theo loại, difficulty, cost và tóm tắt progress.
  3. Client render lecture, quiz và game phù hợp với trẻ.
- Alternative/error flows:
  - Không tìm thấy child trả `404`.
  - Child không thuộc phụ huynh trả `403`.
  - Không có content: trả danh sách rỗng.
- Postconditions: Trẻ có thể chọn learning item đã mở khóa.
- Related API endpoints: `GET /children/:childId/contents`, `GET /contents/:contentId`.
- Priority: P0.
- Current status: Một phần. Có query helper. Thiếu route/use case.

### UC-LEARN-01: Hoàn thành bài giảng

- Actors: Trẻ thông qua phiên phụ huynh.
- Preconditions: Đã chọn hồ sơ trẻ. Lecture published và unlocked.
- Main flow:
  1. Trẻ bắt đầu lecture media.
  2. Client phát ảnh/video và voiceover.
  3. Trẻ xem đủ thời lượng yêu cầu.
  4. Client gửi completed content session.
  5. Backend validate unlock, ghi session, thưởng sao theo policy và cập nhật balance.
- Alternative/error flows:
  - Trẻ thoát giữa chừng: client ghi `ABANDONED`; không thưởng sao.
  - Content locked hoặc unpublished trả `403` hoặc `404`.
  - Retry trùng cùng idempotency key trả kết quả ban đầu.
- Postconditions: Progress được ghi nhận và sao có thể tăng.
- Related API endpoints: `GET /children/:childId/contents`, `POST /children/:childId/content-sessions`.
- Priority: P0.
- Current status: Một phần. Có bảng/query helper. Thiếu route/use case.

### UC-LEARN-02: Trả lời quiz

- Actors: Trẻ thông qua phiên phụ huynh.
- Preconditions: Quiz published và unlocked.
- Main flow:
  1. Client hiển thị quiz media và danh sách đáp án.
  2. Trẻ chọn một đáp án cảm xúc.
  3. Client gửi câu trả lời.
  4. Backend validate đáp án đã chọn với quiz options/correct emotion.
  5. Nếu đúng, backend ghi session và thưởng sao.
  6. Nếu sai, backend ghi attempt theo policy và trả hint/try-again guidance.
- Alternative/error flows:
  - Option không hợp lệ trả `400`.
  - Timeout/không tương tác có thể ghi `ABANDONED`.
  - Content locked trả `403`.
- Postconditions: Attempt được lưu để thống kê dashboard.
- Related API endpoints: `GET /children/:childId/contents`, `POST /children/:childId/content-sessions`.
- Priority: P0.
- Current status: Thiếu. Schema hiện thiếu answer options và chưa có session route.

### UC-LEARN-03: Chơi game AI bắt chước cảm xúc

- Actors: Trẻ thông qua phiên phụ huynh, System/AI.
- Preconditions: Game published và unlocked. Client đã được cấp quyền webcam.
- Main flow:
  1. Client hiển thị cảm xúc mục tiêu.
  2. Trẻ bắt chước biểu cảm trong giới hạn thời gian.
  3. Client/AI tính match score và confidence.
  4. Client gửi kết quả AI game.
  5. Backend validate score range, threshold policy và unlock state.
  6. Backend ghi session và thưởng sao nếu score đạt ngưỡng.
- Alternative/error flows:
  - Không nhận diện được mặt: client nhắc trẻ và có thể gửi abandoned/failed attempt.
  - Phát hiện cảm xúc tiêu cực: trigger sensory regulation use cases.
  - Score không hợp lệ hoặc từ nguồn không tin cậy trả `400` hoặc `403` tùy mô hình trust.
- Postconditions: Attempt AI được ghi nhận; sao có thể tăng.
- Related API endpoints: `POST /children/:childId/content-sessions`, `POST /children/:childId/emotion-logs`, `POST /children/:childId/regulation-events`.
- Priority: P1.
- Current status: Một phần. Có field DB. Thiếu route/use case và AI contract.

### UC-ECON-01: Mở khóa nội dung trả phí bằng sao

- Actors: Phụ huynh.
- Preconditions: Phụ huynh sở hữu child. Content published, đang locked và có star cost. Trẻ đủ sao.
- Main flow:
  1. Phụ huynh chọn content locked.
  2. Backend validate ownership, trạng thái content và star balance hiện tại.
  3. Backend atomically trừ sao và insert `unlock_content`.
  4. Backend ghi star transaction.
  5. Backend trả balance mới và unlock record.
- Alternative/error flows:
  - Không đủ sao trả `409`.
  - Content đã unlock trả `409` hoặc idempotent success.
  - Race khi mua đồng thời không được làm số sao âm.
- Postconditions: Content khả dụng cho trẻ.
- Related API endpoints: `POST /children/:childId/contents/:contentId/unlock`.
- Priority: P1.
- Current status: Một phần. Có query helper nhưng thiếu route và use case an toàn balance.

### UC-ECON-02: Mua và quản lý pet ảo

- Actors: Phụ huynh, Trẻ.
- Preconditions: Phụ huynh sở hữu child. Pet active. Trẻ đủ sao.
- Main flow:
  1. Phụ huynh xem pet store active.
  2. Phụ huynh mua pet cho trẻ và có thể đặt tên.
  3. Backend validate balance và duplicate ownership.
  4. Backend atomically trừ sao, insert `child_pets` và ghi star transaction.
  5. Trẻ xem được pet đã sở hữu.
- Alternative/error flows:
  - Không đủ sao trả `409`.
  - Pet hidden hoặc không tồn tại trả `404`.
  - Pet đã sở hữu trả `409` hoặc idempotent success.
  - Custom name không hợp lệ trả `400`.
- Postconditions: Trẻ sở hữu pet và star balance giảm.
- Related API endpoints: `GET /pets`, `GET /children/:childId/pets`, `POST /children/:childId/pets`, `PATCH /children/:childId/pets/:childPetId`.
- Priority: P1.
- Current status: Một phần. Có bảng/query helper. Thiếu route/use case.

### UC-TRACK-01: Ghi nhận sự kiện cảm xúc hoặc hành vi

- Actors: System/AI, child-facing client.
- Preconditions: Phụ huynh sở hữu child. Client có consent và permission quan sát nguồn liên quan.
- Main flow:
  1. Client phát hiện cảm xúc hoặc hành vi từ webcam, game, quiz, lecture, AAC board hoặc system event.
  2. Client gửi emotion, trigger source, duration, confidence và metadata.
  3. Backend validate ownership và enum.
  4. Backend lưu `emotion_logs`.
  5. Backend kiểm tra ngưỡng alert/regulation.
- Alternative/error flows:
  - Emotion/source không hợp lệ trả `400`.
  - Child không thuộc phụ huynh trả `403`.
  - Cảm xúc tiêu cực kéo dài trigger parent notification.
- Postconditions: Event khả dụng cho dashboard và report.
- Related API endpoints: `POST /children/:childId/emotion-logs`, `GET /children/:childId/emotion-logs`.
- Priority: P0.
- Current status: Một phần. Có create route. Thiếu list route và metadata mở rộng.

### UC-REG-01: Điều hòa cảm xúc tự động

- Actors: System/AI, child-facing client.
- Preconditions: Client phát hiện stress, khóc, biểu cảm giận, rage click hoặc rời khỏi vị trí. Child preferences tồn tại.
- Main flow:
  1. Client/backend xác định tín hiệu tiêu cực vượt ngưỡng cấu hình.
  2. Backend ghi emotion log.
  3. Client áp dụng preferences: giảm sáng, pause animation, giảm/tắt nhạc nền, phát nhạc/giọng nói xoa dịu hoặc đổi theme.
  4. Client/backend ghi regulation event kèm action details.
  5. Nếu trẻ bình tĩnh lại, client tiếp tục bài học.
- Alternative/error flows:
  - Trạng thái tiêu cực kéo dài quá ngưỡng: gửi push notification cho phụ huynh.
  - Thiếu preference config: dùng safe defaults.
- Postconditions: Intervention có thể audit và UI của trẻ đã được điều chỉnh.
- Related API endpoints: `POST /children/:childId/emotion-logs`, `POST /children/:childId/regulation-events`, `GET /children/:childId/preferences`.
- Priority: P0.
- Current status: Thiếu, trừ raw emotion log creation.

### UC-REG-02: Chế độ time-out

- Actors: System/AI, child-facing client.
- Preconditions: Tín hiệu tiêu cực đạt ngưỡng hoặc parent/client kích hoạt timeout.
- Main flow:
  1. Client vào minimal UI mode.
  2. Client hiển thị countdown bình tĩnh hoặc calming story.
  3. Client pause lesson/game session đang active.
  4. Backend ghi timeout regulation event.
  5. Client thoát timeout sau countdown hoặc sau tín hiệu calm.
- Alternative/error flows:
  - Trẻ vẫn căng thẳng: gia hạn timeout theo policy và thông báo phụ huynh.
  - Active content session bị ghi abandoned nếu timeout vượt thời lượng cho phép.
- Postconditions: Lịch sử timeout được lưu và hiển thị cho phụ huynh.
- Related API endpoints: `POST /children/:childId/regulation-events`, `POST /children/:childId/content-sessions`.
- Priority: P1.
- Current status: Thiếu.

### UC-NOTIF-01: Thông báo phụ huynh khi cảm xúc tiêu cực kéo dài

- Actors: System, Phụ huynh.
- Preconditions: Phụ huynh đã đăng ký device token. Cảm xúc tiêu cực kéo dài hơn 60 giây.
- Main flow:
  1. Backend xác định alert hợp lệ từ emotion log/regulation event.
  2. Backend tạo notification event.
  3. Backend gửi push notification đến các thiết bị active của phụ huynh.
  4. Backend ghi trạng thái delivery.
- Alternative/error flows:
  - Không có device token: chỉ lưu alert cho dashboard.
  - Push provider lỗi: retry với backoff và lưu failure status.
  - Alert trùng trong cooldown: suppress duplicate notification.
- Postconditions: Phụ huynh được cảnh báo hoặc alert được giữ để xem sau.
- Related API endpoints: `POST /devices`, `DELETE /devices/:deviceId`, `GET /children/:childId/alerts`.
- Priority: P1.
- Current status: Thiếu.

### UC-DASH-01: Xem dashboard của trẻ

- Actors: Phụ huynh.
- Preconditions: Phụ huynh sở hữu child.
- Main flow:
  1. Phụ huynh mở dashboard của trẻ.
  2. Backend aggregate learning sessions, tỷ lệ quiz đúng, tổng sao, emotion counts, meltdown alerts và thời gian sử dụng.
  3. Backend trả dữ liệu theo phạm vi tuần/tháng.
  4. Client hiển thị chart và empty state.
- Alternative/error flows:
  - Không có data: trả metric bằng 0 và array rỗng.
  - Range không hợp lệ trả `400`.
  - Child không thuộc phụ huynh trả `403`.
- Postconditions: Phụ huynh xem được tiến độ và xu hướng cảm xúc.
- Related API endpoints: `GET /children/:childId/dashboard`.
- Priority: P0.
- Current status: Đã triển khai bản cơ bản.

### UC-DASH-02: Xuất báo cáo PDF

- Actors: Phụ huynh.
- Preconditions: Phụ huynh sở hữu child.
- Main flow:
  1. Phụ huynh chọn date range và loại báo cáo.
  2. Backend aggregate child profile, learning stats, emotion chart data, meltdown events và usage summary.
  3. Backend tạo PDF.
  4. Client tải PDF.
- Alternative/error flows:
  - Không có dữ liệu: tạo report với empty-state summary.
  - Date range quá lớn trả `400`.
  - Tạo PDF lỗi trả `500` hoặc trạng thái async job thất bại.
- Postconditions: Phụ huynh nhận report artifact.
- Related API endpoints: `GET /children/:childId/reports/summary.pdf`.
- Priority: P1.
- Current status: Thiếu.

### UC-ADMIN-01: Quản lý nội dung học tập

- Actors: Admin.
- Preconditions: Admin authenticated.
- Main flow:
  1. Admin liệt kê content.
  2. Admin tạo lecture, quiz hoặc game với title, status, media, difficulty, default flag, target emotion hoặc dữ liệu đáp án.
  3. Backend validate payload theo loại.
  4. Backend lưu `contents` và đúng một row chi tiết theo loại trong transaction.
  5. Admin publish, sửa hoặc xóa content.
- Alternative/error flows:
  - Upload/media format không hợp lệ trả `400`.
  - Thiếu payload theo loại trả `400`.
  - Xóa content cascade unlock/session theo DB policy và phải yêu cầu xác nhận.
- Postconditions: Content published khả dụng cho trẻ hoặc default unlock.
- Related API endpoints: `GET /admin/contents`, `POST /admin/contents`, `GET /admin/contents/:contentId`, `PATCH /admin/contents/:contentId`, `DELETE /admin/contents/:contentId`, `POST /admin/media-assets`.
- Priority: P0.
- Current status: Một phần. Có bảng. Thiếu route/use case.

### UC-ADMIN-02: Quản lý danh mục pet

- Actors: Admin.
- Preconditions: Admin authenticated.
- Main flow:
  1. Admin liệt kê pet.
  2. Admin tạo hoặc cập nhật tên pet, ảnh, animation, cost và status.
  3. Backend validate cost và media.
  4. Admin có thể hide hoặc delete pet.
- Alternative/error flows:
  - Pet đã có trẻ sở hữu nên được hide thay vì hard delete, trừ khi có xác nhận và policy cho phép cascade.
  - Media trùng hoặc không hợp lệ trả `400`.
- Postconditions: Store pet phản ánh thay đổi của admin.
- Related API endpoints: `GET /admin/pets`, `POST /admin/pets`, `PATCH /admin/pets/:petId`, `DELETE /admin/pets/:petId`.
- Priority: P1.
- Current status: Một phần. Có bảng. Thiếu route/use case.

### UC-ADMIN-03: Quản lý người dùng

- Actors: Admin.
- Preconditions: Admin authenticated.
- Main flow:
  1. Admin tìm user theo email, phone, role hoặc status.
  2. Admin xem profile user và child summary.
  3. Admin ban/unban user bằng cách cập nhật status.
  4. Admin xóa user nếu policy/legal request yêu cầu hard delete.
- Alternative/error flows:
  - Admin không được xóa hoặc ban chính mình nếu chưa có guarded flow riêng.
  - Không tìm thấy user trả `404`.
  - Xóa user yêu cầu confirmation và audit log.
- Postconditions: Trạng thái hoặc dữ liệu user thay đổi.
- Related API endpoints: `GET /admin/users`, `GET /admin/users/:userId`, `PATCH /admin/users/:userId`, `DELETE /admin/users/:userId`.
- Priority: P1.
- Current status: Thiếu.

### UC-ADMIN-04: Xem analytics toàn hệ thống

- Actors: Admin.
- Preconditions: Admin authenticated.
- Main flow:
  1. Admin mở system analytics.
  2. Backend trả aggregate user counts, active child count, completion rate theo content, quiz success rate, emotion aggregate counts và alert counts.
  3. Backend loại bỏ raw child PII trừ khi được yêu cầu rõ và có quyền.
- Alternative/error flows:
  - Date range không hợp lệ trả `400`.
  - Không có dữ liệu: trả metric bằng 0.
- Postconditions: Admin theo dõi được mức độ sử dụng hệ thống và hiệu quả nội dung.
- Related API endpoints: `GET /admin/analytics`.
- Priority: P2.
- Current status: Thiếu.

## Danh mục API Endpoint

Tất cả protected endpoint dùng:

```http
Authorization: Bearer <session_token>
```

Error body chuẩn:

```json
{
  "error": {
    "type": "ERROR_TYPE",
    "message": "Thông báo dễ hiểu cho người dùng hoặc client."
  }
}
```

### Health

| Method | Path      | Mục đích                                | Auth/Authz | Request   | Response                                                                                     | Error responses                    | Validation | Use case liên quan     | Trạng thái    |
| ------ | --------- | --------------------------------------- | ---------- | --------- | -------------------------------------------------------------------------------------------- | ---------------------------------- | ---------- | ---------------------- | ------------- |
| `GET`  | `/health` | Kiểm tra API và database còn hoạt động. | Public.    | Không có. | `{ "status": "healthy", "timestamp": "...", "services": { "api": "up", "database": "up" } }` | `503` khi database check thất bại. | Không có.  | Operational readiness. | Đã triển khai |

### Authentication và Account

| Method   | Path                           | Mục đích                                                          | Auth/Authz                         | Request                                                                    | Response                                              | Error responses                                                                                                        | Validation                                                                                                                                | Use case liên quan     | Trạng thái                                          |
| -------- | ------------------------------ | ----------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------- |
| `POST`   | `/auth/signup`                 | Tạo tài khoản phụ huynh bằng local credentials.                   | Public.                            | Body: `email`, `password`, optional `phone_number`, optional `full_name`.  | `201` với `message` và `user`.                        | `400` JSON/email/password/phone/full name không hợp lệ. `409` email hoặc phone đã dùng.                                | Email đúng format; password dài >= 8; phone 8-15 chữ số, có thể bắt đầu bằng `+`; full name <= 120 ký tự.                                 | UC-AUTH-01             | Đã triển khai cho email/password; thiếu phone-only. |
| `POST`   | `/auth/signin`                 | Authenticate parent/admin local bằng email hoặc phone identifier. | Public.                            | Body: `identifier`, `password`.                                            | `200` với `message`, `user`, `session` gồm raw token. | `400` thiếu identifier/password. `401` sai credentials hoặc provider không hỗ trợ. `403` account banned.               | Identifier và password không rỗng.                                                                                                        | UC-AUTH-02             | Đã triển khai cho local auth.                       |
| `POST`   | `/auth/google`                 | Authenticate hoặc register bằng Google SSO.                       | Public.                            | Body: `id_token` hoặc OAuth `authorization_code`, optional `redirect_uri`. | `200` hoặc `201` với `user` và `session`.             | `400` request không hợp lệ. `401` Google credential không hợp lệ. `403` account banned. `409` conflict provider/email. | Verify issuer, audience, expiry, email verification, provider ID uniqueness.                                                              | UC-AUTH-01, UC-AUTH-02 | Thiếu                                               |
| `GET`    | `/me`                          | Trả về user hiện tại và session metadata.                         | Parent/admin đã authenticated.     | Không có.                                                                  | `200` với `session` và `user`.                        | `401` thiếu/invalid session. `403` account banned.                                                                     | Session token hợp lệ và chưa hết hạn.                                                                                                     | UC-AUTH-02, UC-AUTH-05 | Đã triển khai                                       |
| `PATCH`  | `/me`                          | Cập nhật thông tin tài khoản.                                     | Parent/admin đã authenticated.     | Body: optional `email`, `phone_number`, `full_name`.                       | `200` với `user` đã cập nhật.                         | `400` field không hợp lệ. `401` invalid session. `403` account banned. `409` email/phone đã dùng.                      | Validate email/phone; full name <= 120 ký tự; phải có ít nhất một field. Đổi email/phone nên yêu cầu reauth hoặc verify trong production. | UC-AUTH-05             | Thiếu                                               |
| `PATCH`  | `/me/password`                 | Đổi mật khẩu khi đang đăng nhập.                                  | User local/phone đã authenticated. | Body: `current_password`, `new_password`.                                  | `200` message.                                        | `400` mật khẩu mới yếu. `401` mật khẩu hiện tại sai. `403` account banned hoặc provider account không có password.     | Current password bắt buộc; new password >= 8 ký tự và khác mật khẩu hiện tại.                                                             | UC-AUTH-05             | Thiếu                                               |
| `DELETE` | `/auth/session`                | Đăng xuất session hiện tại.                                       | Parent/admin đã authenticated.     | Không có.                                                                  | `200` message.                                        | `401` missing/invalid session. `403` account banned.                                                                   | Session token phải tồn tại.                                                                                                               | UC-AUTH-03             | Đã triển khai                                       |
| `POST`   | `/auth/password-reset/request` | Yêu cầu OTP/link reset mật khẩu.                                  | Public.                            | Body: `identifier` email hoặc phone.                                       | `200` generic message.                                | `400` identifier không hợp lệ. `429` quá nhiều request.                                                                | Không tiết lộ account có tồn tại hay không; rate-limit theo identifier/IP; chỉ cho local/phone account.                                   | UC-AUTH-04             | Thiếu                                               |
| `POST`   | `/auth/password-reset/verify`  | Xác minh OTP và cấp reset token.                                  | Public.                            | Body: `identifier`, `otp`.                                                 | `200` với `reset_token` ngắn hạn.                     | `400` OTP sai/hết hạn. `429` quá nhiều lần thử.                                                                        | OTP đúng format; chưa hết hạn; còn lượt thử.                                                                                              | UC-AUTH-04             | Thiếu                                               |
| `POST`   | `/auth/password-reset/confirm` | Đặt mật khẩu mới bằng reset token.                                | Public.                            | Body: `reset_token`, `new_password`.                                       | `200` message.                                        | `400` token không hợp lệ hoặc password yếu. `401` token hết hạn.                                                       | Token chỉ dùng một lần; new password >= 8 ký tự; invalidate code đã dùng và có thể invalidate session.                                    | UC-AUTH-04             | Thiếu                                               |
| `POST`   | `/devices`                     | Đăng ký thiết bị phụ huynh để nhận push notification.             | Parent đã authenticated.           | Body: `platform`, `push_token`, optional `app_instance_id`.                | `201` với `device`.                                   | `400` platform/token không hợp lệ. `401` invalid session. `403` account banned. `409` token conflict.                  | Platform enum: `WEB`, `IOS`, `ANDROID`; token không rỗng; một active record cho mỗi token.                                                | UC-NOTIF-01            | Thiếu, suy luận                                     |
| `DELETE` | `/devices/:deviceId`           | Xóa/vô hiệu hóa push device.                                      | Parent sở hữu device.              | Path: `deviceId`.                                                          | `200` message.                                        | `400` UUID không hợp lệ. `401` invalid session. `403` không sở hữu. `404` không tìm thấy.                              | Device phải thuộc parent authenticated.                                                                                                   | UC-NOTIF-01            | Thiếu, suy luận                                     |

### Hồ sơ trẻ và Preferences

| Method   | Path                             | Mục đích                                | Auth/Authz            | Request                                                                 | Response                                                       | Error responses                                                                                                             | Validation                                                                                                                                               | Use case liên quan    | Trạng thái    |
| -------- | -------------------------------- | --------------------------------------- | --------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------- |
| `POST`   | `/children`                      | Tạo hồ sơ trẻ cho parent authenticated. | Parent authenticated. | Body: `nickname`, `birth_year`, optional `avatar_url`.                  | `201` với `message` và `child`.                                | `400` nickname/avatar/birth year không hợp lệ. `401` invalid session. `403` parent bị ban/inactive. `404` parent not found. | Nickname không rỗng <= 80 ký tự; avatar <= 2048 ký tự; birth year từ current year - 18 đến current year.                                                 | UC-CHILD-01           | Đã triển khai |
| `GET`    | `/children`                      | Liệt kê child profile thuộc parent.     | Parent authenticated. | Không có.                                                               | `200` với `children[]`, gồm preference summary.                | `401` invalid session. `403` parent bị ban/inactive. `404` parent not found.                                                | Parent lấy từ session.                                                                                                                                   | UC-CHILD-02           | Đã triển khai |
| `GET`    | `/children/:childId`             | Trả về một child profile.               | Parent sở hữu child.  | Path: `childId`.                                                        | `200` với `child`, preferences, star balance và summary links. | `400` UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                            | UUID format và ownership.                                                                                                                                | UC-CHILD-02           | Thiếu         |
| `PATCH`  | `/children/:childId`             | Cập nhật child profile.                 | Parent sở hữu child.  | Path: `childId`. Body: optional `nickname`, `birth_year`, `avatar_url`. | `200` với `child` đã cập nhật.                                 | `400` body/UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                       | Giới hạn field như create; phải có ít nhất một field. Nếu birth year thay đổi, không tự gỡ content đã unlock.                                            | UC-CHILD-03           | Thiếu         |
| `DELETE` | `/children/:childId`             | Xóa child profile và dữ liệu phụ thuộc. | Parent sở hữu child.  | Path: `childId`. Body: confirmation string hoặc password confirmation.  | `200` message.                                                 | `400` thiếu confirmation/UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.         | Bắt buộc xác nhận rõ. Cascade xóa logs, preferences, sessions, unlocks, pets.                                                                            | UC-CHILD-03           | Thiếu         |
| `GET`    | `/children/:childId/preferences` | Đọc sensory preferences.                | Parent sở hữu child.  | Path: `childId`.                                                        | `200` với `preferences`.                                       | `400` UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child/preference not found.                 | Bắt buộc ownership.                                                                                                                                      | UC-PREF-01, UC-REG-01 | Thiếu         |
| `PATCH`  | `/children/:childId/preferences` | Cập nhật sensory preferences.           | Parent sở hữu child.  | Body: optional `is_high_contrast`, object `preferences` typed.          | `200` với `preferences` đã cập nhật.                           | `400` preference schema không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.               | Validate key: theme, volume 0-100, brightness 0-100, timeout seconds dương, boolean cho reduced motion/voice prompts. Reject giá trị unsupported/unsafe. | UC-PREF-01, UC-REG-01 | Thiếu         |

### Nội dung học tập và Sessions

| Method | Path                                            | Mục đích                                                                          | Auth/Authz                                          | Request                                                                                                                                                | Response                                                                                                                  | Error responses                                                                                                                                                                 | Validation                                                                                                                                                                         | Use case liên quan                                   | Trạng thái |
| ------ | ----------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- |
| `GET`  | `/children/:childId/contents`                   | Liệt kê content khả dụng cho child, gồm trạng thái locked/unlocked.               | Parent sở hữu child.                                | Path: `childId`. Query: optional `type`, `difficulty_level`, `include_locked`, `status` chỉ admin.                                                     | `200` với `contents[]`. Mỗi item có base content, payload theo loại, `is_unlocked`, `unlock_star_cost`, progress summary. | `400` filter không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                                                              | Type enum; difficulty 1-3; parent/child chỉ thấy content published.                                                                                                                | UC-CONTENT-01, UC-LEARN-01, UC-LEARN-02, UC-LEARN-03 | Thiếu      |
| `GET`  | `/contents/:contentId`                          | Đọc chi tiết content.                                                             | Parent đọc content published; admin đọc mọi status. | Path: `contentId`. Optional query `child_id` để include unlock state.                                                                                  | `200` với content detail.                                                                                                 | `400` UUID không hợp lệ. `401` invalid session. `403` locked/not authorized. `404` not found.                                                                                   | Parent chỉ đọc content published và phải sở hữu `child_id` nếu truyền vào.                                                                                                         | UC-CONTENT-01                                        | Thiếu      |
| `POST` | `/children/:childId/content-sessions`           | Ghi nhận hoàn thành lecture, quiz attempt, AI game result hoặc abandoned session. | Parent sở hữu child.                                | Body: `content_id`, optional `idempotency_key`, `duration_seconds`, `status`, optional `selected_emotion`, `is_correct`, `ai_match_score`, `metadata`. | `201` với `session`, `stars_earned`, `child_total_stars`.                                                                 | `400` field không hợp lệ. `401` invalid session. `403` không sở hữu child hoặc content locked. `404` child/content not found. `409` idempotency key trùng hoặc reward conflict. | Content phải published và unlocked; duration dương nếu có; status `COMPLETED` hoặc `ABANDONED`; score 0-100; selected emotion của quiz phải hợp lệ. Award stars trong transaction. | UC-LEARN-01, UC-LEARN-02, UC-LEARN-03, UC-REG-02     | Thiếu      |
| `GET`  | `/children/:childId/content-sessions`           | Liệt kê lịch sử học tập.                                                          | Parent sở hữu child.                                | Query: optional `type`, `from`, `to`, `limit`, `cursor`.                                                                                               | `200` với paginated `sessions[]`.                                                                                         | `400` range/pagination không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                                                    | Limit có trần, ví dụ <= 100. Date range hợp lệ.                                                                                                                                    | UC-DASH-01                                           | Thiếu      |
| `POST` | `/children/:childId/contents/:contentId/unlock` | Dùng sao để mở khóa content trả phí.                                              | Parent sở hữu child.                                | Path: `childId`, `contentId`. Optional body: `idempotency_key`.                                                                                        | `201` với `unlock`, `child_total_stars`, `star_transaction`.                                                              | `400` UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child/content not found. `409` không đủ sao hoặc đã unlock.                                     | Content phải published; cost >= 0; atomic update phải bảo đảm `total_stars >= cost`.                                                                                               | UC-ECON-01                                           | Thiếu      |

### Pets và Store

| Method  | Path                                  | Mục đích                        | Auth/Authz                  | Request                                                             | Response                                                        | Error responses                                                                                                                         | Validation                                                                      | Use case liên quan | Trạng thái |
| ------- | ------------------------------------- | ------------------------------- | --------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------ | ---------- |
| `GET`   | `/pets`                               | Liệt kê pet active trong store. | Parent/admin authenticated. | Query: optional `include_hidden` chỉ admin.                         | `200` với `pets[]`.                                             | `401` invalid session. `403` include hidden nhưng không phải admin.                                                                     | Parent chỉ thấy pet `ACTIVE`.                                                   | UC-ECON-02         | Thiếu      |
| `GET`   | `/children/:childId/pets`             | Liệt kê pet trẻ sở hữu.         | Parent sở hữu child.        | Path: `childId`.                                                    | `200` với `child_pets[]` và pet details.                        | `400` UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                        | Bắt buộc ownership.                                                             | UC-ECON-02         | Thiếu      |
| `POST`  | `/children/:childId/pets`             | Mua pet cho trẻ.                | Parent sở hữu child.        | Body: `pet_id`, optional `custom_name`, optional `idempotency_key`. | `201` với `child_pet`, `child_total_stars`, `star_transaction`. | `400` body không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child/pet not found. `409` không đủ sao hoặc đã sở hữu. | Pet phải active; custom name giới hạn, ví dụ <= 80 ký tự; atomic balance check. | UC-ECON-02         | Thiếu      |
| `PATCH` | `/children/:childId/pets/:childPetId` | Đổi tên pet đã sở hữu.          | Parent sở hữu child.        | Body: `custom_name`.                                                | `200` với `child_pet` đã cập nhật.                              | `400` name/UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` pet ownership not found.                           | Name optional nhưng nếu có <= 80 ký tự.                                         | UC-ECON-02         | Thiếu      |

### Tracking, Regulation, Alerts, Reports

| Method | Path                                     | Mục đích                                      | Auth/Authz                                            | Request                                                                                                                 | Response                                                      | Error responses                                                                                                          | Validation                                                                                                                                                                    | Use case liên quan                  | Trạng thái                 |
| ------ | ---------------------------------------- | --------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------- |
| `POST` | `/children/:childId/emotion-logs`        | Ghi nhận emotion/behavior event.              | Parent sở hữu child; có thể thêm service auth.        | Body: `emotion_value`, `trigger_source`, optional `duration_seconds`, optional suy luận `confidence_score`, `metadata`. | `201` với `log`.                                              | `400` UUID/emotion/source/duration không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found. | Emotion/source enum; duration là số nguyên dương; confidence 0-1 hoặc 0-100, chọn một convention và enforce.                                                                  | UC-TRACK-01, UC-REG-01, UC-NOTIF-01 | Đã triển khai basic create |
| `GET`  | `/children/:childId/emotion-logs`        | Liệt kê lịch sử cảm xúc của trẻ.              | Parent sở hữu child.                                  | Query: optional `from`, `to`, `emotion`, `trigger_source`, `limit`, `cursor`.                                           | `200` với paginated `logs[]`.                                 | `400` filter không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                       | Limit cap; date range hợp lệ; enum filter hợp lệ.                                                                                                                             | UC-TRACK-01, UC-DASH-01             | Thiếu                      |
| `POST` | `/children/:childId/regulation-events`   | Ghi nhận can thiệp điều hòa cảm giác.         | Parent/client sở hữu child; có thể thêm service auth. | Body: `trigger_emotion_log_id`, `action`, `started_at`, optional `ended_at`, `duration_seconds`, `metadata`.            | `201` với `regulation_event`.                                 | `400` body không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child/log not found.                     | Action enum: `REDUCE_BRIGHTNESS`, `PAUSE_ANIMATION`, `PLAY_CALMING_AUDIO`, `VOICE_PROMPT`, `TIMEOUT`, `SHOW_STORY`, `RESUME`. Duration dương; log liên quan phải thuộc child. | UC-REG-01, UC-REG-02                | Thiếu, suy luận            |
| `GET`  | `/children/:childId/regulation-events`   | Liệt kê lịch sử regulation.                   | Parent sở hữu child.                                  | Query: optional `from`, `to`, `action`, `limit`, `cursor`.                                                              | `200` với paginated `regulation_events[]`.                    | `400` filter không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                       | Limit cap và date range hợp lệ.                                                                                                                                               | UC-REG-01, UC-REG-02, UC-DASH-01    | Thiếu, suy luận            |
| `GET`  | `/children/:childId/alerts`              | Liệt kê alert gửi cho phụ huynh về một child. | Parent sở hữu child.                                  | Query: optional `from`, `to`, `status`, `limit`, `cursor`.                                                              | `200` với `alerts[]`.                                         | `400` filter không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                       | Alert được generate khi negative emotion/regulation vượt ngưỡng.                                                                                                              | UC-NOTIF-01, UC-DASH-01             | Thiếu, suy luận            |
| `GET`  | `/children/:childId/dashboard`           | Trả dashboard học tập và cảm xúc của trẻ.     | Parent sở hữu child.                                  | Query: `days` optional integer 1-90.                                                                                    | `200` với `child`, `learning`, `emotions`, `meltdown_alerts`. | `400` UUID/days không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` parent/child not found.             | Days default 7; tối đa 90.                                                                                                                                                    | UC-DASH-01                          | Đã triển khai basic        |
| `GET`  | `/children/:childId/reports/summary.pdf` | Export PDF report.                            | Parent sở hữu child.                                  | Query: optional `from`, `to`, `days`, `include_emotions`, `include_learning`.                                           | `200` `application/pdf`.                                      | `400` range không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found. `500` lỗi generate.    | Date range có giới hạn; default range, ví dụ 30 ngày. Audit export event.                                                                                                     | UC-DASH-02                          | Thiếu                      |

### Admin

| Method   | Path                         | Mục đích                                   | Auth/Authz           | Request                                                                                                             | Response                                                | Error responses                                                                                                                                          | Validation                                                                                                                  | Use case liên quan       | Trạng thái      |
| -------- | ---------------------------- | ------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------- |
| `GET`    | `/admin/contents`            | Liệt kê toàn bộ content, gồm draft.        | Admin authenticated. | Query: optional `type`, `status`, `difficulty_level`, `search`, `limit`, `cursor`.                                  | `200` với paginated `contents[]`.                       | `400` filter không hợp lệ. `401` invalid session. `403` không phải admin.                                                                                | Enum filter; limit cap.                                                                                                     | UC-ADMIN-01              | Thiếu           |
| `POST`   | `/admin/contents`            | Tạo lecture, quiz hoặc game.               | Admin authenticated. | Body: base `title`, `type`, `status`; payload theo loại cho `lecture`, `quiz` hoặc `game`.                          | `201` với content detail đã tạo.                        | `400` payload không hợp lệ. `401` invalid session. `403` không phải admin. `409` title trùng nếu thêm uniqueness.                                        | Đúng một type payload khớp với `type`; difficulty 1-3; game time limit > 0; star cost >= 0; quiz options có correct option. | UC-ADMIN-01              | Thiếu           |
| `GET`    | `/admin/contents/:contentId` | Đọc mọi content detail.                    | Admin authenticated. | Path: `contentId`.                                                                                                  | `200` với content detail.                               | `400` UUID không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.                                                                 | UUID format.                                                                                                                | UC-ADMIN-01              | Thiếu           |
| `PATCH`  | `/admin/contents/:contentId` | Cập nhật content và dữ liệu theo loại.     | Admin authenticated. | Body: partial base và type-specific fields.                                                                         | `200` với content detail đã cập nhật.                   | `400` field không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.                                                                | Không đổi type trừ khi triển khai delete/recreate; validate status transition.                                              | UC-ADMIN-01              | Thiếu           |
| `DELETE` | `/admin/contents/:contentId` | Xóa content.                               | Admin authenticated. | Path: `contentId`; body confirmation.                                                                               | `200` message.                                          | `400` thiếu confirmation/UUID không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.                                              | Bắt buộc confirmation và audit log. Cascade unlock/session theo DB policy.                                                  | UC-ADMIN-01              | Thiếu           |
| `POST`   | `/admin/media-assets`        | Đăng ký hoặc upload media cho content/pet. | Admin authenticated. | Multipart file hoặc body `file_name`, `mime_type`, `size_bytes`, `purpose`.                                         | `201` với `media_asset` hoặc signed upload URL.         | `400` MIME/size không hỗ trợ. `401` invalid session. `403` không phải admin. `413` file quá lớn.                                                         | Chỉ cho image/video/audio/Lottie type theo product; virus scanning/storage validation được suy luận.                        | UC-ADMIN-01, UC-ADMIN-02 | Thiếu, suy luận |
| `GET`    | `/admin/pets`                | Liệt kê mọi pet gồm hidden.                | Admin authenticated. | Query: optional `status`, `search`, `limit`, `cursor`.                                                              | `200` với `pets[]`.                                     | `400` filter không hợp lệ. `401` invalid session. `403` không phải admin.                                                                                | Status enum; limit cap.                                                                                                     | UC-ADMIN-02              | Thiếu           |
| `POST`   | `/admin/pets`                | Tạo pet.                                   | Admin authenticated. | Body: `name`, optional `description`, `image_url`, optional `animation_url`, `unlock_star_cost`, optional `status`. | `201` với `pet`.                                        | `400` body không hợp lệ. `401` invalid session. `403` không phải admin.                                                                                  | Name không rỗng; image bắt buộc; cost >= 0; status `ACTIVE` hoặc `HIDDEN`.                                                  | UC-ADMIN-02              | Thiếu           |
| `PATCH`  | `/admin/pets/:petId`         | Cập nhật item trong pet catalog.           | Admin authenticated. | Body: partial pet fields.                                                                                           | `200` với `pet` đã cập nhật.                            | `400` UUID/body không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.                                                            | Validation giống create; phải có ít nhất một field.                                                                         | UC-ADMIN-02              | Thiếu           |
| `DELETE` | `/admin/pets/:petId`         | Xóa hoặc hide pet.                         | Admin authenticated. | Path: `petId`; body confirmation hoặc `mode`.                                                                       | `200` message.                                          | `400` UUID/confirmation không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found. `409` pet đã thuộc về trẻ nếu hard delete bị chặn. | Ưu tiên `status = HIDDEN`; hard delete cần confirmation và audit log.                                                       | UC-ADMIN-02              | Thiếu           |
| `GET`    | `/admin/users`               | Tìm kiếm users.                            | Admin authenticated. | Query: optional `role`, `status`, `search`, `limit`, `cursor`.                                                      | `200` với paginated `users[]`.                          | `400` filter không hợp lệ. `401` invalid session. `403` không phải admin.                                                                                | Role/status enum; search theo email/phone/full name.                                                                        | UC-ADMIN-03              | Thiếu           |
| `GET`    | `/admin/users/:userId`       | Đọc chi tiết user.                         | Admin authenticated. | Path: `userId`.                                                                                                     | `200` với user, child count, session summary và status. | `400` UUID không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.                                                                 | UUID format.                                                                                                                | UC-ADMIN-03              | Thiếu           |
| `PATCH`  | `/admin/users/:userId`       | Cập nhật status hoặc role user.            | Admin authenticated. | Body: optional `status`, optional `role`.                                                                           | `200` với `user` đã cập nhật.                           | `400` body không hợp lệ. `401` invalid session. `403` không phải admin hoặc self-change nguy hiểm. `404` not found.                                      | Status enum; role enum; bảo vệ last admin/self-ban.                                                                         | UC-ADMIN-03              | Thiếu           |
| `DELETE` | `/admin/users/:userId`       | Hard-delete user và cascade data.          | Admin authenticated. | Body: confirmation và reason.                                                                                       | `200` message.                                          | `400` thiếu confirmation. `401` invalid session. `403` không phải admin hoặc self-delete nguy hiểm. `404` not found.                                     | Bắt buộc audit log; enforce cascade; cân nhắc retention/legal policy trước production.                                      | UC-ADMIN-03              | Thiếu           |
| `GET`    | `/admin/analytics`           | Trả aggregate system analytics.            | Admin authenticated. | Query: optional `from`, `to`, `granularity`.                                                                        | `200` với aggregate metrics.                            | `400` range không hợp lệ. `401` invalid session. `403` không phải admin.                                                                                 | Date range giới hạn; mặc định chỉ aggregate.                                                                                | UC-ADMIN-04              | Thiếu           |

## Điểm Thiếu hoặc Mơ hồ trong SRS

### Thiếu trong triển khai hiện tại

1. Google SSO registration/sign-in.
2. Phone-only registration và lifecycle tài khoản phone-password.
3. Route request/verify/confirm reset mật khẩu.
4. Route cập nhật account và đổi mật khẩu.
5. Đăng ký device token và gửi push notification.
6. Route detail, update và delete child profile.
7. Route read/update preferences và typed preference schema.
8. Route browse/detail content cho UI học tập của trẻ.
9. Route content session completion cho lecture, quiz, game và abandoned session.
10. Chính sách thưởng sao và xử lý idempotent reward.
11. Route dùng sao để unlock content và mua pet.
12. Star ledger bất biến để debug biến động balance.
13. Pet store và route quản lý pet của trẻ.
14. Data model quiz answer options.
15. AI game scoring contract, success threshold và AI model metadata.
16. Emotion log listing/filtering.
17. Regulation event model và route.
18. Alert model, alert cooldown và tracking notification status.
19. PDF report export.
20. Admin content CRUD.
21. Admin pet CRUD.
22. Admin user management.
23. Admin system analytics.
24. Media asset upload/registration.
25. Audit logging cho admin changes, destructive deletes, bans và report exports.
26. Pagination/cursor support cho list endpoints.
27. Rate limiting cho auth, password reset, emotion logging và AI event ingestion.
28. RBAC middleware cho parent/admin/system authorization.
29. Webcam consent và enforcement chính sách retention dữ liệu.

### Mơ hồ trong SRS

1. Đăng ký có tạo session ngay hay bắt buộc đăng nhập lại.
2. Số điện thoại có thể là identifier duy nhất hay chỉ là identifier phụ.
3. Google SSO có được link vào local account có cùng email hay không.
4. Số sao thưởng cụ thể cho hoàn thành lecture, trả lời quiz đúng và thắng AI game.
5. Cùng một content có được nhận sao nhiều lần hay không.
6. Mô hình answer options của quiz và emotion taxonomy được hỗ trợ.
7. AI inference chạy ở trình duyệt, backend hay external service.
8. Webcam frame thô có bao giờ upload không. Tài liệu này giả định không lưu frame thô.
9. Ngưỡng xác định thành công cho AI game.
10. Ngưỡng xác định stress/meltdown ngoài yêu cầu "tiêu cực hơn 1 phút".
11. Admin delete nên hard delete hay soft hide cho content/pet đã có historical sessions.
12. Parent có được manually trigger time-out/regulation hay chỉ AI được trigger.
13. Report cần raw logs, summary hay diễn giải thân thiện với chuyên gia.
14. Khi birth year của child thay đổi, có recompute content difficulty không.
15. Admin có được xem report định danh cấp trẻ hay chỉ aggregate analytics.

## Ghi chú Triển khai cho Developer

1. Thêm middleware theo role:
   - `requireAuth` đã resolve session.
   - Thêm `requireRole("PARENT")`, `requireRole("ADMIN")` và ownership guard cho `childId`.
2. Không đưa parent ID vào protected route/body. Luôn resolve parent từ session.
3. Dùng transaction cho mọi thao tác ảnh hưởng tới sao:
   - Finish session và award stars.
   - Unlock content.
   - Buy pet.
   - Ghi `star_transactions` trong cùng transaction.
4. Chống star balance âm bằng conditional update:
   - Policy ví dụ: `UPDATE child_profiles SET total_stars = total_stars - cost WHERE id = $childId AND total_stars >= cost`.
   - Nếu không update được row nào, trả `409 INSUFFICIENT_STARS`.
5. Thêm idempotency key cho endpoint reward và purchase. Client web/mobile sẽ retry khi mạng kém.
6. Không tin `stars_earned` do client gửi. Backend phải tự tính reward từ content policy và kết quả đã validate.
7. Không tin `is_correct` do client gửi cho quiz. Backend phải so sánh selected answer với correct answer/options đã lưu.
8. Định nghĩa TypeScript type chặt cho `preferences`. Tránh metadata lỏng kiểu `any`.
9. Thêm quiz options trước khi build Quiz API. Field `correct_emotion` hiện tại chưa đủ để render hoặc validate danh sách đáp án.
10. Xem AI score là không đáng tin trừ khi đến từ backend/service token đáng tin cậy. Nếu tính client-side, giới hạn reward và dùng anti-replay/idempotency.
11. Chỉ lưu event suy ra từ webcam, không lưu raw frame. Nếu thêm media upload, bắt buộc có consent rõ ràng, retention rule và access control.
12. Dùng cursor pagination cho logs, sessions, users, content và admin analytics. Offset pagination chỉ phù hợp cho danh sách admin nhỏ.
13. Giữ error envelope hiện có trong `docs/API.md` cho mọi endpoint.
14. Thêm rate limit:

- Auth và password reset theo IP và identifier.
- Emotion/regulation logs theo child và session.
- Admin media upload theo admin và file size.

15. Thêm audit logs cho:

- Admin ban/unban user.
- Admin hard delete.
- Publish/delete content.
- Export report.
- Hoàn tất password reset.

16. Với report generation, bắt đầu bằng PDF đồng bộ cho date range giới hạn. Chuyển sang async job nếu thời gian generate vượt latency target của API.
17. Dashboard query nên aggregate-first. Không load toàn bộ logs vào memory để vẽ chart tuần/tháng.
18. Thêm index trước khi chạy tải cao:

- `content_sessions(child_id, created_at desc)` đã có.
- `emotion_logs(child_id, created_at desc)` đã có.
- Thêm index cho `device_tokens(user_id)`, `alerts(child_id, created_at desc)`, `star_transactions(child_id, created_at desc)` và `audit_logs(actor_user_id, created_at desc)`.

19. Cẩn thận với cascade delete. Hành vi này khớp SRS, nhưng hệ thống production liên quan đến trẻ em có thể cần soft delete, export, retention hoặc legal erasure workflow.
20. Tạo content của admin phải transactional: insert `contents` và đúng một detail row, hoặc rollback toàn bộ.

## Thứ tự Xây dựng Đề xuất

1. P0 auth/account completion: password reset, Google SSO, account update, RBAC middleware.
2. P0 child/profile completion: child detail/update/delete và preferences endpoints.
3. P0 content consumption: child content list/detail và content session completion với backend reward policy.
4. P0 tracking/dashboard: emotion log list, dashboard hardening, regulation events.
5. P1 economy/store: atomic content unlocks, pets và star ledger.
6. P1 notifications/reports: device tokens, alerts, PDF export.
7. P1 admin: content CRUD, media assets, pet CRUD, user management.
8. P2 analytics và operational hardening.
