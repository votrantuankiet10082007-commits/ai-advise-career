@echo off
chcp 65001 >nul
title AI Career Advisor - Chia Sẻ Ra Internet (Localtunnel)
color 0e
echo =================================================================
echo   CHIA SẺ TRANG WEB RA INTERNET CHO BẠN BÈ TỪ XA CÙNG DÙNG
echo =================================================================
echo.
echo [*] Đang tạo đường link công khai (Public HTTPS URL) qua Localtunnel...
echo [*] Bạn bè ở bất kỳ đâu (kể cả dùng 4G/5G/khác mạng) đều có thể vào được!
echo.
echo LƯU Ý KHI GỬI CHO BẠN BÈ:
echo - Localtunnel sẽ sinh ra link dạng: https://xxxx.loca.lt
echo - Khi bạn bè mở link lần đầu, trang web sẽ hỏi "Endpoint IP".
echo - Địa chỉ IP công khai của máy bạn để điền vào (nếu được hỏi):
curl -s https://loca.lt/mytunnelpassword
echo.
echo =================================================================
echo ĐANG TẠO ĐƯỜNG LINK (Vui lòng chờ vài giây)...
echo =================================================================
echo.
npx localtunnel --port 8080
pause
