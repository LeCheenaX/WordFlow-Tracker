import { DocTracker } from "./DocTracker";
import WordflowTrackerPlugin from "./main";
import { debounce, moment } from "obsidian";

export default class EditTimer {
    public debouncedStarter: ReturnType<typeof debounce> | null = null;

    private intervalId: number | null = null;
    private timeoutId: number | null = null;
    private startTime: number = 0;
    private accumulatedTime: number = 0;
    private timeToNextUpdate: number = 0; // miliseconds until next update

    private startDebounceInterval: number = 1000 as const; 
    private readonly updateInterval: number = 60000; // 60 seconds
    private readonly idleInterval: number = 180000; // 180 seconds
    private debouncedPauser: ReturnType<typeof debounce> | null = null;

    constructor(
        private plugin: WordflowTrackerPlugin,
        private tracker: DocTracker,
    ) {
        this.debouncedStarter = debounce(() => {
            if (this.debouncedPauser != null) this.debouncedPauser(); // refresh pauser
            this.start();
        }, this.startDebounceInterval, false); // for activating timer when paused automatically by debouncedPauser, separated from activating by docTracker
        this.debouncedPauser = debounce(() => {
            this.tracker.updateStatusBarTracker();
            this.pause();
        }, this.idleInterval, true); // update status bar before pausing, inaccuracy is less than 10ms
    }

    public start(): void {
//console.log("Try starting unrunning timer for ", this.tracker.filePath, "! ");
        if (this.isRunning()) return;
//console.log("Timer started!")
        this.startTime = Date.now();
        this.accumulatedTime = this.tracker.editTime;

        if (this.debouncedPauser != null) this.debouncedPauser();

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
        this.debouncedPauser?.cancel();
        this.debouncedStarter?.cancel();

        // count miliseconds left until next update
        if (this.timeoutId !== null) {
            const elapsedSinceStart = Date.now() - this.startTime;
            this.timeToNextUpdate = Math.max(0, this.timeToNextUpdate - elapsedSinceStart);
        }

        this.updateTrackerProp();
        this.clearTimers();
    }

    public getElapsedTime(): number {
        if (!this.isRunning()) {
            return this.accumulatedTime;
        } 
        if (this.startTime <=0) {
            console.warn('EditTimer: Try get focused time before starting the timer, returned focused time may be inaccurate.');
            return this.accumulatedTime;
        }
//console.log("Current time is: ", this.accumulatedTime + (Date.now() - this.startTime))
        return this.accumulatedTime + (Date.now() - this.startTime);
    }

    public isRunning(): boolean {
        return this.timeoutId !== null || this.intervalId !== null;
    }

    public reset(): void { // reset timers and restart
        // warning: never set startTime to 0, or getElapsedTime may return a unix timestamp rather than miliseconds
        this.accumulatedTime = 0;
        this.timeToNextUpdate = 0;
        this.debouncedPauser?.cancel();

        this.updateToTracker(); 
        this.clearTimers();
        this.debouncedStarter?.run();
    }

    // call for safety when plugin unload
    public destroy(): void {
        this.debouncedPauser?.cancel();
        this.debouncedPauser = null;
        this.debouncedStarter?.cancel();
        this.debouncedStarter = null;
        this.clearTimers();
    }

    private scheduleNextUpdate(): void {
        this.timeoutId = window.setTimeout(() => {
            
            this.updateToTracker();
            this.timeToNextUpdate = 0;
            
            // regular update per 60s since the first update
            this.startRegularUpdates();

            this.timeoutId = null; // must put to end for isRunning function to return correct value
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

    private updateTrackerProp(): void { // update only prop
        this.tracker.editTime = this.getElapsedTime();
    }

    private updateToTracker(): void { // update prop and status bar
        this.updateTrackerProp();
        this.tracker.updateStatusBarTracker();
    }

    private clearTimers(): void { // not exposed, or the debouncer may not be dereferenced
        if (this.timeoutId !== null) {
            window.clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

export function formatTime(ms: number): string {
    const duration = moment.duration(ms);
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
//return `${duration.asSeconds()} s`; // for debug only
    return (hours>0)? `${hours} h ${minutes} min`: `${minutes} min`;
}

export function restoreTimeString(timeStr: string): number {
    let hours = 0, minutes = 0;
    const hoursMatch = timeStr.match(/(\d+)\s*h/);
    if (hoursMatch) hours = parseInt(hoursMatch[1], 10);

    const minutesMatch = timeStr.match(/(\d+)\s*min/);
    if (minutesMatch) minutes = parseInt(minutesMatch[1], 10);

    return (hours*3600000 + minutes*60000);
}