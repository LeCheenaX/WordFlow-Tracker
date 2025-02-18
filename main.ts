// add EditorTransaction
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
//import { EditorState, StateField, Extension, ChangeSet, Transaction } from "@codemirror/state";
import { historyField, history } from "@codemirror/commands";
//import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";


// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}


export default class AdvancedSnapshotsPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		

		//Test
		this.registerEvent(this.app.workspace.on('layout-change', () => {
            if (this.app.workspace.getActiveViewOfType(MarkdownView)?.getMode() == "source")
			{
				new Notice(`Now Edit Mode!`); // should call content in if (activeEditor)
			}
        }));
		
		if (this.app.workspace.getActiveViewOfType(MarkdownView)?.getMode() == "source")
			{
				new Notice(`Now Edit Mode!`);
			}
		

		// ✅ 官方推荐的事件监听方式
		const activeEditor = this.app.workspace.getActiveViewOfType(MarkdownView)
		if (activeEditor){ // need to improve when plugin starts, the cursor must at active document
			// @ts-expect-error直接访问 Obsidian 维护的历史状态
			let history = activeEditor.editor.cm.state.field(historyField); // 关键！访问 Obsidian 内部历史对象
			// @ts-expect-error
			let doc = activeEditor.editor.cm.state.sliceDoc(0); // 不要 as string | Text
			// @ts-expect-error
			let docLength = activeEditor.editor.cm.state.doc.length;
			console.log("his:", history);
			let lastDone = history.done.length;
			let lastUndone = history.undone.length;
			

			this.registerEvent(this.app.workspace.on("editor-change", (editor: Editor, view: MarkdownView) => {
				// @ts-expect-error直接访问 Obsidian 维护的历史状态
				history = activeEditor.editor.cm.state.field(historyField);
				// @ts-expect-error
				doc = activeEditor.editor.cm.state.sliceDoc(0);
				// @ts-expect-error
				docLength = activeEditor.editor.cm.state.doc.length;

				let currentDone = history.done.length;
				let currentUndone = history.undone.length;

				if ( (currentDone!= lastDone) || (currentUndone!= lastUndone)){
					console.log("捕获操作:", {				
						done: history.done.length,
						undone: history.undone.length,
						doneDiff: currentDone - lastDone,
						docLength: docLength,
						doc: doc
					});

					if (currentDone - lastDone > 0){// need to ensure that toA will not change before printing, as a long changes may be joining into one done event. This requires to check if no inputting and if yes pause 0.5 second.
						history.done[currentDone-1].changes.iterChanges((fromA:Number, toA:Number, fromB:Number, toB:Number, inserted: string | Text) => {
							//@ts-expect-error
							const theOther = activeEditor.editor.cm.state.sliceDoc(fromA,toA); // bug: does not show space or line-break
							console.log(`Do adding texts: "${theOther}" from ${fromA} to ${toA} in current document, \ndo deleting texts: "${inserted}" from ${fromB} to ${toB} in current document.`);
						});
					}	

					if (currentDone - lastDone < 0){
						history.undone[currentUndone-1].changes.iterChanges((fromA:Number, toA:Number, fromB:Number, toB:Number, inserted: string | Text) => {
							// @ts-expect-error
							const theOther = activeEditor.editor.cm.state.sliceDoc(fromA,toA);
							console.log(`Undo adding texts: "${inserted}" from ${fromB} to ${toB} from previous document, \nundo deleting texts: "${theOther}" from ${fromA} to ${toA} from previous document.`);						
						});
					}

					lastDone = currentDone;
					lastUndone = currentUndone;
				}
			}));
		}
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

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
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
