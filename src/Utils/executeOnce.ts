/**
 * Creates a function that will only execute the original function once per instance.
 * Subsequent calls will be ignored.
 * 
 * @template T - Function type that extends (...args: any[]) => void
 * @param fn - The original function to be executed only once
 * @returns A new function with the same signature that executes the original function only once
 */
export function executeOnce<T extends (...args: any[]) => void>(fn: T): (...args: Parameters<T>) => void {
    let hasExecuted = false;
    
    return (...args: Parameters<T>): void => {
        if (!hasExecuted) {
            hasExecuted = true;
            fn(...args);
        }
    };
}

/**
 * Creates a simple executeOnce function that takes a key and function directly.
 * This is a wrapper around executeOncePerKey for simpler usage.
 * Example: 
 *    this.plugin.executeOnce('my-key', myMethod.bind(this), 'myMethodArgs');
 *    this.plugin.executeOnce('my-key', () => myMethod('myMethodArgs'));
 * @returns A function that takes (key: string, fn: (...args: any[]) => void) => void
 */
export function executeOnceWithKey() {
    const executedKeys = new Set<string>();
    
    return <T extends any[]>(key: string, fn: (...args: T) => void, ...args: T): void => {
        if (!executedKeys.has(key)) {
            executedKeys.add(key);
            fn(...args); 
        }
    };
}
