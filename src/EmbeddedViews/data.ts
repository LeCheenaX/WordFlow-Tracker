import { TFile, moment } from 'obsidian';
import { ExistingData } from '../Recorder/DataRecorder';
import { DataRecorder } from '../Recorder/DataRecorder';
import { MetaDataParser } from '../Recorder/MetaDataParser';
import { formatTime } from '../Widget/Timer';
import { TagColorManager } from '../Utils/TagColorManager';
import { UniqueColorGenerator } from '../Utils/UniqueColorGenerator';
import { cleanTag, resolveTagGroups } from '../Utils/TagGroupResolver';
import { getRecorderFieldOptions } from '../Utils/fieldOptions';
import type WordflowTrackerPlugin from '../main';
import type { WordflowDateRange, WordflowMode, WordflowViewQuery } from './query';
import { getDefaultFieldForView } from './query';

export interface WordflowEntryTagGroup {
    key: string;
    label: string;
    color: string;
}

export interface WordflowEntry {
    date: moment.Moment;
    dateKey: string;
    filePath: string;
    fileName: string;
    value: number;
    color: string;
    tags: string[];
    tagGroups: WordflowEntryTagGroup[];
}

export interface WordflowGroup {
    key: string;
    label: string;
    value: number;
    color: string;
    entries: WordflowEntry[];
}

export interface DailyBucket {
    date: moment.Moment;
    dateKey: string;
    entries: WordflowEntry[];
    total: number;
}

export interface WordflowViewData {
    recorder: DataRecorder;
    field: string;
    fields: string[];
    range: WordflowDateRange;
    entries: WordflowEntry[];
    days: DailyBucket[];
    groups: WordflowGroup[];
    mode: WordflowMode;
    selectedFilePath?: string;
}

export interface RecorderResolution {
    recorder: DataRecorder | null;
    error?: string;
    availableRecorderNames: string[];
}

export class WordflowDataSource {
    private colorGenerator: UniqueColorGenerator;
    private tagColorManager: TagColorManager;
    private fallbackTagColors: Map<string, string> = new Map();
    private fileColorCache: Map<string, string> = new Map();

    constructor(private plugin: WordflowTrackerPlugin) {
        this.colorGenerator = new UniqueColorGenerator(
            Number(this.plugin.settings.colorGroupLightness) || 66,
            this.plugin.settings.colorGroupSaturation || [60, 85]
        );
        this.tagColorManager = new TagColorManager(
            plugin,
            plugin.settings.tagColors || [],
            this.colorGenerator,
            { hueRange: Math.max(10, Math.min(60, plugin.settings.tagColorHueRange || 30)) }
        );
    }

    public resolveRecorder(query: WordflowViewQuery): RecorderResolution {
        const recorders = this.plugin.recorderManager
            .getPeriodicRecorders()
            .filter(recorder => !(recorder.getParser() instanceof MetaDataParser));
        const availableRecorderNames = recorders.map(item => this.getRecorderLabel(item));

        if (!query.recorderName) {
            return {
                recorder: null,
                error: 'RECORDER is required for embedded Wordflow views.',
                availableRecorderNames,
            };
        }

        const recorder = recorders.find(item => this.getRecorderLabel(item) === query.recorderName);
        if (!recorder) {
            return {
                recorder: null,
                error: `Recorder "${query.recorderName}" was not found or is not a periodic table/list recorder.`,
                availableRecorderNames,
            };
        }

        return { recorder, availableRecorderNames };
    }

    public getRecorder(query: WordflowViewQuery): DataRecorder | null {
        return this.resolveRecorder(query).recorder;
    }

    public getFieldOptions(recorder: DataRecorder): string[] {
        const options = getRecorderFieldOptions(this.plugin, recorder);
        return options.length > 0 ? options : [
            'editedWords',
            'editedTimes',
            'addedWords',
            'deletedWords',
            'changedWords',
            'docWords',
            'editTime',
            'readTime',
            'readEditTime',
        ];
    }

