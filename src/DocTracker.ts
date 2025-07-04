import { wordsCounter } from "./stats";
import Timer,  { formatTime } from "./Timer";
import WordflowTrackerPlugin from "./main";
import { debounce, Editor, EventRef, MarkdownView, MarkdownViewModeType, Notice } from "obsidian";
import { historyField } from "@codemirror/commands";

const DEBUG = true as const;

export class DocTracker{
    public lastDone: number = 0;
    public lastUndone: number = 0;
    public editedTimes: number = 0;
    public editedWords: number = 0;
    public addedWords: number = 0;
    public deletedWords: number = 0;
    public changedWords: number = 0;
    public isActive: boolean = false;
    public lastModifiedTime: number; // unix timestamp
    public docLength: number = 0;
    public docWords: number = 0;
    public originalWords: number = 0;
    public fileName: string = 'unknown';
    public editTime: number = 0;
    public readTime: number = 0;
    
    public editTimer: Timer | null = null;
    public readTimer: Timer | null = null;
    public prevViewMode: MarkdownViewModeType;
    private debouncedTracker: ReturnType<typeof debounce> | null;
    private editorListener: EventRef | null = null;
    private addWordsCt: Function
    private deleteWordsCt: Function

    constructor(
        public filePath: string,      
        private activeEditor: MarkdownView | null,    
        private plugin: WordflowTrackerPlugin,
    ) {
        this.initialize();
    }

    public updateStatusBarTracker(){
        if (this.prevViewMode == 'source') this.plugin.statusBarContent = `⌨️ ${formatTime(this.editTime)} · ${this.editedTimes} edits · ${this.editedWords} words`;
        else {
            this.plugin.statusBarContent = `📖 ${formatTime(this.readTime)}`;
        }

//if(DEBUG) this.plugin.statusBarContent += ` ${this.filePath}`;
        this.plugin.statusBarTrackerEl.setText(this.plugin.statusBarContent);
//if (DEBUG) console.log(`UpdateStatusBar: ${this.plugin.statusBarContent}`);
    }


    public async activate(activeFileViewMode: MarkdownViewModeType | undefined){
        if(!this.plugin.app.workspace.getActiveViewOfType(MarkdownView) || !activeFileViewMode) { // to-do: may delete the first check as it may be unnecessary
if(DEBUG) console.log("DocTracker.activate: No active editor!");
            return;
        }

        if(this.isActive && activeFileViewMode == this.prevViewMode) return; // do nothing
        else if(activeFileViewMode == 'source' ) { // cases: 1. from inactive to source, 2. from source to source, 3. from inactive to source when focused, 4. from inactive to preview when focused, 5. from source to preview when focused, 6. from preview to source when focused 7. from soure to source when focused 8. from preview to preview when focused,  
            this.deactivate();
            this.trackEditing();
        } else if(this.plugin.Widget?.onFocusMode && activeFileViewMode == 'preview') {
            this.deactivate();
            this.trackReading();
        }
        
        this.isActive = true;
        this.prevViewMode = activeFileViewMode;
        this.updateStatusBarTracker();
        this.plugin.Widget?.updateCurrentData();
    }

    public release(){       
        if (this.debouncedTracker)
            this.debouncedTracker.run(); 
if (DEBUG) console.log(`Tracker released for: ${this.filePath}`);    
        this.editTimer?.pause();
        this.readTimer?.pause();
    }; 

    public async countActiveWords(){ 
        const totalWordsCt = wordsCounter();
        //@ts-expect-error
        this.docWords = totalWordsCt(this.activeEditor?.editor.cm.state.sliceDoc(0));
    }

    public async countInactiveWords(){ 
        this.docWords = this.originalWords + this.changedWords;
    }

    public meetThreshold(): boolean {
        switch(this.plugin.settings.noteThreshold) {
            case 't':
                return this.editTime >= 60000;
            case 'ent':
                return this.editedTimes > 0 && this.editTime >= 60000;
            case 'eot':
                return this.editedTimes > 0 || this.editTime >= 60000;
            case 'n':
                return true;
            default: // default to requiring edits
                return this.editedTimes > 0;
        }
    }

    public deactivate(){
        if (this.editorListener) {
            this.plugin.app.workspace.offref(this.editorListener);
            this.editorListener = null;
        }
        if (this.isActive) {
            this.release();
            this.isActive = false; // ensure that this will only run once
if (DEBUG) console.log("DocTracker.deactivate: Set ", this.filePath," inactive!"); // debug
        }       
        this.debouncedTracker = null; // dereference the debouncer
    }

    public async resetEdit(){
//console.log('DocTracker.resetEdit: called')
        await sleep(500); // for multiple recorders to record before cleared.
        this.editedTimes = 0;
        this.editedWords = 0;
        this.addedWords = 0;
        this.deletedWords = 0;
        this.changedWords = 0;
        this.editTimer?.reset();
        this.readTimer?.reset();
        this.updateStatusBarTracker();
        this.plugin.Widget?.updateCurrentData();
    }

