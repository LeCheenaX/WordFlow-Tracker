import { DataRecorder, ExistingData, MergedData } from "./DataRecorder";
import moment from 'moment';

export class TableParser{
    //private recordType: string;
    private timeFormat: string;
    //private sortBy: string;
    //private isDescend: boolean;
    private syntax: string;
    //private existingDataMap: Map<string, ExistingData>;

    constructor(
        private DataRecorder: DataRecorder,
    ){}

    public loadSettings(){
        this.timeFormat = this.DataRecorder.timeFormat;
        //this.sortBy = this.DataRecorder.sortBy;
        //this.isDescend = this.DataRecorder.isDescend;
        this.syntax = this.DataRecorder.tableSyntax;
    }

    public async extractData(noteContent: string): Promise< Map<string, ExistingData> > { 
        const lines = noteContent.split('\n');
        const existingDataMap: Map<string, ExistingData> = new Map();
        const [tableStartIndex, tableEndIndex] = this.getIndex(noteContent);

        if ( tableStartIndex != -1){
            // Process data rows (skip header and separator)
            const dataRows = lines.slice(tableStartIndex + 2, tableEndIndex + 1);
//console.log('existing datarows:',dataRows)F
            // Parse each row into an ExistingData object
            for (const row of dataRows) {
                if (row.trim().startsWith('|') && row.trim().endsWith('|')) {
                    const parsedData = ExistingData.fromTableRow(row);
                    if (parsedData) {
                        existingDataMap.set(parsedData.filePath, parsedData);
                    }
                }
            }
        } 
            
        return existingDataMap; 
    }

    public getIndex(noteContent: string): [number, number] {
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
        const lines = noteContent.split('\n');
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
        console.log('tablestart:',tableStartIndex,'tableend:', tableEndIndex)
        return [tableStartIndex, tableEndIndex];
    }

    public getContent(noteContent: string): string | null {
        const [startIndex, endIndex] = this.getIndex(noteContent);
        const lines = noteContent.split('\n');

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
                        case 'lastModifiedTime':
                            return typeof data.lastModifiedTime === 'number'
                                ? moment(data.lastModifiedTime).format(this.timeFormat)
                                : data.lastModifiedTime as string;
                        case 'editedWords':
                            return data.editedWords.toString();
                        case 'editedTimes':
                            return data.editedTimes.toString();
                        case 'editedPercentage':
                            return data.editedPercentage;
                        default:
                            return '';
                    }
                }
            );
        });
        
        // Assemble the complete table
        return [
            '',
            header,
            separator,
            ...rows
        ].join('\n').trimEnd();
    }

    
};