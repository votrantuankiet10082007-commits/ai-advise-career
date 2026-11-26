# AI Advise Career

Bản ghép giữ điểm vào `index.html`, đường dẫn giao diện Stitch, danh mục nghề, công thức chấm điểm và luồng Gemini/OpenAI của mã nguồn ban đầu. Thư mục Stitch thực tế thiếu trong bộ tệp gốc được gửi, vì vậy ZIP có trang tương thích tại đúng đường dẫn cũ, với nền `#f8f9ff` và điểm nhấn xanh chàm.

## Chạy bằng Antigravity IDE trên Windows

Giải nén rồi mở thư mục có `package.json`. Dùng Node.js 24 và chạy:

```powershell
node -v
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Mở [http://localhost:8080](http://localhost:8080), hoặc ấn F5 sau khi server chạy để mở Chrome theo cấu hình mẫu. Có thể dùng `npm start` hoặc bấm đúp `khoi_dong_server.bat`. Tệp `.env.example` có cấu hình mẫu. Bản ZIP không chứa khóa API, tài khoản hay thông tin ngân hàng thật.

- **LAN:** Chạy server rồi mở `share_lan.bat` để xem địa chỉ. Truy cập bằng thiết bị cùng Wi‑Fi. Với HTTP qua LAN, chỉ dùng dữ liệu thử.
- **Localtunnel:** Chạy server rồi mở `share_internet_localtunnel.bat`. Nếu cần thử tính năng tài khoản qua URL HTTPS của tunnel, đặt `PUBLIC_ORIGIN` đúng URL được cấp và khởi động lại riêng Node. Đặt lại cấu hình khi quay về dùng localhost. Để phát hành lâu dài, dùng tên miền và HTTPS theo [TRIEN-KHAI.md](TRIEN-KHAI.md).

## Tính năng bổ sung

- Logo, bố cục đánh giá kỹ năng và danh mục nghề tại trang tương thích.
- Đăng ký, đăng nhập, sửa hồ sơ và đăng xuất. SQLite tự tạo `database/accounts.sqlite`. Tài khoản demo cũ nằm trong bộ nhớ nên cần đăng ký tài khoản thật trên bản này.
- Premium mở giáo trình, lịch học theo tháng và lượt hỏi gia sư theo gói. Luồng AI gốc vẫn có thể dùng cho tư vấn cơ bản. Điền `GEMINI_API_KEY` hoặc `OPENAI_API_KEY` trong `.env` nếu muốn dùng dịch vụ ngoài. Có thể chọn model qua `GEMINI_MODEL` hoặc `OPENAI_MODEL`. Trong production, khách chưa đăng nhập dùng bộ tư vấn dự phòng. Dịch vụ AI ngoài chưa được thử với khóa thật.
- API tài khoản dùng cookie phiên. Thư mục database và cấu hình riêng nằm ngoài danh sách tệp web được phục vụ.

## Premium và đối soát chuyển khoản

| Gói | Giá mặc định | Ngành học | Tổng lượt hỏi AI |
| --- | ---: | --- | ---: |
| 1 | 50.000 VND | 3 ngành xếp hạng cao nhất | 30 |
| 2 | 100.000 VND | 5 ngành xếp hạng cao nhất | 60 |
| 3 | 200.000 VND | Toàn bộ danh mục nghề | 100 |

Cấu hình `PREMIUM_PRICE_T1_VND`, `PREMIUM_PRICE_T2_VND`, `PREMIUM_PRICE_T3_VND` và bộ `BANK_NAME`, `BANK_ACCOUNT`, `BANK_HOLDER` trong `.env`. Giá là số nguyên VND và phải tăng dần. Nâng cấp dùng hiệu hai giá niêm yết lúc tạo đơn. Đơn đã tạo giữ nguyên số tiền. Mỗi tài khoản có một đơn đang chờ. Thời hạn quyền học là vĩnh viễn và hạn mức AI tính trên tổng lượt đã dùng. Hiện chưa hỗ trợ hoàn tiền.

1. Đăng nhập, mở **Premium**, chọn gói và chuyển số tiền ghi trên đơn với mã đơn trong nội dung chuyển khoản.
2. Chủ web đối chiếu sao kê. Dùng đúng mã đơn, số tiền và mã giao dịch ngân hàng.

   ```powershell
   npm run confirm-payment -- MA_DON SO_TIEN_VND MA_GIAO_DICH_NGAN_HANG
   ```

3. Người dùng chọn **Kiểm tra trạng thái**. Gói 1 và 2 cần kích hoạt từ hồ sơ Đánh giá nghề. Gói 3 mở toàn bộ danh mục ngay sau xác nhận.

Migration chuyển tài khoản cũ có `premium=1` sang gói 1 và gán đơn cũ về gói 1 với số tiền đã lưu. Xếp hạng được khóa ở lần kích hoạt đầu tiên. Nâng từ gói 1 lên 2 dùng tiếp ngành thứ 4 và 5 trong xếp hạng đó. Hồ sơ đánh giá khi đăng nhập được lưu theo tài khoản. Hồ sơ đánh giá khi chưa đăng nhập có thể dùng lại trong cùng tab. Lịch dùng mốc 15 giờ/tuần, kéo dài nếu quỹ giờ thấp hơn và có mặc định 15 giờ khi thiếu hồ sơ.

Các API dưới `/api/premium/` gồm `tiers` (bảng giá công khai), `status`, `order`, `activate`, `learn/:roleSlug`, `schedule/:roleSlug`, `progress` và `tutor`. Giáo trình và lịch học được tạo từ nội dung trong mã nguồn. Gia sư dùng Gemini rồi OpenAI khi có khóa hợp lệ và hoàn lại lượt nếu yêu cầu thất bại. Lịch sử hỏi đáp chỉ hiển thị trong phiên trang. Tác vụ `npm test` dùng dữ liệu giả để kiểm tra đối soát, phân quyền, lịch học và hạn mức AI.

## Tài khoản, Thị trường IT và CV

Ba trang nằm cùng cấp với trang đánh giá trong `stitch_ai_career_advisor/`. Dùng thanh điều hướng trên bất kỳ trang nào để chuyển qua lại.

- **Tài khoản** (`dang_nhap_tai_khoan/`). Đăng nhập, đăng ký, hiện/ẩn mật khẩu, cập nhật hồ sơ và quản lý Premium từ trang bảng giá. Chức năng xác minh email và đặt lại mật khẩu chưa có.
- **Thị trường IT** (`thi_truong_nganh_it/`). So sánh lương khởi điểm và thời gian học theo nhóm ngành, xem kỹ năng theo tổng trọng số của các nghề, chọn kỹ năng đã học để xếp hạng qua `POST /api/evaluate`. Số liệu trích từ `CAREERS_DATA` và ngày chốt danh mục đi kèm dữ liệu. Đây là số liệu tham khảo. Khi cập nhật danh mục, cập nhật ngày chốt tại `src/market.js`.
- **CV** (`chinh_sua_cv_ai/`). Nhập thông tin, thêm/xóa/đổi thứ tự từng mục, xem trước theo khổ A4 và tải JSON hoặc in ra PDF. Đăng nhập để lưu một CV vào SQLite. Khách có thể lưu nháp trên trình duyệt đang dùng. Bản lưu chứa các trường đã nhập. Mô tả dự án gợi ý xuất hiện trong bản xem trước, bản in và JSON xuất ra. Dùng các nút Áp dụng để lưu mục tiêu và mô tả dự án gợi ý cùng dữ liệu CV.

### Endpoint mới

| Endpoint | Dữ liệu và quyền |
| --- | --- |
| `GET /api/market` | Nghề, nhóm ngành, lương, thời gian học, kỹ năng theo trọng số và ngày chốt danh mục |
| `POST /api/market/comment` | JSON `{track}` với nhóm ngành tùy chọn. Gemini/OpenAI chọn dữ kiện từ danh mục. Có nhận xét theo quy tắc khi thiếu khóa, quá tải hoặc lỗi |
| `POST /api/ai/cv-generate` | JSON `{cv, consent}`. Chọn cách trình bày mục tiêu và dự án từ nội dung đã nhập, gợi ý từ khóa ATS có căn cứ, và báo các mục cần bổ sung |
| `POST /api/ai/cv-review` | JSON `{cv}`. Trả `summary` và `suggestions` theo mức độ đầy đủ và kỹ năng phù hợp |
| `GET /api/cv` | Đọc bản CV của phiên đăng nhập, trả `cv: null` nếu chưa lưu |
| `PUT /api/cv` | JSON `{cv}`. Tạo hoặc cập nhật bản CV của phiên đăng nhập |
| `DELETE /api/cv` | Xóa bản CV của phiên đăng nhập |

Các trang mới dùng tệp nội bộ, giữ CSP và danh sách tài nguyên công khai trong `server.js`. Các route lưu CV dùng cookie phiên, kiểm tra Origin và luôn lấy quyền sở hữu từ tài khoản trong phiên. Bảng `cvs` tự tạo khi khởi động trên SQLite đang dùng.

Gemini được thử trước OpenAI. Chỉ khi bật đồng ý trên trang CV, mục tiêu, phần việc, kết quả dự án, từ khóa khớp và vị trí mục tiêu mới có thể được gửi đến nhà cung cấp để chọn cách trình bày. Khi không gửi ra ngoài, trình tạo CV dùng quy tắc có sẵn. Mô hình chỉ chọn từ phương án và từ khóa dựa trên dữ liệu nhập, nên mục thiếu dữ liệu vẫn để trống. Nội dung CV không được ghi vào log.

`npm test` kiểm tra các tệp giao diện, dữ liệu thị trường, CV dự phòng, quyền đăng nhập và tách quyền sở hữu CV giữa hai tài khoản. Gemini và OpenAI chưa được kiểm thử với khóa thật.
