import { DataRecorder, ExistingData, MergedData } from "./DataRecorder";
import { formatTime, restoreTimeString } from "./EditTimer";
import { moment, Notice, TFile } from 'obsidian';
import WordflowTrackerPlugin from "./main";

export class TableParser{
    //private recordType: string;
    private timeFormat: string;
    //private sortBy: string;
    //private isDescend: boolean;
    private syntax: string;
    private noteContent: string | null;
    //private existingDataMap: Map<string, ExistingData>;

    constructor(
        private DataRecorder: DataRecorder,
        private plugin: WordflowTrackerPlugin
    ){}

    public loadSettings(){
        this.timeFormat = this.DataRecorder.timeFormat;
        //this.sortBy = this.DataRecorder.sortBy;
        //this.isDescend = this.DataRecorder.isDescend;
        this.syntax = this.DataRecorder.tableSyntax;
    }

    public async extractData(recordNote: TFile): Promise< Map<string, ExistingData> > { 
        this.noteContent = await this.plugin.app.vault.read(recordNote);
        const lines = this.noteContent.split('\n');
        const existingDataMap: Map<string, ExistingData> = new Map();
        const [tableStartIndex, tableEndIndex] = await this.getIndex(recordNote);

        if (tableStartIndex !== -1) {
            const headerVarMapping = this.createHeaderVarMapping();
            
            const headerRow = lines[tableStartIndex];        
            const dataRows = lines.slice(tableStartIndex + 2, tableEndIndex + 1); // skip header row and split row
            
            for (const row of dataRows) {
                if (row.trim().startsWith('|') && row.trim().endsWith('|')) {
                    const parsedData = this.parseTableRow(row, headerRow, headerVarMapping);
                    if (parsedData) {
                        existingDataMap.set(parsedData.filePath, parsedData);
                    }
                }
            }
        }
        
        return existingDataMap;
    }

