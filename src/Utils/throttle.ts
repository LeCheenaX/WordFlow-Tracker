/**
 * Creates a throttled function that only invokes `fn` at most once per every `wait` milliseconds.
 * This implementation triggers on the leading edge (immediately) and ignores subsequent calls 
 * until the wait period has elapsed.
 * 
 * All calls (including throttled ones) return a Promise that resolves when the actual execution
 * completes. Throttled calls share the same Promise as the executing call.
 * 
 * Unlike standard debounce: it does not delay execution until activity stops.
 * Unlike standard throttle: it does not execute the trailing edge (last call) after the wait period.
 * 
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
export function throttleLeadingEdge<TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<void>,
    wait: number
): (...args: TArgs) => Promise<void> {
    let lastCallTime = 0;
    let timeoutId: number | null = null;
    let pendingPromise: Promise<void> | null = null;

    return function (this: unknown, ...args: TArgs): Promise<void> {
        const now = Date.now();

        // If there's already an execution in progress, return that Promise
        if (pendingPromise) {
            return pendingPromise;
        }

        // Run immediately if enough time has passed
        if (now - lastCallTime >= wait) {
            // Clear any existing cleanup timer
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
            }

            // Update time before execution to prevent race conditions
            lastCallTime = now;

            // Execute the function
            const result = fn.apply(this, args);

            pendingPromise = result;

            // Clear pendingPromise when done
            void result.finally(() => {
                pendingPromise = null;
            });

            // Set a timer to allow new calls after wait period
            timeoutId = window.setTimeout(() => {
                timeoutId = null;
            }, wait);

            return result;
        }

        // Throttled: return a resolved Promise.
        // This shouldn't happen if pendingPromise check works correctly
        return Promise.resolve();
    };
}
