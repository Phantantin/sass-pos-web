import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => navigation,
}));

import { LocaleSwitcher } from "@/components/locale-switcher";

describe("LocaleSwitcher", () => {
  beforeEach(() => {
    navigation.replace.mockClear();
  });

  it("preserves the current route when switching locale", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.click(screen.getByRole("button", { name: "EN" }));

    expect(navigation.replace).toHaveBeenCalledWith("/dashboard", { locale: "en" });
  });

  it("does not navigate when the active locale is selected", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.click(screen.getByRole("button", { name: "VI" }));

    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
