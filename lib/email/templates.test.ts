import { describe, expect, it } from "vitest";
import {
  bodyTextToHtml,
  renderEmailSubject,
  SAMPLE_TEMPLATE_VARS,
} from "@/lib/email/templates";

describe("email template render", () => {
  it("replaces subject vars", () => {
    expect(
      renderEmailSubject("Podsjetnik — {{ordinacija}}", SAMPLE_TEMPLATE_VARS),
    ).toBe("Podsjetnik — Demo Ordinacija");
  });

  it("escapes HTML in body vars", () => {
    const html = bodyTextToHtml("Pozdrav {{ime}}", {
      ...SAMPLE_TEMPLATE_VARS,
      ime: 'Ana <script>alert(1)</script>',
    });
    expect(html).toContain("Ana &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("converts blank lines to paragraphs", () => {
    const html = bodyTextToHtml(
      "Linija 1\nLinija 2\n\nDrugi paragraf",
      SAMPLE_TEMPLATE_VARS,
    );
    expect(html).toContain("<p>Linija 1<br />Linija 2</p>");
    expect(html).toContain("<p>Drugi paragraf</p>");
  });
});
