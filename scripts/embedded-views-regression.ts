import { readFileSync } from 'node:fs';
import { WordflowEmbeddedViewRenderer } from '../src/EmbeddedViews/renderer';
import type { WordflowViewData } from '../src/EmbeddedViews/data';
import { resolveTagGroups } from '../src/Utils/TagGroupResolver';
import { hexToHue, UniqueColorGenerator } from '../src/Utils/UniqueColorGenerator';
import { TagColorManager } from '../src/Utils/TagColorManager';
import { buildVisibleProjection } from '../src/EmbeddedViews/projection';

class TestElement {
    children: TestElement[] = [];
    attributes = new Map<string, string>();
    classes = new Set<string>();
    style: Record<string, string> = {};
    textContent = '';
    disabled = false;
    parent: TestElement | null = null;
    classList = { remove: (...classes: string[]) => classes.forEach(value => this.classes.delete(value)) };
    private listeners = new Map<string, ((event: Event) => void)[]>();
    constructor(public tagName = 'div') {}
    get firstElementChild(): TestElement | undefined { return this.children[0]; }
    appendChild<T extends TestElement>(child: T): T {
        child.remove();
        child.parent = this;
        this.children.push(child);
        return child;
    }
    createDiv(options: { cls?: string; text?: string } = {}): TestElement { return this.createChild('div', options); }
    createSpan(options: { cls?: string; text?: string } = {}): TestElement { return this.createChild('span', options); }
    createEl(tag: string, options: { cls?: string; text?: string } = {}): TestElement { return this.createChild(tag, options); }
    addClass(...classes: string[]): void { classes.flatMap(value => value.split(/\s+/)).filter(Boolean).forEach(value => this.classes.add(value)); }
    setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
    removeAttribute(name: string): void { this.attributes.delete(name); }
    getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
    empty(): void { this.children.forEach(child => { child.parent = null; }); this.children = []; this.textContent = ''; }
    remove(): void {
        if (!this.parent) return;
        this.parent.children = this.parent.children.filter(child => child !== this);
        this.parent = null;
    }
    cloneNode(deep = false): TestElement {
        const clone = new TestElement(this.tagName);
        clone.attributes = new Map(this.attributes);
        clone.classes = new Set(this.classes);
        clone.style = { ...this.style };
        clone.textContent = this.textContent;
        clone.disabled = this.disabled;
        if (deep) this.children.forEach(child => clone.appendChild(child.cloneNode(true)));
        return clone;
    }
    addEventListener(name: string, listener: (event: Event) => void): void {
        const listeners = this.listeners.get(name) || [];
        listeners.push(listener);
        this.listeners.set(name, listeners);
    }
    dispatch(name: string): void {
        const event = { preventDefault() {}, stopPropagation() {} } as unknown as Event;
        for (const listener of this.listeners.get(name) || []) listener(event);
    }
    findByClass(name: string): TestElement[] {
        const matches: TestElement[] = this.classes.has(name) ? [this] : [];
        return [...matches, ...this.children.flatMap(child => child.findByClass(name))];
    }
    findByAttribute(name: string, value: string): TestElement[] {
        const matches: TestElement[] = this.attributes.get(name) === value ? [this] : [];
        return [...matches, ...this.children.flatMap(child => child.findByAttribute(name, value))];
    }
    private createChild(tag: string, options: { cls?: string; text?: string }): TestElement {
        const child = new TestElement(tag);
        if (options.cls) child.addClass(options.cls);
        if (options.text) child.textContent = options.text;
        return this.appendChild(child);
    }
}

class TestMoment {
    constructor(private date: Date) {}
    format(pattern: string): string {
        const y = this.date.getUTCFullYear();
        const m = this.date.getUTCMonth() + 1;
        const d = this.date.getUTCDate();
        const pad = (value: number) => value.toString().padStart(2, '0');
        if (pattern === 'YYYY') return `${y}`;
        if (pattern === 'YYYY-MM') return `${y}-${pad(m)}`;
        if (pattern === 'MM-DD') return `${pad(m)}-${pad(d)}`;
        if (pattern === 'MM/DD') return `${pad(m)}/${pad(d)}`;
        if (pattern === 'ddd') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][this.date.getUTCDay()];
        return `${y}-${pad(m)}-${pad(d)}`;
    }
    diff(other: TestMoment, unit: string): number {
        if (unit !== 'days') throw new Error(`Unsupported unit: ${unit}`);
        return Math.floor((this.date.getTime() - other.date.getTime()) / 86400000);
    }
    isoWeek(): number {
        const target = new Date(this.date.getTime());
        const day = target.getUTCDay() || 7;
        target.setUTCDate(target.getUTCDate() + 4 - day);
        const start = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
        return Math.ceil((((target.getTime() - start.getTime()) / 86400000) + 1) / 7);
    }
    isoWeekday(): number { return this.date.getUTCDay() || 7; }
}

const pendingTimeouts = new Map<number, () => void>();
const pendingIntervals = new Map<number, () => void>();
let timerId = 0;
Object.assign(globalThis, {
    document: { createElementNS: (_ns: string, tag: string) => new TestElement(tag) },
    window: {
        setTimeout: (callback: () => void) => { const id = ++timerId; pendingTimeouts.set(id, callback); return id; },
        clearTimeout: (id: number) => pendingTimeouts.delete(id),
        setInterval: (callback: () => void) => { const id = ++timerId; pendingIntervals.set(id, callback); return id; },
        clearInterval: (id: number) => pendingIntervals.delete(id),
    },
});

