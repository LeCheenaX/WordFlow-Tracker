import {WordflowSettings} from "./main";
import WordflowTrackerPlugin from "./main";
import { DocTracker } from './DocTracker';
import { TFile } from 'obsidian';
import moment from 'moment';

// Class to represent data from existing records
class ExistingData {
    filePath: string;
    lastModifiedTime: string;
    editedWords: number;
    editedTimes: number;
    editedPercentage: string;
    
    constructor(filePath: string) {
        this.filePath = filePath;
        this.lastModifiedTime = '';
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
            if (cell.includes(':') || /\d{2}\/\d{2}\/\d{4}/.test(cell)) {
                entry.lastModifiedTime = cell;
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
            this.lastModifiedTime = existingData.lastModifiedTime;
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
    private bulletListSyntax: string;
    
    constructor(       
        private plugin: WordflowTrackerPlugin,
        private trackerMap: Map<string, DocTracker>, 
        //private tracker?: DocTracker,
    ){
        this.loadSettings();
    }

    private loadSettings(){
        this.periodicNoteFolder = this.plugin.settings.periodicNoteFolder;
        this.periodicNoteFormat = this.plugin.settings.periodicNoteFormat;
        this.recordType = this.plugin.settings.recordType;
        this.timeFormat = this.plugin.settings.timeFormat;
        this.sortBy = this.plugin.settings.sortBy;
        this.isDescend = this.plugin.settings.isDescend;
        this.tableSyntax = this.plugin.settings.tableSyntax;
        this.bulletListSyntax = this.plugin.settings.bulletListSyntax;
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
            } catch (error) {
                console.error("Failed to create record note:", error);
                return null;
            }
        }
        
        return recordNote;
    }

    private async loadExistingData(recordNote: TFile): Promise<void> {
        this.existingDataMap.clear();
        
        const noteContent = await this.plugin.app.vault.read(recordNote);
        
        if (this.recordType === 'table') {
            const [header, separator] = this.tableSyntax
                .split('\n')
                .filter(l => l.trim())
                .slice(0, 2);
                
            if (!header || !separator) {
                console.warn("Invalid table syntax");
                return;
            }
            
            // Check if table exists in the document
            if (noteContent.includes(header) && noteContent.includes(separator)) {
                // Find and extract the table
                const headerIndex = noteContent.indexOf(header);
                const separatorIndex = noteContent.indexOf(separator, headerIndex);
                const afterSeparatorIndex = separatorIndex + separator.length;
                
                // Find the end of the table
                const afterSeparator = noteContent.slice(afterSeparatorIndex);
                const nextBlankLineIndex = afterSeparator.search(/\n\s*\n/);
                const tableEndIndex = nextBlankLineIndex === -1 
                    ? noteContent.length 
                    : afterSeparatorIndex + nextBlankLineIndex;
                
                // Extract existing rows
                const tableContent = noteContent.slice(headerIndex, tableEndIndex);
                const tableRows = tableContent.split('\n').filter(line => line.trim());
                
                // Process data rows (skip header and separator)
                const dataRows = tableRows.slice(2);
                
                // Parse each row into an ExistingData object
                for (const row of dataRows) {
                    const parsedData = ExistingData.fromTableRow(row);
                    if (parsedData) {
                        this.existingDataMap.set(parsedData.filePath, parsedData);
                    }
                }
            }
        } else if (this.recordType === 'bulletList') {
            // Implement bullet list parsing if needed
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
        if (this.recordType === 'bulletList') {
            // Implement bullet list generation
            return this.generateBulletList(mergedData);
        } else {
            // Default: table format
            return this.generateTable(mergedData);
        }
    }
    
    private generateBulletList(mergedData: MergedData[]): string {
        let output = '\n';
        
        for (const data of mergedData) {
            let line = this.bulletListSyntax
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
        
        if (this.recordType === 'table') {
            const [header, separator] = this.tableSyntax
                .split('\n')
                .filter(l => l.trim())
                .slice(0, 2);
                
            if (header && separator && noteContent.includes(header) && noteContent.includes(separator)) {
                // Replace existing table
                const headerIndex = noteContent.indexOf(header);
                const separatorIndex = noteContent.indexOf(separator, headerIndex);
                const afterSeparatorIndex = separatorIndex + separator.length;
                
                // Find end of table
                const afterSeparator = noteContent.slice(afterSeparatorIndex);
                const nextBlankLineIndex = afterSeparator.search(/\n\s*\n/);
                const tableEndIndex = nextBlankLineIndex === -1 
                    ? noteContent.length 
                    : afterSeparatorIndex + nextBlankLineIndex;
                
                const beforeTable = noteContent.slice(0, headerIndex);
                const afterTable = noteContent.slice(tableEndIndex);
                
                let updatedContent;
                // Check if beforeTable ends with a newline
                if (beforeTable.endsWith('\n')) {
                    updatedContent = beforeTable + newContent + afterTable;
                } else {
                    updatedContent = beforeTable + '\n' + newContent + afterTable;
                }
                
                await this.plugin.app.vault.modify(recordNote, updatedContent);
                return;
            }
        }
        
        // If no existing table found, append to the document
        await this.plugin.app.vault.modify(recordNote, noteContent + newContent);
    }
}
