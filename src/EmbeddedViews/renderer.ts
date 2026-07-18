import { Notice, setIcon, setTooltip, moment } from 'obsidian';
import type WordflowTrackerPlugin from '../main';
import type { DailyBucket, WordflowEntry, WordflowGroup, WordflowViewData } from './data';
import { WordflowDataSource, isTimeField } from './data';
import type { WordflowDateRange, WordflowMode, WordflowViewQuery } from './query';
import { resolveDateRange, STANDARD_PERIODS } from './query';
import { getNiceIntegerScale, type IntegerScale } from './trendScale';
import { buildVisibleProjection } from './projection';

interface RenderState {
    field: string;
    mode: WordflowMode;
    periodText: string;
    customStart: string;
    customEnd: string;
}

interface FishboneLayout {
    stageWidth: number;
    stageHeight: number;
    axisY: number;
    angleRadians: number;
    horizontalTailLength: number;
    leftMargin: number;
    rightPadding: number;
    branchHorizontalSpan: number;
    firstBranchVerticalOffset: number;
    branchVerticalStep: number;
}

const TREND_PLOT_LEFT = 18;
const TREND_PLOT_RIGHT = 218;
const TREND_PLOT_TOP = 6;
const TREND_PLOT_BOTTOM = 64;
const FISHBONE_VISIBLE_GROUP_LIMIT = 8;

export class WordflowEmbeddedViewRenderer {
    private dataSource: WordflowDataSource;

    constructor(private plugin: WordflowTrackerPlugin) {
        this.dataSource = new WordflowDataSource(plugin);
    }

    public render(container: HTMLElement, query: WordflowViewQuery): void {
        container.empty();
        container.addClass('wordflow-embedded-view');

        const recorderResolution = this.dataSource.resolveRecorder(query);
        const recorder = recorderResolution.recorder;
        if (!recorder) {
            this.renderRecorderError(container, recorderResolution.error || 'No periodic table/list recorder available.', recorderResolution.availableRecorderNames);
            return;
        }

        const fieldOptions = this.dataSource.getFieldOptions(recorder);
        const initialField = query.field && fieldOptions.includes(query.field) ? query.field : (fieldOptions[0] || 'readEditTime');
        const initialPeriod = query.periodText || 'Past 7 days';
        const initialRange = resolveDateRange(initialPeriod);
        const state: RenderState = {
            field: initialField,
            mode: query.mode || (query.view === 'LEADERBOARD' || query.view === 'CFD' ? 'note' : 'tag'),
            periodText: initialRange.label,
            customStart: initialRange.start.format('YYYY-MM-DD'),
            customEnd: initialRange.end.format('YYYY-MM-DD'),
        };

        const shell = container.createDiv({ cls: 'wordflow-view-shell' });
        const header = shell.createDiv({ cls: 'wordflow-view-header' });
        const titleWrap = header.createDiv({ cls: 'wordflow-view-title-wrap' });
        titleWrap.createEl('h3', { text: query.title || getViewTitle(query) });
        titleWrap.createDiv({ cls: 'wordflow-view-subtitle', text: `${this.dataSource.getRecorderLabel(recorder)} · ${query.view}` });

        const controls = header.createDiv({ cls: 'wordflow-view-controls' });
        const content = shell.createDiv({ cls: 'wordflow-view-content' });

        this.renderControls(controls, query, fieldOptions, state, () => {
            void draw();
        });

        const draw = async () => {
            content.empty();
            const range = resolveDateRange(state.periodText, state.customStart, state.customEnd);
            const data = await this.dataSource.collect(query, range, state.field, state.mode);

            if (!data) {
                content.createDiv({ cls: 'wordflow-view-empty', text: 'No data.' });
                return;
            }

            switch (query.view) {
                case 'NOTE TREND':
                    this.renderNoteTrend(content, data, query);
                    break;
                case 'FISHBONE':
                    this.renderFishbone(content, data, query);
                    break;
                case 'WEEKDAY PROFILE':
                    this.renderWeekdayProfile(content, data);
                    break;
                case 'LEADERBOARD':
                    this.renderLeaderboard(content, data, query);
                    break;
                case 'CFD':
                    this.renderCfd(content, data, query);
                    break;
                case 'SUMMARY':
                default:
                    this.renderSummary(content, data, query);
                    break;
            }
        };

        void draw();
    }

    public async copyViewAsPng(shell: HTMLElement): Promise<void> {
        try {
            const blob = await this.renderElementToPng(shell);
            const clipboard = navigator.clipboard as Clipboard & {
                write?: (items: ClipboardItem[]) => Promise<void>;
            };
            const ClipboardItemCtor = window.ClipboardItem;
            if (!clipboard.write || !ClipboardItemCtor) {
                throw new Error('Image clipboard API is not available.');
            }
            await clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
            new Notice('PNG image copied to clipboard');
        } catch (error) {
            console.error('[Wordflow Tracker] Failed to copy embedded view as PNG:', error);
            new Notice('Failed to copy PNG image to clipboard');
        }
    }

