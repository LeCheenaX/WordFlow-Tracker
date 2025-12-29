import WordflowTrackerPlugin from './main';
import { App, ButtonComponent, Modal, Notice, Setting, TextComponent, TextAreaComponent, DropdownComponent } from 'obsidian';
import { DataRecorder } from './DataRecorder';
import { moment, normalizePath } from 'obsidian';
import { SupportedLocale, I18nManager, getI18n } from './i18n';

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
    locale: string; // 'en' | 'zh-CN'
    showRecordRibbonIcon: boolean;
    ignoredFolders: string[];
    ignoredFileTags: string[];
    noteThreshold: string;
    noteToRecord: string;
    autoRecordInterval: string;
    currentVersion: string; // used to determine whether show change logs or not

    // Recorders tab for multiple recorders
    Recorders: RecorderConfig[];

    // Timers setting tab
    idleInterval: string;
    // could not add another interval for focus mode directly, nor could we use reading interval as the interval will be different in reading/editing mode. 
    useSecondInWidget: boolean; // required to restart plugin, currently support widget only, others are technically supported but not recommended

    // Widget setting tab
    enableWidgetOnLoad: boolean;
    showWidgetRibbonIcon: boolean;
    switchToFieldOnFocus: string;
    colorGroupLightness: string; // required to restart widget or plugin
    colorGroupSaturation: number[]; // required to restart widget or plugin
    fieldAlias: { key: string, value: string }[];

    // Status bar setting tab
    enableMobileStatusBar: boolean;
}

export interface RecorderConfig extends WordflowRecorderConfigs {
    id: string;
    name: string;
}

export const DEFAULT_SETTINGS: WordflowSettings = {
	// General settings tab
    locale: 'en',
    showRecordRibbonIcon: true,
    ignoredFolders: [],
    ignoredFileTags: [],
	noteThreshold: 'eot', // requrie edits or time
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
	tableSyntax: `| Note                | Edited Words   | Last Modified Time  | Focused |\n| ------------------- | ---------------- | ------------------ | --------- |\n| [[\${modifiedNote}\\|\${noteTitle}]] | \${editedWords} | \${lastModifiedTime} | \${readEditTime} |`,
	bulletListSyntax: `- \${modifiedNote}\|\${noteTitle}\n    - Edits: \${editedTimes}\n    - Edited Words: \${editedWords}\n    - Focused Time: \${readEditTime}`,
	metadataSyntax: `total edits: \${totalEdits}\ntotal words: \${totalWords}\ntotal time: \${totalTime}`,
	timeFormat: 'YYYY-MM-DD HH:mm',
	sortBy: 'lastModifiedTime',
	isDescend: true,
	insertPlaceStart: '',
	insertPlaceEnd: '',

    // Timers setting tab
    idleInterval: '3',
    useSecondInWidget: false, 

    // Widget setting tab
    enableWidgetOnLoad: true,
    showWidgetRibbonIcon: true,
    switchToFieldOnFocus: 'disabled',
    colorGroupLightness: '66',
    colorGroupSaturation: [60, 85],
    fieldAlias: [],


    // Status bar setting tab
    enableMobileStatusBar: false,
}


// 抽象基类用于所有设置标签页
export abstract class WordflowSubSettingsTab {
    protected i18n: I18nManager;
    
    constructor(protected app: App, protected plugin: WordflowTrackerPlugin, protected container: HTMLElement) {
        this.i18n = plugin.i18n;
    }
    abstract display(): void;

    /**
     * Create a multi-line description using i18n
     */
    protected createMultiLineDesc(key: string, params?: Record<string, any>): DocumentFragment {
        return this.i18n.buildFragment(key, params);
    }
}

