import { ItemView, WorkspaceLeaf, TFile, moment, DropdownComponent } from "obsidian";
import WordflowTrackerPlugin from "./main";
import { ExistingData, DataRecorder } from "./DataRecorder";
import { formatTime } from "./EditTimer";
import { MetaDataParser } from "./MetaDataParser";
import { DocTracker } from "./DocTracker";

export const VIEW_TYPE_WORDFLOW_WIDGET = "wordflow-widget-view";

export class WordflowWidgetView extends ItemView {
    plugin: WordflowTrackerPlugin;
    private recorderDropdown: DropdownComponent;
    private fieldDropdown: DropdownComponent;
    private totalDataContainer: HTMLSpanElement;
    private dataContainer: HTMLDivElement;
    private currentNoteDataContainer: HTMLDivElement;
    private selectedRecorder: DataRecorder | null = null;
    private selectedField: string;
    private dataMap: Map<string, ExistingData> | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: WordflowTrackerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    public getViewType() {
        return VIEW_TYPE_WORDFLOW_WIDGET;
    }

    public getDisplayText() {
        return "Wordflow Tracker";
    }

    public async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl("h2", { text: "Wordflow Tracker" });

        this.currentNoteDataContainer = container.createDiv({cls: "wordflow-widget-current-note-data"});

        const controls = container.createDiv({cls: "wordflow-widget-control-container"});

        const leftGroup = controls.createDiv({cls: "wordflow-widget-control-leftgroup-container"})
        const recorderDropdownContainer = leftGroup.createEl("span", {cls: "recorder-dropdown-container"});
        this.recorderDropdown = new DropdownComponent(recorderDropdownContainer);
        
        const rightGroup = controls.createDiv({cls: "wordflow-widget-control-rightgroup-container"})
        this.totalDataContainer = rightGroup.createEl("span", {cls: "totalDataContainer"});
        const fieldDropdownContainer = rightGroup.createEl("span", {cls: "field-dropdown-container"});
        this.fieldDropdown = new DropdownComponent(fieldDropdownContainer);

        this.dataContainer = container.createDiv();

