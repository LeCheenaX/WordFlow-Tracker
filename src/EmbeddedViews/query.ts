import { moment } from 'obsidian';

export type WordflowViewType =
    | 'SUMMARY'
    | 'NOTE TREND'
    | 'FISHBONE'
    | 'WEEKDAY PROFILE'
    | 'LEADERBOARD'
    | 'CFD';

export type WordflowMode = 'note' | 'tag';

export interface WordflowDateRange {
    label: string;
    start: moment.Moment;
    end: moment.Moment;
}

export interface WordflowViewQuery {
    view: WordflowViewType;
    recorderName?: string;
    field?: string;
    mode?: WordflowMode;
    file?: string;
    limit?: number;
    periodText?: string;
    title?: string;
}

const VIEW_ALIASES: Record<string, WordflowViewType> = {
    SUMMARY: 'SUMMARY',
    'NOTE TREND': 'NOTE TREND',
    TREND: 'NOTE TREND',
    FISHBONE: 'FISHBONE',
    'NOTE FISHBONE': 'FISHBONE',
    'WEEKDAY PROFILE': 'WEEKDAY PROFILE',
    WEEKDAY: 'WEEKDAY PROFILE',
    LEADERBOARD: 'LEADERBOARD',
    'NOTE LEADERBOARD': 'LEADERBOARD',
    CFD: 'CFD',
};

export const STANDARD_PERIODS = [
    'Past 7 days',
    'Past 30 days',
    'This week',
    'This month',
    'Past 12 weeks',
    'Custom range',
] as const;

export function parseWordflowQuery(source: string): WordflowViewQuery {
    const lines = source
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//') && !line.startsWith('#'));

    const query: WordflowViewQuery = {
        view: 'SUMMARY',
        periodText: 'Past 7 days',
    };

    if (lines[0]) {
        const normalizedView = lines[0].toUpperCase();
        query.view = VIEW_ALIASES[normalizedView] ?? 'SUMMARY';
    }

    for (const line of lines.slice(1)) {
        const upper = line.toUpperCase();
        if (upper.startsWith('RECORDER ')) {
            query.recorderName = unquote(line.slice('RECORDER '.length).trim());
        } else if (upper.startsWith('VALUE ')) {
            query.field = line.slice('VALUE '.length).trim();
        } else if (upper.startsWith('FIELD ')) {
            query.field = line.slice('FIELD '.length).trim();
        } else if (upper.startsWith('MODE ')) {
            query.mode = parseMode(line.slice('MODE '.length).trim());
        } else if (upper.startsWith('GROUP BY ')) {
            query.mode = parseMode(line.slice('GROUP BY '.length).trim());
        } else if (upper.startsWith('FILE ')) {
            query.file = unquote(line.slice('FILE '.length).trim());
        } else if (upper.startsWith('LIMIT ')) {
            const limit = parseInt(line.slice('LIMIT '.length).trim(), 10);
            if (!Number.isNaN(limit) && limit > 0) query.limit = limit;
        } else if (upper.startsWith('TITLE ')) {
            query.title = unquote(line.slice('TITLE '.length).trim());
        } else if (isPeriodLine(line)) {
            query.periodText = normalizePeriodText(line);
        }
    }

    return query;
}

export function getDefaultFieldForView(view: WordflowViewType): string {
    switch (view) {
        case 'NOTE TREND':
            return 'docWords';
        case 'WEEKDAY PROFILE':
        case 'FISHBONE':
        case 'CFD':
            return 'readEditTime';
        case 'LEADERBOARD':
            return 'editedWords';
        case 'SUMMARY':
        default:
            return 'readEditTime';
    }
}

export function resolveDateRange(periodText: string, customStart?: string, customEnd?: string): WordflowDateRange {
    const text = periodText.trim();
    const upper = text.toUpperCase();
    const today = moment().endOf('day');

    if (upper === 'CUSTOM RANGE') {
        const start = moment(customStart || today.format('YYYY-MM-DD'), 'YYYY-MM-DD').startOf('day');
        const end = moment(customEnd || today.format('YYYY-MM-DD'), 'YYYY-MM-DD').endOf('day');
        return normalizeRange(start, end, `${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`);
    }

    const toMatch = text.match(/^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/i);
    if (toMatch) {
        return normalizeRange(
            moment(toMatch[1], 'YYYY-MM-DD').startOf('day'),
            moment(toMatch[2], 'YYYY-MM-DD').endOf('day'),
            `${toMatch[1]} to ${toMatch[2]}`
        );
    }

    const fromMatch = text.match(/^FROM\s+(\d{4}-\d{2}-\d{2})\s+TO\s+(\d{4}-\d{2}-\d{2}|TODAY)$/i);
    if (fromMatch) {
        const end = fromMatch[2].toUpperCase() === 'TODAY'
            ? today
            : moment(fromMatch[2], 'YYYY-MM-DD').endOf('day');
        return normalizeRange(moment(fromMatch[1], 'YYYY-MM-DD').startOf('day'), end, `${fromMatch[1]} to ${end.format('YYYY-MM-DD')}`);
    }

    const pastDays = upper.match(/^PAST\s+(\d+)\s+DAYS?$/);
    if (pastDays) {
        const days = Math.max(1, parseInt(pastDays[1], 10));
        return normalizeRange(moment(today).subtract(days - 1, 'days').startOf('day'), today, `Past ${days} days`);
    }

    const pastWeeks = upper.match(/^PAST\s+(\d+)\s+WEEKS?$/);
    if (pastWeeks) {
        const weeks = Math.max(1, parseInt(pastWeeks[1], 10));
        return normalizeRange(moment(today).subtract(weeks * 7 - 1, 'days').startOf('day'), today, `Past ${weeks} weeks`);
    }

    if (upper === 'THIS WEEK' || upper === 'WEEK') {
        return normalizeRange(moment().startOf('isoWeek'), today, 'This week');
    }

    if (upper === 'THIS MONTH' || upper === 'MONTH') {
        return normalizeRange(moment().startOf('month'), today, 'This month');
    }

    return normalizeRange(moment(today).subtract(6, 'days').startOf('day'), today, 'Past 7 days');
}

function normalizeRange(start: moment.Moment, end: moment.Moment, label: string): WordflowDateRange {
    if (start.isAfter(end)) {
        return { start: end.clone().startOf('day'), end: start.clone().endOf('day'), label };
    }
    return { start, end, label };
}

function parseMode(value: string): WordflowMode | undefined {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'tag' || normalized === 'tag group' || normalized === 'tags') return 'tag';
    if (normalized === 'note' || normalized === 'file') return 'note';
    return undefined;
}

function isPeriodLine(line: string): boolean {
    return /^(PAST\s+\d+\s+(DAYS?|WEEKS?)|THIS\s+(WEEK|MONTH)|WEEK|MONTH|FROM\s+\d{4}-\d{2}-\d{2}\s+TO\s+(\d{4}-\d{2}-\d{2}|TODAY)|\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2})$/i.test(line);
}

function normalizePeriodText(line: string): string {
    return line.replace(/\s+/g, ' ').trim();
}

function unquote(value: string): string {
    return value.replace(/^["']|["']$/g, '');
}
