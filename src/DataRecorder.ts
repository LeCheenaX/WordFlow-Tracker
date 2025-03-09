import {WordflowSettings} from "./main";
import WordflowTrackerPlugin from "./main";
import { DocTracker } from './DocTracker';
import { Notice, TFile } from 'obsidian';
import moment from 'moment';

export class DataRecorder {
    private existingDataMap: Map<string, ExistingData> = new Map();
    private newDataMap: Map<string, NewData> = new Map();
    private periodicNoteFolder: string;
    private periodicNoteFormat: string;
    private recordType: string;
    private timeFormat: string;
    private sortBy: string;
    private isDescend: boolean;
    private tableSyntax: string;
    private listSyntax: string;
    
    constructor(       
        private plugin: WordflowTrackerPlugin,
        private trackerMap: Map<string, DocTracker>, 
        //private tracker?: DocTracker,
    ){
        this.loadSettings();
    }

    public loadSettings(){
        this.periodicNoteFolder = this.plugin.settings.periodicNoteFolder;
        this.periodicNoteFormat = this.plugin.settings.periodicNoteFormat;
        this.recordType = this.plugin.settings.recordType;
        this.timeFormat = this.plugin.settings.timeFormat;
        this.sortBy = this.plugin.settings.sortBy;
        this.isDescend = this.plugin.settings.isDescend;
        this.tableSyntax = this.plugin.settings.tableSyntax;
        this.listSyntax = this.plugin.settings.bulletListSyntax;
        //new Notice(`Setting changed! Record type:${this.recordType}`, 3000)
    }

    public async record(tracker?:DocTracker): Promise<void> {
        // Get the target note file
        const recordNote = await this.getOrCreateRecordNote();
        if (!recordNote) {
            console.error("Failed to get or create record note");
            return;
        }
        
        // Load existing data
        await this.loadExistingData(recordNote);
        
        // Load tracker data
        this.loadTrackerData(tracker);
        
        // Merge data
        const mergedData = this.mergeData();
        
        // Generate and update content
        const content = this.generateContent(mergedData);
        await this.updateNote(recordNote, content);
    }

    private async getOrCreateRecordNote(): Promise<TFile | null> {
        const recordNoteName = moment().format(this.periodicNoteFormat);
        const recordNotePath = this.periodicNoteFolder + recordNoteName + '.md';
        let recordNote = this.plugin.app.vault.getFileByPath(recordNotePath);
        
        if (!recordNote) {
            try {
                await this.plugin.app.vault.create(recordNotePath, '');
                // Wait for file creation to complete
                await new Promise(resolve => setTimeout(resolve, 2000));
                recordNote = this.plugin.app.vault.getFileByPath(recordNotePath);
                new Notice(`Periodic note ${recordNotePath} doesn't exist!\n Auto created under ${this.periodicNoteFolder}. `, 3000)
            } catch (error) {
                console.error("Failed to create record note:", error);
                return null;
            }
        }
        
        return recordNote;
    }