// ========================================
// 通用设置标签页
// ========================================
export class GeneralTab extends WordflowSubSettingsTab {
    display() {
        this.container.empty();
        const tabContent = this.container.createDiv('wordflow-tab-content-scroll');

        new Setting(tabContent)
            .setName(this.i18n.t('settings.general.language.name'))
            .setDesc(this.i18n.t('settings.general.language.desc'))
            .addDropdown(d => {
                const locales = this.i18n.getAvailableLocales();
                locales.forEach(locale => {
                    d.addOption(locale, this.i18n.getLocaleName(locale));
                });
                d.setValue(this.plugin.settings.locale)
                .onChange(async (value) => {
                    this.plugin.settings.locale = value;
                    this.i18n.setLocale(value as SupportedLocale);
                    await this.plugin.saveSettings();
                    new Notice(this.i18n.t('notices.languageChanged'), 5000);
                    // Refresh the UI to show the new language
                    this.display();
                });
            });

        new Setting(tabContent)
            .setName(this.i18n.t('settings.general.showRecordRibbonIcon.name'))
            .setDesc(this.i18n.t('settings.general.showRecordRibbonIcon.desc'))
            .addToggle(t => t
                .setValue(this.plugin.settings.showRecordRibbonIcon)
                .onChange(async (value) => {
                    this.plugin.settings.showRecordRibbonIcon = value;
                    await this.plugin.saveSettings();
                }));

        let ignoredFoldersPreviewText: HTMLSpanElement;
        new Setting(tabContent)
            .setName(this.i18n.t('settings.general.ignoredFolders.name'))
            .setDesc(createFragment(f => {
                // Use multi-line content for the main description
                const fragment = this.createMultiLineDesc('settings.general.ignoredFolders.desc');
                f.appendChild(fragment);
                ignoredFoldersPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText'
                })
                let invalidInputFolder: string = '';
                this.plugin.settings.ignoredFolders.forEach(ignoredFolder => {
                    if (!this.app.vault.getAbstractFileByPath(ignoredFolder)) invalidInputFolder = ignoredFolder
                })
                ignoredFoldersPreviewText.setText(
                    (invalidInputFolder === '')? this.i18n.t('settings.general.ignoredFolders.validation.valid') : this.i18n.t('settings.general.ignoredFolders.validation.invalid', { folder: invalidInputFolder })
                );
            }))
            .addTextArea(text => text
                .setPlaceholder(this.i18n.t('settings.general.ignoredFolders.placeholder'))
                .setValue(this.plugin.settings.ignoredFolders?.join('\n') || '')
                .onChange(async (value) => {
                    const folders = value.split(/[\n,]/)
                        .map(p => p.trim())
                        .map(p => normalizePath(p))
                        .filter(p => p.length > 0);

                    this.plugin.settings.ignoredFolders = folders;

                    // validation check
                    let invalidInputFolder: string = '';
                    folders.forEach(ignoredFolder => {
                        if (!this.app.vault.getAbstractFileByPath(ignoredFolder)) invalidInputFolder = ignoredFolder
                    })
                    ignoredFoldersPreviewText.setText(
                        (invalidInputFolder === '')? this.i18n.t('settings.general.ignoredFolders.validation.valid') : this.i18n.t('settings.general.ignoredFolders.validation.invalid', { folder: invalidInputFolder })
                    );
                    await this.plugin.saveSettings();
                })
            );

        new Setting(tabContent)
            .setName(this.i18n.t('settings.general.ignoredTags.name'))
            .setDesc(this.createMultiLineDesc('settings.general.ignoredTags.desc'))
            .addTextArea(text => text
                .setPlaceholder(this.i18n.t('settings.general.ignoredTags.placeholder'))
                .setValue(this.plugin.settings.ignoredFileTags?.join('\n') || '')
                .onChange(async (value) => {
                    const tags = value.split(/[\n,]/)
                        .map(t => t.trim())
                        .filter(t => t.length > 0)
                        .map(t => t.startsWith('#') ? t : '#' + t);

                    this.plugin.settings.ignoredFileTags = tags;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(tabContent)
            .setName(this.i18n.t('settings.general.noteThreshold.name'))
            .setDesc(this.createMultiLineDesc('settings.general.noteThreshold.desc'))
            .addDropdown(d => d
                .addOption('e', this.i18n.t('settings.general.noteThreshold.options.e'))
                .addOption('t', this.i18n.t('settings.general.noteThreshold.options.t'))
                .addOption('ent', this.i18n.t('settings.general.noteThreshold.options.ent'))
                .addOption('eot', this.i18n.t('settings.general.noteThreshold.options.eot'))
                .addOption('n', this.i18n.t('settings.general.noteThreshold.options.n'))
                .setValue(this.plugin.settings.noteThreshold)
                .onChange(async (value) => {
                    this.plugin.settings.noteThreshold = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(tabContent)
            .setName(this.i18n.t('settings.general.noteToRecord.name'))
            .setDesc(this.createMultiLineDesc('settings.general.noteToRecord.desc'))
            .addDropdown(d => d
                .addOption('all', this.i18n.t('settings.general.noteToRecord.options.all'))
                .addOption('crt', this.i18n.t('settings.general.noteToRecord.options.crt'))
                .setValue(this.plugin.settings.noteToRecord)
                .onChange(async (value) => {
                    this.plugin.settings.noteToRecord = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(tabContent)
            .setName(this.i18n.t('settings.general.autoRecordInterval.name'))
            .setDesc(this.createMultiLineDesc('settings.general.autoRecordInterval.desc'))
            .addText(text => text
                .setPlaceholder(this.i18n.t('settings.general.autoRecordInterval.placeholder'))
                .setValue(this.plugin.settings.autoRecordInterval)
                .onChange(async (value) => {
                    this.plugin.settings.autoRecordInterval = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(tabContent)
        .setName(this.i18n.t('settings.general.resetSettings.name'))
        .setDesc(this.i18n.t('settings.general.resetSettings.desc'))
        .addButton(btn => btn
                .setButtonText(this.i18n.t('settings.general.resetSettings.button'))
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
            new Notice(this.i18n.t('notices.settingsReset'), 3000);
            await sleep(100);
            this.display();
        } catch (error) {
            console.error("Could not reset settings:", error);
            new Notice(this.i18n.t('notices.settingsResetFailed'), 0);
        }
    }
}

// ========================================
// 记录器管理标签页
// ========================================
export class RecordersTab extends WordflowSubSettingsTab {
    public activeRecorderIndex: number = 0;
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
            .setName(this.i18n.t('settings.recorders.currentRecorder.name'))
            .setDesc(this.createMultiLineDesc('settings.recorders.currentRecorder.desc'));
            // Only show rename/delete for additional recorders
        if (this.activeRecorderIndex > 0) {
            recorderActions
                .addButton(btn => btn
                    .setButtonText(this.i18n.t('settings.recorders.actions.delete'))
                    .setTooltip(this.i18n.t('settings.recorders.actions.delete'))
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
                .setButtonText(this.i18n.t('settings.recorders.actions.rename'))
                .setIcon('pencil')
                .setTooltip(this.i18n.t('settings.recorders.actions.rename'))
                .onClick(() => {
                    this.renameRecorder(this.activeRecorderIndex -1);
                })
            )
            .addButton(btn => btn
                .setButtonText(this.i18n.t('settings.recorders.actions.add'))
                .setIcon('plus')
                .setTooltip(this.i18n.t('settings.recorders.actions.add'))
                //.setCta()
                .onClick( () => {
                    new ConfirmationModal(
                        this.app,
                        this.i18n.t('settings.recorders.confirmations.addRecorder'),
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
            .setName(`⚙️${activeRecorderName}`+ this.i18n.t('settings.recorders.recoderName'))
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
            this.i18n.t('settings.recorders.confirmations.deleteRecorder', { name: this.plugin.settings.Recorders[index].name }),
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
        new Setting(container).setName(this.i18n.t('settings.recorders.periodicNote.heading')).setHeading();
        const periodicFolder = new Setting(container)
            .setName(this.i18n.t('settings.recorders.periodicNote.folder.name'))
            .setDesc(createFragment(f => {
                // Use multi-line content for the main description
                const fragment = this.createMultiLineDesc('settings.recorders.periodicNote.folder.desc');
                f.appendChild(fragment);
                f.createEl('br');
                f.appendText(settings.enableDynamicFolder ? this.i18n.t('settings.recorders.periodicNote.folder.dynamicEnabled') : this.i18n.t('settings.recorders.periodicNote.folder.dynamicDisabled'));

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
                            this.i18n.t('settings.recorders.periodicNote.folder.confirmToggle'),
                            async () => {
                                settings.enableDynamicFolder = value;
                                periodicFolderPreviewText.setText(
                                    (settings.enableDynamicFolder)? moment().format(settings.periodicNoteFolder)
                                                                  : settings.periodicNoteFolder)
                                await this.plugin.saveSettings();			
                                recorderInstance.loadSettings();
                                // now update placeholder based on the setting. 
                                const placeholder = (value)? this.i18n.t('settings.recorders.periodicNote.folder.placeholderDynamic'): this.i18n.t('settings.recorders.periodicNote.folder.placeholderStatic');
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
                .setPlaceholder(settings.enableDynamicFolder ? this.i18n.t('settings.recorders.periodicNote.folder.placeholderDynamic') : this.i18n.t('settings.recorders.periodicNote.folder.placeholderStatic'))
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
            .setName(this.i18n.t('settings.recorders.periodicNote.format.name'))
            .setDesc(createFragment(f => {
                // Use the new multi-line format with inline links
                const fragment = this.createMultiLineDesc('settings.recorders.periodicNote.format.desc');
                f.appendChild(fragment);
                f.createEl('br');
                f.appendText(this.i18n.t('settings.recorders.periodicNote.format.preview'));

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
            .setName(this.i18n.t('settings.recorders.templatePlugin.name'))
            .setDesc(createFragment(f => {
                // Use multi-line content for the main description
                const fragment = this.createMultiLineDesc('settings.recorders.templatePlugin.desc');
                f.appendChild(fragment);
                f.createEl('br');

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
                    this.i18n.t('settings.recorders.templatePlugin.validation.templaterEnabled') + (templaterPluginEnabled ?'✅':'❌'));
                } else {
                    templatePluginPreviewText.setText('');
                }
            }))
            .addDropdown(d => {
                this.InsertPlaceComponent = d;
                d.addOption('none', this.i18n.t('settings.recorders.templatePlugin.options.none'));
                d.addOption('Templates', this.i18n.t('settings.recorders.templatePlugin.options.templates'));
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
                        this.i18n.t('settings.recorders.templatePlugin.validation.templaterEnabled') + (templaterPluginEnabled ?'✅':'❌'));
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
            .setName(this.i18n.t('settings.recorders.templatePlugin.filePath.name'))
            .setDesc(createFragment((f) => {
                // Use multi-line content for the main description
                const fragment = this.createMultiLineDesc('settings.recorders.templatePlugin.filePath.desc');
                f.appendChild(fragment);
                f.createEl('br');
                f.appendText('Input template file founded: ');

                templateFilePathPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText' // add custom CSS class
                });
                templateFilePathPreviewText.setText(
                    this.app.vault.getAbstractFileByPath(settings.templateFilePath) ? this.i18n.t('settings.recorders.templatePlugin.filePath.validation.found') : this.i18n.t('settings.recorders.templatePlugin.filePath.validation.notFound'));
            }))
            .addText(text => text
                .setPlaceholder(this.i18n.t('settings.recorders.templatePlugin.filePath.placeholder'))
                .setValue(settings.templateFilePath)
                .onChange(async (value) => {
                    settings.templateFilePath = normalizePath(value);
                    templateFilePathPreviewText.setText(
                        this.app.vault.getAbstractFileByPath(settings.templateFilePath) ? this.i18n.t('settings.recorders.templatePlugin.filePath.validation.found') : this.i18n.t('settings.recorders.templatePlugin.filePath.validation.notFound'));
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            );

        let templateDateFormatPreviewText: HTMLSpanElement;
        new Setting(templatePluginSettingsContainer)
            .setName(this.i18n.t('settings.recorders.templatePlugin.dateFormat.name'))
            .setDesc(createFragment((f) => {
                f.appendText(this.i18n.t('settings.recorders.templatePlugin.dateFormat.desc'));
                f.createEl('br');
                f.appendText(this.i18n.t('settings.recorders.templatePlugin.dateFormat.preview'));

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
            .setName(this.i18n.t('settings.recorders.templatePlugin.timeFormat.name'))
            .setDesc(createFragment((f) => {
                f.appendText(this.i18n.t('settings.recorders.templatePlugin.timeFormat.desc'));
                f.createEl('br');
                f.appendText(this.i18n.t('settings.recorders.templatePlugin.timeFormat.preview'));

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

        new Setting(container).setName(this.i18n.t('settings.recorders.recordingContents.heading')).setHeading();
        
        new Setting(container)
            .setName(this.i18n.t('settings.recorders.recordingContents.recordType.name'))
            .setDesc(this.i18n.t('settings.recorders.recordingContents.recordType.desc'))
            .addDropdown(d => d
                .addOption('table', this.i18n.t('settings.recorders.recordingContents.recordType.options.table'))
                .addOption('bulletList', this.i18n.t('settings.recorders.recordingContents.recordType.options.bulletList'))
                .addOption('metadata', this.i18n.t('settings.recorders.recordingContents.recordType.options.metadata'))
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
                .setName(this.i18n.t('settings.recorders.recordingContents.syntax.name'))
                .setDesc(this.createMultiLineDesc('settings.recorders.recordingContents.syntax.desc'))
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
            .setName(this.i18n.t('settings.recorders.recordingContents.insertPlace.name'))
            .setDesc(this.createMultiLineDesc('settings.recorders.recordingContents.insertPlace.desc'))
            .addDropdown(d => {
                this.InsertPlaceComponent = d;
                if (settings.recordType === 'metadata') {
                    d.addOption('yaml', this.i18n.t('settings.recorders.recordingContents.insertPlace.options.yaml'));
                } else {
                    d.addOption('bottom', this.i18n.t('settings.recorders.recordingContents.insertPlace.options.bottom'));
                    d.addOption('custom', this.i18n.t('settings.recorders.recordingContents.insertPlace.options.custom'));
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
            .setName(this.i18n.t('settings.recorders.recordingContents.insertPlace.startPosition.name'))
            .setDesc(this.i18n.t('settings.recorders.recordingContents.insertPlace.startPosition.desc'))
            .addTextArea(text => text
                .setValue(settings.insertPlaceStart || '')
                .setPlaceholder('Replace with your periodic note content that exist in the periodic note template.\nFor example: ## Modified Note')
                .onChange(async (value) => {
                    settings.insertPlaceStart = value;
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                }));
        const insertPlaceEnd = new Setting(customSettingsContainer)
            .setName(this.i18n.t('settings.recorders.recordingContents.insertPlace.endPosition.name'))
            .setDesc(this.i18n.t('settings.recorders.recordingContents.insertPlace.endPosition.desc'))
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
            .setName(this.i18n.t('settings.recorders.recordingContents.sortBy.name'))
            .setDesc(this.i18n.t('settings.recorders.recordingContents.sortBy.desc'))
            .addDropdown(d => d
                .addOption('lastModifiedTime', this.i18n.t('settings.recorders.recordingContents.sortBy.options.lastModifiedTime'))
                .addOption('editedWords', this.i18n.t('settings.recorders.recordingContents.sortBy.options.editedWords'))
                .addOption('editedTimes', this.i18n.t('settings.recorders.recordingContents.sortBy.options.editedTimes'))
                .addOption('editedPercentage', this.i18n.t('settings.recorders.recordingContents.sortBy.options.editedPercentage'))
                .addOption('modifiedNote', this.i18n.t('settings.recorders.recordingContents.sortBy.options.modifiedNote'))
                .addOption('editTime', this.i18n.t('settings.recorders.recordingContents.sortBy.options.editTime'))
                .setValue(settings.sortBy)
                .onChange(async (value) => {
                    settings.sortBy = value;
                    await this.plugin.saveSettings();
                    recorderInstance.loadSettings();
                })
            )
            .addDropdown(d => d
                .addOption('true', this.i18n.t('settings.recorders.recordingContents.sortBy.order.descend'))
                .addOption('false', this.i18n.t('settings.recorders.recordingContents.sortBy.order.ascend'))
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
            .setName(this.i18n.t('settings.recorders.recordingContents.timeFormat.name'))
            .setDesc(createFragment((f) => {
                f.appendText(this.i18n.t('settings.recorders.recordingContents.timeFormat.desc'));
                f.createEl('br');
                f.appendText(this.i18n.t('settings.recorders.recordingContents.timeFormat.preview'));

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
        this.container.empty();
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
            .setName(this.i18n.t('settings.timers.idleInterval.name'))
            .setDesc(this.createMultiLineDesc('settings.timers.idleInterval.desc'))
            .addText(text => text
                .setPlaceholder(this.i18n.t('settings.timers.idleInterval.placeholder'))
                .setValue(this.plugin.settings.idleInterval)
                .onChange(async (value) => {
                    this.plugin.settings.idleInterval = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(tabContent)
            .setName(this.i18n.t('settings.timers.useSecondInWidget.name'))
            .setDesc(this.createMultiLineDesc('settings.timers.useSecondInWidget.desc'))
            .addToggle(t => t
                .setValue(this.plugin.settings.useSecondInWidget)
                .onChange(async (value) => {
                    this.plugin.settings.useSecondInWidget = value;
                    await this.plugin.saveSettings();
                    this.plugin.Widget?.updateCurrentData();
        }));
    }
}

// ========================================
// 侧边组件设置标签页
// ========================================
export class WidgetTab extends WordflowSubSettingsTab {
    display() {
        this.container.empty();
        const tabContent = this.container.createDiv('wordflow-tab-content-scroll');

        new Setting(tabContent)
            .setName(this.i18n.t('settings.widget.enableOnLoad.name'))
            .setDesc(this.i18n.t('settings.widget.enableOnLoad.desc'))
            .addToggle(t => t
                .setValue(this.plugin.settings.enableWidgetOnLoad)
                .onChange(async (value) => {
                    this.plugin.settings.enableWidgetOnLoad = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(tabContent)
            .setName(this.i18n.t('settings.widget.showRibbonIcon.name'))
            .setDesc(this.i18n.t('settings.widget.showRibbonIcon.desc'))
            .addToggle(t => t
                .setValue(this.plugin.settings.showWidgetRibbonIcon)
                .onChange(async (value) => {
                    this.plugin.settings.showWidgetRibbonIcon = value;
                    await this.plugin.saveSettings();
                }));

        let switchToFieldOnFocusPreviewText: HTMLSpanElement
        new Setting(tabContent)
            .setName(this.i18n.t('settings.widget.switchToFieldOnFocus.name'))
            .setDesc(createFragment(f => {
                // Use multi-line content for the main description
                const fragment = this.createMultiLineDesc('settings.widget.switchToFieldOnFocus.desc');
                f.appendChild(fragment);
                f.createEl('br');

                switchToFieldOnFocusPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText' // add custom CSS class
                });

                const hasTimeField = this.plugin.Widget?.getFieldOptions().indexOf(this.plugin.settings.switchToFieldOnFocus);
                    if(this.plugin.settings.switchToFieldOnFocus !== 'disabled') {
                        switchToFieldOnFocusPreviewText.setText(
                        this.i18n.t('settings.widget.switchToFieldOnFocus.validation.hasField', { field: this.plugin.settings.switchToFieldOnFocus }) + ((hasTimeField && hasTimeField !== -1) ?': ✅':': ❌'));
                    } else switchToFieldOnFocusPreviewText.empty();
            }))
            .addDropdown(d => {
                d.addOption('disabled', this.i18n.t('settings.widget.switchToFieldOnFocus.options.disabled'));
                d.addOption('readTime', this.i18n.t('settings.widget.switchToFieldOnFocus.options.readTime'));
                d.addOption('readEditTime', this.i18n.t('settings.widget.switchToFieldOnFocus.options.readEditTime'));
                d.setValue(this.plugin.settings.switchToFieldOnFocus)
                .onChange(async (value) => {
                    this.plugin.settings.switchToFieldOnFocus = value;
                    await this.plugin.saveSettings();

                    const hasTimeField = this.plugin.Widget?.getFieldOptions().indexOf(this.plugin.settings.switchToFieldOnFocus);
                    if(value !== 'disabled') {
                        switchToFieldOnFocusPreviewText.setText(
                        this.i18n.t('settings.widget.switchToFieldOnFocus.validation.hasField', { field: this.plugin.settings.switchToFieldOnFocus }) + ((hasTimeField && hasTimeField !== -1) ?': ✅':': ❌'));
                    } else switchToFieldOnFocusPreviewText.empty();
                })
            });

        new Setting(tabContent)
            .setName(this.i18n.t('settings.widget.colorGroupLightness.name'))
            .setDesc(this.i18n.t('settings.widget.colorGroupLightness.desc'))
            .addText(text => text
                .setPlaceholder(this.i18n.t('settings.widget.colorGroupLightness.placeholder'))
                .setValue(this.plugin.settings.colorGroupLightness)
                .onChange(async (value) => {
                    this.plugin.settings.colorGroupLightness = value;
                    await this.plugin.saveSettings();
                }));

        let colorGroupSaturationPreviewText: HTMLSpanElement
        new Setting(tabContent)
            .setName(this.i18n.t('settings.widget.colorGroupSaturation.name'))
            .setDesc(createFragment(f => {
                // Use multi-line content for the main description
                const fragment = this.createMultiLineDesc('settings.widget.colorGroupSaturation.desc');
                f.appendChild(fragment);
                f.createEl('br');

                colorGroupSaturationPreviewText = f.createEl('span', {
                    cls: 'wordflow-setting-previewText' // add custom CSS class
                });
                colorGroupSaturationPreviewText.setText(this.i18n.t('settings.widget.colorGroupSaturation.preview') + this.numArrayToString(this.plugin.settings.colorGroupSaturation));
            }))
            .addText(text => text
                .setPlaceholder('65 80')
                .setValue(this.numArrayToString(this.plugin.settings.colorGroupSaturation))
                .onChange(async (value) => {
                    this.plugin.settings.colorGroupSaturation = this.stringToNumArray(value);
                    await this.plugin.saveSettings();
                    colorGroupSaturationPreviewText.setText(this.i18n.t('settings.widget.colorGroupSaturation.preview') + this.numArrayToString(this.plugin.settings.colorGroupSaturation))
                }));

        new Setting(tabContent)
            .setName(this.i18n.t('settings.widget.fieldAlias.name'))
            .setDesc(this.i18n.t('settings.widget.fieldAlias.desc'))
            .setHeading();

        this.renderValueMappingSetting(tabContent, this.plugin.settings.fieldAlias, this.plugin.Widget?.getFieldOptions() || []);
    }

    private renderValueMappingSetting(containerEl: HTMLElement, mappings: { key: string, value: string }[], availableOptions: string[]): void {
        const mappingsContainer = containerEl.createDiv('wordflow-widget-mappings-container');

        mappings.forEach((mapping, index) => {
            const setting = new Setting(mappingsContainer)
                .addDropdown(dropdown => {
                    if (availableOptions.length === 0) {
                        dropdown.addOption('', this.i18n.t('settings.widget.fieldAlias.noOptions'));
                        dropdown.setDisabled(true);
                    } else {
                        availableOptions.forEach(option => {
                            dropdown.addOption(option, option);
                        });
                    }
                    dropdown.setValue(mapping.value);
                    dropdown.onChange(async (value) => {
                        mappings[index].value = value;
                        await this.plugin.saveSettings();
                    });
                })
                .addText(text => {
                    text.setPlaceholder(this.i18n.t('settings.widget.fieldAlias.placeholder'));
                    text.setValue(mapping.key);
                    text.onChange(async (value) => {
                        mappings[index].key = value;
                        await this.plugin.saveSettings();
                        this.plugin.Widget?.updateAll();
                    });
                })
                .addButton(button => {
                    button.setButtonText(this.i18n.t('settings.widget.fieldAlias.deleteButton'));
                    button.setIcon('trash');
                    button.onClick(async () => {
                        mappings.splice(index, 1);
                        await this.plugin.saveSettings();
                        // 刷新侧栏组件以更新字段显示名称
                        this.plugin.Widget?.updateAll();
                        this.display(); // Re-render the settings tab to reflect changes
                    });
                });
        });

        new Setting(mappingsContainer)
            .addButton(button => {
                button.setButtonText(this.i18n.t('settings.widget.fieldAlias.addButton'));
                button.setIcon('plus');
                button.setCta();
                button.onClick(async () => {
                    mappings.push({ key: '', value: '' }); // Default new mapping
                    await this.plugin.saveSettings();
                    // 刷新侧栏组件以更新字段显示名称
                    this.plugin.Widget?.updateAll();
                    this.display(); // Re-render the settings tab to reflect changes
                });
            });
    }

    private stringToNumArray(input: string): number[] {
        if (!input) return this.plugin.settings.colorGroupSaturation;
        const numbers = input
            .split(/\s+/) // 使用正则分割空格（包括多个连续空格）
            .map(str => parseInt(str)) // 转换为数字
            .filter(num => !isNaN(num)) // 过滤掉无效数字
            .filter(num => num >= 0 && num <= 100);
        
        return (numbers.length > 0)
                ? numbers
                : this.plugin.settings.colorGroupSaturation;
    }

    private numArrayToString(input: number[]): string {
        let res = '';
        input.forEach((n)=>{
            res += (n.toString()+ ' ')
        });
        return res;
    }
}

// ========================================
// 状态栏设置标签页
// ========================================
export class StatusBarTab extends WordflowSubSettingsTab {
    display() {
        this.container.empty();
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
            .setName(this.i18n.t('settings.statusBar.enableMobile.name'))
            .setDesc(this.createMultiLineDesc('settings.statusBar.enableMobile.desc'))
            .addToggle(t => t
                .setValue(this.plugin.settings.enableMobileStatusBar)
                .onChange(async (value) => {
                    this.plugin.settings.enableMobileStatusBar = value;
                    await this.plugin.saveSettings();
                    updateStatusBarStyle(this.plugin.settings);
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

export class ConfirmationModal extends Modal {
    constructor(
	    app: App,
		private message: string,
		private onConfirm: () => Promise<void>
	) {
		super(app);
	}

	onOpen() {
	    const i18n = getI18n();
	    const { contentEl } = this;
		this.containerEl.addClass("wordflow-confirm-modal");

		contentEl.createEl("h3", {
		  text: i18n.t('modals.confirmation.title'),
		  cls: "confirm-title"
		});

		const messagePara = contentEl.createEl("p", {
			cls: "confirm-message"
		});

		messagePara.textContent = this.message;

		const buttonContainer = contentEl.createDiv("confirm-cancel-buttons");

		new ButtonComponent(buttonContainer)
		  .setButtonText(i18n.t('modals.confirmation.confirm'))
		  .setClass("mod-warning")
		  .onClick(async () => {
			await this.onConfirm();
			this.close();
		  });

		new ButtonComponent(buttonContainer)
		  .setButtonText(i18n.t('modals.confirmation.cancel'))
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
        const i18n = getI18n();
        const { contentEl } = this;

		new Setting(contentEl)
			.setName(i18n.t('modals.renameRecorder.title'))
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
            .setButtonText(i18n.t('modals.renameRecorder.save'))
            .setCta()
            .onClick(async () => {
                const newName = nameInput.value.trim();
                if (newName) {
                    await this.onSubmit(newName);
                    this.close();
                }
            });

        new ButtonComponent(buttonContainer)
            .setButtonText(i18n.t('modals.renameRecorder.cancel'))
            .onClick(() => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}