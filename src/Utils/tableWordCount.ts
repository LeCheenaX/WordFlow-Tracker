import { wordsCounter } from "./stats";

/**
 * ## Overview
 *
 * Markdown table edits are special: when the user edits inside a table,
 * CodeMirror (CM) does NOT just replace the changed characters. Instead it
 * rewrites entire cell content (with padding), separator rows, or even the
 * whole table block. Without special handling, the word counter would count
 * all words in both the old and new text as added+deleted, massively
 * overcounting edits.
 *
 * The fix: detect table-related changes and use a NET word diff
 * (newWords - oldWords) instead of the double-sided sum.
 *
 * ## CodeMirror behavior (observed)
 *
 * CM produces different change shapes depending on the operation and version:
 *
 * ### A. Old CM — whole table block replaced
 *   Triggered by: adding/removing a column (CM rewrites the entire table).
 *   Shape: both `inserted` and `theOther` are multi-line strings, each line
 *          starting with '|', with at least one separator row.
 *   Detection: `isMarkdownTable(oldText) && isMarkdownTable(newText)`
 *   Example:
 *     old = "| A | B |\n| - | - |\n| 1 | 2 |"
 *     new = "| A | B | C |\n| - | - | - |\n| 1 | 2 |   |"
 *
 * ### B. New CM — single cell content replaced (prevCh='|', subseqCh='|')
 *   Triggered by: editing inside a cell; CM replaces the padded cell content
 *                 between the two surrounding '|' delimiters.
 *   Shape: single-line string with leading/trailing spaces (padding).
 *          prevCh='|', subseqCh='|'.
 *   Detection: `isTableCellChange(prevCh, subseqCh)` — strict case.
 *   Example:
 *     old = " File33                  "   prevCh='|' subseqCh='|'
 *     new = " File                    "
 *
 * ### C. New CM — separator row rewritten (subseqCh='|' or structural content)
 *   Triggered by: any cell edit also causes CM to rewrite the separator row
 *                 to adjust column widths.
 *   Shape: single line containing only '|', '-', ':', spaces. May be
 *          truncated (no trailing '|') when the last column is being resized.
 *   Detection: `isTableStructuralChange(oldText, newText)`
 *   Example:
 *     old = "| --- | --- | --- |"
 *     new = "| --- | --- | ----- |"   (last col widened)
 *     old = "| --- | --- | --- |"
 *     new = "| --- | --- | -----"     (truncated, no trailing '|')
 *
 * ### D. New CM — trailing cell padding adjusted (subseqCh='|', pure whitespace)
 *   Triggered by: CM adjusts the padding of the last cell in a row when
 *                 column widths change.
 *   Shape: both old and new are pure whitespace (optionally with a leading '|').
 *          subseqCh='|'.
 *   Detection: `isTablePaddingChange(oldText, newText, subseqCh)`
 *   Example:
 *     old = "     "   subseqCh='|'
 *     new = "       "
 *
 * ### E. New CM — manual table construction (prevCh in {' ','-',':','|'}, subseqCh='|')
 *   Triggered by: user manually typing table syntax in source mode, e.g.
 *                 adding a new column character by character.
 *   Shape: change ends just before a '|', and the preceding character is a
 *          table-internal character (space, dash, colon, pipe).
 *   Detection: `isTableCellChange` relaxed case — subseqCh='|' and
 *              prevCh in {' ', '-', ':', '|'}.
 *   Example:
 *     user types "hello" before a '|':
 *     old = ""   prevCh=' '  subseqCh='|'
 *     new = "hello"
 *   Note: subseqCh=' ' (space before '|') is NOT covered here because
 *         `isTableStructuralChange` already handles separator row rewrites,
 *         and mid-cell edits (subseqCh is a letter) are correctly handled
 *         by the original wordsCounter logic.
 *
 * ## False positive / false negative policy
 *
 * "Never overcount, allow undercount."
 *
 * Known undercount (acceptable):
 *   - User types inside `[[note|alias]]` in a normal paragraph, where
 *     subseqCh happens to be the '|' inside the link. The change may be
 *     misidentified as a table cell edit and net-diffed → 0 words counted
 *     instead of the correct value. This is rare and acceptable.
 *
 * Known overcount risk (mitigated):
 *   - None known after the above detections are applied.
 */

/**
 * Detects whether a string is a markdown table block (old CM behavior).
 * Requires: ≥2 non-empty lines, every line starts with '|', at least one
 * separator row matching /^\|[\s\-:|]+\|/.
 */
export function isMarkdownTable(text: string): boolean {
    const lines = text.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) return false;
    if (!lines.every(l => l.trimStart().startsWith('|'))) return false;
    return lines.some(l => /^\|[\s\-:|]+\|/.test(l.trim()));
}

