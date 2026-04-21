import WordflowTrackerPlugin from './main';
import { Notice, TFile, requestUrl } from 'obsidian';
import { computeDiffForLLM } from './Utils/SimpleDiff';

const DEBUG = false;
export interface DiffQueueItem {
    filePath: string;
    recordNotePath: string;
    diffId: string;
    groupKey: string;
    period: string;
    dateFormat: string;
}

export class AIDiffManager {
    private requestQueue: DiffQueueItem[] = [];
    private activeRequests: Map<string, AbortController> = new Map();
    private isProcessing: boolean = false;
    private destroyed: boolean = false;

    constructor(private plugin: WordflowTrackerPlugin) {}

    public queueDiffRequest(item: DiffQueueItem): void {
        if (this.destroyed) return;

        this.cancelPendingForFile(item.filePath);

        this.requestQueue = this.requestQueue.filter(q => q.filePath !== item.filePath);

        this.requestQueue.push(item);

        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    public cancelPendingForFile(filePath: string): void {
        const controller = this.activeRequests.get(filePath);
        if (controller) {
            controller.abort();
            this.activeRequests.delete(filePath);
        }
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.destroyed) return;
        this.isProcessing = true;

        while (this.requestQueue.length > 0 && !this.destroyed) {
            const item = this.requestQueue.shift()!;

            const controller = new AbortController();
            this.activeRequests.set(item.filePath, controller);

            try {
                await this.processSingleItem(item, controller.signal);
            } catch (e: any) {
                if (e.name === 'AbortError') {
                } else {
                    console.error(`AIDiffManager: Error processing diff for ${item.filePath}`, e);
                    await this.replaceDiffMarker(item, '\u26A0\uFE0F', true);
                }
            } finally {
                this.activeRequests.delete(item.filePath);
            }
        }

        this.isProcessing = false;
    }

    private async processSingleItem(item: DiffQueueItem, signal: AbortSignal): Promise<void> {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const snapshot = this.plugin.snapshotManager.getSnapshot(item.groupKey, item.filePath, item.period, item.dateFormat);
        //console.log(`AIDiffManager: Processing diff for ${item.filePath}, snapshot found: ${!!snapshot}`);
        if (!snapshot) {
            //console.log(`AIDiffManager: No snapshot available for ${item.filePath}`);
            await this.replaceDiffMarker(item, '\u200B');
            return;
        }

        const file = this.plugin.app.vault.getAbstractFileByPath(item.filePath);
        if (!file || !(file instanceof TFile)) {
            //console.log(`AIDiffManager: File not found ${item.filePath}`);
            await this.replaceDiffMarker(item, '\u200B');
            return;
        }

        const currentContent = await this.plugin.app.vault.read(file);

        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const maxDiffLength = (parseInt(this.plugin.settings.aiMaxDiffLength) || 128) * 1024;
        const diff = computeDiffForLLM(snapshot, currentContent, maxDiffLength);

        if (!diff || diff.trim() === '') {
            await this.replaceDiffMarker(item, '\u200B');
            return;
        }

        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const aiResponse = await this.callLLM(diff, signal);
        if(DEBUG) console.log(`AIDiffManager: LLM response for ${item.filePath}: ${aiResponse.trim()}`);

        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        await this.replaceDiffMarker(item, aiResponse.trim());
    }

    private async callLLM(diff: string, signal: AbortSignal): Promise<string> {
        const { aiBaseURL, aiApiKey, aiModel, aiPrompt, aiProvider } = this.plugin.settings;

        if (!aiBaseURL || !aiApiKey || !aiModel) {
            throw new Error('AI configuration incomplete');
        }

        const effectivePrompt = aiPrompt || this.plugin.i18n.t('settings.ai.prompt.defaultPrompt');
        const afterSysPrompt = this.plugin.i18n.t('settings.ai.prompt.afterSysPrompt');
        const systemContent = `${effectivePrompt}\n${afterSysPrompt}`;
        const userContent = `${this.plugin.i18n.t('settings.ai.prompt.userContent')}\n${diff}`;

        if(DEBUG) console.log('AIDiffManager: Sending to LLM:', {
            model: aiModel,
            system: systemContent,
            user: userContent
        });

        const url = `${aiBaseURL.replace(/\/$/, '')}/chat/completions`;

        const body = JSON.stringify({
            model: aiModel,
            messages: [
                { role: 'system', content: systemContent },
                { role: 'user', content: userContent }
            ],
            max_tokens: 100,
            temperature: 0.3
        });

        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            headers['Authorization'] = `Bearer ${aiApiKey}`;

            const response = await requestUrl({
                url,
                method: 'POST',
                headers,
                body
            });

            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

            if (response.status !== 200) {
                throw new Error(`LLM API returned status ${response.status}: ${JSON.stringify(response.json)}`);
            }

            const data = response.json;
            const content = data?.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('No content in LLM response');
            }

            return content;
        } catch (e: any) {
            if (signal.aborted || e.name === 'AbortError') {
                throw new DOMException('Aborted', 'AbortError');
            }
            throw e;
        }
    }

    private async replaceDiffMarker(item: DiffQueueItem, replacement: string, keepOldText: boolean = false): Promise<void> {
        try {
            const recordNote = this.plugin.app.vault.getAbstractFileByPath(item.recordNotePath);
            if (!recordNote || !(recordNote instanceof TFile)) {
                console.warn(`AIDiffManager: Record note not found: ${item.recordNotePath}`);
                return;
            }

            const blockRegex = new RegExp(`<!--wf-diff:${item.diffId}-->[\\s\\S]*?<!--/wf-diff:${item.diffId}-->`);

            await this.plugin.app.vault.process(recordNote, (data) => {
                if (!blockRegex.test(data)) {
                    console.warn(`AIDiffManager: Loading marker for ${item.filePath} not found in note ${item.recordNotePath}`);
                    return data;
                }
                if (keepOldText) {
                    const loadingRegex = new RegExp(`<svg\\s+class="wf-diff-loading"\\s+data-wf-id="${item.diffId}"[^>]*>[\\s\\S]*?</svg>`);
                    const match = data.match(blockRegex);
                    if (match) {
                        const innerContent = match[0].replace(/<!--wf-diff:\w+-->/, '').replace(/<!--\/wf-diff:\w+-->/, '');
                        const newInner = innerContent.replace(loadingRegex, replacement);
                        return data.replace(blockRegex, newInner);
                    }
                    return data;
                }
                return data.replace(blockRegex, replacement);
            });
        } catch (e) {
            console.error(`AIDiffManager: Failed to replace diff marker in ${item.recordNotePath}`, e);
        }
    }

    public static buildDiffLoading(filePath: string): { html: string; id: string } {
        let hash = 0;
        for (let i = 0; i < filePath.length; i++) {
            const char = filePath.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const id = Math.abs(hash).toString(36);
        const svg = `<svg class="wf-diff-loading" data-wf-id="${id}" viewBox="0 0 24 24" width="1em" height="1em"><path fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z"/></svg>`;
        const html = `<!--wf-diff:${id}-->${svg}<!--/wf-diff:${id}-->`;
        return { html, id };
    }

    public destroy(): void {
        this.destroyed = true;
        for (const [, controller] of this.activeRequests) {
            controller.abort();
        }
        this.activeRequests.clear();
        this.requestQueue = [];
    }
}
