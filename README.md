# Slide Ảnh Cưới

Web làm slide ảnh cưới có tài khoản riêng cho từng người:

- **Chiếu ở tiệc:** chạy vòng lặp cả buổi, có nhạc, giữ màn hình sáng.
- **Màn hình sân khấu:** bấm chuyển từng màn theo chương trình, che đen màn hình.
- **Video:** xuất video ngang 16:9 hoặc dọc 9:16, có nhạc và hiệu ứng.
- **Giao khách:** tải một file `.html` chứa sẵn ảnh, nhạc, hiệu ứng; khách mở bằng trình duyệt là xem.
- **Album ảnh để in:** tự xếp ảnh theo thời gian chụp, tự dàn trang 1 đến 4 ảnh, tải PDF vuông 20, 25 hoặc 30 cm gửi tiệm in. Xuất được 300 DPI, lề xén 3 mm, tách trang đôi thành trang đơn, ảnh JPG từng trang (.zip); dàn lại riêng trang trái hoặc phải, xem cả cuốn một lúc, đóng logo studio.
- **Sách lật trang:** tải một file `.html` để khách lật từng trang như sách thật (điện thoại vuốt, máy tính bấm), hoặc video MP4 cuốn sách tự lật.
- **Bản mini:** cùng cuốn album, PDF nhỏ 20, 15 hoặc 10 cm để tặng bố mẹ.
- **Ảnh cổng / ảnh in lớn:** 40 × 60 đến 60 × 120 cm, tên cô dâu chú rể, ngày dương và ngày âm tự tính, logo studio; xem thử trên giá đỡ hoặc khung treo tường và tải ảnh mockup.
- **Màu cả cuốn:** một tông màu cho mọi ảnh trong album, giữ nút để so với ảnh gốc.
- **Tự canh mặt:** tìm mặt người trong ảnh (MediaPipe, chạy ngay trên máy) rồi đặt vùng cắt cho mặt nằm đẹp trong khung.
- **Intro, outro studio:** video mở đầu bằng logo, tên studio, kết bằng lời cảm ơn, số điện thoại, fanpage.
- Layout trang trí: giấy xé, đường chỉ khâu, một ảnh chia nhiều khung.
- **Video từ album:** video chạy các trang album đã dàn (trang đôi trên màn ngang), có thể kèm ảnh mở đầu và ảnh kết.
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
| `public/admin.html` | Quản trị: tạo, copy, khoá mã Pro |
| `public/js/engine.js` | Bộ dựng slide (dùng chung cho studio và file giao khách) |
| `public/js/album.js` | Dàn trang album in, xuất PDF và JPG |
| `public/js/flipbook.js` | Sách lật trang: file `.html` gửi khách và khung hình cho video lật sách |
| `public/js/gate.js` | Ảnh cổng: mẫu in lớn, đổi ngày dương sang âm lịch, mockup giá đỡ và khung tường |
| `api/config.js` | Trả cấu hình công khai cho trình duyệt |
| `api/suggest-music.js` | AI gợi ý nhạc, kiểm tra đăng nhập và giới hạn lượt |
| `api/clone-layout.js` | AI (Gemini) đọc ảnh một trang album mẫu, trả về vị trí khung ảnh và ô chữ để tạo layout riêng |
| `supabase/schema.sql` | Bảng dữ liệu, phân quyền, kho lưu ảnh và nhạc |
| `supabase/free-limits.sql` | Giới hạn bản miễn phí ở máy chủ (tối đa 10 ảnh mỗi album) |

Không có bước build. Web tĩnh nằm trong `public/`, hàm máy chủ trong `api/` chạy trên Vercel.

## Cài đặt lần đầu

### 1. Supabase (tài khoản, dữ liệu, lưu ảnh)

1. Tạo project miễn phí tại https://supabase.com.
2. Vào **SQL Editor > New query**, dán toàn bộ `supabase/schema.sql`, bấm **Run**. Sau đó làm tương tự với `supabase/free-limits.sql`.
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
   - `AI_DAILY_LIMIT` (mặc định 30 lượt mỗi ngày cho Pro), `AI_FREE_LIMIT` (mặc định 3 lượt mỗi ngày cho bản miễn phí)
3. Bấm **Deploy**. Xong thì gửi link cho mọi người đăng ký và dùng.

## Bán bản Pro bằng mã kích hoạt

Ai cũng tự đăng ký và dùng miễn phí. Bản miễn phí có dòng chữ nhỏ “Làm bằng Slide Ảnh Cưới” ở góc slide, video, file giao khách và album PDF, và AI chỉ được `AI_FREE_LIMIT` lượt mỗi ngày (mặc định 3). Khách mua thì bạn gửi một mã `CUOI-XXXX-XXXX`, khách dán vào ô **Kích hoạt** ở trang Album của tôi là lên Pro.

Cài một lần:

1. Chạy lại toàn bộ `supabase/schema.sql` trong **SQL Editor** (chạy lại nhiều lần không sao).
2. Thêm email đăng nhập của bạn làm quản trị, chạy trong SQL Editor:
   ```sql
   insert into public.app_admins (email) values ('email-cua-ban@gmail.com');
   ```
3. Đăng nhập web, trang Album của tôi sẽ có nút **Quản lý mã** (trang `/admin.html`).

Ở trang quản lý: chọn loại mã (1 đám cưới 60 ngày, studio 30 ngày, 1 năm), số lượng, ghi chú tên khách, bấm **Tạo mã** rồi Copy gửi qua Zalo. Bảng bên dưới cho biết mã nào chưa dùng, ai đã dùng, ngày hết hạn, và có nút **Khoá** nếu khách chia mã cho người khác. Khách nhập nhiều mã thì số ngày được cộng dồn. Mỗi người nhập sai tối đa 10 lần mỗi ngày.

Khi Supabase chưa chạy phần này, mọi người vẫn dùng như cũ (coi như Pro).

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
