import WordflowTrackerPlugin from "./main";
import { ExistingData, DataRecorder } from "./DataRecorder";
import { formatTime } from "./Timer";
import { MetaDataParser } from "./MetaDataParser";
import { DocTracker } from "./DocTracker";
import { ConfirmationModal } from "./settings"
import { UniqueColorGenerator } from "./Utils/UniqueColorGenerator";
import { TagColorManager } from "./Utils/TagColorManager";
import { HeatmapColorManager } from "./Utils/HeatmapColorManager";
import { DynamicDropdown } from "./Utils/DynamicDropdown";
import { DropdownComponent, IconName, ItemView, Notice, WorkspaceLeaf, moment, setIcon, setTooltip, TFile, TFolder } from "obsidian";

export const VIEW_TYPE_WORDFLOW_WIDGET = "wordflow-widget-view";

// Readonly maps for periodic note type display names
const PRESENT_DISPLAY_MAP: ReadonlyMap<string, string> = new Map([
    ['daily note', 'Today'],
    ['weekly note', 'This Week'],
    ['monthly note', 'This Month'],
    ['quarterly note', 'This Quarter'],
    ['semesterly note', 'This Semester'],
    ['yearly note', 'This Year']
]);

const PREVIOUS_DISPLAY_MAP: ReadonlyMap<string, string> = new Map([
    ['daily note', 'Yesterday'],
    ['weekly note', 'Last Week'],
    ['monthly note', 'Last Month'],
    ['quarterly note', 'Last Quarter'],
    ['semesterly note', 'Last Semester'],
    ['yearly note', 'Last Year']
]);

export interface TagGroupData {
    tagName: string;
    totalWeight: number;
    color: string;
    files: string[];
}

export interface FileData {
    filePath: string;
    fileName: string;
    value: number;
    color: string;
}

export class WordflowWidgetView extends ItemView {
    plugin: WordflowTrackerPlugin;
    public colorGenerator: UniqueColorGenerator;
    public tagColorManager: TagColorManager;
    public onFocusMode: boolean = false;
    public focusPaused: boolean = true;
    private recorderDropdown: DynamicDropdown;
    private fieldDropdown: DynamicDropdown;
    private totalDataContainer: HTMLSpanElement;
    private dataContainer: HTMLDivElement;
    private currentNoteDataContainer: HTMLDivElement;
    private currentNoteRow: HTMLDivElement;
    private recordButton: HTMLElement;
    private focusButton: HTMLElement;
    private periodicNoteNameContainer: HTMLSpanElement;
    private prevNoteButton: HTMLButtonElement;
    private nextNoteButton: HTMLButtonElement;
    private presentButton: HTMLButtonElement;
    private selectedRecorder: DataRecorder | null = null;
    private selectedField: string;
    private dataMap: Map<string, ExistingData> | null = null;
    private totalFieldValue: number = 0;
    private colorMap: Map<string, string>; // <filePath, color>
    private selectedNoteName: string; // Track the current view filename (avoids moment format issues)
    private availableNotes: Map<string, moment.Moment>; // Map of filename -> moment object for sorting
    private viewSwitcher: HTMLDivElement;
    private currentView: string;

