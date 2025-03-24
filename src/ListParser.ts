import { DataRecorder, ExistingData, MergedData } from "./DataRecorder";
import { moment, Plugin, TFile } from 'obsidian';
import WordflowTrackerPlugin from "./main";

export class BulletListParser{
    //private recordType: string;
    private timeFormat: string;
    //private sortBy: string;
    //private isDescend: boolean;
    private syntax: string;
    private noteContent: string | null;

    // special variables
    private patterns: any[] = [];
    private bulletListPatterns: any[] = [];
    private patternLineNum: number;

    constructor(
        private DataRecorder: DataRecorder,
        private plugin: WordflowTrackerPlugin
    ){}

    public loadSettings(){
        this.timeFormat = this.DataRecorder.timeFormat;
        //this.sortBy = this.DataRecorder.sortBy;
        //this.isDescend = this.DataRecorder.isDescend;
        this.syntax = this.DataRecorder.listSyntax;
        this.setBulletListPatterns(); // has varName
        this.setPatterns(); // doesnot has varName
    }

    public async extractData(recordNote: TFile): Promise< Map<string, ExistingData> > {
        this.noteContent = await this.plugin.app.vault.read(recordNote);
        const lines = this.noteContent.split('\n');
        const existingDataMap: Map<string, ExistingData> = new Map();

        // Find list groups by matching patterns
        for (let i = 0; i < lines.length; i++) {
            let isGroupStart = true;
            let groupData: Record<string, string> = {};
            
            // Check if current line could be start of a list group
            for (let j = 0; j < this.patternLineNum; j++) {
                const pattern = this.bulletListPatterns[j];
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
                    
                    // Map variable names from template to property names in ListData
                    const varValue = currentLine.substring(startPos, endPos);
                    
                        groupData[pattern.varName] = varValue;
                    
                }
            }
            
            if (isGroupStart) {
                const ListData = new ExistingData();
                if (groupData.modifiedNote) {
                    ListData.filePath = groupData.modifiedNote;
                }

                // Parse editedWords
                if (groupData.editedWords !== undefined) {
                    ListData.editedWords = parseInt(groupData.editedWords) || 0;
                }
                
                // Parse editedTimes
                if (groupData.editedTimes !== undefined) {
                    ListData.editedTimes = parseInt(groupData.editedTimes) || 0;
                }

                // Parse 4 newly added words data
                if (groupData.addedWords !== undefined) {
                    ListData.addedWords = parseInt(groupData.addedWords) || 0;
                }

                if (groupData.deletedWords !== undefined) {
                    ListData.deletedWords = parseInt(groupData.deletedWords) || 0;
                }

                if (groupData.changedWords !== undefined) {
                    ListData.changedWords = parseInt(groupData.changedWords) || 0;
                }

                if (groupData.docWords !== undefined) {
                    ListData.docWords = parseInt(groupData.docWords) || 0;
                }
                
                // Parse lastModifiedTime if present
                if (groupData.lastModifiedTime !== undefined) {
                    try {
                        ListData.lastModifiedTime = moment(groupData.lastModifiedTime, this.timeFormat).valueOf();
                    } catch (e) {
                        ListData.lastModifiedTime = null;
                    }
                } else {
                    ListData.lastModifiedTime = null;
                }
                    
                // Parse percentage
                if (groupData.editedPercentage !== undefined) {
                    ListData.editedPercentage.fromNote(groupData.editedPercentage);
                }

                if (groupData.statBar !== undefined){
                    ListData.statBar.fromNote(groupData.statBar)
                }
                
                existingDataMap.set(ListData.filePath, ListData);
 
                // Skip to the end of this group to continue search
                i += this.patternLineNum - 1;
            }
        }

