declare module "bun:test" {
  type TestCallback = () => void | Promise<void>;
  type ExpectMatcher = unknown;

  type Expect = {
    (actual: unknown): any;
    any(expected: unknown): ExpectMatcher;
    arrayContaining(expected: unknown[]): ExpectMatcher;
    objectContaining(expected: Record<string, unknown>): ExpectMatcher;
    stringContaining(expected: string): ExpectMatcher;
    stringMatching(expected: string | RegExp): ExpectMatcher;
  };

  export function describe(name: string, callback: TestCallback): void;
  export function it(name: string, callback: TestCallback): void;
  export const test: typeof it;
  export function beforeAll(callback: TestCallback): void;
  export function afterAll(callback: TestCallback): void;
  export function beforeEach(callback: TestCallback): void;
  export function afterEach(callback: TestCallback): void;
  export const expect: Expect;
}

declare const Bun: {
  file(path: string | URL): {
    text(): Promise<string>;
  };
};
