/**
 * Simple line-based diff utility (zero external dependencies).
 * Uses LCS (Longest Common Subsequence) to compute differences between two texts.
 */

import { ContextRange, extractSentenceContext, extractBlockContext, extractHeadingContext, splitIntoHeadingSections } from './ContextExtractor';

interface DiffLine {
    type: 'add' | 'remove' | 'context';
    content: string;
    lineNumber?: number; // Line number in original content
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
function formatDiff(diffLines: DiffLine[], contextLines = 2): string {
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
export function computeDiff(before: string, after: string, maxLength = 4000): string {
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

export function computeDiffForLLM(
    before: string, 
    after: string, 
    maxLength = 4000,
    options?: {
        contextMode?: 'none' | 'sentence' | 'block' | 'heading';
        sentenceRange?: number;
        blockRange?: number;
        headingLevel?: number;
        headingTree?: string;
        summary?: string;
        fileName?: string;
        includeHeadingTree?: boolean;
    }
): string {
    const aLines = before.split('\n');
    const bLines = after.split('\n');

    if (aLines.length > 2000 || bLines.length > 2000) {
        const rawDiff = computeSimplifiedDiff(aLines, bLines, maxLength);
        return formatDiffLinesForLLM(parseRawDiff(rawDiff), maxLength, before, after, options);
    }

    const dp = lcsTable(aLines, bLines);
    const diffLines = backtrackIterative(dp, aLines, bLines);
    return formatDiffLinesForLLM(diffLines, maxLength, before, after, options);
}

interface DiffGroup {
    removed: string[];
    added: string[];
}

function formatDiffLinesForLLM(
    diffLines: DiffLine[], 
    maxLength: number,
    before?: string,
    after?: string,
    options?: {
        contextMode?: 'none' | 'sentence' | 'block' | 'heading';
        headingLevel?: number;
        sentenceRange?: number;
        blockRange?: number;
        headingTree?: string;
        summary?: string;
        fileName?: string;
        includeHeadingTree?: boolean;
    }
): string {
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
    
    // [FileSummary] block
    if (options?.summary) {
        output.push(`[FileSummary]`);
        output.push(options.summary);
        output.push('');
    }
    
    // [HeadingTree] block
    if (options?.headingTree && options?.includeHeadingTree) {
        // Prepend file name with colon if available
        const headingContent = options.fileName
            ? `${options.fileName}:\n${options.headingTree}`
            : options.headingTree;
        output.push(`[HeadingTree]`);
        output.push(headingContent);
        output.push('');
    }
    
    // Check if we need context mode
    const useContext = options?.contextMode && options.contextMode !== 'none' && before && after;
    
    if (useContext) {
        // Build context groups from diff groups.
        const contextGroups = groupChangesByContext(groups, before, after, {
            ...options,
            maxContextLength: maxLength
        });
        
        // Output each context group with numbered tags
        let ctxNum = 0;
        for (const contextGroup of contextGroups) {
            ctxNum++;
            const prefix = `[CONTEXT_${ctxNum}]`;
            
            // Context content (tag and value on separate lines)
            output.push(`${prefix}.CONTEXT`);
            output.push(contextGroup.context);
            
            // Changes bound to this context
            for (const change of contextGroup.changes) {
                if (change.type === 'modified') {
                    output.push(`${prefix}.MODIFIED`);
                    output.push(`${prefix}.MODIFIED.BEFORE`);
                    output.push(change.before!);
                    output.push(`${prefix}.MODIFIED.AFTER`);
                    output.push(change.after!);
                } else if (change.type === 'added') {
                    output.push(`${prefix}.ADDED`);
                    output.push(change.content!);
                } else if (change.type === 'deleted') {
                    output.push(`${prefix}.DELETED`);
                    output.push(change.content!);
                }
            }
        }
        
        // Pure deletions: assign to next context number
        const hasDeletions = groups.some(g => g.removed.length > 0 && g.added.length === 0);
        if (hasDeletions) {
            for (const group of groups) {
                if (group.removed.length > 0 && group.added.length === 0) {
                    const isEmptyRemoval = group.removed.every(line => line.trim() === '');
                    if (!isEmptyRemoval) {
                        ctxNum++;
                        const prefix = `[CONTEXT_${ctxNum}]`;
                        output.push(`${prefix}.CONTEXT`);
                        output.push(`_deleted_only_`);
                        output.push(`${prefix}.DELETED`);
                        formatLineList(output, group.removed, '');
                    }
                }
            }
        }
    } else {
        // No context mode — use flat numbered groups
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const prefix = `[GROUP_${i + 1}]`;
            
            const isEmptyRemoval = group.removed.length > 0 && group.removed.every(line => line.trim() === '');
            const isEmptyAddition = group.added.length > 0 && group.added.every(line => line.trim() === '');
            
            if (group.removed.length > 0 && group.added.length > 0 && !isEmptyRemoval && !isEmptyAddition) {
                output.push(prefix);
                output.push(`${prefix}.MODIFIED`);
                output.push(`${prefix}.MODIFIED.BEFORE`);
                formatLineList(output, group.removed, '');
                output.push(`${prefix}.MODIFIED.AFTER`);
                formatLineList(output, group.added, '');
            } else if (group.added.length > 0 && !isEmptyAddition) {
                output.push(prefix);
                output.push(`${prefix}.ADDED`);
                formatLineList(output, group.added, '');
            } else if (group.removed.length > 0 && !isEmptyRemoval) {
                output.push(prefix);
                output.push(`${prefix}.DELETED`);
                formatLineList(output, group.removed, '');
            }
        }
    }

    let result = output.join('\n');
    if (result.length > maxLength) {
        result = result.substring(0, maxLength) + '\n... [truncated]';
    }
    return result;
}

interface ContextGroup {
    context: string;
    changes: Array<{
        type: 'added' | 'deleted' | 'modified';
        content?: string;
        before?: string;
        after?: string;
    }>;
}

/**
 * Find a specific line in text content and return its character range.
 */
function findLineRange(line: string, content: string): ContextRange | null {
    const lines = content.split('\n');
    let charPos = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === line) {
            return { start: charPos, end: charPos + line.length };
        }
        charPos += lines[i].length + 1; // +1 for newline
    }
    return null;
}

