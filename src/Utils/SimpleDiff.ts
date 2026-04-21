/**
 * Simple line-based diff utility (zero external dependencies).
 * Uses LCS (Longest Common Subsequence) to compute differences between two texts.
 */

interface DiffLine {
    type: 'add' | 'remove' | 'context';
    content: string;
}

/**
 * Compute LCS table for two arrays of strings.
 */
function lcsTable(a: string[], b: string[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    return dp;
}

/**
 * Backtrack through LCS table to produce diff lines.
 */
function backtrack(dp: number[][], a: string[], b: string[], i: number, j: number, result: DiffLine[]): void {
    if (i === 0 && j === 0) return;

    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        backtrack(dp, a, b, i - 1, j - 1, result);
        result.push({ type: 'context', content: a[i - 1] });
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        backtrack(dp, a, b, i, j - 1, result);
        result.push({ type: 'add', content: b[j - 1] });
    } else if (i > 0) {
        backtrack(dp, a, b, i - 1, j, result);
        result.push({ type: 'remove', content: a[i - 1] });
    }
}

/**
 * Iterative backtrack to avoid stack overflow on large files.
 */
function backtrackIterative(dp: number[][], a: string[], b: string[]): DiffLine[] {
    const result: DiffLine[] = [];
    let i = a.length;
    let j = b.length;

    const stack: DiffLine[] = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
            stack.push({ type: 'context', content: a[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            stack.push({ type: 'add', content: b[j - 1] });
            j--;
        } else {
            stack.push({ type: 'remove', content: a[i - 1] });
            i--;
        }
    }

    // Reverse since we built it backwards
    while (stack.length > 0) {
        result.push(stack.pop()!);
    }

    return result;
}

/**
 * Format diff lines into a unified-diff-style string with context lines.
 * Only includes changed lines and surrounding context.
 */
function formatDiff(diffLines: DiffLine[], contextLines: number = 2): string {
    const output: string[] = [];
    const changed: number[] = [];

    // Find indices of changed lines
    for (let i = 0; i < diffLines.length; i++) {
        if (diffLines[i].type !== 'context') {
            changed.push(i);
        }
    }

    if (changed.length === 0) return '';

    // Build ranges with context
    const included = new Set<number>();
    for (const idx of changed) {
        for (let c = Math.max(0, idx - contextLines); c <= Math.min(diffLines.length - 1, idx + contextLines); c++) {
            included.add(c);
        }
    }

    let lastIncluded = -2;
    for (let i = 0; i < diffLines.length; i++) {
        if (!included.has(i)) continue;

        if (i - lastIncluded > 1 && lastIncluded >= 0) {
            output.push('...');
        }

        const line = diffLines[i];
        switch (line.type) {
            case 'add':
                output.push(`+ ${line.content}`);
                break;
            case 'remove':
                output.push(`- ${line.content}`);
                break;
            case 'context':
                output.push(`  ${line.content}`);
                break;
        }
        lastIncluded = i;
    }

    return output.join('\n');
}

/**
 * Compute a human-readable diff between two text strings.
 * 
 * @param before - The original text (snapshot)
 * @param after - The current text
 * @param maxLength - Maximum character length of the output (truncated if exceeded)
 * @returns A unified-diff-style string showing changes
 */
export function computeDiff(before: string, after: string, maxLength: number = 4000): string {
    const aLines = before.split('\n');
    const bLines = after.split('\n');

    if (aLines.length > 2000 || bLines.length > 2000) {
        return computeSimplifiedDiff(aLines, bLines, maxLength);
    }

    const dp = lcsTable(aLines, bLines);
    const diffLines = backtrackIterative(dp, aLines, bLines);
    let result = formatDiff(diffLines);

    if (result.length > maxLength) {
        result = result.substring(0, maxLength) + '\n... [truncated]';
    }

    return result;
}

export function computeDiffForLLM(before: string, after: string, maxLength: number = 4000): string {
    const aLines = before.split('\n');
    const bLines = after.split('\n');

    if (aLines.length > 2000 || bLines.length > 2000) {
        const rawDiff = computeSimplifiedDiff(aLines, bLines, maxLength);
        return formatDiffLinesForLLM(parseRawDiff(rawDiff), maxLength);
    }

    const dp = lcsTable(aLines, bLines);
    const diffLines = backtrackIterative(dp, aLines, bLines);
    return formatDiffLinesForLLM(diffLines, maxLength);
}

interface DiffGroup {
    removed: string[];
    added: string[];
}

function formatDiffLinesForLLM(diffLines: DiffLine[], maxLength: number): string {
    const groups: DiffGroup[] = [];
    let currentGroup: DiffGroup = { removed: [], added: [] };

    for (const line of diffLines) {
        if (line.type === 'remove') {
            currentGroup.removed.push(line.content);
        } else if (line.type === 'add') {
            currentGroup.added.push(line.content);
        } else {
            if (currentGroup.removed.length > 0 || currentGroup.added.length > 0) {
                groups.push(currentGroup);
                currentGroup = { removed: [], added: [] };
            }
        }
    }
    if (currentGroup.removed.length > 0 || currentGroup.added.length > 0) {
        groups.push(currentGroup);
    }

    if (groups.length === 0) return '';

    const output: string[] = [];
    for (const group of groups) {
        if (group.removed.length > 0 && group.added.length > 0) {
            output.push('[MODIFIED]');
            output.push('  Before:');
            formatLineList(output, group.removed, '    ');
            output.push('  After:');
            formatLineList(output, group.added, '    ');
        } else if (group.added.length > 0) {
            output.push('[ADDED]');
            formatLineList(output, group.added, '  ');
        } else if (group.removed.length > 0) {
            output.push('[DELETED]');
            formatLineList(output, group.removed, '  ');
        }
    }

    let result = output.join('\n');
    if (result.length > maxLength) {
        result = result.substring(0, maxLength) + '\n... [truncated]';
    }
    return result;
}

function formatLineList(output: string[], lines: string[], indent: string): void {
    for (const line of lines) {
        output.push(`${indent}${line === '' ? '(empty line)' : line}`);
    }
}

function parseRawDiff(rawDiff: string): DiffLine[] {
    const lines = rawDiff.split('\n');
    const result: DiffLine[] = [];
    for (const line of lines) {
        if (line.startsWith('+ ')) {
            result.push({ type: 'add', content: line.substring(2) });
        } else if (line.startsWith('- ')) {
            result.push({ type: 'remove', content: line.substring(2) });
        } else if (line.startsWith('  ')) {
            result.push({ type: 'context', content: line.substring(2) });
        }
    }
    return result;
}

/**
 * Simplified diff for very large files - splits into chunks and diffs each.
 */
function computeSimplifiedDiff(aLines: string[], bLines: string[], maxLength: number): string {
    const chunkSize = 500;
    const output: string[] = [];
    const maxChunks = Math.max(Math.ceil(aLines.length / chunkSize), Math.ceil(bLines.length / chunkSize));

    for (let chunk = 0; chunk < maxChunks && output.join('\n').length < maxLength; chunk++) {
        const aStart = chunk * chunkSize;
        const bStart = chunk * chunkSize;
        const aChunk = aLines.slice(aStart, aStart + chunkSize);
        const bChunk = bLines.slice(bStart, bStart + chunkSize);

        if (aChunk.join('\n') !== bChunk.join('\n')) {
            const dp = lcsTable(aChunk, bChunk);
            const diffLines = backtrackIterative(dp, aChunk, bChunk);
            const chunkDiff = formatDiff(diffLines);
            if (chunkDiff) {
                output.push(chunkDiff);
            }
        }
    }

    let result = output.join('\n...\n');
    if (result.length > maxLength) {
        result = result.substring(0, maxLength) + '\n... [truncated]';
    }
    return result;
}
