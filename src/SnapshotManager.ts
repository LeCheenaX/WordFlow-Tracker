import WordflowTrackerPlugin from './main';
import { moment, normalizePath } from 'obsidian';

interface SnapshotData {
    snapshots: Record<string, Record<string, { content: string; timestamp: number; period: string; dateFormat: string }>>;  // groupKey → filePath → snapshot
}

const SNAPSHOT_FILE = 'wordflow-index.json';

export class SnapshotManager {
    private data: SnapshotData;
    private dirty: boolean = false;

    constructor(private plugin: WordflowTrackerPlugin) {
        this.data = { snapshots: {} };
    }

    public async load(): Promise<void> {
        try {
            const adapter = this.plugin.app.vault.adapter;

            const filePath = normalizePath(`.obsidian/${SNAPSHOT_FILE}`);
            if (await adapter.exists(filePath)) {
                const raw = await adapter.read(filePath);
                this.data = JSON.parse(raw);
            }
        } catch (e) {
            console.warn('SnapshotManager: Failed to load snapshots, starting fresh.', e);
            this.data = { snapshots: {} };
        }

        this.clearExpiredSnapshots();
    }

    public async save(): Promise<void> {
        if (!this.dirty) return;

        try {
            const adapter = this.plugin.app.vault.adapter;

            const filePath = normalizePath(`.obsidian/${SNAPSHOT_FILE}`);
            await adapter.write(filePath, JSON.stringify(this.data, null, 2));
            this.dirty = false;
        } catch (e) {
            console.error('SnapshotManager: Failed to save snapshots.', e);
        }
    }

    public captureIfNeeded(groupKey: string, filePath: string, content: string, period: string, dateFormat: string): void {
        this.clearExpiredSnapshots();

        if (!this.data.snapshots[groupKey]) {
            this.data.snapshots[groupKey] = {};
        }

        const groupSnapshots = this.data.snapshots[groupKey];
        const existingSnapshot = groupSnapshots[filePath];

        if (!existingSnapshot || this.isSnapshotExpired(existingSnapshot, period, dateFormat)) {
            groupSnapshots[filePath] = {
                content,
                timestamp: Date.now(),
                period,
                dateFormat
            };
            this.dirty = true;
            this.debouncedSave();
        }
    }

    public getSnapshot(groupKey: string, filePath: string, period: string, dateFormat: string): string | null {
        this.clearExpiredSnapshots();

        if (!this.data.snapshots[groupKey]) {
            return null;
        }

        //console.log(`SnapshotManager: Files in group ${groupKey}: ${Object.keys(this.data.snapshots[groupKey])}`);
        const snapshot = this.data.snapshots[groupKey][filePath];
        if (!snapshot) {
            //console.log(`SnapshotManager: Snapshot not found for ${filePath} in group ${groupKey}`);
            return null;
        }

        if (this.isSnapshotExpired(snapshot, period, dateFormat)) {
            //console.log(`SnapshotManager: Snapshot for ${filePath} in group ${groupKey} is expired`);
            return null;
        }

        //console.log(`SnapshotManager: Snapshot found for ${filePath} in group ${groupKey}`);
        return snapshot.content;
    }

    private isSnapshotExpired(snapshot: { timestamp: number; period: string; dateFormat: string }, currentPeriod: string, currentDateFormat: string): boolean {
        if (snapshot.dateFormat !== currentDateFormat) {
            return true;
        }

        const snapshotDate = moment(snapshot.timestamp);
        const now = moment();

        const snapshotFormatted = snapshotDate.format(currentDateFormat);
        const nowFormatted = now.format(currentDateFormat);

        if (snapshotFormatted !== nowFormatted) {
            return true;
        }

        switch (currentPeriod) {
            case 'daily':
                return !snapshotDate.isSame(now, 'day');
            case 'weekly':
                return !snapshotDate.isSame(now, 'week');
            case 'monthly':
                return !snapshotDate.isSame(now, 'month');
            case 'quarterly':
                return !snapshotDate.isSame(now, 'quarter');
            case 'semesterly':
                return Math.abs(snapshotDate.diff(now, 'months')) >= 6;
            case 'yearly':
                return !snapshotDate.isSame(now, 'year');
            default:
                return true;
        }
    }

    private clearExpiredSnapshots(): void {
        for (const [groupKey, groupSnapshots] of Object.entries(this.data.snapshots)) {
            for (const [filePath, snapshot] of Object.entries(groupSnapshots)) {
                if (this.isSnapshotExpired(snapshot, snapshot.period, snapshot.dateFormat)) {
                    delete groupSnapshots[filePath];
                    this.dirty = true;
                }
            }

            if (Object.keys(groupSnapshots).length === 0) {
                delete this.data.snapshots[groupKey];
                this.dirty = true;
            }
        }
    }

    public handleRename(oldPath: string, newPath: string): void {
        for (const groupSnapshots of Object.values(this.data.snapshots)) {
            if (oldPath in groupSnapshots) {
                groupSnapshots[newPath] = groupSnapshots[oldPath];
                delete groupSnapshots[oldPath];
                this.dirty = true;
            }
        }

        if (this.dirty) {
            this.debouncedSave();
        }
    }

    public removeSnapshot(groupKey: string, filePath: string): void {
        if (this.data.snapshots[groupKey] && filePath in this.data.snapshots[groupKey]) {
            delete this.data.snapshots[groupKey][filePath];
            this.dirty = true;

            if (Object.keys(this.data.snapshots[groupKey]).length === 0) {
                delete this.data.snapshots[groupKey];
            }

            this.debouncedSave();
        }
    }

    private saveTimeout: ReturnType<typeof setTimeout> | null = null;

    private debouncedSave(): void {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.save();
        }, 5000);
    }
}
