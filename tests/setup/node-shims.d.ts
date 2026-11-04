// SPDX-License-Identifier: GPL-3.0-or-later

declare module 'node:test' {
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  const assert: {
    ok(value: unknown, message?: string): asserts value;
    equal<T>(actual: T, expected: T, message?: string): void;
    deepEqual<T>(actual: T, expected: T, message?: string): void;
  };
  export default assert;
}

declare module 'node:fs' {
  export interface Dirent {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }
  const fs: {
    existsSync(p: string): boolean;
    readFileSync(p: string, encoding: 'utf8'): string;
    readdirSync(p: string): string[];
    readdirSync(p: string, options: { withFileTypes: true }): Dirent[];
    statSync(p: string): { size: number };
  };
  export default fs;
}

declare module 'node:path' {
  const path: {
    resolve(...segments: string[]): string;
    join(...segments: string[]): string;
    relative(from: string, to: string): string;
    dirname(p: string): string;
    extname(p: string): string;
  };
  export default path;
}

declare const process: {
  cwd(): string;
};
