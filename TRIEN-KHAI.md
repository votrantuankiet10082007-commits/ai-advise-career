# Đưa Advise Career lên Internet

Ví dụ này dùng một VPS Ubuntu, Node.js 24 LTS, SQLite, Caddy và tên miền `career.example.com`. Thay tên miền ví dụ bằng tên miền của bạn. VPS chạy Node.js liên tục và người dùng truy cập qua tên miền.

## Bảy tầng OSI áp dụng thế nào

| Tầng | Trong hệ thống này | Cần cấu hình hoặc kiểm tra |
| --- | --- | --- |
| 1 · Vật lý | Cáp, sóng Wi‑Fi và hạ tầng vật lý của nhà cung cấp VPS | Kết nối máy người dùng và kiểm tra trạng thái VPS |
| 2 · Liên kết dữ liệu | Ethernet hoặc Wi‑Fi ở mạng cục bộ, mạng ảo tại VPS | Nhà cung cấp VPS quản lý mạng bên dưới. Khi thử trong LAN, kiểm tra các máy cùng mạng và Wi‑Fi không bật cô lập máy khách |
| 3 · Mạng | IP của VPS và đường định tuyến qua Internet | Tạo bản ghi DNS A trỏ về IPv4 công cộng. Chỉ thêm AAAA khi VPS nhận kết nối IPv6 |
| 4 · Giao vận | TCP cho SSH và HTTP/1.1 hoặc HTTP/2 | Mở TCP 80 và 443 đến Caddy, cho SSH từ mạng quản trị. Node chỉ nghe cổng 8080 trên loopback. UDP 443 là tùy chọn cho HTTP/3 |
| 5 · Phiên | Duy trì phiên là khái niệm của OSI. Phiên đăng nhập web được hiện thực ở tầng ứng dụng qua cookie và SQLite | Kiểm tra duy trì đăng nhập khi tải lại và thu hồi cookie khi đăng xuất |
| 6 · Trình bày | Mã hóa và biểu diễn dữ liệu là nhóm chức năng tương ứng. Stack web dùng TLS và JSON UTF‑8 | Caddy nhận TLS và cấp chứng chỉ. Kiểm tra HTTPS và tiếng Việt trên trang |
| 7 · Ứng dụng | HTTP, DNS, frontend, REST API, đánh giá kỹ năng và nghiệp vụ Premium | Xem `/api/health`, thử đăng ký, đánh giá và đối soát đơn |

