export type PeriodicRecorderTargetType =
    | 'daily note'
    | 'weekly note'
    | 'monthly note'
    | 'quarterly note'
    | 'semesterly note'
    | 'yearly note';

export type RecorderTargetType = PeriodicRecorderTargetType | 'modified note';

export abstract class RecorderTarget {
    constructor(public readonly type: RecorderTargetType) {}

    public abstract isPeriodic(): boolean;
}

export abstract class PeriodicNoteRecorderTarget extends RecorderTarget {
    public isPeriodic(): boolean {
        return true;
    }
}

export class DailyNoteRecorderTarget extends PeriodicNoteRecorderTarget {
    constructor() {
        super('daily note');
    }
}

export class WeeklyNoteRecorderTarget extends PeriodicNoteRecorderTarget {
    constructor() {
        super('weekly note');
    }
}

export class MonthlyNoteRecorderTarget extends PeriodicNoteRecorderTarget {
    constructor() {
        super('monthly note');
    }
}

export class QuarterlyNoteRecorderTarget extends PeriodicNoteRecorderTarget {
    constructor() {
        super('quarterly note');
    }
}

export class SemesterlyNoteRecorderTarget extends PeriodicNoteRecorderTarget {
    constructor() {
        super('semesterly note');
    }
}

export class YearlyNoteRecorderTarget extends PeriodicNoteRecorderTarget {
    constructor() {
        super('yearly note');
    }
}

export class ModifiedNoteRecorderTarget extends RecorderTarget {
    constructor() {
        super('modified note');
    }

    public isPeriodic(): boolean {
        return false;
    }
}

export const PERIODIC_RECORDER_TARGET_TYPES: PeriodicRecorderTargetType[] = [
    'daily note',
    'weekly note',
    'monthly note',
    'quarterly note',
    'semesterly note',
    'yearly note'
];

export const RECORDER_TARGET_TYPES: RecorderTargetType[] = [
    ...PERIODIC_RECORDER_TARGET_TYPES,
    'modified note'
];

export function createRecorderTarget(type?: string): RecorderTarget {
    switch (type) {
        case 'weekly note':
            return new WeeklyNoteRecorderTarget();
        case 'monthly note':
            return new MonthlyNoteRecorderTarget();
        case 'quarterly note':
            return new QuarterlyNoteRecorderTarget();
        case 'semesterly note':
            return new SemesterlyNoteRecorderTarget();
        case 'yearly note':
            return new YearlyNoteRecorderTarget();
        case 'modified note':
            return new ModifiedNoteRecorderTarget();
        case 'daily note':
        default:
            return new DailyNoteRecorderTarget();
    }
}

export function isPeriodicRecorderTarget(type?: string): boolean {
    return createRecorderTarget(type).isPeriodic();
}
