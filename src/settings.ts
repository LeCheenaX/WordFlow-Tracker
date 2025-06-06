import WordflowTrackerPlugin from './main';
import { App, ButtonComponent, Modal, Notice, Setting, TextComponent, TextAreaComponent, DropdownComponent, PluginSettingTab } from 'obsidian';
import { DataRecorder } from './DataRecorder';
import { normalizePath } from 'obsidian';

// Obsidian supports only string and boolean for settings. numbers are not supported. 
export interface WordflowRecorderConfigs {
    name: string;
    enableDynamicFolder: boolean;
    periodicNoteFolder: string;
    periodicNoteFormat: string;
    recordType: string;
    tableSyntax: string;
    bulletListSyntax: string;
    metadataSyntax: string;
    timeFormat: string;
    sortBy: string;
    isDescend: boolean;
    insertPlace: string;
    insertPlaceStart: string;
    insertPlaceEnd: string;
}

export interface WordflowSettings extends WordflowRecorderConfigs{
    // General settings tab
    filterZero: boolean;
    autoRecordInterval: string;

    // Recorders tab for multiple recorders
    Recorders: RecorderConfig[];

    // Timers setting tab
    idleInterval: string;
}

export interface RecorderConfig extends WordflowRecorderConfigs {
    id: string;
    name: string;
}

export const DEFAULT_SETTINGS: WordflowSettings = {
	// General settings tab
	filterZero: true,
	autoRecordInterval: '0', // disable

	// Recorders tab for multiple recorders
	Recorders: [],
	name: 'Default Recorder',
	enableDynamicFolder: false,
	periodicNoteFolder: '',
	periodicNoteFormat: 'YYYY-MM-DD',
	recordType: 'table',
	insertPlace: 'bottom',
	tableSyntax: `| Note                | Edited Words   | Last Modified Time  |\n| ------------------- | ---------------- | ------------------- |\n| [[\${modifiedNote}\\|\${noteTitle}]] | \${editedWords} | \${lastModifiedTime} |`,
	bulletListSyntax: `- \${modifiedNote}\n    - Edits: \${editedTimes}\n    - Edited Words: \${editedWords}`,
	metadataSyntax: `Total edits: \${totalEdits}\nTotal words: \${totalWords}`,
	timeFormat: 'YYYY-MM-DD HH:mm',
	sortBy: 'lastModifiedTime',
	isDescend: true,
	insertPlaceStart: '',
	insertPlaceEnd: '',

    // Timers setting tab
    idleInterval: '3',
}


// 抽象基类用于所有设置标签页
export abstract class WordflowSubSettingsTab {
    constructor(protected app: App, protected plugin: WordflowTrackerPlugin, protected container: HTMLElement) {}
    abstract display(): void;
}

