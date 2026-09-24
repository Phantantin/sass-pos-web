# SaaS POS Web

Frontend Next.js App Router cho SaaS POS. Ứng dụng giao tiếp với Spring Boot qua BFF cùng origin, vì vậy JWT không bao giờ được đưa vào JavaScript của trình duyệt.

## Công nghệ

Next.js 16, React 19, TypeScript strict, Tailwind CSS, TanStack Query, React Hook Form/Zod, Recharts, next-intl, Sonner, Vitest/RTL, Playwright, PWA manifest và service worker với offline shell tĩnh.

## Cấu hình

Sao chép `.env.example` thành `.env.local` (không commit file này):

```env
SPRING_API_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME=SaaS POS
UPLOADTHING_TOKEN=
```

`SPRING_API_URL` không có tiền tố `NEXT_PUBLIC_`: đây là URL mà Next.js server/BFF dùng để gọi backend.

`UPLOADTHING_TOKEN` chỉ cần khi bật tải ảnh sản phẩm. Đây là server token của UploadThing, không được đặt tiền tố `NEXT_PUBLIC_`, không commit vào Git và phải được thay thế ngay nếu từng bị lộ. Khi chưa cấu hình token, các module POS/CRUD còn lại vẫn hoạt động nhưng nút tải ảnh sẽ báo lỗi cấu hình. Sau khi đặt token mới, restart Next.js rồi đăng nhập bằng `ROLE_ADMIN`, `ROLE_STORE_ADMIN` hoặc `ROLE_STORE_MANAGER` để thử tải PNG/JPG/WEBP dưới 4 MB trong Products; role khác phải bị từ chối.

## Lệnh

```powershell
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
```

Mở `http://localhost:3000/vi/login`. Playwright sẽ tự khởi động Next.js nếu không truyền `PLAYWRIGHT_BASE_URL`; lần đầu có thể cần `npx playwright install chromium`.

Để chạy luồng E2E đầy đủ trên **database MySQL cô lập**, hãy khởi động Docker Desktop và chạy từ thư mục workspace:

```powershell
.\scripts\run-e2e.ps1
```

Runner dùng Compose project `sass-pos-e2e`, database `sass_pos_e2e`, port frontend `3100` và credential ngẫu nhiên chỉ tồn tại trong tiến trình chạy. Nó tự xóa container/volume E2E khi hoàn tất. Thêm `-KeepStack` chỉ khi cần điều tra lỗi. Test tự tạo email, cửa hàng, chi nhánh, danh mục, sản phẩm, tồn kho và thu ngân duy nhất; nó thực hiện luồng signup → store → branch → product → inventory → shift → POS → refund → close shift.

Sau khi lấy **V7 token đã rotate** từ UploadThing Dashboard, có thể thêm kiểm thử upload thật vào luồng cô lập mà không ghi token vào file:

```powershell
$env:UPLOADTHING_TOKEN = "<rotated-v7-token>"
.\scripts\run-e2e.ps1 -VerifyUploadThing
Remove-Item Env:UPLOADTHING_TOKEN
```

Cờ này tải một PNG 1×1 qua giao diện Products và xác nhận thumbnail hiển thị trước khi lưu sản phẩm. SDK UploadThing v7 dùng duy nhất `UPLOADTHING_TOKEN`; không thay token này bằng cặp `UPLOADTHING_SECRET`/`UPLOADTHING_APP_ID` cũ.

## Xác thực BFF

1. Login/signup gửi tới `/api/auth/*` của Next.js.
2. Route handler gọi backend `/auth/*` và đặt `sass_pos_session` là cookie `HttpOnly`, `SameSite=Lax` và `Secure` ở production.
3. Client gọi `/api/backend/...`; BFF đọc cookie và thêm Bearer token trước khi proxy request.
4. Khi backend trả `401`, BFF xóa cookie. `proxy.ts` xử lý locale routing và bảo vệ navigation; backend vẫn là nơi quyết định quyền.

Không được thêm JWT vào `localStorage`, `sessionStorage` hoặc Zustand.

## Module đã có

- Auth, dashboard, Store/Branch/Employee/Category/Product/Inventory/Customer, gồm lịch sử mua hàng phân trang theo scope.
- Phân trang dùng chung cho các danh sách quản trị (store, branch, employee, category, product, tồn kho/biến động, customer, order, refund, shift và subscription); tồn kho hỗ trợ tìm nhanh theo tên hoặc SKU.
- Tải ảnh sản phẩm qua UploadThing route handler đã xác thực cookie/BFF; chỉ role được phép quản lý sản phẩm mới có thể tải tệp.
- POS, order, refund, shift, lịch sử hóa đơn phân trang, xem chi tiết/in/xuất CSV và VietQR có số tiền khi chuyển khoản.
- Báo cáo doanh thu/giá vốn/lợi nhuận theo ngày, sản phẩm, chi nhánh, cửa hàng; báo cáo hiệu suất/ca và biến động tồn kho; export CSV/Excel/PDF.
- Lịch làm việc, chấm công và bảng lương cố định hoặc tự tính theo phút công/đơn giá giờ.
- Subscription theo store: xem trial/plan/quota thật; system admin cập nhật plan/trạng thái đã lưu tại backend.
- Audit log toàn hệ thống cho system admin và log theo store cho store admin/manager.
- Việt/Anh foundation, permission map, responsive shell, state loading/error/not-found theo route và PWA manifest. Service worker chỉ cache asset tĩnh cùng một offline shell không chứa dữ liệu người dùng; khi điều hướng thất bại do mất mạng, shell này được hiển thị thay vì một trang đã đăng nhập.

Store owner có thể mở Stripe Checkout/Customer Portal từ trang gói dịch vụ; frontend chỉ chuyển hướng đến URL phiên do backend tạo và không xác nhận thanh toán ở trình duyệt. Backend chỉ đồng bộ thanh toán qua webhook Stripe có chữ ký hợp lệ. Khi chưa cấu hình Stripe, luồng này phải giữ tắt. Offline shell không hỗ trợ làm việc POS khi mất mạng, không xếp hàng đơn offline và không cache API, trang xác thực hay nội dung theo người dùng. Những phần còn trong roadmap: localization đầy đủ mọi chuỗi UI, xác minh Stripe/UploadThing thật, chính sách payroll đầy đủ, E2E Docker/MySQL và mở rộng tenant/security test. Xem [checklist tích hợp ngoài](../Sass-Pos-Application/docs/external-integrations.md), README backend và `Sass-Pos-Application/docs/` để biết kiến trúc và Docker Compose.