function makeData(dayCount: number, entryCount: number, startTime = Date.UTC(2026, 0, 1)) {
    const days = Array.from({ length: dayCount }, (_, dayIndex) => {
        const date = new TestMoment(new Date(startTime + dayIndex * 86400000));
        const dateKey = `day-${dayIndex}`;
        const entries = Array.from({ length: entryCount }, (_, index) => ({
            date, dateKey, filePath: `Note ${index}.md`, fileName: `Note ${index}`,
            value: index + 1, color: `hsl(${index * 31} 70% 50%)`, tags: [], tagGroups: [],
        }));
        return { date, dateKey, entries, total: entries.reduce((sum, entry) => sum + entry.value, 0) };
    });
    const entries = days.flatMap(day => day.entries);
    const groups = Array.from({ length: entryCount }, (_, index) => {
        const groupEntries = entries.filter(entry => entry.filePath === `Note ${index}.md`);
        return { key: `Note ${index}.md`, label: `Note ${index}`, value: groupEntries.reduce((sum, entry) => sum + entry.value, 0), color: `hsl(${index * 31} 70% 50%)`, entries: groupEntries };
    });
    return { field: 'editedWords', fields: ['editedWords'], days, entries, groups, mode: 'note' as const, selectedFilePath: 'Note 0.md' };
}

function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }
const renderer = Object.create(WordflowEmbeddedViewRenderer.prototype) as unknown as {
    dataSource: { formatValue(value: number): string };
};
renderer.dataSource = { formatValue: (value: number) => value.toString() };
const failures: string[] = [];
function check(name: string, test: () => void): void {
    try { test(); console.log(`PASS ${name}`); }
    catch (error) { const message = error instanceof Error ? error.message : String(error); failures.push(`${name}: ${message}`); console.error(`FAIL ${name}: ${message}`); }
}
check('tag resolver keeps configured groups and individual unmatched tags while ignoring untagged notes', () => {
    const configs = [{ tags: ['draft', '#writing'], color: '#ff0000', groupName: 'Writing' }];
    const resolved = resolveTagGroups(['#draft', 'misc', 'misc'], configs);
    assert(resolved.configuredGroups.length === 1, 'expected the configured tag group');
    assert(resolved.configuredGroups[0].label === 'Writing', 'expected the configured group name');
    assert(resolved.unconfiguredTags.length === 1 && resolved.unconfiguredTags[0] === 'misc', 'expected one independent unmatched tag');

    const untagged = resolveTagGroups([], configs);
    assert(untagged.configuredGroups.length === 0 && untagged.unconfiguredTags.length === 0, 'expected untagged notes to have no tag groups');
});

check('configured tags collapse into one named group, or one combined label without a name', () => {
    const named = resolveTagGroups(['hello', 'mytest'], [{
        tags: ['hello', 'mytest', 'simplemindmap'],
        color: '#cd26d9',
        groupName: '666',
    }]);
    assert(named.configuredGroups.length === 1, 'expected configured tags to collapse into one group');
    assert(named.configuredGroups[0].label === '666', 'expected the configured group name');
    assert(named.configuredGroups[0].color === '#cd26d9', 'expected the configured group color');

    const unnamed = resolveTagGroups(['project/ssssss'], [{
        tags: ['project/ssssss', 'project/other'],
        color: '#3366cc',
    }]);
    assert(unnamed.configuredGroups.length === 1, 'expected one unnamed configured group');
    assert(unnamed.configuredGroups[0].label === '#project/ssssss #project/other', 'expected all configured tags on one line');
});

check('Wordflow tag mode ignores untagged notes and limits actual tag groups by value', () => {
    const data = makeData(1, 3) as unknown as WordflowViewData;
    data.mode = 'tag';
    const [untagged, configured, loose] = data.entries;
    untagged.value = 100;
    untagged.tags = [];
    untagged.tagGroups = [];
    configured.value = 20;
    configured.tags = ['hello'];
    configured.tagGroups = [{ key: 'configured:0', label: '666', color: '#cd26d9' }];
    loose.value = 10;
    loose.tags = ['loose'];
    loose.tagGroups = [{ key: 'tag:loose', label: '#loose', color: '#33cc66' }];
    data.groups = [
        { key: 'tag:loose', label: '#loose', value: 10, color: '#33cc66', entries: [loose] },
        { key: 'configured:0', label: '666', value: 20, color: '#cd26d9', entries: [configured] },
    ];

    const projection = buildVisibleProjection(data, 1);
    assert(projection.groups.length === 1 && projection.groups[0].label === '666', 'expected the highest-value real tag group');
    assert(projection.total === 20, 'expected the untagged note and lower-ranked tag to be completely ignored');
    assert(projection.activeFilePaths.size === 1 && projection.activeFilePaths.has(configured.filePath), 'expected only the visible tag group note');
});
check('random colors use distinct rendered HSL hues and avoid reserved configured hues', () => {
    const generator = new UniqueColorGenerator(66, [60, 85]);
    generator.reserve('#ff0000');
    const hues = Array.from({ length: 80 }, () => hexToHue(generator.generate()));
    assert(hues.every(hue => hue !== null && hue !== 0), 'expected generated colors to avoid the configured red hue');
    assert(new Set(hues).size === hues.length, 'expected every generated color to have a distinct rendered hue');
});

