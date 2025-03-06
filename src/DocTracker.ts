import { debounce, Editor, EventRef, MarkdownView, Plugin, TFile,View, ViewState } from "obsidian";
import WordflowTrackerPlugin from "./main";
import { wordsCounter } from "./stats";
import { historyField } from "@codemirror/commands";

const DEBUG = true as const;

export class DocTracker{
    public lastDone: number = 0;
    public lastUndone: number = 0;
    public changedTimes: number = 0;
    public changedWords: number = 0;
    public isActive: boolean = false;
    public lastModifiedTime: number; // unix timestamp
    public docLength: number = 0;
    
    private debouncedTracker: ReturnType<typeof debounce>;
    private editorListener: EventRef | null = null;

    constructor(
        public filePath: string,      
        private activeEditor: MarkdownView | null,    
        private plugin: WordflowTrackerPlugin,
    ) {
        this.initialize();
    }

    private async initialize() {

        await this.activate();

//        if (DEBUG) console.log(`DocTracker.initialize: created for ${this.filePath}`);
    }

    private trackChanges() {
        //if (DEBUG) console.log("DocTracker.trackChanges: tracking history changes of ", this.activeEditor?.file?.path);

        // direct way to prove means cm destoyed, without having to find activeEditor.cm.destroyed: true.
        /*if (!this.activeEditor?.file) { 
            //@ts1-expect-error
            const closedFileName:string = this.activeEditor?.inlineTitleEl.textContent;
            this.plugin.trackerMap.delete(closedFileName);
            if (DEBUG) console.log("DocTracker.trackChanges: closed ", closedFileName);
            return;
        }*/
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
        const history = this.activeEditor?.editor.cm.state.field(historyField, false); // done on 1.0.1 | abandon false positive errors prompting
        
        const currentDone = history.done.length;
        const currentUndone = history.undone.length;
        
        // 计算变化差异（原核心逻辑）
        const doneDiff: number = currentDone - this.lastDone;
        const undoneDiff: number = currentUndone - this.lastUndone; // warn: may be reset to 0 when undo and do sth. 
        const historyCleared: number = ((currentDone + undoneDiff) < this.lastDone)?(this.lastDone - 100 - undoneDiff):0; // cannot use <= lastDone	because of a debounce bug	
        const wordsCt = wordsCounter();
/*
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
*/

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
/*                    if (DEBUG){
                        console.log(`Do adding texts: "${theOther}" from ${fromA} to ${toA} in current document, \ndo deleting texts: "${inserted}" from ${fromB} to ${toB} in current document.`);
                        console.log("Modified Words: ", mWords);
                    }
*/
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
/*                if (DEBUG) {
                    console.log(`Undo adding texts: "${inserted}" from ${fromB} to ${toB} from previous document, \nundo deleting texts: "${theOther}" from ${fromA} to ${toA} from previous document.`);
                    console.log("Modified Words: ", mWords);	
                }
*/                    
                this.changedWords += mWords;	
            });

            this.changedTimes += undoneDiff; // multiple changes should be counted only one time.
        }

        
        
        this.lastDone = currentDone;
        this.lastUndone = currentUndone;
        this.lastModifiedTime = history.prevTime;
        this.updateStatusBarTracker();
        
/*        console.log(`DocTracker.trackChanges: [${this.filePath}]:`, {
            currentChangedTimes: this.changedTimes,
            currentChangedWords: this.changedWords,
            lastModifiedTime: this.lastModifiedTime,
        });
*/        
    }

    private updateStatusBarTracker(){
        this.plugin.statusBarContent = `${this.changedTimes}` + ' edits: ' + `${this.changedWords}` + ' words';
        //if(DEBUG) this.plugin.statusBarContent += ` ${this.filePath}`;
        this.plugin.statusBarTrackerEl.setText(this.plugin.statusBarContent);
    }


    public async activate(){
        if(!this.plugin.app.workspace.getActiveViewOfType(MarkdownView)) {
            if(DEBUG) console.log("DocTracker.activate: No active editor!");
            return;
        }
        if(this.isActive) return; // ensure currently not active

        this.activeEditor = this.plugin.app.workspace.getActiveViewOfType(MarkdownView); 
//        if (DEBUG) console.log("DocTracker.activate: editor:", this.activeEditor)
        await sleep(10); // Warning: cm will be delayed for 3-5 ms to be bound to the updated editor.
        // @ts-expect-error
        const history = this.activeEditor?.editor.cm.state.field(historyField); // reference will be destroyed after initialization

        this.lastDone = (history.done.length>1)? history.done.length: 1;
        this.lastUndone = history.undone.length;
        //@ts-expect-error
        this.docLength = this.activeEditor?.editor.cm.state.doc.length;

        // 创建独立防抖实例
        this.debouncedTracker = debounce(this.trackChanges.bind(this), 1000, true); // Modified from official value 500 ms to 1000 ms, for execution delay. 
        
        // 绑定编辑器事件
        this.editorListener = this.plugin.app.workspace.on('editor-change', (editor: Editor, view: MarkdownView) => {
            this.debouncedTracker();
        });
        this.updateStatusBarTracker();
        this.isActive = true;
    }

    public release(){       
        this.debouncedTracker.run();  
//        if (DEBUG) console.log(`Tracker released for: ${this.filePath}`);    
    }; 

    public deactivate(){
        if (this.editorListener) {
            this.plugin.app.workspace.offref(this.editorListener);
        }
        if (this.isActive) {
            this.release();
            this.isActive = false; // ensure that this will only run once
//            if (DEBUG) console.log("DocTracker.deactivate: Set ", this.filePath," inactive!"); // debug
        }       
    }

    public resetEdit(){
        this.changedTimes = 0;
        this.changedWords = 0;
    }

    // Warning: Do not use! This will destroy even the editor of Obsidian! Let Obsidian decide when to destroy!
    public destroy(){
        this.deactivate();        
        this.activeEditor = null;
        this.plugin.trackerMap.delete(this.filePath); 
        // prevent more than one calls
        this.destroy = () => {
            throw new Error('DocTracker instance already destroyed');
        };
    }
}

