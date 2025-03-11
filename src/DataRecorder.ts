import {WordflowSettings} from "./main";
import WordflowTrackerPlugin from "./main";
import { DocTracker } from './DocTracker';
import { Notice, TFile } from 'obsidian';
import moment from 'moment';
import { TableParser } from './TableParser';
import { BulletListParser, ListParser } from './ListParser';
import { error } from "console";

export class DataRecorder {
    public existingDataMap: Map<string, ExistingData> = new Map();
    private newDataMap: Map<string, NewData> = new Map();
    private periodicNoteFolder: string;
    private periodicNoteFormat: string;
    public recordType: string;
    public timeFormat: string;
    public sortBy: string;
    public isDescend: boolean;
    public tableSyntax: string;
    public listSyntax: string;
    // private classes
    private Parser: TableParser | BulletListParser;
    
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
        this.loadParsers();
    }

    private loadParsers(){
        switch (this.recordType){
        case 'table': 
            this.Parser = new TableParser(this);
            break;
        case 'bulletList': 
            this.Parser = new BulletListParser(this);
            break;
        default: 
            throw new Error('Record type is not defined in this recorder!')
        }

        this.Parser.loadSettings()
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
        const newContent = this.Parser.generateContent(mergedData);
        await this.updateNote(recordNote, newContent);
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


    private async loadExistingData(recordNote: TFile): Promise<void> {
        const noteContent = await this.plugin.app.vault.read(recordNote);
        
        this.existingDataMap = await this.Parser.extractData(noteContent);
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
    


    private async updateNote(recordNote: TFile, newContent: string): Promise<void> {
        const noteContent = await this.plugin.app.vault.read(recordNote);
        const lines = noteContent.split('\n');
        
        const existingContent: string | null = this.Parser.getContent(noteContent);
                
        if (existingContent){
            await this.plugin.app.vault.process(recordNote, (data) => {
                return data.replace(existingContent, newContent);
            });
        } else { // If no existing content of the right type found, append to the end of document
            const linebreaks = noteContent.endsWith('\n\n') ? '' : 
                               noteContent.endsWith('\n') ? '\n' : '\n\n';
            
            await this.plugin.app.vault.process(recordNote, (data) => {
                return data.concat( linebreaks + newContent);
            });
        }
    }

}

// Class to represent data from existing records
export class ExistingData {
    filePath: string;
    lastModifiedTime: number|null;
    editedWords: number;
    editedTimes: number;
    editedPercentage: string;
    
    constructor() {
        this.lastModifiedTime = null;
        this.editedWords = 0;
        this.editedTimes = 0;
        this.editedPercentage = '0%';
    }
    
    // Parse a table row into an ExistingData object
    static fromTableRow(row: string): ExistingData | null {
        const parts = row.split('|').map(part => part.trim()).filter(Boolean);
        if (parts.length < 1) return null;
        
        const entry = new ExistingData(); 
        entry.filePath = parts[0].replace(/^\[\[+|\]\]+$/g, ''); // require file path to be in the first column, and drop the '[[]]'.
        
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
export class NewData {
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
export class MergedData {
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

