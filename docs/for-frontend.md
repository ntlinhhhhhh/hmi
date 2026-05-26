# Ghi chú Backend cho Frontend

Tài liệu này tóm tắt business logic quan trọng để phát triển frontend đúng hướng. Chi tiết field, body mẫu và mã lỗi đầy đủ xem `docs/API.md`.

## 1. Mục tiêu sản phẩm

Backend hỗ trợ ứng dụng HMI giúp trẻ tự kỷ học nhận diện cảm xúc. Backend hiện quản lý:

- Tài khoản phụ huynh/admin và session đăng nhập.
- Hồ sơ trẻ, avatar, cấu hình giao diện/cảm giác cho từng trẻ.
- Danh sách nội dung học: bài giảng, quiz, game AI.
- Sao của từng trẻ, mở khóa nội dung và mua pet.
- Ghi nhận cảm xúc đã được frontend/AI suy ra.
- Dashboard cơ bản cho phụ huynh.
- Quản lý danh mục pet cho admin.

Backend không chạy AI/computer vision hoặc chatbot. Frontend gọi AI service riêng, sau đó chỉ gửi kết quả đã suy ra về backend. Không upload hoặc lưu raw webcam frame.

AI service hiện biết:

- Chatbot "Bạn thỏ": `http://localhost:8080`, có `GET /health` và `POST /chat`.
- Emotion model: `http://localhost:9000`, có `GET /health`, `GET /model/info`, `GET /model/download`, `POST /model/predict`.
- Model emotion trả `happy`, `sad`, `angry`, `fear`, `neutral`; backend map `fear` thành `SCARED`.

## 2. Nguyên tắc tích hợp

- Endpoint protected dùng `Authorization: Bearer <session_token>`.
- Sau `signup`, `signin` hoặc Google SSO thành công, backend trả session token. Frontend lưu token và gửi ở các request sau.
- Frontend không gửi `parent_id`. Backend tự xác định phụ huynh từ session token.
- Trẻ không đăng nhập riêng. Màn hình của trẻ dùng session phụ huynh và `childId` đang được chọn.
- Dữ liệu trả về dùng `snake_case`.
- Lỗi có dạng chung:

```json
{
  "error": {
    "type": "ERROR_TYPE",
    "message": "Readable message"
  }
}
```

- Avatar URL là presigned URL, có thể hết hạn. Khi ảnh không tải được, refresh lại profile/list thay vì lưu URL lâu dài.

## 3. Vai trò

**Public**

- Health check.
- Đăng ký, đăng nhập, Google SSO.
- Reset mật khẩu.

**Phụ huynh**

- Quản lý tài khoản của mình.
- Tạo/chọn/sửa/xóa hồ sơ trẻ của mình.
- Xem và cập nhật preferences của trẻ.
- Xem nội dung học, mở khóa content bằng sao.
- Ghi emotion log và xem dashboard của trẻ.
- Mua, xem và đổi tên pet của trẻ.

**Trẻ**

- Không phải user đăng nhập.
- Hành động child-facing luôn đi qua session phụ huynh và `childId`.

**Admin**

- Hiện backend chỉ có API quản lý pet catalog.
- Các mảng admin khác như content CRUD, user management, analytics toàn hệ thống chưa có API.

## 4. Tính năng đang có API

| Mảng              | API chính                                                                                              | Ghi chú cho frontend                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Auth/account      | `/auth/signup`, `/auth/signin`, `/auth/google`, `/me`, `/me/password`, `/auth/session`                 | Signup tạo session ngay, không cần bắt đăng nhập lại.                        |
| Reset mật khẩu    | `/auth/password-reset/request`, `/auth/password-reset/verify`, `/auth/password-reset/confirm`          | Request luôn trả thông báo chung để tránh lộ tài khoản có tồn tại hay không. |
| Hồ sơ trẻ         | `/children`, `/children/:childId`                                                                      | Tạo/sửa dùng `multipart/form-data` nếu có avatar.                            |
| Preferences       | `/children/:childId/preferences`                                                                       | Frontend dùng để điều chỉnh UI child-facing.                                 |
| Content           | `/children/:childId/contents`, `/contents/:contentId`, `/children/:childId/contents/:contentId/unlock` | Đọc content và mở khóa content đã có. Submit kết quả học chưa có API.        |
| Emotion/dashboard | `/children/:childId/emotion-logs`, `/children/:childId/dashboard`                                      | Chỉ lưu emotion đã suy ra, không lưu webcam frame.                           |
| Pet store         | `/pets`, `/children/:childId/pets`                                                                     | Mua pet bằng sao của trẻ và đổi tên pet đã sở hữu.                           |
| Admin pets        | `/admin/pets`                                                                                          | Cần user role `ADMIN`.                                                       |