check('configured note colors vary within one tag and blend across multiple tag groups', () => {
    const generator = new UniqueColorGenerator(66, [60, 85]);
    const manager = new TagColorManager(
        {} as never,
        [
            { tags: ['red'], color: '#ff0000', groupName: 'Red group' },
            { tags: ['blue'], color: '#0000ff', groupName: 'Blue group' },
        ],
        generator,
        { hueRange: 30 }
    );
    const filesWithTags = new Map([
        ['red', ['A.md', 'B.md', 'Mixed.md']],
        ['blue', ['Mixed.md']],
    ]);
    const first = manager.getFileColor(['red'], 'A.md', filesWithTags);
    const second = manager.getFileColor(['red'], 'B.md', filesWithTags);
    const mixed = manager.getFileColor(['red', 'blue'], 'Mixed.md', filesWithTags);
    const firstHue = hexToHue(first);
    const secondHue = hexToHue(second);

    assert(first !== second, 'expected different S/L variants for notes sharing one configured tag');
    assert(firstHue !== null && secondHue !== null && Math.abs(firstHue - secondHue) <= 1, 'expected those variants to keep the same hue');
    assert(mixed !== first && mixed !== second, 'expected a note in multiple configured groups to use a blended color');
});
check('fishbone tag mode applies one color per group and LIMIT caps global groups', () => {
    const data = makeData(2, 3) as unknown as WordflowViewData;
    data.mode = 'tag';
    const colors = ['#aa0000', '#00aa00', '#0000aa'];
    for (const entry of data.entries) {
        const index = Number(entry.filePath.match(/\d+/)?.[0] || 0);
        entry.tags = ['tag-' + index];
        entry.tagGroups = [{ key: 'tag:' + index, label: '#tag-' + index, color: colors[index] }];
        entry.color = colors[index];
    }
    data.groups = colors.map((color, index) => ({
        key: 'tag:' + index,
        label: '#tag-' + index,
        value: data.entries.filter(entry => entry.filePath === 'Note ' + index + '.md').reduce((sum, entry) => sum + entry.value, 0),
        color,
        entries: data.entries.filter(entry => entry.filePath === 'Note ' + index + '.md'),
    })).sort((a, b) => b.value - a.value);

    const container = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: WordflowViewData, q: { limit?: number }): void }).renderFishbone(container, data, { limit: 2 });
    const branchColors = container.findByClass('wordflow-fishbone-branch').map(branch => branch.getAttribute('stroke'));
    assert(branchColors.length === 4, 'expected two global groups across two days');
    assert(new Set(branchColors).size === 2, 'expected each tag group to keep one color across days');
});

check('fishbone adapts its angle while keeping 20 labels per day collision-free', () => {
    const container = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: unknown, q: { limit?: number }): void }).renderFishbone(container, makeData(7, 20), {});
    const branches = container.findByClass('wordflow-fishbone-branch');
    const labels = container.findByClass('wordflow-fishbone-label');
    assert(branches.length === 140, 'expected 20 branches for each of seven days');
    assert(labels.length === 140, 'expected one label for every branch');
    const geometry = branches.map((branch, index) => {
        const match = (branch.getAttribute('d') || '').match(/^M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) H ([-\d.]+)$/);
        assert(Boolean(match), 'expected one diagonal followed by one horizontal segment');
        const startX = Number(match![1]);
        const startY = Number(match![2]);
        const elbowX = Number(match![3]);
        const elbowY = Number(match![4]);
        const tailEndX = Number(match![5]);
        const dx = Math.abs(elbowX - startX);
        const dy = Math.abs(elbowY - startY);
        const labelCenter = parseFloat(labels[index].style.left || 'NaN');
        assert(Math.abs(labelCenter - ((elbowX + tailEndX) / 2 + 6)) < 0.02, 'expected each name consistently offset right from its horizontal tail');
        return {
            angle: Math.atan2(dy, dx) * 180 / Math.PI,
            diagonal: Math.hypot(dx, dy),
            tail: Math.abs(tailEndX - elbowX),
        };
    });
    assert(geometry.every(item => item.angle >= 60 && item.angle <= 70), 'expected seven-day high load to keep a spacious angle');
    assert(geometry.every(item => Math.abs(item.angle - geometry[0].angle) < 0.02), 'expected one global adaptive angle');
    assert(geometry.every(item => Math.abs(item.tail - geometry[0].tail) < 0.02 && item.tail >= 40), 'expected equal visible horizontal tails');
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayGeometry = geometry.slice(dayIndex * 20, (dayIndex + 1) * 20);
        const increments = dayGeometry.slice(1).map((item, index) => item.diagonal - dayGeometry[index].diagonal);
        assert(increments.every(value => Math.abs(value - increments[0]) < 0.03 && value >= 16), 'expected diagonal lengths to grow by one fixed step');
    }
    const rectangles = labels.map(label => {
        const centerX = parseFloat(label.style.left || '0');
        const centerY = parseFloat(label.style.top || '0');
        const width = parseFloat(label.style.width || '0');
        return { left: centerX - width / 2, right: centerX + width / 2, top: centerY - 6, bottom: centerY + 6 };
    });
    for (let first = 0; first < rectangles.length; first++) {
        for (let second = first + 1; second < rectangles.length; second++) {
            const a = rectangles[first];
            const b = rectangles[second];
            const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            assert(!overlaps, `expected label rectangles ${first} and ${second} not to overlap`);
        }
    }
});

