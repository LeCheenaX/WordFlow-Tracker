import { DataRecorder, ExistingData, MergedData } from "./DataRecorder";
import moment from 'moment';

export class TableParser{
    private recordType: string;
    private timeFormat: string;
    private sortBy: string;
    private isDescend: boolean;
    private syntax: string;
    //private existingDataMap: Map<string, ExistingData>;

    constructor(
        private DataRecorder: DataRecorder,
    ){
        //this.loadSettings();
        //this.existingDataMap = new Map();
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
            header,
            separator,
            ...rows
        ].join('\n');
    }

    public loadSettings(){
        this.timeFormat = this.DataRecorder.timeFormat;
        this.sortBy = this.DataRecorder.sortBy;
        this.isDescend = this.DataRecorder.isDescend;
        this.syntax = this.DataRecorder.tableSyntax;
    }
};