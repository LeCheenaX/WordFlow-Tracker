/**
 * Conditional sleep utility that waits for a minimum time, then checks conditions
 * to decide whether to wait for the full maximum time or return early.
 * 
 * @param minWait - Minimum wait time in milliseconds
 * @param maxWait - Maximum wait time in milliseconds  
 * @param conditions - Array of lambda functions that must all return true to trigger early return
 * @returns Promise that resolves after appropriate wait time
 */
export async function conditionalSleep(
    minWait: number,
    maxWait: number,
    ...conditions: (() => boolean)[]
): Promise<void> {
    // First, wait for the minimum time
    await sleep(minWait);
    
    // Check if all conditions are met
    const allConditionsMet = conditions.every(condition => {
        try {
            return condition();
        } catch (e) {
            // If any condition throws an error, consider it as false
            return false;
        }
    });
    
    // If all conditions are met, return early
    if (allConditionsMet) {
        return;
    }
    
    // Otherwise, wait for the remaining time
    const remainingWait = maxWait - minWait;
    if (remainingWait > 0) {
        await sleep(remainingWait);
    }
}

// Re-export sleep function for convenience (assuming it's available globally)
declare global {
    function sleep(ms: number): Promise<void>;
}