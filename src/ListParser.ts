import { DataRecorder, ExistingData, MergedData } from "./DataRecorder";
import moment from 'moment';

export class BulletListParser{
    private recordType: string;
    private timeFormat: string;
    private sortBy: string;
    private isDescend: boolean;
    private syntax: string;

    // special variables
    private patterns: any[] = [];
    private bulletListPatterns: any[] = [];
    private patternLineNum: number;

    constructor(
        private DataRecorder: DataRecorder,
    ){}

    public loadSettings(){
        this.timeFormat = this.DataRecorder.timeFormat;
        this.sortBy = this.DataRecorder.sortBy;
        this.isDescend = this.DataRecorder.isDescend;
        this.syntax = this.DataRecorder.listSyntax;
        this.setBulletListPatterns(); // has varName
        this.setPatterns(); // doesnot has varName
    }

    public async extractData(noteContent: string): Promise< Map<string, ExistingData> | null > {
        const lines = noteContent.split('\n');
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
                
                existingDataMap.set(ListData.filePath, ListData);
 
                // Skip to the end of this group to continue search
                i += this.patternLineNum - 1;
            }
        }

        return (existingDataMap.size > 0)? existingDataMap : null;
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
export class ListParser{
    private recordType: string;
    private timeFormat: string;
    private sortBy: string;
    private isDescend: boolean;
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
        this.sortBy = this.DataRecorder.sortBy;
        this.isDescend = this.DataRecorder.isDescend;
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