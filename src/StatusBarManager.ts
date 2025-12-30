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

    public updateFromTracker(tracker: DocTracker): void {
        const template = tracker.prevViewMode === 'source' 
            ? this.plugin.settings.customStatusBarEditMode 
            : this.plugin.settings.customStatusBarReadingMode;
        
        this.content = this.parseTemplate(template, tracker);
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