/**
 * Group changes by their extracted context.
 *
 * For each diff group, the range in the current (`after`) content is determined by
 * locating its first added line. Pure-deletion groups (no added lines) are excluded
 * and should be handled by the caller as [Deleted] blocks.
 */
function groupChangesByContext(
    groups: DiffGroup[],
    beforeContent: string,
    afterContent: string,
    options: {
        contextMode?: 'none' | 'sentence' | 'block' | 'heading';
        headingLevel?: number;
        sentenceRange?: number;
        blockRange?: number;
        maxContextLength?: number;
    }
): ContextGroup[] {
    if (groups.length === 0) return [];
    
    // Step 1: Compute character range for each group that has added content.
    // Groups with added lines (modifications or pure additions) are located
    // in the after (current) content. Pure-deletion groups are skipped here.
    const groupRanges: Array<{ groupIndex: number; range: ContextRange }> = [];
    
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        if (group.added.length > 0) {
            const range = findLineRange(group.added[0], afterContent);
            if (range) {
                groupRanges.push({ groupIndex: i, range });
            }
        }
    }
    
    // Step 2: Expand context ranges based on mode and range parameter.
    // Expansion uses afterContent (current document state) so that added lines
    // are correctly positioned within their surrounding blocks/sentences.
    const expandedContexts: Array<{ range: ContextRange; groupIndices: number[] }> = [];
    
    for (const item of groupRanges) {
        let expandedRange = item.range;
        
        switch (options.contextMode) {
            case 'sentence': {
                const sentenceRange = options.sentenceRange ?? 0;
                const sentences = splitIntoSentences(afterContent);
                const sentenceRanges = getSentenceRanges(afterContent, sentences);
                
                // Find which sentences overlap with the change
                const relevantIndices = new Set<number>();
                for (let i = 0; i < sentenceRanges.length; i++) {
                    if (rangesOverlap(item.range, sentenceRanges[i])) {
                        for (let offset = -sentenceRange; offset <= sentenceRange; offset++) {
                            const idx = i + offset;
                            if (idx >= 0 && idx < sentenceRanges.length) {
                                relevantIndices.add(idx);
                            }
                        }
                    }
                }
                
                if (relevantIndices.size > 0) {
                    const indices = Array.from(relevantIndices).sort((a, b) => a - b);
                    const minIdx = indices[0];
                    const maxIdx = indices[indices.length - 1];
                    expandedRange = {
                        start: sentenceRanges[minIdx].start,
                        end: sentenceRanges[maxIdx].end
                    };
                }
                break;
            }
            case 'block': {
                const blockRange = options.blockRange ?? 0;
                const blocks = splitIntoBlocks(afterContent);
                const blockRanges = getBlockRanges(afterContent, blocks);
                
                const relevantIndices = new Set<number>();
                for (let i = 0; i < blockRanges.length; i++) {
                    if (rangesOverlap(item.range, blockRanges[i])) {
                        for (let offset = -blockRange; offset <= blockRange; offset++) {
                            const idx = i + offset;
                            if (idx >= 0 && idx < blockRanges.length) {
                                relevantIndices.add(idx);
                            }
                        }
                    }
                }
                
                if (relevantIndices.size > 0) {
                    const indices = Array.from(relevantIndices).sort((a, b) => a - b);
                    const minIdx = indices[0];
                    const maxIdx = indices[indices.length - 1];
                    expandedRange = {
                        start: blockRanges[minIdx].start,
                        end: blockRanges[maxIdx].end
                    };
                }
                break;
            }
            case 'heading': {
                // Expand to cover the full heading section at the configured level.
                // This ensures multiple changes within the same heading section are
                // merged into a single context group.
                const headingLevel = options.headingLevel ?? 3;
                const headingSections = splitIntoHeadingSections(afterContent, headingLevel);
                for (const section of headingSections) {
                    if (rangesOverlap(item.range, section.range)) {
                        expandedRange = section.range;
                        break;
                    }
                }
                break;
            }
        }
        
        // Check if this expanded range overlaps with any existing context
        let merged = false;
        for (const existing of expandedContexts) {
            if (rangesOverlap(expandedRange, existing.range)) {
                existing.range = {
                    start: Math.min(existing.range.start, expandedRange.start),
                    end: Math.max(existing.range.end, expandedRange.end)
                };
                if (!existing.groupIndices.includes(item.groupIndex)) {
                    existing.groupIndices.push(item.groupIndex);
                }
                merged = true;
                break;
            }
        }
        if (!merged) {
            expandedContexts.push({
                range: expandedRange,
                groupIndices: [item.groupIndex]
            });
        }
    }
    
    // (expandedContexts are already merged in Step 2 above)
    
    // Step 3: Extract context content for each merged range and build context groups
    const contextGroups: ContextGroup[] = [];
    const maxCtxLen = (options.maxContextLength ?? 128 * 1024);
    
    for (const mergedCtx of expandedContexts) {
        // Extract context content based on mode
        let contextContent = '';
        switch (options.contextMode) {
            case 'sentence':
                // Step 2 already expanded the range by sentenceRange.
                // Pass 0 here to avoid double-expanding.
                contextContent = extractSentenceContext(afterContent, [mergedCtx.range], 0);
                break;
            case 'block':
                // Step 2 already expanded the range by blockRange.
                // Pass 0 here to avoid double-expanding.
                contextContent = extractBlockContext(afterContent, [mergedCtx.range], 0);
                break;
            case 'heading':
                contextContent = extractHeadingContext(afterContent, [mergedCtx.range], options.headingLevel || 3);
                break;
            default:
                contextContent = afterContent.substring(mergedCtx.range.start, mergedCtx.range.end);
        }
        
        // Limit context to user's configured maxDiffLength (default 128KB) to avoid token waste.
        const contextGroup: ContextGroup = {
            context: contextContent.trim().substring(0, maxCtxLen) + (contextContent.length > maxCtxLen ? '...' : ''),
            changes: []
        };
        
        // Add all changes that belong to this merged context
        for (const groupIdx of mergedCtx.groupIndices) {
            const group = groups[groupIdx];
            
            const isEmptyRemoval = group.removed.length > 0 && group.removed.every(line => line.trim() === '');
            const isEmptyAddition = group.added.length > 0 && group.added.every(line => line.trim() === '');
            
            if (group.removed.length > 0 && group.added.length > 0 && !isEmptyRemoval && !isEmptyAddition) {
                contextGroup.changes.push({
                    type: 'modified',
                    before: group.removed.join('\n'),
                    after: group.added.join('\n')
                });
            } else if (group.added.length > 0 && !isEmptyAddition) {
                contextGroup.changes.push({
                    type: 'added',
                    content: group.added.join('\n')
                });
            } else if (group.removed.length > 0 && !isEmptyRemoval) {
                contextGroup.changes.push({
                    type: 'deleted',
                    content: group.removed.join('\n')
                });
            }
        }
        
        if (contextGroup.changes.length > 0) {
            contextGroups.push(contextGroup);
        }
    }
    
    return contextGroups;
}