check('fishbone uses the available width and keeps the final day forward-facing', () => {
    const container = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: unknown, q: { limit?: number }): void }).renderFishbone(container, makeData(7, 9), {});
    const branches = container.findByClass('wordflow-fishbone-branch');
    const nodes = container.findByClass('wordflow-fishbone-node');
    const svg = container.findByClass('wordflow-fishbone-svg')[0];
    const viewBox = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    const stageWidth = viewBox[2];
    const parsed = branches.map(branch => {
        const match = (branch.getAttribute('d') || '').match(/^M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) H ([-\d.]+)$/);
        assert(Boolean(match), 'expected a fishbone polyline');
        const startX = Number(match![1]);
        const startY = Number(match![2]);
        const elbowX = Number(match![3]);
        const elbowY = Number(match![4]);
        const tailEndX = Number(match![5]);
        return {
            startX,
            elbowX,
            tailEndX,
            angle: Math.atan2(Math.abs(elbowY - startY), Math.abs(elbowX - startX)) * 180 / Math.PI,
            tail: Math.abs(tailEndX - elbowX),
        };
    });
    assert(parsed.every(item => item.angle >= 64 && item.angle <= 74), 'expected a balanced, less vertical angle for ordinary load');
    assert(parsed.every(item => item.tail >= 70), 'expected longer readable horizontal tails');
    const finalDay = parsed.slice(-9);
    assert(finalDay.every(item => item.elbowX > item.startX && item.tailEndX > item.elbowX), 'expected the final day to face forward');
    assert(Math.max(...finalDay.map(item => item.tailEndX)) <= stageWidth - 12, 'expected the final day to remain inside the stage');
    const nodeXs = nodes.map(node => parseFloat(node.style.left || '0'));
    assert((Math.max(...nodeXs) - Math.min(...nodeXs)) / stageWidth >= 0.7, 'expected day nodes to use at least 70% of chart width');
});
check('fishbone LIMIT overrides its default', () => {
    const container = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: unknown, q: { limit?: number }): void }).renderFishbone(container, makeData(1, 20), { limit: 4 });
    assert(container.findByClass('wordflow-fishbone-branch').length === 4, 'expected four branches');
});

check('fishbone labels are frameless and shifted right of their tails', () => {
    const container = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: unknown, q: { limit?: number }): void }).renderFishbone(container, makeData(1, 1), {});
    const branch = container.findByClass('wordflow-fishbone-branch')[0];
    const label = container.findByClass('wordflow-fishbone-label')[0];
    const match = (branch.getAttribute('d') || '').match(/L ([-\d.]+) ([-\d.]+) H ([-\d.]+)$/);
    assert(Boolean(match), 'expected fishbone branch geometry');
    const midpoint = (Number(match![1]) + Number(match![3])) / 2;
    assert(parseFloat(label.style.left || '0') >= midpoint + 4, 'expected text to move slightly right of the tail midpoint');
    assert(label.getAttribute('data-frameless') === 'true', 'expected frameless fishbone labels');
    const css = readFileSync('styles.css', 'utf8');
    const framelessRule = /(?:^|\n)\.wordflow-fishbone-label \{[^}]*background:\s*transparent[^}]*box-shadow:\s*none[^}]*\}/;
    assert(framelessRule.test(css), 'expected no fishbone label background or frame shadow');
});
check('leaderboard LIMIT controls row count and does not render a legend', () => {
    const container = new TestElement();
    (renderer as never as { renderLeaderboard(c: TestElement, d: unknown, q: { limit?: number }): void }).renderLeaderboard(container, makeData(1, 12), { limit: 3 });
    assert(container.findByClass('wordflow-leaderboard-row').length === 3, 'expected three rows');
    assert(container.findByClass('wordflow-view-legend').length === 0, 'expected no duplicate leaderboard legend');
});

check('CFD LIMIT controls both group segments and legend count', () => {
    const container = new TestElement();
    (renderer as never as { renderCfd(c: TestElement, d: unknown, q: { limit?: number }): void }).renderCfd(container, makeData(1, 8), { limit: 8 });
    assert(container.findByClass('wordflow-cfd-segment').length === 8, 'expected eight group segments');
    assert(container.findByClass('wordflow-view-legend-item').length === 8, 'expected eight legend items');
});

check('CFD LIMIT excludes hidden notes from every visible calculation', () => {
    const container = new TestElement();
    (renderer as never as { renderCfd(c: TestElement, d: unknown, q: { limit?: number }): void }).renderCfd(container, makeData(1, 3), { limit: 1 });
    const segments = container.findByClass('wordflow-cfd-segment');
    const totals = container.findByClass('wordflow-cfd-total');
    assert(segments.length === 1, 'expected exactly one visible limited note');
    assert(segments[0].style.height === '100%', 'expected hidden notes not to leave an anonymous grey remainder');
    assert(totals[0].textContent === '3', 'expected the column total to ignore notes beyond LIMIT');
});