        return existingDataMap;
    }

    // get the starting index of the array, element of which records the line number and the line content of the noteContent
    public async getIndex(recordNote: TFile): Promise<[number, number]> {
        if(!this.noteContent) this.noteContent = await this.plugin.app.vault.read(recordNote);
        const lines = this.noteContent.split('\n');
        let startLine = -1;
        let endLine = -1;

        // Find list groups by matching patterns
        for (let i = 0; i < lines.length; i++) {
            let isGroupStart = true;
            
            // Check if current line could be start of a list group
            for (let j = 0; j < this.patternLineNum; j++) {
                const pattern = this.patterns[j];
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
                endLine = i + this.patternLineNum - 1;
                
                // Skip to the end of this group to continue search
                i = endLine;
            }
        }
        
        return (startLine !== -1 && endLine !== -1)? [startLine, endLine]: [-1, -1]; 
    }

    public async getContent(recordNote: TFile): Promise<string | null> {
        // Get list boundaries
        if(!this.noteContent) this.noteContent = await this.plugin.app.vault.read(recordNote);
        const [startIndex, endIndex] = await this.getIndex(recordNote);
        const lines = this.noteContent.split('\n');
            
        if (startIndex != -1 && endIndex != -1){
            const listContent = lines.slice(startIndex, endIndex + 1).join('\n');
            
            return listContent;
        } else {
            return null;
        }
    }

    public generateContent(mergedData: MergedData[]): string {
        // Implement bullet list generation
        let output = '\n';
                
        for (const data of mergedData) {
            let line = this.syntax
                .replace(/\${modifiedNote}/g, data.filePath)
                .replace(/\${lastModifiedTime}/g, typeof data.lastModifiedTime === 'number' 
                    ? moment(data.lastModifiedTime).format(this.timeFormat) 
                    : data.lastModifiedTime as string)
                .replace(/\${editedWords}/g, data.editedWords.toString())
                .replace(/\${editedTimes}/g, data.editedTimes.toString())
                .replace(/\${addedWords}/g, data.addedWords.toString())
                .replace(/\${deletedWords}/g, data.deletedWords.toString())
                .replace(/\${changedWords}/g, data.changedWords.toString())
                .replace(/\${docWords}/g, data.docWords.toString())
                .replace(/\${editedPercentage}/g, data.editedPercentage.toNote())
                .replace(/\${statBar}/g, data.statBar.toNote());
            
            output += (line.endsWith('\n'))? line : line + '\n';
        }
        
        return output.trim();
    }

    private setBulletListPatterns(){
        // Parse the list syntax to extract patterns
        const syntaxLines = this.syntax.split('\n');
        this.patternLineNum = syntaxLines.length;
        
        // Extract patterns from each line of syntax
        for (let i = 0; i < this.patternLineNum; i++) {
            const line = syntaxLines[i];
            const varStart = line.indexOf('${');
            
            if (varStart === -1) {
                this.bulletListPatterns.push({ start: line, end: '\n', varName: '' });
                continue;
            }
            
            const varEnd = line.indexOf('}', varStart);
            if (varEnd === -1) {
                this.bulletListPatterns.push({ start: line.substring(0, varStart), end: '\n', varName: '' });
                continue;
            }
            
            const varName = line.substring(varStart + 2, varEnd);
            this.bulletListPatterns.push({
                start: line.substring(0, varStart),
                end: line.substring(varEnd + 1),
                varName
            });
        }
    }

    private setPatterns(){
        // Parse the list syntax to extract patterns
        const syntaxLines = this.syntax.split('\n');
        this.patternLineNum = syntaxLines.length;

        // Extract patterns from each line of syntax
        for (let i = 0; i < this.patternLineNum; i++) {
            const line = syntaxLines[i];
            const varStart = line.indexOf('${');
            
            if (varStart === -1) {
                this.patterns.push({ start: line, end: '\n' });
                continue;
            }
            
            const varEnd = line.indexOf('}', varStart);
            if (varEnd === -1) {
                this.patterns.push({ start: line.substring(0, varStart), end: '\n' });
                continue;
            }
            
            this.patterns.push({
                start: line.substring(0, varStart),
                end: line.substring(varEnd + 1)
            });
        }
    }
};

