import WordflowTrackerPlugin, { RecorderConfig } from "./main";
import { DocTracker } from './DocTracker';
import { moment, Notice, TFile } from 'obsidian';
import { TableParser } from './TableParser';
import { BulletListParser, ListParser } from './ListParser';
import { MetaDataParser } from "./MetaDataParser";
import { error } from "console";

export class DataRecorder {
    public existingDataMap: Map<string, ExistingData> = new Map();
    private newDataMap: Map<string, NewData> = new Map();
    private enableDynamicFolder: boolean;
    private periodicNoteFolder: string;
    private periodicNoteFormat: string;
    public recordType: string;
    public timeFormat: string;
    public sortBy: string;
    public isDescend: boolean;
    public filterZero: boolean;
    public tableSyntax: string;
    public listSyntax: string;
    public metadataSyntax: string;
    public insertPlace: string;
    public insertPlaceStart: string;
    public insertPlaceEnd: string;

    // private classes
    private Parser: TableParser | BulletListParser | MetaDataParser;
    
    constructor(       
        private plugin: WordflowTrackerPlugin,
        private trackerMap: Map<string, DocTracker>, 
        private config?: RecorderConfig 
        //private tracker?: DocTracker,
    ){
        this.loadSettings();
    }

    public loadSettings(){
        if (!this.config){
        this.enableDynamicFolder = this.plugin.settings.enableDynamicFolder;
        this.periodicNoteFolder = this.plugin.settings.periodicNoteFolder;
        this.periodicNoteFormat = this.plugin.settings.periodicNoteFormat;
        this.recordType = this.plugin.settings.recordType;
        this.timeFormat = this.plugin.settings.timeFormat;
        this.sortBy = this.plugin.settings.sortBy;
        this.isDescend = this.plugin.settings.isDescend;
        this.filterZero = this.plugin.settings.filterZero;
        this.tableSyntax = this.plugin.settings.tableSyntax;
        this.listSyntax = this.plugin.settings.bulletListSyntax;
        this.metadataSyntax = this.plugin.settings.metadataSyntax;
        this.insertPlace = this.plugin.settings.insertPlace;
        this.insertPlaceStart = this.plugin.settings.insertPlaceStart;
        this.insertPlaceEnd = this.plugin.settings.insertPlaceEnd;
        } else {
            this.enableDynamicFolder = this.config.enableDynamicFolder;
            this.periodicNoteFolder = this.config.periodicNoteFolder;
            this.periodicNoteFormat = this.config.periodicNoteFormat;
            this.recordType = this.config.recordType;
            this.timeFormat = this.config.timeFormat;
            this.sortBy = this.config.sortBy;
            this.isDescend = this.config.isDescend;
            this.filterZero = this.config.filterZero;
            this.tableSyntax = this.config.tableSyntax;
            this.listSyntax = this.config.bulletListSyntax;
            this.metadataSyntax = this.config.metadataSyntax;
            this.insertPlace = this.config.insertPlace;
            this.insertPlaceStart = this.config.insertPlaceStart;
            this.insertPlaceEnd = this.config.insertPlaceEnd;
        }
        //new Notice(`Setting changed! Record type:${this.recordType}`, 3000)
        this.loadParsers();
    }

