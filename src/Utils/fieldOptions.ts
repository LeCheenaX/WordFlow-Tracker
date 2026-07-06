import { DataRecorder } from '../DataRecorder';
import { MetaDataParser } from '../MetaDataParser';
import type WordflowTrackerPlugin from '../main';

const WIDGET_FIELDS = [
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

export function getRecorderFieldOptions(plugin: WordflowTrackerPlugin, recorder: DataRecorder): string[] {
    const syntax = recorder.getParser().getSyntax();
    const standardFields = WIDGET_FIELDS.filter(field => syntax.includes(`\${${field}}`));
    const propertyFieldRegex = /\$\{property\.([\w.-]+)\}/g;
    const propertyFields: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = propertyFieldRegex.exec(syntax)) !== null) {
        const propKey = match[1];
        const token = `property.${propKey}`;
        if (propertyFields.includes(token)) continue;

        // @ts-expect-error Obsidian's property type registry is an internal API.
        const allProps = plugin.app.metadataTypeManager?.properties;
        const propInfo = allProps?.[propKey.toLowerCase()];
        const propType: string | undefined = propInfo?.type ?? propInfo?.widget;
        if (propType === 'number') propertyFields.push(token);
    }

    return [...standardFields, ...propertyFields];
}

export function getAllRecorderFieldOptions(plugin: WordflowTrackerPlugin): string[] {
    const fields = new Set<string>();

    for (const recorder of plugin.recorderManager.getPeriodicRecorders()) {
        if (recorder.getParser() instanceof MetaDataParser) continue;
        getRecorderFieldOptions(plugin, recorder).forEach(field => fields.add(field));
    }

    return Array.from(fields);
}