check('CFD keeps a fixed 14-day plot and supports day, page, and hold navigation', () => {
    const container = new TestElement();
    (renderer as never as { renderCfd(c: TestElement, d: unknown, q: { limit?: number }): void }).renderCfd(container, makeData(28, 3), { limit: 3 });
    assert(container.findByClass('wordflow-cfd-col').length === 14, 'expected a two-week viewport');
    assert(container.findByClass('wordflow-cfd-col').every(col => /px$/.test(col.style.height || '')), 'expected stable pixel column heights');
    const initialFirstDay = container.findByClass('wordflow-cfd-day')[0].textContent;
    const previousDay = container.findByAttribute('aria-label', 'Previous day')[0];
    const previousPage = container.findByAttribute('aria-label', 'Previous page')[0];
    const nextPage = container.findByAttribute('aria-label', 'Next page')[0];
    assert(Boolean(previousDay && previousPage && nextPage), 'expected day and page controls');
    assert(nextPage.getAttribute('data-step') === '14', 'expected a two-week page jump');
    previousDay.dispatch('click');
    assert(container.findByClass('wordflow-cfd-day')[0].textContent !== initialFirstDay, 'expected one-day navigation to shift the window');
    previousPage.dispatch('click');
    assert(container.findByClass('wordflow-cfd-range').length === 1, 'expected a visible date range');
    const nextDay = container.findByAttribute('aria-label', 'Next day')[0];
    const beforeHold = container.findByClass('wordflow-cfd-day')[0].textContent;
    nextDay.dispatch('pointerdown');
    for (const callback of [...pendingTimeouts.values()]) callback();
    for (const callback of [...pendingIntervals.values()]) callback();
    nextDay.dispatch('pointerup');
    assert(container.findByClass('wordflow-cfd-day')[0].textContent !== beforeHold, 'expected long press to repeat one-day navigation');

    const weekContainer = new TestElement();
    (renderer as never as { renderCfd(c: TestElement, d: unknown, q: { limit?: number }): void }).renderCfd(weekContainer, makeData(7, 3), { limit: 3 });
    assert(weekContainer.findByClass('wordflow-cfd-col').length === 7, 'expected a one-week viewport');
    assert(weekContainer.findByAttribute('aria-label', 'Next page')[0].getAttribute('data-step') === '7', 'expected a one-week page jump');
});
check('12-week trend is wide and has adaptive week coordinates', () => {
    const container = new TestElement();
    (renderer as never as { renderNoteTrend(c: TestElement, d: unknown, q: { file: string }): void }).renderNoteTrend(container, makeData(84, 1), { file: 'Note 0.md' });
    const svg = container.findByClass('wordflow-line-chart')[0];
    const box = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    assert(box.length === 4 && box[3] >= 72 && box[2] / box[3] <= 3.1, 'expected a substantially taller trend viewBox');
    const ticks = container.findByClass('wordflow-trend-x-label');
    assert(ticks.length >= 2, 'expected horizontal time labels');
    assert(ticks.every(tick => tick.getAttribute('data-granularity') === 'week'), 'expected week granularity');
    const gridYs = container.findByClass('wordflow-trend-grid-line')
        .map(line => (line.getAttribute('d') || '').match(/^M 18 ([-\d.]+) H 218$/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map(match => Number(match[1]));
    assert(Math.max(...gridYs) - Math.min(...gridYs) >= 50, 'expected the plot to use most of the vertical chart area');
    const labelY = Math.max(...ticks.map(tick => Number(tick.getAttribute('y'))));
    assert(labelY - Math.max(...gridYs) <= 8, 'expected week labels close to the plot');
});

check('trend uses adaptive integer y-axis ticks and a clean legend label', () => {
    const container = new TestElement();
    const data = makeData(30, 1);
    data.days.forEach(day => {
        day.entries[0].value = 137;
        day.total = 137;
    });
    (renderer as never as { renderNoteTrend(c: TestElement, d: unknown, q: { file: string }): void }).renderNoteTrend(container, data, { file: 'Note 0.md' });
    const labels = container.findByClass('wordflow-trend-y-label');
    assert(labels.length >= 3, 'expected multiple y-axis labels');
    assert(labels.every(label => /^-?\d+$/.test(label.textContent)), 'expected integer y-axis labels');
    assert(!labels.some(label => label.textContent === '4110'), 'expected a rounded scale instead of the exact maximum');
    const legendLabel = container.findByClass('wordflow-view-legend-label')[0];
    assert(Boolean(legendLabel), 'expected a dedicated legend label element');
    assert(legendLabel.textContent === 'Note 0.md ' + String.fromCharCode(183) + ' editedWords', 'expected note name and property field only');
    const heading = container.findByClass('wordflow-trend-heading')[0];
    assert(Boolean(heading), 'expected a shared trend heading row');
    assert(heading.findByClass('wordflow-chart-caption').length === 0, 'expected the duplicate note caption removed');
    assert(heading.findByClass('wordflow-view-legend').length === 1, 'expected legend in the heading row');
});

check('summary legends mark long filenames for ellipsis', () => {
    const data = makeData(7, 1);
    data.groups[0].label = 'An extremely long source filename that must never escape the summary card boundary';
    const container = new TestElement();
    (renderer as never as { renderSummary(c: TestElement, d: unknown): void }).renderSummary(container, data);
    const label = container.findByClass('wordflow-view-legend-label')[0];
    assert(Boolean(label), 'expected a dedicated summary legend label');
    assert(label.getAttribute('title') === data.groups[0].label, 'expected full filename to remain available as a tooltip title');
    const css = readFileSync('styles.css', 'utf8');
    assert(/\.wordflow-summary-donut-wrap \.wordflow-view-legend-item \{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto/s.test(css), 'expected dot, flexible name, and fixed value columns');
    assert(/\.wordflow-summary-donut-wrap \.wordflow-view-legend-label \{[^}]*text-align:\s*left/s.test(css), 'expected summary names left-aligned');
    assert(/\.wordflow-summary-donut-wrap \.wordflow-view-legend-value \{[^}]*text-align:\s*right/s.test(css), 'expected summary values right-aligned');
});

check('SUMMARY LIMIT excludes hidden groups from totals, timeline, active notes, and donut', () => {
    const data = makeData(1, 3);
    const container = new TestElement();
    (renderer as never as { renderSummary(c: TestElement, d: unknown, q: { limit?: number }): void }).renderSummary(container, data, { limit: 1 });
    const kpiValues = container.findByClass('wordflow-summary-kpi').map(kpi => kpi.children[1]?.textContent);
    const donut = container.findByClass('wordflow-donut')[0];
    const hole = container.findByClass('wordflow-donut-hole')[0];
    assert(kpiValues[0] === '3', 'expected total to ignore groups beyond LIMIT');
    assert(kpiValues[1] === '1', 'expected active notes to ignore groups beyond LIMIT');
    assert(donut.style.background.includes('100%'), 'expected the visible group to occupy the complete donut');
    assert(hole.children[0].textContent === '3', 'expected the donut center to ignore groups beyond LIMIT');
});

check('trend coordinates adapt across day, month, and year ranges', () => {
    const cases = [
        { days: 7, expected: 'day' },
        { days: 365, expected: 'month' },
        { days: 900, expected: 'year' },
    ];
    for (const item of cases) {
        const container = new TestElement();
        (renderer as never as { renderNoteTrend(c: TestElement, d: unknown, q: { file: string }): void }).renderNoteTrend(container, makeData(item.days, 1), { file: 'Note 0.md' });
        const ticks = container.findByClass('wordflow-trend-x-label');
        assert(ticks.length >= 2, `expected ${item.expected} ticks`);
        assert(ticks.every(tick => tick.getAttribute('data-granularity') === item.expected), `expected ${item.expected} granularity`);
    }
});
check('SUMMARY renders every LIMIT item and gives its legend a wider scrollable column', () => {
    const container = new TestElement();
    (renderer as never as { renderSummary(c: TestElement, d: unknown, q: { limit?: number }): void }).renderSummary(container, makeData(1, 8), { limit: 8 });
    assert(container.findByClass('wordflow-view-legend-item').length === 8, 'expected all eight LIMIT groups, not the old fixed six');
    const css = readFileSync('styles.css', 'utf8');
    assert(/\.wordflow-summary-grid \{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.08fr\)\s+minmax\(250px,\s*0\.92fr\)/s.test(css), 'expected ten percent of the left column allocation moved right');
    assert(/\.wordflow-summary-donut-wrap \.wordflow-view-legend \{[^}]*max-height:[^;}]+;[^}]*overflow-y:\s*auto/s.test(css), 'expected the summary legend to scroll');
});

check('LEADERBOARD renders beyond ten items inside an exact ten-row scroll viewport', () => {
    const container = new TestElement();
    (renderer as never as { renderLeaderboard(c: TestElement, d: unknown, q: { limit?: number }): void }).renderLeaderboard(container, makeData(1, 12), { limit: 12 });
    assert(container.findByClass('wordflow-leaderboard-row').length === 12, 'expected LIMIT to control rendered rows');
    const css = readFileSync('styles.css', 'utf8');
    assert(/\.wordflow-leaderboard \{[^}]*grid-auto-rows:\s*40px[^}]*max-height:\s*472px[^}]*overflow-y:\s*auto/s.test(css), 'expected exactly ten 40px rows plus nine 8px gaps before scrolling');
});

