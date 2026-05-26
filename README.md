# HMI Backend

Hệ thống Backend (phát triển bằng TypeScript/Bun) cho ứng dụng HMI (Hỗ trợ trẻ tự kỷ nhận diện cảm xúc). Backend này đóng vai trò cung cấp RESTful API cho ứng dụng frontend để thực hiện xác thực, quản lý dữ liệu, ghi nhận tiến độ học tập/cảm xúc và xem thống kê (dashboard). 

Cơ sở dữ liệu được quản lý bằng PostgreSQL (với Drizzle ORM) và các tệp tĩnh (như avatar trẻ, media bài học, pet) được lưu trữ qua MinIO/AWS S3.

## Các tính năng chính (Features)

- **Authentication & Accounts:** Hỗ trợ đăng ký/đăng nhập cho phụ huynh bằng Email, Số điện thoại (local auth) và Google SSO. Quên/Reset mật khẩu qua Email (SMTP) hoặc SMS (sử dụng TextBee).
- **Child Profiles & Preferences:** Quản lý hồ sơ trẻ và các thiết lập giao diện (UI preferences) cá nhân hóa (như theme, âm lượng, high contrast).
- **Learning Content Management:** Quản lý, kiểm tra điều kiện mở khóa và tính điểm thưởng (reward stars) cho các nội dung: Bài giảng (Lecture), Câu hỏi trắc nghiệm (Quiz), và Trò chơi AI (AI Game).
- **Tracking & Reporting:** Ghi nhận lịch sử học tập, log lịch sử cảm xúc do mô hình AI dự đoán (nhận từ frontend), tạo cảnh báo Chatbot (Gửi Push Notification qua Firebase FCM) và xuất báo cáo PDF/Dashboard.
- **Reward Economy:** Hệ thống sổ cái (Star Ledger) bất biến cho phép ghi nhận sao kiếm được và cho phép dùng sao mua Pet ảo hoặc mở khóa nội dung mới.
- **Admin Management:** Cung cấp quyền và API cho Admin quản lý nội dung học tập, danh mục Pet (Pet Catalog), quản lý users và xem System Analytics.

## Hướng dẫn chạy (Run Instructions)

### Yêu cầu hệ thống (Prerequisites)
- [Docker](https://www.docker.com/) và Docker Compose
- [Bun](https://bun.sh/) (Runtime để cài đặt dependencies và format code)

### Cài đặt và khởi chạy

1. Copy file cấu hình môi trường mẫu:
   ```bash
   cp .env.example .env
   ```
   *(Bạn có thể cấu hình các thông số TextBee SMS, S3, PostgreSQL,... bên trong file `.env` nếu cần).*

2. Cài đặt các package dependencies:
   ```bash
   bun install
   ```

3. Khởi động toàn bộ hệ thống (PostgreSQL, MinIO/S3 và API Server) bằng Docker Compose:
   ```bash
   docker compose up --build
   ```

   Sau khi khởi động thành công:
   - **API Server** sẽ lắng nghe tại: `http://127.0.0.1:5050`
   - **MinIO API (S3 Storage)** tại: `http://127.0.0.1:9000`
   - **MinIO Console** tại: `http://127.0.0.1:9001` (Dùng để xem file tải lên)

4. Kiểm tra sức khỏe của API (Health check):
   ```bash
   curl http://127.0.0.1:5050/health
   ```

### Các lệnh hữu ích (Scripts)

Format toàn bộ mã nguồn và tài liệu trong project:
```bash
bun fmt
```

## Tài liệu API (API Documentation)

Để xem chi tiết danh sách tất cả các endpoints khả dụng, tham số yêu cầu (request params), cấu trúc dữ liệu trả về (response body) và xử lý lỗi (error codes), đọc tài liệu chi tiết tại:

**[docs/API.md](docs/API.md)**

---

*Lưu ý: Đối với tính năng Push Notification (nhận Cảnh báo Chatbot), bạn cần cung cấp file `firebase_adminsdk.json` từ Firebase Console và đặt ở thư mục gốc của dự án. Nếu không có file này, hệ thống sẽ tự động chuyển sang chế độ mock (giả lập thông báo ra console log).*