import WordflowTrackerPlugin from "../main";

/**
 * Resolves a frontmatter property of a tracked note for use in ${property.xxx} interpolation.
 *
 * Rules:
 * - If the property does not exist, returns an empty string.
 * - For `tags`: each tag value is normalised (leading `#` stripped) and wrapped with 🏷️,
 *   then joined with a space.  e.g. ["#foo", "bar"] → "🏷️foo 🏷️bar"
 * - For boolean (Obsidian checkbox) values: true → ✅, false → 🟩
 * - For array values (multi-line property): items are joined with a space.
 * - For all other scalar values: converted to string.
 */
export function resolveNoteProperty(
    plugin: WordflowTrackerPlugin,
    filePath: string,
    propKey: string
): string {
    const file = plugin.app.vault.getFileByPath(filePath);
    if (!file) return '';

    const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter || frontmatter[propKey] === undefined) return '';

    const value = frontmatter[propKey];

    // Null value — return empty string rather than the string "null"
    if (value === null) return '';

    // Boolean / checkbox type
    if (typeof value === 'boolean') {
        return value ? '✅' : '🟩';
    }

    // Tags property — normalise and wrap with 🏷️
    if (propKey === 'tags') {
        const tags: string[] = Array.isArray(value)
            ? value.map(String)
            : String(value).split(/[\s,]+/).filter(Boolean);

        return tags
            .map(tag => '🏷️' + tag.replace(/^#/, ''))
            .join(' ');
    }

    // Array (multi-line YAML list)
    if (Array.isArray(value)) {
        return value.map(String).join(' ');
    }

    // Scalar fallback
    return String(value);
}
