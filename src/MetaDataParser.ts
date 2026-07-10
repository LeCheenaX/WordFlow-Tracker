import { DataRecorder, ExistingData, MergedData } from "./DataRecorder";
import { formatTime, restoreTimeString } from "./Timer";
import { moment, TFile } from 'obsidian';
import WordflowTrackerPlugin from "./main";

interface MetadataPattern {
    start: string;
    end: string;
}

export class MetaDataParser{
    //private recordType: string;
    private timeFormat: string;
    //private sortBy: string;
    //private isDescend: boolean;
    private syntax: string;
    //private noteContent: string | null;

    // special variables
    private patterns: MetadataPattern[] = [];

    constructor(
        private DataRecorder: DataRecorder,
        private plugin: WordflowTrackerPlugin
    ){}

    public loadSettings(){
        this.timeFormat = this.DataRecorder.timeFormatInNote;
        //this.sortBy = this.DataRecorder.sortBy;
        //this.isDescend = this.DataRecorder.isDescend;
        this.syntax = this.DataRecorder.metadataSyntax;
    }

    public getSyntax(): Readonly<string> {
        return this.syntax;
    }

    // Temporarily update syntax without calling loadSettings
    public updateSyntax(newSyntax: string): void {
        this.syntax = newSyntax;
        this.patterns = []; // Clear patterns so they'll be regenerated
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
        extractedData.filePath = this.DataRecorder.isPeriodicNoteRecorder() ? '|M|E|T|A|D|A|T|A|' : recordNote.path;
        extractedData.fileName = recordNote.basename;

        // Parse total varNames
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

        // Parse modified-note varNames
        if (YAMLData.editedWords !== undefined) {
            extractedData.editedWords = parseInt(YAMLData.editedWords) || 0;
        }
        if (YAMLData.editedTimes !== undefined) {
            extractedData.editedTimes = parseInt(YAMLData.editedTimes) || 0;
        }
        if (YAMLData.addedWords !== undefined) {
            extractedData.addedWords = parseInt(YAMLData.addedWords) || 0;
        }
        if (YAMLData.deletedWords !== undefined) {
            extractedData.deletedWords = parseInt(YAMLData.deletedWords) || 0;
        }
        if (YAMLData.changedWords !== undefined) {
            extractedData.changedWords = parseInt(YAMLData.changedWords) || 0;
        }
        if (YAMLData.docWords !== undefined) {
            extractedData.docWords = parseInt(YAMLData.docWords) || 0;
        }
        if (YAMLData.editTime !== undefined) {
            extractedData.editTime = restoreTimeString(YAMLData.editTime) || 0;
        }
        if (YAMLData.readTime !== undefined) {
            extractedData.readTime = restoreTimeString(YAMLData.readTime) || 0;
        }
        if (YAMLData.readEditTime !== undefined) {
            extractedData.readEditTime = restoreTimeString(YAMLData.readEditTime) || 0;
        }
        if (YAMLData.lastModifiedTime && YAMLData.lastModifiedTime.trim()) {
            extractedData.lastModifiedTime = moment(YAMLData.lastModifiedTime, this.timeFormat).valueOf();
        }

        existingDataMap.set(extractedData.filePath, extractedData);
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
            const lastModifiedTime = typeof data.lastModifiedTime === 'number' ? moment(data.lastModifiedTime).format(this.timeFormat) : String(data.lastModifiedTime ?? '');
            let line = this.syntax
                .replace(/\${totalEdits}/g, String(data.totalEdits ?? 0))
                .replace(/\${totalWords}/g, String(data.totalWords ?? 0))
                .replace(/\${totalEditTime}/g, formatTime(data.totalEditTime ?? 0))
                .replace(/\${totalReadTime}/g, formatTime(data.totalReadTime ?? 0))
                .replace(/\${totalTime}/g, formatTime(data.totalTime ?? 0))
                .replace(/\${editedWords}/g, String(data.editedWords ?? 0))
                .replace(/\${editedTimes}/g, String(data.editedTimes ?? 0))
                .replace(/\${addedWords}/g, String(data.addedWords ?? 0))
                .replace(/\${deletedWords}/g, String(data.deletedWords ?? 0))
                .replace(/\${changedWords}/g, String(data.changedWords ?? 0))
                .replace(/\${docWords}/g, String(data.docWords ?? 0))
                .replace(/\${editTime}/g, formatTime(data.editTime ?? 0))
                .replace(/\${readTime}/g, formatTime(data.readTime ?? 0))
                .replace(/\${readEditTime}/g, formatTime(data.readEditTime ?? 0))
                .replace(/\${lastModifiedTime}/g, lastModifiedTime);
            
            output += line + '\n';
        }
        
        return output;
    }

    /**
     * Replace old YAML properties with new ones in the frontmatter
     * This is used when syntax changes to ensure old properties are removed
     */
    public async replaceYAMLProperties(recordNote: TFile, oldContent: string, newContent: string): Promise<void> {
        // Parse old content to get property names to remove
        const oldLines = oldContent.trim().split('\n');
        const oldKeys = new Set<string>();
        for (const line of oldLines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                oldKeys.add(key);
            }
        }

        // Parse new content to get new properties
        const newLines = newContent.trim().split('\n');
        const newProperties: Record<string, string | number> = {};
        for (const line of newLines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();

                // Try to parse as number first, then keep as string
                const numValue = parseInt(value);
                if (!isNaN(numValue) && numValue.toString() === value) {
                    newProperties[key] = numValue;
                } else {
                    newProperties[key] = value;
                }
            }
        }

        // Use Obsidian's API to update frontmatter
        await this.plugin.app.fileManager.processFrontMatter(recordNote, (frontmatter) => {
            // Remove old properties
            for (const oldKey of oldKeys) {
                delete frontmatter[oldKey];
            }
            
            // Add new properties
            for (const [key, value] of Object.entries(newProperties)) {
                frontmatter[key] = value;
            }
        });
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
}
