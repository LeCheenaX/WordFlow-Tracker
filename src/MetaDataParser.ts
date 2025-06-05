import { DataRecorder, ExistingData, MergedData } from "./DataRecorder";
import { formatTime, restoreTimeString } from "./EditTimer";
import { MetadataCache, moment, TFile } from 'obsidian';
import WordflowTrackerPlugin from "./main";

export class MetaDataParser{
    //private recordType: string;
    private timeFormat: string;
    //private sortBy: string;
    //private isDescend: boolean;
    private syntax: string;
    //private noteContent: string | null;

    // special variables
    private patterns: any[] = [];

    constructor(
        private DataRecorder: DataRecorder,
        private plugin: WordflowTrackerPlugin
    ){}

    public loadSettings(){
        this.timeFormat = this.DataRecorder.timeFormat;
        //this.sortBy = this.DataRecorder.sortBy;
        //this.isDescend = this.DataRecorder.isDescend;
        this.syntax = this.DataRecorder.metadataSyntax;
    }

    public async extractData(recordNote: TFile): Promise< Map<string, ExistingData>> {
        const [startIndex, endIndex] = await this.getIndex(recordNote);
        const existingDataMap: Map<string, ExistingData> = new Map();

        // Return empty map if no YAML block found
        if (startIndex === -1 || endIndex === -1) {
            return existingDataMap;
        }

        if (this.patterns.length === 0) {
            this.setPatterns();
        }

        let YAMLData: Record<string, string|undefined> = {};
        // parse syntax to fetch varName and user customized name for varName variable. Then, read and record user customized name in frontmatter 
        for (const pattern of this.patterns) {
            // Extract the variable name from the pattern
            const syntaxLine = this.syntax.split('\n').find(line => 
                line.includes(pattern.start) && line.includes('${') && line.includes('}'));
            
            if (!syntaxLine) continue;
            
            const varStart = syntaxLine.indexOf('${') + 2;
            const varEnd = syntaxLine.indexOf('}', varStart);
            if (varStart <= 1 || varEnd <= varStart) continue;
            
            const varName = syntaxLine.substring(varStart, varEnd);
            if(!varName) continue;

            const customName = syntaxLine.trim().substring(0,syntaxLine.indexOf(':')); // user customized name for ${varName}, for example: 'Total Edits' is the custom name for '${totalEdits} as specified in default settings'
//console.log(`found ${varName}: ${this.plugin.app.metadataCache.getFileCache(recordNote)?.frontmatter?.[customName]}`)
            if (this.plugin.app.metadataCache.getFileCache(recordNote)?.frontmatter?.[customName]){
                YAMLData[varName] = this.plugin.app.metadataCache.getFileCache(recordNote)?.frontmatter?.[customName]
            } else {
                YAMLData[varName] = undefined;
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
        if (YAMLData.totalEditTime !== undefined) {
            extractedData.totalEditTime = restoreTimeString(YAMLData.totalEditTime) || 0;
        }
        // unique string as key to fetch existing data
        existingDataMap.set('|M|E|T|A|D|A|T|A|', extractedData);
        return existingDataMap;
    }

    // get the starting index of the array, element of which records the line number and the line content of the noteContent
    public async getIndex(recordNote: TFile): Promise<[number, number]> {
        const frontmatterPos = this.plugin.app.metadataCache.getFileCache(recordNote)?.frontmatterPosition

        // Check if YAML exists
        if (frontmatterPos) {
            return [frontmatterPos.start.line, frontmatterPos.end.line]
        }
           
        return [-1, -1];
    }

    public async getContent(recordNote: TFile): Promise<string | null> {
        const noteContent = await this.plugin.app.vault.read(recordNote);
        const [startIndex, endIndex] = await this.getIndex(recordNote);
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
                .replace(/\${totalEditTime}/g, formatTime(data.totalEditTime));
            
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