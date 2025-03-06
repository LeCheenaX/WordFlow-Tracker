import {WordflowSettings} from "./main";
import WordflowTrackerPlugin from "./main";
import { DocTracker } from './DocTracker';
import { Setting, TFile } from 'obsidian';
import moment from 'moment';

// Configuration Constants
const START_POSITION = "title: 当天编辑的文件\ncollapse: close";
const END_POSITION = "````";
/*
export function recorder(){
    // something
    return async function(plugin:WordflowTrackerPlugin){
        //xxxxx
        let recordNoteName = moment().format(plugin.settings.periodicNoteFormat);
        let recordNotePath = plugin.settings.periodicNoteFolder + recordNoteName + '.md';
        let recordNote = plugin.app.vault.getFileByPath(recordNotePath)
        if (!recordNote) {
            console.log("Could not find note with path:", recordNotePath)
            return;
        }
        else {
            await plugin.app.vault.process(recordNote, (data) => {
            return data.concat(getRecordData(plugin.settings, plugin.trackerMap));
            //return data.replace('Hello', getRecordData(plugin.settings, plugin.trackerMap));
        })}
        
*/

function sortReflector(tracker: DocTracker, sortBy: string):any {
    switch (sortBy){
    case 'lastModifiedTime': return tracker.lastModifiedTime;
    case 'editedWords': return tracker.changedWords;
    case 'editedTimes': return tracker.changedTimes;
    case 'editedPercentage': return (100 * tracker.changedWords / tracker.docLength).toFixed(0).toString() + `%`; // warning: this is not stable.
    case 'modifiedNote': return tracker.filePath;
    default: throw Error("Cannot recognize sortBy string!");
    }
}

function varMap(varName:string, tracker:DocTracker, settings:WordflowSettings):any {
    switch (varName){
    case 'lastModifiedTime': return moment(tracker.lastModifiedTime).format(settings.timeFormat);
    case 'editedWords': return tracker.changedWords;
    case 'editedTimes': return tracker.changedTimes;
    case 'editedPercentage': return (100 * tracker.changedWords / tracker.docLength).toFixed(0).toString() + `%`; // warning: this is not stable.
    case 'modifiedNote': return tracker.filePath;
    default: throw Error("Cannot recognize var expression!");
    }
}

function getRecordData(settings:WordflowSettings, trackerMap:Map<string, DocTracker>): string {
    let outPutContent = '';
    
    if (settings.recordType === 'bullet list') {
        // bullet list处理逻辑
        trackerMap.forEach((docTracker) => {
            const replacedContent = settings.bulletListSyntax
                .replace(/\${modifiedNote}/g, docTracker.filePath)
                .replace(/\${lastModifiedTime}/g, moment(docTracker.lastModifiedTime).format(settings.timeFormat))
                .replace(/\${editedWords}/g, docTracker.changedWords.toString()) 
                .replace(/\${editedTimes}/g, docTracker.changedTimes.toString()) 
                .replace(/\${editedWords}/g, (100 * docTracker.changedWords / docTracker.docLength).toFixed(0)) // warning: this is not stable.)
                + '\n';
            outPutContent += replacedContent;
        });
    } else if (settings.recordType === 'table') {
        const [header, separator, ...templateRows] = settings.tableSyntax.split('\n').filter(l => l.trim());
        
        // 排序处理
        const sorted = Array.from(trackerMap.values()).sort((a, b) => {
            const aVal = sortReflector(a, settings.sortBy);
            const bVal = sortReflector(b, settings.sortBy);
            
            // 数值型排序
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return settings.isDescend ? bVal - aVal : aVal - bVal;
            }
            
            // 时间戳排序（当sortBy是lastModifiedTime时）
            if (settings.sortBy === 'lastModifiedTime') {
                return settings.isDescend ? bVal - aVal : aVal - bVal;
            }

            // 默认字符串排序
            return settings.isDescend 
                ? String(bVal).localeCompare(String(aVal)) 
                : String(aVal).localeCompare(String(bVal));
        });

        // 生成表格内容
        const rows = sorted.map(tracker => {
            return templateRows
                .map(line => line.replace(
                    /\${(\w+)}/g, 
                    (_, varName: string) => {
                        const value = varMap(varName, tracker, settings);
 
                        return String(value ?? '');
                    }
                ))
                .join('\n');
        });

        // 组装完整表格
        outPutContent = [
            '\n',
            header,
            separator,
            ...rows.flatMap(r => r.split('\n'))
        ].join('\n');
    }
    
    return outPutContent;
}

