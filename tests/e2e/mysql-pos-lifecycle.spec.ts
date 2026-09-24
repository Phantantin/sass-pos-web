import { expect, test } from "@playwright/test";

test.describe("MySQL POS lifecycle", () => {
  test.skip(process.env.E2E_MYSQL !== "true", "Set E2E_MYSQL=true only for an isolated MySQL test database.");
  test.setTimeout(120_000);

  test("creates a tenant and completes store-to-refund-to-shift workflow", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const ownerEmail = `e2e-owner-${suffix}@example.test`;
    const cashierEmail = `e2e-cashier-${suffix}@example.test`;
    const password = "E2e-safe-password-2026";
    const storeName = `E2E Store ${suffix}`;
    const branchName = `E2E Branch ${suffix}`;
    const categoryName = `E2E Category ${suffix}`;
    const productName = `E2E Product ${suffix}`;
    const verifyUploadThing = process.env.E2E_UPLOADTHING === "true";

    await page.goto("/vi/signup");
    await page.getByLabel("Họ và tên").fill("E2E Store Owner");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByLabel("Xác nhận mật khẩu").fill(password);
    await page.getByRole("button", { name: "Đăng ký" }).click();
    await expect(page).toHaveURL(/\/vi\/dashboard$/);

    await page.goto("/vi/store");
    await page.getByLabel("Tên thương hiệu").fill(storeName);
    await page.getByLabel("Loại hình kinh doanh").fill("Bán lẻ");
    await page.getByLabel("Điện thoại").fill("0900000000");
    await page.getByLabel("Địa chỉ").fill("Địa chỉ E2E");
    await page.getByRole("button", { name: "Tạo cửa hàng" }).click();
    await expect(page.getByText(storeName)).toBeVisible();

    await page.goto("/vi/branches");
    await page.getByLabel("Tên chi nhánh").fill(branchName);
    await page.getByLabel("Địa chỉ").fill("Địa chỉ chi nhánh E2E");
    await page.getByLabel("Điện thoại").fill("0900000001");
    await page.getByLabel("Thứ 2").check();
    await page.getByRole("button", { name: "Thêm chi nhánh" }).click();
    await expect(page.getByText(branchName)).toBeVisible();

    await page.goto("/vi/categories");
    await page.getByLabel("Tên danh mục").fill(categoryName);
    await page.getByRole("button", { name: "Thêm danh mục" }).click();
    await expect(page.getByText(categoryName)).toBeVisible();

    await page.goto("/vi/products");
    await page.getByLabel("Tên sản phẩm").fill(productName);
    await page.getByLabel("SKU").fill(`SKU-${suffix}`);
    await page.getByLabel("Danh mục").selectOption({ label: categoryName });
    await page.getByLabel("Giá niêm yết").fill("20000");
    await page.getByLabel("Giá bán").fill("15000");
    if (verifyUploadThing) {
      await page.locator('input[type="file"]').setInputFiles({
        name: "e2e-product.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0ZwAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
      await expect(page.getByAltText("Xem trước ảnh sản phẩm")).toBeVisible({ timeout: 30_000 });
    }
    await page.getByRole("button", { name: "Thêm sản phẩm" }).click();
    await expect(page.getByText(productName).first()).toBeVisible();

    await page.goto("/vi/inventory");
    await page.getByLabel("Sản phẩm").selectOption({ index: 1 });
    await page.getByLabel("Số lượng hiện có").fill("10");
    await page.getByLabel("Lý do nhập tồn ban đầu").fill("E2E initial inventory");
    await page.getByRole("button", { name: "Thêm vào kho" }).click();
    await expect(page.getByText(productName).first()).toBeVisible();

    await page.goto("/vi/employees");
    await page.getByLabel("Họ và tên").fill("E2E Cashier");
    await page.getByLabel("Email đăng nhập").fill(cashierEmail);
    await page.getByLabel("Mật khẩu tạm thời").fill(password);
    await page.getByLabel("Vai trò").selectOption("ROLE_BRANCH_CASHIER");
    await page.getByLabel(/Chi nhánh/).selectOption({ label: branchName });
    await page.getByRole("button", { name: "Thêm nhân viên" }).click();
    await expect(page.getByText(cashierEmail)).toBeVisible();

    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await page.getByLabel("Email").fill(cashierEmail);
    await page.getByLabel("Mật khẩu").fill(password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/vi\/pos$/);

    await page.getByRole("button", { name: "Mở ca" }).click();
    await expect(page.getByText("Ca đang mở")).toBeVisible();
    await page.getByRole("button", { name: productName }).click();
    await page.getByLabel("Tiền khách đưa").fill("20000");
    await page.getByRole("button", { name: "Thanh toán" }).click();
    await expect(page.getByText(/Thanh toán thành công đơn/)).toBeVisible();

    await page.goto("/vi/refunds");
    await page.getByLabel("Đơn hàng").selectOption({ index: 1 });
    await page.getByLabel("Lý do hoàn tiền").fill("E2E refund");
    await page.getByRole("button", { name: "Hoàn tiền toàn bộ phần còn lại" }).click();
    await expect(page.getByText("E2E refund")).toBeVisible();

    await page.goto("/vi/shifts");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Đóng ca" }).click();
    await expect(page.getByText("E2E Cashier")).toBeVisible();
  });
});