    private getTableIndex(noteContent: string): number[]{
        const [headerTemplate, separatorTemplate] = this.tableSyntax
                .split('\n')
                .filter(l => l.trim())
                .slice(0, 2);
                
        if (!headerTemplate || !separatorTemplate) {
            throw Error ('Invalid table syntax!\n Please check in settings.')
        }

        // Create regex patterns for header and separator
        // This will match regardless of exact spacing or number of dashes
        const headerColumns = headerTemplate.split('|')
            .filter(part => part.trim())
            .map(part => part.trim());
            
        const headerRegexStr = '\\|\\s*' + headerColumns.join('\\s*\\|\\s*') + '\\s*\\|';
        const headerRegex = new RegExp(headerRegexStr, 'i');
        
        // Separator regex - matches any table separator row with the same number of columns
        const columnCount = headerColumns.length;
        const separatorRegexStr = `\\|(?:\\s*-+\\s*\\|){${columnCount}}`;
        const separatorRegex = new RegExp(separatorRegexStr);
        
        // Find table in the document
        const lines = noteContent.split('\n');
        let tableStartIndex = -1;
        let tableEndIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            if (headerRegex.test(lines[i])) {
                // Found potential header, check next line for separator
                if (i + 1 < lines.length && separatorRegex.test(lines[i + 1])) {
                    tableStartIndex = i;
                    
                    // Now find the end of the table
                    for (let j = tableStartIndex + 2; j < lines.length; j++) {
                        // Table ends at a blank line or end of document
                        if (!lines[j] || lines[j].trim() === '') {
                            tableEndIndex = j - 1;
                            break;
                        }
                        
                        // Or if we find another table header
                        if (j + 1 < lines.length && 
                            headerRegex.test(lines[j]) && 
                            separatorRegex.test(lines[j + 1])) {
                            tableEndIndex = j - 1;
                            break;
                        }
                    }
                    
                    // If we didn't find a clear end, table goes to end of document
                    if (tableEndIndex === -1) {
                        tableEndIndex = lines.length - 1;
                    }
                    
                    break;
                }
            }
        }
        return [tableStartIndex, tableEndIndex];
    }

    private async loadExistingData(recordNote: TFile): Promise<void> {
        this.existingDataMap.clear();
        
        const noteContent = await this.plugin.app.vault.read(recordNote);
        
        if (this.recordType === 'table') {
            const [tableStartIndex, tableEndIndex] = this.getTableIndex(noteContent);
            const lines = noteContent.split('\n');

            if ( tableStartIndex != -1){
                // Process data rows (skip header and separator)
                const dataRows = lines.slice(tableStartIndex + 2, tableEndIndex + 1);
//console.log('existing datarows:',dataRows)F
                // Parse each row into an ExistingData object
                for (const row of dataRows) {
                    if (row.trim().startsWith('|') && row.trim().endsWith('|')) {
                        const parsedData = ExistingData.fromTableRow(row);
                        if (parsedData) {
                            this.existingDataMap.set(parsedData.filePath, parsedData);
                        }
                    }
                }
            }
//console.log('existing datamap:',this.existingDataMap)
        } else if (this.recordType === 'bulletList') {
            // Extract and process list groups, then add to map.
            this.extractListGroups(noteContent);
        }
    }

    private loadTrackerData(p_tracker?:DocTracker): void {
        this.newDataMap.clear();
        if (!p_tracker){
            for (const [filePath, tracker] of this.trackerMap.entries()) {
                this.newDataMap.set(filePath, new NewData(tracker));
                tracker.resetEdit();
            }
        } else {
            this.newDataMap.set(p_tracker.filePath, new NewData(p_tracker)); // only record given data
//console.log('newDataMap:', this.newDataMap);
            p_tracker.resetEdit();
        }
    }

    private mergeData(): MergedData[] {
        const mergedDataMap = new Map<string, MergedData>();
        
        // First add all new data
        for (const [filePath, newData] of this.newDataMap.entries()) {
            mergedDataMap.set(filePath, new MergedData(newData));
            
            // If there's existing data for this file, merge it
            if (this.existingDataMap.has(filePath)) {
                const existingData = this.existingDataMap.get(filePath);
                const mergedData = mergedDataMap.get(filePath); 
                if (mergedData && existingData) { // for passing ts
                    mergedData.mergeWith(existingData);
                }
            }
        }
        
//console.log('mergedDataMap:', mergedDataMap)
        // Add remaining existing data that has no new updates
        for (const [filePath, existingData] of this.existingDataMap.entries()) {
            if (!mergedDataMap.has(filePath)) {
                mergedDataMap.set(filePath, new MergedData(undefined, existingData));
            }
        }
        
        // Convert to array for sorting
        const mergedData = Array.from(mergedDataMap.values());
        
        // Sort the merged data
        mergedData.sort((a, b) => {
            let aVal: any, bVal: any;
            
            switch (this.sortBy) {
                case 'lastModifiedTime':
                    aVal = typeof a.lastModifiedTime === 'number' ? a.lastModifiedTime : 0;
                    bVal = typeof b.lastModifiedTime === 'number' ? b.lastModifiedTime : 0;
                    break;
                case 'editedWords':
                    aVal = a.editedWords;
                    bVal = b.editedWords;
                    break;
                case 'editedTimes':
                    aVal = a.editedTimes;
                    bVal = b.editedTimes;
                    break;
                case 'editedPercentage':
                    aVal = parseInt(a.editedPercentage);
                    bVal = parseInt(b.editedPercentage);
                    break;
                case 'modifiedNote':
                    aVal = a.filePath;
                    bVal = b.filePath;
                    break;
                default:
                    aVal = a.filePath;
                    bVal = b.filePath;
            }
            
            // Apply sort direction
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return this.isDescend ? bVal - aVal : aVal - bVal;
            }
            
            // Handle string comparison
            return this.isDescend 
                ? String(bVal).localeCompare(String(aVal)) 
                : String(aVal).localeCompare(String(bVal));
        });
        
        return mergedData;
    }

    private generateContent(mergedData: MergedData[]): string {
        switch (this.recordType ) {
        case 'bulletList':{
            // Implement bullet list generation
            return this.generateBulletList(mergedData);
        }
        default: { // Default: table as record type
            return this.generateTable(mergedData);
        }
        }
    }
    
    private generateBulletList(mergedData: MergedData[]): string {
        let output = '\n';
        
        for (const data of mergedData) {
            let line = this.listSyntax
                .replace(/\${modifiedNote}/g, data.filePath)
                .replace(/\${lastModifiedTime}/g, typeof data.lastModifiedTime === 'number' 
                    ? moment(data.lastModifiedTime).format(this.timeFormat) 
                    : data.lastModifiedTime as string)
                .replace(/\${editedWords}/g, data.editedWords.toString())
                .replace(/\${editedTimes}/g, data.editedTimes.toString())
                .replace(/\${editedPercentage}/g, data.editedPercentage);
            
            output += line + '\n';
        }
        
        return output;
    }
    
    private generateTable(mergedData: MergedData[]): string {
        const [header, separator, ...templateRows] = this.tableSyntax
            .split('\n')
            .filter(l => l.trim());
            
        if (!header || !separator || templateRows.length === 0) {
            console.warn("Invalid table syntax");
            return '';
        }
        
        const rowTemplate = templateRows.join('\n');
        
        // Generate rows from the merged data
        const rows = mergedData.map(data => {
            return rowTemplate.replace(
                /\${(\w+)}/g,
                (_, varName: string) => {
                    switch (varName) {
                        case 'modifiedNote':
                            return data.filePath;
                        case 'lastModifiedTime':
                            return typeof data.lastModifiedTime === 'number'
                                ? moment(data.lastModifiedTime).format(this.timeFormat)
                                : data.lastModifiedTime as string;
                        case 'editedWords':
                            return data.editedWords.toString();
                        case 'editedTimes':
                            return data.editedTimes.toString();
                        case 'editedPercentage':
                            return data.editedPercentage;
                        default:
                            return '';
                    }
                }
            );
        });
        
        // Assemble the complete table
        return [
            header,
            separator,
            ...rows
        ].join('\n');
    }

    private async updateNote(recordNote: TFile, newContent: string): Promise<void> {
        const noteContent = await this.plugin.app.vault.read(recordNote);
        const lines = noteContent.split('\n');
        
        if (this.recordType === 'table') {
            const [tableStartIndex, tableEndIndex] = this.getTableIndex(noteContent);
            if (tableStartIndex != -1 && tableEndIndex !== -1){    
                const tableContent = lines.slice(tableStartIndex, tableEndIndex + 1).join('\n');
                
                // Ensure proper spacing for the new content
                let formattedNewContent = newContent;
                if (!formattedNewContent.endsWith('\n')) {
                    formattedNewContent += '\n';
                }
                
                await this.plugin.app.vault.process(recordNote, (data) => {
                    return data.replace(tableContent, formattedNewContent.trim());
                });
            } else { // no existing table found
                const linebreaks = noteContent.endsWith('\n\n') ? '' : 
                                   noteContent.endsWith('\n') ? '\n' : '\n\n';
                await this.plugin.app.vault.modify(recordNote, noteContent + linebreaks + newContent);
            }
        } else if (this.recordType === 'bulletList') {
            // Get list boundaries
            const [listStartIndex, listEndIndex] = this.getListIndex(noteContent);
            
            if (listStartIndex != -1 && listEndIndex != -1){
                const listContent = lines.slice(listStartIndex, listEndIndex + 1).join('\n');
                
                // Ensure proper spacing for the new content
                let formattedNewContent = newContent;
                if (!formattedNewContent.endsWith('\n')) {
                    formattedNewContent += '\n';
                }
                
                await this.plugin.app.vault.process(recordNote, (data) => {
                    return data.replace(listContent, formattedNewContent.trim());
                });
            } else { // no existing list found
                const linebreaks = noteContent.endsWith('\n\n') ? '' : 
                                   noteContent.endsWith('\n') ? '\n' : '\n\n';
                await this.plugin.app.vault.modify(recordNote, noteContent + linebreaks + newContent);
            }
        } else {
            // If no existing content of the right type found, append to the document
            const linebreaks = noteContent.endsWith('\n\n') ? '' : 
                               noteContent.endsWith('\n') ? '\n' : '\n\n';
            await this.plugin.app.vault.modify(recordNote, noteContent + linebreaks + newContent);
        }
    }

    private extractListGroups(noteContent: string): void {
        this.existingDataMap.clear();
        const lines = noteContent.split('\n');
        
        // Parse the list syntax to extract patterns
        const syntaxLines = this.listSyntax.split('\n');
        const lineCount = syntaxLines.length;
        const patterns = [];
        
        // Extract patterns from each line of syntax
        for (let i = 0; i < lineCount; i++) {
            const line = syntaxLines[i];
            const varStart = line.indexOf('${');
            
            if (varStart === -1) {
                patterns.push({ start: line, end: '\n', varName: '' });
                continue;
            }
            
            const varEnd = line.indexOf('}', varStart);
            if (varEnd === -1) {
                patterns.push({ start: line.substring(0, varStart), end: '\n', varName: '' });
                continue;
            }
            
            const varName = line.substring(varStart + 2, varEnd);
            patterns.push({
                start: line.substring(0, varStart),
                end: line.substring(varEnd + 1),
                varName
            });
        }
        
        // Find list groups by matching patterns
        for (let i = 0; i < lines.length; i++) {
            let isGroupStart = true;
            let groupData: Record<string, string> = {};
            
            // Check if current line could be start of a list group
            for (let j = 0; j < lineCount; j++) {
                const pattern = patterns[j];
                const lineToCheck = i + j;
                
                if (lineToCheck >= lines.length) {
                    isGroupStart = false;
                    break;
                }
                
                const currentLine = lines[lineToCheck];
                const matchesStart = currentLine.startsWith(pattern.start);
                const matchesEnd = pattern.end === '\n' || 
                                   currentLine.endsWith(pattern.end.replace('\n', ''));
                
                if (!matchesStart || !matchesEnd) {
                    isGroupStart = false;
                    break;
                }
                
                // Extract value if pattern has a variable name
                if (pattern.varName) {
                    const startPos = pattern.start.length;
                    const endPos = pattern.end === '\n' ? 
                                   currentLine.length : 
                                   currentLine.length - pattern.end.replace('\n', '').length;
                    
                    // Map variable names from template to property names in ExistingData
                    const varValue = currentLine.substring(startPos, endPos);
                    if (pattern.varName === 'modifiedNote') {
                        groupData['filePath'] = varValue;
                    } else {
                        groupData[pattern.varName] = varValue;
                    }
                }
            }
            
            if (isGroupStart) {
                // Create ExistingData entry if we have a filePath
                if (groupData.filePath || groupData.modifiedNote) {
                    const existingData = new ExistingData(groupData.filePath || groupData.modifiedNote);
                    
                    // Parse editedWords
                    if (groupData.editedWords !== undefined) {
                        existingData.editedWords = parseInt(groupData.editedWords) || 0;
                    }
                    
                    // Parse editedTimes
                    if (groupData.editedTimes !== undefined) {
                        existingData.editedTimes = parseInt(groupData.editedTimes) || 0;
                    }
                    
                    // Parse lastModifiedTime if present
                    if (groupData.lastModifiedTime !== undefined) {
                        try {
                            existingData.lastModifiedTime = Date.parse(groupData.lastModifiedTime);
                        } catch (e) {
                            existingData.lastModifiedTime = null;
                        }
                    } else {
                        existingData.lastModifiedTime = null;
                    }
                    
                    // Calculate percentage
                    existingData.editedPercentage = existingData.editedWords > 0 ? 
                        Math.floor((existingData.editedWords / 1) * 100) + '%' : '0%';
                    
                    // Add to map using normalized file path
                    this.existingDataMap.set(existingData.filePath.replace(/^\[\[+|\]\]+$/g, ''), existingData);
                }
                
                // Skip to the end of this group to continue search
                i += lineCount - 1;
            }
        }
    }
    
    private getListIndex(noteContent: string): [number, number] {
        const lines = noteContent.split('\n');
        let startLine = -1;
        let endLine = -1;
        
        // Parse the list syntax to extract patterns
        const syntaxLines = this.listSyntax.split('\n');
        const lineCount = syntaxLines.length;
        const patterns = [];
        
        // Extract patterns from each line of syntax
        for (let i = 0; i < lineCount; i++) {
            const line = syntaxLines[i];
            const varStart = line.indexOf('${');
            
            if (varStart === -1) {
                patterns.push({ start: line, end: '\n' });
                continue;
            }
            
            const varEnd = line.indexOf('}', varStart);
            if (varEnd === -1) {
                patterns.push({ start: line.substring(0, varStart), end: '\n' });
                continue;
            }
            
            patterns.push({
                start: line.substring(0, varStart),
                end: line.substring(varEnd + 1)
            });
        }
        
        // Find list groups by matching patterns
        for (let i = 0; i < lines.length; i++) {
            let isGroupStart = true;
            
            // Check if current line could be start of a list group
            for (let j = 0; j < lineCount; j++) {
                const pattern = patterns[j];
                const lineToCheck = i + j;
                
                if (lineToCheck >= lines.length) {
                    isGroupStart = false;
                    break;
                }
                
                const currentLine = lines[lineToCheck];
                const matchesStart = currentLine.startsWith(pattern.start);
                const matchesEnd = pattern.end === '\n' || 
                                  currentLine.endsWith(pattern.end.replace('\n', ''));
                
                if (!matchesStart || !matchesEnd) {
                    isGroupStart = false;
                    break;
                }
            }
            
            if (isGroupStart) {
                // Found a valid list group
                if (startLine === -1) {
                    startLine = i;
                }
                
                // Update end line to include this group
                endLine = i + lineCount - 1;
                
                // Skip to the end of this group to continue search
                i = endLine;
            }
        }
        
        // Convert line numbers to character positions
        if (startLine !== -1 && endLine !== -1) {
            /*let startPos = 0;
            for (let i = 0; i < startLine; i++) {
                startPos += lines[i].length + 1; // +1 for newline
            }
            
            let endPos = startPos;
            for (let i = startLine; i <= endLine; i++) {
                endPos += lines[i].length + 1;
            }
            */
            return [startLine, endLine];
        }
        
        return [-1, -1]; // No list groups found
    }
}

