/**
 * Context extraction utilities for AI Diff
 * Extracts relevant context around modified sections
 */

export interface ContextRange {
    start: number;
    end: number;
}

/**
 * Extract context by sentences
 * Splits on . or 。
 * @param range - Number of sentences to include before and after (0 = only the sentence with changes)
 */
export function extractSentenceContext(content: string, changeRanges: ContextRange[], range: number = 0): string {
    const sentences = splitIntoSentences(content);
    const sentenceRanges = getSentenceRanges(content, sentences);
    
    const relevantSentences = new Set<number>();
    
    for (const change of changeRanges) {
        for (let i = 0; i < sentenceRanges.length; i++) {
            const sentence = sentenceRanges[i];
            if (rangesOverlap(change, sentence)) {
                // Add the sentence with changes
                relevantSentences.add(i);
                
                // Add surrounding sentences based on range
                for (let offset = 1; offset <= range; offset++) {
                    if (i - offset >= 0) {
                        relevantSentences.add(i - offset);
                    }
                    if (i + offset < sentenceRanges.length) {
                        relevantSentences.add(i + offset);
                    }
                }
            }
        }
    }
    
    if (relevantSentences.size === 0) return '';
    
    const result: string[] = [];
    Array.from(relevantSentences).sort((a, b) => a - b).forEach(idx => {
        result.push(sentences[idx]);
    });
    
    return result.join('');
}

/**
 * Extract context by blocks (Obsidian-style)
 * Blocks are separated by empty lines
 * @param range - Number of blocks to include before and after (0 = only the block with changes)
 */
export function extractBlockContext(content: string, changeRanges: ContextRange[], range: number = 0): string {
    const blocks = splitIntoBlocks(content);
    const blockRanges = getBlockRanges(content, blocks);
    
    const relevantBlocks = new Set<number>();
    
    for (const change of changeRanges) {
        for (let i = 0; i < blockRanges.length; i++) {
            const block = blockRanges[i];
            if (rangesOverlap(change, block)) {
                // Add the block with changes
                relevantBlocks.add(i);
                
                // Add surrounding blocks based on range
                for (let offset = 1; offset <= range; offset++) {
                    if (i - offset >= 0) {
                        relevantBlocks.add(i - offset);
                    }
                    if (i + offset < blockRanges.length) {
                        relevantBlocks.add(i + offset);
                    }
                }
            }
        }
    }
    
    if (relevantBlocks.size === 0) return '';
    
    const result: string[] = [];
    Array.from(relevantBlocks).sort((a, b) => a - b).forEach(idx => {
        result.push(blocks[idx]);
    });
    
    return result.join('\n\n');
}

/**
 * Extract context by heading sections
 */
export function extractHeadingContext(content: string, changeRanges: ContextRange[], maxLevel: number): string {
    // Step 1: Find the actual heading level of the (sub)section containing each change.
    // Split at ALL heading levels (1-6) to locate the change precisely.
    const allSections = splitIntoHeadingSections(content, 6);
    let changeLevel = 6; // deepest possible
    
    for (const section of allSections) {
        for (const change of changeRanges) {
            if (rangesOverlap(change, section.range)) {
                if (section.level < changeLevel) {
                    changeLevel = section.level;
                }
                break;
            }
        }
    }
    
    // Step 2: The effective level is the LESS inclusive (smaller number = broader scope)
    // between the change's actual section level and the configured maxLevel.
    // E.g.: change at H3 with maxLevel=H2 → effectiveLevel=H2 (expand to H2 section).
    // E.g.: change at H2 with maxLevel=H3 → effectiveLevel=H2 (change's own level wins).
    const effectiveLevel = Math.min(changeLevel, maxLevel);
    
    // Step 3: Split at effectiveLevel and collect all sections that overlap the changes.
    const sections = splitIntoHeadingSections(content, effectiveLevel);
    
    const relevantSections: string[] = [];
    
    for (const section of sections) {
        for (const change of changeRanges) {
            if (rangesOverlap(change, section.range)) {
                relevantSections.push(section.content);
                break;
            }
        }
    }
    
    return relevantSections.join('\n\n');
}