// Export helper functions for use in groupChangesByContext
function splitIntoSentences(content: string): string[] {
    // Build a map: URL positions → placeholder, so dots inside URLs don't
    // get mistaken for sentence boundaries.
    const urlPlaceholderPrefix = '__WORDFLOW_URL_';
    const urlRanges: Array<{ start: number; end: number; placeholder: string }> = [];
    const urlRegex = /https?:\/\/[^\s)"'\]]+/g;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlRegex.exec(content)) !== null) {
        urlRanges.push({
            start: urlMatch.index,
            end: urlMatch.index + urlMatch[0].length,
            placeholder: `${urlPlaceholderPrefix}${urlRanges.length}__`
        });
    }
    
    // Replace URLs with placeholders for safe sentence splitting
    let safeContent = content;
    // Process in reverse order so positions stay valid
    for (let i = urlRanges.length - 1; i >= 0; i--) {
        const r = urlRanges[i];
        safeContent = safeContent.substring(0, r.start) + r.placeholder + safeContent.substring(r.end);
    }
    
    const sentences: string[] = [];
    let lastIndex = 0;
    
    // Split on:
    // 1. English . ! ? followed by space or newline
    // 2. Chinese 。！？ (anywhere)
    // 3. Ellipsis … (anywhere)
    // Note: URL placeholders are skipped via continue below
    const regex = /([.!?])(?=\s|\n|$)|([。！？])|__WORDFLOW_URL_\d+__|(…)/g;
    let match;
    
    while ((match = regex.exec(safeContent)) !== null) {
        // Skip URL placeholder matches (they match the third alternative)
        if (match[0].startsWith(urlPlaceholderPrefix)) {
            continue;
        }
        const sentence = safeContent.substring(lastIndex, match.index + match[0].length);
        if (sentence.trim().length > 0) {
            sentences.push(sentence);
        }
        lastIndex = match.index + match[0].length;
    }
    
    // Add remaining content
    if (lastIndex < safeContent.length) {
        const remaining = safeContent.substring(lastIndex);
        if (remaining.trim().length > 0) {
            sentences.push(remaining);
        }
    }
    
    // Restore URLs in sentences content (using the original content)
    const result = sentences.map(s => {
        let restored = s;
        for (const r of urlRanges) {
            restored = restored.replace(r.placeholder, content.substring(r.start, r.end));
        }
        return restored;
    });
    
    return result;
}

function getSentenceRanges(content: string, sentences: string[]): ContextRange[] {
    const ranges: ContextRange[] = [];
    let start = 0;
    
    for (const sentence of sentences) {
        ranges.push({ start, end: start + sentence.length });
        start += sentence.length;
    }
    
    return ranges;
}

function splitIntoBlocks(content: string): string[] {
    return content.split(/\n\s*\n/).filter(block => block.trim().length > 0);
}

function getBlockRanges(content: string, blocks: string[]): ContextRange[] {
    const ranges: ContextRange[] = [];
    let start = 0;
    
    for (const block of blocks) {
        const index = content.indexOf(block, start);
        if (index !== -1) {
            ranges.push({ start: index, end: index + block.length });
            start = index + block.length;
        }
    }
    
    return ranges;
}

function rangesOverlap(a: ContextRange, b: ContextRange): boolean {
    return a.start <= b.end && b.start <= a.end;
}

/**
 * Indent multi-line text
 */
function indentText(text: string, indent: string): string {
    return text.split('\n').map(line => indent + line).join('\n');
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