// claude tries
export function recorder() {
    return async function(plugin: WordflowTrackerPlugin) {
        let recordNoteName = moment().format(plugin.settings.periodicNoteFormat);
        let recordNotePath = plugin.settings.periodicNoteFolder + recordNoteName + '.md';
        let recordNote = plugin.app.vault.getFileByPath(recordNotePath);
        
        if (!recordNote) {
            console.log("Could not find note with path:", recordNotePath);
            return;
        }
        
        const noteContent = await plugin.app.vault.read(recordNote);
        
        if (plugin.settings.recordType === 'table') {
            // Extract header and separator from table syntax
            const [header, separator] = plugin.settings.tableSyntax
                .split('\n')
                .filter(l => l.trim())
                .slice(0, 2);
                
            if (!header || !separator) {
                new Error ("Invalid table syntax in recording type: missing header or separator!");
                return;
            }
            
            // Check if header and separator exist in the document
            if (noteContent.includes(header) && noteContent.includes(separator)) {
                // Table exists, update it
                const updatedContent = updater(noteContent, header, separator, getRecordData(plugin.settings, plugin.trackerMap));
                await plugin.app.vault.modify(recordNote, updatedContent);
                return;
            }
        }
        
        // If no existing table found or not using table format, append the new record
        await plugin.app.vault.process(recordNote, (data) => {
            return data.concat(getRecordData(plugin.settings, plugin.trackerMap));
        });
    };
}

function updater(
    noteContent: string,
    header: string,
    separator: string,
    newTableContent: string
): string {
    // Find the existing table in the document
    const headerIndex = noteContent.indexOf(header);
    if (headerIndex === -1) return noteContent + '\n' + newTableContent;
    
    const separatorIndex = noteContent.indexOf(separator, headerIndex);
    if (separatorIndex === -1) return noteContent + '\n' + newTableContent;
    
    const afterSeparatorIndex = separatorIndex + separator.length;
    
    // Find the end of the table
    const afterSeparator = noteContent.slice(afterSeparatorIndex);
    let tableEndIndex;
    
    // Look for next blank line or end of document
    const nextBlankLineIndex = afterSeparator.search(/\n\s*\n/);
    if (nextBlankLineIndex === -1) {
        tableEndIndex = noteContent.length;
    } else {
        tableEndIndex = afterSeparatorIndex + nextBlankLineIndex;
    }
    
    // Extract parts of the document and table
    const beforeTable = noteContent.slice(0, headerIndex);
    const afterTable = noteContent.slice(tableEndIndex);
    
    // Extract existing table rows
    const tableRows = noteContent
        .slice(headerIndex, tableEndIndex)
        .split('\n')
        .filter(line => line.trim());
    
    // Get rid of header and separator
    const existingDataRows = tableRows.slice(2);
    
    // Parse the new table content
    const newTableRows = newTableContent
        .trim()
        .split('\n')
        .filter(line => line.trim());
    
    // Get new header, separator, and data rows
    const newHeader = newTableRows[0];
    const newSeparator = newTableRows[1];
    const newDataRows = newTableRows.slice(2);
    
    // Map existing and new data rows by file path
    const existingRowsByPath = new Map<string, string>();
    const newRowsByPath = new Map<string, string>();
    
    // Function to extract file path from a row
    const extractFilePath = (row: string): string | null => {
        const parts = row.split('|').map(part => part.trim()).filter(Boolean);
        return parts.length > 0 ? parts[0] : null;
    };
    
    // Process existing rows
    for (const row of existingDataRows) {
        const filePath = extractFilePath(row);
        if (filePath) {
            existingRowsByPath.set(filePath, row);
        }
    }
    
    // Process new rows
    for (const row of newDataRows) {
        const filePath = extractFilePath(row);
        if (filePath) {
            newRowsByPath.set(filePath, row);
        }
    }
    
    // Combine rows - prioritize new rows
    const mergedRows = [...newDataRows];
    
    // Add existing rows that aren't in the new data
    for (const [filePath, row] of existingRowsByPath.entries()) {
        if (!newRowsByPath.has(filePath)) {
            mergedRows.push(row);
        }
    }
    
    // Reconstruct the table with merged rows
    const updatedTable = [
        newHeader,
        newSeparator,
        ...mergedRows
    ].join('\n');
    
    // Return updated document
    return beforeTable + '\n' + updatedTable + afterTable;
}