check('fishbone puts all branch labels above their tails, lengthens tails, and pages by day or week', () => {
    const container = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: unknown, q: { limit?: number }): void }).renderFishbone(container, makeData(14, 1), { limit: 1 });
    assert(container.findByClass('wordflow-fishbone-node').length === 7, 'expected a seven-day fishbone viewport');
    const previousDay = container.findByAttribute('aria-label', 'Previous day')[0];
    const previousPage = container.findByAttribute('aria-label', 'Previous page')[0];
    assert(Boolean(previousDay && previousPage), 'expected CFD-style day and page controls');
    assert(previousPage.getAttribute('data-step') === '7', 'expected a seven-day page jump');

    const branches = container.findByClass('wordflow-fishbone-branch');
    const labels = container.findByClass('wordflow-fishbone-label');
    branches.forEach((branch, index) => {
        const match = (branch.getAttribute('d') || '').match(/^M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) H ([-\d.]+)$/);
        assert(Boolean(match), 'expected fishbone branch geometry');
        const startY = Number(match![2]);
        const elbowX = Number(match![3]);
        const elbowY = Number(match![4]);
        const tailEndX = Number(match![5]);
        assert(Math.abs(tailEndX - elbowX) >= 120, 'expected the horizontal tail to be sixty percent longer');
        if (elbowY > startY) {
            assert(parseFloat(labels[index].style.top || '0') < elbowY, 'expected downward branch text above its horizontal tail');
        }
    });

    const range = container.findByClass('wordflow-fishbone-range')[0];
    const initialRange = range.textContent;
    previousDay.dispatch('click');
    assert(container.findByClass('wordflow-fishbone-range')[0].textContent !== initialRange, 'expected one-day fishbone navigation');
});

check('note trend removes the duplicate caption and left-aligns legend and y-axis labels', () => {
    const container = new TestElement();
    (renderer as never as { renderNoteTrend(c: TestElement, d: unknown, q: { file: string }): void }).renderNoteTrend(container, makeData(30, 1), { file: 'Test.md' });
    assert(container.findByClass('wordflow-chart-caption').length === 0, 'expected no duplicate note caption');
    assert(container.findByClass('wordflow-trend-heading')[0].findByClass('wordflow-view-legend').length === 1, 'expected the legend in the top-left heading row');
    const yLabels = container.findByClass('wordflow-trend-y-label');
    assert(yLabels.every(label => label.getAttribute('x') === '0' && label.getAttribute('text-anchor') === 'start'), 'expected y-axis number left edges aligned with the Start card');
    const css = readFileSync('styles.css', 'utf8');
    assert(/\.wordflow-trend-heading \{[^}]*justify-content:\s*flex-start/s.test(css), 'expected the trend heading content left-aligned');
    assert(/\.wordflow-trend-heading \.wordflow-view-legend \{[^}]*justify-content:\s*flex-start/s.test(css), 'expected the trend legend left-aligned');
});