    public async getIndex(recordNote: TFile): Promise<[number, number]> {
        if(!this.noteContent) this.noteContent = await this.plugin.app.vault.read(recordNote);
        const [headerTemplate, separatorTemplate] = this.syntax
                .split('\n')
                .filter(l => l.trim())
                .slice(0, 2);
                
        if (!headerTemplate || !separatorTemplate) {
            throw Error ('Invalid table syntax!\n Please check in settings.')
        }

        // Create regex patterns for header and separator
        // This will match regardless of exact spacing or number of dashes
        const headerColumns = headerTemplate.split('|')
            .filter(part => part.trim())
            .map(part => part.trim());
            
        const headerRegexStr = '\\|\\s*' + headerColumns.join('\\s*\\|\\s*') + '\\s*\\|';
        const headerRegex = new RegExp(headerRegexStr, 'i');
        
        // Separator regex - matches any table separator row with the same number of columns
        const columnCount = headerColumns.length;
        const separatorRegexStr = `\\|(?:\\s*-+\\s*\\|){${columnCount}}`;
        const separatorRegex = new RegExp(separatorRegexStr);
        
        // Find table in the document
        const lines = this.noteContent.split('\n');
        let tableStartIndex = -1;
        let tableEndIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            if (headerRegex.test(lines[i])) {
                // Found potential header, check next line for separator
                if (i + 1 < lines.length && separatorRegex.test(lines[i + 1])) {
                    tableStartIndex = i;
                    
                    // Now find the end of the table
                    for (let j = tableStartIndex + 2; j <= lines.length; j++) {
                        // Case1: Table ends at a blank line or end of document
                        if (!lines[j] || lines[j].trim() === '') {
                            tableEndIndex = j - 1;
                            break;
                        }
                        // Case2: next line is not a table row
                        if (!lines[j].trim().startsWith('|') || !lines[j].trim().endsWith('|')) {
                            tableEndIndex = j - 1;
                            break;
                        }
                           
                        // Case3: we find another table header
                        if (j + 1 < lines.length && 
                            headerRegex.test(lines[j]) && 
                            separatorRegex.test(lines[j + 1])) {
                            tableEndIndex = j - 1;
                            break;
                        }
                    }
                    
                    // case4: if no table end index found after iteration, we will enforce throwing error to protect note file. 
                }
            }
        }
//console.log('tablestart:',tableStartIndex,'tableend:', tableEndIndex)
        return [tableStartIndex, tableEndIndex];
    }

    public async getContent(recordNote: TFile): Promise<string | null> {
        if (!this.noteContent) this.noteContent = await this.plugin.app.vault.read(recordNote);
        const [startIndex, endIndex] = await this.getIndex(recordNote);
        const lines = this.noteContent.split('\n');

        if (startIndex != -1 && endIndex !== -1){    
            const tableContent = lines.slice(startIndex, endIndex + 1).join('\n');
            return tableContent;            
        } else if (startIndex != -1 && endIndex == -1){
            throw new Error (`Could not find the end of existing table but find the table start!`);
        } else {
            return null;
        }
    }

    public generateContent(mergedData: MergedData[]): string {
        const [header, separator, ...templateRows] = this.syntax
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
                        case 'noteTitle':
                            return data.fileName;
                        case 'lastModifiedTime':
                            return typeof data.lastModifiedTime === 'number'
                                ? moment(data.lastModifiedTime).format(this.timeFormat)
                                : data.lastModifiedTime as string;
                        case 'editedWords':
                            return data.editedWords.toString();
                        case 'editedTimes':
                            return data.editedTimes.toString();
                        case 'addedWords':
                            return data.addedWords.toString();
                        case 'deletedWords':
                            return data.deletedWords.toString();
                        case 'changedWords':
                            return data.changedWords.toString();
                        case 'docWords':
                            return data.docWords.toString();
                        case 'editedPercentage':
                            return data.editedPercentage.toNote();
                        case 'statBar':
                            return data.statBar.toNote();
                        case 'comment':
                            return data.comment;
                        case 'editTime':
                            return formatTime(data.editTime);
                        default:
                            return '';
                    }
                }
            );
        });
        
        // check if all data is empty
        if (rows.every(row => row.trim() === '')){
            return '';
        }

        // Assemble the complete table
        return [
            '',
            header.trimEnd(),
            separator.trimEnd(),
            ...rows.map(row => row.trimEnd())
        ].join('\n');
    }

    // used for extract varName from table syntax in plugin setting
    private createHeaderVarMapping(): Record<string, string> {
        const mapping: Record<string, string> = {};
        
        // fetch heading and rows from table syntax
        const syntaxLines = this.syntax.split('\n').filter(l => l.trim());
        if (syntaxLines.length !== 3) {
            throw Error ('Table syntax requires strictly 3 lines!\nThe heading line, the split line, and one row for data inserting.')
        }
        
        const headerTemplate = syntaxLines[0];
        const rowTemplate = syntaxLines[2];
        
        // parsing header and row columns
        const headerColumns = headerTemplate.split('|').map(part => part.trim()).filter(Boolean);
        const rowColumns = rowTemplate.split('|').map(part => part.trim()).filter(Boolean);

        if (rowColumns.length > 1 && rowColumns[0].includes('[[') && !rowColumns[0].includes(']]')) {
            // combine 2 columns with alias [[filePath\|alias]]
            if (!rowColumns[0].endsWith('\\')) new Notice('⚠️ The table syntax may lack "\\" in the alias.', 0)
            rowColumns[0] = rowColumns[0] + '\|' + rowColumns[1];
            rowColumns.splice(1, 1);
        }
        
        // parsing map
        for (let i = 0; i < Math.min(headerColumns.length, rowColumns.length); i++) {
            const headerText = headerColumns[i];
            const cellTemplate = rowColumns[i];
            mapping[headerText] = cellTemplate; // Store the entire template instead of just the variable name
        }
        
        return mapping;
    }

    private parseTableRow(row: string, headerRow: string, headerVarMapping: Record<string, string>): ExistingData | null {
        const entry = new ExistingData();
        
        // fetch heading and data rows from table syntax
        const headerColumns = headerRow.split('|').map(part => part.trim()).filter(Boolean);
        const dataColumns = row.split('|').map(part => part.trim()).filter(Boolean);

        if (dataColumns.length > 1 && dataColumns[0].includes('[[') && !dataColumns[0].includes(']]')) {
            // combine 2 columns with alias [[filePath\|alias]]
            dataColumns[0] = dataColumns[0] + '\|' + dataColumns[1];
            dataColumns.splice(1, 1);
        }

        // match data
        for (let i = 0; i < Math.min(headerColumns.length, dataColumns.length); i++) {
            const headerText = headerColumns[i];
            const varTemplate = headerVarMapping[headerText];
            if (!varTemplate) continue;
            
            const value = dataColumns[i];
//console.log('Column:', i, 'Header:', headerText, 'Template:', varTemplate, 'Value:', value); // 添加调试信息
            
            if (varTemplate === '[[${modifiedNote}\\|${noteTitle}]]') { // Handle [[path\|title]] format
                const match = value.match(/^\[\[([^\]]+)\\\|([^\]]+)\]\]$/);
                if (match) {
                    entry.filePath = match[1].replace(/\\+$/, '');
                    entry.fileName = match[2];
                } else {
                    new Notice ('❌Var template with note alias is not matched!', 0)
                    throw new Error ('❌Var template with note alias is not matched!\nConsider checking if table syntax contains "\\|" in the first coloumn, or if table in periodic note is mixed with notes with alias and notes without alias')
                }
            } else {
                const matches = varTemplate.match(/\${(\w+)}/); // single variable matching
                const varName = (matches && matches[1])? matches[1]: 'undefined';

                switch (varName) {
                case 'modifiedNote':
                    entry.filePath = value.replace(/^\[\[+|\]\]+$/g, '');
                    break;
                case 'noteTitle':
                    entry.fileName = value.toString();
                    break;
                case 'editedWords':
                    entry.editedWords = parseInt(value) || 0;
                    break;                    
                case 'editedTimes':
                    entry.editedTimes = parseInt(value) || 0;
                    break;
                case 'addedWords':
                    entry.addedWords = parseInt(value) || 0;
                    break;
                case 'deletedWords':
                    entry.deletedWords = parseInt(value) || 0;
                    break;
                case 'changedWords':
                    entry.changedWords = parseInt(value) || 0;
                    break;
                case 'docWords':
                    entry.docWords = parseInt(value) || 0;
                    break;                    
                case 'lastModifiedTime':
                    try {
                        if (value && value.trim()) {
                            entry.lastModifiedTime = moment(value, this.timeFormat).valueOf();
                        } else {
                            entry.lastModifiedTime = null;
                        }
                    } catch (e) {
                        entry.lastModifiedTime = null;
                    }
                    break;                    
                case 'editedPercentage':
                    entry.editedPercentage.fromNote(value);
                    break;
                case 'statBar':
                    entry.statBar.fromNote(value);
                    break;
                case 'comment':
                    entry.comment = value;
                    break;
                case 'editTime':
                    entry.editTime = restoreTimeString(value);
                    break;
                default:
                    new Notice ('❌A name of ${} is not recognized, please examine the syntax in settings!', 0);
                    console.error("❌This pattern is not recognized:", varName);
                }
            }
        }
        
        if (!entry.filePath) {
            new Notice ('❌${modifiedNote} is not recognized in the table syntax, which is necessary!', 0);
            throw new Error ('${modifiedNote} is not recognized in the table syntax, which is necessary!');
        }
        return entry;
    }
    
};