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
- `POST /auth/google`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/verify`
- `POST /auth/password-reset/confirm`
- `GET /me`
- `PATCH /me`
- `PATCH /me/password`
- `DELETE /auth/session`
- `POST /children`
- `GET /children`
- `GET /children/:childId`
- `PATCH /children/:childId`
- `DELETE /children/:childId`
- `GET /children/:childId/preferences`
- `PATCH /children/:childId/preferences`
- `GET /children/:childId/contents`
- `GET /contents/:contentId`
- `POST /children/:childId/contents/:contentId/unlock`
- `POST /children/:childId/emotion-logs`
- `GET /children/:childId/emotion-logs`
- `GET /children/:childId/dashboard`
- `GET /pets`
- `GET /children/:childId/pets`
- `POST /children/:childId/pets`
- `PATCH /children/:childId/pets/:childPetId`
- `GET /admin/pets`
- `POST /admin/pets`
- `PATCH /admin/pets/:petId`
- `DELETE /admin/pets/:petId`

## Giả định và Cách xử lý Mơ hồ

1. Trẻ không đăng nhập trực tiếp. Phụ huynh đăng nhập, chọn hồ sơ trẻ, và giao diện dành cho trẻ gửi sự kiện dưới phiên đăng nhập của phụ huynh.
2. Admin dùng chung bảng `users` với `role = ADMIN`. Tạo tài khoản admin là luồng nội bộ, trừ khi sau này có chức năng admin hiện hữu tạo admin mới.
3. AI inference, Computer Vision và chatbot chạy bên ngoài backend này. Frontend gọi trực tiếp các AI service đó và chỉ gửi sự kiện, điểm số, thời lượng, nhãn model và kết quả đã suy ra về backend. Cấm upload/lưu raw webcam frame.
4. `game_sessions` trong SRS được ánh xạ thành bảng `content_sessions` hiện có.
5. `unlock_content_id` trong `content_sessions` nghĩa là trẻ chỉ được ghi nhận tiến độ cho nội dung đã mở khóa.
6. Reset mật khẩu phải chống dò tài khoản. Dù SRS nói báo lỗi khi email/số điện thoại không tồn tại, hành vi production nên trả về thông báo chung cho yêu cầu reset.
7. Xóa content và danh mục pet là soft delete. Unlock, session và pet trẻ đã sở hữu phải được giữ lại cho lịch sử/báo cáo, trừ khi sau này có workflow legal erasure riêng.
8. Email là identifier bắt buộc. Số điện thoại là identifier phụ tùy chọn và chỉ dùng đăng nhập khi đã có.
9. Số sao thuộc về từng hồ sơ trẻ. Phụ huynh thực hiện mua/mở khóa phần thưởng thay cho trẻ.
10. `AAC_BOARD` có trong mã nguồn như một nguồn trigger cảm xúc, nhưng SRS chưa định nghĩa workflow AAC board. Tài liệu này xem đây là nguồn trigger có thể hỗ trợ về sau.
11. Push notification cần quản lý device token. SRS yêu cầu gửi thông báo nhưng không định nghĩa quản lý token, nên các API thiết bị được suy luận thêm.
12. Báo cáo PDF có thể tạo đồng bộ cho báo cáo nhỏ. Nếu báo cáo lớn, nên chuyển sang async job và artifact tải về.
13. Đăng ký tạo persisted session ngay; client không bắt người dùng đăng nhập lần hai sau signup thành công.
14. Google SSO link vào local account hiện có khi Google trả về cùng email đã verify.
15. Trẻ chỉ được nhận sao một lần cho mỗi content. Các lần hoàn thành sau vẫn có thể ghi nhận tiến độ/lịch sử nhưng phải cộng 0 sao. Reward cố định: hoàn thành lecture = 1 sao, trả lời quiz đúng = 2 sao, thắng AI game = 3 sao.
16. Birth year là immutable từ frontend sau khi tạo hồ sơ trẻ. Difficulty không được recompute từ thay đổi birth year.
17. Regulation và time-out chỉ do AI trigger. Phụ huynh xem kết quả/lịch sử nhưng không trigger thủ công trong luồng sản phẩm bình thường.
18. Báo cáo phải thân thiện, dễ đọc, ưu tiên summary/diễn giải thay vì dump raw event.
19. Admin analytics chỉ là aggregate. Admin không được xem log, thống kê hoặc report định danh cấp trẻ.
20. Media quiz, danh sách emotion đáp án và đáp án đúng do admin định nghĩa. UI của trẻ render emotion đáp án dưới dạng emoji.
21. Ngưỡng alert/regulation cho cảm xúc tiêu cực là đúng một rule: duration cảm xúc tiêu cực lớn hơn 60 giây. Các giá trị tiêu cực hiện gồm `SAD`, `ANGRY`, `STRESSED`, `SCARED`; nhãn model bên ngoài `fear` được map về `SCARED`. Không có ngưỡng stress/meltdown nào khác.

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
- Gửi emotion log đã suy ra qua frontend child-facing. Regulation/time-out do luồng AI trigger, không do phụ huynh trigger thủ công.

### Admin

Được phép truy cập:

- CRUD nội dung bài giảng, quiz và game.
- CRUD danh mục pet.
- Danh sách người dùng, đổi trạng thái người dùng và xóa tài khoản.
- Dashboard/analytics tổng quan hệ thống.
- Luồng đăng ký/upload media asset.

Ràng buộc admin:

- Admin không được xem như phụ huynh trong endpoint hồ sơ trẻ, trừ khi sau này mô hình hóa vai trò hỗ trợ riêng.
- Admin không được truy cập log, thống kê hoặc report định danh cấp trẻ thông qua tính năng analytics.

### AI Service bên ngoài

Frontend gọi trực tiếp AI/computer-vision/chatbot service. Backend này không proxy các service đó và không giữ credential inference service.

Được phép:

- Mặc định không truy cập trực tiếp API backend.
- Frontend child-facing có thể gửi kết quả AI đã suy ra vào backend dưới phiên phụ huynh đã authenticated.

Contract service bên ngoài đã biết:

- Chatbot service "Bạn thỏ": base URL `http://localhost:8080`, `GET /health`, `POST /chat`.
- Emotion model service: base URL `http://localhost:9000`, `GET /health`, `GET /model/info`, `GET /model/download`, `POST /model/predict`.
- Nhãn model là `happy`, `sad`, `angry`, `fear`, `neutral`; backend normalize thành `HAPPY`, `SAD`, `ANGRY`, `SCARED`, `NEUTRAL`.

## Thực thể Cốt lõi và Quan hệ

### `users`

Tài khoản phụ huynh và admin.

Trường chính:

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
- `avatar_url` lưu S3 object key của avatar trẻ; API response trả presigned URL.
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
- `deleted_at` cho soft delete

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
- Chính sách reward cố định: hoàn thành lecture được 1 sao ở lần hoàn thành được thưởng đầu tiên.

### `quizzes`

Metadata media và đáp án của quiz.

Trường hiện có:

- `answer_emotions`: danh sách emotion identifier do admin định nghĩa và hiển thị cho trẻ dưới dạng emoji.
- `correct_emotion`