    constructor(leaf: WorkspaceLeaf, plugin: WordflowTrackerPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.colorGenerator = new UniqueColorGenerator(
                                    parseInt(this.plugin.settings.colorGroupLightness), 
                                    this.plugin.settings.colorGroupSaturation
                                );
        this.tagColorManager = new TagColorManager(this.plugin, this.plugin.settings.tagColors, this.colorGenerator);
        this.selectedNoteName = ''; // Will be set when recorder is selected
        this.currentView = this.plugin.settings.defaultViewOnOpen;
        this.availableNotes = new Map();
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

        // Title and view switcher row
        const titleRow = container.createDiv({cls: "wordflow-widget-title-row"});
        
        // Recorder dropdown as title
        const titleContainer = titleRow.createDiv({cls: "wordflow-widget-title-container"});
        const recorderDropdownContainer = titleContainer.createEl("span", {cls: "recorder-dropdown-container"});
        this.recorderDropdown = new DynamicDropdown(recorderDropdownContainer);
        setTooltip(recorderDropdownContainer, 'Switch the recorder', {
            placement: 'top',
            delay: 300
        });

        // View switcher buttons (outside titleContainer)
        this.viewSwitcher = titleRow.createDiv({cls: "wordflow-widget-view-switcher"});
        
        const fileViewBtn = this.viewSwitcher.createEl("button", {cls: `view-switch-btn${this.currentView === 'file-list' ? ' active' : ''}`, attr: {"data-view": "file-list"}});
        setIcon(fileViewBtn, "file-text");
        setTooltip(fileViewBtn, this.plugin.i18n.t('widget.viewSwitcher.fileListView'), {placement: 'top', delay: 300});
        
        const tagViewBtn = this.viewSwitcher.createEl("button", {cls: `view-switch-btn${this.currentView === 'tag-list' ? ' active' : ''}`, attr: {"data-view": "tag-list"}});
        setIcon(tagViewBtn, "tags");
        setTooltip(tagViewBtn, this.plugin.i18n.t('widget.viewSwitcher.tagListView'), {placement: 'top', delay: 300});
        
        // Heatmap button - will be shown/hidden based on recorder type
        const heatmapViewBtn = this.viewSwitcher.createEl("button", {cls: `view-switch-btn${this.currentView === 'heatmap' ? ' active' : ''}`, attr: {"data-view": "heatmap"}});
        setIcon(heatmapViewBtn, "flame");
        setTooltip(heatmapViewBtn, this.plugin.i18n.t('widget.viewSwitcher.heatmapView'), {placement: 'top', delay: 300});

        // Add click handlers for view switching
        this.viewSwitcher.addEventListener('click', async (evt: MouseEvent) => {
            const target = evt.target as HTMLElement;
            const btn = target.closest('.view-switch-btn') as HTMLElement;
            if (btn) {
                const view = btn.dataset.view as 'file-list' | 'tag-list' | 'heatmap';
                if (view && view !== this.currentView) {
                    this.currentView = view;
                    // Update active state
                    this.viewSwitcher.querySelectorAll('.view-switch-btn').forEach(b => b.removeClass('active'));
                    btn.addClass('active');
                    // Re-render data with new view
                    await this.renderData(this.selectedField);
                }
            }
        });

        this.currentNoteDataContainer = container.createDiv({cls: "wordflow-widget-current-note-data"});
        this.currentNoteRow = this.currentNoteDataContainer.createDiv({ cls: 'wordflow-widget-current-note-row' });

        const controls = container.createDiv({cls: "wordflow-widget-control-container"});

        // Left group: periodic note navigation
        const leftGroup = controls.createDiv({cls: "wordflow-widget-control-leftgroup-container"});
        
        this.prevNoteButton = leftGroup.createEl("button", {cls: "wordflow-widget-nav-button", text: "<"});
        setTooltip(this.prevNoteButton, 'previous', {
            placement: 'top',
            delay: 300
        });
        this.prevNoteButton.addEventListener('click', () => {
            this.navigateToPrevious();
        });

        this.periodicNoteNameContainer = leftGroup.createEl("span", {cls: "periodic-note-name-container"});
        
        // Add click handler for periodic note name (similar to fileEntry)
        this.periodicNoteNameContainer.addEventListener('click', async (evt: MouseEvent) => {
            const noteExists = this.periodicNoteNameContainer.dataset.noteExists === 'true';
            
            if (noteExists) {
                // Note exists, open it
                const filePath = this.periodicNoteNameContainer.dataset.filePath;
                if (!filePath) return;
                
                const inNewTab: boolean = evt.ctrlKey || evt.metaKey;
                this.plugin.app.workspace.openLinkText(filePath, filePath, inNewTab);
            } else {
                // Note doesn't exist, show confirmation modal
                const targetDate = parseInt(this.periodicNoteNameContainer.dataset.targetDate || '0');
                if (!targetDate || !this.selectedRecorder) return;
                
                const recorder = this.selectedRecorder; // Capture for closure
                const displayName = this.getPeriodicNoteDisplayName(); // Get the display name
                
                const confirmModal = new ConfirmationModal(
                    this.app,
                    this.plugin.i18n.t('notices.noteCreateConfirm', { displayName }),
                    async () => {
                        // User confirmed, create the note
                        const createdNote = await recorder.createRecordNoteIfNotExists(targetDate);
                        if (createdNote) {
                            // Open the newly created note
                            const inNewTab: boolean = evt.ctrlKey || evt.metaKey;
                            this.plugin.app.workspace.openLinkText(createdNote.path, createdNote.path, inNewTab);
                            
                            // Update the UI to reflect the note now exists
                            await this.updateNotesMap();
                            this.updatePeriodicNoteName();
                        }
                    }
                );
                confirmModal.open();
            }
        });
        
        this.nextNoteButton = leftGroup.createEl("button", {cls: "wordflow-widget-nav-button", text: ">"});
        setTooltip(this.nextNoteButton, 'next', {
            placement: 'top',
            delay: 300
        });
        this.nextNoteButton.addEventListener('click', () => {
            this.navigateToNext();
        });

        this.presentButton = leftGroup.createEl("button", {cls: "wordflow-widget-nav-button", text: "↺"});
        setTooltip(this.presentButton, 'back to present', {
            placement: 'top',
            delay: 300
        });
        this.presentButton.addEventListener('click', () => {
            this.navigateToToday();
        });
        
        const rightGroup = controls.createDiv({cls: "wordflow-widget-control-rightgroup-container"});
        const fieldDropdownContainer = rightGroup.createEl("span", {cls: "field-dropdown-container"});
        this.fieldDropdown = new DynamicDropdown(fieldDropdownContainer, 'right');
        fieldDropdownContainer.insertAdjacentText("afterend", ':');
        setTooltip(fieldDropdownContainer, 'switch data to display from recording syntax', {
            placement: 'top',
            delay: 300
        });

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

        this.recordButton.addEventListener('click', async () => {
            if (this.onFocusMode || (!this.onFocusMode && this.focusPaused)) {
                this.onFocusMode = false;
                this.updateButtons_Quit();
            }
            await this.plugin.recorderManager.record();
            new Notice(this.plugin.i18n.t('notices.recordSuccess'), 3000);
        });

        this.focusButton.addEventListener('click', () => {           
            if (!this.onFocusMode) {
                const options = this.getFieldOptions();
                if (options.indexOf('readTime')== -1 && options.indexOf('readEditTime') == -1)
                {
                    const tempMessage = new ConfirmationModal(
                        this.app, 
                        this.plugin.i18n.t('widget.confirmations.focusModeNoReadTime'), 
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
                
                // Get color for current file using appendToColorMap
                if (!this.colorMap.has(activeTracker.filePath)) {
                    this.appendToColorMap(activeTracker.filePath);
                }
                
                const fileColor = this.colorMap.get(activeTracker.filePath) || '#666666';
                noteValueStyle.style.color = fileColor;

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
    public updatePeriodicNoteName() {
        if (!this.selectedRecorder) return;
        
        const displayText = this.getPeriodicNoteDisplayName();
        this.periodicNoteNameContainer.setText(displayText);
        
        // Get the full note path for the current view
        const viewDate = this.availableNotes.get(this.selectedNoteName);
        if (viewDate) {
            const recordNote = this.selectedRecorder.getRecordNote(viewDate.valueOf());
            
            // Always show tooltip with the note name, regardless of whether it exists
            const recordNoteName = moment(viewDate).format(this.selectedRecorder.periodicNoteFormat);
            setTooltip(this.periodicNoteNameContainer, recordNoteName, {
                placement: 'top',
                delay: 300
            });
            
            if (recordNote) {
                // Store the file path in dataset for click handler
                this.periodicNoteNameContainer.dataset.filePath = recordNote.path;
                this.periodicNoteNameContainer.dataset.noteExists = 'true';
            } else {
                // Note doesn't exist, store the target date for creation
                this.periodicNoteNameContainer.dataset.filePath = '';
                this.periodicNoteNameContainer.dataset.noteExists = 'false';
                this.periodicNoteNameContainer.dataset.targetDate = viewDate.valueOf().toString();
            }
        }
    }

    private getPeriodicNoteDisplayName(): string {
        if (!this.selectedRecorder) return '';
        
        const presentFileName = moment().format(this.selectedRecorder.periodicNoteFormat);
        const isPresent = this.selectedNoteName === presentFileName;
        const noteType = this.selectedRecorder.periodicNoteType;
        
        // If viewing present, show mapped name
        if (isPresent) {
            return PRESENT_DISPLAY_MAP.get(noteType) || this.selectedNoteName;
        }
        
        // Check if it's the previous period
        const sortedFileNames = Array.from(this.availableNotes.keys()).sort((a, b) => {
            const dateA = this.availableNotes.get(a)!;
            const dateB = this.availableNotes.get(b)!;
            return dateA.valueOf() - dateB.valueOf();
        });
        
        const currentIndex = sortedFileNames.indexOf(this.selectedNoteName);
        const presentIndex = sortedFileNames.indexOf(presentFileName);
        
        // If it's exactly one position before present, check if it's the previous period
        if (currentIndex === presentIndex - 1) {
            const currentMoment = this.availableNotes.get(this.selectedNoteName);
            const presentMoment = moment();
            
            if (currentMoment) {
                let isPreviousPeriod = false;
                
                switch (noteType) {
                    case 'daily note':
                        isPreviousPeriod = currentMoment.isSame(presentMoment.clone().subtract(1, 'day'), 'day');
                        break;
                    case 'weekly note':
                        isPreviousPeriod = currentMoment.isSame(presentMoment.clone().subtract(1, 'week'), 'week');
                        break;
                    case 'monthly note':
                        isPreviousPeriod = currentMoment.isSame(presentMoment.clone().subtract(1, 'month'), 'month');
                        break;
                    case 'quarterly note':
                        isPreviousPeriod = currentMoment.isSame(presentMoment.clone().subtract(3, 'months'), 'month');
                        break;
                    case 'semesterly note':
                        isPreviousPeriod = currentMoment.isSame(presentMoment.clone().subtract(6, 'months'), 'month');
                        break;
                    case 'yearly note':
                        isPreviousPeriod = currentMoment.isSame(presentMoment.clone().subtract(1, 'year'), 'year');
                        break;
                }
                
                if (isPreviousPeriod) {
                    return PREVIOUS_DISPLAY_MAP.get(noteType) || this.selectedNoteName;
                }
            }
        }
        
        // Otherwise show the actual filename
        return this.selectedNoteName;
    }

    private async updateNotesMap(): Promise<void> {
        // Initialize selectedRecorder if not set yet (fixes mobile startup issue)
        if (!this.selectedRecorder) {
            this.initRecorderDropdown();
        }
        
        // Safety check after initialization attempt
        if (!this.selectedRecorder) return;
        
        this.availableNotes.clear();
        const format = this.selectedRecorder.periodicNoteFormat;
        
        if (this.selectedRecorder.enableDynamicFolder) {
            // Dynamic folder: find folders matching the pattern
            const folderPattern = this.selectedRecorder.periodicNoteFolder;
            const allFolders = this.plugin.app.vault.getAllFolders();
            
            // Parse folder names to get dates and sort
            const folderDates: Array<{folder: TFolder, date: moment.Moment}> = [];
            for (const folder of allFolders) {
                const folderName = folder.name;
                const parsedDate = moment(folderName, folderPattern, true);
                if (parsedDate.isValid()) {
                    folderDates.push({folder, date: parsedDate});
                }
            }
            
            // Sort by date
            folderDates.sort((a, b) => b.date.valueOf() - a.date.valueOf());
            
            // Find notes in all matching folders
            for (const {folder} of folderDates) {
                const files = folder.children.filter(f => f instanceof TFile && f.extension === 'md') as TFile[];
                for (const file of files) {
                    const fileName = file.basename;
                    const parsedDate = moment(fileName, format, true);
                    if (parsedDate.isValid()) {
                        this.availableNotes.set(fileName, parsedDate);
                    }
                }
            }
        } else {
            // Static folder: find all notes in the specified folder
            const folderPath = this.selectedRecorder.parseRecordNoteFolderPath();
            const folder = folderPath === '' 
                ? this.plugin.app.vault.getRoot() 
                : this.plugin.app.vault.getFolderByPath(folderPath);
            
            if (folder) {
                const files = folder.children.filter(f => f instanceof TFile && f.extension === 'md') as TFile[];
                
                for (const file of files) {
                    const fileName = file.basename;
                    const parsedDate = moment(fileName, format, true);
                    if (parsedDate.isValid()) {
                        this.availableNotes.set(fileName, parsedDate);
                    }
                }
            }
        }
        
        // Always add today to the list (even if the note doesn't exist)
        const today = moment();
        const todayFileName = today.format(format);
        
        if (!this.availableNotes.has(todayFileName)) {
            this.availableNotes.set(todayFileName, today);
        }
        
        // Initialize currentViewFileName if not set
        if (!this.selectedNoteName) {
            this.selectedNoteName = todayFileName;
        }
    }

    private updateNavigationButtons(): void {
        if (!this.selectedRecorder) return;
        
        // Sort by the moment values
        const sortedFileNames = Array.from(this.availableNotes.keys()).sort((a, b) => {
            const dateA = this.availableNotes.get(a)!;
            const dateB = this.availableNotes.get(b)!;
            return dateA.valueOf() - dateB.valueOf();
        });
        
        const currentIndex = sortedFileNames.indexOf(this.selectedNoteName);
        
        const hasPrevious = currentIndex > 0;
        const hasNext = currentIndex >= 0 && currentIndex < sortedFileNames.length - 1;
        const todayFileName = moment().format(this.selectedRecorder.periodicNoteFormat);
        const isToday = this.selectedNoteName === todayFileName;
        
        this.prevNoteButton.style.display = hasPrevious ? '' : 'none';
        this.nextNoteButton.style.display = hasNext ? '' : 'none';
        this.presentButton.style.display = isToday ? 'none' : '';
    }

    private async navigateToPrevious(): Promise<void> {
        if (!this.selectedRecorder) return;
        
        const sortedFileNames = Array.from(this.availableNotes.keys()).sort((a, b) => {
            const dateA = this.availableNotes.get(a)!;
            const dateB = this.availableNotes.get(b)!;
            return dateA.valueOf() - dateB.valueOf();
        });
        const currentIndex = sortedFileNames.indexOf(this.selectedNoteName);
        
        if (currentIndex > 0) {
            const prevFileName = sortedFileNames[currentIndex - 1];
            this.selectedNoteName = prevFileName;
            
            this.updatePeriodicNoteName();
            this.updateNavigationButtons();
            await this.updateData();
        }
    }

    private async navigateToNext(): Promise<void> {
        if (!this.selectedRecorder) return;
        
        const sortedFileNames = Array.from(this.availableNotes.keys()).sort((a, b) => {
            const dateA = this.availableNotes.get(a)!;
            const dateB = this.availableNotes.get(b)!;
            return dateA.valueOf() - dateB.valueOf();
        });
        const currentIndex = sortedFileNames.indexOf(this.selectedNoteName);
        
        if (currentIndex >= 0 && currentIndex < sortedFileNames.length - 1) {
            const nextFileName = sortedFileNames[currentIndex + 1];
            this.selectedNoteName = nextFileName;
            
            this.updatePeriodicNoteName();
            this.updateNavigationButtons();
            await this.updateData();
        }
    }

    private async navigateToToday(): Promise<void> {
        if (!this.selectedRecorder) return;
        
        this.selectedNoteName = moment().format(this.selectedRecorder.periodicNoteFormat);
        
        this.updatePeriodicNoteName();
        await this.updateNotesMap();
        this.updateNavigationButtons();
        await this.updateData();
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

        await this.updateNotesMap();
        await this.updateUIandData();
    }

    public async updateUIandData() {
        if (!this.dataContainer) return;

        this.initRecorderDropdown();
        await this.initFieldDropDown();
        this.updatePeriodicNoteName();
        this.updateNavigationButtons();
        await this.updateViewSwitcher();
    }

    /**
     * Update view switcher buttons visibility based on recorder type
     */
    private async updateViewSwitcher() {
        if (!this.viewSwitcher || !this.selectedRecorder) return;
        
        const heatmapBtn = this.viewSwitcher.querySelector('[data-view="heatmap"]') as HTMLElement;
        if (!heatmapBtn) return;
        
        // Only show heatmap button for daily notes
        const isDailyNote = this.selectedRecorder.periodicNoteType === 'daily note';
        
        let needsRerender = false;
        
        if (isDailyNote) {
            heatmapBtn.style.display = '';
        } else {
            heatmapBtn.style.display = 'none';
            // If currently in heatmap view, switch to file-list view
            if (this.currentView === 'heatmap') {
                this.currentView = 'file-list';
                this.viewSwitcher.querySelectorAll('.view-switch-btn').forEach(b => b.removeClass('active'));
                const fileViewBtn = this.viewSwitcher.querySelector('[data-view="file-list"]') as HTMLElement;
                if (fileViewBtn) {
                    fileViewBtn.addClass('active');
                }
                needsRerender = true;
            }
        }
        
        // Update last-visible class for proper border radius
        const allButtons = this.viewSwitcher.querySelectorAll('.view-switch-btn') as NodeListOf<HTMLElement>;
        let lastVisibleBtn: HTMLElement | null = null;
        
        allButtons.forEach(btn => {
            btn.removeClass('last-visible');
            if (btn.style.display !== 'none') {
                lastVisibleBtn = btn;
            }
        });
        
        if (lastVisibleBtn) {
            (lastVisibleBtn as HTMLElement).addClass('last-visible');
        }
        
        // Re-render if view was changed
        if (needsRerender && this.selectedField) {
            await this.renderData(this.selectedField);
        }
    }

    /**
     * Update colors only for files with configured tags
     */
    public async updateTaggedColorMap(): Promise<void> {
        if (!this.dataMap) return;
        
        const configuredTags = this.plugin.settings.tagColors.flatMap(config => config.tags || []);
        const allFilesWithTags = this.tagColorManager.buildFilesWithTagsMap(this.plugin.app, this.dataMap);
        
        this.dataMap.forEach((data, filePath) => {
            const file = this.plugin.app.vault.getFileByPath(filePath);
            if (!file) {
                this.plugin.executeOnce(`fileNotFound:${filePath}`, ()=>{
                    console.warn(`⚠️ [Wordflow Tracker] File not found: ${filePath}. This file may have been renamed or moved, but the periodic note index was not updated.`);
                    new Notice(this.plugin.i18n.t('notices.fileNotFound', { filePath: filePath }));
                })
                return; // equal to term continue in a loop, not early return
            }
            
            const fileTags = this.tagColorManager.getFileTags(this.plugin.app, file);
            const hasConfiguredTags = fileTags.some(tag => {
                const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                return configuredTags.includes(cleanTag);
            });
            
            if (hasConfiguredTags) {
                const color = this.tagColorManager.getFileColor(fileTags, filePath, allFilesWithTags);
                this.colorMap.set(filePath, color);
            }
        });
    }

    /**
     * Update colors only for files without configured tags (preserve existing random colors)
     */
    public updateUnconfiguredColorMap() {
        if (!this.dataMap) return;
        
        const configuredTags = this.plugin.settings.tagColors.flatMap(config => config.tags || []);
        
        this.dataMap.forEach((data, filePath) => {
            const file = this.plugin.app.vault.getFileByPath(filePath);
            if (!file) {
                this.plugin.executeOnce(`fileNotFound:${filePath}`, ()=>{
                    console.warn(`⚠️ [Wordflow Tracker] File not found: ${filePath}. This file may have been renamed or moved, but the periodic note index was not updated.`);
                    new Notice(this.plugin.i18n.t('notices.fileNotFound', { filePath: filePath }));
                })
                return; // equal to term continue in a loop, not early return
            }
            
            const fileTags = this.tagColorManager.getFileTags(this.plugin.app, file);
            const hasConfiguredTags = fileTags.some(tag => {
                const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                return configuredTags.includes(cleanTag);
            });
            
            if (!hasConfiguredTags) {
                // Only generate new color if not already exists
                const color = this.colorGenerator.generate();
                this.colorMap.set(filePath, color);
            }
        });
    }

    /**
     * Append color for a new file, automatically determining configured vs unconfigured tags
     */
    public appendToColorMap(filePath: string) {
        if (!this.dataMap) return;
        if (this.colorMap.has(filePath)) return; // Skip if already exists
        
        const fileToAppend = this.plugin.app.vault.getFileByPath(filePath);
        if (!fileToAppend) {
            this.plugin.executeOnce(`fileNotFound:${filePath}`, ()=>{
                console.warn(`⚠️ [Wordflow Tracker] File not found: ${filePath}. This file may have been renamed or moved, but the periodic note index was not updated.`);
                new Notice(this.plugin.i18n.t('notices.fileNotFound', { filePath: filePath }));
            })
            return;
        }
        
        const configuredTags = this.plugin.settings.tagColors.flatMap(config => config.tags || []);
        
        // Create extended dataMap that includes the new file for accurate saturation calculation
        const extendedDataMap = new Map(this.dataMap);
        if (!extendedDataMap.has(filePath)) {
            extendedDataMap.set(filePath, {} as any); // Add placeholder data
        }
        
        const allFilesWithTags = this.tagColorManager.buildFilesWithTagsMap(this.plugin.app, extendedDataMap);
        
        const fileTags = this.tagColorManager.getFileTags(this.plugin.app, fileToAppend);
        const hasConfiguredTags = fileTags.some(tag => {
            const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
            return configuredTags.includes(cleanTag);
        });
        
        let color: string;
        if (hasConfiguredTags) {
            // Tagged file: use tag-based color calculation with extended dataMap
            color = this.tagColorManager.getFileColor(fileTags, filePath, allFilesWithTags);
        } else {
            // Unconfigured tags file: use random color
            color = this.colorGenerator.generate();
        }
        
        this.colorMap.set(filePath, color);
    }

    public async updateTagColors() {
        this.tagColorManager.updateTagColors(this.plugin.settings.tagColors);
        await this.updateDataMap();
        await this.updateTaggedColorMap(); // must update color first
        this.updateData();
    }

    private initRecorderDropdown() {
        this.recorderDropdown.clear();
        let availableRecorders = 0;
        const recorders = this.plugin.recorderManager.getRecorders();

        for (let index = 0; index < recorders.length; ++index){
            if (recorders[index].getParser() instanceof MetaDataParser) continue;
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
            this.selectedRecorder = recorders[defaultIndex];
            this.selectedNoteName = moment().format(this.selectedRecorder.periodicNoteFormat);
            this.recorderDropdown.setValue(defaultIndex.toString());
        }

        this.recorderDropdown.onChange(async (value) => {
            this.selectedRecorder = recorders[parseInt(value)];
            this.selectedNoteName = moment().format(this.selectedRecorder.periodicNoteFormat);
            await this.updateAll(); // Redraw the entire widget when recorder changes
            this.recorderDropdown.setValue(value); // put after draw to render correct selection
        });
    }

    private async initFieldDropDown(){
        const fieldOptions = this.getFieldOptions();

        // Clear and rebuild options
        this.fieldDropdown.clear();
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
            this.selectedField = value;
            await this.renderData(value);
            this.updateCurrentData();
        });
    }

    private async updateDataMap(): Promise<void> {
        this.dataMap = await this.getDataMap(this.selectedField); // this.selectedField here can be ignored, which is a historic issue 
    }

    private async renderData(field: string | null) {
        this.dataContainer.empty();
        if (!this.dataMap || !field) {
            // Only show no data message for non-heatmap views
            if (this.currentView !== 'heatmap') {
                this.dataContainer.createEl('span', { text: this.plugin.i18n.t('widget.prompts.noData'), cls: 'wordflow-widget-no-data-message'});
            }
            this.totalDataContainer.textContent = (field === 'editTime' || field === 'readTime' || field === 'readEditTime')
                ? formatTime(0)
                : "0";
            
            // Render empty heatmap if in heatmap view
            if (this.currentView === 'heatmap') {
                await this.renderHeatmap(field || 'editedWords');
            }
            return;
        }

        if (this.dataMap.size === 0) {
            // Only show no data message for non-heatmap views
            if (this.currentView !== 'heatmap') {
                this.dataContainer.createEl('span', { text: this.plugin.i18n.t('widget.prompts.noData'), cls: 'wordflow-widget-no-data-message'});
            }
            this.totalDataContainer.textContent = (field === 'editTime' || field === 'readTime' || field === 'readEditTime')
                ? formatTime(0)
                : "0";
            
            // Render empty heatmap if in heatmap view
            if (this.currentView === 'heatmap') {
                await this.renderHeatmap(field);
            }
            return;
        }

        const sortedData = await this.getSortedData(field);

        // Calculate the total value for the current field across all entries
        this.totalFieldValue = 0;
        sortedData.forEach(rowData => {
                this.totalFieldValue += this.getFieldValue(rowData, field);
        });

        // check if selected field has value but all zero
        if (this.totalFieldValue === 0) {
            // Only show no data message for non-heatmap views
            if (this.currentView !== 'heatmap') {
                this.dataContainer.createEl('span', { text: this.plugin.i18n.t('widget.prompts.noDataForField'), cls: 'wordflow-widget-no-data-message'});
            }
            this.totalDataContainer.textContent = (field === 'editTime' || field === 'readTime' || field === 'readEditTime')
                ? formatTime(0)
                : "0";
            
            // Render empty heatmap if in heatmap view
            if (this.currentView === 'heatmap') {
                await this.renderHeatmap(field);
            }
            return;
        }

        this.totalDataContainer.textContent = (field == 'editTime' || field == 'readTime' || field == 'readEditTime')
            ? formatTime(this.totalFieldValue)
            : this.totalFieldValue.toString();

        // Render based on current view mode
        switch (this.currentView) {
            case 'file-list':
                this.renderSingleLayerProgressBar(sortedData, field);
                break;
            case 'tag-list':
                this.renderDualLayerProgressBar(sortedData, field);
                break;
            case 'heatmap':
                await this.renderHeatmap(field);
                break;
        }
    }

    private renderSingleLayerProgressBar(sortedData: ExistingData[], field: string) {
        const totalProgressBarContainer = this.dataContainer.createDiv({ 
            cls: 'wordflow-widget-total-progress-bar-container' 
        });

        // Reuse existing logic for single layer
        this.renderProgressBarSegments(totalProgressBarContainer, sortedData, field);
        this.renderFileDataRows(sortedData, field);
    }

    private renderDualLayerProgressBar(sortedData: ExistingData[], field: string) {
        // Calculate tag groups and file data
        const { tagGroups, unconfiguredTagsFiles } = this.calculateTagGroupData(sortedData, field);
        const fileData = this.calculateFileData(sortedData, field);

        // Create dual-layer container
        const dualLayerContainer = this.dataContainer.createDiv({ 
            cls: 'wordflow-widget-dual-layer-container' 
        });

        // Upper layer: Tag groups (80% height)
        const tagLayerContainer = dualLayerContainer.createDiv({ 
            cls: 'wordflow-widget-tag-layer-container' 
        });

        // Render tag groups
        this.renderTagSegments(tagLayerContainer, tagGroups, unconfiguredTagsFiles, field);

        // Lower layer: Individual files (20% height)
        const fileLayerContainer = dualLayerContainer.createDiv({ 
            cls: 'wordflow-widget-file-layer-container' 
        });

        // Render files sorted by total size
        this.renderFileSegments(fileLayerContainer, fileData, field);

        // Render hierarchical tag-based list instead of flat file list
        this.renderTagGroupList(tagGroups, unconfiguredTagsFiles, sortedData, field);
    }

    private renderProgressBarSegments(container: HTMLElement, sortedData: ExistingData[], field: string) {
        sortedData.forEach(rowData => {
            const value = this.getFieldValue(rowData, field);
            let percentage = 0;
            if (this.totalFieldValue > 0) {
                percentage = (value / this.totalFieldValue) * 100;
            }

            if (!this.colorMap.has(rowData.filePath)) {
                this.appendToColorMap(rowData.filePath);
            }
            let barColor = this.colorMap.get(rowData.filePath)?? 'initial'; // 'initial' is useless, only for passing the compiler warning. 

            // add to total progress bar
            const segment = container.createDiv({ 
                cls: 'wordflow-widget-progress-bar-segment' 
            });
            
            segment.style.width = `${percentage}%`;
            segment.style.backgroundColor = barColor;
        });
    }

    private renderTagSegments(container: HTMLElement, tagGroups: TagGroupData[], unconfiguredTagsFiles: { totalWeight: number }, field: string) {
        // Render configured tag groups
        tagGroups.forEach((tagGroup, index) => {
            const percentage = this.totalFieldValue > 0 ? (tagGroup.totalWeight / this.totalFieldValue) * 100 : 0;
            
            const tagSegment = container.createDiv({ 
                cls: 'wordflow-widget-tag-segment' 
            });
            tagSegment.style.width = `${percentage}%`;
            tagSegment.style.backgroundColor = tagGroup.color;
            
            // 使用 Obsidian 的 setTooltip 方法
            setTooltip(tagSegment, tagGroup.tagName, {
                placement: 'top',
                delay: 300
            });
            
            // 添加交互逻辑 - 存储标签组信息
            tagSegment.dataset.tagGroupIndex = index.toString();
            tagSegment.dataset.tagGroupName = tagGroup.tagName;
            tagSegment.addEventListener('mouseenter', () => this.handleHover(tagGroup, true));
            tagSegment.addEventListener('mouseleave', () => this.handleHover(tagGroup, false));
            
            // 添加点击事件 - 自动折叠其他标签组并展开当前标签组
            tagSegment.addEventListener('click', () => this.handleTagSegmentClick(tagGroup.tagName));
        });

        // Render unconfigured tags files with medium-light grey
        if (unconfiguredTagsFiles.totalWeight > 0) {
            const percentage = this.totalFieldValue > 0 ? (unconfiguredTagsFiles.totalWeight / this.totalFieldValue) * 100 : 0;
            
            const unconfiguredSegment = container.createDiv({ 
                cls: 'wordflow-widget-tag-segment' 
            });
            unconfiguredSegment.style.width = `${percentage}%`;
            unconfiguredSegment.style.backgroundColor = '#999999'; // Medium-light grey
            
            // 使用 Obsidian 的 setTooltip 方法
            setTooltip(unconfiguredSegment, this.plugin.i18n.t('widget.prompts.unconfiguredTags'), {
                placement: 'top',
                delay: 300
            });
            
            // 添加无配置标签文件的交互逻辑 - 标记为无配置段落
            unconfiguredSegment.dataset.isUnconfigured = 'true';
            unconfiguredSegment.addEventListener('mouseenter', () => this.handleHover(null, true));
            unconfiguredSegment.addEventListener('mouseleave', () => this.handleHover(null, false));
            
            // 添加点击事件 - 自动折叠其他标签组并展开无配置标签组
            unconfiguredSegment.addEventListener('click', () => this.handleTagSegmentClick(this.plugin.i18n.t('widget.prompts.unconfiguredTags')));
        }
    }

    private renderFileSegments(container: HTMLElement, fileData: FileData[], field: string) {
        fileData.forEach(file => {
            const percentage = this.totalFieldValue > 0 ? (file.value / this.totalFieldValue) * 100 : 0;
            
            const fileSegment = container.createDiv({ 
                cls: 'wordflow-widget-file-segment' 
            });
            fileSegment.style.width = `${percentage}%`;
            fileSegment.style.backgroundColor = file.color;
            
            // 使用 Obsidian 的 setTooltip 方法
            setTooltip(fileSegment, `${file.fileName}: ${this.formatValue(file.value, field)}`, {
                delay: 300
            });
            
            // 添加文件路径数据属性，用于交互逻辑
            fileSegment.dataset.filePath = file.filePath;
        });
    }

    private renderFileDataRows(sortedData: ExistingData[], field: string) {
        // Reuse existing data row rendering logic
        sortedData.forEach(rowData => {
            const value = this.getFieldValue(rowData, field);
            const valueString = this.formatValue(value, field);

            if (!this.colorMap.has(rowData.filePath)) {
                this.appendToColorMap(rowData.filePath);
            }
            let barColor = this.colorMap.get(rowData.filePath)?? 'initial';

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

            // Add tooltip for filename on the left side
            setTooltip(filePathSpan, 'click to open', {
                placement: 'left',
                delay: 500
            });

            const rowText = dataRow.createEl('span', { text: valueString, cls: `wordflow-widget-data-row-value`});
            rowText.style.color = barColor;
        });
    }

    /**
     * Render file data rows within a tag group using original logic with modifications
     * This is a specialized version of renderFileDataRows for tag group context
     */
    private renderFileDataRowsInTagGroup(container: HTMLElement, sortedData: ExistingData[], field: string) {
        // Reuse original logic but with container modifications for tag group context
        sortedData.forEach(rowData => {
            const value = this.getFieldValue(rowData, field);
            const valueString = this.formatValue(value, field);

            if (!this.colorMap.has(rowData.filePath)) {
                this.appendToColorMap(rowData.filePath);
            }
            let barColor = this.colorMap.get(rowData.filePath) ?? 'initial';

            // Create data row with tag group specific styling
            const dataRow = container.createDiv({ cls: 'wordflow-widget-data-row wordflow-widget-tag-group-file-row' });

            const circleSpan = dataRow.createEl('span', { cls: 'wordflow-widget-data-row-circle' });
            circleSpan.style.backgroundColor = barColor;

            const filePathSpan = dataRow.createEl('span', { cls: 'wordflow-widget-data-row-file-path' });
            filePathSpan.dataset.filePath = rowData.filePath;
            filePathSpan.dataset.fileName = 
                (rowData.fileName !== 'unknown')
                    ? rowData.fileName
                    : this.app.vault.getFileByPath(rowData.filePath)?.basename ?? 'file deleted';
            filePathSpan.textContent = filePathSpan.dataset.fileName;

            // Add tooltip for filename on the left side
            setTooltip(filePathSpan, 'click to open', {
                placement: 'left',
                delay: 500
            });

            // Create middle container for tags (positioned between filename and value)
            const middleContainer = dataRow.createEl('span', { cls: 'wordflow-widget-middle-container' });

            // Add source tags for tagged files (in middle container)
            const file = this.plugin.app.vault.getFileByPath(rowData.filePath);
            if (file) {
                const fileTags = this.tagColorManager.getFileTags(this.plugin.app, file);
                const configuredTags = this.plugin.settings.tagColors.flatMap(config => config.tags || []);
                
                // Show only configured tags
                const relevantTags = fileTags.filter(tag => {
                    const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                    return configuredTags.includes(cleanTag);
                });

                if (relevantTags.length > 0) {
                    const sourceTagsContainer = middleContainer.createEl('span', { cls: 'wordflow-widget-source-tags-container' });
                    relevantTags.forEach(tag => {
                        const tagPill = sourceTagsContainer.createEl('span', { 
                            cls: 'wordflow-widget-source-tag-pill',
                            text: tag.startsWith('#') ? tag : `#${tag}`
                        });
                    });
                }
            }

            // Value always on the right
            const rowText = dataRow.createEl('span', { text: valueString, cls: `wordflow-widget-data-row-value`});
            rowText.style.color = barColor;
        });
    }

    /**
     * Render hierarchical tag-based list with collapsible tag groups
     */
    private renderTagGroupList(tagGroups: TagGroupData[], unconfiguredTagsFiles: { totalWeight: number }, sortedData: ExistingData[], field: string) {
        const listContainer = this.dataContainer.createDiv({ cls: 'wordflow-widget-tag-list-container' });

        // Render configured tag groups
        tagGroups.forEach((tagGroup, index) => {
            this.renderTagGroupRow(listContainer, tagGroup, sortedData, field);
        });

        // Render unconfigured tags files group if exists (treat as special tag group)
        if (unconfiguredTagsFiles.totalWeight > 0) {
            // Create a special tag group for unconfigured tags files
            const unconfiguredGroup: TagGroupData = {
                tagName: this.plugin.i18n.t('widget.prompts.unconfiguredTags'),
                totalWeight: unconfiguredTagsFiles.totalWeight,
                color: '#999999',
                files: [] // Will be calculated in renderTagGroupRow
            };
            this.renderTagGroupRow(listContainer, unconfiguredGroup, sortedData, field, true);
        }
    }

    /**
     * Render a single tag group row (works for both configured and unconfigured groups)
     */
    private renderTagGroupRow(container: HTMLElement, tagGroup: TagGroupData, sortedData: ExistingData[], field: string, isUnconfiguredGroup: boolean = false) {
        // Create tag group row
        const tagRow = container.createDiv({ 
            cls: isUnconfiguredGroup ? 'wordflow-widget-tag-group-row wordflow-widget-unconfigured-group' : 'wordflow-widget-tag-group-row'
        });
        tagRow.dataset.collapsed = 'true'; // Default collapsed

        // Left: HSL color dot
        const colorDot = tagRow.createEl('span', { cls: 'wordflow-widget-tag-group-color-dot' });
        colorDot.style.backgroundColor = tagGroup.color;

        // Middle: Tag name (plain text)
        const tagName = tagRow.createEl('span', { cls: 'wordflow-widget-tag-group-name' });
        tagName.textContent = tagGroup.tagName;

        // Right: Expand/collapse arrow indicator
        const arrowIndicator = tagRow.createEl('span', { cls: 'wordflow-widget-tag-group-arrow' });
        arrowIndicator.innerHTML = '▼'; // Down arrow for collapsed state

        // Create collapsible file list container with vertical line
        const fileListContainer = container.createDiv({ 
            cls: isUnconfiguredGroup ? 'wordflow-widget-tag-files-container wordflow-widget-unconfigured-files-container' : 'wordflow-widget-tag-files-container'
        });
        fileListContainer.style.display = 'none'; // Initially hidden

        // Filter files based on group type
        let groupFiles: ExistingData[];
        if (isUnconfiguredGroup) {
            // Filter unconfigured tags files
            const configuredTags = this.plugin.settings.tagColors.flatMap(config => config.tags || []);
            groupFiles = sortedData.filter(rowData => {
                const file = this.plugin.app.vault.getFileByPath(rowData.filePath);
                if (!file) return true; // Treat deleted files as unconfigured
                
                const fileTags = this.tagColorManager.getFileTags(this.plugin.app, file);
                const hasConfiguredTags = fileTags.some(tag => {
                    const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                    return configuredTags.includes(cleanTag);
                });
                
                return !hasConfiguredTags;
            });
        } else {
            // Filter files that belong to this configured tag group
            groupFiles = sortedData.filter(rowData => 
                tagGroup.files.includes(rowData.filePath)
            );
        }

        // Use original renderFileDataRows logic but with modified container and styling
        this.renderFileDataRowsInTagGroup(fileListContainer, groupFiles, field);

        // Add click handler for expand/collapse
        tagRow.addEventListener('click', () => {
            const isCollapsed = tagRow.dataset.collapsed === 'true';
            tagRow.dataset.collapsed = isCollapsed ? 'false' : 'true';
            fileListContainer.style.display = isCollapsed ? 'block' : 'none';
            
            // Update arrow direction
            arrowIndicator.innerHTML = isCollapsed ? '▲' : '▼';
        });
    }

    private calculateTagGroupData(sortedData: ExistingData[], field: string): { tagGroups: TagGroupData[], unconfiguredTagsFiles: { totalWeight: number } } {
        // 为每个标签配置创建一个组
        const tagColorGroups: TagGroupData[] = this.plugin.settings.tagColors.map(config => ({
            tagName: config.groupName || config.tags?.join('  ') || 'Unknown',
            totalWeight: 0,
            color: config.color || '#3366cc',
            files: []
        }));
        
        let unconfiguredTotalWeight = 0;

        sortedData.forEach(rowData => {
            const file = this.plugin.app.vault.getFileByPath(rowData.filePath);
            if (!file) return;

            const fileTags = this.tagColorManager.getFileTags(this.plugin.app, file);
            const fileValue = this.getFieldValue(rowData, field);
            
            // 找到文件匹配的标签配置组
            const matchingConfigIndices: number[] = [];
            this.plugin.settings.tagColors.forEach((config, configIndex) => {
                const hasMatchingTag = config.tags?.some(configTag => 
                    fileTags.some(fileTag => {
                        const cleanFileTag = fileTag.startsWith('#') ? fileTag.slice(1) : fileTag;
                        return cleanFileTag === configTag;
                    })
                );
                if (hasMatchingTag) {
                    matchingConfigIndices.push(configIndex);
                }
            });

            if (matchingConfigIndices.length === 0) {
                // 无匹配标签配置的文件
                unconfiguredTotalWeight += fileValue;
            } else {
                // 有匹配标签配置的文件 - 按配置组分配权重
                const weightPerConfig = fileValue / matchingConfigIndices.length;
                
                matchingConfigIndices.forEach(configIndex => {
                    const tagGroup = tagColorGroups[configIndex];
                    tagGroup.totalWeight += weightPerConfig;
                    if (!tagGroup.files.includes(rowData.filePath)) {
                        tagGroup.files.push(rowData.filePath);
                    }
                });
            }
        });

        // 过滤掉权重为0的组，然后按权重排序
        const activeTagGroups = tagColorGroups
            .filter(group => group.totalWeight > 0)
            .sort((a, b) => b.totalWeight - a.totalWeight);

        return { 
            tagGroups: activeTagGroups, 
            unconfiguredTagsFiles: { totalWeight: unconfiguredTotalWeight } 
        };
    }

    private calculateFileData(sortedData: ExistingData[], field: string): FileData[] {
        const configuredTags = this.plugin.settings.tagColors.flatMap(config => config.tags || []);
        const allFilesWithTags = this.tagColorManager.buildFilesWithTagsMap(this.plugin.app, this.dataMap!);

        const fileData: FileData[] = sortedData.map(rowData => {
            const file = this.plugin.app.vault.getFileByPath(rowData.filePath);
            const fileTags = file ? this.tagColorManager.getFileTags(this.plugin.app, file) : [];
            const fileValue = this.getFieldValue(rowData, field);
            
            // Determine file color (reuse existing color logic)
            const hasConfiguredTags = fileTags.some(tag => {
                const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                return configuredTags.includes(cleanTag);
            });

            let fileColor: string;
            if (hasConfiguredTags) {
                fileColor = this.tagColorManager.getFileColor(fileTags, rowData.filePath, allFilesWithTags);
            } else {
                if (!this.colorMap.has(rowData.filePath)) {
                    this.appendToColorMap(rowData.filePath);
                }
                fileColor = this.colorMap.get(rowData.filePath) || '#666666';
            }

            return {
                filePath: rowData.filePath,
                fileName: rowData.fileName !== 'unknown' ? 
                    rowData.fileName : 
                    file?.basename || 'file deleted',
                value: fileValue,
                color: fileColor
            };
        });

        // Sort by file total size (descending)
        return fileData.sort((a, b) => b.value - a.value);
    }

    private formatValue(value: number, field: string): string {
        return (field === 'editTime' || field === 'readTime' || field === 'readEditTime')
            ? formatTime(value, false)
            : value.toString();
    }

    /**
     * Handle click on tag segment in progress bar
     * Collapse all other tag groups and expand the clicked one if collapsed
     */
    private handleTagSegmentClick(clickedTagName: string) {
        // Find all tag group rows in the list
        const tagGroupRows = this.dataContainer.querySelectorAll('.wordflow-widget-tag-group-row') as NodeListOf<HTMLElement>;
        
        tagGroupRows.forEach(tagRow => {
            const tagNameElement = tagRow.querySelector('.wordflow-widget-tag-group-name') as HTMLElement;
            const arrowElement = tagRow.querySelector('.wordflow-widget-tag-group-arrow') as HTMLElement;
            const fileListContainer = tagRow.nextElementSibling as HTMLElement;
            
            if (!tagNameElement || !arrowElement || !fileListContainer) return;
            
            const currentTagName = tagNameElement.textContent;
            const isCurrentTag = currentTagName === clickedTagName;
            const isCurrentlyCollapsed = tagRow.dataset.collapsed === 'true';
            
            if (isCurrentTag) {
                // For the clicked tag: expand if collapsed, keep expanded if already expanded
                if (isCurrentlyCollapsed) {
                    tagRow.dataset.collapsed = 'false';
                    fileListContainer.style.display = 'block';
                    arrowElement.innerHTML = '▲';
                }
                // If already expanded, keep it expanded (no change)
            } else {
                // For all other tags: collapse them
                tagRow.dataset.collapsed = 'true';
                fileListContainer.style.display = 'none';
                arrowElement.innerHTML = '▼';
            }
        });
    }

    private handleHover(hoveredTagGroup: TagGroupData | null, isHovering: boolean) {
        // 获取所有文件段落和标签段落
        const fileSegments = this.dataContainer.querySelectorAll('.wordflow-widget-file-segment') as NodeListOf<HTMLElement>;
        const tagSegments = this.dataContainer.querySelectorAll('.wordflow-widget-tag-segment') as NodeListOf<HTMLElement>;
        
        if (isHovering) {
            // 悬浮状态：高亮相关元素，强烈变暗无关元素
            
            // 处理文件段落
            fileSegments.forEach(segment => {
                const filePath = segment.dataset.filePath;
                let shouldHighlight = false;
                
                if (hoveredTagGroup === null) {
                    // 悬浮无配置标签区域：检查文件是否无配置标签
                    if (filePath) {
                        const file = this.plugin.app.vault.getFileByPath(filePath);
                        if (file) {
                            const fileTags = this.tagColorManager.getFileTags(this.plugin.app, file);
                            const configuredTags = this.plugin.settings.tagColors.flatMap(config => config.tags || []);
                            const hasConfiguredTags = fileTags.some(tag => {
                                const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                                return configuredTags.includes(cleanTag);
                            });
                            shouldHighlight = !hasConfiguredTags; // 无配置标签的文件高亮
                        }
                    }
                } else {
                    // 悬浮标签组：检查文件是否属于该标签组
                    shouldHighlight = filePath ? hoveredTagGroup.files.includes(filePath) : false;
                }
                
                if (shouldHighlight) {
                    // 相关文件：高亮显示
                    segment.style.opacity = '1';
                    segment.style.filter = 'brightness(1.05)';
                } else {
                    // 无关文件：强烈变暗变灰
                    segment.style.filter = 'grayscale(30%) brightness(0.75)';
                }
            });
            
            // 处理标签段落
            tagSegments.forEach(segment => {
                let isCurrentHovered = false;
                
                if (hoveredTagGroup === null) {
                    // 悬浮无配置标签区域：检查是否是无配置标签段落
                    isCurrentHovered = segment.dataset.isUnconfigured === 'true';
                } else {
                    // 悬浮标签组：检查是否是当前悬浮的标签组
                    isCurrentHovered = segment.dataset.tagGroupName === hoveredTagGroup.tagName;
                }
                
                if (isCurrentHovered) {
                    // 当前悬浮的标签：保持正常状态
                    segment.style.opacity = '1';
                    segment.style.filter = 'brightness(1.05)';
                } else {
                    // 其他标签：强烈变暗变灰
                    segment.style.filter = 'grayscale(30%) brightness(0.75)';
                }
            });
            
        } else {
            // 离开悬浮：恢复所有元素的正常状态
            fileSegments.forEach(segment => {
                segment.style.opacity = '1';
                segment.style.filter = 'none';
            });
            
            tagSegments.forEach(segment => {
                segment.style.opacity = '1';
                segment.style.filter = 'none';
            });
        }
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

        // Get the moment object for the current view from the availableNotes map
        const viewDate = this.availableNotes.get(this.selectedNoteName);
        
        if (!viewDate) {
            return null;
        }

        const recordNote = this.selectedRecorder.getRecordNote(viewDate.valueOf());

        if (!recordNote) {
            return null;
        }
        
        return await this.selectedRecorder.getParser().extractData(recordNote);
    }

    private async startFocus():Promise<void>{
        this.onFocusMode = true;
        this.updateButtons_Start();
        if (this.plugin.settings.switchToFieldOnFocus !== 'disabled') {
            const newField = this.plugin.settings.switchToFieldOnFocus;
            if (this.getFieldOptions().indexOf(newField) == -1) {
                new Notice(this.plugin.i18n.t('notices.fieldSwitchUnavailable'), 3000);
                return;
            }
            this.fieldDropdown.setValue(newField);
            this.selectedField = newField;
            await this.renderData(newField);
            this.updateCurrentData();
        }
    }

    /**
     * Render heatmap view - GitHub-style calendar heatmap
     */
    private async renderHeatmap(field: string) {
        if (!this.selectedRecorder) return;

        this.dataContainer.empty();
        const heatmapContainer = this.dataContainer.createDiv({ cls: 'wordflow-widget-heatmap-container' });

        // Calculate date range (last 12 weeks by default)
        const weeksToShow = 12;
        const today = moment();
        const endDate = moment(today).endOf('week'); // End at the end of current week
        const startDate = moment(endDate).subtract(weeksToShow - 1, 'weeks').startOf('week'); // Start 12 weeks ago

        // Collect all data for the date range
        const heatmapData = await this.collectHeatmapData(startDate, endDate, field);

        // Render month labels
        const monthLabelsContainer = heatmapContainer.createDiv({ cls: 'wordflow-heatmap-month-labels' });
        this.renderMonthLabels(monthLabelsContainer, startDate, weeksToShow);

        // Create main heatmap grid container
        const gridContainer = heatmapContainer.createDiv({ cls: 'wordflow-heatmap-grid-container' });

        // Render weekday labels
        const weekdayLabelsContainer = gridContainer.createDiv({ cls: 'wordflow-heatmap-weekday-labels' });
        this.renderWeekdayLabels(weekdayLabelsContainer);

        // Render heatmap cells
        const cellsContainer = gridContainer.createDiv({ cls: 'wordflow-heatmap-cells' });
        this.renderHeatmapCells(cellsContainer, startDate, weeksToShow, heatmapData, field);

        // Render legend
        const legendContainer = heatmapContainer.createDiv({ cls: 'wordflow-heatmap-legend' });
        this.renderHeatmapLegend(legendContainer, heatmapData, field);
    }

    /**
     * Collect heatmap data for the specified date range
     */
    private async collectHeatmapData(startDate: moment.Moment, endDate: moment.Moment, field: string): Promise<Map<string, number>> {
        if (!this.selectedRecorder) return new Map();

        const heatmapData = new Map<string, number>();
        const currentDate = moment(startDate);

        while (currentDate.isSameOrBefore(endDate, 'day')) {
            const dateKey = currentDate.format('YYYY-MM-DD');
            const noteFileName = currentDate.format(this.selectedRecorder.periodicNoteFormat);
            
            // Check if note exists for this date
            if (this.availableNotes.has(noteFileName)) {
                const noteMoment = this.availableNotes.get(noteFileName);
                if (noteMoment) {
                    const recordNote = this.selectedRecorder.getRecordNote(noteMoment.valueOf());
                    if (recordNote) {
                        const dataMap = await this.selectedRecorder.getParser().extractData(recordNote);
                        if (dataMap) {
                            // Calculate total value for this date
                            let totalValue = 0;
                            dataMap.forEach(data => {
                                totalValue += this.getFieldValue(data, field);
                            });
                            heatmapData.set(dateKey, totalValue);
                        }
                    }
                }
            }

            currentDate.add(1, 'day');
        }

        return heatmapData;
    }

    /**
     * Render month labels above the heatmap
     */
    private renderMonthLabels(container: HTMLElement, startDate: moment.Moment, weeks: number) {
        const monthsShown = new Set<string>();
        const currentDate = moment(startDate);

        for (let week = 0; week < weeks; week++) {
            const monthKey = currentDate.format('MMM');
            const isFirstWeekOfMonth = currentDate.date() <= 7;

            if (isFirstWeekOfMonth && !monthsShown.has(monthKey)) {
                const monthLabel = container.createEl('span', {
                    cls: 'wordflow-heatmap-month-label',
                    text: monthKey
                });
                monthLabel.style.gridColumn = `${week + 1}`;
                monthsShown.add(monthKey);
            }

            currentDate.add(1, 'week');
        }
    }

    /**
     * Render weekday labels on the left side
     */
    private renderWeekdayLabels(container: HTMLElement) {
        const weekdays = ['Mon', 'Wed', 'Fri'];
        const weekdayIndices = [1, 3, 5]; // Monday, Wednesday, Friday

        weekdayIndices.forEach((dayIndex, index) => {
            const label = container.createEl('span', {
                cls: 'wordflow-heatmap-weekday-label',
                text: weekdays[index]
            });
            label.style.gridRow = `${dayIndex + 1}`;
        });
    }

    /**
     * Render heatmap cells
     */
    private renderHeatmapCells(container: HTMLElement, startDate: moment.Moment, weeks: number, data: Map<string, number>, field: string) {
            const currentDate = moment(startDate);
            const today = moment();
            const todayKey = today.format('YYYY-MM-DD');

            // Get selected note date
            const selectedDate = this.availableNotes.get(this.selectedNoteName);
            const selectedDateKey = selectedDate ? selectedDate.format('YYYY-MM-DD') : null;

            // Collect all non-zero values for intelligent color mapping
            const allValues = Array.from(data.values()).filter(v => v > 0);

            // Create HeatmapColorManager with user settings
            const heatmapColorManager = new HeatmapColorManager(
                this.plugin.settings.heatmapBaseColor,
                this.plugin.settings.heatmapGradientLevels
            );

            for (let week = 0; week < weeks; week++) {
                for (let day = 0; day < 7; day++) {
                    const dateKey = currentDate.format('YYYY-MM-DD');
                    const value = data.get(dateKey) || 0;
                    const isFuture = currentDate.isAfter(today, 'day');
                    const isToday = dateKey === todayKey;
                    const isSelected = dateKey === selectedDateKey && !isToday;

                    const cell = container.createDiv({ cls: 'wordflow-heatmap-cell' });
                    cell.style.gridColumn = `${week + 1}`;
                    cell.style.gridRow = `${day + 1}`;

                    // Mark today's date
                    if (isToday) {
                        cell.addClass('wordflow-heatmap-today');
                    }

                    // Mark selected date (if not today)
                    if (isSelected) {
                        cell.addClass('wordflow-heatmap-selected');
                    }

                    // Mark future dates
                    if (isFuture) {
                        cell.addClass('wordflow-heatmap-future');
                    } else {
                        // Set color dynamically based on value
                        if (value === 0) {
                            cell.style.backgroundColor = 'var(--background-modifier-hover)';
                            cell.style.opacity = '0.6';
                        } else {
                            const color = heatmapColorManager.getColorForValue(value, allValues);
                            cell.style.backgroundColor = color;
                        }
                    }

                    // Add tooltip
                    const formattedValue = this.formatValue(value, field);
                    const noteName = this.selectedRecorder ? currentDate.format(this.selectedRecorder.periodicNoteFormat) : currentDate.format('YYYY-MM-DD');
                    const tooltipText = isFuture ? `${noteName}: Future date` : `${noteName}: ${formattedValue}`;
                    setTooltip(cell, tooltipText, {
                        placement: 'top',
                        delay: 300
                    });

                    // Add click handler to open or create note (only for non-future dates)
                    if (!isFuture) {
                        const cellDate = moment(currentDate); // Capture current date in closure
                        cell.addEventListener('click', async (evt: MouseEvent) => {
                            if (!this.selectedRecorder) return;

                            const targetDate = cellDate.valueOf();
                            const noteFileName = cellDate.format(this.selectedRecorder.periodicNoteFormat);
                            const recordNote = this.selectedRecorder.getRecordNote(targetDate);

                            if (recordNote) {
                                // Note exists, open it and switch to it
                                const inNewTab: boolean = evt.ctrlKey || evt.metaKey;
                                this.plugin.app.workspace.openLinkText(recordNote.path, recordNote.path, inNewTab);
                                
                                // Switch selectedNoteName to the clicked date
                                this.selectedNoteName = noteFileName;
                                this.updatePeriodicNoteName();
                                this.updateNavigationButtons();
                                // Update data to refresh totalDataContainer with new note's data
                                await this.updateData();
                            } else {
                                // Note doesn't exist, show confirmation modal
                                const displayName = noteFileName; // Use the filename as display name
                                const recorder = this.selectedRecorder; // Capture for closure

                                const confirmModal = new ConfirmationModal(
                                    this.app,
                                    this.plugin.i18n.t('notices.noteCreateConfirm', { displayName }),
                                    async () => {
                                        // User confirmed, create the note
                                        const createdNote = await recorder.createRecordNoteIfNotExists(targetDate);
                                        if (createdNote) {
                                            // Open the newly created note
                                            const inNewTab: boolean = evt.ctrlKey || evt.metaKey;
                                            this.plugin.app.workspace.openLinkText(createdNote.path, createdNote.path, inNewTab);
                                            
                                            // Update the notes map to include the newly created note
                                            await this.updateNotesMap();
                                            
                                            // Switch selectedNoteName to the newly created note
                                            this.selectedNoteName = noteFileName;
                                            this.updatePeriodicNoteName();
                                            this.updateNavigationButtons();
                                            // Update data since a new note was created
                                            await this.updateData();
                                        }
                                    }
                                );
                                confirmModal.open();
                            }
                        });

                        // Add hover handler for Ctrl+hover preview (only for existing notes)
                        cell.addEventListener('mouseover', (evt: MouseEvent) => {
                            if (!this.selectedRecorder) return;
                            if (!(evt.ctrlKey || evt.metaKey)) return;

                            const targetDate = cellDate.valueOf();
                            const recordNote = this.selectedRecorder.getRecordNote(targetDate);

                            if (recordNote) {
                                // Trigger Obsidian's hover preview
                                this.plugin.app.workspace.trigger('hover-link', {
                                    event: evt,
                                    source: 'wordflow-widget',
                                    hoverParent: this,
                                    targetEl: cell,
                                    linktext: recordNote.path,
                                    sourcePath: recordNote.path
                                });
                            }
                        });
                    }

                    currentDate.add(1, 'day');
                }
            }
        }


    /**
     * Render heatmap legend
     */
    private renderHeatmapLegend(container: HTMLElement, data: Map<string, number>, field: string) {
            const legendLabel = container.createEl('span', {
                cls: 'wordflow-heatmap-legend-label',
                text: 'Less'
            });

            // Get all non-zero values for color mapping
            const allValues = Array.from(data.values()).filter(v => v > 0);

            // Create HeatmapColorManager with user settings
            const heatmapColorManager = new HeatmapColorManager(
                this.plugin.settings.heatmapBaseColor,
                this.plugin.settings.heatmapGradientLevels
            );

            // Get color scale
            const colorScale = heatmapColorManager.getColorScale();

            // Calculate value ranges for each color level
            let minValue: number;
            let maxValue: number;

            if (allValues.length === 0) {
                minValue = 0;
                maxValue = 0;
            } else if (allValues.length === 1) {
                minValue = allValues[0];
                maxValue = allValues[0];
            } else {
                const sortedValues = [...allValues].sort((a, b) => a - b);
                if (sortedValues.length <= 6) {
                    minValue = sortedValues[0];
                    maxValue = sortedValues[sortedValues.length - 1];
                } else {
                    minValue = sortedValues[3];
                    maxValue = sortedValues[sortedValues.length - 4];
                }
            }

            // Render legend cells based on gradient levels
            // Level 0 (no data)
            const legendCell0 = container.createDiv({
                cls: 'wordflow-heatmap-legend-cell'
            });
            legendCell0.style.backgroundColor = 'var(--background-modifier-hover)';
            legendCell0.style.opacity = '0.6';

            // Add tooltip for zero value
            setTooltip(legendCell0, 'no data or 0', {
                placement: 'bottom',
                delay: 300
            });

            // Render gradient levels with tooltips
            for (let i = 0; i < colorScale.length; i++) {
                const legendCell = container.createDiv({
                    cls: 'wordflow-heatmap-legend-cell'
                });
                legendCell.style.backgroundColor = colorScale[i];

                // Calculate the value range for this color level
                if (allValues.length > 0 && minValue !== maxValue) {
                    const rangeStart = minValue + (maxValue - minValue) * (i / (colorScale.length - 1));
                    const rangeEnd = minValue + (maxValue - minValue) * ((i + 1) / (colorScale.length - 1));

                    // Round to integers and format the range values
                    const formattedStart = this.formatValue(Math.floor(rangeStart), field);
                    const formattedEnd = this.formatValue(Math.floor(rangeEnd), field);

                    // Create tooltip text
                    let tooltipText: string;
                    if (i === colorScale.length - 1) {
                        // Last level: show "≥ value"
                        tooltipText = `≥ ${formattedStart}`;
                    } else {
                        // Other levels: show range
                        tooltipText = `${formattedStart} - ${formattedEnd}`;
                    }

                    setTooltip(legendCell, tooltipText, {
                        placement: 'bottom',
                        delay: 300
                    });
                } else {
                    // If no valid range, show the single value or a generic message
                    const tooltipText = allValues.length > 0 ? this.formatValue(Math.floor(minValue), field) : 'No data';
                    setTooltip(legendCell, tooltipText, {
                        placement: 'bottom',
                        delay: 300
                    });
                }
            }

            const legendLabelMore = container.createEl('span', {
                cls: 'wordflow-heatmap-legend-label',
                text: 'More'
            });
        }

}