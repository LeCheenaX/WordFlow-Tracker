// add EditorTransaction
import { App, ButtonComponent, debounce, Editor, EventRef, MarkdownView, Modal, Notice, normalizePath, Plugin, PluginSettingTab, Setting, TextAreaComponent, TFile, DropdownComponent } from 'obsidian';
//import { EditorState, StateField, Extension, ChangeSet, Transaction } from "@codemirror/state";
import { historyField, history } from "@codemirror/commands";
//import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
//import { wordsCounter } from "./stats";
import { DocTracker } from './DocTracker';
import { DataRecorder } from './DataRecorder';

// Remember to rename these classes and interfaces!
const DEBUG = true as const;

export interface WordflowMetaSettings {
	name: string;
	periodicNoteFolder: string;
	periodicNoteFormat: string;
	recordType: string;
	tableSyntax: string;
	bulletListSyntax: string;
	metadataSyntax: string;
	timeFormat: string;
	sortBy: string;
	isDescend: boolean;
	filterZero: boolean;
	autoRecordInterval: string;
	insertPlace: string;
	insertPlaceStart: string;
	insertPlaceEnd: string;
}

export interface WordflowSettings extends WordflowMetaSettings{
	// for multiple recorders
	Recorders: RecorderConfig[];
}

export interface RecorderConfig extends WordflowMetaSettings {
	id: string;
	name: string;
}

const DEFAULT_SETTINGS: WordflowSettings = {
	name: 'Default Recorder',
	periodicNoteFolder: '',
	periodicNoteFormat: 'YYYY-MM-DD',
	recordType: 'table',
	insertPlace: 'bottom',
	tableSyntax: `| Note                | Edited Words   | Last Modified Time  |\n| ------------------- | ---------------- | ------------------- |\n| [[\${modifiedNote}]] | \${editedWords} | \${lastModifiedTime} |`,
	bulletListSyntax: `- \${modifiedNote}\n    - Edits: \${editedTimes}\n    - Edited Words: \${editedWords}`,
	metadataSyntax: `Total edits: \${totalEdits}\nTotal words: \${totalWords}`,
	timeFormat: 'YYYY-MM-DD HH:mm',
	sortBy: 'lastModifiedTime',
	isDescend: true,
	filterZero: true,
	autoRecordInterval: '0', // disable
	insertPlaceStart: '',
	insertPlaceEnd: '',

	// for multiple recorders
	Recorders: [],
}


export default class WordflowTrackerPlugin extends Plugin {
	settings: WordflowSettings;
	private activeTrackers: Map<string, boolean> = new Map(); // for multiple notes editing	
    private pathToNameMap: Map<string|undefined, string> = new Map(); // 新增：反向映射用于重命名检测
	public trackerMap: Map<string, DocTracker> = new Map<string, DocTracker>(); // give up nested map
	public statusBarTrackerEl: HTMLElement; // for status bar tracking
	public statusBarContent: string; // for status bar content editing
	public DocRecorders: DataRecorder[] = [];

