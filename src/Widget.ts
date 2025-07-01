import { ItemView, WorkspaceLeaf, TFile, moment, DropdownComponent } from "obsidian";
import WordflowTrackerPlugin from "./main";
import { ExistingData, DataRecorder } from "./DataRecorder";
import { formatTime } from "./EditTimer";
import { MetaDataParser } from "./MetaDataParser";

export const VIEW_TYPE_WORDFLOW_TRACKER = "wordflow-tracker-view";

export class WordflowWidgetView extends ItemView {
    plugin: WordflowTrackerPlugin;
    private recorderDropdown: DropdownComponent;
    private fieldDropdown: DropdownComponent;
    private dataContainer: HTMLDivElement;
    private selectedRecorder: DataRecorder | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: WordflowTrackerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_WORDFLOW_TRACKER;
    }

    getDisplayText() {
        return "Wordflow Tracker";
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl("h2", { text: "Wordflow Tracker" });

        const controls = container.createDiv();
        controls.createEl("span", { text: "Select Recorder: " });
        this.recorderDropdown = new DropdownComponent(controls);
        controls.createEl("span", { text: "Select Field: " });
        this.fieldDropdown = new DropdownComponent(controls);

        this.dataContainer = container.createDiv();

        this.draw();
    }

    async onClose() {
        this.plugin.Widget = null;
    }

    async update() {
        await this.draw();
    }

    private async draw() {
        if (!this.dataContainer) return;

        this.populateRecorderDropdown();

        const dataMap = await this.getData();
        const options = this.getDropdownOptions();

        this.fieldDropdown.selectEl.empty();
        options.forEach(option => {
            this.fieldDropdown.addOption(option, option);
        });

        this.fieldDropdown.onChange(async (value) => {
            this.renderData(dataMap, value);
        });

        // Set default and render
        if (options.length > 0) {
            const defaultOption = options[0];
            this.fieldDropdown.setValue(defaultOption);
            this.renderData(dataMap, defaultOption);
        } else {
            this.dataContainer.empty();
            this.dataContainer.createEl("p", { text: "No data options available for this recorder." });
        }
    }

    private populateRecorderDropdown() {
        this.recorderDropdown.selectEl.empty();
        if (this.plugin.DocRecorders.length === 0) {
            this.selectedRecorder = null;
            return;
        }

        for (let index = 0; index < this.plugin.DocRecorders.length; ++index){
            if (this.plugin.DocRecorders[index].getParser() instanceof MetaDataParser) continue;
            let recorderName: string;
            if (index !== 0) {
                recorderName = this.plugin.settings.Recorders[index-1].name;
            } else {
                recorderName = this.plugin.settings.name;
            }
            this.recorderDropdown.addOption(index.toString(), recorderName);
        }


        // Set initial selected recorder and its display name
        if (!this.selectedRecorder) {
            const defaultIndex = 0;
            this.selectedRecorder = this.plugin.DocRecorders[defaultIndex];
            this.recorderDropdown.setValue(defaultIndex.toString());
        }

        this.recorderDropdown.onChange(async (value) => {
            this.selectedRecorder = this.plugin.DocRecorders[parseInt(value)];
            await this.draw(); // Redraw the entire widget when recorder changes
            this.recorderDropdown.setValue(value); // put after draw to render correct selection
        });
    }

    private renderData(dataMap: Map<string, ExistingData> | null, field: string) {
        this.dataContainer.empty();
        if (!dataMap) return;

        // Calculate the total value for the current field across all entries
        let totalValue = 0;
        dataMap.forEach(rowData => {
            const value = parseInt(this.getFieldValue(rowData, field));
            if (!isNaN(value)) {
                totalValue += value;
            }
        });

        const totalProgressBarContainer = this.dataContainer.createDiv({ 
            cls: 'wordflow-widget-total-progress-bar-container' 
        });

        const dataList = this.dataContainer.createEl('ul');
        dataMap.forEach(rowData => {
            const value = this.getFieldValue(rowData, field);
            const numericValue = parseInt(value);
            let percentage = 0;
            if (totalValue > 0 && !isNaN(numericValue)) {
                percentage = (numericValue / totalValue) * 100;
            }
            
            let barColor = this.getRandomColor()
            // add to total progress bar
            const segment = totalProgressBarContainer.createDiv({ 
                cls: 'wordflow-widget-progress-bar-segment' 
            });
            
            segment.style.width = `${percentage}%`;
            segment.style.backgroundColor = barColor;

            const listItem = dataList.createEl('li');

            // File path and value display
            const textDisplay = listItem.createDiv({ cls: 'wordflow-widget-data-entry' });
            textDisplay.createEl('span', { text: `${rowData.filePath}: `, cls: 'wordflow-widget-data-entry' });
            textDisplay.createEl('span', { text: value, cls: `wordflow-widget-data-entry` });
            textDisplay.style.color = barColor;
        });
    }

    private getRandomColor(): string {
        const color = [
            '#E6194B', // 鲜艳红
            '#3CB44B', // 饱和绿
            '#4363D8', // 群青蓝
            '#F58231', // 橙黄
            '#911EB4', // 紫罗兰
            '#46F0F0', // 青蓝
            '#F032E6', // 洋红
            '#BCF60C', // 荧光绿
            '#FABEBE', // 粉红
            '#008080', // 深青
        ];

        return color[Math.floor(Math.random()*color.length)];
    }

    private getFieldValue(data: ExistingData, field: string): string {
        if (!this.selectedRecorder) return '';

        switch (field) {
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
            case 'editTime':
                return formatTime(data.editTime);
            case 'totalEdits':
                return data.totalEdits.toString();
            case 'totalWords':
                return data.totalWords.toString();
            case 'totalEditTime':
                return formatTime(data.totalEditTime);
            default:
                return '';
        }
    }

    private getDropdownOptions(): string[] {
        if (!this.selectedRecorder) {
            return ['No available field in wordflow recording syntax to display.'];
        }

        const syntax = this.selectedRecorder.getParser().getSyntax();
        const availableFields = [
            'editedWords',
            'editedTimes',
            'addedWords',
            'deletedWords',
            'changedWords',
            'docWords',
            'editTime',
            'totalEdits',
            'totalWords',
            'totalEditTime'
        ];

        return availableFields.filter(field => syntax.includes(`\${${field}}`))?? 'No available field in wordflow recording syntax to display.';
    }

    private async getData(): Promise<Map<string, ExistingData> | null> {
        if (!this.selectedRecorder) {
            return null;
        }

        const recordNoteName = moment().format(this.selectedRecorder.periodicNoteFormat);
        const recordNoteFolder = (this.selectedRecorder.enableDynamicFolder)? moment().format(this.selectedRecorder.periodicNoteFolder): this.selectedRecorder.periodicNoteFolder;
        const isRootFolder: boolean = (recordNoteFolder.trim() == '')||(recordNoteFolder.trim() == '/');
        let recordNotePath = (isRootFolder)? '': recordNoteFolder+'/';
        recordNotePath += recordNoteName + '.md';
        
        const recordNote = this.plugin.app.vault.getFileByPath(recordNotePath);

        if (!recordNote) {
            return null;
        }

        // Use the recorder's own parser
        return await this.selectedRecorder.getParser().extractData(recordNote);
    }
}