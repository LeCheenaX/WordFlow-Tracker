import { DocTracker } from './DocTracker';
import { DataRecorder } from './DataRecorder';
import { DEFAULT_SETTINGS, GeneralTab, RecordersTab, TimersTab, StatusBarTab, WordflowSettings, WordflowSubSettingsTab } from './settings';
import { App, MarkdownView, Notice, Plugin, PluginSettingTab, TFile } from 'obsidian';
//import { EditorState, StateField, Extension, ChangeSet, Transaction } from "@codemirror/state";
//import { historyField, history } from "@codemirror/commands";
//import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";

// Remember to rename these classes and interfaces!
const DEBUG = true as const;

export default class WordflowTrackerPlugin extends Plugin {
	public settings: WordflowSettings;
	public trackerMap: Map<string, DocTracker> = new Map<string, DocTracker>(); // give up nested map
	public statusBarTrackerEl: HTMLElement; // for status bar tracking
	public statusBarContent: string; // for status bar content editing
	public DocRecorders: DataRecorder[] = [];

	private activeTrackers: Map<string, boolean> = new Map(); // for multiple notes editing	
    private pathToNameMap: Map<string|undefined, string> = new Map(); // 新增：反向映射用于重命名检测
	private isModeSwitch: boolean = false;
	private lastActiveFile: { path: string|undefined; mode: 'source' | 'preview' | undefined} = {path: undefined, mode: undefined};

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
			if (this.lastActiveFile.path == this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path &&
				this.lastActiveFile.mode !== this.app.workspace.getActiveViewOfType(MarkdownView)?.getMode()){
				this.isModeSwitch = true;
				debouncedHandler();
			} else {
				debouncedHandler();
			}
//console.log('last active: ', this.lastActiveFile);
//console.log('isModeSwitch: ', this.isModeSwitch)
        }));

		if (this.app.workspace.getActiveViewOfType(MarkdownView)?.getMode() == "source")
			{
				this.lastActiveFile.path = this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path;
				this.lastActiveFile.mode = 'source';
				debouncedHandler();
			}


		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
