import WordflowTrackerPlugin from './main';
import { App, ButtonComponent, Modal, Notice, Setting, TextComponent, TextAreaComponent, DropdownComponent, MarkdownView, MarkdownRenderer, Component, setIcon } from 'obsidian';
import { DataRecorder } from './DataRecorder';
import { moment, normalizePath } from 'obsidian';
import { SupportedLocale, I18nManager, getI18n } from './i18n';
import { updateStatusBarStyle, removeStatusBarStyle } from './StatusBarManager';
import { TagColorConfig } from './Utils/TagColorManager';

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
    keepDeletedFileRecords: boolean; // whether to keep records of deleted files
    noteThreshold: string;
    noteToRecord: string;
    autoRecordInterval: string;
    currentVersion: string; // used to determine whether show change logs or not

    // Recorders tab for multiple recorders
    Recorders: RecorderConfig[];

    // Timers setting tab
    idleInterval: string;
    autoResumeFocusMode: boolean; // auto resume focus mode after idle pause when user activity detected
    // could not add another interval for focus mode directly, nor could we use reading interval as the interval will be different in reading/editing mode. 
    useSecondInWidget: boolean; // required to restart plugin, currently support widget only, others are technically supported but not recommended

    // Widget setting tab
    enableWidgetOnLoad: boolean;
    showWidgetRibbonIcon: boolean;
    switchToFieldOnFocus: string;
    fieldAlias: { key: string, value: string }[];
    colorGroupLightness: string; // required to restart widget or plugin
    colorGroupSaturation: number[]; // required to restart widget or plugin
    tagColors: TagColorConfig[]; // tag-based color configurations
    enableTagGroupBasedDataDisplay: boolean; // enable dual-layer tracker bar

    // Status bar setting tab
    enableMobileStatusBar: boolean;
    customStatusBarReadingMode: string;
    customStatusBarEditMode: string;
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
    keepDeletedFileRecords: true, // keep records of deleted files by default
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
    autoResumeFocusMode: false, 
    useSecondInWidget: false, 

    // Widget setting tab
    enableWidgetOnLoad: true,
    showWidgetRibbonIcon: true,
    switchToFieldOnFocus: 'disabled',
    colorGroupLightness: '66',
    colorGroupSaturation: [60, 85],
    tagColors: [], // 修改为支持完整颜色的数组结构
    enableTagGroupBasedDataDisplay: false, // 默认关闭
    fieldAlias: [],


    // Status bar setting tab
    enableMobileStatusBar: false,
    customStatusBarReadingMode: '📖 ${readTime}',
    customStatusBarEditMode: '⌨️ ${editTime} · ${editedTimes} edits · ${editedWords} words',
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
            .setName(this.i18n.t('settings.general.keepDeletedFileRecords.name'))
            .setDesc(this.createMultiLineDesc('settings.general.keepDeletedFileRecords.desc'))
            .addToggle(t => t
                .setValue(this.plugin.settings.keepDeletedFileRecords)
                .onChange(async (value) => {
                    this.plugin.settings.keepDeletedFileRecords = value;
                    await this.plugin.saveSettings();
                }));

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
        this.plugin.recorderManager.addRecorder(recorder);
        
        // Update widget dropdown to reflect new recorder
        if (this.plugin.Widget) {
            await this.plugin.Widget.updateAll();
        }
        
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
                    
                    // Update widget dropdown to reflect renamed recorder
                    if (this.plugin.Widget) {
                        await this.plugin.Widget.updateAll();
                    }
                    
                    this.display();
                });
            modal.open();
        } 
        else {
            const recorder = this.plugin.settings.Recorders[index];
            const modal = new RecorderRenameModal(this.app, recorder.name, async (newName) => {
                this.plugin.settings.Recorders[index].name = newName;
                await this.plugin.saveSettings();
                
                // Update widget dropdown to reflect renamed recorder
                if (this.plugin.Widget) {
                    await this.plugin.Widget.updateAll();
                }
                
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
                

                // Remove recorder instance
                this.plugin.recorderManager.removeRecorder(index + 1);

                // Reset active tab if needed
                if (this.activeRecorderIndex > this.plugin.settings.Recorders.length) {
                    this.activeRecorderIndex = 0;
                }
                
                // Update widget dropdown to reflect removed recorder
                if (this.plugin.Widget) {
                    await this.plugin.Widget.updateAll();
                }

                await this.plugin.saveSettings();
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
        const recorders = this.plugin.recorderManager.getRecorders();
        
        if (index === 0) {
            // Default recorder uses main settings
            settings = this.plugin.settings;
            recorderInstance = recorders[0];
        } else {
            // Additional recorders use their own config
            settings = this.plugin.settings.Recorders[index - 1];
            recorderInstance = recorders[index];
        }
        
        // Display all settings using the selected configuration
        this.createRecorderSettingsUI(settings, recorderInstance, index);
    }
    
    private createRecorderSettingsUI(settings: any, recorderInstance: DataRecorder, index: number) {
        const container = this.settingsContainer; // do not use containerEl, instead, use container to pass the new container element

        //container.classList.add('wordflow-setting-tab'); // for styles.css

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
                    // Update preview when record type changes
                    const previewContainer = this.settingsContainer.querySelector('.wordflow-syntax-preview-container') as HTMLElement;
                    if (previewContainer) {
                        this.updateSyntaxPreview(settings, previewContainer);
                    }
                })
            );

        const syntaxSetting = new Setting(container)
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
                            this.updateSyntaxPreview(settings, previewContainer);
                        })
                    }
                    if (settings.recordType == 'bulletList'){
                        text.setValue(settings.bulletListSyntax);
                        text.onChange(async (value) => {
                            settings.bulletListSyntax = value;
                            await this.plugin.saveSettings();
                            recorderInstance.loadSettings();
                            this.updateSyntaxPreview(settings, previewContainer);
                        })
                    }
                    if (settings.recordType == 'metadata'){
                        text.setValue(settings.metadataSyntax);
                        text.onChange(async (value) => {
                            settings.metadataSyntax = value;
                            await this.plugin.saveSettings();
                            recorderInstance.loadSettings();
                            this.updateSyntaxPreview(settings, previewContainer);
                        })
                    }				
                });
        
        makeMultilineTextSetting(syntaxSetting);

        // Add preview container below the syntax textarea
        const previewContainer = container.createDiv('wordflow-syntax-preview-container');
        previewContainer.createEl('div', { 
            text: this.i18n.t('settings.recorders.recordingContents.syntax.preview') || 'Preview:', 
            cls: 'wordflow-syntax-preview-label' 
        });
        const previewContent = previewContainer.createDiv('wordflow-syntax-preview-content');
        
        // Initial preview render
        this.updateSyntaxPreview(settings, previewContainer);

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

	private updateSyntaxPreview(settings: any, previewContainer: HTMLElement) {
		// Clear existing preview content
		const previewContent = previewContainer.querySelector('.wordflow-syntax-preview-content');
		if (!previewContent) return;
		
		previewContent.empty();
		
		// Get current syntax based on record type
		let syntax = '';
		switch (settings.recordType) {
			case 'table': syntax = settings.tableSyntax; break;
			case 'bulletList': syntax = settings.bulletListSyntax; break;
			case 'metadata': syntax = settings.metadataSyntax; break;
		}
		
		// Create sample data for preview
		const sampleData = {
			modifiedNote: 'Folder/Example Note.md',
			noteTitle: 'Example Note',
			editedTimes: '50',
			editedWords: '1200',
            changedWords: '800',
            deletedWords: '200',
            addedWords: '1000',
            docWords: '2026',
			readEditTime: '25 min',
			readTime: '15 min',
			editTime: '10 min',
			editedPercentage: '59%',
            statBar: '<span class="stat-bar-container" data-origin-words="1926" data-deleted-words="20" data-added-words="100"><span class="stat-bar origin" style="width: 60%"></span><span class="stat-bar deleted" style="width: 11%"></span><span class="stat-bar added" style="width: 49%"></span></span>',
            lastModifiedTime: moment().format(settings.timeFormat),
            comment: 'user comment that won\'t auto update',
			totalEdits: '5',
			totalWords: '150',
            totalEditTime: '15 min',
            totalReadTime: '10 min',
			totalTime: '25 min'
		};
		
		// Replace placeholders with sample data
		let previewText = syntax;
		Object.entries(sampleData).forEach(([key, value]) => {
			const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
			previewText = previewText.replace(regex, value);
		});
		
		// For metadata type, render as Obsidian-style properties panel
		if (settings.recordType === 'metadata') {
			const propertiesContainer = previewContent.createDiv({ cls: 'metadata-properties-container' });
			
			// Add "Properties" header
			const header = propertiesContainer.createDiv({ cls: 'metadata-properties-heading' });
			header.createEl('h4', { text: 'Properties' });
			
			// Parse and display properties
			const lines = previewText.split('\n').filter(line => line.trim());
			
			lines.forEach(line => {
				const colonIndex = line.indexOf(':');
				if (colonIndex > 0) {
					const propertyRow = propertiesContainer.createDiv({ cls: 'metadata-property' });
					const key = line.substring(0, colonIndex).trim();
					const value = line.substring(colonIndex + 1).trim();
					
					// Create property icon with proper alignment
					const iconContainer = propertyRow.createSpan({ cls: 'metadata-property-icon' });
					
					// Determine icon based on property type
					let iconName = 'binary'; // default for numbers
					if (value.includes('min') || value.includes('time')) {
						iconName = 'text';
					}
					setIcon(iconContainer, iconName);
					
					// Property key
					propertyRow.createSpan({ text: key, cls: 'metadata-property-key' });
					
					// Property value
					propertyRow.createSpan({ text: value, cls: 'metadata-property-value' });
				}
			});
		} else {
			// For table and bulletList, use MarkdownRenderer
			MarkdownRenderer.render(
				this.app,
				previewText,
				previewContent as HTMLElement,
				'',
				new Component()
			);
		}
	}

	
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
            .setName(this.i18n.t('settings.timers.autoResumeFocusMode.name'))
            .setDesc(this.createMultiLineDesc('settings.timers.autoResumeFocusMode.desc'))
            .addToggle(t => t
                .setValue(this.plugin.settings.autoResumeFocusMode)
                .onChange(async (value) => {
                    this.plugin.settings.autoResumeFocusMode = value;
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
                        this.i18n.t('settings.widget.switchToFieldOnFocus.validation.hasField', { field: this.plugin.settings.switchToFieldOnFocus }) + ((hasTimeField && hasTimeField !== -1) ?'✅':'❌'));
                    } else switchToFieldOnFocusPreviewText.empty();
                })
            });

        new Setting(tabContent)
            .setName(this.i18n.t('settings.widget.fieldAlias.name'))
            .setDesc(this.i18n.t('settings.widget.fieldAlias.desc'))

        this.renderValueMappingSetting(tabContent, this.plugin.settings.fieldAlias, this.plugin.Widget?.getFieldOptions() || []);
        
        new Setting(tabContent).setName(this.i18n.t('settings.widget.randomColorGeneration')).setHeading();

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
        
        new Setting(tabContent).setName(this.i18n.t('settings.widget.displayBasedOnTags')).setHeading();

        new Setting(tabContent)
            .setName(this.i18n.t('settings.widget.enableTagGroupBasedDataDisplay.name'))
            .setDesc(this.createMultiLineDesc('settings.widget.enableTagGroupBasedDataDisplay.desc'))
            .addToggle(t => t
                .setValue(this.plugin.settings.enableTagGroupBasedDataDisplay)
                .onChange(async (value) => {
                    this.plugin.settings.enableTagGroupBasedDataDisplay = value;
                    await this.plugin.saveSettings();
                    this.plugin.Widget?.updateData();
                }));

        new Setting(tabContent)
            .setName(this.i18n.t('settings.widget.tagColors.name'))
            .setDesc(this.createMultiLineDesc('settings.widget.tagColors.desc'));

        this.renderTagColorSetting(tabContent, this.plugin.settings.tagColors);
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

    private renderTagColorSetting(containerEl: HTMLElement, tagColors: TagColorConfig[]): void {
        const tagColorsContainer = containerEl.createDiv('wordflow-widget-tag-colors-container');

        tagColors.forEach((tagColor, index) => {
            const setting = new Setting(tagColorsContainer);
            
            // 创建标签输入容器（类似 Obsidian properties 的样式）
            const tagInputContainer = setting.controlEl.createDiv('tag-input-field');
            
            // 创建内联标签和输入框的容器
            const inputWrapper = tagInputContainer.createDiv('tag-input-wrapper');
            
            // 渲染已有标签（内联显示）
            this.renderInlineTags(inputWrapper, tagColor.tags || [], index, tagColors);
            
            // 创建输入框
            const input = inputWrapper.createEl('input', {
                type: 'text',
                placeholder: (tagColor.tags && tagColor.tags.length > 0) ? '' : this.i18n.t('settings.widget.tagColors.tagPlaceholder'),
                cls: 'tag-inline-input'
            });
            
            // 创建建议列表容器
            const suggestionsContainer = tagInputContainer.createDiv('tag-suggestions');
            suggestionsContainer.style.display = 'none';
            
            // 设置输入框事件
            this.setupInlineTagInput(input, suggestionsContainer, tagColor, index, tagColors, inputWrapper);
            
            // add tag group name input
            setting.addText(text => {
                text.setPlaceholder(this.i18n.t('settings.widget.tagColors.groupNamePlaceholder'))
                    .setValue(tagColor.groupName || '')
                    .onChange(async (value) => {
                        tagColors[index].groupName = value.trim() || undefined;
                        await this.plugin.saveSettings();
                        this.plugin.Widget?.updateTagColors();
                    });
            });
            
            // 添加颜色选择器
            setting.addColorPicker(colorPicker => {
                const displayHex = tagColor.color || '#3366cc';
                colorPicker.setValue(displayHex);
                colorPicker.onChange(async (value) => {
                    // 保存完整的颜色值
                    tagColors[index].color = value;
                    await this.plugin.saveSettings();
                    this.plugin.Widget?.updateTagColors();
                });
            });
            
            // 添加删除按钮
            setting.addButton(button => {
                button.setButtonText(this.i18n.t('settings.widget.tagColors.deleteButton'));
                button.setIcon('trash');
                button.onClick(async () => {
                    tagColors.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.plugin.Widget?.updateTagColors();
                    this.display();
                });
            });
        });

        new Setting(tagColorsContainer)
            .addButton(button => {
                button.setButtonText(this.i18n.t('settings.widget.tagColors.addButton'));
                button.setIcon('plus');
                button.setCta();
                
                if (tagColors.length >= 10) {
                    button.setDisabled(true);
                    button.setTooltip(this.i18n.t('settings.widget.tagColors.maxLimit') || 'Maximum 10 tag colors allowed');
                } else {
                    button.onClick(async () => {
                        tagColors.push({ tags: [], color: '#3366cc', groupName: undefined });
                        await this.plugin.saveSettings();
                        this.plugin.Widget?.updateTagColors();
                        this.display();
                    });
                }
            });
    }

    private renderInlineTags(container: HTMLElement, tags: string[], configIndex: number, tagColors: TagColorConfig[]): void {
        // 清除现有的标签，但保留输入框
        const existingTags = container.querySelectorAll('.inline-tag-item');
        existingTags.forEach(tag => tag.remove());
        
        // 在输入框前插入标签
        const input = container.querySelector('.tag-inline-input');
        
        tags.forEach((tag, tagIndex) => {
            const tagEl = container.createDiv('inline-tag-item');
            if (input) {
                container.insertBefore(tagEl, input);
            } else {
                container.appendChild(tagEl);
            }
            
            tagEl.createSpan('inline-tag-text').textContent = tag;
            
            const removeBtn = tagEl.createEl('button', { cls: 'inline-tag-remove-btn' });
            removeBtn.innerHTML = '×';
            removeBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                tagColors[configIndex].tags.splice(tagIndex, 1);
                await this.plugin.saveSettings();
                this.plugin.Widget?.updateTagColors();
                this.renderInlineTags(container, tagColors[configIndex].tags, configIndex, tagColors);
                // 更新输入框占位符
                const inputEl = container.querySelector('.tag-inline-input') as HTMLInputElement;
                if (inputEl) {
                    inputEl.placeholder = tagColors[configIndex].tags.length === 0 ? 
                        this.i18n.t('settings.widget.tagColors.tagPlaceholder') : '';
                }
            };
        });
    }

    private setupInlineTagInput(
        input: HTMLInputElement, 
        suggestionsContainer: HTMLElement, 
        tagColor: TagColorConfig, 
        configIndex: number, 
        tagColors: TagColorConfig[],
        inputWrapper: HTMLElement
    ): void {
        let currentSuggestions: string[] = [];
        
        // 获取所有可用标签
        const getAllTags = (): string[] => {
            const allTags = new Set<string>();
            const metadataCache = this.app.metadataCache;
            const allFiles = this.app.vault.getMarkdownFiles();
            
            allFiles.forEach(file => {
                const cache = metadataCache.getFileCache(file);
                if (cache?.tags) {
                    cache.tags.forEach(tagRef => {
                        allTags.add(tagRef.tag.replace('#', ''));
                    });
                }
                if (cache?.frontmatter?.tags) {
                    const frontmatterTags = cache.frontmatter.tags;
                    if (Array.isArray(frontmatterTags)) {
                        frontmatterTags.forEach(tag => allTags.add(tag.replace('#', '')));
                    } else if (typeof frontmatterTags === 'string') {
                        allTags.add(frontmatterTags.replace('#', ''));
                    }
                }
            });
            
            return Array.from(allTags);
        };
        
        // 获取已使用的标签
        const getUsedTags = (): Set<string> => {
            const usedTags = new Set<string>();
            tagColors.forEach(config => {
                config.tags?.forEach(tag => usedTags.add(tag));
            });
            return usedTags;
        };
        
        // 输入事件处理
        input.addEventListener('input', () => {
            const value = input.value.trim();
            if (value.length === 0) {
                suggestionsContainer.style.display = 'none';
                return;
            }
            
            const allTags = getAllTags();
            const usedTags = getUsedTags();
            const currentTags = new Set(tagColor.tags || []);
            
            currentSuggestions = allTags.filter(tag => 
                tag.toLowerCase().includes(value.toLowerCase()) &&
                !usedTags.has(tag) &&
                !currentTags.has(tag)
            ).slice(0, 10);
            
            this.renderSuggestions(suggestionsContainer, currentSuggestions, input, tagColor, configIndex, tagColors, inputWrapper);
        });
        
        // 键盘事件处理
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addInlineTag(input.value.trim(), tagColor, configIndex, tagColors, inputWrapper);
                input.value = '';
                suggestionsContainer.style.display = 'none';
            } else if (e.key === 'Escape') {
                suggestionsContainer.style.display = 'none';
            } else if (e.key === 'Backspace' && input.value === '' && tagColor.tags && tagColor.tags.length > 0) {
                // 当输入框为空且按退格键时，删除最后一个标签
                e.preventDefault();
                tagColor.tags.pop();
                this.plugin.saveSettings();
                this.plugin.Widget?.updateTagColors();
                this.renderInlineTags(inputWrapper, tagColor.tags, configIndex, tagColors);
                input.placeholder = tagColor.tags.length === 0 ? 
                    this.i18n.t('settings.widget.tagColors.tagPlaceholder') : '';
            }
        });
        
        // 失去焦点时隐藏建议
        input.addEventListener('blur', () => {
            setTimeout(() => {
                suggestionsContainer.style.display = 'none';
            }, 200);
        });
        
        // 点击输入框时聚焦
        input.addEventListener('focus', () => {
            if (input.value.trim().length > 0) {
                input.dispatchEvent(new Event('input'));
            }
        });
    }
    
    private renderSuggestions(
        container: HTMLElement, 
        suggestions: string[], 
        input: HTMLInputElement,
        tagColor: TagColorConfig,
        configIndex: number,
        tagColors: TagColorConfig[],
        inputWrapper: HTMLElement
    ): void {
        container.empty();
        
        if (suggestions.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        
        suggestions.forEach(suggestion => {
            const suggestionEl = container.createDiv('tag-suggestion-item');
            suggestionEl.textContent = suggestion;
            suggestionEl.onclick = () => {
                this.addInlineTag(suggestion, tagColor, configIndex, tagColors, inputWrapper);
                input.value = '';
                container.style.display = 'none';
            };
        });
    }
    
    private async addInlineTag(
        tag: string, 
        tagColor: TagColorConfig, 
        configIndex: number, 
        tagColors: TagColorConfig[],
        inputWrapper: HTMLElement
    ): Promise<void> {
        const cleanTag = tag.replace('#', '').trim();
        if (!cleanTag) return;
        
        if (!tagColor.tags) tagColor.tags = [];
        if (tagColor.tags.includes(cleanTag)) return;
        
        // 检查是否已被其他配置使用
        const isUsed = tagColors.some((config, index) => 
            index !== configIndex && config.tags?.includes(cleanTag)
        );
        if (isUsed) return;
        
        tagColor.tags.push(cleanTag);
        await this.plugin.saveSettings();
        this.plugin.Widget?.updateTagColors();
        this.renderInlineTags(inputWrapper, tagColor.tags, configIndex, tagColors);
        
        // 更新输入框占位符
        const inputEl = inputWrapper.querySelector('.tag-inline-input') as HTMLInputElement;
        if (inputEl) {
            inputEl.placeholder = '';
        }
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

        new Setting(tabContent)
            .setName(this.i18n.t('settings.statusBar.customContent.name'))
            .setDesc(this.createMultiLineDesc('settings.statusBar.customContent.desc'))
            .setHeading();

        const readingModeSetting = new Setting(tabContent)
            .setName(this.i18n.t('settings.statusBar.customContent.readingMode.name'))
            .setDesc(this.createMultiLineDesc('settings.statusBar.customContent.readingMode.desc'))
            .addTextArea(text => text
                .setPlaceholder('📖 ${readTime}')
                .setValue(this.plugin.settings.customStatusBarReadingMode)
                .onChange(async (value) => {
                    this.plugin.settings.customStatusBarReadingMode = value;
                    await this.plugin.saveSettings();
                    this.plugin.statusBarManager.refresh();
                }));

        makeMultilineTextSetting(readingModeSetting);

        const editModeSetting = new Setting(tabContent)
            .setName(this.i18n.t('settings.statusBar.customContent.editMode.name'))
            .setDesc(this.createMultiLineDesc('settings.statusBar.customContent.editMode.desc'))
            .addTextArea(text => text
                .setPlaceholder('⌨️ ${editTime} · ${editedTimes} edits · ${editedWords} words')
                .setValue(this.plugin.settings.customStatusBarEditMode)
                .onChange(async (value) => {
                    this.plugin.settings.customStatusBarEditMode = value;
                    await this.plugin.saveSettings();
                    this.plugin.statusBarManager.refresh();
                }));

        makeMultilineTextSetting(editModeSetting);
    }
}

// ========================================
// Reference 参考文档标签页
// ========================================
export class ReferenceTab extends WordflowSubSettingsTab {
    private renderComponent: Component;

    constructor(app: App, plugin: WordflowTrackerPlugin, container: HTMLElement) {
        super(app, plugin, container);
        this.renderComponent = new Component();
    }

    display() {
        this.container.empty();
        const tabContent = this.container.createDiv('wordflow-tab-content-scroll');
        
        // Get the markdown content from i18n (simple string)
        const content = this.i18n.t('settings.reference.content');
        
        // Create a markdown renderer container
        const markdownContainer = tabContent.createDiv('wordflow-reference-container');
        
        // Use Obsidian's markdown renderer (same as ChangelogModal)
        MarkdownRenderer.render(
            this.app,
            content,
            markdownContainer,
            '',
            this.renderComponent
        );
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