    private async renderElementToPng(sourceEl: HTMLElement): Promise<Blob> {
        const rect = sourceEl.getBoundingClientRect();
        const width = Math.max(1, Math.ceil(rect.width));
        const height = Math.max(1, Math.ceil(rect.height));
        const clone = sourceEl.cloneNode(true) as HTMLElement;

        clone.querySelectorAll('.wordflow-view-controls').forEach(el => el.remove());
        clone.querySelectorAll('.tooltip, .menu').forEach(el => el.remove());
        clone.style.width = `${width}px`;
        clone.style.minHeight = `${height}px`;
        clone.style.margin = '0';
        clone.style.boxSizing = 'border-box';
        this.inlineComputedStyles(sourceEl, clone);
        this.prepareCloneForPng(clone);

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<foreignObject width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml">
<style>${this.collectSerializableCss()}</style>
${clone.outerHTML}
</div>
</foreignObject>
</svg>`;

        const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        const image = await loadImage(imageUrl);
        const canvas = document.createElement('canvas');
        const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create canvas context.');
        ctx.scale(pixelRatio, pixelRatio);
        ctx.fillStyle = getComputedStyle(sourceEl).backgroundColor || getComputedStyle(document.body).backgroundColor || '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(result => {
                if (result) resolve(result);
                else reject(new Error('Could not encode PNG.'));
            }, 'image/png');
        });

        URL.revokeObjectURL(imageUrl);
        return blob;
    }

    private inlineComputedStyles(source: Element, clone: Element): void {
        const computed = getComputedStyle(source);
        const style: string[] = [];
        for (let i = 0; i < computed.length; i++) {
            const property = computed.item(i);
            const value = computed.getPropertyValue(property);
            if (!value) continue;
            style.push(`${property}:${value};`);
        }

        const existingStyle = clone.getAttribute('style') || '';
        clone.setAttribute('style', `${existingStyle};${style.join('')}`);

        const sourceChildren = Array.from(source.children);
        const cloneChildren = Array.from(clone.children);
        for (let i = 0; i < sourceChildren.length; i++) {
            const sourceChild = sourceChildren[i];
            const cloneChild = cloneChildren[i];
            if (!sourceChild || !cloneChild) continue;
            this.inlineComputedStyles(sourceChild, cloneChild);
        }
    }

    private prepareCloneForPng(clone: HTMLElement): void {
        clone.querySelectorAll<HTMLElement>('.wordflow-view-controls').forEach(el => el.remove());

        clone.querySelectorAll<HTMLElement>('.wordflow-summary-kpi, .wordflow-chart-card, .wordflow-view-empty').forEach(el => {
            el.style.backgroundColor = normalizeCanvasColor(el.style.backgroundColor, '#ffffff');
            el.style.borderColor = normalizeCanvasColor(el.style.borderColor, '#d6dbe3');
        });

        clone.querySelectorAll<HTMLElement>('.wordflow-summary-bar, .wordflow-leaderboard-fill, .wordflow-cfd-segment').forEach(el => {
            el.style.backgroundColor = normalizeCanvasColor(el.style.backgroundColor, '#8b5cf6');
        });

        clone.querySelectorAll<HTMLElement>('.wordflow-donut').forEach(el => {
            const background = el.style.background || getComputedStyle(el).background;
            if (background) el.style.background = background;
        });
        clone.querySelectorAll<HTMLElement>('.wordflow-donut-hole').forEach(el => {
            el.style.backgroundColor = normalizeCanvasColor(el.style.backgroundColor, '#ffffff');
            el.style.borderColor = normalizeCanvasColor(el.style.borderColor, '#d6dbe3');
        });

        clone.querySelectorAll<SVGElement>('svg, path, circle').forEach(el => {
            const computed = getComputedStyle(el);
            if (computed.stroke && computed.stroke !== 'none') el.setAttribute('stroke', normalizeCanvasColor(computed.stroke, computed.stroke));
            if (computed.fill && computed.fill !== 'none') el.setAttribute('fill', normalizeCanvasColor(computed.fill, computed.fill));
            if (computed.strokeWidth) el.setAttribute('stroke-width', computed.strokeWidth);
        });
    }

    private collectSerializableCss(): string {
        const computed = getComputedStyle(document.body);
        const cssVars: string[] = [];
        for (let i = 0; i < computed.length; i++) {
            const key = computed.item(i);
            if (key.startsWith('--')) {
                cssVars.push(`${key}:${computed.getPropertyValue(key)};`);
            }
        }

        const css: string[] = [
            `:root{${cssVars.join('')}}`,
            'body{margin:0;background:transparent;color:var(--text-normal);font-family:var(--font-interface);}',
            '.wordflow-view-shell{box-shadow:none !important;}',
        ];

        for (const sheet of Array.from(document.styleSheets)) {
            try {
                for (const rule of Array.from(sheet.cssRules)) {
                    const text = rule.cssText;
                    if (text.includes('wordflow-') || text.includes(':root') || text.includes('body')) {
                        css.push(text);
                    }
                }
            } catch {
                // Cross-origin stylesheets cannot be read. The plugin stylesheet is same-origin.
            }
        }

        return css.join('\n');
    }

    private renderRecorderError(container: HTMLElement, message: string, availableRecorderNames: string[]): void {
        const error = container.createDiv({ cls: 'wordflow-view-empty' });
        error.createDiv({ text: message });
        if (availableRecorderNames.length > 0) {
            error.createDiv({ cls: 'wordflow-view-error-hint', text: `Available recorders: ${availableRecorderNames.map(name => `"${name}"`).join(', ')}` });
        }
    }

    private renderControls(container: HTMLElement, query: WordflowViewQuery, fieldOptions: string[], state: RenderState, onChange: () => void): void {
        const fieldSelect = container.createEl('select', { cls: 'wordflow-view-select' });
        for (const field of fieldOptions) {
            fieldSelect.createEl('option', { value: field, text: field });
        }
        fieldSelect.value = state.field;
        fieldSelect.addEventListener('change', () => {
            state.field = fieldSelect.value;
            onChange();
        });

        if (supportsMode(query)) {
            const modeSelect = container.createEl('select', { cls: 'wordflow-view-select' });
            modeSelect.createEl('option', { value: 'note', text: 'Note mode' });
            modeSelect.createEl('option', { value: 'tag', text: 'Tag group mode' });
            modeSelect.value = state.mode;
            modeSelect.addEventListener('change', () => {
                state.mode = modeSelect.value as WordflowMode;
                onChange();
            });
        }

        const periodSelect = container.createEl('select', { cls: 'wordflow-view-select' });
        const currentOptions = new Set<string>(STANDARD_PERIODS);
        currentOptions.add(state.periodText);
        for (const period of currentOptions) {
            periodSelect.createEl('option', { value: period, text: period });
        }
        periodSelect.value = currentOptions.has(state.periodText) ? state.periodText : 'Custom range';

        const startInput = container.createEl('input', { cls: 'wordflow-view-date-input', type: 'date' });
        const endInput = container.createEl('input', { cls: 'wordflow-view-date-input', type: 'date' });
        startInput.value = state.customStart;
        endInput.value = state.customEnd;

        const syncCustomVisibility = () => {
            const showCustom = periodSelect.value === 'Custom range';
            startInput.toggleClass('is-hidden', !showCustom);
            endInput.toggleClass('is-hidden', !showCustom);
        };

        periodSelect.addEventListener('change', () => {
            state.periodText = periodSelect.value;
            syncCustomVisibility();
            onChange();
        });
        startInput.addEventListener('change', () => {
            state.customStart = startInput.value;
            state.periodText = 'Custom range';
            periodSelect.value = 'Custom range';
            syncCustomVisibility();
            onChange();
        });
        endInput.addEventListener('change', () => {
            state.customEnd = endInput.value;
            state.periodText = 'Custom range';
            periodSelect.value = 'Custom range';
            syncCustomVisibility();
            onChange();
        });

        syncCustomVisibility();
    }

    private renderSummary(container: HTMLElement, data: WordflowViewData, query?: WordflowViewQuery): void {
        const limit = Math.max(1, Math.floor(query?.limit ?? 6));
        const projection = buildVisibleProjection(data, limit);
        const topGroup = projection.groups[0];
        const topDay = data.days
            .map(day => ({ day, total: projection.dayTotals.get(day.dateKey) || 0 }))
            .sort((a, b) => b.total - a.total)[0];

        const kpis = container.createDiv({ cls: 'wordflow-summary-kpis' });
        this.renderKpi(kpis, 'Total', this.dataSource.formatValue(projection.total, data.field));
        this.renderKpi(kpis, 'Active notes', projection.activeFilePaths.size.toString());
        this.renderKpi(kpis, 'Top group', topGroup ? topGroup.label : 'None');
        this.renderKpi(kpis, 'Best day', topDay ? `${topDay.day.date.format('ddd')} ${this.dataSource.formatValue(topDay.total, data.field)}` : 'None');

        const grid = container.createDiv({ cls: 'wordflow-summary-grid' });
        const bars = grid.createDiv({ cls: 'wordflow-summary-bars' });
        const summaryBars = this.getCompactTimelineBuckets(data, projection.dayTotals);
        const max = Math.max(1, ...summaryBars.map(bucket => bucket.value));
        for (const bucket of summaryBars) {
            const bar = bars.createDiv({ cls: 'wordflow-summary-bar' });
            bar.style.height = `${Math.max(4, bucket.value / max * 100)}%`;
            bar.style.backgroundColor = bucket.value > 0 ? 'var(--interactive-accent)' : 'var(--background-modifier-hover)';
            setTooltip(bar, `${bucket.tooltip}: ${this.dataSource.formatValue(bucket.value, data.field)}`, { placement: 'top', delay: 200 });
            bar.createEl('strong', { text: this.dataSource.formatValue(bucket.value, data.field) });
            bar.createSpan({ text: bucket.label });
        }

        const donutWrap = grid.createDiv({ cls: 'wordflow-summary-donut-wrap' });
        this.renderDonut(donutWrap, projection.groups, projection.total, data.field);
    }

    private getCompactTimelineBuckets(
        data: WordflowViewData,
        dayTotals: Map<string, number>
    ): { label: string; value: number; tooltip: string }[] {
        if (data.days.length <= 14) {
            return data.days.map(day => ({
                label: day.date.format('dd'),
                value: dayTotals.get(day.dateKey) || 0,
                tooltip: day.date.format('YYYY-MM-DD'),
            }));
        }

        const weekdayBuckets = [1, 2, 3, 4, 5, 6, 7].map(isoDay => {
            const matchingDays = data.days.filter(day => day.date.isoWeekday() === isoDay);
            const value = matchingDays.reduce(
                (sum, day) => sum + (dayTotals.get(day.dateKey) || 0),
                0
            );
            return {
                label: moment().isoWeekday(isoDay).format('ddd'),
                value,
                tooltip: `${moment().isoWeekday(isoDay).format('dddd')} total`,
            };
        });

        return weekdayBuckets;
    }
    private renderNoteTrend(container: HTMLElement, data: WordflowViewData, query: WordflowViewQuery): void {
        const selectedFile = data.selectedFilePath || data.entries[0]?.filePath;
        if (!selectedFile) {
            container.createDiv({ cls: 'wordflow-view-empty', text: 'No note data for this period.' });
            return;
        }

        const points: { day: DailyBucket; value: number; dailyValue: number }[] = [];
        let stockValue = 0;
        const shouldAccumulate = this.shouldAccumulateTrendField(data.field);
        for (const day of data.days) {
            const dailyValue = day.entries
                .filter(entry => entry.filePath === selectedFile)
                .reduce((sum, entry) => sum + entry.value, 0);
            if (dailyValue > 0) {
                stockValue = shouldAccumulate ? stockValue + dailyValue : dailyValue;
            }
            points.push({ day, value: stockValue, dailyValue });
        }

        const card = container.createDiv({ cls: 'wordflow-chart-card wordflow-note-trend-card' });
        const noteName = query.file || data.entries.find(entry => entry.filePath === selectedFile)?.fileName || selectedFile;
        const heading = card.createDiv({ cls: 'wordflow-trend-heading' });
        this.renderInlineLegend(heading, [{
            label: noteName + ' ' + String.fromCharCode(183) + ' ' + data.field,
            color: 'var(--interactive-accent)'
        }]);

        const svg = this.createSvg(card, '0 0 220 74', 'wordflow-line-chart');
        const scale = getNiceIntegerScale(points.map(point => point.value));
        this.renderTrendGrid(svg, scale, data.field);
        this.renderTrendXAxis(svg, points, data.range?.label || query.periodText || '');
        this.svgPath(svg, this.buildLinearPath(points, scale), 'wordflow-stock-line');

        this.renderTrendStats(card, points, data.field);
    }
    private renderFishbone(container: HTMLElement, data: WordflowViewData, query: WordflowViewQuery): void {
        const wrap = container.createDiv({ cls: 'wordflow-fishbone' });
        const allDays = data.days;
        if (allDays.length === 0) {
            wrap.createDiv({ cls: 'wordflow-view-empty', text: 'No flow data for this period.' });
            return;
        }

        const visibleDayCount = Math.min(7, allDays.length);
        let windowStart = Math.max(0, allDays.length - visibleDayCount);
        const nav = wrap.createDiv({ cls: 'wordflow-cfd-nav wordflow-fishbone-nav' });
        const rangeLabel = nav.createSpan({ cls: 'wordflow-cfd-range wordflow-fishbone-range' });
        const stage = wrap.createDiv({ cls: 'wordflow-fishbone-stage' });
        const legendHost = wrap.createDiv({ cls: 'wordflow-fishbone-legend' });
        const limit = Math.max(1, Math.floor(query.limit ?? 20));
        const projection = buildVisibleProjection(data, limit);
        const allowedGroupKeys = new Set(projection.groups.map(group => group.key));
        const todayKey = formatLocalDate(new Date());
        const todayIndex = allDays.findIndex(day => day.date.format('YYYY-MM-DD') === todayKey);
        const directionAnchor = todayIndex >= 0 ? todayIndex : allDays.length - 1;
        const verticalDirections = new Map(allDays.map((day, index) => [
            day.dateKey,
            Math.abs(directionAnchor - index) % 2 === 0 ? -1 : 1,
        ] as const));
        const allGroupedDays = allDays.map(day =>
            this.groupDayEntriesForFishbone(day.entries, data.mode, allowedGroupKeys)
        );
        const layout = this.getFishboneLayout(
            stage,
            allGroupedDays,
            allDays,
            verticalDirections,
            visibleDayCount
        );
        stage.style.height = `${layout.stageHeight}px`;
        const axisSvg = this.createSvg(
            stage,
            `0 0 ${layout.stageWidth} ${layout.stageHeight}`,
            'wordflow-fishbone-svg'
        );
        axisSvg.addClass('wordflow-fishbone-axis-svg');
        axisSvg.setAttribute('preserveAspectRatio', 'none');
        this.svgPath(
            axisSvg,
            `M 12 ${layout.axisY} H ${layout.stageWidth - 12} M ${layout.stageWidth - 18} ${layout.axisY - 4} L ${layout.stageWidth - 12} ${layout.axisY} L ${layout.stageWidth - 18} ${layout.axisY + 4}`,
            'wordflow-fishbone-axis'
        );
        const viewport = stage.createDiv({ cls: 'wordflow-fishbone-data-viewport' });
        let shiftWindow: (delta: number, direction: 'previous' | 'next') => boolean = () => false;

        const createNavButton = (
            label: string,
            icon: string,
            delta: number,
            direction: 'previous' | 'next',
            repeats: boolean
        ): HTMLButtonElement => {
            const button = nav.createEl('button', { cls: 'wordflow-cfd-nav-button' });
            button.type = 'button';
            button.setAttribute('aria-label', label);
            button.setAttribute('data-step', Math.abs(delta).toString());
            setIcon(button, icon);
            setTooltip(button, label, { placement: 'top', delay: 200 });

            let holdTimeout: number | undefined;
            let repeatTimer: number | undefined;
            let didRepeat = false;
            const stopHold = () => {
                if (holdTimeout !== undefined) window.clearTimeout(holdTimeout);
                if (repeatTimer !== undefined) window.clearInterval(repeatTimer);
                holdTimeout = undefined;
                repeatTimer = undefined;
            };

            if (repeats) {
                button.setAttribute('data-hold-repeat', 'true');
                button.addEventListener('pointerdown', event => {
                    if (button.disabled) return;
                    event.preventDefault();
                    didRepeat = false;
                    holdTimeout = window.setTimeout(() => {
                        didRepeat = true;
                        shiftWindow(delta, direction);
                        repeatTimer = window.setInterval(() => {
                            if (!shiftWindow(delta, direction)) stopHold();
                        }, 300);
                    }, 420);
                });
                button.addEventListener('pointerup', stopHold);
                button.addEventListener('pointercancel', stopHold);
                button.addEventListener('pointerleave', stopHold);
            }

            button.addEventListener('click', event => {
                if (didRepeat) {
                    didRepeat = false;
                    event.preventDefault();
                    return;
                }
                shiftWindow(delta, direction);
            });
            return button;
        };

        const previousPage = createNavButton('Previous page', 'chevrons-left', -visibleDayCount, 'previous', false);
        const previousDay = createNavButton('Previous day', 'chevron-left', -1, 'previous', true);
        nav.appendChild(rangeLabel);
        const nextDay = createNavButton('Next day', 'chevron-right', 1, 'next', true);
        const nextPage = createNavButton('Next page', 'chevrons-right', visibleDayCount, 'next', false);

        const renderWindow = (direction?: 'previous' | 'next') => {
            legendHost.empty();
            const days = allDays.slice(windowStart, windowStart + visibleDayCount);
            const firstDay = days[0];
            const lastDay = days[days.length - 1];
            rangeLabel.textContent = firstDay.date.format('YYYY-MM-DD') + ' - ' + lastDay.date.format('YYYY-MM-DD');
            this.replaceSlidingPage(viewport, direction, () => {
                const page = viewport.createDiv({ cls: 'wordflow-fishbone-page' });
                this.renderFishbonePage(
                    page,
                    legendHost,
                    days,
                    data,
                    allowedGroupKeys,
                    verticalDirections,
                    (data.range?.label || query.periodText || '').toLowerCase() === 'this week',
                    layout
                );
                return page;
            }, 100 / visibleDayCount);

            const atStart = windowStart === 0;
            const atEnd = windowStart + visibleDayCount >= allDays.length;
            previousPage.disabled = atStart;
            previousDay.disabled = atStart;
            nextDay.disabled = atEnd;
            nextPage.disabled = atEnd;
        };

        shiftWindow = (delta, direction) => {
            const maxStart = Math.max(0, allDays.length - visibleDayCount);
            const nextStart = Math.max(0, Math.min(maxStart, windowStart + delta));
            if (nextStart === windowStart) return false;
            windowStart = nextStart;
            renderWindow(direction);
            return true;
        };

        renderWindow();
    }

    private getFishboneLayout(
        stage: HTMLElement,
        groupedDays: WordflowGroup[][],
        days: DailyBucket[],
        verticalDirections: Map<string, number>,
        visibleDayCount: number
    ): FishboneLayout {
        const firstBranchVerticalOffset = 40;
        const branchVerticalStep = 23;
        const edgePadding = 28;
        const minimumSide = 48;
        const stageWidth = Math.max(320, stage.clientWidth || Math.max(840, visibleDayCount * 120));
        const leftMargin = Math.min(30, Math.max(20, stageWidth * 0.03));
        // The arrowhead begins 18px from the stage edge. Keeping the node center
        // 75px from the edge leaves 50px between the node rim and arrowhead.
        const rightPadding = 75;
        const baseHorizontalTailLength = Math.max(56, Math.min(92, stageWidth / Math.max(3, visibleDayCount + 2) * 0.85));
        const horizontalTailLength = Math.round(baseHorizontalTailLength * 1.6);
        const maxGroupCount = Math.max(0, ...groupedDays.map(groups => groups.length));
        const maxRenderedGroupCount = getFishboneRenderedGroupCount(maxGroupCount);
        const longestBranchVerticalOffset = maxRenderedGroupCount > 0
            ? firstBranchVerticalOffset + (maxRenderedGroupCount - 1) * branchVerticalStep
            : 0;
        const adaptiveAngleDegrees = 48 + Math.min(32, Math.max(0, maxGroupCount - 1) * 4);
        const angleRadians = adaptiveAngleDegrees * Math.PI / 180;
        const longestDiagonalHorizontalRun = longestBranchVerticalOffset > 0
            ? longestBranchVerticalOffset / Math.tan(angleRadians)
            : 0;
        const branchHorizontalSpan = longestDiagonalHorizontalRun + horizontalTailLength;
        const maxAbove = Math.max(0, ...groupedDays
            .filter((_groups, index) => (verticalDirections.get(days[index].dateKey) || -1) < 0)
            .map(groups => getFishboneRenderedGroupCount(groups.length)));
        const maxBelow = Math.max(0, ...groupedDays
            .filter((_groups, index) => (verticalDirections.get(days[index].dateKey) || -1) > 0)
            .map(groups => getFishboneRenderedGroupCount(groups.length)));
        const requiredSide = (count: number) => count > 0
            ? firstBranchVerticalOffset + (count - 1) * branchVerticalStep + edgePadding
            : minimumSide;
        const topSpace = Math.max(minimumSide, requiredSide(maxAbove));
        const bottomSpace = Math.max(minimumSide, requiredSide(maxBelow));
        const stageHeight = Math.ceil(Math.max(170, topSpace + bottomSpace));
        const axisY = topSpace + Math.max(0, stageHeight - topSpace - bottomSpace) / 2;

        return {
            stageWidth,
            stageHeight,
            axisY,
            angleRadians,
            horizontalTailLength,
            leftMargin,
            rightPadding,
            branchHorizontalSpan,
            firstBranchVerticalOffset,
            branchVerticalStep,
        };
    }

    private renderFishbonePage(
        page: HTMLElement,
        legendHost: HTMLElement,
        days: DailyBucket[],
        data: WordflowViewData,
        allowedGroupKeys: Set<string>,
        verticalDirections: Map<string, number>,
        useWeekdayLabels: boolean,
        layout: FishboneLayout
    ): void {
        const groupedDays = days.map(day => this.collapseFishboneGroups(
            this.groupDayEntriesForFishbone(day.entries, data.mode, allowedGroupKeys)
        ));
        const {
            stageWidth,
            stageHeight,
            axisY,
            angleRadians,
            horizontalTailLength,
            leftMargin,
            rightPadding,
            branchHorizontalSpan,
            firstBranchVerticalOffset,
            branchVerticalStep,
        } = layout;
        page.style.height = `${stageHeight}px`;

        const svg = this.createSvg(page, `0 0 ${stageWidth} ${stageHeight}`, 'wordflow-fishbone-svg');
        svg.addClass('wordflow-fishbone-data-svg');
        svg.setAttribute('preserveAspectRatio', 'none');

        const lastNodeX = stageWidth - Math.max(30, rightPadding);
        const firstNodeX = Math.min(lastNodeX, leftMargin + branchHorizontalSpan);
        const xPositions = days.map((_day, index) => days.length === 1
            ? lastNodeX
            : firstNodeX + index / (days.length - 1) * (lastNodeX - firstNodeX));
        const legendItems: { label: string; color: string }[] = [];

        days.forEach((day, dayIndex) => {
            const x = xPositions[dayIndex];
            const node = page.createSpan({ cls: 'wordflow-fishbone-node' });
            node.style.left = `${x}px`;
            node.style.top = `${axisY}px`;
            const verticalDirection = verticalDirections.get(day.dateKey) || -1;
            const dayLabel = page.createSpan({
                cls: 'wordflow-fishbone-day',
                text: day.date.format(useWeekdayLabels ? 'ddd' : 'MM/DD')
            });
            dayLabel.style.left = `${x}px`;
            dayLabel.style.top = `${axisY + (verticalDirection < 0 ? 11 : -21)}px`;

            const groups = groupedDays[dayIndex];
            groups.forEach((group, groupIndex) => {
                const diagonalY = firstBranchVerticalOffset + groupIndex * branchVerticalStep;
                const diagonalX = diagonalY / Math.tan(angleRadians);
                const elbowX = x - diagonalX;
                const elbowY = axisY + verticalDirection * diagonalY;
                const tailEndX = elbowX - horizontalTailLength;
                const pathData = `M ${x.toFixed(2)} ${axisY.toFixed(2)} L ${elbowX.toFixed(2)} ${elbowY.toFixed(2)} H ${tailEndX.toFixed(2)}`;
                this.svgPath(svg, pathData, 'wordflow-fishbone-branch', group.color);

                const text = page.createSpan({ cls: 'wordflow-fishbone-label is-centered' });
                text.style.left = ((elbowX + tailEndX) / 2 - 6).toFixed(2) + 'px';
                text.setAttribute('data-frameless', 'true');
                text.style.top = (elbowY - 7).toFixed(2) + 'px';
                text.style.width = `${horizontalTailLength}px`;
                const formattedValue = this.dataSource.formatValue(group.value, data.field);
                text.createSpan({ cls: 'wordflow-fishbone-name', text: group.label });
                text.createSpan({ cls: 'wordflow-fishbone-value', text: formattedValue });
                text.setAttribute('aria-label', `${group.label}: ${formattedValue}`);
                setTooltip(text, `${group.label}: ${formattedValue}`);

                if (!legendItems.some(item => item.label === group.label)) {
                    legendItems.push({ label: group.label, color: group.color });
                }
            });
        });

        this.renderInlineLegend(legendHost, legendItems, legendItems.length);
    }
    private renderWeekdayProfile(container: HTMLElement, data: WordflowViewData): void {
        const buckets = [0, 1, 2, 3, 4, 5, 6].map(index => ({ index, total: 0, count: 0 }));
        for (const day of data.days) {
            const isoIndex = day.date.isoWeekday() - 1;
            buckets[isoIndex].total += day.total;
            buckets[isoIndex].count += 1;
        }

        const values = buckets.map(bucket => bucket.count ? bucket.total / bucket.count : 0);
        const max = Math.max(1, ...values);
        const grid = container.createDiv({ cls: 'wordflow-weekday-grid' });

        buckets.forEach((bucket, index) => {
            const value = values[index];
            const tile = grid.createDiv({ cls: 'wordflow-weekday-tile' });
            tile.style.height = `${Math.max(26, value / max * 100)}%`;
            tile.style.backgroundColor = getHeatColor(value / max);
            tile.createSpan({ text: moment().isoWeekday(bucket.index + 1).format('ddd') });
            tile.createEl('small', { text: this.dataSource.formatValue(Math.round(value), data.field) });
        });

        this.renderInlineLegend(container, [{ label: `Average ${data.field}`, color: 'var(--interactive-accent)' }]);
    }

    private renderLeaderboard(container: HTMLElement, data: WordflowViewData, query: WordflowViewQuery): void {
        const list = container.createDiv({ cls: 'wordflow-leaderboard' });
        const limit = Math.max(1, Math.floor(query.limit ?? 10));
        const groups = buildVisibleProjection(data, limit).groups;
        const max = Math.max(1, ...groups.map(group => group.value));

        groups.forEach((group, index) => {
            const row = list.createDiv({ cls: 'wordflow-leaderboard-row' });
            row.createSpan({ cls: 'wordflow-leaderboard-rank', text: `${index + 1}` });
            const middle = row.createDiv({ cls: 'wordflow-leaderboard-middle' });
            middle.createDiv({ cls: 'wordflow-leaderboard-name', text: group.label });
            const track = middle.createDiv({ cls: 'wordflow-leaderboard-track' });
            const fill = track.createDiv({ cls: 'wordflow-leaderboard-fill' });
            fill.style.width = `${group.value / max * 100}%`;
            fill.style.backgroundColor = group.color;
            row.createSpan({ cls: 'wordflow-leaderboard-value', text: this.dataSource.formatValue(Math.round(group.value), data.field) });
        });
    }

    private renderCfd(container: HTMLElement, data: WordflowViewData, query: WordflowViewQuery): void {
        const limit = Math.max(1, Math.floor(query.limit ?? 5));
        const projection = buildVisibleProjection(data, limit);
        const groups = projection.groups;
        const allDays = data.days;
        if (allDays.length === 0) {
            container.createDiv({ cls: 'wordflow-view-empty', text: 'No flow data for this period.' });
            return;
        }

        const visibleDayCount = allDays.length <= 7 ? 7 : 14;
        let windowStart = Math.max(0, allDays.length - visibleDayCount);
        const shell = container.createDiv({ cls: 'wordflow-cfd-shell' });
        const nav = shell.createDiv({ cls: 'wordflow-cfd-nav' });
        const rangeLabel = nav.createSpan({ cls: 'wordflow-cfd-range' });
        const viewport = shell.createDiv({ cls: 'wordflow-cfd-viewport' });
        const legendHost = shell.createDiv({ cls: 'wordflow-cfd-legend' });
        let shiftWindow: (delta: number, direction: 'previous' | 'next') => boolean = () => false;

        const createNavButton = (
            label: string,
            icon: string,
            delta: number,
            direction: 'previous' | 'next',
            repeats: boolean
        ): HTMLButtonElement => {
            const button = nav.createEl('button', { cls: 'wordflow-cfd-nav-button' });
            button.type = 'button';
            button.setAttribute('aria-label', label);
            button.setAttribute('data-step', Math.abs(delta).toString());
            setIcon(button, icon);
            setTooltip(button, label, { placement: 'top', delay: 200 });

            let holdTimeout: number | undefined;
            let repeatTimer: number | undefined;
            let didRepeat = false;
            const stopHold = () => {
                if (holdTimeout !== undefined) window.clearTimeout(holdTimeout);
                if (repeatTimer !== undefined) window.clearInterval(repeatTimer);
                holdTimeout = undefined;
                repeatTimer = undefined;
            };

            if (repeats) {
                button.setAttribute('data-hold-repeat', 'true');
                button.addEventListener('pointerdown', event => {
                    if (button.disabled) return;
                    event.preventDefault();
                    didRepeat = false;
                    holdTimeout = window.setTimeout(() => {
                        didRepeat = true;
                        shiftWindow(delta, direction);
                        repeatTimer = window.setInterval(() => {
                            if (!shiftWindow(delta, direction)) stopHold();
                        }, 300);
                    }, 420);
                });
                button.addEventListener('pointerup', stopHold);
                button.addEventListener('pointercancel', stopHold);
                button.addEventListener('pointerleave', stopHold);
            }

            button.addEventListener('click', event => {
                if (didRepeat) {
                    didRepeat = false;
                    event.preventDefault();
                    return;
                }
                shiftWindow(delta, direction);
            });
            return button;
        };

        const previousPage = createNavButton('Previous page', 'chevrons-left', -visibleDayCount, 'previous', false);
        const previousDay = createNavButton('Previous day', 'chevron-left', -1, 'previous', true);
        nav.appendChild(rangeLabel);
        const nextDay = createNavButton('Next day', 'chevron-right', 1, 'next', true);
        const nextPage = createNavButton('Next page', 'chevrons-right', visibleDayCount, 'next', false);


        const renderWindow = (direction?: 'previous' | 'next') => {
            legendHost.empty();
            const visibleDays = allDays.slice(windowStart, windowStart + visibleDayCount);
            const firstDay = visibleDays[0];
            const lastDay = visibleDays[visibleDays.length - 1];
            rangeLabel.textContent = firstDay.date.format('YYYY-MM-DD') + ' – ' + lastDay.date.format('YYYY-MM-DD');

            this.replaceSlidingPage(viewport, direction, () => {
                const grid = viewport.createDiv({ cls: 'wordflow-cfd' });
                grid.style.gridTemplateColumns = 'repeat(' + visibleDays.length + ', minmax(18px, 1fr))';
                grid.createDiv({ cls: 'wordflow-cfd-gridlines' });
                const plotHeight = 160;
                const maxTotal = Math.max(1, ...visibleDays.map(day =>
                    projection.dayTotals.get(day.dateKey) || 0
                ));

                for (const day of visibleDays) {
                    const dayTotal = projection.dayTotals.get(day.dateKey) || 0;
                    const col = grid.createDiv({ cls: 'wordflow-cfd-col' });
                    const columnHeight = Math.max(4, dayTotal / maxTotal * plotHeight);
                    col.style.height = columnHeight + 'px';
                    groups.forEach(group => {
                        const value = projection.groupDayValues.get(group.key)?.get(day.dateKey) || 0;
                        if (value <= 0) return;
                        const seg = col.createDiv({ cls: 'wordflow-cfd-segment' });
                        seg.style.height = (value / Math.max(1, dayTotal) * 100) + '%';
                        seg.style.backgroundColor = group.color;
                    });
                    col.createSpan({ cls: 'wordflow-cfd-total', text: this.dataSource.formatValue(dayTotal, data.field) });
                    col.createSpan({
                        cls: 'wordflow-cfd-day',
                        text: day.date.format(visibleDayCount <= 7 ? 'ddd' : 'MM-DD')
                    });
                }
                return grid;
            }, 100 / visibleDays.length);

            const visibleGroups = groups.map(group => ({
                label: group.label,
                color: group.color,
                value: visibleDays.reduce(
                    (sum, day) => sum + (
                        projection.groupDayValues.get(group.key)?.get(day.dateKey) || 0
                    ),
                    0
                )
            }));
            this.renderInlineLegend(legendHost, visibleGroups.map(group => ({
                label: group.label,
                value: this.dataSource.formatValue(Math.round(group.value), data.field),
                color: group.color
            })), limit);

            const atStart = windowStart === 0;
            const atEnd = windowStart + visibleDayCount >= allDays.length;
            previousPage.disabled = atStart;
            previousDay.disabled = atStart;
            nextDay.disabled = atEnd;
            nextPage.disabled = atEnd;
        };

        shiftWindow = (delta, direction) => {
            const maxStart = Math.max(0, allDays.length - visibleDayCount);
            const nextStart = Math.max(0, Math.min(maxStart, windowStart + delta));
            if (nextStart === windowStart) return false;
            windowStart = nextStart;
            renderWindow(direction);
            return true;
        };

        renderWindow();
    }
    private renderKpi(container: HTMLElement, label: string, value: string): void {
        const kpi = container.createDiv({ cls: 'wordflow-summary-kpi' });
        kpi.createSpan({ text: label });
        kpi.createEl('strong', { text: value });
    }

    private renderDonut(container: HTMLElement, groups: WordflowGroup[], total: number, field: string): void {
        const donut = container.createDiv({ cls: 'wordflow-donut' });
        let cursor = 0;
        const stops: string[] = [];
        for (const group of groups) {
            const start = total > 0 ? cursor / total * 100 : 0;
            cursor += group.value;
            const end = total > 0 ? cursor / total * 100 : 0;
            stops.push(`${group.color} ${start}% ${end}%`);
        }
        donut.style.background = stops.length ? `conic-gradient(${stops.join(', ')})` : 'var(--background-modifier-hover)';
        const hole = donut.createDiv({ cls: 'wordflow-donut-hole' });
        hole.createSpan({ text: this.dataSource.formatValue(total, field) });
        this.renderInlineLegend(container, groups.map(group => ({
            label: group.label,
            value: this.dataSource.formatValue(Math.round(group.value), field),
            color: group.color
        })), groups.length);
    }

    private renderTrendStats(container: HTMLElement, points: { day: DailyBucket; value: number; dailyValue: number }[], field: string): void {
        if (points.length === 0) return;
        const first = points[0];
        const latest = points[points.length - 1];
        const activeDays = points.filter(point => point.dailyValue > 0).length;
        const changed = latest.value - first.value;
        const stats = container.createDiv({ cls: 'wordflow-trend-stats' });
        this.renderTrendStat(stats, 'Start', this.dataSource.formatValue(first.value, field));
        this.renderTrendStat(stats, 'Latest', this.dataSource.formatValue(latest.value, field));
        this.renderTrendStat(stats, 'Change', this.dataSource.formatValue(changed, field));
        this.renderTrendStat(stats, 'Active days', activeDays.toString());
    }

    private renderTrendStat(container: HTMLElement, label: string, value: string): void {
        const item = container.createDiv({ cls: 'wordflow-trend-stat' });
        item.createSpan({ text: label });
        item.createEl('strong', { text: value });
    }

    private renderTrendGrid(svg: SVGSVGElement, scale: IntegerScale, field: string): void {
        const range = Math.max(1, scale.max - scale.min);
        for (const tick of scale.ticks) {
            const y = TREND_PLOT_BOTTOM - (tick - scale.min) / range * (TREND_PLOT_BOTTOM - TREND_PLOT_TOP);
            const line = this.svgPath(svg, `M ${TREND_PLOT_LEFT} ${y.toFixed(2)} H ${TREND_PLOT_RIGHT}`, 'wordflow-trend-grid-line');
            line.setAttribute('aria-hidden', 'true');
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', '0');
            label.setAttribute('y', (y + 1.2).toFixed(2));
            label.setAttribute('text-anchor', 'start');
            label.addClass('wordflow-trend-y-label');
            label.textContent = this.dataSource.formatValue(Math.round(tick), field);
            svg.appendChild(label);
        }
    }

    private renderTrendXAxis(svg: SVGSVGElement, points: { day: DailyBucket; value: number }[], periodLabel: string): void {
        const unitScale = { min: 0, max: 1, step: 1, ticks: [0, 1] };
        for (const tick of this.getTrendTicks(points, periodLabel)) {
            const { x } = this.getTrendPointPosition(tick.index, points.length, 0, unitScale);
            this.svgPath(svg, 'M ' + x + ' 64 V 66', 'wordflow-trend-grid-line').setAttribute('aria-hidden', 'true');
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x.toString());
            label.setAttribute('y', '71');
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('data-granularity', tick.granularity);
            label.setAttribute('aria-label', tick.fullDate);
            label.addClass('wordflow-trend-x-label');
            label.textContent = tick.label;
            svg.appendChild(label);
        }
    }

    private getTrendTicks(points: { day: DailyBucket }[], periodLabel: string): { index: number; label: string; fullDate: string; granularity: 'day' | 'week' | 'month' | 'year' }[] {
        if (points.length === 0) return [];
        if (periodLabel.toLowerCase() === 'this week') {
            return points.map((point, index) => ({
                index,
                label: point.day.date.format('ddd'),
                fullDate: point.day.date.format('YYYY-MM-DD'),
                granularity: 'day',
            }));
        }

        const spanDays = Math.max(0, points[points.length - 1].day.date.diff(points[0].day.date, 'days'));
        const granularity: 'day' | 'week' | 'month' | 'year' = spanDays <= 21
            ? 'day'
            : spanDays <= 120
                ? 'week'
                : spanDays <= 730
                    ? 'month'
                    : 'year';
        const candidates: { index: number; label: string; fullDate: string; granularity: 'day' | 'week' | 'month' | 'year' }[] = [];

        if (granularity === 'week') {
            points.forEach((point, index) => {
                const date = point.day.date;
                if (date.isoWeekday() !== 1) return;
                candidates.push({
                    index,
                    label: `W${date.isoWeek().toString().padStart(2, '0')}`,
                    fullDate: date.format('YYYY-MM-DD'),
                    granularity,
                });
            });
            return candidates;
        }

        let previousKey = '';

        points.forEach((point, index) => {
            const date = point.day.date;
            const key = granularity === 'day'
                ? date.format('YYYY-MM-DD')
                : granularity === 'month'
                    ? date.format('YYYY-MM')
                    : date.format('YYYY');
            if (key === previousKey) return;
            previousKey = key;
            const label = granularity === 'day'
                ? date.format('MM-DD')
                : granularity === 'month'
                    ? date.format('YYYY-MM')
                    : date.format('YYYY');
            candidates.push({ index, label, fullDate: date.format('YYYY-MM-DD'), granularity });
        });

        const lastIndex = points.length - 1;
        if (candidates[candidates.length - 1]?.index !== lastIndex) {
            const date = points[lastIndex].day.date;
            const label = granularity === 'day'
                ? date.format('MM-DD')
                : granularity === 'month'
                    ? date.format('YYYY-MM')
                    : date.format('YYYY');
            candidates.push({ index: lastIndex, label, fullDate: date.format('YYYY-MM-DD'), granularity });
        }

        return granularity === 'day' ? candidates : this.sampleTrendTicks(candidates);
    }

    private sampleTrendTicks<T extends { index: number }>(candidates: T[]): T[] {
        if (candidates.length <= 8) return candidates;
        const sampled = Array.from({ length: 8 }, (_item, index) => candidates[Math.round(index * (candidates.length - 1) / 7)]);
        return sampled.filter((tick, index) => index === 0 || tick.index !== sampled[index - 1].index);
    }

    private buildLinearPath(points: { value: number }[], scale: IntegerScale): string {
        if (points.length === 0) return '';
        const first = this.getTrendPointPosition(0, points.length, points[0].value, scale);
        const commands = ['M ' + first.x.toFixed(2) + ' ' + first.y.toFixed(2)];
        for (let index = 1; index < points.length; index++) {
            const current = this.getTrendPointPosition(index, points.length, points[index].value, scale);
            commands.push('L ' + current.x.toFixed(2) + ' ' + current.y.toFixed(2));
        }
        return commands.join(' ');
    }

    private getTrendPointPosition(index: number, count: number, value: number, scale: IntegerScale): { x: number; y: number } {
        const x = count === 1
            ? (TREND_PLOT_LEFT + TREND_PLOT_RIGHT) / 2
            : index / (count - 1) * (TREND_PLOT_RIGHT - TREND_PLOT_LEFT) + TREND_PLOT_LEFT;
        const ratio = (value - scale.min) / Math.max(1, scale.max - scale.min);
        const y = TREND_PLOT_BOTTOM - Math.max(0, Math.min(1, ratio)) * (TREND_PLOT_BOTTOM - TREND_PLOT_TOP);
        return { x, y };
    }

    private replaceSlidingPage(
        viewport: HTMLElement,
        direction: 'previous' | 'next' | undefined,
        renderPage: () => HTMLElement,
        distancePercent: number
    ): HTMLElement {
        viewport.empty();
        const incoming = renderPage();
        if (!direction) return incoming;

        incoming.addClass('wordflow-slide-page', 'is-incoming');
        incoming.setAttribute('data-shift-direction', direction);
        this.setSlideDistance(incoming, distancePercent);

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            incoming.classList?.remove('wordflow-slide-page', 'is-incoming');
            incoming.removeAttribute?.('data-shift-direction');
        };
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            cleanup();
            return incoming;
        }
        incoming.addEventListener('animationend', cleanup, { once: true });
        window.setTimeout(cleanup, 240);
        return incoming;
    }

    private setSlideDistance(element: HTMLElement, distancePercent: number): void {
        const value = `${Math.max(1, Math.min(25, distancePercent))}%`;
        if (typeof element.style.setProperty === 'function') {
            element.style.setProperty('--wordflow-slide-distance', value);
        } else {
            (element.style as unknown as Record<string, string>)['--wordflow-slide-distance'] = value;
        }
    }

    private shouldAccumulateTrendField(field: string): boolean {
        const normalized = field.toLowerCase();
        return !normalized.includes('total')
            && !normalized.includes('history')
            && !normalized.includes('docword')
            && normalized !== 'words'
            && normalized !== 'wordcount';
    }


    private renderInlineLegend(container: HTMLElement, items: { label: string; color: string; value?: string }[], maxItems = 6): void {
        if (items.length === 0) return;
        const legend = container.createDiv({ cls: 'wordflow-view-legend' });
        for (const item of items.slice(0, maxItems)) {
            const entry = legend.createSpan({ cls: 'wordflow-view-legend-item' });
            const dot = entry.createSpan({ cls: 'wordflow-view-legend-dot' });
            dot.style.backgroundColor = item.color;
            const label = entry.createSpan({ cls: 'wordflow-view-legend-label', text: item.label });
            label.setAttribute('title', item.label);
            if (item.value) entry.createSpan({ cls: 'wordflow-view-legend-value', text: item.value });
        }
    }

    private collapseFishboneGroups(groups: WordflowGroup[]): WordflowGroup[] {
        if (groups.length <= FISHBONE_VISIBLE_GROUP_LIMIT) return groups;

        const omittedGroups = groups.slice(FISHBONE_VISIBLE_GROUP_LIMIT);
        return [
            ...groups.slice(0, FISHBONE_VISIBLE_GROUP_LIMIT),
            {
                key: 'fishbone:others',
                label: 'Others',
                value: omittedGroups.reduce((sum, group) => sum + group.value, 0),
                color: 'var(--text-muted)',
                entries: omittedGroups.flatMap(group => group.entries),
            },
        ];
    }

    private groupDayEntriesForFishbone(
        entries: WordflowEntry[],
        mode: WordflowMode,
        allowedGroupKeys: Set<string>
    ): WordflowGroup[] {
        const groups = new Map<string, WordflowGroup>();
        for (const entry of entries) {
            const memberships = mode === 'note'
                ? [{ key: entry.filePath, label: entry.fileName, color: entry.color }]
                : entry.tagGroups;
            const visibleMemberships = memberships.filter(group => allowedGroupKeys.has(group.key));
            const weight = mode === 'tag'
                ? entry.value / Math.max(1, entry.tagGroups.length)
                : entry.value;

            for (const membership of visibleMemberships) {
                const existing = groups.get(membership.key);
                if (existing) {
                    existing.value += weight;
                    existing.entries.push(entry);
                } else {
                    groups.set(membership.key, {
                        key: membership.key,
                        label: membership.label,
                        value: weight,
                        color: membership.color,
                        entries: [entry],
                    });
                }
            }
        }
        return [...groups.values()].sort((a, b) => b.value - a.value);
    }
    private createSvg(container: HTMLElement, viewBox: string, cls: string): SVGSVGElement {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', viewBox);
        svg.addClass(cls);
        container.appendChild(svg);
        return svg;
    }

    private svgPath(svg: SVGSVGElement, d: string, cls: string, stroke?: string): SVGPathElement {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.addClass(cls);
        if (stroke) path.setAttribute('stroke', stroke);
        svg.appendChild(path);
        return path;
    }


}

function getFishboneRenderedGroupCount(groupCount: number): number {
    return Math.min(groupCount, FISHBONE_VISIBLE_GROUP_LIMIT)
        + (groupCount > FISHBONE_VISIBLE_GROUP_LIMIT ? 1 : 0);
}

function sumEntries(entries: WordflowEntry[]): number {
    return entries.reduce((sum, entry) => sum + entry.value, 0);
}

function formatLocalDate(date: Date): string {
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function supportsMode(query: WordflowViewQuery): boolean {
    return query.view === 'LEADERBOARD' || query.view === 'CFD' || query.view === 'FISHBONE' || query.view === 'SUMMARY';
}

function getViewTitle(query: WordflowViewQuery): string {
    switch (query.view) {
        case 'NOTE TREND':
            return 'Note trend';
        case 'FISHBONE':
            return 'Browse fishbone';
        case 'WEEKDAY PROFILE':
            return 'Weekday profile';
        case 'LEADERBOARD':
            return 'Contribution leaderboard';
        case 'CFD':
            return 'Cumulative flow';
        case 'SUMMARY':
        default:
            return 'Wordflow summary';
    }
}

function getHeatColor(ratio: number): string {
    if (ratio >= 0.8) return '#106347';
    if (ratio >= 0.6) return '#1e966c';
    if (ratio >= 0.4) return '#4fbf96';
    if (ratio >= 0.2) return '#96ddc3';
    return '#d7f1e7';
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not load generated SVG image.'));
        image.src = src;
    });
}

function normalizeCanvasColor(value: string, fallback: string): string {
    const normalized = (value || '').trim();
    if (!normalized || normalized === 'transparent' || normalized.includes('color-mix') || normalized.includes('var(')) {
        return fallback;
    }
    return normalized;
}