    public destroyTimers(){
        if (this.editTimer) this.editTimer.destroy();
        if (this.readTimer) this.readTimer.destroy();
        this.editTimer = null;
        this.readTimer = null;
    }

    // Warning: Do not use! This will destroy even the editor of Obsidian! Let Obsidian decide when to destroy!
/*
    public destroy(){
        this.deactivate();        
        this.activeEditor = null;
        this.plugin.trackerMap.delete(this.filePath); 
        // prevent more than one calls
        this.destroy = () => {
            throw new Error('DocTracker instance already destroyed');
        };
    }
*/

    private async countOrigin(){       
        const totalWordsCt = wordsCounter();
        await sleep(100); // set delay for the activeEditor to load
        //@ts-expect-error
        this.originalWords = totalWordsCt(this.activeEditor?.editor.cm.state.sliceDoc(0));
    }

    private async trackEditing(): Promise<void>{
        this.editTimer?.start();
        this.activeEditor = this.plugin.app.workspace.getActiveViewOfType(MarkdownView); 
        //if (DEBUG) console.log("DocTracker.activate: editor:", this.activeEditor)
console.log("DocTracker.trackEditing: ", this.filePath)
        await sleep(20); // Warning: cm will be delayed for 3-5 ms to be bound to the updated editor.
        // @ts-expect-error
        const history = this.activeEditor?.editor.cm.state.field(historyField); // reference will be destroyed after initialization

        this.lastDone = (history.done.length>1)? history.done.length: 1;
        this.lastUndone = history.undone.length;
        //@ts-expect-error
        this.docLength = this.activeEditor?.editor.cm.state.doc.length;

        // 创建独立防抖实例
        this.debouncedTracker = debounce(this.trackChanges.bind(this), 1000, true); // Modified from official value 500 ms to 1000 ms, for execution delay. Modified from 1000 to 800 to test. 
        
        // 绑定编辑器事件
        this.editorListener = this.plugin.app.workspace.on('editor-change', (editor: Editor, view: MarkdownView) => {
            if (this.debouncedTracker != null) 
                this.debouncedTracker();
//console.log('DocTracker.activate: listener registered')
            if (this.editTimer?.debouncedStarter != null) 
                this.editTimer?.debouncedStarter();
        });
    }

    private async trackReading(){
        this.readTimer?.start();
console.log("DocTracker.trackReading: ", this.filePath)
    }