Yêu cầu:

- `correct_emotion` phải nằm trong `answer_emotions`.
- Emotion catalog cuối cùng vẫn là TODO, nên giá trị lưu hiện là string identifier cho đến khi catalog được chốt.
- Chính sách reward cố định: quiz đúng được 2 sao ở lần hoàn thành được thưởng đầu tiên.
- **Suy luận** hint dạng text/audio.

### `game`

Metadata game AI bắt chước cảm xúc.

Trường cần có:

- `target_emotion`
- `time_limit_seconds`
- `difficulty_level`
- `is_default`
- `unlock_star_cost`
- `prompt_asset_type`: `ICON`, `IMAGE`, hoặc `VIDEO`, khớp hướng frontend hiện tại level 1 dùng icon, level 2 dùng ảnh, level 3 dùng video.
- `prompt_asset_url`
- Chính sách reward cố định: AI game thành công được 3 sao ở lần hoàn thành được thưởng đầu tiên.

Ghi chú:

- Contract AI hiện không định nghĩa ngưỡng confidence chung. Logic session sau này nên lưu `confidence` và `all_scores`, nhưng game success phải dựa trên rule sản phẩm rõ ràng thay vì ngưỡng backend ngầm định.

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
- `selected_emotion`
- `idempotency_key`
- `started_at`
- `completed_at`
- `ai_detected_emotion`
- `ai_confidence`
- `ai_scores`
- `metadata`
- `status`: `COMPLETED`, `ABANDONED`

Trường bắt buộc còn thiếu:

- Unique rewarded completion theo `(child_id, unlock_content_id)`: hoàn thành lặp lại phải ghi `stars_earned = 0`.

### `emotion_logs`

Lịch sử cảm xúc và hành vi.

Trường chính:

- `emotion_value`
- `trigger_source`
- `duration_seconds`
- `confidence_score`
- `ai_emotion_label`
- `ai_confidence`
- `ai_scores`
- `metadata`
- `created_at`

Giá trị yêu cầu:

- Emotion: `HAPPY`, `SAD`, `ANGRY`, `STRESSED`, `CALM`, `NEUTRAL`, `SCARED`, `SURPRISED`.
- Nhãn model bên ngoài được chấp nhận: `happy`, `sad`, `angry`, `fear`, `neutral`.
- Trigger source: `AAC_BOARD`, `GAME`, `QUIZ`, `LECTURE`, `WEBCAM`, `SYSTEM`.

Trường bắt buộc còn thiếu:

- **Suy luận** `session_id` hoặc `content_session_id`.

### `pets`

Danh mục pet trong store.

Trường chính:

- `name`
- `description`
- `image_url`
- `animation_url`
- `unlock_star_cost`
- `status`: `ACTIVE`, `HIDDEN`
- `deleted_at` cho soft delete

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
- `audit_logs`: hành động admin, soft delete, legal hard delete, ban tài khoản và export báo cáo nhạy cảm.

## Use Cases

### UC-AUTH-01: Đăng ký tài khoản phụ huynh

- Actors: Phụ huynh.
- Preconditions: Phụ huynh chưa authenticated. Email/phone/Google identity chưa được liên kết.
- Main flow:
  1. Phụ huynh mở màn hình đăng ký.
  2. Chọn email/password hoặc Google SSO. Số điện thoại có thể gửi kèm như identifier phụ tùy chọn.
  3. Backend validate email unique, phone unique nếu có, và format input.
  4. Backend hash password cho local registration hoặc verify Google identity cho SSO.
  5. Backend tạo `users` với `role = PARENT` và `status = ACTIVE`.
  6. Backend tạo persisted session và cập nhật `last_login_at`.
  7. Backend trả về user đã tạo và session token.
- Alternative/error flows:
  - Email hoặc phone trùng trả `409`.
  - Password yếu hoặc identifier không hợp lệ trả `400`.
  - Google token verify thất bại trả `401`.
  - Provider account đã liên kết trả `409`.
- Postconditions: Tài khoản phụ huynh và active session tồn tại.
- Related API endpoints: `POST /auth/signup`, `POST /auth/google`.
- Priority: P0.
- Current status: Đã triển khai cho signup email/password và đăng ký/link bằng Google ID token.

### UC-AUTH-02: Đăng nhập

- Actors: Phụ huynh, Admin.
- Preconditions: Tài khoản tồn tại và active.
- Main flow:
  1. User gửi email hoặc số điện thoại kèm mật khẩu, hoặc gửi chứng thực Google SSO.
  2. Backend verify credential/provider.
  3. Với Google SSO, backend link vào local account có cùng email đã verify nếu tồn tại.
  4. Backend từ chối tài khoản bị ban.
  5. Backend tạo persisted session và cập nhật `last_login_at`.
  6. Backend trả về user và session token.
  7. Client điều hướng phụ huynh đến chọn hồ sơ trẻ hoặc admin đến dashboard quản trị.
- Alternative/error flows:
  - Sai thông tin đăng nhập trả `401`.
  - Tài khoản dùng provider khác với phương thức đăng nhập trả `401`.
  - Tài khoản bị ban trả `403`.
- Postconditions: Có active session.
- Related API endpoints: `POST /auth/signin`, `POST /auth/google`, `GET /me`.
- Priority: P0.
- Current status: Đã triển khai cho local email/phone sign-in và Google ID-token sign-in.

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
- Preconditions: Phụ huynh có tài khoản local email/password.
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
- Current status: Một phần. Đã có route/use case và gửi OTP qua email/SMS; còn thiếu rate limiting và hardening bộ đếm số lần thử.

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
  1. Phụ huynh gửi nickname, năm sinh và file avatar tùy chọn.
  2. Backend validate input và quyền sở hữu.
  3. Backend suy ra difficulty mục tiêu từ tuổi.
  4. Backend upload avatar lên S3 storage nếu có file.
  5. Backend tạo `child_profiles`.
  6. Backend tạo `preferences` mặc định.
  7. Backend mở khóa lecture, quiz và game mặc định theo difficulty.
  8. Backend trả hồ sơ trẻ kèm presigned avatar URL nếu có avatar.
- Alternative/error flows:
  - Thiếu nickname hoặc năm sinh không hợp lệ trả `400`.
  - Avatar không đúng định dạng trả `400`; avatar lớn hơn 5 MB trả `413`; upload S3 lỗi trả `502`.
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
- Current status: Đã triển khai.

### UC-CHILD-03: Cập nhật hoặc xóa hồ sơ trẻ

- Actors: Phụ huynh.
- Preconditions: Phụ huynh sở hữu hồ sơ trẻ.
- Main flow:
  1. Phụ huynh sửa nickname hoặc file avatar. Birth year không được sửa từ frontend.
  2. Backend validate và cập nhật hồ sơ.
  3. Nếu xóa, backend yêu cầu xác nhận rõ ràng.
  4. Backend xóa hồ sơ trẻ và cascade dữ liệu phụ thuộc.
- Alternative/error flows:
  - Không tìm thấy child trả `404`.
  - Child không thuộc phụ huynh trả `403`.
  - Thiếu xác nhận xóa trả `400`.
