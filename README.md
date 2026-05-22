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

Kiểm tra nhanh:

```bash
curl http://127.0.0.1:5050/health
```

Format toàn bộ code/docs:

```bash
bun fmt
```