export interface HeadingSection {
    level: number;
    title: string;
    range: ContextRange;
    content: string;
}

/**
 * Split content into heading sections
 */
export function splitIntoHeadingSections(content: string, maxLevel: number): HeadingSection[] {
    const lines = content.split('\n');
    const sections: HeadingSection[] = [];
    
    let currentSection: HeadingSection | null = null;
    let lineStart = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^(#{1,6})\s+(.+)$/);
        
        if (match) {
            const level = match[1].length;
            const title = match[2].trim();
            
            if (level <= maxLevel) {
                // Save previous section
                if (currentSection) {
                    currentSection.range.end = lineStart - 1;
                    sections.push(currentSection);
                }
                
                // Start new section
                const sectionContent: string[] = [];
                let j = i;
                while (j < lines.length) {
                    const nextLine = lines[j];
                    const nextMatch = nextLine.match(/^(#{1,6})\s+/);
                    if (nextMatch && j > i) {
                        const nextLevel = nextMatch[1].length;
                        if (nextLevel <= maxLevel) {
                            break;
                        }
                    }
                    sectionContent.push(nextLine);
                    j++;
                }
                
                currentSection = {
                    level,
                    title,
                    range: { start: lineStart, end: lineStart },
                    content: sectionContent.join('\n')
                };
            }
        }
        
        lineStart += line.length + 1; // +1 for newline
    }
    
    // Save last section
    if (currentSection) {
        currentSection.range.end = content.length;
        sections.push(currentSection);
    }
    
    return sections;
}

/**
 * Split content into sentences
 * Rules:
 * - English . ! ? must be followed by space/newline
 * - Chinese 。！？ and ellipsis ... … can be anywhere
 */
function splitIntoSentences(content: string): string[] {
    // Build a map: URL positions → placeholder, so dots inside URLs don't
    // get mistaken for sentence boundaries.
    const urlRanges: Array<{ start: number; end: number; placeholder: string }> = [];
    const urlRegex = /https?:\/\/[^\s)"'\]]+/g;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlRegex.exec(content)) !== null) {
        urlRanges.push({
            start: urlMatch.index,
            end: urlMatch.index + urlMatch[0].length,
            placeholder: `\x00URL${urlRanges.length}\x00`
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
    // Note: \x00URL\d+\x00 placeholders are skipped via continue below
    const regex = /([.!?])(?=\s|\n|$)|([。！？])|\x00URL\d+\x00|(…)/g;
    let match;
    
    while ((match = regex.exec(safeContent)) !== null) {
        // Skip URL placeholder matches (they match the third alternative)
        if (match[0].startsWith('\x00URL')) {
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

/**
 * Get character ranges for each sentence
 */
function getSentenceRanges(content: string, sentences: string[]): ContextRange[] {
    const ranges: ContextRange[] = [];
    let start = 0;
    
    for (const sentence of sentences) {
        ranges.push({ start, end: start + sentence.length });
        start += sentence.length;
    }
    
    return ranges;
}

/**
 * Split content into blocks (separated by empty lines)
 */
function splitIntoBlocks(content: string): string[] {
    return content.split(/\n\s*\n/).filter(block => block.trim().length > 0);
}

/**
 * Get character ranges for each block
 */
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

/**
 * Check if two ranges overlap
 */
function rangesOverlap(a: ContextRange, b: ContextRange): boolean {
    return a.start <= b.end && b.start <= a.end;
}

/**
 * Merge overlapping ranges
 */
export function mergeRanges(ranges: ContextRange[]): ContextRange[] {
    if (ranges.length === 0) return [];
    
    const sorted = ranges.slice().sort((a, b) => a.start - b.start);
    const merged: ContextRange[] = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];
        
        if (current.start <= last.end) {
            // Overlapping, merge
            last.end = Math.max(last.end, current.end);
        } else {
            // No overlap, add new range
            merged.push(current);
        }
    }
    
    return merged;
}