- Postconditions: Hồ sơ được cập nhật hoặc xóa. Difficulty content không được recompute từ thay đổi birth year sau này.
- Related API endpoints: `PATCH /children/:childId`, `DELETE /children/:childId`.
- Priority: P1.
- Current status: Đã triển khai.

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
- Current status: Đã triển khai. Route đọc/cập nhật validate object preferences có type và giữ ownership theo child.

### UC-CONTENT-01: Xem nội dung khả dụng

- Actors: Phụ huynh, Trẻ.
- Preconditions: Phụ huynh authenticated và đã chọn hồ sơ trẻ.
- Main flow:
  1. Client yêu cầu danh sách content cho trẻ.
  2. Backend trả content published, chưa bị soft-delete, trạng thái unlock, dữ liệu theo loại, difficulty, cost và tóm tắt progress.
  3. Client render lecture, quiz và game phù hợp với trẻ.
- Alternative/error flows:
  - Không tìm thấy child trả `404`.
  - Child không thuộc phụ huynh trả `403`.
  - Không có content: trả danh sách rỗng.
- Postconditions: Trẻ có thể chọn learning item đã mở khóa.
- Related API endpoints: `GET /children/:childId/contents`, `GET /contents/:contentId`.
- Priority: P0.
- Current status: Đã triển khai. Danh sách theo child và detail content published có kèm unlock state/progress khi truyền `child_id`.

### UC-LEARN-01: Hoàn thành bài giảng

- Actors: Trẻ thông qua phiên phụ huynh.
- Preconditions: Đã chọn hồ sơ trẻ. Lecture published và unlocked.
- Main flow:
  1. Trẻ bắt đầu lecture media.
  2. Client phát ảnh/video và voiceover.
  3. Trẻ xem đủ thời lượng yêu cầu.
  4. Client gửi completed content session.
  5. Backend validate unlock, ghi session và chỉ thưởng sao nếu trẻ chưa từng nhận sao cho lecture đó.
- Alternative/error flows:
  - Trẻ thoát giữa chừng: client ghi `ABANDONED`; không thưởng sao.
  - Content locked hoặc unpublished trả `403` hoặc `404`.
  - Retry trùng cùng idempotency key trả kết quả ban đầu.
- Postconditions: Progress được ghi nhận. Sao chỉ tăng ở lần hoàn thành được thưởng đầu tiên của lecture.
- Related API endpoints: `GET /children/:childId/contents`, `POST /children/:childId/content-sessions`.
- Priority: P0.
- Current status: Một phần. Có bảng/query helper. Thiếu route/use case.

### UC-LEARN-02: Trả lời quiz

- Actors: Trẻ thông qua phiên phụ huynh.
- Preconditions: Quiz published và unlocked.
- Main flow:
  1. Client hiển thị quiz media và danh sách đáp án.
  2. Trẻ chọn một đáp án cảm xúc được render dạng emoji từ danh sách đáp án do admin định nghĩa.
  3. Client gửi câu trả lời.
  4. Backend validate đáp án đã chọn với `answer_emotions` và `correct_emotion`.
  5. Nếu đúng, backend ghi session và chỉ thưởng sao nếu trẻ chưa từng nhận sao cho quiz đó.
  6. Nếu sai, backend ghi attempt theo policy và trả hint/try-again guidance.
- Alternative/error flows:
  - Emotion được chọn không nằm trong answer list của quiz trả `400`.
  - Timeout/không tương tác có thể ghi `ABANDONED`.
  - Content locked trả `403`.
- Postconditions: Attempt được lưu để thống kê dashboard.
- Related API endpoints: `GET /children/:childId/contents`, `POST /children/:childId/content-sessions`.
- Priority: P0.
- Current status: Thiếu. Schema hiện thiếu answer options và chưa có session route.

### UC-LEARN-03: Chơi game AI bắt chước cảm xúc

- Actors: Trẻ thông qua phiên phụ huynh, AI service bên ngoài do frontend gọi.
- Preconditions: Game published và unlocked. Client đã được cấp quyền webcam.
- Main flow:
  1. Client hiển thị cảm xúc mục tiêu.
  2. Trẻ bắt chước biểu cảm trong giới hạn thời gian.
  3. Frontend gọi model service bên ngoài và nhận emotion dự đoán, confidence và điểm của từng nhãn.
  4. Client gửi kết quả AI game đã suy ra.
  5. Backend validate target/predicted emotion, score range, unlock state, idempotency và first-reward rule.
  6. Backend ghi session và thưởng sao nếu kết quả đạt rule game success đã chọn và trẻ chưa từng nhận sao cho game đó.
- Alternative/error flows:
  - Không nhận diện được mặt: client nhắc trẻ và có thể gửi abandoned/failed attempt.
  - Phát hiện cảm xúc tiêu cực: trigger sensory regulation use cases.
  - Payload score không hợp lệ trả `400`; backend không gọi hoặc authenticate AI service trực tiếp.
- Postconditions: Attempt AI được ghi nhận. Sao chỉ tăng ở lần hoàn thành được thưởng đầu tiên của game.
- Related API endpoints: `POST /children/:childId/content-sessions`, `POST /children/:childId/emotion-logs`, `POST /children/:childId/regulation-events`.
- Priority: P1.
- Current status: Một phần. Đã có placeholder DB cho selected emotion, idempotency, AI label/scores và metadata. Thiếu route/use case; backend chỉ nên lưu kết quả AI đã suy ra.

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
- Current status: Một phần. Đã có route và use case unlock trừ sao atomically; vẫn thiếu star ledger bất biến và idempotency key.

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
- Current status: Một phần. Đã có route store/ownership cho phụ huynh và CRUD admin pet catalog; vẫn thiếu star ledger/idempotency key cho purchase.

### UC-TRACK-01: Ghi nhận sự kiện cảm xúc hoặc hành vi

- Actors: Child-facing client dùng quan sát đã suy ra từ AI/frontend.
- Preconditions: Phụ huynh sở hữu child. Client có consent và permission quan sát nguồn liên quan.
- Main flow:
  1. Client nhận hoặc suy ra cảm xúc/hành vi từ webcam, game, quiz, lecture, AAC board hoặc system event.
  2. Client gửi emotion, trigger source, duration, confidence, nhãn/điểm model AI và metadata.
  3. Backend validate ownership và enum.
  4. Backend lưu `emotion_logs`.
  5. Backend lưu event cho dashboard/report. Quyết định regulation do AI trigger vẫn nằm ngoài backend này trừ khi sau này duyệt tích hợp.
- Alternative/error flows:
  - Emotion/source không hợp lệ trả `400`.
  - Child không thuộc phụ huynh trả `403`.
  - Cảm xúc tiêu cực kéo dài có thể trigger parent notification sau khi policy notification được triển khai.
- Postconditions: Event khả dụng cho dashboard và report.
- Related API endpoints: `POST /children/:childId/emotion-logs`, `GET /children/:childId/emotion-logs`.
- Priority: P0.
- Current status: Đã triển khai create/list với optional AI label, confidence, all scores và metadata. Raw frame vẫn bị cấm.