## 5. Luồng tài khoản

- Đăng ký local cần `email`, `password`; `phone_number` và `full_name` là tùy chọn.
- Đăng nhập local dùng `identifier` là email hoặc số điện thoại.
- Google SSO dùng `id_token`. Nếu Google trả về email đã verify trùng tài khoản local hiện có, backend link vào tài khoản đó.
- Tài khoản có `status = BANNED` không dùng được endpoint protected.
- Đổi mật khẩu chỉ áp dụng cho tài khoản local có password.
- Khi gặp `401`, frontend nên xóa session local và đưa user về màn hình đăng nhập.

## 6. Hồ sơ trẻ

- Mỗi phụ huynh chỉ truy cập được hồ sơ trẻ của chính mình.
- Tạo hồ sơ cần `nickname` và `birth_year`; avatar là tùy chọn.
- Avatar hỗ trợ JPEG, PNG, WebP, GIF, AVIF, tối đa 5 MB.
- `birth_year` chỉ được đặt lúc tạo. Frontend không cho sửa năm sinh sau đó.
- Backend tính difficulty khi tạo trẻ:
  - Tuổi <= 5: level 1.
  - Tuổi 6-9: level 2.
  - Tuổi >= 10: level 3.
- Khi tạo trẻ, backend tạo preferences mặc định và tự mở khóa content mặc định phù hợp với difficulty.
- Xóa hồ sơ trẻ yêu cầu body `confirmation = "DELETE"` và sẽ xóa dữ liệu phụ thuộc theo cascade.

## 7. Preferences của trẻ

Preferences là cấu hình để frontend điều chỉnh trải nghiệm học của trẻ. Các setting hiện có:

- `theme`
- `music_track_id`
- `music_volume` từ 0 đến 100
- `voice_prompt_enabled`
- `high_contrast_enabled`
- `reduced_motion_enabled`
- `brightness_level` từ 0 đến 100
- `timeout_seconds` từ 1 đến 3600
- `calming_story_enabled`

Backend chỉ lưu và validate preferences. Frontend chịu trách nhiệm áp dụng vào UI, âm thanh, animation và time-out/calm mode.

## 8. Content và mở khóa

Content có 3 loại:

- `LECTURE`: bài giảng/media nhận diện cảm xúc.
- `QUIZ`: câu hỏi có danh sách emotion để trẻ chọn.
- `GAME`: game AI bắt chước cảm xúc.
- Game có thể có `prompt_asset_type` là `ICON`, `IMAGE`, `VIDEO`; hướng frontend hiện tại là level 1 dùng icon, level 2 dùng ảnh, level 3 dùng video.

Quy tắc hiện tại:

- Frontend chỉ thấy content `PUBLISHED` và chưa bị xóa mềm.
- `GET /children/:childId/contents` trả cả content đã mở khóa và đang khóa, mặc định `include_locked = true`.
- Response có `is_unlocked`, `unlock_star_cost`, `progress` và dữ liệu riêng theo từng loại content.
- `GET /contents/:contentId?child_id=...` trả chi tiết content kèm trạng thái unlock/progress của trẻ.
- Mở khóa content dùng sao của trẻ. Backend kiểm tra ownership, content published, chưa unlock, đủ sao, rồi trừ sao và tạo unlock trong cùng transaction.
- Nếu không đủ sao hoặc đã unlock, backend trả `409`.
- Hiện cost mở khóa chỉ lấy từ `GAME`; lecture/quiz đang trả cost `0`.

## 9. Học, quiz, game AI và sao

Điểm cần chú ý: backend hiện chưa có endpoint frontend-callable để submit hoàn thành lecture, trả lời quiz hoặc kết quả game AI. Vì vậy frontend chưa nên build luồng cộng sao như đã hoàn chỉnh.

Logic đã có trong code cho giai đoạn sau:

- Sao thuộc về từng hồ sơ trẻ, không thuộc tài khoản phụ huynh.
- Backend mới là nơi tính sao; frontend không tự cộng sao.
- Reward policy trong code hiện là:
  - Hoàn thành lecture: 1 sao.
  - Quiz đúng: 2 sao.
  - AI game thành công: 3 sao.
- Một trẻ chỉ được nhận reward một lần cho cùng một content. Lần hoàn thành sau vẫn có thể ghi lịch sử nhưng không cộng thêm sao.