	async onload() {
		await this.loadSettings();

		const defaultRecorder = new DataRecorder(this, this.trackerMap);
        this.DocRecorders.push(defaultRecorder);
		for (const recorderConfig of this.settings.Recorders) {
            const recorder = new DataRecorder(this, this.trackerMap, recorderConfig);
            this.DocRecorders.push(recorder);
        }


		const debouncedHandler = this.instantDebounce(this.activeDocHandler.bind(this), 50);
		// Warning: don't change the delay, we need 50ms delay to trigger activeDocHandler twice when opening new files. 
//		if (DEBUG) console.log("Following files were opened:", this.potentialEditors.map(f => f)); 

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('file-clock', 'Record wordflows from edited notes', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice(`Try recording wordflows to periodic note!`, 3000);
			
			for (const DocRecorder of this.DocRecorders) {
				DocRecorder.record();
			}

		});
		// Perform additional things with the ribbon
		//ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		this.statusBarTrackerEl = this.addStatusBarItem();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'record-wordflows-from-edited-notes-to-periodic-note',
			name: 'Record wordflows from edited notes to periodic note',
			callback: () => {
				for (const DocRecorder of this.DocRecorders) {
                    DocRecorder.record();
                }
				new Notice(`Try recording wordflows to periodic note!`, 3000);
			}
		});
		/*
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});
		*/

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new WordflowSettingTab(this.app, this));

		/* Registered Events */	
		// Update tracking files after rename events
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            if (file instanceof TFile) {
                const oldName = this.pathToNameMap.get(oldPath);
                if (oldName && this.activeTrackers.has(oldName)) {
                    // 迁移追踪记录到新文件名
                    this.activeTrackers.set(file.basename, true);
                    this.activeTrackers.delete(oldName);
                    
                    // 更新路径映射
                    this.pathToNameMap.delete(oldPath);
                    this.pathToNameMap.set(file.path, file.basename);
                }
            }
        }));

		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			debouncedHandler();
        }));

		this.registerEvent(this.app.workspace.on('layout-change', () => {
			debouncedHandler();
        }));

		if (this.app.workspace.getActiveViewOfType(MarkdownView)?.getMode() == "source")
			{
				debouncedHandler();
			}


		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		/*
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
			//test to switch between editor
			if(this.app.workspace.activeEditor)
			{
				console.log(this.app.workspace.activeEditor.file?.basename)
			}
		});
		*/

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		if (this.settings.autoRecordInterval && Number(this.settings.autoRecordInterval) != 0){
			this.registerInterval(window.setInterval(() => {
				for (const DocRecorder of this.DocRecorders) {
                    DocRecorder.record();
                }
				new Notice(`Try recording wordflows to periodic note!`, 3000);
			}, Number(this.settings.autoRecordInterval) * 1000));
		}
	}
	

	// add private functions since here
	private async activeDocHandler(){	
		await sleep(
			(this.app.workspace.getActiveViewOfType(MarkdownView))? 0 : 200 // set delay for newly opened file to fetch the actual view, while maintaining the ability to fast switch files			
		)
		
//		console.log("trackerMap",this.trackerMap);
		//console.log("editor:", this.app.workspace.getActiveViewOfType(MarkdownView)); // bug & warning: get null when open new files, get old files if no delay
		if (this.app.workspace.getActiveViewOfType(MarkdownView)?.getMode() == "source"){
//			if (DEBUG) new Notice(`Now Edit Mode!`); // should call content in if (activeEditor)
			// done | need to improve when plugin starts, the cursor must at active document
			const activeEditor = this.app.workspace.getActiveViewOfType(MarkdownView);
//			if (DEBUG) console.log("Editing file:",this.app.workspace.activeEditor?.file?.basename) // debug

			this.activateTracker(activeEditor); // activate without delay

			await sleep(100); // set delay for getting the correct opened files for deactivating and deleting Map
			const potentialEditors = new Set(this.getAllOpenedFiles());
//			console.log(potentialEditors) // debug
			this.trackerMap.forEach(async (tracker, filePath) => {
				if(potentialEditors.has(filePath)) {
					if (filePath !== activeEditor?.file?.path) tracker.deactivate();
				}
				else{
					tracker.deactivate();
					for (const DocRecorder of this.DocRecorders) {
						DocRecorder.record(tracker);
					}
					this.trackerMap.delete(filePath);
//					if (DEBUG) console.log("Closed file:", filePath, " is recorded.")
				}
			});

			
		}
		else{
			// deregister all inactive files
			await sleep(100); // set delay for getting the correct opened files for deactivating and deleting Map
			const potentialEditors = new Set(this.getAllOpenedFiles());
//			console.log(potentialEditors) // debug
			this.trackerMap.forEach(async (tracker, filePath)=>{
				if(potentialEditors.has(filePath)) tracker.deactivate();
				else{
					tracker.deactivate();
					for (const DocRecorder of this.DocRecorders) {
						DocRecorder.record(tracker);
					}
					this.trackerMap.delete(filePath);
//					if (DEBUG) console.log("Closed file:", filePath, " is recorded.")
				}
			});
		}
	};


	// create or activate DocTracker
	private async activateTracker(activeEditor: MarkdownView | null) {	
		if (!activeEditor?.file?.path) return; 
		let activeFilePath = activeEditor?.file?.path; 
		// rename后更新路径映射
        this.pathToNameMap.set(activeEditor?.file?.path, activeFilePath);

//		console.log("Calling:", activeFilePath, " activeState:", this.trackerMap.get(activeFilePath)?.isActive) // debug
		// normal process

		if (!this.trackerMap.has(activeFilePath)){
		// track active File
		const newTracker = new DocTracker(activeFilePath, activeEditor, this);
		this.trackerMap.set(activeFilePath, newTracker);
		} 
		else{
			this.trackerMap.get(activeFilePath)?.activate();
		}
		//await sleep(50); // for the process completion
	};