// Class to represent data from existing records
class ExistingData {
    filePath: string;
    lastModifiedTime: number|null;
    editedWords: number;
    editedTimes: number;
    editedPercentage: string;
    
    constructor(filePath: string) {
        this.filePath = filePath;
        this.lastModifiedTime = null;
        this.editedWords = 0;
        this.editedTimes = 0;
        this.editedPercentage = '0%';
    }
    
    // Parse a table row into an ExistingData object
    static fromTableRow(row: string): ExistingData | null {
        const parts = row.split('|').map(part => part.trim()).filter(Boolean);
        if (parts.length < 1) return null;
        
        const entry = new ExistingData(parts[0].replace(/^\[\[+|\]\]+$/g, '')); // require file path to be in the first column, and drop the '[[]]'.
        
        // Try to extract numeric values using regex - more robust than position-based extraction
        for (let i = 1; i < parts.length; i++) {
            const cell = parts[i];
            
            // Look for edited words (typically just a number)
            if (/^\d+$/.test(cell)) {
                if (entry.editedWords === 0) {
                    entry.editedWords = parseInt(cell);
                    continue;
                } else if (entry.editedTimes === 0) {
                    entry.editedTimes = parseInt(cell);
                    continue;
                }
            }
            
            // Look for percentage format
            if (cell.endsWith('%')) {
                entry.editedPercentage = cell;
                continue;
            }
            
            // Assume a formatted date/time string
            if (moment(cell) instanceof moment || /\d{2}\/\d{2}\/\d{4}/.test(cell)) {
                entry.lastModifiedTime = Number(moment(cell).format('x')); // to timestamp
            }
        }
        
        return entry;
    }
}

