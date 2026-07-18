export class Notice { constructor(_message: string) {} }
export class TFile {}
export class TFolder {}
export class App {}
export const MarkdownViewModeType = {};
export function setTooltip(): void {}
export function setIcon(): void {}
export function normalizePath(value: string): string { return value; }
export async function requestUrl(): Promise<never> { throw new Error('requestUrl is unavailable in tests.'); }
export function debounce<T extends (...args: never[]) => unknown>(fn: T): T { return fn; }
export function moment(): never { throw new Error('Date objects are supplied by the test.'); }