check('fishbone keeps date orientation stable while sliding and anchors the latest day upward', () => {
    const container = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: unknown, q: { periodText?: string; limit?: number }): void })
        .renderFishbone(container, makeData(8, 1), { periodText: 'Past 30 days', limit: 1 });

    const readDirections = () => {
        const labels = container.findByClass('wordflow-fishbone-day');
        const branches = container.findByClass('wordflow-fishbone-branch').slice(0, labels.length);
        return new Map(labels.map((label, index) => {
            const match = (branches[index].getAttribute('d') || '').match(/^M [-\d.]+ ([-\d.]+) L [-\d.]+ ([-\d.]+) H/);
            assert(Boolean(match), 'expected a fishbone branch for every date');
            return [label.textContent, Number(match![2]) < Number(match![1]) ? 'up' : 'down'];
        }));
    };

    const initialDirections = readDirections();
    assert([...initialDirections.values()].slice(-1)[0] === 'up', 'expected the latest/today anchor to face upward');
    container.findByAttribute('aria-label', 'Previous day')[0].dispatch('click');
    const shiftedDirections = readDirections();
    for (const [date, direction] of initialDirections) {
        if (shiftedDirections.has(date)) assert(shiftedDirections.get(date) === direction, `expected ${date} not to flip after sliding`);
    }
    assert(container.findByClass('wordflow-fishbone-page').length === 1, 'expected one composited fishbone data layer without a duplicate outgoing page');
    assert(container.findByClass('is-outgoing').length === 0, 'expected no outgoing fishbone clone that could produce ghosting');
});

check('fishbone uses weekdays only for This week and honors LIMIT above six', () => {
    const dated = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: unknown, q: { periodText?: string; limit?: number }): void })
        .renderFishbone(dated, makeData(1, 8), { periodText: 'Past 30 days', limit: 8 });
    assert(dated.findByClass('wordflow-fishbone-day')[0].textContent === '01/01', 'expected MM/DD outside This week');
    assert(dated.findByClass('wordflow-view-legend-item').length === 8, 'expected LIMIT 8 to render all eight fishbone legend groups');

    const weekly = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: unknown, q: { periodText?: string; limit?: number }): void })
        .renderFishbone(weekly, makeData(1, 1), { periodText: 'This week', limit: 1 });
    assert(weekly.findByClass('wordflow-fishbone-day')[0].textContent === 'Thu', 'expected weekday labels for This week');
    const css = readFileSync('styles.css', 'utf8');
    assert(/\.wordflow-fishbone-label \{[^}]*justify-content:\s*space-between/s.test(css), 'expected names and values to occupy opposite ends of each tail');
    assert(/\.wordflow-fishbone-name \{[^}]*text-align:\s*left/s.test(css), 'expected fishbone names left-aligned');
    assert(/\.wordflow-fishbone-value \{[^}]*text-align:\s*right/s.test(css), 'expected fishbone values right-aligned');
});

check('Note Trend uses weekdays for This week and Monday anchors for Past 30 days', () => {
    const weekly = new TestElement();
    (renderer as never as { renderNoteTrend(c: TestElement, d: unknown, q: { file: string; periodText?: string }): void })
        .renderNoteTrend(weekly, makeData(7, 1), { file: 'Note 0.md', periodText: 'This week' });
    assert(weekly.findByClass('wordflow-trend-x-label').map(label => label.textContent).join(',') === 'Thu,Fri,Sat,Sun,Mon,Tue,Wed', 'expected weekday labels for This week');

    const monthly = new TestElement();
    (renderer as never as { renderNoteTrend(c: TestElement, d: unknown, q: { file: string; periodText?: string }): void })
        .renderNoteTrend(monthly, makeData(30, 1), { file: 'Note 0.md', periodText: 'Past 30 days' });
    const weekLabels = monthly.findByClass('wordflow-trend-x-label').map(label => label.textContent);
    assert(weekLabels.join(',') === 'W02,W03,W04,W05', 'expected every Monday anchor, including the current incomplete week');
    assert(new Set(weekLabels).size === weekLabels.length, 'expected one label per ISO-week Monday');
});

check('Note Trend uses the full plot width and solid compact markers', () => {
    const container = new TestElement();
    (renderer as never as { renderNoteTrend(c: TestElement, d: unknown, q: { file: string; periodText?: string }): void })
        .renderNoteTrend(container, makeData(7, 1), { file: 'Note 0.md', periodText: 'Past 7 days' });
    const horizontalGrid = container.findByClass('wordflow-trend-grid-line').find(line => /^M 18 .* H 218$/.test(line.getAttribute('d') || ''));
    assert(Boolean(horizontalGrid), 'expected grid lines to start closer to y-axis labels and extend farther right');
    const markers = container.findByClass('wordflow-trend-marker');
    assert(markers.length > 0, 'expected visible trend markers');
    assert(markers.every(marker => marker.getAttribute('fill') === 'var(--interactive-accent)'), 'expected solid accent-color markers');
    assert(markers.every(marker => marker.getAttribute('stroke') === null && marker.getAttribute('r') === '0.85'), 'expected compact markers without hollow strokes');
});

check('CFD renders zero days low, adds reference lines, and slides old and new pages', () => {
    const data = makeData(15, 1);
    data.entries.filter(entry => entry.dateKey === 'day-1').forEach(entry => { entry.value = 0; });
    const container = new TestElement();
    (renderer as never as { renderCfd(c: TestElement, d: unknown, q: { limit?: number }): void }).renderCfd(container, data, { limit: 1 });
    const columns = container.findByClass('wordflow-cfd-col');
    assert(columns[0].style.height === '4px', 'expected a zero-value CFD day to remain visibly low');
    assert(container.findByClass('wordflow-cfd-gridlines').length === 1, 'expected faint CFD reference lines without coordinates');
    container.findByAttribute('aria-label', 'Previous day')[0].dispatch('click');
    assert(container.findByClass('wordflow-cfd').length === 1, 'expected one composited CFD layer after navigation');
    assert(container.findByClass('is-outgoing').length === 0, 'expected no outgoing CFD clone that could produce ghosting');
});

