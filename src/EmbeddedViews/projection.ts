import type { WordflowEntry, WordflowGroup, WordflowViewData } from './data';

export interface VisibleWordflowProjection {
    groups: WordflowGroup[];
    total: number;
    activeFilePaths: Set<string>;
    dayTotals: Map<string, number>;
    groupDayValues: Map<string, Map<string, number>>;
}

/**
 * Build the complete Top-N data projection for an embedded Markdown Wordflow
 * view. Anything after LIMIT is absent from every downstream calculation.
 */
export function buildVisibleProjection(
    data: WordflowViewData,
    limit: number
): VisibleWordflowProjection {
    const groups = [...data.groups]
        .sort((first, second) => second.value - first.value)
        .slice(0, Math.max(1, Math.floor(limit)));
    const activeFilePaths = new Set<string>();
    const dayTotals = new Map<string, number>();
    const groupDayValues = new Map<string, Map<string, number>>();

    for (const group of groups) {
        const valuesByDay = new Map<string, number>();
        for (const entry of group.entries) {
            const contribution = getEntryContribution(entry, data.mode);
            if (contribution <= 0) continue;
            activeFilePaths.add(entry.filePath);
            valuesByDay.set(entry.dateKey, (valuesByDay.get(entry.dateKey) || 0) + contribution);
            dayTotals.set(entry.dateKey, (dayTotals.get(entry.dateKey) || 0) + contribution);
        }
        groupDayValues.set(group.key, valuesByDay);
    }

    const total = [...dayTotals.values()].reduce((sum, value) => sum + value, 0);
    return { groups, total, activeFilePaths, dayTotals, groupDayValues };
}

function getEntryContribution(
    entry: WordflowEntry,
    mode: WordflowViewData['mode']
): number {
    if (mode === 'note') return entry.value;
    return entry.tagGroups.length > 0 ? entry.value / entry.tagGroups.length : 0;
}