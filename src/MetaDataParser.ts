import { DataRecorder, ExistingData, MergedData } from "./DataRecorder";
import { moment } from 'obsidian';

export class MetaDataParser{
    //private recordType: string;
    private timeFormat: string;
    //private sortBy: string;
    //private isDescend: boolean;
    private syntax: string;

    // special variables
    private patterns: any[] = [];

    constructor(
        private DataRecorder: DataRecorder,
    ){}

    public loadSettings(){
        this.timeFormat = this.DataRecorder.timeFormat;
        //this.sortBy = this.DataRecorder.sortBy;
        //this.isDescend = this.DataRecorder.isDescend;
        this.syntax = this.DataRecorder.metadataSyntax;
    }

    public async extractData(noteContent: string): Promise< Map<string, ExistingData>> {
        const [startIndex, endIndex] = this.getIndex(noteContent);
        const lines = noteContent.split('\n');
        const existingDataMap: Map<string, ExistingData> = new Map();

        // Return empty map if no YAML block found
        if (startIndex === -1 || endIndex === -1) {
            return existingDataMap;
        }

        if (this.patterns.length === 0) {
            this.setPatterns();
        }

        let YAMLData: Record<string, string> = {};
        const YAMLLines = lines.slice(startIndex + 1, endIndex);

        for (const pattern of this.patterns) {
            // Extract the variable name from the pattern
            const syntaxLine = this.syntax.split('\n').find(line => 
                line.includes(pattern.start) && line.includes('${') && line.includes('}'));
            
            if (!syntaxLine) continue;
            
            const varStart = syntaxLine.indexOf('${') + 2;
            const varEnd = syntaxLine.indexOf('}', varStart);
            if (varStart <= 1 || varEnd <= varStart) continue;
            
            const varName = syntaxLine.substring(varStart, varEnd);
            
            // Check each YAML line for this pattern
            for (const line of YAMLLines) {
                if (line.trim().startsWith(pattern.start.trim())) {
                    // Extract value between pattern.start and pattern.end
                    const startPos = line.indexOf(pattern.start) + pattern.start.length;
                    let endPos = line.length;
                    
                    if (pattern.end && pattern.end.trim() !== '' && line.includes(pattern.end)) {
                        endPos = line.indexOf(pattern.end, startPos);
                    }
                    
                    const value = line.substring(startPos, endPos).trim();
                    YAMLData[varName] = value;
                    break; // Found match for this pattern, move to next
                }
            }
        }

        // If no data was found, return empty map
        if (Object.keys(YAMLData).length === 0) {
            return existingDataMap;
        }

        const extractedData = new ExistingData();
        // Parse varNames
        if (YAMLData.totalWords !== undefined) {
            extractedData.totalWords = parseInt(YAMLData.totalWords) || 0;
        }
        if (YAMLData.totalEdits !== undefined) {
            extractedData.totalEdits = parseInt(YAMLData.totalEdits) || 0;
        }
        // unique string as key to fetch existing data
        existingDataMap.set('|M|E|T|A|D|A|T|A|', extractedData);
        return existingDataMap;
    }

    // get the starting index of the array, element of which records the line number and the line content of the noteContent
    public getIndex(noteContent: string): [number, number] {
        const lines = noteContent.split('\n');
        let startLine = -1;
        let endLine = -1;

        // Check if YAML exists
        if (lines[0].startsWith('---')){
            startLine = 0;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].startsWith('---')) {
                    endLine = i;
                    return [startLine, endLine];
                }
            }
            if (endLine == -1) {throw Error ('YAML end line is not found, though found the start line!');}
        } 
           
        return [-1, -1];
    }

    public getContent(noteContent: string): string | null {
        const [startIndex, endIndex] = this.getIndex(noteContent);
        const lines = noteContent.split('\n');
        
        // Return null if no YAML block found
        if (startIndex === -1 || endIndex === -1) {
            return null;
        }
        
        // Make sure patterns are set
        if (this.patterns.length === 0) {
            this.setPatterns();
        }
        
        // Extract YAML lines (excluding the --- markers)
        const yamlLines = lines.slice(startIndex + 1, endIndex);
        
        let firstVarLine = -1;
        let lastVarLine = -1;
        
        // Find the line numbers of the first and last variable patterns
        for (let i = 0; i < yamlLines.length; i++) {
            const line = yamlLines[i];
            
            // Check if line matches any of our patterns
            for (const pattern of this.patterns) {
                if (line.trim().startsWith(pattern.start.trim())) {
                    // Found a matching line
                    if (firstVarLine === -1) {
                        firstVarLine = i;
                    }
                    lastVarLine = i;
                }
            }
        }
        
        // If no variable patterns found, return null
        if (firstVarLine === -1 || lastVarLine === -1) {
            return null;
        }
        
        // Extract the content between firstVarLine and lastVarLine (inclusive)
        const extractedLines = yamlLines.slice(firstVarLine, lastVarLine + 1);
        return extractedLines.join('\n');
    }
        
    public generateContent(mergedData: MergedData[]): string {
        // Implement metadata generation
        let output = '';
                
        for (const data of mergedData) {
            let line = this.syntax
                .replace(/\${totalEdits}/g, data.totalEdits.toString())
                .replace(/\${totalWords}/g, data.totalWords.toString())
            
            output += line + '\n';
        }
        
        return output;
    }

    private setPatterns(){
        // Parse the metadata syntax to extract patterns
        const syntaxLines = this.syntax.split('\n');


        // Extract patterns from each line of syntax
        for (let i = 0; i < syntaxLines.length; i++) {
            const line = syntaxLines[i];
            if ((!(line.contains('${') && 
                   line.contains('}'))
                ) && 
                (line.trim() != '')  
                ) throw Error(`Invaid metadata syntax! Ensure each line contains the \${} !`); 
            
            const varStart = line.indexOf('${');
            
            const varEnd = line.indexOf('}', varStart);
            
            this.patterns.push({
                start: line.substring(0, varStart),
                end: line.substring(varEnd + 1)
            });
        }
    }
};