OSI là mô hình tham chiếu. Các tầng 5–7 thường được gộp khi mô tả stack TCP/IP. DNS là giao thức tầng ứng dụng và bản ghi DNS dùng IP tầng mạng để chỉ địa chỉ VPS. TLS, JSON và cookie được đưa vào bảng để minh họa nhóm chức năng. [Tham khảo mô hình OSI](https://developers.cloudflare.com/fundamentals/reference/network-layers/)

## 1. VPS, tên miền và cổng

- Tạo VPS Ubuntu có public IPv4, cấu hình SSH bằng khóa. Trỏ bản ghi A của tên miền đến public IPv4 qua giao diện quản trị DNS. Nếu dùng Cloudflare, chọn **DNS only** để thực hiện đúng cấu hình Caddy và địa chỉ IP client trong mẫu.
- Trong firewall của nhà cung cấp, cho phép TCP 80, 443 từ Internet và giới hạn SSH về IP quản trị nếu có IP cố định. Nếu bật UFW trên VPS, cho phép SSH theo đúng cổng thực tế trước để tránh tự khóa phiên quản trị. Ví dụ dưới đây dùng cổng SSH mặc định.

  ```bash
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```

  [Hướng dẫn UFW của Ubuntu](https://documentation.ubuntu.com/canonical-kubernetes/main/snap/howto/networking/ufw/)

## 2. Chép mã và chạy Node bằng systemd

1. Cài [Node.js 24 LTS](https://nodejs.org/en/download), Caddy theo [hướng dẫn cài chính thức](https://caddyserver.com/docs/install#debian-ubuntu-raspbian) và tiện ích SQLite để sao lưu (`sudo apt install sqlite3`).
2. Dùng SCP để chép bản ZIP lên VPS, giải nén, rồi đứng trong thư mục mã nguồn có `server.js`. Chạy:

   ```bash
   sudo useradd --system --user-group --no-create-home --shell /usr/sbin/nologin advise-career
   sudo install -d /opt/advise-career
   sudo cp -a stitch_ai_career_advisor src scripts deploy /opt/advise-career/
   sudo install -m 0644 index.html server.js package.json /opt/advise-career/
   sudo install -m 0640 -o root -g advise-career .env.example /opt/advise-career/.env
   sudoedit /opt/advise-career/.env
   ```

   Đặt `PUBLIC_ORIGIN=https://career.example.com`, `NODE_ENV=production`, `HOST=127.0.0.1` và `PORT=8080`. Điền biến ngân hàng nếu mở Premium. Có thể đặt giá từng gói qua `PREMIUM_PRICE_T1_VND`, `PREMIUM_PRICE_T2_VND` và `PREMIUM_PRICE_T3_VND` (mặc định 50000, 100000 và 200000 VND). Systemd đặt `DATABASE_DIR=/var/lib/advise-career` và tạo thư mục dữ liệu. Giữ tệp `.env` riêng trên VPS.

3. Kiểm tra `command -v node`. Nếu đường dẫn khác `/usr/local/bin/node`, sửa `ExecStart` trong service cho đúng. Dùng bản Node cài ở đường dẫn hệ thống mà tài khoản dịch vụ đọc được.

   ```bash
   sudo install -m 0644 deploy/advise-career.service /etc/systemd/system/advise-career.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now advise-career
   curl -fsS http://127.0.0.1:8080/api/health
   ```

## 3. HTTPS qua Caddy

Trên VPS mới dành cho website này, chép mẫu `deploy/Caddyfile` vào `/etc/caddy/Caddyfile` và thay tên miền. Nếu Caddyfile đang chứa site khác, thêm khối site từ mẫu. Caddy tự cấp và gia hạn chứng chỉ khi DNS và cổng đã cấu hình đúng. Mẫu này đặt lại `X-Real-IP` bằng IP kết nối vào Caddy để giới hạn đăng nhập theo client. [Tài liệu Caddy](https://caddyserver.com/docs/quick-starts/reverse-proxy)

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl -fsS https://career.example.com/api/health
```

Thử bằng thiết bị khác hoặc mạng di động. Kết quả health dự kiến có trường `"status": "healthy"`. Kiểm tra đăng ký, đăng xuất, đăng nhập lại và đánh giá nghề. Kiểm tra DNS bằng `nslookup career.example.com`. Nếu báo lỗi 502, xem `sudo journalctl -u advise-career -n 50`. Với lỗi TLS, xem `sudo journalctl -u caddy -n 50` rồi kiểm tra DNS và cổng 80/443.

## 4. Đối soát và sao lưu sau khi mở web

Dùng số tiền trên đơn tại thời điểm tạo và mã giao dịch trên sao kê. Đơn nâng cấp ghi số tiền chênh lệch. Sau khi đối chiếu sao kê thực nhận, dùng đúng SQLite mà dịch vụ đang sử dụng. Thay đường dẫn Node nếu đã đổi trong service.

```bash
sudo -u advise-career env DATABASE_DIR=/var/lib/advise-career \
  /usr/local/bin/node /opt/advise-career/scripts/confirm-payment.js \
  MA_DON SO_TIEN_VND MA_GIAO_DICH_NGAN_HANG
```

Sao lưu trước khi nâng cấp và định kỳ sau khi mở web. Snapshot chứa cả `users`, `payments`, `premium_profiles`, `premium_unlocks`, `premium_progress` và `premium_ai_usage`. Tạo snapshot SQLite bằng lệnh `.backup` và lưu bản sao ở vị trí riêng, có kiểm soát truy cập. Đặt tên tệp mới mỗi lần. Kiểm tra bản sao trước khi dựa vào nó để phục hồi. [Tài liệu sao lưu SQLite](https://sqlite.org/backup.html)

```bash
sudo install -d -m 0700 /var/backups/advise-career
sudo sqlite3 /var/lib/advise-career/accounts.sqlite \
  ".backup /var/backups/advise-career/accounts-$(date +%F-%H%M%S).sqlite"
```

Khi cập nhật mã, giữ nguyên `/var/lib/advise-career` và cấu hình `.env`, sau đó chạy `sudo systemctl restart advise-career` và kiểm tra health lại. Cấu hình này dành cho một VPS chạy một instance Node. Trước khi nhận tiền từ khách thật, công bố giá, điều khoản thanh toán và cách liên hệ đối soát. Phiên bản này chưa có xác minh email, luồng tự đặt lại mật khẩu hoặc hoàn tiền tự động.