### UC-REG-01: Điều hòa cảm xúc tự động

- Actors: Luồng AI bên ngoài, child-facing client.
- Preconditions: Client phát hiện stress, khóc, biểu cảm giận, rage click hoặc rời khỏi vị trí. Child preferences tồn tại.
- Main flow:
  1. Luồng AI bên ngoài xác định cảm xúc tiêu cực kéo dài hơn 60 giây.
  2. Client ghi emotion log đã suy ra.
  3. Client áp dụng preferences: giảm sáng, pause animation, giảm/tắt nhạc nền, phát nhạc/giọng nói xoa dịu hoặc đổi theme.
  4. Client ghi regulation event kèm action details khi route tồn tại.
  5. Nếu trẻ bình tĩnh lại, client tiếp tục bài học.
- Alternative/error flows:
  - Cảm xúc tiêu cực kéo dài hơn 60 giây: gửi push notification cho phụ huynh.
  - Thiếu preference config: dùng safe defaults.
- Postconditions: Intervention có thể audit và UI của trẻ đã được điều chỉnh.
- Related API endpoints: `POST /children/:childId/emotion-logs`, `POST /children/:childId/regulation-events`, `GET /children/:childId/preferences`.
- Priority: P0.
- Current status: Thiếu, trừ raw emotion log creation.

### UC-REG-02: Chế độ time-out

- Actors: Luồng AI bên ngoài, child-facing client.
- Preconditions: AI xác định cảm xúc tiêu cực đã kéo dài hơn 60 giây.
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
  3. Backend tạo PDF thân thiện, dễ đọc, có summary, chart và diễn giải trước raw log.
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
  2. Admin tạo lecture, quiz hoặc game với title, status, media, difficulty, default flag, danh sách emotion đáp án của quiz, đáp án đúng của quiz hoặc target emotion của game.
  3. Backend validate payload theo loại.
  4. Backend lưu `contents` và đúng một row chi tiết theo loại trong transaction.
  5. Admin publish, sửa hoặc soft-delete content bằng cách set `deleted_at`.
- Alternative/error flows:
  - Upload/media format không hợp lệ trả `400`.
  - Thiếu payload theo loại trả `400`.
  - Xóa content ẩn khỏi browse/default unlock trong tương lai nhưng giữ unlock/session lịch sử.
- Postconditions: Content published và chưa bị soft-delete khả dụng cho trẻ hoặc default unlock.
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
  4. Admin có thể hide hoặc soft-delete pet.
- Alternative/error flows:
  - Pet đã có trẻ sở hữu được soft-delete hoặc hide; lịch sử sở hữu của trẻ được giữ lại.
  - Media trùng hoặc không hợp lệ trả `400`.
- Postconditions: Store pet phản ánh thay đổi của admin.
- Related API endpoints: `GET /admin/pets`, `POST /admin/pets`, `PATCH /admin/pets/:petId`, `DELETE /admin/pets/:petId`.
- Priority: P1.
- Current status: Đã triển khai cho list/create/update/soft-delete pet catalog chưa bị deleted.

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
  2. Backend trả aggregate user counts, active child count, completion rate theo content, quiz success rate, emotion aggregate counts và alert counts dựa trên ngưỡng cảm xúc tiêu cực 60 giây.
  3. Backend loại bỏ log, thống kê và report định danh cấp trẻ.
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

| Method   | Path                           | Mục đích                                                                        | Auth/Authz                         | Request                                                                   | Response                                                | Error responses                                                                                                    | Validation                                                                                                                                     | Use case liên quan     | Trạng thái                             |
| -------- | ------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------- |
| `POST`   | `/auth/signup`                 | Tạo tài khoản phụ huynh bằng local credentials và session ngay.                 | Public.                            | Body: `email`, `password`, optional `phone_number`, optional `full_name`. | `201` với `message`, `user` và `session` gồm raw token. | `400` JSON/email/password/phone/full name không hợp lệ. `409` email hoặc phone đã dùng.                            | Email đúng format; password dài >= 8; phone 8-15 chữ số, có thể bắt đầu bằng `+`; full name <= 120 ký tự.                                      | UC-AUTH-01             | Đã triển khai cho email/password.      |
| `POST`   | `/auth/signin`                 | Authenticate parent/admin local bằng email hoặc phone identifier.               | Public.                            | Body: `identifier`, `password`.                                           | `200` với `message`, `user`, `session` gồm raw token.   | `400` thiếu identifier/password. `401` sai credentials hoặc provider không hỗ trợ. `403` account banned.           | Identifier và password không rỗng.                                                                                                             | UC-AUTH-02             | Đã triển khai cho local auth.          |
| `POST`   | `/auth/google`                 | Authenticate/register bằng Google SSO, link local account cùng email đã verify. | Public.                            | Body: `id_token`.                                                         | `200` với `user` và `session`.                          | `400` thiếu token. `401` Google credential không hợp lệ. `500` thiếu Google client config.                         | Verify issuer, audience, expiry, email và provider ID qua Google ID-token verification.                                                        | UC-AUTH-01, UC-AUTH-02 | Đã triển khai                          |
| `GET`    | `/me`                          | Trả về user hiện tại và session metadata.                                       | Parent/admin đã authenticated.     | Không có.                                                                 | `200` với `session` và `user`.                          | `401` thiếu/invalid session. `403` account banned.                                                                 | Session token hợp lệ và chưa hết hạn.                                                                                                          | UC-AUTH-02, UC-AUTH-05 | Đã triển khai                          |
| `PATCH`  | `/me`                          | Cập nhật thông tin tài khoản.                                                   | Parent/admin đã authenticated.     | Body: optional `email`, `phone_number`, `full_name`.                      | `200` với `user` đã cập nhật.                           | `400` field không hợp lệ. `401` invalid session. `403` account banned. `409` email/phone đã dùng.                  | Validate email/phone; full name <= 120 ký tự; phải có ít nhất một field. Đổi email/phone nên yêu cầu reauth hoặc verify trong production.      | UC-AUTH-05             | Đã triển khai                          |
| `PATCH`  | `/me/password`                 | Đổi mật khẩu khi đang đăng nhập.                                                | User local/phone đã authenticated. | Body: `current_password`, `new_password`.                                 | `200` message.                                          | `400` mật khẩu mới yếu. `401` mật khẩu hiện tại sai. `403` account banned hoặc provider account không có password. | Current password bắt buộc; new password >= 8 ký tự và khác mật khẩu hiện tại.                                                                  | UC-AUTH-05             | Đã triển khai                          |
| `DELETE` | `/auth/session`                | Đăng xuất session hiện tại.                                                     | Parent/admin đã authenticated.     | Không có.                                                                 | `200` message.                                          | `401` missing/invalid session. `403` account banned.                                                               | Session token phải tồn tại.                                                                                                                    | UC-AUTH-03             | Đã triển khai                          |
| `POST`   | `/auth/password-reset/request` | Yêu cầu OTP/link reset mật khẩu qua email hoặc TextBee SMS.                     | Public.                            | Body: `identifier` email hoặc phone.                                      | `200` generic message.                                  | `400` identifier không hợp lệ. `500` thiếu TextBee config. `502` TextBee provider lỗi. `429` quá nhiều request.    | Không tiết lộ account có tồn tại hay không; rate-limit theo identifier/IP; chỉ cho local/phone account; TextBee device phải online để gửi SMS. | UC-AUTH-04             | Một phần: thiếu rate limit.            |
| `POST`   | `/auth/password-reset/verify`  | Xác minh OTP và cấp reset token.                                                | Public.                            | Body: `identifier`, `otp`.                                                | `200` với `reset_token` ngắn hạn.                       | `400` OTP sai/hết hạn. `429` quá nhiều lần thử.                                                                    | OTP đúng format; chưa hết hạn; còn lượt thử.                                                                                                   | UC-AUTH-04             | Một phần: còn TODO hardening lượt thử. |
| `POST`   | `/auth/password-reset/confirm` | Đặt mật khẩu mới bằng reset token.                                              | Public.                            | Body: `reset_token`, `new_password`.                                      | `200` message.                                          | `400` token không hợp lệ hoặc password yếu. `401` token hết hạn.                                                   | Token chỉ dùng một lần; new password >= 8 ký tự; invalidate code đã dùng và có thể invalidate session.                                         | UC-AUTH-04             | Đã triển khai                          |
| `POST`   | `/devices`                     | Đăng ký thiết bị phụ huynh để nhận push notification.                           | Parent đã authenticated.           | Body: `platform`, `push_token`, optional `app_instance_id`.               | `201` với `device`.                                     | `400` platform/token không hợp lệ. `401` invalid session. `403` account banned. `409` token conflict.              | Platform enum: `WEB`, `IOS`, `ANDROID`; token không rỗng; một active record cho mỗi token.                                                     | UC-NOTIF-01            | Thiếu, suy luận                        |
| `DELETE` | `/devices/:deviceId`           | Xóa/vô hiệu hóa push device.                                                    | Parent sở hữu device.              | Path: `deviceId`.                                                         | `200` message.                                          | `400` UUID không hợp lệ. `401` invalid session. `403` không sở hữu. `404` không tìm thấy.                          | Device phải thuộc parent authenticated.                                                                                                        | UC-NOTIF-01            | Thiếu, suy luận                        |

