import WordflowTrackerPlugin from "./main";
import { DocTracker } from "./DocTracker";
import { formatTime } from "./Timer";
import { WordflowSettings } from "./settings";
import { MarkdownView } from "obsidian";

export class StatusBarManager {
    private statusBarEl: HTMLElement;
    private content: string = '';

    constructor(private plugin: WordflowTrackerPlugin) {
        this.statusBarEl = this.plugin.addStatusBarItem();
    }

    /**
     * Updates the status bar content based on the current document mode and focus state.
     * 
     * **Mode Detection:**
     * - Uses current active MarkdownView mode if available
     * - Falls back to tracker.prevViewMode if no active MarkdownView (e.g., user clicked on settings/images)
     * 
     * **Display Logic:**
     * - **Edit Mode (source)**: Always displays edit template (⌨️ time · edits · words)
     * - **Reading Mode + Focus Mode**: Displays reading template (📖 time)  
     * - **Reading Mode + Non-Focus Mode**: Displays empty content
     * 
     * **Supported Cases:**
     * 1. `inactive → source`: Edit template
     * 2. `source → source`: Edit template (no change)
     * 3. `inactive → source (focused)`: Edit template
     * 4. `inactive → preview (focused)`: Reading template
     * 5. `source → preview (focused)`: Reading template
     * 6. `preview → source (focused)`: Edit template
     * 7. `source → source (focused)`: Edit template (no change)
     * 8. `preview → preview (focused)`: Reading template (no change)
     * 9. `any → non-markdown`: Preserves previous template using tracker.prevViewMode
     * 
     * **Non-Focus Mode Behavior:**
     * - Reading mode without focus: Empty status bar
     * - Edit mode: Always shows content regardless of focus state
     * 
     * @param tracker - The DocTracker instance containing document state and timing data
     */
    public updateFromTracker(tracker: DocTracker): void {
        const currentMode = this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.getMode();
        const modeToUse = currentMode? currentMode: tracker.prevViewMode;

        if (modeToUse === 'source') {
            this.content = this.parseTemplate(this.plugin.settings.customStatusBarEditMode, tracker);
        } else if (this.plugin.Widget?.onFocusMode){ // file in reading mode and on focus
            this.content = this.parseTemplate(this.plugin.settings.customStatusBarReadingMode, tracker);
        } else {
            this.content = '';
        }

        this.statusBarEl.setText(this.content);
    }

    public clear(): void {
        this.content = '';
        this.statusBarEl.setText('');
    }

    public getContent(): string {
        return this.content;
    }

    public refresh(): void {
        // Fetch active DocTracker and refresh the status bar
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView?.file?.path) {
            const tracker = this.plugin.trackerMap.get(activeView.file.path);
            if (tracker && tracker.isActive) {
                this.updateFromTracker(tracker);
                return;
            }
        }

        this.clear();
    }

    private parseTemplate(template: string, tracker: DocTracker): string {
        return template.replace(/\$\{([^}]+)\}/g, (match, varName) => {
            switch (varName.trim()) {
                case 'editTime':
                    return formatTime(tracker.editTime);
                case 'readTime':
                    return formatTime(tracker.readTime);
                case 'readEditTime':
                    return formatTime(tracker.editTime + tracker.readTime);
                case 'editedTimes':
                    return tracker.editedTimes.toString();
                case 'editedWords':
                    return tracker.editedWords.toString();
                case 'addedWords':
                    return tracker.addedWords.toString();
                case 'deletedWords':
                    return tracker.deletedWords.toString();
                case 'changedWords':
                    return tracker.changedWords.toString();
                case 'docWords':
                    return tracker.docWords.toString();
                case 'fileName':
                    return tracker.fileName;
                case 'filePath':
                    return tracker.filePath;
                default:
                    return match; // Keep original if variable not recognized
            }
        });
    }
}

export function updateStatusBarStyle(settings: WordflowSettings): void {
    if (settings.enableMobileStatusBar) {
        document.body.classList.add('wordflow-status-bar-container');
    } else {
        removeStatusBarStyle();
    }
}

export function removeStatusBarStyle(): void {
    document.body.classList.remove('wordflow-status-bar-container');
}