    public async collect(query: WordflowViewQuery, range: WordflowDateRange, overrideField?: string, overrideMode?: WordflowMode): Promise<WordflowViewData | null> {
        const recorder = this.getRecorder(query);
        if (!recorder) return null;

        const fields = this.getFieldOptions(recorder);
        const requestedField = overrideField || query.field || getDefaultFieldForView(query.view);
        const field = fields.includes(requestedField) ? requestedField : (fields[0] || requestedField);
        const mode = overrideMode || query.mode || this.getDefaultMode(query);
        const days: DailyBucket[] = [];
        const entries: WordflowEntry[] = [];
        const selectedFilePath = query.file ? this.resolveFilePath(query.file) : undefined;

        const cursor = moment(range.start).startOf('day');
        while (cursor.isSameOrBefore(range.end, 'day')) {
            const dayEntries = await this.collectDay(recorder, cursor, field, selectedFilePath);
            const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.value, 0);
            const dateKey = cursor.format('YYYY-MM-DD');
            days.push({
                date: cursor.clone(),
                dateKey,
                entries: dayEntries,
                total: dayTotal,
            });
            entries.push(...dayEntries);
            cursor.add(1, 'day');
        }

        this.assignEntryColors(entries, mode);

        return {
            recorder,
            field,
            fields,
            range,
            entries,
            days,
            groups: this.groupEntries(entries, mode),
            mode,
            selectedFilePath,
        };
    }

    public getFieldValue(data: ExistingData | undefined, field: string): number | null {
        if (!data) return 0;
        if (field.startsWith('property.')) {
            return data.noteProperties?.[field] ?? null;
        }

        switch (field) {
            case 'editedWords':
                return data.editedWords;
            case 'editedTimes':
                return data.editedTimes;
            case 'addedWords':
                return data.addedWords;
            case 'deletedWords':
                return data.deletedWords;
            case 'changedWords':
                return data.changedWords;
            case 'docWords':
                return data.docWords;
            case 'editTime':
                return data.editTime;
            case 'readTime':
                return data.readTime;
            case 'readEditTime':
                return data.readEditTime;
            case 'totalWords':
                return data.totalWords;
            case 'totalEdits':
                return data.totalEdits;
            case 'totalEditTime':
                return data.totalEditTime;
            case 'totalReadTime':
                return data.totalReadTime;
            case 'totalTime':
                return data.totalTime;
            default:
                return 0;
        }
    }

    public formatValue(value: number | null, field: string): string {
        if (value === null) return 'No property';
        return isTimeField(field) ? formatTime(value, false) : value.toString();
    }

    public getRecorderLabel(recorder: DataRecorder): string {
        return recorder.config?.name ?? this.plugin.settings.name ?? 'Recorder';
    }

    private async collectDay(recorder: DataRecorder, date: moment.Moment, field: string, selectedFilePath?: string): Promise<WordflowEntry[]> {
        const recordNote = recorder.getRecordNote(date.valueOf());
        if (!recordNote) return [];

        const dataMap = await recorder.getParser().extractData(recordNote);
        const entries: WordflowEntry[] = [];

        dataMap.forEach((rowData, filePath) => {
            if (filePath === '|M|E|T|A|D|A|') return;
            if (selectedFilePath && filePath !== selectedFilePath) return;
            const value = this.getFieldValue(rowData, field);
            if (value === null || value === 0) return;

            const file = this.plugin.app.vault.getFileByPath(filePath);
            const tags = file ? this.tagColorManager.getFileTags(this.plugin.app, file) : [];
            entries.push({
                date: date.clone(),
                dateKey: date.format('YYYY-MM-DD'),
                filePath,
                fileName: rowData.fileName !== 'unknown' ? rowData.fileName : (file?.basename ?? filePath),
                value,
                color: '',
                tags,
                tagGroups: [],
            });
        });

        return entries;
    }

    private groupEntries(entries: WordflowEntry[], mode: WordflowMode): WordflowGroup[] {
        return mode === 'tag' ? this.groupByTag(entries) : this.groupByNote(entries);
    }

    private groupByNote(entries: WordflowEntry[]): WordflowGroup[] {
        const groups = new Map<string, WordflowGroup>();
        for (const entry of entries) {
            const existing = groups.get(entry.filePath);
            if (existing) {
                existing.value += entry.value;
                existing.entries.push(entry);
            } else {
                groups.set(entry.filePath, {
                    key: entry.filePath,
                    label: entry.fileName,
                    value: entry.value,
                    color: entry.color,
                    entries: [entry],
                });
            }
        }
        return [...groups.values()].sort((a, b) => b.value - a.value);
    }

    private groupByTag(entries: WordflowEntry[]): WordflowGroup[] {
        const groups = new Map<string, WordflowGroup>();

        for (const entry of entries) {
            const tagGroups = this.getTagGroupsForEntry(entry);
            const weight = entry.value / Math.max(1, tagGroups.length);

            for (const tagGroup of tagGroups) {
                const existing = groups.get(tagGroup.key);
                if (existing) {
                    existing.value += weight;
                    existing.entries.push(entry);
                } else {
                    groups.set(tagGroup.key, {
                        key: tagGroup.key,
                        label: tagGroup.label,
                        value: weight,
                        color: tagGroup.color,
                        entries: [entry],
                    });
                }
            }
        }

        return [...groups.values()].sort((a, b) => b.value - a.value);
    }

    private getTagGroupsForEntry(entry: WordflowEntry): WordflowEntryTagGroup[] {
        if (entry.tagGroups.length > 0) return entry.tagGroups;

        const resolved = resolveTagGroups(entry.tags, this.plugin.settings.tagColors || []);
        entry.tagGroups = [
            ...resolved.configuredGroups.map(group => ({
                key: group.key,
                label: group.label,
                color: group.color,
            })),
            ...resolved.unconfiguredTags.map(tag => ({
                key: 'tag:' + tag,
                label: tag,
                color: this.getFallbackTagColor(tag),
            })),
        ];
        return entry.tagGroups;
    }

    private assignEntryColors(entries: WordflowEntry[], mode: WordflowMode): void {
        if (mode === 'tag') {
            for (const entry of entries) {
                const groups = this.getTagGroupsForEntry(entry);
                entry.color = groups[0]?.color || '';
            }
            return;
        }

        const fileTagsByPath = new Map<string, string[]>();
        for (const entry of entries) {
            if (!fileTagsByPath.has(entry.filePath)) {
                fileTagsByPath.set(entry.filePath, entry.tags);
            }
        }
        const allFilesWithTags = this.buildFilesWithTagsMap(fileTagsByPath);

        const configuredFiles = [...fileTagsByPath].filter(([, tags]) =>
            tags.some(tag => this.tagColorManager.hasTagColor(tag))
        );
        const unconfiguredFiles = [...fileTagsByPath].filter(([, tags]) =>
            !tags.some(tag => this.tagColorManager.hasTagColor(tag))
        );

        for (const [filePath, tags] of [...configuredFiles, ...unconfiguredFiles]) {
            this.getFileColor(filePath, tags, allFilesWithTags);
        }
        for (const entry of entries) {
            entry.color = this.fileColorCache.get(entry.filePath) || '';
        }
    }

    private buildFilesWithTagsMap(fileTagsByPath: Map<string, string[]>): Map<string, string[]> {
        const filesWithTags = new Map<string, string[]>();
        for (const [filePath, tags] of fileTagsByPath) {
            for (const tag of tags) {
                const normalizedTag = cleanTag(tag);
                if (!normalizedTag) continue;
                const filePaths = filesWithTags.get(normalizedTag) || [];
                if (!filePaths.includes(filePath)) filePaths.push(filePath);
                filesWithTags.set(normalizedTag, filePaths);
            }
        }
        return filesWithTags;
    }
    private getFileColor(filePath: string, tags: string[], allFilesWithTags: Map<string, string[]>): string {
        if (this.fileColorCache.has(filePath)) return this.fileColorCache.get(filePath)!;

        const hasConfiguredTags = tags.some(tag => this.tagColorManager.hasTagColor(tag));
        const color = hasConfiguredTags
            ? this.tagColorManager.getFileColor(tags, filePath, allFilesWithTags)
            : this.colorGenerator.generate();

        this.fileColorCache.set(filePath, color);
        return color;
    }

    private getFallbackTagColor(tag: string): string {
        if (!this.fallbackTagColors.has(tag)) {
            this.fallbackTagColors.set(tag, this.colorGenerator.generate());
        }
        return this.fallbackTagColors.get(tag)!;
    }

    private resolveFilePath(fileText: string): string | undefined {
        const cleaned = fileText.replace(/^\[\[|\]\]$/g, '');
        const file = this.plugin.app.metadataCache.getFirstLinkpathDest(cleaned, '');
        return file?.path ?? (this.plugin.app.vault.getFileByPath(cleaned)?.path ?? cleaned);
    }

    private getDefaultMode(query: WordflowViewQuery): WordflowMode {
        if (query.view === 'LEADERBOARD' || query.view === 'CFD') return 'note';
        return 'tag';
    }
}

export function isTimeField(field: string): boolean {
    return field === 'editTime' || field === 'readTime' || field === 'readEditTime' || field === 'totalEditTime' || field === 'totalReadTime' || field === 'totalTime';
}