### Hồ sơ trẻ và Preferences

| Method   | Path                             | Mục đích                                | Auth/Authz            | Request                                                                 | Response                                                       | Error responses                                                                                                                                                        | Validation                                                                                                                                               | Use case liên quan    | Trạng thái    |
| -------- | -------------------------------- | --------------------------------------- | --------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------- |
| `POST`   | `/children`                      | Tạo hồ sơ trẻ cho parent authenticated. | Parent authenticated. | Multipart fields: `nickname`, `birth_year`, optional file `avatar`.     | `201` với `message` và `child`; `avatar_url` là presigned URL. | `400` nickname/avatar/birth year không hợp lệ. `401` invalid session. `403` parent bị ban/inactive. `404` parent not found. `413` avatar quá lớn. `502` upload S3 lỗi. | Nickname không rỗng <= 80 ký tự; avatar phải là JPEG/PNG/WebP/GIF/AVIF <= 5 MB; birth year từ current year - 18 đến current year.                        | UC-CHILD-01           | Đã triển khai |
| `GET`    | `/children`                      | Liệt kê child profile thuộc parent.     | Parent authenticated. | Không có.                                                               | `200` với `children[]`, gồm preference summary.                | `401` invalid session. `403` parent bị ban/inactive. `404` parent not found.                                                                                           | Parent lấy từ session.                                                                                                                                   | UC-CHILD-02           | Đã triển khai |
| `GET`    | `/children/:childId`             | Trả về một child profile.               | Parent sở hữu child.  | Path: `childId`.                                                        | `200` với `child`, preferences và star balance.                | `400` UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                                                       | UUID format và ownership.                                                                                                                                | UC-CHILD-02           | Đã triển khai |
| `PATCH`  | `/children/:childId`             | Cập nhật child profile.                 | Parent sở hữu child.  | Path: `childId`. Multipart body với optional `nickname`, file `avatar`. | `200` với `child` đã cập nhật; `avatar_url` là presigned URL.  | `400` body/UUID/avatar không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found. `413` avatar quá lớn. `502` upload S3 lỗi.                | Giới hạn field mutable như create; phải có ít nhất một field. `birth_year` chỉ được set khi tạo từ frontend.                                             | UC-CHILD-03           | Đã triển khai |
| `DELETE` | `/children/:childId`             | Xóa child profile và dữ liệu phụ thuộc. | Parent sở hữu child.  | Path: `childId`. Body: `confirmation` chính xác `DELETE`.               | `200` message.                                                 | `400` thiếu confirmation/UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                                    | Bắt buộc xác nhận rõ. Cascade xóa logs, preferences, sessions, unlocks, pets.                                                                            | UC-CHILD-03           | Đã triển khai |
| `GET`    | `/children/:childId/preferences` | Đọc sensory preferences.                | Parent sở hữu child.  | Path: `childId`.                                                        | `200` với `preferences`.                                       | `400` UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child/preference not found.                                                            | Bắt buộc ownership.                                                                                                                                      | UC-PREF-01, UC-REG-01 | Đã triển khai |
| `PATCH`  | `/children/:childId/preferences` | Cập nhật sensory preferences.           | Parent sở hữu child.  | Body: optional `is_high_contrast`, object `preferences` typed.          | `200` với `preferences` đã cập nhật.                           | `400` preference schema không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                                          | Validate key: theme, volume 0-100, brightness 0-100, timeout seconds dương, boolean cho reduced motion/voice prompts. Reject giá trị unsupported/unsafe. | UC-PREF-01, UC-REG-01 | Đã triển khai |

### Nội dung học tập và Sessions