// Class to represent data from new DocTracker objects
class NewData {
    filePath: string;
    lastModifiedTime: number;
    editedWords: number;
    editedTimes: number;
    editedPercentage: string;
    docLength: number;
    
    constructor(tracker: DocTracker) {
        this.filePath = tracker.filePath;
        this.lastModifiedTime = tracker.lastModifiedTime;
        this.editedWords = tracker.changedWords;
        this.editedTimes = tracker.changedTimes;
        this.docLength = tracker.docLength;
        this.editedPercentage = (100 * tracker.changedWords / tracker.docLength).toFixed(0) + '%';
    }
}

// Result of merging existing and new data
class MergedData {
    filePath: string;
    lastModifiedTime: number | string;
    editedWords: number;
    editedTimes: number;
    editedPercentage: string;
    docLength: number;
    isNew: boolean;
    
    constructor(newData?: NewData, existingData?: ExistingData) {
        if (newData) {
            this.filePath = newData.filePath;
            this.lastModifiedTime = newData.lastModifiedTime;
            this.editedWords = newData.editedWords;
            this.editedTimes = newData.editedTimes;
            this.docLength = newData.docLength;
            this.editedPercentage = newData.editedPercentage;
            this.isNew = true;
        } else if (existingData) {
            this.filePath = existingData.filePath;
            this.lastModifiedTime = existingData.lastModifiedTime? existingData.lastModifiedTime:'';
            this.editedWords = existingData.editedWords;
            this.editedTimes = existingData.editedTimes;
            this.docLength = 1; // Default value
            this.editedPercentage = existingData.editedPercentage;
            this.isNew = false;
        } else {
            throw new Error("MergedData requires either newData or existingData");
        }
    }
    
    // Merge existing data into this record
    mergeWith(existingData: ExistingData): void {
        // Add to accumulating fields
        this.editedWords += existingData.editedWords;
        this.editedTimes += existingData.editedTimes;
        
        // Recalculate percentage
        this.editedPercentage = (100 * this.editedWords / this.docLength).toFixed(0) + '%';
        
        // Keep other fields from new data (timestamp, etc.)
    }
}

