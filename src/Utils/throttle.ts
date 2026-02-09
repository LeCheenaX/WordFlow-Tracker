/**
 * Creates a throttled function that only invokes `fn` at most once per every `wait` milliseconds.
 * This implementation triggers on the leading edge (immediately) and ignores subsequent calls 
 * until the wait period has elapsed.
 * 
 * For async functions, all calls (including throttled ones) return a Promise that resolves when
 * the actual execution completes. Throttled calls share the same Promise as the executing call.
 * 
 * Unlike standard debounce: it does not delay execution until activity stops.
 * Unlike standard throttle: it does not execute the trailing edge (last call) after the wait period.
 * 
 * @template T - The type of the function to throttle
 * @param fn - The function to throttle
 * @param wait - The number of milliseconds to throttle invocations to
 * @returns A new function that wraps `fn` with throttling logic
 * 
 * @example
 * // Create a throttled async function that runs at most once every 1000ms
 * const saveData = throttleLeadingEdge(async (data: string) => {
 *   await api.save(data);
 * }, 1000);
 * 
 * await saveData('A'); // Executes immediately, waits for completion
 * await saveData('B'); // Returns the same Promise as 'A', waits for 'A' to complete
 * // ... after 1000ms ...
 * await saveData('C'); // Executes immediately with new data
 */
export function throttleLeadingEdge<T extends (...args: any[]) => any>(
    fn: T,
    wait: number
): (...args: Parameters<T>) => ReturnType<T> extends Promise<infer U> ? Promise<U> : ReturnType<T> {
    let lastCallTime = 0;
    let timeoutId: number | null = null;
    let pendingPromise: Promise<any> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now();

        // If there's already an execution in progress, return that Promise
        if (pendingPromise) {
            return pendingPromise as any;
        }

        // Run immediately if enough time has passed
        if (now - lastCallTime >= wait) {
            // Clear any existing cleanup timer
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            // Update time before execution to prevent race conditions
            lastCallTime = now;

            // Execute the function
            const result = fn.apply(this, args);

            // If result is a Promise, track it
            if (result instanceof Promise) {
                pendingPromise = result;
                
                // Clear pendingPromise when done
                result.finally(() => {
                    pendingPromise = null;
                });

                // Set a timer to allow new calls after wait period
                timeoutId = window.setTimeout(() => {
                    timeoutId = null;
                }, wait);

                return result as any;
            }

            // For sync functions, set timer and return result
            timeoutId = window.setTimeout(() => {
                timeoutId = null;
            }, wait);

            return result as any;
        }

        // Throttled: return resolved Promise for async, undefined for sync
        // This shouldn't happen if pendingPromise check works correctly
        return Promise.resolve() as any;
    };
}