// used for list data that belong to a single list group, not multiple list groups
/*
export class ListParser{
    //private recordType: string;
    private timeFormat: string;
    //private sortBy: string;
    //private isDescend: boolean;
    private syntax: string;

    // special variables
    private patterns: any[] = [];
    private listPatterns: any[] = [];
    private patternLineNum: number;

    constructor(
        private DataRecorder: DataRecorder,
    ){}

    public loadSettings(){
        this.timeFormat = this.DataRecorder.timeFormat;
        //this.sortBy = this.DataRecorder.sortBy;
        //this.isDescend = this.DataRecorder.isDescend;
        this.syntax = this.DataRecorder.listSyntax;
        this.setListPatterns(); // has varName
        this.setPatterns(); // doesnot has varName
    }

    public async extractData(noteContent: string): Promise< ExistingData | null > {
        const lines = noteContent.split('\n');

        // Find list groups by matching patterns
        for (let i = 0; i < lines.length; i++) {
            let isGroupStart = true;
            let groupData: Record<string, string> = {};
            
          // Check if current line could be start of a list group
            for (let j = 0; j < this.patternLineNum; j++) {
                const pattern = this.listPatterns[j];
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
                    
                    // Map variable names from template to property names in ListData
                    const varValue = currentLine.substring(startPos, endPos);
                    
                    groupData[pattern.varName] = varValue;
                    
                }
            }
            
            if (isGroupStart) {
                const ListData = new ExistingData();
                if (groupData.modifiedNote) {
                    ListData.filePath = groupData.modifiedNote;
                }

                // Parse editedWords
                if (groupData.editedWords !== undefined) {
                    ListData.editedWords = parseInt(groupData.editedWords) || 0;
                }
                
                // Parse editedTimes
                if (groupData.editedTimes !== undefined) {
                    ListData.editedTimes = parseInt(groupData.editedTimes) || 0;
                }
                
                // Parse lastModifiedTime if present
                if (groupData.lastModifiedTime !== undefined) {
                    try {
                        ListData.lastModifiedTime = Date.parse(groupData.lastModifiedTime);
                    } catch (e) {
                        ListData.lastModifiedTime = null;
                    }
                } else {
                    ListData.lastModifiedTime = null;
                }
                    
                // Calculate percentage
                ListData.editedPercentage = ListData.editedWords > 0 ? 
                    Math.floor((ListData.editedWords / 1) * 100) + '%' : '0%';
                
                return ListData;
                // Skip to the end of this group to continue search
                //i += this.patternLineNum - 1;
            }
        }

        // No list group is detected after iteration
        return null;
    }

    // get the starting index of the array, element of which records the line number and the line content of the noteContent
    public getIndex(noteContent: string): [number, number] {
        const lines = noteContent.split('\n');
        let startLine = -1;
        let endLine = -1;

        // Find list groups by matching patterns
        for (let i = 0; i < lines.length; i++) {
            let isGroupStart = true;
            
            // Check if current line could be start of a list group
            for (let j = 0; j < this.patternLineNum; j++) {
                const pattern = this.patterns[j];
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
                endLine = i + this.patternLineNum - 1;
                
                // Skip to the end of this group to continue search
                i = endLine;
            }
        }
        
        return (startLine !== -1 && endLine !== -1)? [startLine, endLine]: [-1, -1]; 
    }

    public generateContent(mergedData: MergedData[]): string {
        // Implement bullet list generation
        let output = '\n';
                
        for (const data of mergedData) {
            let line = this.syntax
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

    private setListPatterns(){
        // Parse the list syntax to extract patterns
        const syntaxLines = this.syntax.split('\n');
        this.patternLineNum = syntaxLines.length;
        
        // Extract patterns from each line of syntax
        for (let i = 0; i < this.patternLineNum; i++) {
            const line = syntaxLines[i];
            const varStart = line.indexOf('${');
            
            if (varStart === -1) {
                this.listPatterns.push({ start: line, end: '\n', varName: '' });
                continue;
            }
            
            const varEnd = line.indexOf('}', varStart);
            if (varEnd === -1) {
                this.listPatterns.push({ start: line.substring(0, varStart), end: '\n', varName: '' });
                continue;
            }
            
            const varName = line.substring(varStart + 2, varEnd);
            this.listPatterns.push({
                start: line.substring(0, varStart),
                end: line.substring(varEnd + 1),
                varName
            });
        }
    }

    private setPatterns(){
        // Parse the list syntax to extract patterns
        const syntaxLines = this.syntax.split('\n');
        this.patternLineNum = syntaxLines.length;

        // Extract patterns from each line of syntax
        for (let i = 0; i < this.patternLineNum; i++) {
            const line = syntaxLines[i];
            const varStart = line.indexOf('${');
            
            if (varStart === -1) {
                this.patterns.push({ start: line, end: '\n' });
                continue;
            }
            
            const varEnd = line.indexOf('}', varStart);
            if (varEnd === -1) {
                this.patterns.push({ start: line.substring(0, varStart), end: '\n' });
                continue;
            }
            
            this.patterns.push({
                start: line.substring(0, varStart),
                end: line.substring(varEnd + 1)
            });
        }
    }
};
*/