/*
		if(DEBUG){	
			const trackerEntries:any = [];
			this.trackerMap.forEach((tracker, fileName) => {
				trackerEntries.push({
					fileName: fileName,
					trackerActiveState: tracker.isActive,
					lastDone: tracker.lastDone
				});
			});
			console.log("Current trackerMap:", trackerEntries);
			const potentialEditors2 = this.getAllOpenedFiles();
			console.log("Following files were opened:", potentialEditors2.map(f => f)); 
		}
*/

	// get markdown files (with path) that are in edit mode from all leaves
	private getAllOpenedFiles = (): string[] => {
		const files: string[] = [];
		const addTFile = (file: string) => {
			if (!files.contains(file)) files.push(file);
		}
		
		const MDLeaves = this.app.workspace.getLeavesOfType('markdown');
		//if (DEBUG) console.log("MD Leaves:", MDLeaves);
		if (MDLeaves.length < 1) return files;
		MDLeaves.forEach(leaf => {
			//console.log(leaf);
			//if (leaf.view?.getMode() == 'source'){ // Warning: file must have been opened to have function 'getMode()', this influences only start up loading files in saved workspace 
			// Use getState() instead of getMode() and getFile()
			if (leaf.view?.getState().mode == 'source'){ // includes preview mode and source mode
				// @ts-expect-error
				addTFile(leaf.view.getState().file); // get file path of TFile, or get file path directly, and then add to array | which to get depends on if the files have been opened or not. 
			}; 
			// @ts-expect-error
			if (leaf.history.backHistory.length > 0){
				// @ts-expect-error
				leaf.history.backHistory.forEach( item => {
					if (item.state.state.mode == 'source'){				
						addTFile(item.state.state.file); 
					}
				})
			}
			// @ts-expect-error
			if (leaf.history.forwardHistory.length > 0){
				// @ts-expect-error
				leaf.history.forwardHistory.forEach( item => {
					if (item.state.state.mode == 'source'){			
						addTFile(item.state.state.file);
					}
				})
			}	
		})
		return files;
	};

	//private debouncedDeactivator = debounce()

	private instantDebounce<T extends (...args: any[]) => void>(
		fn: T,
		wait: number
	  ): (...args: Parameters<T>) => void {
		let lastCallTime = 0; 
		let timeoutId: number | null = null; 
	  
		return function (this: any, ...args: Parameters<T>) {
		  const now = Date.now();
		  
		  // run immediately and ban running until timeout exceeded
		  if (now - lastCallTime >= wait) {
			// 清理可能存在的残留计时器
			if (timeoutId !== null) {
			  clearTimeout(timeoutId);
			  timeoutId = null;
			}

			// run immediately
			fn.apply(this, args);
			lastCallTime = now;
			
			// set timeout
			timeoutId = window.setTimeout(() => {
			  timeoutId = null;
			}, wait);
		  }
		};
	  }

	onunload() {
		this.trackerMap.forEach((tracker, filePath)=>{
			tracker.deactivate();
		})
    	this.trackerMap.clear();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
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
		this.containerEl.addClass("confirm-modal");
		
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

class WordflowSettingTab extends PluginSettingTab {
	plugin: WordflowTrackerPlugin;
	// for multiple recorders
	private activeRecorderIndex: number = 0; // 0 = default recorder
	private recorderTabs: HTMLElement;
	private settingsContainer: HTMLElement;

	constructor(app: App, plugin: WordflowTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		containerEl.classList.add('wordflow-setting-tab');
		
		// Create recorder management section
		this.createRecorderManagementSection(containerEl);
		
		// Add separator
		//containerEl.createEl('hr', { cls: 'settings-separator' });
		
		// Create a container for the recorder settings that won't be cleared
		this.settingsContainer = containerEl.createDiv('recorder-settings-container');
		
		// Display settings for active recorder
		this.displayRecorderSettings(this.activeRecorderIndex);
	}

	private createRecorderManagementSection(containerEl: HTMLElement): void {
		
		// Create recorder selection
		const recorderSelectionContainer = containerEl.createDiv('recorder-selection-container');
		
		// Show currently active recorder
		let activeRecorderName = this.plugin.settings.name;
		if (this.activeRecorderIndex > 0) {
			activeRecorderName = this.plugin.settings.Recorders[this.activeRecorderIndex - 1].name;
		}
		
		const recorderActions = new Setting(recorderSelectionContainer)
			.setName('Current Recorder')
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
						'Please ensure that there are no duplicate record type per note, or undefined behavior will occur!\n\nExample allowed✅:\n\tRecorder1: Periodic note format = YYYY-MM-DD; Record type = table;\n\tRecorder2: Periodic note format = YYYY-MM-DD; Record type = bullet list;\nExample allowed✅:\n\tRecorder1: Periodic note format = YYYY-MM-DD; Record type = table;\n\tRecorder2: Periodic note format = YYYY-MM; Record type = table;\nExample disallowed❌:\n\tRecorder1: Periodic note format = YYYY-MM-DD; Record type = table; Insert to position = bottom;\n\tRecorder2: Periodic note format = YYYY-MM-DD; Record type = table; Insert to position = custom;',
						async () => {this.createNewRecorder();}
					).open()
				})	
			);

		new Setting(recorderSelectionContainer)
			.setName('Reset all settings')
			.setDesc('Reset all settings to the default value.')
			.addButton(btn => btn
				  .setButtonText('Reset settings')
				  .setWarning()
				  //.setIcon('alert-triangle')
				  .onClick(() => this.confirmReset())
			)
			
		
		// Create title for settings section
		containerEl.createEl('h3', { 
			text: `⏺️${activeRecorderName} settings`,
			cls: 'recorder-settings-heading'
		});
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
            periodicNoteFolder: DEFAULT_SETTINGS.periodicNoteFolder,
            periodicNoteFormat: DEFAULT_SETTINGS.periodicNoteFormat,
            recordType: DEFAULT_SETTINGS.recordType,
            tableSyntax: DEFAULT_SETTINGS.tableSyntax,
            bulletListSyntax: DEFAULT_SETTINGS.bulletListSyntax,
            metadataSyntax: DEFAULT_SETTINGS.metadataSyntax,
            timeFormat: DEFAULT_SETTINGS.timeFormat,
            sortBy: DEFAULT_SETTINGS.sortBy,
            isDescend: DEFAULT_SETTINGS.isDescend,
            filterZero: DEFAULT_SETTINGS.filterZero,
            autoRecordInterval: DEFAULT_SETTINGS.autoRecordInterval,
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
		new Setting(container)
			.setName('Periodic note folder')
			.setDesc('Set the folder for daily notes or weekly note to place, which should correspond to the same folder of Obsidian daily note plugin and of templater plugin(if installed).')
			.addText(text => text
				.setPlaceholder('set daily note folder')
				.setValue(settings.periodicNoteFolder)
				.onChange(async (value) => {
					settings.periodicNoteFolder = normalizePath(value);
					await this.plugin.saveSettings();
					recorderInstance.loadSettings();
				})
			);

		new Setting(container)
			.setName('Periodic note format')
			.setDesc('Set the file name for newly created daily notes or weekly note, which should correspond to the same format setting of Obsidian daily note plugin and of templater plugin(if installed).')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(settings.periodicNoteFormat)
				.onChange(async (value) => {
					settings.periodicNoteFormat = value;
					await this.plugin.saveSettings();
					recorderInstance.loadSettings();
				})
			);

		new Setting(container).setName('Recording contents setting').setHeading();
		
		new Setting(container)
			.setName('Record content type')
			.setDesc('Select a type of content to record on specified notes.')
			.addDropdown(d => d
				.addOption('table', 'table')
				.addOption('bulletList', 'bullet list')
				.addOption('metadata', 'metadata(Alpha)')
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

		this.makeMultilineTextSetting(
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
		customSettingsContainer.id = "custom-position-settings";
		// Add custom CSS to remove separation between settings
		customSettingsContainer.addClass('wordflow-custom-container');
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

		this.makeMultilineTextSetting(insertPlaceStart);
		this.makeMultilineTextSetting(insertPlaceEnd);

		
		
		const sortBySettingsContainer = container.createDiv();
		sortBySettingsContainer.id = "sort-by-settings";
		// Add custom CSS to remove separation between settings
		sortBySettingsContainer.addClass('wordflow-sortby-container');
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
		mTimeFormatSettingsContainer.id = "mtime-format-settings";
		// Add custom CSS to remove separation between settings
		mTimeFormatSettingsContainer.addClass('wordflow-mtime-format-container');
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
			
		new Setting(container).setName('Recording options').setHeading();
		new Setting(container)
			.setName('Filter out non-modified notes')
			.setDesc('Whether the opened notes that are not modified should be excluded while recording. If not excluded, you will get any opened file under editing mode recorded. ')
			.addToggle(t => t
				.setValue(settings.filterZero)
				.onChange(async (value) => {
					settings.filterZero = value;
					await this.plugin.saveSettings();			
					recorderInstance.loadSettings();
				})
			);
		
		new Setting(container)
			.setName('Automatic recording interval')
			.setDesc('Set the interval in seconds, influencing when the plugin should save all tracked records and implement them on periodic notes. Set to 0 to disable. ')
			.addText(text => text
				.setPlaceholder('Set to 0 to disable')
				.setValue(settings.autoRecordInterval)
				.onChange(async (value) => {
					settings.autoRecordInterval = value;
					await this.plugin.saveSettings();
					recorderInstance.loadSettings();
				})
			);
	}

	private SyntaxComponent?: TextAreaComponent;

	private async updateSyntax(settings: any) {
		if (!this.SyntaxComponent) return;
		switch (settings.recordType){
			case 'table': this.SyntaxComponent.setValue(settings.tableSyntax); break;
			case 'bulletList': this.SyntaxComponent.setValue(settings.bulletListSyntax); break;
			case 'metadata': this.SyntaxComponent.setValue(settings.metadataSyntax); break;
		}
	};

	private InsertPlaceComponent?: DropdownComponent;
	private async updateInsertPlace(settings: any): Promise<void>{
		if (!this.InsertPlaceComponent) return;
		this.InsertPlaceComponent.selectEl.innerHTML = '';
		if (settings.recordType == 'metadata'){
			this.InsertPlaceComponent.addOption('yaml', 'yaml/frontmatter(Alpha)');
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
        const customSettingsContainer = document.getElementById("custom-position-settings");
        if (customSettingsContainer) {
            customSettingsContainer.style.display = show ? "block" : "none";
        }
    }

	private toggleSortByVisibility(show: boolean) {
        const sortBySettingsContainer = document.getElementById("sort-by-settings");
        if (sortBySettingsContainer) {
            sortBySettingsContainer.style.display = show ? "block" : "none";
        }
    }

	private toggleMTimeVisibility(show: boolean) {
        const mTimeFormatSettingsContainer = document.getElementById("mtime-format-settings");
        if (mTimeFormatSettingsContainer) {
            mTimeFormatSettingsContainer.style.display = show ? "block" : "none";
        }
    }

	// modified from https://github.com/obsidian-tasks-group/obsidian-tasks/blob/main/src/Config/SettingsTab.ts#L842
	private makeMultilineTextSetting(setting: Setting) {
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
		  new Notice('❌ Could not reset settings! Check console!', 5000);
		}
	  }
}

class RecorderRenameModal extends Modal {
    private currentName: string;
    private onSubmit: (newName: string) => Promise<void>;

    constructor(app: App, currentName: string, onSubmit: (newName: string) => Promise<void>) {
        super(app);
        this.currentName = currentName;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl("h3", { text: "Rename Recorder" });
        
        const inputContainer = contentEl.createDiv();
        const nameInput = inputContainer.createEl("input", { 
            type: "text",
            value: this.currentName
        });
        nameInput.style.width = "100%";
        nameInput.focus();
        
        const buttonContainer = contentEl.createDiv("recorder-rename-buttons");
        buttonContainer.style.marginTop = "1rem";
        
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