        this.updateAll();
        this.registerDomEvent(this.dataContainer, 'click', (evt: MouseEvent) => {
            const target = evt.target as HTMLSpanElement;
            const filePathSpan = target.closest('.wordflow-widget-data-row-file-path') as HTMLSpanElement;
            if (!filePathSpan || !filePathSpan.dataset.filePath) return;
            const filePath = filePathSpan.dataset.filePath;
            const inNewTab: boolean = evt.ctrlKey || evt.metaKey;
            this.plugin.app.workspace.openLinkText(filePath, filePath, inNewTab);
        });
    }

    public async onClose() {
        this.plugin.Widget = null;
    }

    public async updateData() {
        this.dataMap = await this.getDataMap(this.selectedField);
        this.renderData(this.selectedField);
        this.updateCurrentData();
    }

    public updateCurrentData() {
        this.currentNoteDataContainer.empty();
        // Display current note's data
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile) {
            const activeTracker = this.plugin.trackerMap.get(activeFile.path);
            if (activeTracker) {
                let currentNoteValue = this.getFieldValueFromTracker(activeTracker, this.selectedField);
                let existingFieldValue = this.getFieldValue(this.dataMap?.get(activeFile.path), this.selectedField);
                currentNoteValue += existingFieldValue;

                const currentValueString = (this.selectedField == 'editTime')? formatTime(currentNoteValue): currentNoteValue.toString();
                const currentNoteRow = this.currentNoteDataContainer.createDiv({ cls: 'wordflow-widget-current-note-row' });
                currentNoteRow.createEl('span', { text: `${activeFile.basename}`, cls: 'wordflow-widget-current-note-label' });
                currentNoteRow.createEl('span', { text: currentValueString, cls: 'wordflow-widget-current-note-value' });
            } else {
                const currentNoteRow = this.currentNoteDataContainer.createDiv({ cls: 'wordflow-widget-current-note-row' });
                currentNoteRow.createEl('span', { text: "this file has no tracker", cls: 'wordflow-widget-current-note-faint-label' });
            }
        } else {
            const currentNoteRow = this.currentNoteDataContainer.createDiv({ cls: 'wordflow-widget-current-note-row' });
            currentNoteRow.createEl('span', { text: "no file opened", cls: 'wordflow-widget-current-note-faint-label' });
        }
    }

    public async updateAll() {
        if (!this.dataContainer) return;

        this.initRecorderDropdown();
        this.initFieldDropDown();
    }

    private initRecorderDropdown() {
        this.recorderDropdown.selectEl.empty();
        let availableRecorders = 0;

        for (let index = 0; index < this.plugin.DocRecorders.length; ++index){
            if (this.plugin.DocRecorders[index].getParser() instanceof MetaDataParser) continue;
            let recorderName: string;
            if (index !== 0) {
                recorderName = this.plugin.settings.Recorders[index-1].name;
            } else {
                recorderName = this.plugin.settings.name;
            }
            ++availableRecorders;
            this.recorderDropdown.addOption(index.toString(), recorderName);
        }

        if (!availableRecorders) {
            this.selectedRecorder = null;
            this.recorderDropdown.addOption('tempError', 'No available recorder');
            return;
        }

        // Set initial selected recorder and its display name
        if (!this.selectedRecorder) {
            const defaultIndex = 0;
            this.selectedRecorder = this.plugin.DocRecorders[defaultIndex];
            this.recorderDropdown.setValue(defaultIndex.toString());
        }

        this.recorderDropdown.onChange(async (value) => {
            this.selectedRecorder = this.plugin.DocRecorders[parseInt(value)];
            await this.updateAll(); // Redraw the entire widget when recorder changes
            this.recorderDropdown.setValue(value); // put after draw to render correct selection
        });
    }

    private async initFieldDropDown(){
        const fieldOptions = this.getFieldOptions();

        this.fieldDropdown.selectEl.empty();
        fieldOptions.forEach(option => {
            this.fieldDropdown.addOption(option, option);
        });

        // Set default and render
        if (fieldOptions.length === 0) {
            this.dataContainer.empty();
            this.dataContainer.createEl("p", { text: "No available field for this recorder" });
        }

        if(!this.selectedField || !fieldOptions.contains(this.selectedField)) {
            const defaultField = fieldOptions[0];
            this.selectedField = defaultField;
        }

        this.fieldDropdown.setValue(this.selectedField)
        this.updateData();

        this.fieldDropdown.onChange(async (value) => {
            this.fieldDropdown.setValue(value);
            this.selectedField = value;
            this.renderData(value);
            this.updateCurrentData();
        });
    }

    private async renderData(field: string | null) {
        this.dataContainer.empty();
        if (!this.dataMap || !field) {
            this.dataContainer.createEl('span', { text: 'No available data in this field'});
            return;
        }

        const sortedData = await this.getSortedData(field);

        // Calculate the total value for the current field across all entries
        let totalValue = 0;
        sortedData.forEach(rowData => {
                totalValue += this.getFieldValue(rowData, field);
        });

        this.totalDataContainer.textContent = (field == 'editTime')? formatTime(totalValue): totalValue.toString();

        const totalProgressBarContainer = this.dataContainer.createDiv({ 
            cls: 'wordflow-widget-total-progress-bar-container' 
        });

        sortedData.forEach(rowData => {
            const value = this.getFieldValue(rowData, field);
            let percentage = 0;
            if (totalValue > 0) {
                percentage = (value / totalValue) * 100;
            }
            const valueString = (field == 'editTime')? formatTime(value): value.toString();
            
            let barColor = this.getRandomColor()
            // add to total progress bar
            const segment = totalProgressBarContainer.createDiv({ 
                cls: 'wordflow-widget-progress-bar-segment' 
            });
            
            segment.style.width = `${percentage}%`;
            segment.style.backgroundColor = barColor;

            const dataRow = this.dataContainer.createDiv({ cls: 'wordflow-widget-data-row' });

            const circleSpan = dataRow.createEl('span', { cls: 'wordflow-widget-data-row-circle' });
            circleSpan.style.backgroundColor = barColor;

            const filePathSpan = dataRow.createEl('span', { cls: 'wordflow-widget-data-row-file-path' });
            filePathSpan.dataset.filePath = rowData.filePath;
            filePathSpan.dataset.fileName = 
                (rowData.fileName !== 'unknown')
                    ? rowData.fileName
                    : this.app.vault.getFileByPath(rowData.filePath)?.basename?? 'file deleted';
            filePathSpan.textContent = filePathSpan.dataset.fileName;

            const rowText = dataRow.createEl('span', { text: valueString, cls: `wordflow-widget-data-row-value`});
            rowText.style.color = barColor;
        });
    }

    private async getSortedData(field: string): Promise<ExistingData[]> {
        if (!this.dataMap) return [];
        const existingData: ExistingData[] = Array.from(this.dataMap.values());

        existingData.sort((a, b) => {
            let aVal: number, bVal: number;

            switch (field) {
                case 'editedWords':
                    aVal = a.editedWords;
                    bVal = b.editedWords;
                    break;
                case 'editedTimes':
                    aVal = a.editedTimes;
                    bVal = b.editedTimes;
                    break;
                case 'addedWords':
                    aVal = a.addedWords;
                    bVal = b.addedWords;
                    break;
                case 'deletedWords':
                    aVal = a.deletedWords;
                    bVal = b.deletedWords;
                    break;
                case 'changedWords':
                    aVal = a.changedWords;
                    bVal = b.changedWords;
                    break;
                case 'docWords':
                    aVal = a.docWords;
                    bVal = b.docWords;
                    break;
                case 'editTime':
                    aVal = a.editTime;
                    bVal = b.editTime;
                    break;
                default:
                    return 0; // just use default sequence 
            }

            return bVal - aVal;
        });
        return existingData;
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

    private getFieldValue(data: ExistingData | undefined, field: string): number {
        if (!this.selectedRecorder || !data) return 0;

        switch (field) {
            case 'editedWords':
                return data.editedWords;
            case 'editedTimes':
                return data.editedTimes;
            case 'addedWords':
                return data.addedWords;
            case 'deletedWords':
                return data.deletedWords;
            case 'changedWords':
                return data.changedWords;
            case 'docWords':
                return data.docWords;
            case 'editTime':
                return data.editTime;
            case 'totalEdits':
                return data.totalEdits;
            case 'totalWords':
                return data.totalWords;
            case 'totalEditTime':
                return data.totalEditTime;
            default:
                return 0;
        }
    }

    private getFieldValueFromTracker(tracker: DocTracker, field: string): number {
        switch (field) {
            case 'editedWords':
                return tracker.editedWords;
            case 'editedTimes':
                return tracker.editedTimes;
            case 'addedWords':
                return tracker.addedWords;
            case 'deletedWords':
                return tracker.deletedWords;
            case 'changedWords':
                return tracker.changedWords;
            case 'docWords':
                return tracker.docWords;
            case 'editTime':
                return tracker.editTime;
            case 'totalEdits':
                return tracker.editedTimes; // Assuming totalEdits maps to editedTimes for current note
            case 'totalWords':
                return tracker.docWords; // Assuming totalWords maps to docWords for current note
            case 'totalEditTime':
                return tracker.editTime; // Assuming totalEditTime maps to editTime for current note
            default:
                return 0;
        }
    }

    private getFieldOptions(): string[] {
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
            'editTime'
        ];

        return availableFields.filter(field => syntax.includes(`\${${field}}`))?? 'No available field in wordflow recording syntax to display.';
    }

    private async getDataMap(field: string | null): Promise<Map<string, ExistingData> | null> {
        if (!this.selectedRecorder || !field) {
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
        
        return await this.selectedRecorder.getParser().extractData(recordNote);;
    }
}