check('fishbone and CFD transitions move by one short slot instead of a full page', () => {
    const css = readFileSync('styles.css', 'utf8');
    assert(/--wordflow-slide-distance/.test(css), 'expected navigation to expose a slot-distance variable');
    assert(/@keyframes wordflow-slide-in-next\s*\{[^}]*translateX\(var\(--wordflow-slide-distance\)\)/s.test(css), 'expected the incoming page to move by one slot');
    assert(!/@keyframes wordflow-slide-(?:in|out)-(?:next|previous)\s*\{[^}]*translateX\((?:-)?100%\)/s.test(css), 'expected no full-page chart transition');
});

check('rapid chart navigation never stacks duplicate animated layers', () => {
    const fishbone = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: unknown, q: { periodText?: string; limit?: number }): void })
        .renderFishbone(fishbone, makeData(35, 2), { periodText: 'Past 30 days', limit: 2 });
    const fishbonePrevious = fishbone.findByAttribute('aria-label', 'Previous day')[0];
    fishbonePrevious.dispatch('click');
    fishbonePrevious.dispatch('click');
    fishbonePrevious.dispatch('click');
    assert(fishbone.findByClass('wordflow-fishbone-page').length === 1, 'expected rapid fishbone navigation to keep exactly one data layer');

    const cfd = new TestElement();
    (renderer as never as { renderCfd(c: TestElement, d: unknown, q: { limit?: number }): void })
        .renderCfd(cfd, makeData(35, 2), { limit: 2 });
    const cfdPrevious = cfd.findByAttribute('aria-label', 'Previous page')[0];
    cfdPrevious.dispatch('click');
    cfdPrevious.dispatch('click');
    assert(cfd.findByClass('wordflow-cfd').length === 1, 'expected rapid CFD paging to keep exactly one data layer');

    const source = readFileSync('src/EmbeddedViews/renderer.ts', 'utf8');
    const transitionSource = source.match(/private replaceSlidingPage[\s\S]*?private setSlideDistance/)?.[0] || '';
    assert(!/cloneNode|outgoing/.test(transitionSource), 'expected chart transitions not to clone a second rendered page');
});

check('fishbone axis stays singular and fixed at the full-range vertical boundary', () => {
    const data = makeData(8, 20);
    data.days.slice(1).forEach(day => { day.entries = day.entries.slice(0, 1); });
    const container = new TestElement();
    (renderer as never as { renderFishbone(c: TestElement, d: unknown, q: { periodText?: string; limit?: number }): void })
        .renderFishbone(container, data, { periodText: 'Past 30 days', limit: 20 });
    const initialAxes = container.findByClass('wordflow-fishbone-axis');
    assert(initialAxes.length === 1, 'expected one fishbone axis before navigation');
    const initialY = (initialAxes[0].getAttribute('d') || '').match(/^M 12 ([-\d.]+) H/)?.[1];

    container.findByAttribute('aria-label', 'Previous day')[0].dispatch('click');
    const shiftedAxes = container.findByClass('wordflow-fishbone-axis');
    assert(shiftedAxes.length === 1, 'expected the fixed axis not to be cloned into sliding pages');
    const shiftedY = (shiftedAxes[0].getAttribute('d') || '').match(/^M 12 ([-\d.]+) H/)?.[1];
    assert(Boolean(initialY) && shiftedY === initialY, 'expected the axis to keep the full-range up/down boundary without vertical jitter');
});

check('weekly trend ticks label every Monday, including the current incomplete week', () => {
    const container = new TestElement();
    (renderer as never as { renderNoteTrend(c: TestElement, d: unknown, q: { file: string; periodText?: string }): void })
        .renderNoteTrend(container, makeData(84, 1, Date.UTC(2026, 0, 4)), { file: 'Note 0.md', periodText: 'Past 12 weeks' });
    const ticks = container.findByClass('wordflow-trend-x-label');
    assert(ticks.length === 12, 'expected every Monday from W02 through the current W13');
    assert(ticks[0].textContent === 'W02' && ticks[ticks.length - 1].textContent === 'W13', 'expected the non-Monday range start omitted and current-week Monday included');
    const positions = ticks.map(tick => Number(tick.getAttribute('x')));
    const gaps = positions.slice(1).map((position, index) => position - positions[index]);
    assert(Math.max(...gaps) - Math.min(...gaps) < 0.01, 'expected every W label to be exactly seven days apart');
    const finalGap = 218 - positions[positions.length - 1];
    assert(Math.abs(finalGap / gaps[0] - 5 / 7) < 0.01, 'expected current-week Monday to sit five days before Saturday today');

    const mondayStart = new TestElement();
    (renderer as never as { renderNoteTrend(c: TestElement, d: unknown, q: { file: string; periodText?: string }): void })
        .renderNoteTrend(mondayStart, makeData(30, 1, Date.UTC(2026, 0, 5)), { file: 'Note 0.md', periodText: 'Past 30 days' });
    const mondayTicks = mondayStart.findByClass('wordflow-trend-x-label');
    assert(mondayTicks[0].textContent === 'W02' && mondayTicks[0].getAttribute('x') === '18', 'expected a range starting on Monday to label its first point');
});
if (failures.length) { console.error(`\n${failures.length} regression check(s) failed.`); process.exitCode = 1; }