| Method | Path                                            | Mục đích                                                                          | Auth/Authz                  | Request                                                                                                                                                                                                     | Response                                                                                                                  | Error responses                                                                                                                                                                 | Validation                                                                                                                                                                                                                                                           | Use case liên quan                                   | Trạng thái    |
| ------ | ----------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------- |
| `GET`  | `/children/:childId/contents`                   | Liệt kê content khả dụng cho child, gồm trạng thái locked/unlocked.               | Parent sở hữu child.        | Path: `childId`. Query: optional `type`, `difficulty_level`, `include_locked`.                                                                                                                              | `200` với `contents[]`. Mỗi item có base content, payload theo loại, `is_unlocked`, `unlock_star_cost`, progress summary. | `400` filter không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                                                              | Type enum; difficulty 1-3; parent/child chỉ thấy content published và chưa bị soft-delete.                                                                                                                                                                           | UC-CONTENT-01, UC-LEARN-01, UC-LEARN-02, UC-LEARN-03 | Đã triển khai |
| `GET`  | `/contents/:contentId`                          | Đọc chi tiết content published.                                                   | Parent/admin authenticated. | Path: `contentId`. Optional query `child_id` để include unlock state.                                                                                                                                       | `200` với content detail.                                                                                                 | `400` UUID không hợp lệ. `401` invalid session. `403` not authorized. `404` not found.                                                                                          | User protected đọc được content published; `child_id` yêu cầu ownership của parent.                                                                                                                                                                                  | UC-CONTENT-01                                        | Đã triển khai |
| `POST` | `/children/:childId/content-sessions`           | Ghi nhận hoàn thành lecture, quiz attempt, AI game result hoặc abandoned session. | Parent sở hữu child.        | Body: `content_id`, optional `idempotency_key`, `duration_seconds`, `status`, optional `selected_emotion`, `is_correct`, `ai_match_score`, `ai_detected_emotion`, `ai_confidence`, `ai_scores`, `metadata`. | `201` với `session`, `stars_earned`, `child_total_stars`.                                                                 | `400` field không hợp lệ. `401` invalid session. `403` không sở hữu child hoặc content locked. `404` child/content not found. `409` idempotency key trùng hoặc reward conflict. | Content phải published, chưa bị soft-delete và đã unlock; duration dương nếu có; status `COMPLETED` hoặc `ABANDONED`; AI confidence/scores nằm trong 0-1. Reward cố định: lecture 1, quiz đúng 2, AI game thành công 3; chỉ thưởng tối đa một lần mỗi child/content. | UC-LEARN-01, UC-LEARN-02, UC-LEARN-03, UC-REG-02     | Thiếu         |
| `GET`  | `/children/:childId/content-sessions`           | Liệt kê lịch sử học tập.                                                          | Parent sở hữu child.        | Query: optional `type`, `from`, `to`, `limit`, `cursor`.                                                                                                                                                    | `200` với paginated `sessions[]`.                                                                                         | `400` range/pagination không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                                                    | Limit có trần, ví dụ <= 100. Date range hợp lệ.                                                                                                                                                                                                                      | UC-DASH-01                                           | Thiếu         |
| `POST` | `/children/:childId/contents/:contentId/unlock` | Dùng sao để mở khóa content trả phí.                                              | Parent sở hữu child.        | Path: `childId`, `contentId`.                                                                                                                                                                               | `201` với `unlock`, `child_total_stars`.                                                                                  | `400` UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child/content not found. `409` không đủ sao hoặc đã unlock.                                     | Content phải published; cost >= 0; atomic update phải bảo đảm `total_stars >= cost`. Star transaction ledger vẫn thiếu.                                                                                                                                              | UC-ECON-01                                           | Một phần      |

### Pets và Store

| Method  | Path                                  | Mục đích                        | Auth/Authz                  | Request                                 | Response                                    | Error responses                                                                                                                         | Validation                                                                          | Use case liên quan | Trạng thái    |
| ------- | ------------------------------------- | ------------------------------- | --------------------------- | --------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------ | ------------- |
| `GET`   | `/pets`                               | Liệt kê pet active trong store. | Parent/admin authenticated. | Không có.                               | `200` với `pets[]`.                         | `401` invalid session. `403` account banned.                                                                                            | Chỉ trả pet `ACTIVE`, chưa bị soft-delete.                                          | UC-ECON-02         | Đã triển khai |
| `GET`   | `/children/:childId/pets`             | Liệt kê pet trẻ sở hữu.         | Parent sở hữu child.        | Path: `childId`.                        | `200` với `child_pets[]` và pet details.    | `400` UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                        | Bắt buộc ownership.                                                                 | UC-ECON-02         | Đã triển khai |
| `POST`  | `/children/:childId/pets`             | Mua pet cho trẻ.                | Parent sở hữu child.        | Body: `pet_id`, optional `custom_name`. | `201` với `child_pet`, `child_total_stars`. | `400` body không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child/pet not found. `409` không đủ sao hoặc đã sở hữu. | Pet phải active và chưa soft-delete; custom name <= 80 ký tự; atomic balance check. | UC-ECON-02         | Đã triển khai |
| `PATCH` | `/children/:childId/pets/:childPetId` | Đổi tên pet đã sở hữu.          | Parent sở hữu child.        | Body: `custom_name`.                    | `200` với `child_pet` đã cập nhật.          | `400` name/UUID không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` pet ownership not found.                           | Có thể xóa name; nếu có <= 80 ký tự.                                                | UC-ECON-02         | Đã triển khai |

### Tracking, Regulation, Alerts, Reports

| Method | Path                                     | Mục đích                                            | Auth/Authz                                   | Request                                                                                                                                                                          | Response                                                      | Error responses                                                                                                                                | Validation                                                                                                                                                          | Use case liên quan                  | Trạng thái               |
| ------ | ---------------------------------------- | --------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------ |
| `POST` | `/children/:childId/emotion-logs`        | Ghi nhận emotion/behavior event đã suy ra.          | Parent sở hữu child.                         | Body: `emotion_value` hoặc `ai_result.emotion`, `trigger_source`, optional `duration_seconds`, `confidence_score`, `ai_emotion_label`, `ai_confidence`, `ai_scores`, `metadata`. | `201` với `log`.                                              | `400` UUID/emotion/source/duration/confidence/AI payload không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found. | Chấp nhận backend emotion enum và model label `happy`, `sad`, `angry`, `fear`, `neutral`; duration là số nguyên dương; confidence/scores 0-1; cấm raw webcam frame. | UC-TRACK-01, UC-REG-01, UC-NOTIF-01 | Đã triển khai            |
| `GET`  | `/children/:childId/emotion-logs`        | Liệt kê lịch sử cảm xúc của trẻ.                    | Parent sở hữu child.                         | Query: optional `from`, `to`, `emotion`, `trigger_source`, `limit`, `cursor`.                                                                                                    | `200` với paginated `logs[]` và `next_cursor`.                | `400` filter không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                             | Limit cap; date range hợp lệ; enum filter hợp lệ.                                                                                                                   | UC-TRACK-01, UC-DASH-01             | Đã triển khai basic list |
| `POST` | `/children/:childId/regulation-events`   | Ghi nhận can thiệp điều hòa cảm giác do AI trigger. | Parent sở hữu child qua client child-facing. | Body: `trigger_emotion_log_id`, `action`, `started_at`, optional `ended_at`, `duration_seconds`, `metadata`.                                                                     | `201` với `regulation_event`.                                 | `400` body không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child/log not found.                                           | Action enum: `REDUCE_BRIGHTNESS`, `PAUSE_ANIMATION`, `PLAY_CALMING_AUDIO`, `VOICE_PROMPT`, `TIMEOUT`, `SHOW_STORY`, `RESUME`. Không hỗ trợ parent trigger thủ công. | UC-REG-01, UC-REG-02                | Thiếu, suy luận          |
| `GET`  | `/children/:childId/regulation-events`   | Liệt kê lịch sử regulation.                         | Parent sở hữu child.                         | Query: optional `from`, `to`, `action`, `limit`, `cursor`.                                                                                                                       | `200` với paginated `regulation_events[]`.                    | `400` filter không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                             | Limit cap và date range hợp lệ.                                                                                                                                     | UC-REG-01, UC-REG-02, UC-DASH-01    | Thiếu, suy luận          |
| `GET`  | `/children/:childId/alerts`              | Liệt kê alert gửi cho phụ huynh về một child.       | Parent sở hữu child.                         | Query: optional `from`, `to`, `status`, `limit`, `cursor`.                                                                                                                       | `200` với `alerts[]`.                                         | `400` filter không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found.                                             | Alert chỉ được generate khi duration của cảm xúc tiêu cực lớn hơn 60 giây.                                                                                          | UC-NOTIF-01, UC-DASH-01             | Thiếu, suy luận          |
| `GET`  | `/children/:childId/dashboard`           | Trả dashboard học tập và cảm xúc của trẻ.           | Parent sở hữu child.                         | Query: `days` optional integer 1-90.                                                                                                                                             | `200` với `child`, `learning`, `emotions`, `meltdown_alerts`. | `400` UUID/days không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` parent/child not found.                                   | Days default 7; tối đa 90.                                                                                                                                          | UC-DASH-01                          | Đã triển khai basic      |
| `GET`  | `/children/:childId/reports/summary.pdf` | Export PDF report thân thiện, dễ đọc.               | Parent sở hữu child.                         | Query: optional `from`, `to`, `days`, `include_emotions`, `include_learning`.                                                                                                    | `200` `application/pdf`.                                      | `400` range không hợp lệ. `401` invalid session. `403` không sở hữu child. `404` child not found. `500` lỗi generate.                          | Date range có giới hạn; default range, ví dụ 30 ngày. Ưu tiên summary/chart dễ đọc hơn raw log. Audit export event.                                                 | UC-DASH-02                          | Thiếu                    |

