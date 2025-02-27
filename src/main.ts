// add EditorTransaction
import { App, debounce, Editor, EventRef, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
//import { EditorState, StateField, Extension, ChangeSet, Transaction } from "@codemirror/state";
import { historyField, history } from "@codemirror/commands";
//import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { wordsCounter } from "./stats";
import { DocTracker } from './DocTracker';

// Remember to rename these classes and interfaces!
const DEBUG = true as const;

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}


export default class AdvancedSnapshotsPlugin extends Plugin {
	settings: MyPluginSettings;
	private activeTrackers: Map<string, boolean> = new Map(); // for multiple notes editing	
    private pathToNameMap: Map<string|undefined, string> = new Map(); // 新增：反向映射用于重命名检测
	public trackerMap: Map<string, DocTracker> = new Map<string, DocTracker>(); // give up nested map

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Advanced Snapshots', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('Try opening snapshots!');
			new SampleModal(this.app).open(); // open a SampleModal
			/* Test starts */
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeView || activeView.getMode() !== "source") {
			new Notice('⚠️ 没有找到活动的Markdown编辑器'); 
			//new Notice(`当前模式：${Helloview.getMode()}`);
			return;
			}

			try {
				// @ts-expect-error: 获取CodeMirror State 并跳过Obsidian类型检查
				let cmState: EditorCMState = activeView.editor.cm.state;
				

				if (!cmState) {
					new Notice('❌ 无法获取CodeMirror状态');
					return;
					}
				
				//let doc0 = cmState.sliceDoc(0); // 提取当前编辑器文本
				//console.log("初始:", doc0);


				let historyF = cmState.field(historyField);
				console.log("history:",{
					doc: cmState.doc,
					historyField: cmState.field(historyField)
				});

				let lastIndex = historyF.done.length - 1;
				console.log(`当前历史记录总数: ${historyF.done.length}，最后索引: ${lastIndex}`);

				if (historyF.done > 1){ // exclude the initial state where history field has one blank done object, but has length 1
					console.log("可撤销历史事件1:", historyF.done[1]);				
					console.log("可撤销历史事件1:", historyF.done[1].changes); // 返回changeSet对象
					historyF.done[lastIndex].changes.iterChanges((fromA:Number, toA:Number, fromB:Number, toB:Number, inserted: string | Text) => {
						console.log(`Change from ${fromA} to ${toA} in original document, from ${fromB} to ${toB} in new document, inserted: ${inserted}`);
						// For Mobile Test
						new Notice(`History change line: ${fromA} ~  ${toA}`);
					});

					if (historyF.done[1].changes) // For Mobile Test
					{
						new Notice("History Change OK");					
					}
				}
	
				
			}
			catch (error) {
				console.error("发生错误:", error);
			}
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
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

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		/* Registered Events */	
		// Update tracking files after rename events
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            if (file instanceof TFile) {
                const oldName = this.pathToNameMap.get(oldPath);
                if (oldName && this.activeTrackers.has(oldName)) {
                    // 迁移追踪记录到新文件名
                    this.activeTrackers.set(file.basename, true);
                    this.activeTrackers.delete(oldName);
					this.trackerMap.delete(oldName);
                    
                    // 更新路径映射
                    this.pathToNameMap.delete(oldPath);
                    this.pathToNameMap.set(file.path, file.basename);
                }
            }
        }));

		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
            if (this.app.workspace.getActiveViewOfType(MarkdownView)?.getMode() == "source")
			{
				// done | need to improve when plugin starts, the cursor must at active document
				
				if (DEBUG) new Notice(`Now Edit Mode!`); 

				let activeEditor = this.app.workspace.getActiveViewOfType(MarkdownView);
				
				/*debug rename issue*/
				//console.log(activeEditor); 
				//console.log(activeEditor?.file?.basename); // get file name
				// rename parsing...
				//...

				if (DEBUG) console.log("Editing file:", activeEditor?.file?.basename) // debug
				// 清理所有非当前文件的激活状态
				this.activeTrackers.forEach((isActive, fileName) => {
					if (fileName !== activeEditor?.file?.basename) {
						this.activeTrackers.set(fileName, false);
					}
				});
				// previous historyTracker may still be debounced
				// need to manually use historyTracker.run()

				this.trackerMap.forEach((tracker, fileName) => {
					if (fileName !== activeEditor?.file?.basename){
						tracker.release();
					}
				});

				this.safeActivateTracker(activeEditor); // done | this will trigger printing multiple times in the same note when editor-changed.
			}
			else{ // deregister all inactive files
				this.activeTrackers.forEach((isActive, fileName) => {
					this.activeTrackers.set(fileName, false);
					if (DEBUG) console.log("Set non-editing files inactive!")// debug
				});

				this.trackerMap.forEach((tracker, fileName)=>{
					tracker.release();
				});
			}


        }));

		this.registerEvent(this.app.workspace.on('layout-change', () => {

            if (this.app.workspace.getActiveViewOfType(MarkdownView)?.getMode() == "source")
			{
				if (DEBUG) new Notice(`Now Edit Mode!`); // should call content in if (activeEditor)
				// done | need to improve when plugin starts, the cursor must at active document
				let activeEditor = this.app.workspace.getActiveViewOfType(MarkdownView);

				if (DEBUG) console.log("Editing file:",this.app.workspace.activeEditor?.file?.basename) // debug

				// 清理所有非当前文件的激活状态
				this.activeTrackers.forEach((isActive, fileName) => {
					if (fileName !== activeEditor?.file?.basename) {
						this.activeTrackers.set(fileName, false);
					}
				});
				
				this.trackerMap.forEach((tracker, fileName) => {
					if (fileName !== activeEditor?.file?.basename){
						tracker.release();
					}
				});

				this.safeActivateTracker(activeEditor); // bug: this will trigger printing multiple times in the same note when editor-changed.
			}
        }));

		if (this.app.workspace.getActiveViewOfType(MarkdownView)?.getMode() == "source")
			{
				if (DEBUG) new Notice(`Now Edit Mode!`); // should call content in if (activeEditor)
				// done | need to improve when plugin starts, the cursor must at active document
				let activeEditor = this.app.workspace.getActiveViewOfType(MarkdownView);

				if (DEBUG) console.log("Editing file:",this.app.workspace.activeEditor?.file?.basename) // debug

				// 清理所有非当前文件的激活状态
				this.activeTrackers.forEach((isActive, fileName) => {
					if (fileName !== activeEditor?.file?.basename) {
						this.activeTrackers.set(fileName, false);
					}
				});

				this.trackerMap.forEach((tracker, fileName) => {
					if (fileName !== activeEditor?.file?.basename){
						tracker.release();
					}
				});
				
				this.safeActivateTracker(activeEditor); // bug: this will trigger printing multiple times in the same note when editor-changed.
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
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	// add private functions since here

	// 新增的保护性激活方法
	private safeActivateTracker(activeEditor: MarkdownView | null) {
		let activeFileName = activeEditor?.file?.basename;
		if (!activeFileName || activeEditor?.getMode() !== "source") return;

		// rename后更新路径映射
        this.pathToNameMap.set(activeEditor?.file?.path, activeFileName);

		console.log("Calling:", activeFileName, " activeState:", this.activeTrackers.get(activeFileName))// debug
		// normal process
		if (!this.activeTrackers.has(activeFileName) || this.activeTrackers.get(activeFileName) == false) {
			// track active File
			const newTracker = new DocTracker(activeFileName, activeEditor, this);
			this.activeTrackers.set(activeFileName, true);
			// debug
			console.log("Called:", activeFileName, " activeState:", this.activeTrackers.get(activeFileName))// debug
			//console.log("Tracking file:", activeFileName);			
		}
		


	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

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

class SampleSettingTab extends PluginSettingTab {
	plugin: AdvancedSnapshotsPlugin;

	constructor(app: App, plugin: AdvancedSnapshotsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