    private async initialize() {
        this.lastModifiedTime = Number(this.plugin.app.vault.getFileByPath(this.filePath)?.stat.mtime);
        this.fileName = this.plugin.app.vault.getFileByPath(this.filePath)?.basename ?? 'unknown';
        this.addWordsCt = wordsCounter();
        this.deleteWordsCt = wordsCounter();  
        this.editTimer = new Timer(this.plugin, this, 'source');     
        this.readTimer = new Timer(this.plugin, this, 'preview');  
//        if (DEBUG) console.log(`DocTracker.initialize: created for ${this.filePath}`); 
        await this.activate(this.activeEditor?.getMode());
        await this.countOrigin();
        await sleep(1000); // when open new notes, update with delay
        this.updateStatusBarTracker();
        this.plugin.Widget?.updateCurrentData();
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
        const history = this.activeEditor?.editor.cm.state.field(historyField); // changed on 1.3.0, add delay to avoid error, rather than disable the error prompting
        // done on 1.0.1 | abandon false positive errors prompting

//console.log('historyField:', this.activeEditor?.editor.cm.state.field(historyField))
        
        const currentDone = history.done.length;
        const currentUndone = history.undone.length;
        
        // 计算变化差异（原核心逻辑）
        const doneDiff: number = currentDone - this.lastDone;
        const undoneDiff: number = currentUndone - this.lastUndone; // warn: may be reset to 0 when undo and do sth. 
        const historyCleared: number = ((currentDone + undoneDiff) < this.lastDone)?(this.lastDone - 100 - undoneDiff):0; // cannot use <= lastDone	because of a debounce bug	
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
                lastModifiedTime: this.lastModifiedTime,
                lastEditedWords: this.editedWords,
                lastEditedTimes: this.editedTimes
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
                    // @ts-expect-error
                    const prevChA = (fromA == 0)? ' ': this.activeEditor.editor.cm.state.sliceDoc(fromA-1,fromA);
                    
                    // only the added texts in history done field need to fix toA, as Obsidian will separate some bahaviors for inputting, causing the subseqChA not accurate. 
                    let fixedToA = toA;
                    let nextIndex: number = currentDone-i+1;
                    while (nextIndex <= currentDone-1)
                    {
                        history.done[nextIndex].changes.iterChanges((nFromA:Number, nToA:Number, nFromB:Number, nToB:Number, nInserted: string | Text )=>{
                            if (fixedToA= nFromA){
                                fixedToA = nToA;
                            }
                        })
                        
                        nextIndex++;
                    }

                    // @ts-expect-error
                    const subseqChA = (fixedToA == this.activeEditor.editor.cm.state.doc.length)? ' ': this.activeEditor.editor.cm.state.sliceDoc(fixedToA,fixedToA+1);
/*// @ts-expect-error
if (fixedToA != toA) console.log("Fixed toA from ", (toA == this.activeEditor.editor.cm.state.doc.length-1)? ' ': this.activeEditor.editor.cm.state.sliceDoc(toA,toA+1), " to ", subseqChA);
*/
                    // @ts-expect-error
                    const prevChB = (fromB == 0)? ' ': this.activeEditor.editor.cm.state.sliceDoc(fromB-1,fromB);
                    // @ts-expect-error
                    const subseqChB = (toB == this.activeEditor.editor.cm.state.doc.length-1)? ' ': this.activeEditor.editor.cm.state.sliceDoc(toB,toB+1);

                    const addedWords = this.addWordsCt(theOther, prevChA, subseqChA);
                    const deletedWords = this.deleteWordsCt(inserted, prevChB, subseqChB);
//console.log('Do added:', addedWords, '\nDo deleted:', deletedWords, 'total:', (addedWords + deletedWords))
if (DEBUG){
    console.log(`Do adding texts: "${theOther}" from ${fromA} to ${toA} in current document, \ndo deleting texts: "${inserted}" from ${fromB} to ${toB} in current document.`);
    console.log("prevChA: ", prevChA, "subseqChA: ", subseqChA);
}

                    this.editedWords += (addedWords + deletedWords);
                    this.addedWords += addedWords;
                    this.deletedWords += deletedWords;
                    this.changedWords += (addedWords - deletedWords);                    
                });
            }

            this.editedTimes += (doneDiff + historyCleared); // multiple changes should be counted only one time.
        }	

        // done | when fixed doneDiff is detected minus, and done events is added to undone.
        if ((doneDiff + historyCleared < 0)&&((undoneDiff + doneDiff + historyCleared) == 0 )){
            history.undone[currentUndone-1].changes.iterChanges((fromA:Number, toA:Number, fromB:Number, toB:Number, inserted: string | Text ) => { // inserted is Text in cm, string|Text in Obsidian               
                // @ts-expect-error
                const theOther = this.activeEditor.editor.cm.state.sliceDoc(fromA,toA);
                inserted = inserted.toString();
                // @ts-expect-error
                const prevChA = (fromA == 0)? ' ': this.activeEditor.editor.cm.state.sliceDoc(fromA-1,fromA);
                // @ts-expect-error
                const subseqChA = (toA == this.activeEditor.editor.cm.state.doc.length-1)? ' ': this.activeEditor.editor.cm.state.sliceDoc(toA,toA+1);
                // @ts-expect-error
                const prevChB = (fromB == 0)? ' ': this.activeEditor.editor.cm.state.sliceDoc(fromB-1,fromB);
                // @ts-expect-error
                const subseqChB = (toB == this.activeEditor.editor.cm.state.doc.length-1)? ' ': this.activeEditor.editor.cm.state.sliceDoc(toB,toB+1);

                const deletedWords = this.addWordsCt(inserted, prevChB, subseqChB);
                const addedWords = this.deleteWordsCt(theOther, prevChA, subseqChA);
/*                if (DEBUG) {
                    console.log(`Undo adding texts: "${inserted}" from ${fromB} to ${toB} from previous document, \nundo deleting texts: "${theOther}" from ${fromA} to ${toA} from previous document.`);
                    console.log("Modified Words: ", (addedWords + deletedWords));	
                }
*/                    
                this.editedWords += (addedWords + deletedWords);
                this.addedWords += addedWords;
                this.deletedWords += deletedWords;
                this.changedWords += (addedWords - deletedWords);	
            });

            this.editedTimes += undoneDiff; // multiple changes should be counted only one time.
        }

        
        
        this.lastDone = currentDone;
        this.lastUndone = currentUndone;
        if (Number(history.prevTime) !== 0) this.lastModifiedTime = Number(history.prevTime);
        this.updateStatusBarTracker();
        this.plugin.Widget?.updateCurrentData();
/*
console.log(`DocTracker.trackChanges: [${this.filePath}]:`, {
    currentEditedTimes: this.editedTimes,
    currentEditedWords: this.editedWords,
    AddedWords: this.addedWords,
    DeletedWords: this.deletedWords,
    ChangedWords: this.changedWords,
    lastRecordedWords: this.docWords,
    lastModifiedTime: this.lastModifiedTime,
        });
*/
    }
}

