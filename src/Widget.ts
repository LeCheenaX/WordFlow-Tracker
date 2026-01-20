import WordflowTrackerPlugin from "./main";
import { ExistingData, DataRecorder } from "./DataRecorder";
import { formatTime } from "./Timer";
import { MetaDataParser } from "./MetaDataParser";
import { DocTracker } from "./DocTracker";
import { ConfirmationModal } from "./settings"
import { UniqueColorGenerator } from "./Utils/UniqueColorGenerator";
import { DropdownComponent, IconName, ItemView, Notice, WorkspaceLeaf, moment, setIcon, setTooltip } from "obsidian";

export const VIEW_TYPE_WORDFLOW_WIDGET = "wordflow-widget-view";

export class WordflowWidgetView extends ItemView {
    plugin: WordflowTrackerPlugin;
    public colorGenerator: UniqueColorGenerator;
    public onFocusMode: boolean = false;
    public focusPaused: boolean = true;
    private recorderDropdown: DropdownComponent;
    private fieldDropdown: DropdownComponent;
    private totalDataContainer: HTMLSpanElement;
    private dataContainer: HTMLDivElement;
    private currentNoteDataContainer: HTMLDivElement;
    private currentNoteRow: HTMLDivElement;
    private recordButton: HTMLElement;
    private focusButton: HTMLElement;
    private selectedRecorder: DataRecorder | null = null;
    private selectedField: string;
    private dataMap: Map<string, ExistingData> | null = null;
    private totalFieldValue: number = 0;
    private colorMap: Map<string, string>; // <filePath, color>

    constructor(leaf: WorkspaceLeaf, plugin: WordflowTrackerPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.colorGenerator = new UniqueColorGenerator(
                                    parseInt(this.plugin.settings.colorGroupLightness), 
                                    this.plugin.settings.colorGroupSaturation
                                );
        this.colorMap = new Map<string, string>;
    }

    public getViewType() {
        return VIEW_TYPE_WORDFLOW_WIDGET;
    }

    public getDisplayText() {
        return "Wordflow Tracker";
    }

    public getIcon(): IconName {
        return "chart-bar-decreasing";
    }

    public async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl("h2", { text: "Wordflow Tracker" });

        this.currentNoteDataContainer = container.createDiv({cls: "wordflow-widget-current-note-data"});
        this.currentNoteRow = this.currentNoteDataContainer.createDiv({ cls: 'wordflow-widget-current-note-row' });

        const controls = container.createDiv({cls: "wordflow-widget-control-container"});

        const leftGroup = controls.createDiv({cls: "wordflow-widget-control-leftgroup-container"})
        const recorderDropdownContainer = leftGroup.createEl("span", {cls: "recorder-dropdown-container"});
        this.recorderDropdown = new DropdownComponent(recorderDropdownContainer);
        setTooltip(recorderDropdownContainer, 'Switch the recorder')
        
        const rightGroup = controls.createDiv({cls: "wordflow-widget-control-rightgroup-container"})
        const fieldDropdownContainer = rightGroup.createEl("span", {cls: "field-dropdown-container"});
        this.fieldDropdown = new DropdownComponent(fieldDropdownContainer);
        fieldDropdownContainer.insertAdjacentText("afterend", ':');
        setTooltip(fieldDropdownContainer, 'switch data to display from recording syntax')

        this.totalDataContainer = rightGroup.createEl("span", {cls: "totalDataContainer"});

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
        
        const buttonContainer = this.currentNoteDataContainer.createDiv({ cls: 'wordflow-widget-current-note-buttons' });

        this.recordButton = buttonContainer.createEl('em', { cls: 'wordflow-widget-button' });
        this.focusButton = buttonContainer.createEl('em', { cls: 'wordflow-widget-button' });
        
        this.updateButtons_Quit(); // Initial icon setup

        this.recordButton.addEventListener('click', () => {
            if (this.onFocusMode || (!this.onFocusMode && this.focusPaused)) {
                this.onFocusMode = false;
                this.updateButtons_Quit();
            }
            for (const DocRecorder of this.plugin.DocRecorders) {
                DocRecorder.record();
            }
            new Notice(this.plugin.i18n.t('notices.recordSuccess'), 3000);
        });

