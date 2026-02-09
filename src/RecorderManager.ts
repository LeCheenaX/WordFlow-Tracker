import { DocTracker } from './DocTracker';
import { DataRecorder } from './DataRecorder';
import WordflowTrackerPlugin from './main';
import { Notice } from 'obsidian';
import { throttleLeadingEdge } from './Utils/throttle';

export class RecorderManager {
    private recorders: DataRecorder[] = [];
    private throttledRecord: (tracker?: DocTracker) => Promise<void>;

    constructor(private plugin: WordflowTrackerPlugin) {
        this.throttledRecord = throttleLeadingEdge(this.execRecord.bind(this), 500);
    }

    public addRecorder(recorder: DataRecorder) {
        this.recorders.push(recorder);
    }

    public removeRecorder(index: number) {
        if (index >= 0 && index < this.recorders.length) {
            this.recorders.splice(index, 1);
        } else {
            console.error(`RecorderManager.removeRecorder: Invalid index ${index}. Valid range: 0-${this.recorders.length - 1}`);
            new Notice(this.plugin.i18n.t('notices.recorderRemoveFailed', { index }), 3000);
        }
    }

    public getRecorders(): DataRecorder[] {
        return this.recorders;
    }

    public async record(tracker?: DocTracker): Promise<void> {
        await this.throttledRecord(tracker);
    }

    private async execRecord(tracker?: DocTracker): Promise<void> {
        if (tracker) {
            // Record specific tracker
            if (!tracker.meetThreshold()) return;

            for (const recorder of this.recorders) {
                await recorder.record(tracker);
            }

            // Ensure recording is over before resetting
            await tracker.resetEdit();
            new Notice(this.plugin.i18n.t('notices.editsRecorded', { filePath: tracker.filePath }), 1000);
        } else {
            // Record all eligible trackers
            const trackersToReset: DocTracker[] = [];

            // Identify eligible trackers
            this.plugin.trackerMap.forEach(t => {
                if (t.meetThreshold()) {
                    trackersToReset.push(t);
                }
            });

            if (trackersToReset.length === 0) return;

            // Perform batch recording sequentially
            for (const recorder of this.recorders) {
                await recorder.record();
            }

            // Reset trackers
            for (const t of trackersToReset) {
                await t.resetEdit();
            }
        }
    }
}
