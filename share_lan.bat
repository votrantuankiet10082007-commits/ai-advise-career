@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title AI Career Advisor - Chia Sẻ Mạng Cục Bộ (WiFi/LAN)
color 0a
echo =================================================================
echo   CHIA SẺ TRANG WEB CHO MỌI NGƯỜI DÙNG CHUNG MẠNG WIFI (LAN)
echo =================================================================
echo.
echo 1. Đảm bảo bạn bè hoặc điện thoại của bạn kết nối CHUNG mạng WiFi.
echo 2. Địa chỉ IP của máy tính bạn hiện tại:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address" /c:"Địa chỉ IPv4"') do (
    set "ip=%%a"
    set "ip=!ip: =!"
    echo    👉 ĐƯỜNG LINK TRUY CẬP: http://!ip!:8080
)
echo.
echo 3. Gửi đường link trên cho bạn bè hoặc mở trên điện thoại!
echo.
echo =================================================================
echo Nếu máy khác không vào được, hãy kiểm tra Windows Defender Firewall:
echo Vào Windows Security -> Firewall -> Cho phép ứng dụng Node.js qua mạng riêng (Private).
echo =================================================================
echo.
pause
