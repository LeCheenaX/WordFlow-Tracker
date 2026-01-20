import { DataRecorder, ExistingData, MergedData } from "./DataRecorder";
import { formatTime, restoreTimeString } from "./Timer";
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

    public getSyntax(): Readonly<string> {
        return this.syntax;
    }

    public async extractData(recordNote: TFile): Promise< Map<string, ExistingData>> {
        const existingDataMap: Map<string, ExistingData> = new Map();

        // Use Obsidian's metadataCache to get frontmatter directly
        const frontmatter = this.plugin.app.metadataCache.getFileCache(recordNote)?.frontmatter;
        
        if (!frontmatter) {
            return existingDataMap;
        }

        if (this.patterns.length === 0) {
            this.setPatterns();
        }

        let YAMLData: Record<string, string|undefined> = {};
        
        // Parse syntax to fetch varName and user customized name for varName variable
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

            const customName = syntaxLine.trim().substring(0,syntaxLine.indexOf(':')); // user customized name for ${varName}
            
            // Use frontmatter directly from metadataCache
            if (frontmatter[customName] !== undefined){
                YAMLData[varName] = String(frontmatter[customName]);
            } else {
                YAMLData[varName] = undefined;
            }
        }

        // If no data was found, return empty map
        if (Object.keys(YAMLData).filter(key => YAMLData[key] !== undefined).length === 0) {
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
        if (YAMLData.totalReadTime !== undefined) {
            extractedData.totalReadTime = restoreTimeString(YAMLData.totalReadTime) || 0;
        }
        if (YAMLData.totalTime !== undefined) {
            extractedData.totalTime = restoreTimeString(YAMLData.totalTime) || 0;
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
        // Use Obsidian's metadataCache instead of manual parsing
        const frontmatter = this.plugin.app.metadataCache.getFileCache(recordNote)?.frontmatter;
        
        if (!frontmatter) {
            return null;
        }

        if (this.patterns.length === 0) {
            this.setPatterns();
        }

        const matchedLines: string[] = [];
        
        // Generate content based on current frontmatter and our patterns
        for (const pattern of this.patterns) {
            const syntaxLine = this.syntax.split('\n').find(line => 
                line.includes(pattern.start) && line.includes('${') && line.includes('}'));
            
            if (!syntaxLine) continue;
            
            const customName = syntaxLine.trim().substring(0, syntaxLine.indexOf(':'));
            
            if (frontmatter[customName] !== undefined) {
                matchedLines.push(`${customName}: ${frontmatter[customName]}`);
            }
        }
        
        return matchedLines.length > 0 ? matchedLines.join('\n') : null;
    }
        
    public generateContent(mergedData: MergedData[]): string {
        // Implement metadata generation
        let output = '';
                
        for (const data of mergedData) {
            let line = this.syntax
                .replace(/\${totalEdits}/g, data.totalEdits.toString())
                .replace(/\${totalWords}/g, data.totalWords.toString())
                .replace(/\${totalEditTime}/g, formatTime(data.totalEditTime))
                .replace(/\${totalReadTime}/g, formatTime(data.totalReadTime))
                .replace(/\${totalTime}/g, formatTime(data.totalTime));
            
            output += line + '\n';
        }
        
        return output;
    }

    private setPatterns(){
        // Parse the metadata syntax to extract patterns
        const syntaxLines = this.syntax.split('\n');

        // Clear existing patterns
        this.patterns = [];

        // Extract patterns from each line of syntax
        for (let i = 0; i < syntaxLines.length; i++) {
            const line = syntaxLines[i];
            if ((!(line.includes('${') && 
                   line.includes('}'))
                ) && 
                (line.trim() != '')  
                ) throw Error(`Invalid metadata syntax! Ensure each line contains the \${} !`); 
            
            if (line.trim() === '') continue;
            
            const varStart = line.indexOf('${');
            const varEnd = line.indexOf('}', varStart);
            
            this.patterns.push({
                start: line.substring(0, varStart),
                end: line.substring(varEnd + 1)
            });
        }
    }
};