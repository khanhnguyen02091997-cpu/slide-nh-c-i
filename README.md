# Slide Ảnh Cưới

Web làm slide ảnh cưới có tài khoản riêng cho từng người:

- **Chiếu ở tiệc:** chạy vòng lặp cả buổi, có nhạc, giữ màn hình sáng.
- **Màn hình sân khấu:** bấm chuyển từng màn theo chương trình, che đen màn hình.
- **Video:** xuất video ngang 16:9 hoặc dọc 9:16, có nhạc và hiệu ứng.
- **Giao khách:** tải một file `.html` chứa sẵn ảnh, nhạc, hiệu ứng; khách mở bằng trình duyệt là xem.
- **Album ảnh để in:** tự xếp ảnh theo thời gian chụp, tự dàn trang 1 đến 4 ảnh, tải PDF vuông 20, 25 hoặc 30 cm gửi tiệm in.
- 4 phong cách: vàng champagne, Hàn Quốc, cinematic, hiện đại.
- Tự khớp ảnh với nhạc: chuyển ảnh đúng nhịp, video dài bằng bài nhạc.
- AI vẽ lại ảnh thành chibi (cần `GEMINI_API_KEY`; Google có thể yêu cầu bật thanh toán cho model tạo ảnh).
- AI gợi ý nhạc theo yêu cầu (Claude, ChatGPT hoặc Gemini miễn phí), giới hạn số lượt mỗi người mỗi ngày.

Mỗi người đăng ký bằng email (hoặc Google), album, ảnh và nhạc được lưu riêng, người khác không xem được.

## Cài như app

Web là PWA: mở bằng Chrome hoặc Edge, bấm **📲 Cài app** ở góc trên (hoặc biểu tượng cài đặt trên thanh địa chỉ). Trên iPhone: Safari, nút Chia sẻ, **Thêm vào MH chính**. Trên Mac Safari: Tệp, **Thêm vào Dock**.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `public/index.html` | Đăng nhập, tạo tài khoản |
| `public/albums.html` | Danh sách album của người dùng |
| `public/studio.html` | Studio làm slide, tự lưu |
| `public/js/engine.js` | Bộ dựng slide (dùng chung cho studio và file giao khách) |
| `api/config.js` | Trả cấu hình công khai cho trình duyệt |
| `api/suggest-music.js` | AI gợi ý nhạc, kiểm tra đăng nhập và giới hạn lượt |
| `supabase/schema.sql` | Bảng dữ liệu, phân quyền, kho lưu ảnh và nhạc |

Không có bước build. Web tĩnh nằm trong `public/`, hàm máy chủ trong `api/` chạy trên Vercel.

## Cài đặt lần đầu

### 1. Supabase (tài khoản, dữ liệu, lưu ảnh)

1. Tạo project miễn phí tại https://supabase.com.
2. Vào **SQL Editor > New query**, dán toàn bộ `supabase/schema.sql`, bấm **Run**.
3. Vào **Authentication > URL Configuration**:
   - **Site URL**: địa chỉ web của bạn, ví dụ `https://slide-cuoi.vercel.app`
   - **Redirect URLs**: thêm `https://slide-cuoi.vercel.app/**`
4. (Tuỳ chọn) Đăng nhập Google: **Authentication > Providers > Google**, điền Client ID và Secret từ Google Cloud Console.
5. Vào **Project Settings > API**, chép **Project URL** và **anon public key**.

### 2. Khoá AI (để tìm nhạc)

Chọn một:

- Gemini (miễn phí, có giới hạn lượt): tạo key tại https://aistudio.google.com/apikey, đặt vào `GEMINI_API_KEY`.
- Claude: tạo key tại https://console.anthropic.com, đặt vào `ANTHROPIC_API_KEY`.
- ChatGPT: tạo key tại https://platform.openai.com, đặt vào `OPENAI_API_KEY`.

Không đặt key nào thì web vẫn chạy, chỉ ẩn phần AI.

### 3. Vercel (chạy web)

1. Vào https://vercel.com, **Add New > Project**, chọn repo này. Framework Preset: **Other**. Không cần build command.
2. Ở **Environment Variables**, thêm các biến trong `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` hoặc `OPENAI_API_KEY`
   - `AI_DAILY_LIMIT` (mặc định 30 lượt mỗi người mỗi ngày)
3. Bấm **Deploy**. Xong thì gửi link cho mọi người đăng ký và dùng.

## Chi phí

- Supabase và Vercel có gói miễn phí đủ cho giai đoạn đầu. Gói miễn phí Supabase có 1 GB lưu trữ, khoảng vài nghìn ảnh (ảnh được nén còn tối đa 2400 px trước khi tải lên).
- AI tính phí theo lượt dùng trên tài khoản AI của bạn. Mỗi lượt tìm nhạc là một yêu cầu ngắn; giới hạn lượt mỗi ngày giúp không bị lạm dụng.

## Chạy thử trên máy

```bash
npm i -g vercel
cp .env.example .env.local   # điền giá trị thật
vercel dev
```

## Ghi chú

- Ảnh và nhạc nằm trong kho riêng tư của Supabase; trình duyệt chỉ nhận link có hạn dùng.
- Xuất video dựng theo thời gian thật trong trình duyệt (Chrome hoặc Edge trên máy tính cho MP4).
- Chữ đẹp trong file giao khách tải từ Google Fonts nên cần mạng; không có mạng slide vẫn chạy với font thường.
