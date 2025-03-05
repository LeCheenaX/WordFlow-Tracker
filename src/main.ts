// add EditorTransaction
import { App, debounce, Editor, EventRef, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TextAreaComponent, TFile } from 'obsidian';
//import { EditorState, StateField, Extension, ChangeSet, Transaction } from "@codemirror/state";
import { historyField, history } from "@codemirror/commands";
//import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
//import { wordsCounter } from "./stats";
import { DocTracker } from './DocTracker';
import {recorder} from './recorder';

// Remember to rename these classes and interfaces!
const DEBUG = true as const;

export interface WordflowSettings {
	periodicNoteFolder: string;
	periodicNoteFormat: string;
	recordType: string;
	tableSyntax: string;
	bulletListSyntax: string;
	timeFormat: string;
	sortBy: string;
	isDescend: boolean;
	autoRecordInterval: string;
}

const DEFAULT_SETTINGS: WordflowSettings = {
	periodicNoteFolder: '',
	periodicNoteFormat: 'YYYY-MM-DD',
	recordType: 'table',
	tableSyntax: `\n| Note                | Edited Words   | Last Modified Time  |\n| ------------------- | ---------------- | ------------------- |\n| [[\${modifiedNote}]] | \${editedWords} | \${lastModifiedTime} |`,
	bulletListSyntax: `- \${modifiedNote}\n    - eTimes: \${editedTimes}\n    - eWords: \${editedWords}`,
	timeFormat: 'YYYY-MM-DD HH:mm',
	sortBy: 'lastModifiedTime',
	isDescend: true,
	autoRecordInterval: '120',
}


export default class WordflowTrackerPlugin extends Plugin {
	settings: WordflowSettings;
	private activeTrackers: Map<string, boolean> = new Map(); // for multiple notes editing	
    private pathToNameMap: Map<string|undefined, string> = new Map(); // 新增：反向映射用于重命名检测
	public trackerMap: Map<string, DocTracker> = new Map<string, DocTracker>(); // give up nested map
	public statusBarTrackerEl: HTMLElement; // for status bar tracking
	public statusBarContent: string; // for status bar content editing

	async onload() {
		await this.loadSettings();
		const debouncedHandler = this.instantDebounce(this.activeDocHandler.bind(this), 50);
		// Warning: don't change the delay, we need 50ms delay to trigger activeDocHandler twice when opening new files. 
//		if (DEBUG) console.log("Following files were opened:", this.potentialEditors.map(f => f)); 

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Record wordflow', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('Try recording wordflows to note!');
			
			this.docRecorder(this);

		});
		// Perform additional things with the ribbon
		//ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		this.statusBarTrackerEl = this.addStatusBarItem();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'record-edit-changes-to-periodic-note',
			name: 'Record edit changes to periodic note',
			callback: () => {
				this.docRecorder(this);
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
		this.registerInterval(window.setInterval(() => {
			this.docRecorder(this);
		}, Number(this.settings.autoRecordInterval) * 1000));
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
					this.docRecorder(this);
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
					this.docRecorder(this);
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
	// the docRecorder
	private docRecorder = recorder();

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
/*
class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');

	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
*/
class WordflowSettingTab extends PluginSettingTab {
	plugin: WordflowTrackerPlugin;

	constructor(app: App, plugin: WordflowTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.classList.add('wordflow-setting-tab');
		
		new Setting(containerEl)
			.setName('Periodic note folder')
			.setDesc('Set the folder for daily notes or weekly note to place, which should correspond to the same folder of Obsidian daily note plugin and of templater plugin(if installed).')
			.addText(text => text
				.setPlaceholder('set daily note folder')
				.setValue(this.plugin.settings.periodicNoteFolder)
				.onChange(async (value) => {
					this.plugin.settings.periodicNoteFolder = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Periodic note format')
			.setDesc('Set the file name for newly created daily notes or weekly note, which should correspond to the same format setting of Obsidian daily note plugin and of templater plugin(if installed).')
			.addText(text => text
				.setValue(this.plugin.settings.periodicNoteFormat)
				.onChange(async (value) => {
					this.plugin.settings.periodicNoteFormat = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Record content type')
			.setDesc('Select a type of content to record on specified notes.')
			.addDropdown(d => d
				.addOption('table', 'table')
				.addOption('bullet list', 'bullet list')
				.onChange(async (value) => {
					this.plugin.settings.recordType = value;
					await this.plugin.saveSettings();
					await this.updateSyntax(); // warning: must to be put after saving
				})
			);

		this.makeMultilineTextSetting(
			new Setting(containerEl)
				.setName('Wordflow recording syntax')
				.setDesc('Modified the syntax with \'${}\' syntax, see doc for supported regular expressions.\n')
				.addTextArea(text => {
					this.SyntaxComponent = text;
					if (this.plugin.settings.recordType == 'table'){
						text.setValue(this.plugin.settings.tableSyntax);
						text.onChange(async (value) => {
							this.plugin.settings.tableSyntax = value;
							await this.plugin.saveSettings();
						})
					}
					if (this.plugin.settings.recordType == 'bullet list'){
						text.setValue(this.plugin.settings.bulletListSyntax);
						text.onChange(async (value) => {
							this.plugin.settings.bulletListSyntax = value;
							await this.plugin.saveSettings();
						})
					}				
				})
		);	
		
		new Setting(containerEl)
			.setName('Sort by')
			.setDesc('Select a type of variables to add recording items in a sequence.')
			.addDropdown(d => d
				.addOption('lastModifiedTime', 'lastModifiedTime')
				.addOption('editedWords', 'editedWords')
				.addOption('editedTimes', 'editedTimes')
				.addOption('editedPercentage', 'editedPercentage')
				.addOption('modifiedNote', 'modifiedNote')
				.onChange(async (value) => {
					this.plugin.settings.sortBy = value;
					await this.plugin.saveSettings();
					await this.updateSyntax(); // warning: must to be put after saving
				})
			)
			.addDropdown(d => d
				.addOption('true', 'Descend')
				.addOption('false', 'Ascend')
				.onChange(async (value) => {
					this.plugin.settings.isDescend = (value === 'true')?true:false;
					await this.plugin.saveSettings();
					await this.updateSyntax(); // warning: must to be put after saving
				})
			);

		new Setting(containerEl)
			.setName('Last modified time format')
			.setDesc('Set the format of \'${lastModifiedTime}\' to record on notes.')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD | hh:mm')
				.setValue(this.plugin.settings.timeFormat)
				.onChange(async (value) => {
					this.plugin.settings.timeFormat = value;
					await this.plugin.saveSettings();
				})
			);
		
		new Setting(containerEl)
			.setName('Automatic recording interval')
			.setDesc('Set the interval in seconds, influencing when the plugin should save all tracked records and implement them on periodic notes.')
			.addText(text => text
				.setValue(this.plugin.settings.autoRecordInterval)
				.onChange(async (value) => {
					this.plugin.settings.autoRecordInterval = value;
					await this.plugin.saveSettings();
				})
			);
	}

	private SyntaxComponent?: TextAreaComponent;

	private async updateSyntax() {
		if (!this.SyntaxComponent) return;
		switch (this.plugin.settings.recordType){
			case 'table': this.SyntaxComponent.setValue(this.plugin.settings.tableSyntax); break;
			case 'bullet list': this.SyntaxComponent.setValue(this.plugin.settings.bulletListSyntax); break;
		}
	};

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
}
