import WordflowTrackerPlugin, { RecorderConfig } from "./main";
import { DocTracker } from './DocTracker';
import { moment, Notice, TFile } from 'obsidian';
import { TableParser } from './TableParser';
import { BulletListParser } from './ListParser';
import { MetaDataParser } from "./MetaDataParser";

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
            new Notice('❌Record type is not defined in this recorder!', 0);
            throw new Error('❌Record type is not defined in this recorder!');
        }

        this.Parser.loadSettings()
    }

    public async record(tracker?:DocTracker): Promise<void> {
        //console.log('try to Load Tracker of closed note:',tracker)
        // Load tracker data
        await this.loadTrackerData(tracker);
//this.backUpData();
/*
this.newDataMap.forEach((NewData)=>{
    console.log('newData:', NewData.filePath, ' words:', NewData.editedWords)
})
*/
        if (this.newDataMap.size == 0) return;
        // Get the target note file
        const recordNote = await this.getOrCreateRecordNote();
        if (!recordNote) {
            new Notice ("⚠️ Failed to get or create record note!\nData backed up to console!", 0);
            console.error("⚠️ Failed to get or create record note");
            await this.backUpData();
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
        const isRootFolder: boolean = (recordNoteFolder.trim() == '')||(recordNoteFolder.trim() == '/');
        let recordNotePath = (isRootFolder)? '': recordNoteFolder+'/';
        recordNotePath += recordNoteName + '.md';
        let recordNote = this.plugin.app.vault.getFileByPath(recordNotePath);
//console.log('recordNotePath:',recordNotePath)
        if (!recordNote) {
            try {
                if (!isRootFolder && !this.plugin.app.vault.getFolderByPath(recordNoteFolder.trim())) {
                    try{
                        await this.plugin.app.vault.createFolder(recordNoteFolder.trim())
                        new Notice(`Periodic folder ${recordNoteFolder.trim()} doesn't exist!\n Auto created. `, 3000)
                    } catch (error) {
                        new Notice(`⚠️ Failed to create record note folder: ${error}\nData backed up to console!`, 0);
                        console.error("⚠️ Failed to create record note folder:", error);
                        await this.backUpData();
                        return null;
                    }
                }
                await this.plugin.app.vault.create(recordNotePath, '');
                // Wait for file creation to complete
                await new Promise(resolve => setTimeout(resolve, 2000));
                recordNote = this.plugin.app.vault.getFileByPath(recordNotePath);
                new Notice(`Periodic note ${recordNotePath} doesn't exist!\n Auto created under ${this.periodicNoteFolder}. `, 3000)
            } catch (error) {
                new Notice(`❌ Failed to create record note: ${error}\nData backed up to console!`, 0)
                console.error("❌ Failed to create record note:", error);
                await this.backUpData();
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
                if (!this.filterZero || tracker.editedTimes!=0){
                await tracker.countActiveWords(); // generate accurate words for NewData by the time of recording
                this.newDataMap.set(filePath, new NewData(tracker));
                }
                tracker.resetEdit(); // deleted await for performance 
            }
        } else {
//console.log('trackerClosed:',p_tracker)
            if (!this.filterZero || p_tracker.editedTimes!=0){
                // no active editor now
                await p_tracker.countInactiveWords(); // generate accurate words for NewData by the time of recording
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
                    aVal = a.editedPercentage.percentage;
                    bVal = b.editedPercentage.percentage;
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

    private async backUpData(): Promise<void>
    {
        const recorderName: string = (this.config)? this.config.name: this.plugin.settings.name;
        if (!this.newDataMap.size)
            console.log(`${recorderName}.backUpData: No data need to back up.`);
        else {
            console.groupCollapsed(`${recorderName}.backUpData: `);
            console.log('The following data is not recorded due to errors in the console. You can manually update these data to periodic notes.')
            this.newDataMap.forEach((NewData, key) => {
                console.log(
                    `File: ${NewData.filePath}`,
                    NewData 
                );
            });
            console.groupEnd(); 
        }
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
            await this.backUpData();
            new Notice(`❌ Could not replace content without setting start place and end place!\nData backed up to console!`, 0);
            throw new Error (`❌ Could not replace content without setting start place and end place!`);
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
            new Notice("⚠️ ERROR updating note: " + recordNote.path + "! Please check console error.\n" + "Data backed up to console!", 0);
            console.error(`⚠️ ERROR: The given pattern "${this.insertPlaceStart} ... ${this.insertPlaceEnd}" is not found in ${recordNote.path}!`);
            await this.backUpData();
        }
    }

    private async updateNoteToYAML(recordNote: TFile, newContent: string): Promise<void> {
        const existingContent: string | null = await this.Parser.getContent(recordNote);
        const [YAMLStartIndex, YAMLEndIndex]: [number, number] = await this.Parser.getIndex(recordNote);
        
        if (existingContent){
//console.log('existingContent:',existingContent)
            await this.plugin.app.vault.process(recordNote, (data) => {
                return data.replace(existingContent, newContent.trimStart()); // do not trim end to allow empty comment
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
    fileName: string;
    lastModifiedTime: number|null;
    editedWords: number;
    editedTimes: number;
    addedWords: number;
    deletedWords: number;
    changedWords: number;
    docWords: number;
    editedPercentage: EditedPercentage
    statBar: StatBar;
    comment: string;
    totalWords: number;
    totalEdits: number;
    
    constructor() {
        this.fileName = 'unknown';
        this.lastModifiedTime = null;
        this.editedWords = 0;
        this.editedTimes = 0;
        this.addedWords = 0;
        this.deletedWords = 0;
        this.changedWords = 0;
        this.docWords = 0;
        this.editedPercentage = new EditedPercentage();
        this.statBar = new StatBar();
        this.comment = '';
        this.totalWords = 0;
        this.totalEdits = 0;
    }
}

// Class to represent data from new DocTracker objects
export class NewData {
    filePath: string;
    fileName: string;
    lastModifiedTime: number;
    editedWords: number;
    editedTimes: number;
    addedWords: number;
    deletedWords: number;
    changedWords: number;
    docWords: number;
    originalWords: number;
    editedPercentage: EditedPercentage
    statBar: StatBar;
    comment: string;
    
    constructor(tracker: DocTracker) {
        this.filePath = tracker.filePath;
        this.fileName = tracker.fileName;
        this.lastModifiedTime = tracker.lastModifiedTime;
        this.editedWords = tracker.editedWords;
        this.editedTimes = tracker.editedTimes;
        this.addedWords = tracker.addedWords;
        this.deletedWords = tracker.deletedWords;
        this.changedWords = tracker.changedWords;
        this.docWords = tracker.docWords;
        this.originalWords = tracker.originalWords;
        this.editedPercentage = new EditedPercentage();
        this.editedPercentage.fromTracker(tracker);
        this.statBar = new StatBar();
        this.statBar.fromTracker(tracker);
    }
}

// Result of merging existing and new data
export class MergedData {
    filePath: string;
    fileName: string;
    lastModifiedTime: number | string;
    editedWords: number;
    editedTimes: number;
    addedWords: number;
    deletedWords: number;
    changedWords: number;
    editedPercentage: EditedPercentage;
    statBar: StatBar;
    comment: string;
    docWords: number;
    isNew: boolean;
    totalWords: number;
    totalEdits: number;
    
    constructor(newData?: NewData, existingData?: ExistingData) {
        if (newData) {
            this.filePath = newData.filePath;
            this.fileName = newData.fileName;
            this.lastModifiedTime = newData.lastModifiedTime;
            this.editedWords = newData.editedWords;
            this.editedTimes = newData.editedTimes;
            this.addedWords = newData.addedWords;
            this.deletedWords = newData.deletedWords;
            this.changedWords = newData.changedWords;
            this.docWords = newData.docWords;
            this.editedPercentage = newData.editedPercentage;
            this.statBar = newData.statBar;
            this.comment = '';
            this.isNew = true;
        } else if (existingData) {
            this.filePath = existingData.filePath;
            this.fileName = existingData.fileName;
            this.lastModifiedTime = existingData.lastModifiedTime? existingData.lastModifiedTime:'';
            this.editedWords = existingData.editedWords;
            this.editedTimes = existingData.editedTimes;
            this.addedWords = existingData.addedWords;
            this.deletedWords = existingData.deletedWords;
            this.changedWords = existingData.changedWords;
            this.docWords = existingData.docWords; 
            this.editedPercentage = existingData.editedPercentage;
            this.statBar = existingData.statBar;
            this.comment = existingData.comment?? ''; 
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
        this.addedWords += existingData.addedWords;
        this.deletedWords += existingData.deletedWords;
        this.changedWords += existingData.changedWords;
        
        // Let existing data outweighs the new data
        this.editedPercentage.setEdits(
            existingData.editedPercentage.originalWords, 
            this.deletedWords, 
            this.addedWords
        )

        this.statBar.setEdits(
            existingData.statBar.originalWords, 
            this.deletedWords, 
            this.addedWords
        )

        this.comment = existingData.comment?? '';

//console.log('newDocWords:', this.docWords)
//console.log('newPercentage:',this.editedPercentage.percentage, '%')
        
        // Leave blank to let new data outweighs the unspecified properties (lastModifiedTime, docWords, etc.)
    }
}

class EditedPercentage{
    originalWords: number;
    deletedWords: number;
    addedWords: number;
    percentage: number;

    public fromNote(editedPercentage: string): boolean{
        const elemRegex = /<span class="edited-percentage"[^>]*?><\/span>/gi;
  
        let elemMatch;
        if ((elemMatch = elemRegex.exec(editedPercentage)) !== null) {
            const elem = elemMatch[0];
            
            // extract Data, ignoring uppercase
            this.percentage = parseInt(elem.match(/data-percentage="([^"]*)"/i)?.[1] || "0");
            this.originalWords = parseInt(elem.match(/data-originWords="([^"]*)"/i)?.[1] || "0");
            this.deletedWords = parseInt(elem.match(/data-delWords="([^"]*)"/i)?.[1] || "0");
            this.addedWords = parseInt(elem.match(/data-addWords="([^"]*)"/i)?.[1] || "0");

            return true;
        }

        return false;
    }

    public fromTracker(tracker: DocTracker){
        this.originalWords = tracker.originalWords;
        this.deletedWords = tracker.deletedWords;
        this.addedWords = tracker.addedWords;
        this.calcPercentage();
    }

    // override current values with given values, and recalculate percentage. 
    public setEdits(originalWords: number, deletedWords: number, addedWords: number){
        this.originalWords = originalWords;
        this.deletedWords = deletedWords;
        this.addedWords = addedWords;
        this.calcPercentage();
    }

    public toNote(): string{
        return `<span class="edited-percentage" data-percentage="${this.percentage}" data-originWords="${this.originalWords}" data-delWords="${this.deletedWords}" data-addWords="${this.addedWords}"></span>`
    }

    private calcPercentage(){
        this.percentage = 
            (this.addedWords + this.deletedWords) 
            /(this.originalWords + this.addedWords + this.deletedWords)
            *100;
        this.percentage = Math.floor(this.percentage);
    }
}

class StatBar{
    originalWords: number;
    deletedWords: number;
    addedWords: number;
    originPortion: number;
    delPortion: number;
    addPortion: number;

    public fromNote(statBar: string): boolean{
        const elemRegex = /<span class="stat-bar-container"[^>]*?>/i;
    
        const elemMatch = elemRegex.exec(statBar);
        if (elemMatch) {
            const elem = elemMatch[0];
            
            this.originalWords = parseInt(elem.match(/data-origin-words="([^"]*)"/i)?.[1] || "0");
            this.deletedWords = parseInt(elem.match(/data-deleted-words="([^"]*)"/i)?.[1] || "0");
            this.addedWords = parseInt(elem.match(/data-added-words="([^"]*)"/i)?.[1] || "0");
            
            const originWidthMatch = statBar.match(/class="stat-bar origin"[^>]*?width:\s*(\d+)%/i);
            const deletedWidthMatch = statBar.match(/class="stat-bar deleted"[^>]*?width:\s*(\d+)%/i);
            const addedWidthMatch = statBar.match(/class="stat-bar added"[^>]*?width:\s*(\d+)%/i);
            
            this.originPortion = originWidthMatch ? parseInt(originWidthMatch[1]) : 0;
            this.delPortion = deletedWidthMatch ? parseInt(deletedWidthMatch[1]) : 0;
            this.addPortion = addedWidthMatch ? parseInt(addedWidthMatch[1]) : 0;
            
            return true;
        }
        
        return false;
    }

    public fromTracker(tracker: DocTracker){
        this.originalWords = tracker.originalWords;
        this.deletedWords = tracker.deletedWords;
        this.addedWords = tracker.addedWords;
        this.calcPortions();
    }

    // override current values with given values, and recalculate portions. 
    public setEdits(originalWords: number, deletedWords: number, addedWords: number){
        this.originalWords = originalWords;
        this.deletedWords = deletedWords;
        this.addedWords = addedWords;
        this.calcPortions();
    }

    public toNote(): string{
        return `<span class="stat-bar-container" data-origin-words="${this.originalWords}" data-deleted-words="${this.deletedWords}" data-added-words="${this.addedWords}"><span class="stat-bar origin" style="width: ${this.originPortion}%"></span><span class="stat-bar deleted" style="width: ${this.delPortion}%"></span><span class="stat-bar added" style="width: ${this.addPortion}%"></span></span>`
    }

    private calcPortions(){
        this.originPortion = 
            (this.originalWords) 
            /(this.originalWords + this.addedWords + this.deletedWords)
            *100;
        this.originPortion = Math.floor(this.originPortion);

        this.delPortion = 
            (this.deletedWords)
            /(this.originalWords + this.addedWords + this.deletedWords)
            *100;
        this.delPortion = Math.floor(this.delPortion);

        this.addPortion = 100 - this.delPortion - this.originPortion
    }
}