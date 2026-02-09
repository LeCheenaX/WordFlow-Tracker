/**
 * Creates a throttled function that only invokes `fn` at most once per every `wait` milliseconds.
 * This implementation triggers on the leading edge (immediately) and ignores subsequent calls 
 * until the wait period has elapsed.
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
 * // Create a throttled log function that runs at most once every 1000ms
 * const logHandler = throttleLeadingEdge((msg: string) => console.log(msg), 1000);
 * 
 * logHandler('A'); // Logs 'A' immediately
 * logHandler('B'); // Ignored
 * logHandler('C'); // Ignored
 * // ... after 1000ms ...
 * logHandler('D'); // Logs 'D' immediately
 */
export function throttleLeadingEdge<T extends (...args: any[]) => void>(
    fn: T,
    wait: number
): (...args: Parameters<T>) => void {
    let lastCallTime = 0;
    let timeoutId: number | null = null;

    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now();

        // Run immediately if enough time has passed
        if (now - lastCallTime >= wait) {
            // Clear any existing cleanup timer
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            // Run existing function apply context
            fn.apply(this, args);
            lastCallTime = now;

            // Set a timer to clear the reference (cleanup)
            timeoutId = window.setTimeout(() => {
                timeoutId = null;
            }, wait);
        }
    };
}