### Admin

| Method   | Path                         | Mục đích                                   | Auth/Authz           | Request                                                                                                             | Response                                                | Error responses                                                                                                      | Validation                                                                                                                                 | Use case liên quan       | Trạng thái      |
| -------- | ---------------------------- | ------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | --------------- |
| `GET`    | `/admin/contents`            | Liệt kê toàn bộ content, gồm draft.        | Admin authenticated. | Query: optional `type`, `status`, `difficulty_level`, `search`, `limit`, `cursor`.                                  | `200` với paginated `contents[]`.                       | `400` filter không hợp lệ. `401` invalid session. `403` không phải admin.                                            | Enum filter; limit cap.                                                                                                                    | UC-ADMIN-01              | Thiếu           |
| `POST`   | `/admin/contents`            | Tạo lecture, quiz hoặc game.               | Admin authenticated. | Body: base `title`, `type`, `status`; payload theo loại cho `lecture`, `quiz` hoặc `game`.                          | `201` với content detail đã tạo.                        | `400` payload không hợp lệ. `401` invalid session. `403` không phải admin. `409` title trùng nếu thêm uniqueness.    | Đúng một type payload khớp với `type`; difficulty 1-3; game time limit > 0; star cost >= 0; quiz `answer_emotions` chứa `correct_emotion`. | UC-ADMIN-01              | Thiếu           |
| `GET`    | `/admin/contents/:contentId` | Đọc mọi content detail.                    | Admin authenticated. | Path: `contentId`.                                                                                                  | `200` với content detail.                               | `400` UUID không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.                             | UUID format.                                                                                                                               | UC-ADMIN-01              | Thiếu           |
| `PATCH`  | `/admin/contents/:contentId` | Cập nhật content và dữ liệu theo loại.     | Admin authenticated. | Body: partial base và type-specific fields.                                                                         | `200` với content detail đã cập nhật.                   | `400` field không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.                            | Không đổi type trừ khi triển khai delete/recreate; validate status transition.                                                             | UC-ADMIN-01              | Thiếu           |
| `DELETE` | `/admin/contents/:contentId` | Soft-delete content.                       | Admin authenticated. | Path: `contentId`; body confirmation.                                                                               | `200` message.                                          | `400` thiếu confirmation/UUID không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.          | Bắt buộc confirmation và audit log. Set `deleted_at`; giữ lịch sử unlock/session.                                                          | UC-ADMIN-01              | Thiếu           |
| `POST`   | `/admin/media-assets`        | Đăng ký hoặc upload media cho content/pet. | Admin authenticated. | Multipart file hoặc body `file_name`, `mime_type`, `size_bytes`, `purpose`.                                         | `201` với `media_asset` hoặc signed upload URL.         | `400` MIME/size không hỗ trợ. `401` invalid session. `403` không phải admin. `413` file quá lớn.                     | Chỉ cho image/video/audio/Lottie type theo product; virus scanning/storage validation được suy luận.                                       | UC-ADMIN-01, UC-ADMIN-02 | Thiếu, suy luận |
| `GET`    | `/admin/pets`                | Liệt kê mọi pet gồm hidden.                | Admin authenticated. | Query: optional `status`, `search`, `limit`.                                                                        | `200` với `pets[]`.                                     | `400` filter không hợp lệ. `401` invalid session. `403` không phải admin.                                            | Status enum; limit cap.                                                                                                                    | UC-ADMIN-02              | Đã triển khai   |
| `POST`   | `/admin/pets`                | Tạo pet.                                   | Admin authenticated. | Body: `name`, optional `description`, `image_url`, optional `animation_url`, `unlock_star_cost`, optional `status`. | `201` với `pet`.                                        | `400` body không hợp lệ. `401` invalid session. `403` không phải admin.                                              | Name không rỗng; image bắt buộc; cost >= 0; status `ACTIVE` hoặc `HIDDEN`.                                                                 | UC-ADMIN-02              | Đã triển khai   |
| `PATCH`  | `/admin/pets/:petId`         | Cập nhật item trong pet catalog.           | Admin authenticated. | Body: partial pet fields.                                                                                           | `200` với `pet` đã cập nhật.                            | `400` UUID/body không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.                        | Validation giống create; phải có ít nhất một field.                                                                                        | UC-ADMIN-02              | Đã triển khai   |
| `DELETE` | `/admin/pets/:petId`         | Soft-delete pet.                           | Admin authenticated. | Path: `petId`; body confirmation chính xác `DELETE`.                                                                | `200` message.                                          | `400` UUID/confirmation không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.                | Set `deleted_at` và `status = HIDDEN`; giữ lịch sử child ownership.                                                                        | UC-ADMIN-02              | Đã triển khai   |
| `GET`    | `/admin/users`               | Tìm kiếm users.                            | Admin authenticated. | Query: optional `role`, `status`, `search`, `limit`, `cursor`.                                                      | `200` với paginated `users[]`.                          | `400` filter không hợp lệ. `401` invalid session. `403` không phải admin.                                            | Role/status enum; search theo email/phone/full name.                                                                                       | UC-ADMIN-03              | Thiếu           |
| `GET`    | `/admin/users/:userId`       | Đọc chi tiết user.                         | Admin authenticated. | Path: `userId`.                                                                                                     | `200` với user, child count, session summary và status. | `400` UUID không hợp lệ. `401` invalid session. `403` không phải admin. `404` not found.                             | UUID format.                                                                                                                               | UC-ADMIN-03              | Thiếu           |
| `PATCH`  | `/admin/users/:userId`       | Cập nhật status hoặc role user.            | Admin authenticated. | Body: optional `status`, optional `role`.                                                                           | `200` với `user` đã cập nhật.                           | `400` body không hợp lệ. `401` invalid session. `403` không phải admin hoặc self-change nguy hiểm. `404` not found.  | Status enum; role enum; bảo vệ last admin/self-ban.                                                                                        | UC-ADMIN-03              | Thiếu           |
| `DELETE` | `/admin/users/:userId`       | Hard-delete user và cascade data.          | Admin authenticated. | Body: confirmation và reason.                                                                                       | `200` message.                                          | `400` thiếu confirmation. `401` invalid session. `403` không phải admin hoặc self-delete nguy hiểm. `404` not found. | Bắt buộc audit log; enforce cascade; cân nhắc retention/legal policy trước production.                                                     | UC-ADMIN-03              | Thiếu           |
| `GET`    | `/admin/analytics`           | Trả aggregate system analytics.            | Admin authenticated. | Query: optional `from`, `to`, `granularity`.                                                                        | `200` với aggregate metrics.                            | `400` range không hợp lệ. `401` invalid session. `403` không phải admin.                                             | Date range giới hạn; chỉ aggregate. Không lộ log/thống kê/report định danh cấp trẻ.                                                        | UC-ADMIN-04              | Thiếu           |

