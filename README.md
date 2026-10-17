# ✨ Web Hiệu Ứng Cử Chỉ Tay 3D (Interactive Hand Gesture Particles)

Dự án tương tác 3D thời gian thực với các hạt ma thuật (Magic Particles) điều khiển hoàn toàn bằng **cử chỉ bàn tay qua Webcam** sử dụng **MediaPipe Tasks Vision** và **Three.js**.

---

## 🌟 Tính năng nổi bật

- 🖐️ **Nhận diện cử chỉ thời gian thực**: Sử dụng AI model của MediaPipe chạy trực tiếp trên GPU thông qua trình duyệt.
- ✨ **Hiệu ứng hạt 3D mượt mà**: Hàng ngàn hạt 3D (Three.js) biến đổi hình dạng tương ứng với từng chuyển động của bàn tay.
- 🎯 **Các cử chỉ hỗ trợ**:
  - ✊ **Nắm tay (Fist)**: Gom các hạt lại thành hình **Trái tim (Heart)**.
  - ✌️ **Chữ V / 2 ngón (Peace sign)**: Biến đổi thành chữ **"I Love You" / Love Letter**.
  - 🖐️ **Mở lòng bàn tay (Open Palm)**: Hiệu ứng nam châm hút các hạt theo đầu ngón tay.
  - 🤟 **3 ngón tay**: Biến đổi thành dải ngân hà **Starry Night / Saturn**.

---

## 🛠️ Công nghệ sử dụng

- **Frontend**: Vite + TypeScript + HTML5/CSS3
- **3D Graphics**: [Three.js](https://threejs.org/)
- **AI Vision**: [@mediapipe/tasks-vision](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- **Animation**: [GSAP](https://greensock.com/gsap/)

---

## 🚀 Chạy trên máy cục bộ (Local Development)

```bash
# 1. Cài đặt các thư viện cần thiết
npm install

# 2. Khởi chạy server phát triển
npm run dev

# 3. Mở trình duyệt và truy cập
http://localhost:5173
```

> **Lưu ý**: Nhớ bấm **Allow (Cho phép)** khi trình duyệt yêu cầu quyền truy cập Camera/Webcam.