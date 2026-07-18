import type { TagColorConfig } from './TagColorManager';

export interface ConfiguredTagGroupMatch {
    configIndex: number;
    key: string;
    label: string;
    color: string;
    matchedTags: string[];
}

export interface ResolvedTagGroups {
    configuredGroups: ConfiguredTagGroupMatch[];
    unconfiguredTags: string[];
}

/**
 * Resolve a note's frontmatter tags against the configured color groups.
 * Consumers decide whether unmatched tags remain separate (Wordflow views)
 * or are combined into one group (the widget).
 */
export function resolveTagGroups(
    fileTags: string[],
    tagColorConfigs: TagColorConfig[]
): ResolvedTagGroups {
    const cleanFileTags = uniqueTags(fileTags);
    const configuredTagSet = new Set<string>();
    const configuredGroups: ConfiguredTagGroupMatch[] = [];

    tagColorConfigs.forEach((config, configIndex) => {
        const configTags = uniqueTags(config.tags || []);
        configTags.forEach(tag => configuredTagSet.add(tag));
        const matchedTags = configTags.filter(tag => cleanFileTags.includes(tag));
        if (matchedTags.length === 0) return;

        const label = config.groupName?.trim() || configTags.join(' ');
        configuredGroups.push({
            configIndex,
            key: 'configured:' + configIndex,
            label: label || 'Configured tags',
            color: config.color || '#3366cc',
            matchedTags,
        });
    });

    return {
        configuredGroups,
        unconfiguredTags: cleanFileTags.filter(tag => !configuredTagSet.has(tag)),
    };
}

export function cleanTag(tag: string): string {
    return tag.trim().replace(/^#/, '');
}

function uniqueTags(tags: string[]): string[] {
    return [...new Set(tags.map(cleanTag).filter(Boolean))];
}