## Điểm Thiếu hoặc Mơ hồ trong SRS

### Thiếu trong triển khai hiện tại

1. Đăng ký device token và gửi push notification.
2. Route content session completion cho lecture, quiz, game và abandoned session.
3. Use case idempotency cho content session quanh reward sao cố định.
4. Star ledger bất biến để debug biến động balance.
5. Rule xác định AI game thành công cho content-session completion.
6. Emotion catalog cuối cùng cho UX quiz/report ngoài các nhãn model bên ngoài.
7. Regulation event model và route.
8. Alert model, alert cooldown và tracking notification status.
9. PDF report export.
10. Admin content CRUD.
11. Admin user management.
12. Admin system analytics.
13. Media asset upload/registration.
14. Audit logging cho admin changes, soft deletes, bans và report exports.
15. Pagination/cursor support cho tất cả list endpoints.
16. Rate limiting cho auth, password reset, emotion logging và AI event ingestion.
17. RBAC middleware cho parent/admin/system authorization.
18. Webcam consent và raw-frame ban enforcement.

### Mơ hồ trong SRS

Đã chốt:

1. Đăng ký tạo persisted session ngay.
2. Email bắt buộc; số điện thoại tùy chọn.
3. Google SSO link vào local account có cùng email đã verify.
4. Không thưởng sao lặp lại cho cùng một content.
5. AI inference/computer vision chạy ở service riêng do frontend gọi; backend chỉ lưu outcome đã suy ra.
6. Content và pet dùng soft delete.
7. Regulation/time-out chỉ do AI trigger.
8. Report phải thân thiện và dễ đọc.
9. Birth year immutable từ frontend; không recompute difficulty từ thay đổi birth year.
10. Admin chỉ xem aggregate analytics, không xem log/thống kê/report định danh cấp trẻ.
11. Reward sao cố định: hoàn thành lecture = 1, trả lời quiz đúng = 2, AI game thành công = 3.
12. Cấm upload/lưu raw webcam frame.
13. Stress/meltdown không có ngưỡng nào khác ngoài duration cảm xúc tiêu cực lớn hơn 60 giây.
14. Admin định nghĩa media quiz, danh sách emotion đáp án và đáp án đúng; trẻ thấy đáp án emotion dưới dạng emoji.
15. Nhãn emotion model bên ngoài hiện là `happy`, `sad`, `angry`, `fear`, `neutral`; `fear` được map về backend `SCARED`.

Câu hỏi còn mở cho các điểm chưa quyết định:

1. Rule sản phẩm chính xác nào xác định một lượt AI game thành công khi model trả predicted label, confidence và all label scores?
2. Emotion catalog chuẩn cho quiz, AI game target, emoji rendering và report ngoài 5 nhãn model là gì?

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
6. Không tin `stars_earned` do client gửi. Backend phải tự tính reward từ policy cố định: hoàn thành lecture = 1, trả lời quiz đúng = 2, AI game thành công = 3, và chỉ thưởng sao tối đa một lần mỗi `(child_id, content_id)`.
7. Không tin `is_correct` do client gửi cho quiz. Backend phải so sánh selected answer với correct answer/options đã lưu.
8. Định nghĩa TypeScript type chặt cho `preferences`. Tránh metadata lỏng kiểu `any`.
9. Validate `answer_emotions` do admin định nghĩa trước khi build Quiz API. `correct_emotion` phải nằm trong `answer_emotions`; tập giá trị hợp lệ cuối cùng phụ thuộc emotion catalog TODO.
10. Xem AI label/confidence/scores là outcome đã suy ra do frontend gửi. Backend này không gọi AI service trực tiếp, nên endpoint reward cần validate chặt model result, idempotency và first-reward enforcement.
11. Chỉ lưu event suy ra từ webcam, không lưu raw frame. Cấm upload/lưu raw webcam frame kể cả khi sau này thêm media upload khác.
12. Dùng cursor pagination cho logs, sessions, users, content và admin analytics. Offset pagination chỉ phù hợp cho danh sách admin nhỏ.
13. Giữ error envelope hiện có trong `docs/API.md` cho mọi endpoint.
14. Thêm rate limit:

- Auth và password reset theo IP và identifier.
- Emotion/regulation logs theo child và session.
- Admin media upload theo admin và file size.

15. Thêm audit logs cho:

- Admin ban/unban user.
- Admin hard delete.
- Publish/soft delete content.
- Export report.
- Hoàn tất password reset.

16. Với report generation, bắt đầu bằng PDF đồng bộ cho date range giới hạn. Chuyển sang async job nếu thời gian generate vượt latency target của API.
17. Dashboard query nên aggregate-first. Không load toàn bộ logs vào memory để vẽ chart tuần/tháng.
18. Thêm index trước khi chạy tải cao:

- `content_sessions(child_id, created_at desc)` đã có.
- `emotion_logs(child_id, created_at desc)` đã có.
- Thêm index cho `device_tokens(user_id)`, `alerts(child_id, created_at desc)`, `star_transactions(child_id, created_at desc)` và `audit_logs(actor_user_id, created_at desc)`.

19. Route delete content và pet nên set `deleted_at` và loại các row đó khỏi browse/store flow thông thường. Hard delete chỉ nên dành cho workflow legal erasure rõ ràng.
20. Tạo content của admin phải transactional: insert `contents` và đúng một detail row, hoặc rollback toàn bộ.

## Thứ tự Xây dựng Đề xuất

1. P0 auth completion: password reset, Google SSO, RBAC middleware.
2. P0 child/profile completion: child detail/update/delete và preferences endpoints.
3. P0 content consumption: child content list/detail và content session completion với backend reward policy.
4. P0 tracking/dashboard: emotion log list, dashboard hardening, regulation events.
5. P1 economy/store: atomic content unlocks, pets và star ledger.
6. P1 notifications/reports: device tokens, alerts, PDF export.
7. P1 admin: content CRUD, media assets, pet CRUD, user management.
8. P2 analytics và operational hardening.
