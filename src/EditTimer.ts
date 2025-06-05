import { DocTracker } from "./DocTracker";
import WordflowTrackerPlugin from "./main";

export default class EditTimer {
    private intervalId: number | null = null;
    private timeoutId: number | null = null;
    private startTime: number = 0;
    private accumulatedTime: number = 0;
    private timeToNextUpdate: number = 0; // miliseconds until next update
    private readonly updateInterval: number = 60000; // 60 seconds

    constructor(
        private plugin: WordflowTrackerPlugin,
        private tracker: DocTracker
    ) {}

    public start(): void {
        if (this.isRunning()) return;

        this.startTime = Date.now();
        this.accumulatedTime = this.tracker.editTime;

        this.clearTimers();

        // count remaining time until next min
        if (this.timeToNextUpdate === 0) {
            const totalTime = this.accumulatedTime;
            const timeInCurrentCycle = totalTime % this.updateInterval;
            this.timeToNextUpdate = timeInCurrentCycle === 0 ? this.updateInterval : this.updateInterval - timeInCurrentCycle;
        }

        this.scheduleNextUpdate();

        this.updateToTracker();
    }

    public pause(): void {
        if (!this.isRunning()) return;

        // count miliseconds left until next update
        if (this.timeoutId !== null) {
            const elapsedSinceStart = Date.now() - this.startTime;
            this.timeToNextUpdate = Math.max(0, this.timeToNextUpdate - elapsedSinceStart);
        }

        this.updateToTracker();
        this.clearTimers();
    }

    public getElapsedTime(): number {
        if (!this.isRunning()) {
            return this.accumulatedTime;
        }
        
        return this.accumulatedTime + (Date.now() - this.startTime);
    }

    public isRunning(): boolean {
        return this.timeoutId !== null || this.intervalId !== null;
    }

    public reset(): void {
        this.startTime = 0;
        this.accumulatedTime = 0;
        this.timeToNextUpdate = 0;
        
        this.updateToTracker();
        this.clearTimers();
    }

    private scheduleNextUpdate(): void {
        this.timeoutId = window.setTimeout(() => {
            this.timeoutId = null;
            this.updateToTracker();
            this.timeToNextUpdate = 0;
            
            // regular update per 60s since the first update
            this.startRegularUpdates();
        }, this.timeToNextUpdate);
    }

    private startRegularUpdates(): void {
        this.intervalId = this.plugin.registerInterval(
            window.setInterval(() => {
                if (this.isRunning()) {
                    this.updateToTracker();
                }
            }, this.updateInterval)
        );
    }

    private updateToTracker(): void {   
        this.tracker.editTime = this.getElapsedTime();
        this.tracker.updateStatusBarTracker();
    }

    private clearTimers(): void {
        if (this.timeoutId !== null) {
            window.clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // call for safety when plugin unload
    public destroy(): void {
        this.clearTimers();
    }
}