        this.focusButton.addEventListener('click', () => {           
            if (!this.onFocusMode) {
                const options = this.getFieldOptions();
                if (options.indexOf('readTime')== -1 && options.indexOf('readEditTime') == -1)
                {
                    const tempMessage = new ConfirmationModal(
                        this.app, 
                        'Caution: There\'s no reading time property in recording syntax of the selected recorder. \n\nTo make use of this feature, it\'s recommended to click "cancel" button, and switch to a recorder that has the reading time peroperty. \n\nIf you are not sure which recorder has, kindly add "${readTime}" or "${readEditTime}" in recording syntax of your table/bullet-list recorder. \n\nAre you sure to turn on focus mode? This will do no harm but the focused time will not be recorded.', 
                        async ()=>{
                            this.startFocus();
                    });
                    tempMessage.open();
                } else this.startFocus();
            } else {
                this.onFocusMode = false;
                this.updateButtons_Pause();
            }
        });
    }

    public async onClose() {
        this.plugin.Widget = null;
    }

    public async updateData() {
        this.dataMap = await this.getDataMap(this.selectedField);
        await this.renderData(this.selectedField); // must use await or the total counting in updateCurrentData will use the old value
        this.updateCurrentData();
    }

    public updateCurrentData() {
        // Display current note's data
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile) {
            const activeTracker = this.plugin.trackerMap.get(activeFile.path);
            if (activeTracker) {
                // intitial data counting
                const currentNoteValue = this.getFieldValueFromTracker(activeTracker, this.selectedField);
                const existingFieldValue = this.getFieldValue(this.dataMap?.get(activeFile.path), this.selectedField);
                const currentTotalValue = currentNoteValue + existingFieldValue;

                const currentValueString = (this.selectedField == 'editTime' || this.selectedField == 'readTime' || this.selectedField == 'readEditTime')
                    ? formatTime(currentTotalValue, this.plugin.settings.useSecondInWidget)
                    : currentTotalValue.toString();
                
                // html element creating or re-using
                let leftContentWrapper: HTMLDivElement | null = this.currentNoteRow.querySelector('.wordflow-widget-current-note-left-content-wrapper');
                let textContainer: HTMLDivElement | null | undefined = leftContentWrapper?.querySelector('.wordflow-widget-current-note-text-container');

                if (!leftContentWrapper || !textContainer || currentTotalValue == 0) {
                    this.currentNoteRow.empty();
                    leftContentWrapper = this.currentNoteRow.createDiv({ cls: 'wordflow-widget-current-note-left-content-wrapper' });
                    textContainer = leftContentWrapper.createDiv({ cls: 'wordflow-widget-current-note-text-container' });
                }
                textContainer.empty();

                textContainer.createEl('span', { text: `${activeFile.basename}`, cls: 'wordflow-widget-current-note-label' });
                const noteValueStyle = textContainer.createEl('span', { text: currentValueString, cls: 'wordflow-widget-current-note-value' });
                if (!this.colorMap.get(activeTracker.filePath)) this.colorMap.set(activeTracker.filePath, this.colorGenerator.generate());
                noteValueStyle.style.color = this.colorMap.get(activeTracker.filePath)??'initial';

                if (currentTotalValue > 0) {
                    let barContainer: HTMLDivElement | null = leftContentWrapper?.querySelector('.wordflow-widget-current-note-bar-container');
                    let existingBar: HTMLSpanElement | null | undefined = barContainer?.querySelector('.wordflow-widget-current-note-bar-existing'); 
                    let currentBar: HTMLSpanElement | null | undefined = barContainer?.querySelector('.wordflow-widget-current-note-bar-current');
                    if (!barContainer || !existingBar || !currentBar) {
                        barContainer = leftContentWrapper.createDiv({ cls: 'wordflow-widget-current-note-bar-container' });
                        existingBar = barContainer.createEl('span', { cls: 'wordflow-widget-current-note-bar-existing' });
                        currentBar = barContainer.createEl('span', { cls: 'wordflow-widget-current-note-bar-current' });
                        barContainer.style.width = '0';
                        existingBar.style.width = '0';
                        currentBar.style.width = '0';
                    }
                    
                    const widthPercentage = (currentTotalValue / (currentNoteValue + this.totalFieldValue)) * 100;
                    //console.log('new: ', currentNoteValue, '\nExisting: ', existingFieldValue, '\nTotal: ', this.totalFieldValue)
                    barContainer.offsetWidth; // may be deleted
                    existingBar.offsetWidth;
                    currentBar.offsetWidth;
                    

                    const existingPercentage = (existingFieldValue / currentTotalValue) * 100;
                    const currentPercentage = (currentNoteValue / currentTotalValue) * 100;

                    barContainer.style.width = `${widthPercentage}%`;
                    existingBar.style.width = `${existingPercentage}%`;
                    
                    currentBar.style.width = `${currentPercentage}%`;
                    currentBar.style.backgroundColor = noteValueStyle.style.color;
                }
            } else {
                this.currentNoteRow.empty();
                this.currentNoteRow.createEl('span', { text: this.plugin.i18n.t('widget.prompts.noFile'), cls: 'wordflow-widget-current-note-faint-label' });
            }
        } else {
            this.currentNoteRow.empty();
            this.currentNoteRow.createEl('span', { text: this.plugin.i18n.t('widget.prompts.noOpenedFile'), cls: 'wordflow-widget-current-note-faint-label' });
        }
    }

    public updateButtons_Pause() {
        setIcon(this.focusButton, 'play');
        setTooltip(this.focusButton, 'continue focusing');
        setIcon(this.recordButton, 'square');
        setTooltip(this.recordButton, 'quit focusing and record');
        this.focusPaused = true;
    }

    public updateButtons_Quit(){
        setIcon(this.recordButton, 'file-clock');
        setTooltip(this.recordButton, 'record wordflows to periodic notes');
        setIcon(this.focusButton, 'play');
        setTooltip(this.focusButton, 'start focusing');
        this.focusPaused = false;
    }

    public updateButtons_Start(){
        setIcon(this.focusButton, 'pause');
        setTooltip(this.focusButton, 'pause focusing');
        setIcon(this.recordButton, 'square');
        setTooltip(this.recordButton, 'quit focusing and record');
        this.focusPaused = false;
    }

    public async updateAll() {
        if (!this.dataContainer) return;

        this.initRecorderDropdown();
        await this.initFieldDropDown();
    }

    public regenerateColors() {
        this.colorMap.forEach( (color:string, filePath: string)=>{
            this.colorMap.set(filePath, this.colorGenerator.generate());
        });
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
            this.recorderDropdown.addOption('tempError', this.plugin.i18n.t('widget.prompts.noRecorder'));
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
            this.fieldDropdown.addOption(option, this.getFieldDisplayName(option));
        });

        // Set default and render
        if (fieldOptions.length === 0) {
            this.dataContainer.empty();
            this.dataContainer.createEl("p", { text: this.plugin.i18n.t('widget.prompts.noField') });
        }

        if(!this.selectedField || !fieldOptions.contains(this.selectedField)) {
            const defaultField = fieldOptions[0];
            this.selectedField = defaultField;
        }

        this.fieldDropdown.setValue(this.selectedField)
        await this.updateData();

        this.fieldDropdown.onChange(async (value) => {
            this.fieldDropdown.setValue(value);
            this.selectedField = value;
            await this.renderData(value);
            this.updateCurrentData();
        });
    }

    private async renderData(field: string | null) {
        this.dataContainer.empty();
        if (!this.dataMap || !field) {
            this.dataContainer.createEl('span', { text: this.plugin.i18n.t('widget.prompts.noData'), cls: 'wordflow-widget-no-data-message'});
            this.totalDataContainer.textContent = (field === 'editTime' || field === 'readTime' || field === 'readEditTime')
                ? formatTime(0)
                : "0";
            return;
        }

        const sortedData = await this.getSortedData(field);

        // Calculate the total value for the current field across all entries
        this.totalFieldValue = 0;
        sortedData.forEach(rowData => {
                this.totalFieldValue += this.getFieldValue(rowData, field);
        });

        this.totalDataContainer.textContent = (field == 'editTime' || field == 'readTime' || field == 'readEditTime')
            ? formatTime(this.totalFieldValue)
            : this.totalFieldValue.toString();

        const totalProgressBarContainer = this.dataContainer.createDiv({ 
            cls: 'wordflow-widget-total-progress-bar-container' 
        });

        sortedData.forEach(rowData => {
            const value = this.getFieldValue(rowData, field);
            let percentage = 0;
            if (this.totalFieldValue > 0) {
                percentage = (value / this.totalFieldValue) * 100;
            }
            const valueString = (field == 'editTime' || field == 'readTime' || field == 'readEditTime')
                ? formatTime(value)
                : value.toString();

            if (!this.colorMap.has(rowData.filePath)) {
                this.colorMap.set(rowData.filePath, this.colorGenerator.generate())
            }
            let barColor = this.colorMap.get(rowData.filePath)?? 'initial'; // 'initial' is useless, only for passing the compiler warning. 
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
                case 'readTime':
                    aVal = a.readTime;
                    bVal = b.readTime;
                    break;
                case 'readEditTime':
                    aVal = a.readEditTime;
                    bVal = b.readEditTime;
                    break;
                default:
                    return 0; // just use default sequence 
            }

            return bVal - aVal;
        });
        return existingData;
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
            case 'readTime':
                return data.readTime;
            case 'readEditTime':
                return data.readEditTime;    
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
            case 'readTime':
                return tracker.readTime;
            case 'readEditTime':
                return (tracker.readTime + tracker.editTime);  
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

    public getFieldOptions(): string[] {
        if (!this.selectedRecorder) {
            return [this.plugin.i18n.t('widget.prompts.noFieldinSyntax')];
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
            'readTime',
            'readEditTime',
        ];

        return availableFields.filter(field => syntax.includes(`\${${field}}`))?? this.plugin.i18n.t('widget.prompts.noFieldinSyntax');
    }

    private getFieldDisplayName(fieldName: string): string {
        const aliasMapping = this.plugin.settings.fieldAlias.find(mapping => mapping.value === fieldName);
        return aliasMapping ? aliasMapping.key : fieldName;
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

    private async startFocus():Promise<void>{
        this.onFocusMode = true;
        this.updateButtons_Start();
        if (this.plugin.settings.switchToFieldOnFocus !== 'disabled') {
            const newField = this.plugin.settings.switchToFieldOnFocus;
            if (this.getFieldOptions().indexOf(newField) == -1) {
                new Notice(this.plugin.i18n.t('notices.noAvailableField'), 3000);
                return;
            }
            this.fieldDropdown.setValue(newField);
            this.selectedField = newField;
            await this.renderData(newField);
            this.updateCurrentData();
        }
    }
}