// ========================================
// 通用设置标签页
// ========================================
export class GeneralTab extends WordflowSubSettingsTab {
    display() {
        this.container.empty();
        const tabContent = this.container.createDiv('wordflow-tab-content-scroll');
        
        new Setting(tabContent)
            .setName('Filter out non-modified or unfocused or notes')
            .setDesc('Whether the opened notes that are not modified or focused for at least 1 minute should be excluded while recording. If not excluded, you will get any opened file under editing mode recorded. ')
            .addToggle(t => t
                .setValue(this.plugin.settings.filterZero)
                .onChange(async (value) => {
                    this.plugin.settings.filterZero = value;
                    await this.plugin.saveSettings();			
                })
            );
        
        new Setting(tabContent)
            .setName('Automatic recording interval')
            .setDesc('Set the interval in seconds, influencing when the plugin should save all tracked records and implement them on periodic notes. Set to 0 to disable. ')
            .addText(text => text
                .setPlaceholder('Set to 0 to disable')
                .setValue(this.plugin.settings.autoRecordInterval)
                .onChange(async (value) => {
                    this.plugin.settings.autoRecordInterval = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(tabContent)
        .setName('Reset all settings')
        .setDesc('Reset all settings to the default value.')
        .addButton(btn => btn
                .setButtonText('Reset all settings')
                .setWarning()
                //.setIcon('alert-triangle')
                .onClick(() => this.confirmReset())
            );
    }

    private confirmReset(){
        new ConfirmationModal(
              this.app,
              "Are you sure to reset all settings of wordflow tracker?",
              () => this.resetSettings()
            ).open();
    }
    
    private async resetSettings() {
        try {
            this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS)
            await this.plugin.saveSettings();
            new Notice('✅ Settings are reset to default!', 3000);
            await sleep(100);
            this.display();
        } catch (error) {
            console.error("Could not reset settings:", error);
            new Notice('❌ Could not reset settings! Check console!', 0);
        }
    }
}

// ========================================
// 记录器管理标签页
// ========================================
export class RecordersTab extends WordflowSubSettingsTab {
    private activeRecorderIndex: number = 0;
    private settingsContainer: HTMLElement;
    private PeriodicFolderComponent?: TextComponent;
	private SyntaxComponent?: TextAreaComponent;
    private InsertPlaceComponent?: DropdownComponent;

    display() {
        this.container.empty();
        // Create recorder selection
        const recorderSelectionContainer = this.container.createDiv('recorder-selection-container');
        // Show currently active recorder
        let activeRecorderName = this.plugin.settings.name;
        if (this.activeRecorderIndex > 0) {
            activeRecorderName = this.plugin.settings.Recorders[this.activeRecorderIndex - 1].name;
        }
        
        const recorderActions = new Setting(recorderSelectionContainer)
            .setName('Current recorder')
            .setDesc('Select which recorder configuration to edit.\nYou can add new recorders to save different sets of statistics to different locations.');
            // Only show rename/delete for additional recorders
        if (this.activeRecorderIndex > 0) {
            recorderActions
                .addButton(btn => btn
                    .setButtonText('Delete')
                    .setTooltip('Delete')
                    .setIcon('trash')
                    .setWarning()
                    .onClick(() => {
                        this.removeRecorder(this.activeRecorderIndex - 1);
                    })
                );
        }

        recorderActions
            .addDropdown(dropdown => {
                // Add default recorder
                dropdown.addOption("0", this.plugin.settings.name);
                
                // Add additional recorders
                this.plugin.settings.Recorders.forEach((recorder, index) => {
                    dropdown.addOption((index + 1).toString(), recorder.name);
                });
                
                // Set current selection
                dropdown.setValue(this.activeRecorderIndex.toString());
                
                // Handle selection change
                dropdown.onChange(value => {
                    this.setActiveRecorder(parseInt(value));
                });
            })
            .addButton(btn => btn
                .setButtonText('Rename')
                .setIcon('pencil')
                .setTooltip('Rename')
                .onClick(() => {
                    this.renameRecorder(this.activeRecorderIndex -1); 
                })
            )
            .addButton(btn => btn
                .setButtonText('Add recorder')
                .setIcon('plus')
                .setTooltip('Add recorder')
                //.setCta()
                .onClick( () => {
                    new ConfirmationModal(
                        this.app,
                        'Please ensure that there are no duplicate record content type per note, or undefined behavior will occur!\n\nExample allowed✅:\n\tRecorder1: Periodic note format = YYYY-MM-DD; Record type = table;\n\tRecorder2: Periodic note format = YYYY-MM-DD; Record type = bullet list;\nExample allowed✅:\n\tRecorder1: Periodic note format = YYYY-MM-DD; Record type = table;\n\tRecorder2: Periodic note format = YYYY-MM; Record type = table;\nExample disallowed❌:\n\tRecorder1: Periodic note format = YYYY-MM-DD; Record type = table; Insert to position = bottom;\n\tRecorder2: Periodic note format = YYYY-MM-DD; Record type = table; Insert to position = custom;',
                        async () => {this.createNewRecorder();}
                    ).open()
                })	
            );
            
        
        // Create title for settings section
        /*
        containerEl.createEl('h3', { 
            text: `⏺️${activeRecorderName} settings`,
            cls: 'recorder-settings-heading'
        });
        */
        // Another container that contains the specific settings per recorder 
        new Setting(this.container)
            .setName(`⚙️${activeRecorderName} configurations`)
            .setHeading()
            .setClass('recorder-settings-heading')
        
        this.settingsContainer = this.container.createDiv('recorder-settings-container');
        this.displayRecorderSettings(this.activeRecorderIndex);
    }

    private setActiveRecorder(index: number) {
        this.activeRecorderIndex = index;
        this.display();
    }

    private async createNewRecorder() {
        // Create new recorder with default settings and unique ID
        const newId = `recorder-${Date.now()}`;
        const newRecorder: RecorderConfig = {
            id: newId,
            name: `Recorder ${this.plugin.settings.Recorders.length + 1}`,
            enableDynamicFolder: DEFAULT_SETTINGS.enableDynamicFolder,
            periodicNoteFolder: DEFAULT_SETTINGS.periodicNoteFolder,
            periodicNoteFormat: DEFAULT_SETTINGS.periodicNoteFormat,
            recordType: DEFAULT_SETTINGS.recordType,
            tableSyntax: DEFAULT_SETTINGS.tableSyntax,
            bulletListSyntax: DEFAULT_SETTINGS.bulletListSyntax,
            metadataSyntax: DEFAULT_SETTINGS.metadataSyntax,
            timeFormat: DEFAULT_SETTINGS.timeFormat,
            sortBy: DEFAULT_SETTINGS.sortBy,
            isDescend: DEFAULT_SETTINGS.isDescend,
            insertPlace: DEFAULT_SETTINGS.insertPlace,
            insertPlaceStart: DEFAULT_SETTINGS.insertPlaceStart,
            insertPlaceEnd: DEFAULT_SETTINGS.insertPlaceEnd
        };

        this.plugin.settings.Recorders.push(newRecorder);
        await this.plugin.saveSettings();
        
        // Create a new recorder instance
        const recorder = new DataRecorder(this.plugin, this.plugin.trackerMap, newRecorder);
        this.plugin.DocRecorders.push(recorder);
        
        // Switch to the new recorder tab
        this.setActiveRecorder(this.plugin.settings.Recorders.length);
    }	

    private async renameRecorder(index: number) {
        if (index == -1) { // for default recorder
            const modal = new RecorderRenameModal(
                this.app, 
                this.plugin.settings.name,
                async (newName) => {
                    this.plugin.settings.name = newName;
                    await this.plugin.saveSettings();
                    this.display();
                });
            modal.open();
        } 
        else {
            const recorder = this.plugin.settings.Recorders[index];
            const modal = new RecorderRenameModal(this.app, recorder.name, async (newName) => {
                this.plugin.settings.Recorders[index].name = newName;
                await this.plugin.saveSettings();
                this.display();
            });
            modal.open();
        }
    }
    
    private async removeRecorder(index: number) {
        const modal = new ConfirmationModal(
            this.app,
            `Are you sure you want to remove "${this.plugin.settings.Recorders[index].name}"?`,
            async () => {
                // Remove recorder config
                this.plugin.settings.Recorders.splice(index, 1);
                await this.plugin.saveSettings();
                
                // Remove recorder instance
                this.plugin.DocRecorders.splice(index + 1, 1);
                
                // Reset active tab if needed
                if (this.activeRecorderIndex > this.plugin.settings.Recorders.length) {
                    this.activeRecorderIndex = 0;
                }
                
                this.display();
            }
        );
        modal.open();
    }

    private displayRecorderSettings(index: number) {
        this.settingsContainer.empty();
        
        // Get the correct settings object based on the active index
        let settings: any;
        let recorderInstance: DataRecorder;
        
        if (index === 0) {
            // Default recorder uses main settings
            settings = this.plugin.settings;
            recorderInstance = this.plugin.DocRecorders[0];
        } else {
            // Additional recorders use their own config
            settings = this.plugin.settings.Recorders[index - 1];
            recorderInstance = this.plugin.DocRecorders[index];
        }
        
        // Display all settings using the selected configuration
        this.createRecorderSettingsUI(settings, recorderInstance, index);
    }
    
    private createRecorderSettingsUI(settings: any, recorderInstance: DataRecorder, index: number) {
        const container = this.settingsContainer; // do not use containerEl, instead, use container to pass the new container element

        container.classList.add('wordflow-setting-tab'); // for styles.css

        new Setting(container).setName('Periodic note to record').setHeading();
        const periodicFolder = new Setting(container)
            .setName('Periodic note folder')
            .setDesc('Select whether to enable dynamic folder, and set the folder for daily notes or weekly note to place, which should correspond to the same folder of Obsidian daily note plugin and of templater plugin(if installed).')
            .addToggle(t => {
                const toggle = t;
                toggle
                    .setTooltip('Enable dynamic folder in moment.js format')
                    .setValue(settings.enableDynamicFolder)
                    .onChange(async (value) => {
                        const actualValue = settings.enableDynamicFolder;
                        // if no actual change, return
                        if (value === actualValue) return;
                        // set back to the actual value in data.json rather than the unconfirmed changed value
                        toggle.setValue(actualValue); 

                        new ConfirmationModal(
                            this.app, 
                            `Please make sure that: \n\t1. You will adjust the periodic note folder after toggling dynamic folder. Example formats are as followed: \n\t\tIf dynamic folder is enabled, the moment format must be used: \n\t\t\t[MonthlyLogs\/]MM-YYYY\n\t\tIf dynamic folder is disabled, a folder path must be used: \n\t\t\tLogs\/MonthlyLogs \n\t2. Do not forget to do the same changes to other recorders if you want them to record in the same folder!`,
                            async () => {
                                settings.enableDynamicFolder = value;
                                await this.plugin.saveSettings();			
                                recorderInstance.loadSettings();
                                // now update placeholder based on the setting. 
                                const placeholder = (value)? '[MonthlyLogs\/]MM-YYYY': 'Example: "Monthly logs"';
                                this.PeriodicFolderComponent?.setPlaceholder(placeholder);
                                toggle.setValue(value);	// change display value to the new value
                            }
                        ).open();
                    })
            })				
            
            .addText(text => {
                this.PeriodicFolderComponent = text;
                text
                .setValue(settings.periodicNoteFolder)
                .setPlaceholder((settings.enableDynamicFolder)?'[MonthlyLogs\/]MM-YYYY': 'Example: "Monthly logs"')
                .onChange(async (value) => {
                    settings.periodicNoteFolder = (value == '')? value: normalizePath(value);
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            });

        new Setting(container)
            .setName('Periodic note format')
            .setDesc('Set the file name (in moment format) for newly created daily notes or weekly note, which should correspond to the same format setting of Obsidian daily note plugin and of templater plugin(if installed).')
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD')
                .setValue(settings.periodicNoteFormat)
                .onChange(async (value) => {
                    settings.periodicNoteFormat = value;
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            );

        new Setting(container).setName('Recording contents').setHeading();
        
        new Setting(container)
            .setName('Record content type')
            .setDesc('Select a type of content to record on specified notes.')
            .addDropdown(d => d
                .addOption('table', 'table')
                .addOption('bulletList', 'bullet list')
                .addOption('metadata', 'metadata')
                .setValue(settings.recordType) // need to show the modified value when next loading
                .onChange(async (value) => {
                    settings.recordType = value;
                    await this.plugin.saveSettings();
                    await this.updateSyntax(settings); // warning: must to be put after saving
                    await this.updateInsertPlace(settings);
                    // Show or hide subsettings based on dropdown value
                    this.toggleSortByVisibility(value !== 'metadata');
                    this.toggleMTimeVisibility(value !== 'metadata');
                    recorderInstance.loadSettings();
                })
            );

        makeMultilineTextSetting(
            new Setting(container)
                .setName('Wordflow recording syntax')
                .setDesc('Modified the syntax with \'${}\' syntax, see doc for supported regular expressions.\n')
                .addTextArea(text => {
                    this.SyntaxComponent = text;
                    if (settings.recordType == 'table'){
                        text.setValue(settings.tableSyntax);
                        text.onChange(async (value) => {
                            settings.tableSyntax = value;
                            await this.plugin.saveSettings();
                            recorderInstance.loadSettings();
                        })
                    }
                    if (settings.recordType == 'bulletList'){
                        text.setValue(settings.bulletListSyntax);
                        text.onChange(async (value) => {
                            settings.bulletListSyntax = value;
                            await this.plugin.saveSettings();
                            recorderInstance.loadSettings();
                        })
                    }
                    if (settings.recordType == 'metadata'){
                        text.setValue(settings.metadataSyntax);
                        text.onChange(async (value) => {
                            settings.metadataSyntax = value;
                            await this.plugin.saveSettings();
                            recorderInstance.loadSettings();
                        })
                    }				
                })
        );	
        
        new Setting(container)
            .setName('Insert to position')
            .setDesc('Insert to this position if no previous record exist. If using a custom position, the start position and end position must exist and be unique in periodic note! Make sure your template is correctly applied while creating new periodic note. ')
            .addDropdown(d => {
                this.InsertPlaceComponent = d;
                if (settings.recordType === 'metadata') {
                    d.addOption('yaml', 'yaml(frontmatter)');
                } else {
                    d.addOption('bottom', 'bottom');
                    d.addOption('custom', 'custom position');
                }
                d.setValue(settings.insertPlace)
                .onChange(async (value) => {
                    settings.insertPlace = value;
                    await this.plugin.saveSettings();
                    // Show or hide subsettings based on dropdown value
                    this.toggleCustomPositionSettings(value === 'custom');
                    recorderInstance.loadSettings();
                })
            });

        const customSettingsContainer = container.createDiv();
        customSettingsContainer.id = "wordflow-recorder-custom-position-settings";
        // Add custom CSS to remove separation between settings
        customSettingsContainer.addClass('wordflow-recorder-custom-position-container');
        // Initially set visibility based on current value
        this.toggleCustomPositionSettings(settings.insertPlace === 'custom');

        const insertPlaceStart = new Setting(customSettingsContainer)
            .setName('Start position')
            .setDesc('The records should be inserted after this content. Content between start position and end position would be replaced during recording. ')
            .addTextArea(text => text
                .setValue(settings.insertPlaceStart || '')
                .setPlaceholder('Replace with your periodic note content that exist in the periodic note template.\nFor example: ## Modified Note')
                .onChange(async (value) => {
                    settings.insertPlaceStart = value;
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                }));
        const insertPlaceEnd = new Setting(customSettingsContainer)
            .setName('End position')
            .setDesc('The records should be inserted before this content. Content between start position and end position would be replaced during recording. ')
            .addTextArea(text => text
                .setValue(settings.insertPlaceEnd || '')
                .setPlaceholder('Replace with your periodic note content that exist in the periodic note template.\nFor example: ## The next title after \'## Modified Note\'. ')
                .onChange(async (value) => {
                    settings.insertPlaceEnd = value;
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                }));

        makeMultilineTextSetting(insertPlaceStart);
        makeMultilineTextSetting(insertPlaceEnd);
        
        const sortBySettingsContainer = container.createDiv();
        sortBySettingsContainer.id = "wordflow-recorder-sortby-settings";
        // Add custom CSS to remove separation between settings
        sortBySettingsContainer.addClass('wordflow-recorder-sortby-container');
        // Initially set visibility based on current value
        this.toggleSortByVisibility(settings.recordType !== 'metadata');

        const sortBySetting = new Setting(sortBySettingsContainer)
            .setName('Sort by')
            .setDesc('Select a type of variables to add recording items in a sequence.')
            .addDropdown(d => d
                .addOption('lastModifiedTime', 'lastModifiedTime')
                .addOption('editedWords', 'editedWords')
                .addOption('editedTimes', 'editedTimes')
                .addOption('editedPercentage', 'editedPercentage')
                .addOption('modifiedNote', 'modifiedNote')
                .addOption('editTime', 'editTime')
                .setValue(settings.sortBy)
                .onChange(async (value) => {
                    settings.sortBy = value;
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            )
            .addDropdown(d => d
                .addOption('true', 'Descend')
                .addOption('false', 'Ascend')
                .setValue((settings.isDescend).toString())
                .onChange(async (value) => {
                    settings.isDescend = (value === 'true')?true:false;
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            );

        const mTimeFormatSettingsContainer = container.createDiv();
        mTimeFormatSettingsContainer.id = "wordflow-recorder-mtime-format-settings";
        // Add custom CSS to remove separation between settings
        mTimeFormatSettingsContainer.addClass('wordflow-recorder-mtime-format-container');
        // Initially set visibility based on current value
        this.toggleMTimeVisibility(settings.recordType !== 'metadata');

        const mTimeFormatSetting = new Setting(mTimeFormatSettingsContainer)
            .setName('Last modified time format')
            .setDesc('Set the format of \'${lastModifiedTime}\' to record on notes.')
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD | hh:mm')
                .setValue(settings.timeFormat)
                .onChange(async (value) => {
                    settings.timeFormat = value;
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            );
    }

	private async updateSyntax(settings: any) {
		if (!this.SyntaxComponent) return;
		switch (settings.recordType){
			case 'table': this.SyntaxComponent.setValue(settings.tableSyntax); break;
			case 'bulletList': this.SyntaxComponent.setValue(settings.bulletListSyntax); break;
			case 'metadata': this.SyntaxComponent.setValue(settings.metadataSyntax); break;
		}
	};

	
	private async updateInsertPlace(settings: any): Promise<void>{
		if (!this.InsertPlaceComponent) return;
		this.InsertPlaceComponent.selectEl.innerHTML = '';
		if (settings.recordType == 'metadata'){
			this.InsertPlaceComponent.addOption('yaml', 'yaml/frontmatter');
			this.InsertPlaceComponent.setValue('yaml');
			settings.insertPlace = 'yaml';
		} else {
			this.InsertPlaceComponent.addOption('bottom', 'bottom');
        	this.InsertPlaceComponent.addOption('custom', 'custom position');
			this.InsertPlaceComponent.setValue('bottom');
			settings.insertPlace = 'bottom';
		}
		this.toggleCustomPositionSettings(false);
		await this.plugin.saveSettings();
	}

	private toggleCustomPositionSettings(show: boolean) {
        const customSettingsContainer = document.getElementById("wordflow-recorder-custom-position-settings");
        if (customSettingsContainer) {
            customSettingsContainer.style.display = show ? "block" : "none";
        }
    }

	private toggleSortByVisibility(show: boolean) {
        const sortBySettingsContainer = document.getElementById("wordflow-recorder-sortby-settings");
        if (sortBySettingsContainer) {
            sortBySettingsContainer.style.display = show ? "block" : "none";
        }
    }

	private toggleMTimeVisibility(show: boolean) {
        const mTimeFormatSettingsContainer = document.getElementById("wordflow-recorder-mtime-format-settings");
        if (mTimeFormatSettingsContainer) {
            mTimeFormatSettingsContainer.style.display = show ? "block" : "none";
        }
    }
}

// ========================================
// 计时器设置标签页
// ========================================
export class TimersTab extends WordflowSubSettingsTab {
    display() {
        const tabContent = this.container.createDiv('wordflow-tab-content-scroll');
/*
        new Setting(tabContent)
            .setName('Editing session threshold')
            .setDesc('Minimal editing time (in seconds) to count as a valid editing session')
            .addText(text => text
                .setPlaceholder('300')
                .setValue('300')
                .onChange(async (value) => {
                    // 这里可以添加具体的实现逻辑
                }));
*/
        new Setting(tabContent)
            .setName('Idle interval')
            .setDesc('Interval in minutes when the timer in status bar will pause when idled for a period of time.\n Any document clicking, outline clicking or editing behavior will refresh the timer from idling. ')
            .addText(text => text
                .setPlaceholder('Set idle time in minute')
                .setValue(this.plugin.settings.idleInterval)
                .onChange(async (value) => {
                    this.plugin.settings.idleInterval = value;
                    await this.plugin.saveSettings();
                }));
    }
}

// ========================================
// 状态栏设置标签页
// ========================================
export class StatusBarTab extends WordflowSubSettingsTab {
    display() {
        const tabContent = this.container.createDiv('wordflow-tab-content-scroll');
        
        new Setting(tabContent)
            .setName('Display format')
            .setDesc('How to display editing stats in status bar')
            .addText(text => text
                .setPlaceholder('Words: ${words}')
                .setValue('Words: ${words}')
                .onChange(async (value) => {
                    // 这里可以添加具体的实现逻辑
                }));

        new Setting(tabContent)
            .setName('Real-time updating')
            .setDesc('Enable live updates in status bar while typing')
            .addToggle(toggle => toggle
                .setValue(true)
                .onChange(async (value) => {
                    // 这里可以添加具体的实现逻辑
                }));
    }
}

// ========================================
// 主设置标签页（管理所有子标签页）
// ========================================


// 保留原有的辅助类
// modified from https://github.com/obsidian-tasks-group/obsidian-tasks/blob/main/src/Config/SettingsTab.ts#L842
function makeMultilineTextSetting(setting: Setting) {
    const { settingEl, infoEl, controlEl } = setting;
    const textEl: HTMLElement | null = controlEl.querySelector('textarea');

    // Not a setting with a text field
    if (textEl === null) {
        return;
    }
    // for styles.css
    settingEl.classList.add('wordflow-multiline-setting');
    infoEl.classList.add('wordflow-info');
    textEl.classList.add('wordflow-textarea');
};

class ConfirmationModal extends Modal {
    constructor(
	    app: App,
		private message: string,
		private onConfirm: () => Promise<void>
	) {
		super(app);
	}
	
	onOpen() {
	    const { contentEl } = this;
		this.containerEl.addClass("wordflow-confirm-modal");
		
		contentEl.createEl("h3", { 
		  text: "⚠️ Confirmation ",
		  cls: "confirm-title" 
		});
		
		const messagePara = contentEl.createEl("p", {
			cls: "confirm-message"
		});

		messagePara.textContent = this.message;
	
		const buttonContainer = contentEl.createDiv("confirm-cancel-buttons");
		
		new ButtonComponent(buttonContainer)
		  .setButtonText("Confirm")
		  .setClass("mod-warning")
		  .onClick(async () => {
			await this.onConfirm();
			this.close();
		  });
	
		new ButtonComponent(buttonContainer)
		  .setButtonText("Cancel")
		  .setClass("mod-neutral")
		  .onClick(() => this.close());
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class RecorderRenameModal extends Modal { // this should be updated to text input model in future versions | said on 1.4.0
    private currentName: string;
    private onSubmit: (newName: string) => Promise<void>;

    constructor(app: App, currentName: string, onSubmit: (newName: string) => Promise<void>) {
        super(app);
        this.currentName = currentName;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        
		new Setting(contentEl)
			.setName("Rename recorder")
			.setHeading
        
        // create new input container
        const inputContainer = contentEl.createDiv('wordflow-text-input-container');
        const nameInput = inputContainer.createEl("input", {
            type: "text",
            value: this.currentName
        });
        nameInput.focus();
        
        // create new button container
        const buttonContainer = contentEl.createDiv('wordflow-text-input-button-container');
        
        new ButtonComponent(buttonContainer)
            .setButtonText("Save")
            .setCta()
            .onClick(async () => {
                const newName = nameInput.value.trim();
                if (newName) {
                    await this.onSubmit(newName);
                    this.close();
                }
            });
            
        new ButtonComponent(buttonContainer)
            .setButtonText("Cancel")
            .onClick(() => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}