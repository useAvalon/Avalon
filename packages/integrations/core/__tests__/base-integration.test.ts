import { describe, it, expect } from "vitest";
import { BaseIntegration } from "../base-integration.ts";
import type {
  RenderParams,
  RenderResult,
  IntegrationConfig,
} from "../types.ts";

/**
 * Minimal concrete subclass of BaseIntegration for testing.
 * Implements only the required abstract members.
 */
class TestIntegration extends BaseIntegration {
  name = "test-framework";
  version = "1.0.0";

  async render(_params: RenderParams): Promise<RenderResult> {
    return { html: "" };
  }

  getHydrationScript(): string {
    return "";
  }

  config(): IntegrationConfig {
    return {
      name: this.name,
      fileExtensions: [".test"],
      detectionPatterns: { imports: [], content: [] },
    };
  }

  // Expose protected methods for testing
  public testValidateRenderParams(params: RenderParams): void {
    this.validateRenderParams(params);
  }

  public testCreateRenderError(message: string, cause?: unknown): Error {
    return this.createRenderError(message, cause);
  }
}

describe("BaseIntegration", () => {
  const integration = new TestIntegration();

  describe("validateRenderParams", () => {
    it("throws on missing src", () => {
      const params = {
        component: null,
        props: {},
        src: "",
      } as RenderParams;

      expect(() => integration.testValidateRenderParams(params)).toThrowError(
        "[test-framework] Missing required parameter: src"
      );
    });

    it("throws on non-object props", () => {
      const params = {
        component: null,
        props: "not-an-object" as unknown as Record<string, unknown>,
        src: "/components/Foo.tsx",
      } as RenderParams;

      expect(() => integration.testValidateRenderParams(params)).toThrowError(
        "[test-framework] Invalid props: must be an object"
      );
    });

    it("throws when props is null", () => {
      const params = {
        component: null,
        props: null as unknown as Record<string, unknown>,
        src: "/components/Foo.tsx",
      } as RenderParams;

      expect(() => integration.testValidateRenderParams(params)).toThrowError(
        "[test-framework] Invalid props: must be an object"
      );
    });
  });

  describe("createRenderError", () => {
    it("produces a prefixed error message", () => {
      const error = integration.testCreateRenderError("render failed");

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("[test-framework] render failed");
    });

    it("attaches the cause when provided", () => {
      const cause = new Error("original error");
      const error = integration.testCreateRenderError("render failed", cause);

      expect(error.message).toBe("[test-framework] render failed");
      expect(error.cause).toBe(cause);
    });

    it("has no cause when none is provided", () => {
      const error = integration.testCreateRenderError("something broke");

      expect(error.cause).toBeUndefined();
    });
  });
});
