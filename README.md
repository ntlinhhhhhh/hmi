# HMI Backend

Backend TypeScript/Bun cho hệ thống HMI, cung cấp API xác thực phụ huynh, quản lý hồ sơ
trẻ, ghi nhận cảm xúc và dashboard cơ bản. Dữ liệu lưu trong PostgreSQL; file upload như
avatar trẻ được lưu trong MinIO/S3.

## Chạy local

Yêu cầu: Docker, Docker Compose và Bun.

```bash
cp .env.example .env
bun install
docker compose up --build
```

API chạy tại `http://127.0.0.1:5050`. MinIO API chạy tại `http://127.0.0.1:9000`, console tại
`http://127.0.0.1:9001`.

## SMS reset mật khẩu

Reset mật khẩu bằng số điện thoại dùng TextBee để gửi OTP qua Android phone/SIM của bạn. Cấu hình
trong `.env`:

```bash
TEXTBEE_API_KEY=
TEXTBEE_DEVICE_ID=
TEXTBEE_SIM_SUBSCRIPTION_ID=
```

`TEXTBEE_SIM_SUBSCRIPTION_ID` chỉ cần khi thiết bị Android có nhiều SIM. Giữ app TextBee online và
đảm bảo SIM có thể gửi SMS tới số nhận.

Kiểm tra nhanh:

```bash
curl http://127.0.0.1:5050/health
```

Format toàn bộ code/docs:

```bash
bun fmt
```