//console.log('click', evt);
			//test to switch between editor
			if(this.app.workspace.activeEditor?.file)
			{
//console.log(this.app.workspace.activeEditor.file?.path)
				const docTracker = this.trackerMap.get(this.app.workspace.activeEditor.file?.path)
				if (docTracker && docTracker.isActive && docTracker.editTimer?.debouncedStarter) 
					docTracker.editTimer?.debouncedStarter();
			}
		});
		

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		if (this.settings.autoRecordInterval && Number(this.settings.autoRecordInterval) != 0){
			this.registerInterval(window.setInterval(() => {
				for (const DocRecorder of this.DocRecorders) {
                    DocRecorder.record();
                }
				new Notice(`Auto try recording wordflows to periodic note!`, 3000);
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
			if (DEBUG) console.log("Editing file:",this.app.workspace.activeEditor?.file?.basename) // debug

			this.activateTracker(activeEditor); // activate without delay

			await sleep(100); // set delay for getting the correct opened files for deactivating and deleting Map
			this.lastActiveFile.path = activeEditor?.file?.path;
			this.lastActiveFile.mode = activeEditor?.getMode();
			const potentialEditors = await this.getAllOpenedFilesWithMode();
			//console.log(potentialEditors) // debug
			this.trackerMap.forEach(async (tracker, filePath) => {
				if(!potentialEditors.has(filePath)) {
					tracker.deactivate();
					await this.recordTracker(tracker);
					tracker.destroyTimers();
					this.trackerMap.delete(filePath);
					//console.log("Closed file:", filePath, " is recorded.")
				}
				else{
					if (filePath !== activeEditor?.file?.path) tracker.deactivate();
				}
			});
			this.isModeSwitch = false;
		} 
		else{
			// after leaf-change or mode-switch, current active leaf is not in 'source' mode
			await sleep(100); // set delay for getting the correct opened files for deactivating and deleting Map
			this.lastActiveFile.path = this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path;
			this.lastActiveFile.mode = this.app.workspace.getActiveViewOfType(MarkdownView)?.getMode();
			const potentialEditors = await this.getAllOpenedFilesWithMode();
			//console.log(potentialEditors) // debug
			this.trackerMap.forEach(async (tracker, filePath)=>{
				tracker.deactivate();
				if (!potentialEditors.has(filePath)) {
					await this.recordTracker(tracker);
					tracker.destroyTimers();
					this.trackerMap.delete(filePath);
					//console.log("Closed file:", filePath, " is recorded.")
				}
				//else if (this.isModeSwitch && potentialEditors.get(filePath) == 'preview'){// now preview mode}
				else if (this.isModeSwitch && filePath == this.lastActiveFile.path){ 
					//console.log ('Try recording', filePath, ' current mode: ', potentialEditors.get(filePath));
					await this.recordTracker(tracker);
				}
				else if (this.isModeSwitch && this.settings.noteToRecord == 'all' && potentialEditors.get(filePath) == 'source'){ 
					//console.log ('This note is under edit mode after switching mode: ', filePath);	
					await this.recordTracker(tracker);		
				} 
				// else console.log('Layout changed but no mode switched');*/
			});
			this.isModeSwitch = false;
			this.statusBarTrackerEl.setText(''); // clear status bar
//if (DEBUG) console.log(`activeDocHandler: status bar cleared`);
		}
	};
	private async recordTracker(tracker: DocTracker): Promise<void> {
		let count = 0;
		for (const DocRecorder of this.DocRecorders) {
			switch(this.settings.noteThreshold)
			{
			case 't':
				if (tracker.editTime >= 60000) {
					DocRecorder.record(tracker);
					++count;
				}
				break;
			case 'ent':
				if (tracker.editedTimes > 0 && tracker.editTime >= 60000) {
					DocRecorder.record(tracker);
					++count;
				}
				break;
			case 'eot':
				if (tracker.editedTimes > 0 || tracker.editTime >= 60000) {
					DocRecorder.record(tracker);
					++count;
				}
				break;
			case 'n':
				DocRecorder.record(tracker);
				++count;
				break;
			default: // default is require edits only
				if (tracker.editedTimes > 0) {
					DocRecorder.record(tracker);
					++count;
				}
				break;
			}
		}
		if (count){
			new Notice(`Edits from ${tracker.filePath} are recorded.`, 1000)
			//if (DEBUG) console.log (`Edits from ${tracker.filePath} are recorded.`);	
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
//if (DEBUG) console.log("Main.activateTracker: trackerMap",this.trackerMap);
//if (DEBUG) console.log('Main.activateTracker: file not found in trackerMap');
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
	private async getAllOpenedFilesWithMode(): Promise<Map<string, 'source' | 'preview' | unknown>> {
		const fileMap = new Map<string, 'source' | 'preview' | unknown>();
		
		const addFileWithMode = (filePath: string, mode: 'source' | 'preview' | unknown) => {
			//if (fileMap.get(filePath) == 'source') return; // does not allow source overwrite preview mode, because item.state.state.mode may only return source and never return preview
			fileMap.set(filePath, mode);
			//console.log(filePath, ' changed to ', mode);
		};
		
		const processLeafHistory = (historyItems: any) => {
			if (!historyItems?.length) return;
			
			for (const item of historyItems) {
				try {
					if (!item?.state?.state?.mode) continue;
					if (item.state.state.mode !== 'source' && item.state.state.mode !== 'preview') continue;
					
					addFileWithMode(
						item.state.state.file,
						item.state.state.mode
					); 
				} catch (e) {
					console.warn("Error processing history item", e);
				}
			}
		};
		
		try {
			//if (DEBUG) console.log("MD Leaves:", MDLeaves);
			const MDLeaves = this.app.workspace.getLeavesOfType('markdown');
			if (MDLeaves.length === 0) return fileMap;
			
			for (const leaf of MDLeaves) {
				//console.log(leaf);
				//if (leaf.view?.getMode() == 'source'){ // Warning: file must have been opened to have function 'getMode()', this influences only start up loading files in saved workspace 
				// Use getState() instead of getMode() and getFile()
				if (leaf.view?.getState()?.mode) {
					addFileWithMode(
						(leaf.view.getState() as any)?.file,
						leaf.view.getState().mode
					); // get file path of TFile, or get file path directly, and then add to array | which to get depends on if the files have been opened or not.
				}
				
				// 处理历史记录（避免滥用 @ts-expect-error）
				if ('history' in leaf) {
					const history = (leaf as any).history;
					processLeafHistory(history?.backHistory);
					processLeafHistory(history?.forwardHistory);
				}
			}

			// override the mode with the current active leaf, when multiple leaves of the same file exist
			const currentActiveLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (currentActiveLeaf) {
				addFileWithMode(
					(currentActiveLeaf?.getState() as any)?.file, 
					currentActiveLeaf?.getState()?.mode
				);
			}
		} catch (e) {
			console.error("Error in getAllOpenedFilesWithMode", e);
		}
		
		return fileMap;
	}

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
			this.recordTracker(tracker);
			tracker.deactivate();
			tracker.destroyTimers();
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


export class WordflowSettingTab extends PluginSettingTab {
	private tabs: Record<string, WordflowSubSettingsTab> = {};
	private tabElements: Record<string, HTMLElement> = {};
	private contentContainer: HTMLElement;

	constructor(app: App, private plugin: WordflowTrackerPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('wordflow-setting-tab');

		const tabContainer = containerEl.createDiv('wordflow-tab-bar tab-labels-container');
		this.contentContainer = containerEl.createDiv('wordflow-tab-content');

		// intialization setting tabs
		this.tabs = {
			'General': new GeneralTab(this.app, this.plugin, this.contentContainer),
			'Recorders': new RecordersTab(this.app, this.plugin, this.contentContainer),
			'Timers': new TimersTab(this.app, this.plugin, this.contentContainer),
			//'Status Bar': new StatusBarTab(this.app, this.plugin, this.contentContainer)
		};

		// tab buttons
		const tabNames = Object.keys(this.tabs);
		tabNames.forEach((tabName, index) => {
			const tab = tabContainer.createDiv('tab-label wordflow-tab');
			tab.textContent = tabName;
			tab.dataset.tab = tabName;
			this.tabElements[tabName] = tab;
			
			// add separation between tabs
			if (index < tabNames.length - 1) {
				const separator = tabContainer.createDiv('wordflow-setting-tab-separator');
				separator.textContent = '|';
			}
			
			tab.addEventListener('click', (evt: MouseEvent) => {
				this.switchTab(tabName);
			});
		});

		this.switchTab(tabNames[0]);
	}

	private switchTab(tabName: string) {
		// deactivate all
		Object.values(this.tabElements).forEach(t => t.removeClass('active'));
		
		this.tabElements[tabName].addClass('active');
		
		this.contentContainer.empty();
		this.tabs[tabName].display();
	}
}