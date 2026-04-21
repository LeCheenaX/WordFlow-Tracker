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
        if (index > 0 && index < this.recorders.length) { // delete default recorder (index = 0) is not allowed
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
        // Set isRecording synchronously before any await, so external events
        // (e.g. metadataCache.changed) are blocked from the moment record() is called.
        if (this.plugin.Widget) this.plugin.Widget.isRecording = true;
        await this.throttledRecord(tracker);
        // If throttledRecord was a no-op (throttled away, execRecord didn't run),
        // isRecording may still be true — clear it here as a safety net.
        if (this.plugin.Widget) this.plugin.Widget.isRecording = false;
    }

    /**
     * Capture snapshots for a file across all eligible recorders.
     * Only creates snapshots for recorders with AI Diff enabled and ${diff} variable.
     */
    public captureSnapshotsForFile(filePath: string, content: string): void {
        if (!this.plugin.settings.enableAIDiff) return;

        const recorderGroups = this.groupRecordersByNoteConfig();

        for (const [groupKey, recorders] of Object.entries(recorderGroups)) {
            const hasEligibleRecorder = recorders.some(recorder => recorder.isEligibleForAIDiff());

            if (hasEligibleRecorder) {
                const representativeRecorder = recorders[0];
                const period = this.getPeriodFromType(representativeRecorder.periodicNoteType);
                const dateFormat = representativeRecorder.periodicNoteFormat;

                this.plugin.snapshotManager.captureIfNeeded(
                    groupKey,
                    filePath,
                    content,
                    period,
                    dateFormat
                );
            }
        }
    }

    /**
     * Group recorders by their periodic note configuration (type, folder, format).
     * Recorders with the same configuration are considered part of the same group.
     */
    private groupRecordersByNoteConfig(): Record<string, DataRecorder[]> {
        const groups: Record<string, DataRecorder[]> = {};

        for (const recorder of this.recorders) {
            // Create a group key based on periodic note configuration
            const groupKey = `${recorder.periodicNoteType}|${recorder.periodicNoteFolder}|${recorder.periodicNoteFormat}`;

            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }

            groups[groupKey].push(recorder);
        }

        return groups;
    }

    /**
     * Map periodicNoteType to period format expected by SnapshotManager
     */
    private getPeriodFromType(periodicNoteType: string): string {
        const typeMap: Record<string, string> = {
            'daily note': 'daily',
            'weekly note': 'weekly',
            'monthly note': 'monthly',
            'quarterly note': 'quarterly',
            'semesterly note': 'semesterly',
            'yearly note': 'yearly'
        };
        return typeMap[periodicNoteType] || 'daily';
    }

    private async execRecord(tracker?: DocTracker): Promise<void> {
        if (tracker) {
            // Record specific tracker
            if (!tracker.meetThreshold()) return;

            try {
                for (const recorder of this.recorders) {
                    await recorder.record(tracker);
                }

                // Ensure recording is over before resetting
                await tracker.resetEdit();
                new Notice(this.plugin.i18n.t('notices.editsRecorded', { filePath: tracker.filePath }), 1000);
            } finally {
                if (this.plugin.Widget) {
                    this.plugin.Widget.isRecording = false;
                    // Update Widget once: existing is final, current is 0
                    await this.plugin.Widget.updateData();
                }
            }
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

            try {
                // Perform batch recording sequentially
                for (const recorder of this.recorders) {
                    await recorder.record();
                }

                // Reset all trackers
                for (const t of trackersToReset) {
                    await t.resetEdit();
                }
            } finally {
                if (this.plugin.Widget) {
                    this.plugin.Widget.isRecording = false;
                    // Update Widget once: existing is final, all currents are 0
                    await this.plugin.Widget.updateData();
                }
            }
        }
    }
}