    private loadParsers(){
        switch (this.recordType){
        case 'table': 
            this.Parser = new TableParser(this, this.plugin);
            break;
        case 'bulletList': 
            this.Parser = new BulletListParser(this, this.plugin);
            break;
        case 'metadata':
            this.Parser = new MetaDataParser(this, this.plugin);
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
//console.log('Current Parser:',this.recordType)
        // Load existing data
        await this.loadExistingData(recordNote);
/*
this.existingDataMap.forEach((ExistingData)=>{
    console.log('existingData:', ExistingData.filePath, ' words:', ExistingData.editedWords)
})
*/
//console.log('try to Load Tracker of closed note:',tracker)
        // Load tracker data
        await this.loadTrackerData(tracker);
/*
this.newDataMap.forEach((NewData)=>{
    console.log('newData:', NewData.filePath, ' words:', NewData.editedWords)
})
*/
        // Merge data
        let mergedData: MergedData[];
        if (this.recordType != 'metadata'){
            mergedData = this.mergeData();
        } else {
            mergedData = this.mergeTotalData();
        }
//console.log('mergedData:',mergedData)
        // Generate and update content
        const newContent = this.Parser.generateContent(mergedData);
//console.log('newContent:',newContent)
        switch (this.insertPlace){
        case 'custom':
            await this.updateNoteToCustom(recordNote, newContent);
            break;
        case 'yaml':
            await this.updateNoteToYAML(recordNote, newContent);
            break
        default: // default insert to bottom if not found
            await this.updateNoteToBottom(recordNote, newContent);
            break;
        }
    }

    private async getOrCreateRecordNote(): Promise<TFile | null> {
        const recordNoteName = moment().format(this.periodicNoteFormat);
        const recordNoteFolder = (this.enableDynamicFolder)? moment().format(this.periodicNoteFolder): this.periodicNoteFolder;
        let recordNotePath = ((recordNoteFolder.trim() == '')||(recordNoteFolder.trim() == '/'))? '': recordNoteFolder+'/';
        recordNotePath += recordNoteName + '.md';
        let recordNote = this.plugin.app.vault.getFileByPath(recordNotePath);
//console.log('recordNotePath:',recordNotePath)
        if (!recordNote) {
            try {
                if (!this.plugin.app.vault.getFolderByPath(recordNoteFolder.trim())) {
                    try{
                        await this.plugin.app.vault.createFolder(recordNoteFolder.trim())
                        new Notice(`Periodic folder ${recordNoteFolder.trim()} doesn't exist!\n Auto created. `, 3000)
                    } catch (error) {
                        new Error(`Failed to create record note folder: ${error}`)
                        console.error("Failed to create record note folder:", error);
                        return null;
                    }
                }
                await this.plugin.app.vault.create(recordNotePath, '');
                // Wait for file creation to complete
                await new Promise(resolve => setTimeout(resolve, 2000));
                recordNote = this.plugin.app.vault.getFileByPath(recordNotePath);
                new Notice(`Periodic note ${recordNotePath} doesn't exist!\n Auto created under ${this.periodicNoteFolder}. `, 3000)
            } catch (error) {
                new Error(`Failed to create record note: ${error}`)
                console.error("Failed to create record note:", error);
                return null;
            }
        }
        
        return recordNote;
    }


    private async loadExistingData(recordNote: TFile): Promise<void> {  
        this.existingDataMap = await this.Parser.extractData(recordNote);
    }

    private async loadTrackerData(p_tracker?:DocTracker): Promise<void> {
        this.newDataMap.clear();
        if (!p_tracker){
            for (const [filePath, tracker] of this.trackerMap.entries()) {
                if (!this.filterZero || tracker.changedTimes!=0){
                this.newDataMap.set(filePath, new NewData(tracker));
                }
                tracker.resetEdit(); // deleted await for performance 
            }
        } else {
//console.log('trackerClosed:',p_tracker)
            if (!this.filterZero || p_tracker.changedTimes!=0){
            this.newDataMap.set(p_tracker.filePath, new NewData(p_tracker)); // only record given data
            }
//console.log('newDataMap:', this.newDataMap);
            p_tracker.resetEdit(); // deleted await for performance 
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
//console.log('mergedDataMap:',mergedDataMap)
        
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
    
    private mergeTotalData(): MergedData[] {
        const ExistingData = this.existingDataMap.get('|M|E|T|A|D|A|T|A|');
        const MergedTotalData = new MergedData();
        if (ExistingData){
        MergedTotalData.totalEdits = ExistingData.totalEdits;
        MergedTotalData.totalWords = ExistingData.totalWords;
        } else {
            MergedTotalData.totalEdits = 0;
            MergedTotalData.totalWords = 0;
        }
//console.log('Total Before merging:',[MergedTotalData])
        for (const [filePath, newData] of this.newDataMap.entries()) {
            MergedTotalData.totalEdits += newData.editedTimes;
            MergedTotalData.totalWords += newData.editedWords;
        }
//console.log('Total After merging:',[MergedTotalData])
        return [MergedTotalData];
    }


    private async updateNoteToBottom(recordNote: TFile, newContent: string): Promise<void> {
        const noteContent = await this.plugin.app.vault.read(recordNote);
        const lines = noteContent.split('\n');
        
        const existingContent: string | null = await this.Parser.getContent(recordNote);
                
        if (existingContent){
            await this.plugin.app.vault.process(recordNote, (data) => {
                return data.replace(existingContent, newContent.trimStart());
            });
        } else { // If no existing content of the right type found, append to the end of document
            const linebreaks = noteContent.endsWith('\n\n') ? '' : 
                               noteContent.endsWith('\n') ? '\n' : '\n\n';
            
            await this.plugin.app.vault.process(recordNote, (data) => {
                return data.concat( linebreaks + newContent);
            });
        }
    }

    private async updateNoteToCustom(recordNote: TFile, newContent: string): Promise<void> {
        const noteContent = await this.plugin.app.vault.read(recordNote);
        
        if ((this.insertPlaceStart == '') || (this.insertPlaceEnd == '')){
            throw Error (`Could not replace content without setting start place and end place!`);
        }

        const regex = new RegExp(`${this.insertPlaceStart}[\\s\\S]*?(?=${this.insertPlaceEnd})`);
        if (regex.test(noteContent)) {  
            await this.plugin.app.vault.process(recordNote, (data) => {
                // build regular expressions across lines but not greedy matching
                const regex = new RegExp(
                  `(${this.insertPlaceStart})(.*?)(${this.insertPlaceEnd})`, 
                  's' // dotAll mode
                );
            
                return data.replace(regex, `$1\n${newContent}\n$3`);
              });
        } else {
            new Error("⚠️ ERROR updating note: " + recordNote.path + "! Check console error.");
            console.error(`⚠️ ERROR: The given pattern "${this.insertPlaceStart} ... ${this.insertPlaceEnd}" is not found in ${recordNote.path}!`);
        }
    }

    private async updateNoteToYAML(recordNote: TFile, newContent: string): Promise<void> {
        const existingContent: string | null = await this.Parser.getContent(recordNote);
        const [YAMLStartIndex, YAMLEndIndex]: [number, number] = await this.Parser.getIndex(recordNote);
        
        if (existingContent){
//console.log('existingContent:',existingContent)
            await this.plugin.app.vault.process(recordNote, (data) => {
                return data.replace(existingContent, newContent.trim());
            });
        } else if(YAMLStartIndex != -1){ // no existing data in yaml
            await this.plugin.app.vault.process(recordNote, (data) => {
                const dataLines = data.split('\n');
                // Insert the new content before the closing '---' line
                dataLines.splice(YAMLEndIndex, 0, newContent.trimStart());
//console.log('datalines:',dataLines)
                return dataLines.join('\n');
            });
        } else { // no yaml, create one
            await this.plugin.app.vault.process(recordNote, (data) => {
                const yamlHeader = '---\n' + newContent.trim() + '\n---\n';
                return yamlHeader + data;
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
    totalWords: number;
    totalEdits: number;
    
    constructor() {
        this.lastModifiedTime = null;
        this.editedWords = 0;
        this.editedTimes = 0;
        this.editedPercentage = '0%';
    }
    
    // Parse a table row into an ExistingData object
    /*static fromTableRow(row: string): ExistingData | null {
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
            // change from moment to Obsidian packaged moment since 1.2.2, abandon 'moment(cell) instanceof moment', use 'moment.isMoment(cell)'
            if (moment.isMoment(cell) || /\d{2}\/\d{2}\/\d{4}/.test(cell)) {
                entry.lastModifiedTime = Number(moment(cell).format('x')); // to timestamp
            }
        }
        
        return entry;
    }*/
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
    totalWords: number;
    totalEdits: number;
    
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
            this.filePath = '|M|E|T|A|D|A|T|A|';
        }
    }
    
    // Merge existing data into this record
    public mergeWith(existingData: ExistingData): void {
        // Add to accumulating fields
        this.editedWords += existingData.editedWords;
        this.editedTimes += existingData.editedTimes;
        
        // Recalculate percentage
        this.editedPercentage = (100 * this.editedWords / this.docLength).toFixed(0) + '%';
        
        // Keep other fields from new data (timestamp, etc.)
    }
}

