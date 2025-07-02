import WordflowTrackerPlugin from './main';
import { App, ButtonComponent, Modal, Notice, Setting, TextComponent, TextAreaComponent, DropdownComponent } from 'obsidian';
import { DataRecorder } from './DataRecorder';
import { moment, normalizePath } from 'obsidian';

// Obsidian supports only string and boolean for settings. numbers are not supported. 
export interface WordflowRecorderConfigs {
    name: string;
    enableDynamicFolder: boolean;
    periodicNoteFolder: string;
    periodicNoteFormat: string;
    templatePlugin: string;
    templateFilePath: string;
    templateDateFormat: string;
    templateTimeFormat: string;
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
    noteThreshold: string;
    noteToRecord: string;
    autoRecordInterval: string;
    currentVersion: string; // used to determine whether show change logs or not

    // Recorders tab for multiple recorders
    Recorders: RecorderConfig[];

    // Timers setting tab
    idleInterval: string;

    // Status bar setting tab
    enableMobileStatusBar: boolean;
}

export interface RecorderConfig extends WordflowRecorderConfigs {
    id: string;
    name: string;
}

export const DEFAULT_SETTINGS: WordflowSettings = {
	// General settings tab
	noteThreshold: 'e', // requrie edits only
    noteToRecord: 'all', // requrie edits only
	autoRecordInterval: '0', // disable
    currentVersion: '1.4.2',

	// Recorders tab for multiple recorders
	Recorders: [],
	name: 'Default Recorder',
	enableDynamicFolder: false,
	periodicNoteFolder: '',
	periodicNoteFormat: 'YYYY-MM-DD',
    templatePlugin:  'none',
    templateFilePath: '',
    templateDateFormat: 'YYYY-MM-DD',
    templateTimeFormat: 'HH:mm',
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

    // Status bar setting tab
    enableMobileStatusBar: false,
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
            .setName('Threshold for notes to record in edit mode')
            .setDesc(createFragment(f => {
                f.appendText('Select a requirement for notes to be recorded in live preview and source mode.');
                f.createEl('br');
                f.appendText('Require edits means you should at least type anything or delete anything, even just a space.');
                f.createEl('br');
                f.appendText('Require focus time means you should leave the note under edit mode over 1 minute.');
                f.createEl('br');
                f.appendText('If require none above, the recorder will track all files you opened under edit mode.')
            }))
            .addDropdown(d => d
                .addOption('e', 'require edits only')
                .addOption('t', 'require focus time only')
                .addOption('ent', 'require both edits and focus time')
                .addOption('eot', 'require either edits or focus time')
                .addOption('n', 'require none')
                .setValue(this.plugin.settings.noteThreshold)
                .onChange(async (value) => {
                    this.plugin.settings.noteThreshold = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(tabContent)
            .setName('Notes to record while quiting editing mode')
            .setDesc(createFragment(f => {
                f.appendText('Select the behavior when switching a note from editing mode to reading mode.')
                f.createEl('br')
                f.appendText('Editing mode includes live preview and source mode.')
                f.createEl('br')
                f.appendText('If recording current note only, other notes may not be automactically recorded if you don\'t manually record.')
            }))
            .addDropdown(d => d
                .addOption('all', 'current and other notes in edit mode')
                .addOption('crt', 'current note only')
                .setValue(this.plugin.settings.noteToRecord)
                .onChange(async (value) => {
                    this.plugin.settings.noteToRecord = value;
                    await this.plugin.saveSettings();
                })
            );
        
        new Setting(tabContent)
            .setName('Automatic recording interval')
            .setDesc(createFragment(f => {
                f.appendText('Set the interval in seconds, influencing when the plugin would record all tracked notes and to periodic notes.')
                f.createEl('br')
                f.appendText('Set to 0 to disable.')
            }))
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
            .setDesc(createFragment(f=>{
                f.appendText('Select which recorder configuration to edit.')
                f.createEl('br')
                f.appendText('You can add new recorders to save different sets of statistics to different locations.')
            }));
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
            templatePlugin: DEFAULT_SETTINGS.templatePlugin,
            templateFilePath: DEFAULT_SETTINGS.templateFilePath,
            templateDateFormat: DEFAULT_SETTINGS.templateDateFormat,
            templateTimeFormat: DEFAULT_SETTINGS.templateTimeFormat,
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

        let periodicFolderPreviewText: HTMLSpanElement;
        new Setting(container).setName('Periodic note to record').setHeading();
        const periodicFolder = new Setting(container)
            .setName('Periodic note folder')
            .setDesc(createFragment(f => {
                f.appendText('Toggle the button to enable dynamic folder. Disabled by default.')
                f.createEl('br')
                f.appendText('Specify the block for the folder of daily notes or weekly note.')
                f.createEl('br')
                f.appendText('Your current periodic note folder looks like this: ')
                
                periodicFolderPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText' // add custom CSS class
                })
                periodicFolderPreviewText.setText(
                    (settings.enableDynamicFolder)? moment().format(settings.periodicNoteFolder)
                                                  : settings.periodicNoteFolder)
            }))
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
                                periodicFolderPreviewText.setText(
                                    (settings.enableDynamicFolder)? moment().format(settings.periodicNoteFolder)
                                                                  : settings.periodicNoteFolder)
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
                    periodicFolderPreviewText.setText(
                        (settings.enableDynamicFolder)? moment().format(settings.periodicNoteFolder)
                                                      : settings.periodicNoteFolder)
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            });

        let periodicNoteFormatPreviewText: HTMLSpanElement;
        new Setting(container)
            .setName('Periodic note format')
            .setDesc(createFragment(f => {
                f.appendText('Set the file name (in ')
                f.createEl('a', {
                    text: 'moment format',
                    href: 'https://momentjs.com/docs/#/displaying/'
                    });
                f.appendText(') for newly created daily notes or weekly note.');
                f.createEl('br')
                f.appendText('Your current periodic note looks like this: ')

                periodicNoteFormatPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText' // add custom CSS class
                });
                periodicNoteFormatPreviewText.setText(moment().format(settings.periodicNoteFormat) + '.md');
            }))
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD')
                .setValue(settings.periodicNoteFormat)
                .onChange(async (value) => {
                    settings.periodicNoteFormat = (value !== '')? value: DEFAULT_SETTINGS.periodicNoteFormat;
                    periodicNoteFormatPreviewText.setText(moment().format(settings.periodicNoteFormat) + '.md');
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            );
        
        let templatePluginPreviewText: HTMLSpanElement
        new Setting(container)
            .setName('Template plugin')
            .setDesc(createFragment(f => {
                f.appendText('Set the template plugin you use to apply template to new created periodic notes.')
                f.createEl('br')
                f.appendText('Currently, only support the templates of core plugin "Templates".')
                f.createEl('br')
                f.appendText('If you are using community plugin "Templater", please use the folder template feature of "Templater".')
                f.createEl('br')
                f.appendText('If you do not need to apply template, kindly use the "default" option.')
                f.createEl('br')

                templatePluginPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText' // add custom CSS class
                });
                if(settings.templatePlugin == 'none') {
                    let templaterPluginEnabled = false;
                    //@ts-expect-error
                    if (this.app.plugins.getPlugin("templater-obsidian")) {
                        //@ts-expect-error
                        templaterPluginEnabled = this.app.plugins.getPlugin("templater-obsidian")._loaded;
                    }
                    templatePluginPreviewText.setText(
                    'Templater plugin enabled: ' + (templaterPluginEnabled ?'✅':'❌'));
                } else {
                    templatePluginPreviewText.setText('');
                }
            }))
            .addDropdown(d => {
                this.InsertPlaceComponent = d;
                d.addOption('none', 'default (Templater folder template)');
                d.addOption('Templates', 'Templates (core plugin)');
                d.setValue(settings.templatePlugin)
                .onChange(async (value) => {
                    settings.templatePlugin = value;
                    await this.plugin.saveSettings();
                    // change validation check if value changed
                    if(settings.templatePlugin == 'none') {
                        let templaterPluginEnabled = false;
                        //@ts-expect-error
                        if (this.app.plugins.getPlugin("templater-obsidian")) {
                            //@ts-expect-error
                            templaterPluginEnabled = this.app.plugins.getPlugin("templater-obsidian")._loaded;
                        }
                        templatePluginPreviewText.setText(
                        'Templater plugin enabled: ' + (templaterPluginEnabled ?'✅':'❌'));
                    } else {
                        templatePluginPreviewText.setText('');
                    }
                    // Show or hide subsettings based on dropdown value
                    this.toggleTemplatePluginSettings(value === 'Templates');
                    recorderInstance.loadSettings();
                })
            });
        
        const templatePluginSettingsContainer = container.createDiv();
        templatePluginSettingsContainer.id = "wordflow-recorder-templatePlugin-settings";
        // Add custom CSS to remove separation between settings
        templatePluginSettingsContainer.addClass('wordflow-recorder-templatePlugin-container');
        // Initially set visibility based on current value
        this.toggleTemplatePluginSettings(settings.templatePlugin === 'Templates');

        let templateFilePathPreviewText: HTMLSpanElement;
        new Setting(templatePluginSettingsContainer)
            .setName('Template file path')
            .setDesc(createFragment((f) => {
                f.appendText('Set the file path for the template file to be applied. ')
                f.createEl('br')
                f.appendText('Currently, only support the templates of core plugin "Templates".')
                f.createEl('br')
                f.appendText('Example: Templates/daily note template.md')
                f.createEl('br')
                f.appendText('Input template file founded: ')

                templateFilePathPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText' // add custom CSS class
                });
                templateFilePathPreviewText.setText(
                    this.app.vault.getAbstractFileByPath(settings.templateFilePath) ?'✅':'❌');
            }))
            .addText(text => text
                .setPlaceholder('set template file')
                .setValue(settings.templateFilePath)
                .onChange(async (value) => {
                    settings.templateFilePath = normalizePath(value);
                    templateFilePathPreviewText.setText(
                        this.app.vault.getAbstractFileByPath(settings.templateFilePath) ?'✅':'❌');
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            );

        let templateDateFormatPreviewText: HTMLSpanElement;
        new Setting(templatePluginSettingsContainer)
            .setName('Template file date format')
            .setDesc(createFragment((f) => {
                f.appendText('{{date}} in the template file will be replaced with this value.');
                f.createEl('br');
                f.appendText('You can also use {{date:YYYY-MM-DD}} to override the format once.');
                f.createEl('br');
                f.appendText('For more syntax, refer to ')
                f.createEl('a', {
                    text: 'format reference',
                    href: 'https://momentjs.com/docs/#/displaying/'
                  });
                f.createEl('br');
                f.appendText('Your current syntax looks like this: ');

                templateDateFormatPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText' // add custom CSS class
                });
                templateDateFormatPreviewText.setText(moment().format(settings.templateDateFormat));
            }))
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD')
                .setValue(settings.templateDateFormat)
                .onChange(async (value) => {
                    settings.templateDateFormat = (value != '')? value: DEFAULT_SETTINGS.templateDateFormat;
                    templateDateFormatPreviewText.setText(moment().format(settings.templateDateFormat));
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            );
        
        let templateTimeFormatPreviewText: HTMLSpanElement;
        new Setting(templatePluginSettingsContainer)
            .setName('Template file time format')
            .setDesc(createFragment((f) => {
                f.appendText('{{time}} in the template file will be replaced with this value.');
                f.createEl('br');
                f.appendText('You can also use {{time:HH:mm}} to override the format once.');
                f.createEl('br');
                f.appendText('For more syntax, refer to ')
                f.createEl('a', {
                    text: 'format reference',
                    href: 'https://momentjs.com/docs/#/displaying/'
                  });
                f.createEl('br');
                f.appendText('Your current syntax looks like this: ');

                templateTimeFormatPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText' // 添加自定义CSS类
                });
                templateTimeFormatPreviewText.setText(moment().format(settings.templateTimeFormat));
            }))
            .addText(text => text
                .setPlaceholder('HH:mm')
                .setValue(settings.templateTimeFormat)
                .onChange(async (value) => {
                    settings.templateTimeFormat = (value != '')? value: DEFAULT_SETTINGS.templateTimeFormat;
                    templateTimeFormatPreviewText.setText(moment().format(settings.templateTimeFormat));
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
                .setDesc(createFragment(f => {
                    f.appendText('Modified the syntax with \'${}\' syntax, see ')
                    f.createEl('a', {
                        text: 'document',
                        href: 'https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#supported-string-interpolations'
                      });
                    f.appendText(' for supported string interpolation expressions.')
                }))
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
            .setDesc(createFragment(f => {
                f.appendText('Insert to this position if no previous record exist.')
                f.createEl('br')
                f.appendText('If using a custom position, the start position and end position must exist and be unique in periodic note!')
                f.createEl('br')
                f.appendText('Make sure your template is correctly applied while creating new periodic note.')
            }))
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

        let mTimeFormatPreviewText: HTMLSpanElement;
        const mTimeFormatSetting = new Setting(mTimeFormatSettingsContainer)
            .setName('Last modified time format')
            .setDesc(createFragment((f) => {
                f.appendText('Set the format of \'${lastModifiedTime}\' to be recorded on notes.')
                f.createEl('br')
                f.appendText('Your current syntax looks like this: ');

                mTimeFormatPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText' // add custom CSS class
                });
                mTimeFormatPreviewText.setText(moment().format(settings.timeFormat));
            }))
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD | hh:mm')
                .setValue(settings.timeFormat)
                .onChange(async (value) => {
                    settings.timeFormat = (value != '')? value: DEFAULT_SETTINGS.timeFormat;
                    mTimeFormatPreviewText.setText(moment().format(settings.timeFormat));
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

    private toggleTemplatePluginSettings(show: boolean) {
        const templatePluginSettingsContainer = document.getElementById("wordflow-recorder-templatePlugin-settings");
        if (templatePluginSettingsContainer)
            templatePluginSettingsContainer.style.display = show ? "block" : "none";
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
            .setDesc(createFragment(f => {
                f.appendText('Interval in minutes when the timer in status bar will pause when idled for a period of time.')
                f.createEl('br')
                f.appendText('Any document clicking, outline clicking or editing behavior will refresh the timer from idling.')
            }))
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
        
        /*
        new Setting(tabContent)
            .setName('Display format')
            .setDesc('How to display editing stats in status bar')
            .addText(text => text
                .setPlaceholder('Words: ${words}')
                .setValue('Words: ${words}')
                .onChange(async (value) => {
                    // 这里可以添加具体的实现逻辑
                }));
        */
        new Setting(tabContent)
            .setName('Enforce status bar display in mobile')
            .setDesc(createFragment(f => {
                f.appendText('Enforce the status bar of wordflow tracker to show up in mobile devices.')
                f.createEl('br');
                f.appendText('If you have other css snippets do the same, they may be overwriten.')
            }))
            .addToggle(t => t
                .setValue(this.plugin.settings.enableMobileStatusBar)
                .onChange(async (value) => {
                    this.plugin.settings.enableMobileStatusBar = value;
                    await this.plugin.saveSettings();
                    updateStatusBarStyle(this.plugin.settings);
                }));
    }
}

/*
export class WidgetTab extends WordflowSubSettingsTab {
    display() {
        const tabContent = this.container.createDiv('wordflow-tab-content-scroll');
        
        new Setting(tabContent)
            .setName('Alias for fields')
            .setDesc(createFragment(f => {
                f.appendText('Enforce the status bar of wordflow tracker to show up in mobile devices.')
                f.createEl('br');
                f.appendText('If you have other css snippets do the same, they may be overwriten.')
            }))
            .addToggle(t => t
                .setValue(this.plugin.settings.enableMobileStatusBar)
                .onChange(async (value) => {
                    this.plugin.settings.enableMobileStatusBar = value;
                    await this.plugin.saveSettings();
                    updateStatusBarStyle(this.plugin.settings);
                }));
    }
}
*/
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

export function updateStatusBarStyle(settings: WordflowSettings){
    if (settings.enableMobileStatusBar) {
        document.body.classList.add('wordflow-status-bar-container');
    } else {
        removeStatusBarStyle();
    }
};

export function removeStatusBarStyle(){
    document.body.classList.remove('wordflow-status-bar-container');
}

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