import { debounce, Editor, EventRef, MarkdownView, Plugin, TFile } from "obsidian";
import AdvancedSnapshotsPlugin from "./main";
import { wordsCounter } from "./stats";
import { historyField } from "@codemirror/commands";

const DEBUG = true as const;

export class DocTracker{
    public lastDone: number = 0;
    public lastUndone: number = 0;
    public changedTimes: number = 0;
    public changedWords: number = 0;
    public isActive: boolean = false;
    
    
    private debouncedTracker: ReturnType<typeof debounce>;
    private editorListener: EventRef | null = null;

    constructor(
        public fileName: string,      
        private activeEditor: MarkdownView,    
        private plugin: AdvancedSnapshotsPlugin,
    ) {
        this.initialize();
    }

    private initialize() {

        if(!this.activeEditor) {
            if(DEBUG) console.log("DocTracker.initialize: No active editor!");
            return;
        }


        this.plugin.trackerMap.set(this.fileName, this);

        if(DEBUG) console.log("DocTracker.initialize: tracking file:", this.activeEditor.file?.basename);

        // @ts-expect-error
        const history = this.activeEditor.editor.cm.state.field(historyField); // reference will be destroyed after initialization

        
        this.lastDone = (history.done.length>1)? history.done.length: 1;
        this.lastUndone = history.undone.length;

        // 创建独立防抖实例
        this.debouncedTracker = debounce(this.trackChanges.bind(this), 1000, true); // Modified from official value 500 ms to 1000 ms, for execution delay. 
        
        // 绑定编辑器事件
        this.editorListener = this.plugin.app.workspace.on('editor-change', (editor: Editor, view: MarkdownView) => {
            this.debouncedTracker();
        });

        if (DEBUG) console.log(`DocTracker.initialize: created for ${this.fileName}`);
    }

    private trackChanges() {
        if (DEBUG) console.log("DocTracker.trackChanges: tracking history changes of ", this.activeEditor?.file?.basename);

        if (!this.activeEditor?.file) {
            //@ts-expect-error
            const closedFileName:string = this.activeEditor?.inlineTitleEl.textContent;
            this.plugin.trackerMap.delete(closedFileName);
            if (DEBUG) console.log("DocTracker.trackChanges: closed ", closedFileName);
            return;
        }
        /* Given up Protection */
        // the following may be necessary because of the release function
        /*
        if (this.activeEditor.file?.basename != this.fileName) {
            this.plugin.trackerMap.set(this.activeEditor.file?.basename, new Map(this, false));
            console.log("Set inactive by historyTracker:", this.activeEditor.file?.basename); //debug
            return;
        } // protection
        */

        // @ts-expect-error
        const history = this.activeEditor.editor.cm.state.field(historyField);
        
        const currentDone = history.done.length;
        const currentUndone = history.undone.length;
        
        // 计算变化差异（原核心逻辑）
        const doneDiff: number = currentDone - this.lastDone;
        const undoneDiff: number = currentUndone - this.lastUndone; // warn: may be reset to 0 when undo and do sth. 
        const historyCleared: number = ((currentDone + undoneDiff) < this.lastDone)?(this.lastDone - 100 - undoneDiff):0; // cannot use <= lastDone	because of a debounce bug	
        const wordsCt = wordsCounter();

        if(DEBUG){
            //@ts-expect-error
            let doc = this.activeEditor.editor.cm.state.sliceDoc(0); // return string
            // @ts-expect-error
		    let docLength = this.activeEditor.editor.cm.state.doc.length;
            console.log("DocTracker.trackChanges: 捕获操作:", {				
                done: currentDone,
                undone: currentUndone,
                lastDone: this.lastDone,
                lastUndone: this.lastUndone,
                doneDiff: doneDiff,
                undoneDiff: undoneDiff,
                docLength: docLength,
                doc: doc,
                lastChangedTime: this.changedTimes,
                lastChangedWords: this.changedWords,
            });
            console.log("DocTracker.trackChanges: CurrentHistory:", history);	

            if (historyCleared){ 
				console.log("DocTracker.trackChanges: Detected ", historyCleared, " cleared history events!");
			}       
        }


        // done | need to exclude the case where initial history done state has blank value but length is 1
        // done | need to ensure that toA will not change before printing, as a long changes may be joining into one done event. This requires to check if no inputting and if yes pause 0.5 second.
        // only done events need to consider separated inputs that may not be caught by the debouncer function
        if ((doneDiff + historyCleared > 0) && currentDone > 1 ){
            for ( let i=(doneDiff+historyCleared); i>0; i--){ 
                history.done[currentDone-i].changes.iterChanges((fromA:Number, toA:Number, fromB:Number, toB:Number, inserted: string | Text ) => { // inserted is Text in cm, string|Text in Obsidian
                    //@ts-expect-error
                    const theOther = this.activeEditor.editor.cm.state.sliceDoc(fromA,toA); 
                    inserted = inserted.toString();
                    const mWords = wordsCt(theOther) + wordsCt(inserted);
                    if (DEBUG){
                        console.log(`Do adding texts: "${theOther}" from ${fromA} to ${toA} in current document, \ndo deleting texts: "${inserted}" from ${fromB} to ${toB} in current document.`);
                        console.log("Modified Words: ", mWords);
                    }
                    this.changedWords += mWords;	
                    
                });
            }

            this.changedTimes += (doneDiff + historyCleared); // multiple changes should be counted only one time.
        }	

        // done | when fixed doneDiff is detected minus, and done events is added to undone.
        if ((doneDiff + historyCleared < 0)&&((undoneDiff + doneDiff + historyCleared) == 0 )){
            history.undone[currentUndone-1].changes.iterChanges((fromA:Number, toA:Number, fromB:Number, toB:Number, inserted: string | Text ) => { // inserted is Text in cm, string|Text in Obsidian               
                // @ts-expect-error
                const theOther = this.activeEditor.editor.cm.state.sliceDoc(fromA,toA);
                inserted = inserted.toString();
                const mWords = wordsCt(inserted)+wordsCt(theOther);
                if (DEBUG) {
                    console.log(`Undo adding texts: "${inserted}" from ${fromB} to ${toB} from previous document, \nundo deleting texts: "${theOther}" from ${fromA} to ${toA} from previous document.`);
                    console.log("Modified Words: ", mWords);	
                }
                this.changedWords += mWords;	
            });

            this.changedTimes += undoneDiff; // multiple changes should be counted only one time.
        }

        
        
        this.lastDone = currentDone;
        this.lastUndone = currentUndone;
        
        console.log(`DocTracker.trackChanges: [${this.fileName}]:`, {
            currentChangedTimes: this.changedTimes,
            currentChangedWords: this.changedWords
        });
    }


    public release(){       
        if (this.editorListener) {
            this.plugin.app.workspace.offref(this.editorListener);
        }
        if (this.isActive) {
            this.debouncedTracker.run();  
            if (DEBUG) console.log(`Tracker released for: ${this.fileName}`);    
        }
        this.isActive = false; // ensure that this will only run once
    }; 




}