Frontend nên hiển thị số sao từ API (`total_stars`, `child_total_stars`) và refresh sau các thao tác mua/mở khóa.

## 10. Emotion log, regulation và dashboard

Frontend/AI gửi emotion log khi đã suy ra trạng thái cảm xúc. Body hiện gồm:

- `emotion_value`: `HAPPY`, `SAD`, `ANGRY`, `STRESSED`, `CALM`, `NEUTRAL`, `SCARED`, `SURPRISED`; cũng có thể gửi nhãn model `happy`, `sad`, `angry`, `fear`, `neutral`.
- `trigger_source`: `AAC_BOARD`, `GAME`, `QUIZ`, `LECTURE`, `WEBCAM`, `SYSTEM`.
- `duration_seconds`: tùy chọn, phải là số nguyên dương nếu gửi.
- `confidence_score`, `ai_emotion_label`, `ai_confidence`, `ai_scores`, `ai_result`, `metadata`: tùy chọn, dùng để lưu kết quả model đã suy ra.

Quy tắc alert hiện tại:

- Backend xem `SAD`, `ANGRY`, `STRESSED`, `SCARED` có `duration_seconds > 60` là meltdown alert.
- `GET /children/:childId/dashboard` trả dashboard theo `days`, mặc định 7 ngày, tối đa 90 ngày.
- Dashboard hiện có learning summary, emotion counts và `meltdown_alerts`.

Regulation/time-out vẫn do frontend/AI xử lý ở UI. Backend chưa có route riêng cho regulation event, push notification hoặc device token.

## 11. Pet store

- `GET /pets` trả pet `ACTIVE` và chưa bị xóa.
- Trẻ mua pet bằng sao của chính trẻ.
- Mua pet kiểm tra child ownership, pet active, đủ sao và chưa sở hữu pet đó.
- Mua pet trừ sao và tạo ownership trong cùng transaction.
- Pet đã mua có thể đổi tên qua `PATCH /children/:childId/pets/:childPetId`.
- `custom_name = null` dùng để xóa tên tùy chỉnh.
- Admin có thể tạo, sửa, hide hoặc soft-delete pet. Pet hidden/deleted không còn trong store nhưng lịch sử sở hữu của trẻ vẫn giữ.

## 12. Tính năng chưa có API

Frontend không nên coi các luồng sau là đã sẵn sàng backend:

- Submit hoàn thành lecture, quiz answer, AI game result.
- Báo cáo PDF.
- Push notification và quản lý device token.
- Regulation event/time-out history.
- Admin content CRUD.
- Admin user management.
- Admin analytics toàn hệ thống.
- Upload media asset cho content/pet.

Có thể thiết kế UI ở mức mock/prototype, nhưng khi build tích hợp thật cần chờ API contract mới.

## 13. Gợi ý màn hình frontend

**Parent app**

- Auth: signup, signin, Google SSO, forgot password.
- Account settings: xem/sửa profile, đổi mật khẩu, sign out.
- Child profiles: danh sách, tạo, sửa nickname/avatar, xóa.
- Child dashboard: sao, learning summary, emotion chart, meltdown alerts.
- Preferences: high contrast, reduced motion, nhạc, voice prompt, brightness, timeout.
- Content browse: filter theo loại/difficulty, phân biệt locked/unlocked.
- Pet store: list pet, mua pet, pet đã sở hữu, đổi tên.

**Child-facing app**

- Chọn content đã unlock.
- Render lecture/quiz/game theo content type.
- Áp dụng preferences vào màu sắc, motion, âm thanh, brightness và calm mode.
- Gửi emotion log khi frontend/AI đã có kết quả suy ra.
- Không gửi raw webcam frame về backend.

**Admin app**

- Hiện chỉ build phần pet catalog nếu cần tích hợp backend thật.
- Content management, user management và analytics nên chờ API.

## 14. Xử lý lỗi quan trọng

- `400`: dữ liệu gửi lên sai format hoặc thiếu field.
- `401`: session thiếu/hết hạn/không hợp lệ; đưa user về login.
- `403`: account bị ban, không đúng role, hoặc không sở hữu child.
- `404`: resource không tồn tại hoặc không được phép nhìn thấy theo ownership.
- `409`: trùng dữ liệu, đã unlock/đã sở hữu, hoặc không đủ sao.
- `413`: avatar vượt quá 5 MB.
- `502`: lỗi storage hoặc dịch vụ gửi SMS bên ngoài.

Sau mọi mutation ảnh hưởng đến sao, unlock, profile hoặc pet, frontend nên refresh dữ liệu liên quan từ backend thay vì tự suy đoán state cuối.