/**
 * Detects whether a change occurred inside or adjacent to a markdown table cell.
 *
 * Strict case (new CM cell edit): prevCh='|' and subseqCh='|'.
 * Relaxed case (manual construction): subseqCh='|' and prevCh is a
 * table-internal character (' ', '-', ':', '|').
 *
 * subseqCh=' ' (space before '|') is intentionally excluded: separator row
 * rewrites with subseqCh=' ' are handled by isTableStructuralChange, and
 * mid-cell edits where subseqCh is a letter are correctly handled by the
 * original wordsCounter logic without special treatment.
 */
export function isTableCellChange(prevCh: string, subseqCh: string): boolean {
    if (subseqCh !== '|') return false;
    return prevCh === '|' || prevCh === ' ' || prevCh === '-' || prevCh === ':';
}

/**
 * Detects whether both old and new text are markdown table separator/structural
 * content — i.e. contain only '|', '-', ':', and whitespace, and include at
 * least one '|' and one '-'.
 *
 * Handles truncated separator rows (no trailing '|') that appear when CM
 * resizes the last column.
 */
export function isTableStructuralChange(oldText: string, newText: string): boolean {
    const isStructural = (s: string) => {
        const t = s.trim();
        return t.includes('|') && t.includes('-') && /^[\|\-\:\s]+$/.test(t);
    };
    return isStructural(oldText) && isStructural(newText);
}

/**
 * Detects whether a change is a table row trailing-padding adjustment.
 * Condition: subseqCh='|' and both old and new text are pure whitespace
 * (optionally with a leading '|').
 *
 * This fires when CM adjusts the padding of the last cell in a row after
 * a column width change.
 */
export function isTablePaddingChange(oldText: string, newText: string, subseqCh: string): boolean {
    if (subseqCh !== '|') return false;
    const isPadding = (s: string) => /^[\|\s]*$/.test(s);
    return isPadding(oldText) && isPadding(newText);
}

/**
 * Returns true if the change is table-related by any of the four detection
 * methods (cases A–E above). When true, use tableWordDiff instead of the
 * standard double-sided wordsCounter sum.
 */
export function isTableChange(
    oldText: string,
    newText: string,
    prevCh: string,
    subseqCh: string
): boolean {
    return (isMarkdownTable(oldText) && isMarkdownTable(newText))  // case A
        || isTableCellChange(prevCh, subseqCh)                     // cases B, E
        || isTableStructuralChange(oldText, newText)               // case C
        || isTablePaddingChange(oldText, newText, subseqCh);       // case D
}

/**
 * Extracts only user-facing word content from a markdown table string or cell
 * string, for use in net word diff calculation.
 *
 * Steps:
 * 1. Split by newline, drop empty lines and separator rows (lines whose
 *    trimmed content contains only '|', '-', ':', spaces with at least one
 *    '|' and one '-').
 * 2. Strip leading/trailing '|' from each remaining line, then split on '|'
 *    to get individual cell texts, joined by spaces.
 * 3. Join all rows with spaces.
 *
 * For single-line cell content (cases B, D, E), the input has no newlines,
 * so it passes through steps 2–3 directly.
 */
function extractTableCellText(text: string): string {
    return text
        .split('\n')
        .filter(line => {
            const t = line.trim();
            if (t === '') return false;
            // Drop separator rows (complete or truncated)
            if (t.includes('|') && t.includes('-') && /^[\|\-\:\s]+$/.test(t)) return false;
            return true;
        })
        .map(line =>
            line.replace(/^\||\|$/g, '').split('|').join(' ')
        )
        .join(' ');
}

/**
 * Computes the net word count difference for a table-related change.
 * Uses extractTableCellText to ignore separator rows and '|' delimiters,
 * then returns the signed net change clamped into addedWords / deletedWords.
 *
 * Convention (matches DocTracker):
 *   addedWords  = max(0,  netChange)
 *   deletedWords = max(0, -netChange)
 *   editedWords  = addedWords + deletedWords
 *   changedWords = netChange  (signed)
 */
export function tableWordDiff(oldText: string, newText: string): {
    addedWords: number;
    deletedWords: number;
    editedWords: number;
    changedWords: number;
} {
    const counter = wordsCounter();
    const oldCount = counter(extractTableCellText(oldText));
    const newCount = counter(extractTableCellText(newText));

    const netChange = newCount - oldCount;
    const addedWords = Math.max(0, netChange);
    const deletedWords = Math.max(0, -netChange);

    return {
        addedWords,
        deletedWords,
        editedWords: addedWords + deletedWords,
        changedWords: netChange,
    };
}
