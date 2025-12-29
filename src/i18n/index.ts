import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';
import { LocaleResources, MultiLineContent } from './types';

export type SupportedLocale = 'en' | 'zh-CN';

// Locale mapping for common variations
const LOCALE_MAPPING: Record<string, SupportedLocale> = {
    'en': 'en',
    'zh': 'zh-CN',
    'zh-cn': 'zh-CN',
    'zh-CN': 'zh-CN',
    'chinese': 'zh-CN',
    'english': 'en'
};

export const LOCALES: Record<SupportedLocale, LocaleResources> = {
    'en': en as LocaleResources,
    'zh-CN': zhCN as LocaleResources
};

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Normalize locale string to supported locale
 */
export function normalizeLocale(locale: string): SupportedLocale {
    const normalized = LOCALE_MAPPING[locale.toLowerCase()];
    if (normalized) {
        return normalized;
    }
    console.warn(`[i18n] Unknown locale: ${locale}, falling back to default: ${DEFAULT_LOCALE}`);
    return DEFAULT_LOCALE;
}

export class I18nManager {
    private currentLocale: SupportedLocale;
    private resources: LocaleResources;
    private translationCache: Map<string, any> = new Map();

    constructor(locale: SupportedLocale = DEFAULT_LOCALE) {
        this.currentLocale = locale;
        this.resources = LOCALES[locale];
    }

    public setLocale(locale: SupportedLocale | string): void {
        const normalizedLocale = typeof locale === 'string' ? normalizeLocale(locale) : locale;
        
        //console.log(`[i18n] Setting locale from '${locale}' to '${normalizedLocale}'`);
        this.currentLocale = normalizedLocale;
        this.resources = LOCALES[normalizedLocale];
        // Clear cache when locale changes
        this.translationCache.clear();
    }

    public getLocale(): SupportedLocale {
        return this.currentLocale;
    }

    public t(key: string, params?: Record<string, any>): string {
        const keys = key.split('.');
        let value: any = this.resources;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`[i18n] Translation key not found: ${key}`);
                return key;
            }
        }
        
        if (typeof value !== 'string') {
            console.warn(`[i18n] Translation value is not a string: ${key}`);
            return key;
        }
        
        // 参数替换
        if (params) {
            return value.replace(/\{(\w+)\}/g, (match, param) => {
                return params[param] !== undefined ? String(params[param]) : match;
            });
        }
        
        return value;
    }

    /**
     * Build a DocumentFragment for multi-line content with HTML elements
     */
    public buildFragment(
        key: string, 
        params?: Record<string, any>,
        customBuilder?: (fragment: DocumentFragment) => void
    ): DocumentFragment {
        const fragment = document.createDocumentFragment();
        
        if (customBuilder) {
            customBuilder(fragment);
            return fragment;
        }

        const content = this.getMultiLineContent(key);
        
        if (typeof content === 'string') {
            // Simple string - handle as single line with parameter interpolation
            const text = this.formatWithParams(content, params);
            fragment.appendChild(document.createTextNode(text));
        } else if (this.isArrayFormat(content)) {
            // Array format - join with <br> elements
            content.forEach((segment, index) => {
                if (index > 0) {
                    fragment.appendChild(document.createElement('br'));
                }
                const text = this.formatWithParams(segment, params);
                fragment.appendChild(document.createTextNode(text));
            });
        } else if (this.isObjectFormat(content)) {
            // Object format - handle segments with inline link placeholders
            content.segments.forEach((segment, index) => {
                if (index > 0) {
                    fragment.appendChild(document.createElement('br'));
                }
                
                // Process segment text and replace link placeholders
                this.processSegmentWithLinks(segment, content, params, fragment);
            });
        } else {
            // Fallback - treat as key not found
            console.warn(`[i18n] Invalid multi-line content format for key: ${key}`);
            fragment.appendChild(document.createTextNode(key));
        }
        
        return fragment;
    }

    /**
     * Get multi-line content in its raw format (string, array, or object)
     */
    public getMultiLineContent(key: string): string | string[] | MultiLineContent {
        // Check cache first
        if (this.translationCache.has(key)) {
            return this.translationCache.get(key);
        }

        const keys = key.split('.');
        let value: any = this.resources;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`[i18n] Translation key not found: ${key}`);
                this.translationCache.set(key, key);
                return key;
            }
        }
        
        // Cache the result
        this.translationCache.set(key, value);
        return value;
    }

    /**
     * Check if content has multi-line structure (array or object format)
     */
    public hasMultiLineContent(key: string): boolean {
        const content = this.getMultiLineContent(key);
        return this.isArrayFormat(content) || this.isObjectFormat(content);
    }

    /**
     * Type guard for array format
     */
    public isArrayFormat(content: any): content is string[] {
        return Array.isArray(content) && content.every(item => typeof item === 'string');
    }

    /**
     * Type guard for object format
     */
    public isObjectFormat(content: any): content is MultiLineContent {
        return (
            content &&
            typeof content === 'object' &&
            !Array.isArray(content) &&
            Array.isArray(content.segments) &&
            content.segments.every((segment: any) => typeof segment === 'string')
        );
    }

    /**
     * Format text with parameter interpolation
     */
    public formatWithParams(text: string, params?: Record<string, any>): string {
        if (!params) {
            return text;
        }
        
        return text.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? String(params[param]) : match;
        });
    }

    /**
     * Process a segment text and replace link placeholders with actual link elements
     */
    private processSegmentWithLinks(
        segment: string, 
        content: MultiLineContent, 
        params: Record<string, any> | undefined, 
        fragment: DocumentFragment
    ): void {
        // First apply parameter interpolation
        let text = this.formatWithParams(segment, content.params || params);
        
        if (!content.links || content.links.length === 0) {
            // No links, just add text
            fragment.appendChild(document.createTextNode(text));
            return;
        }
        
        // Find and replace link placeholders
        const linkPattern = /\{(link\w*)\}/g;
        let lastIndex = 0;
        let match;
        
        while ((match = linkPattern.exec(text)) !== null) {
            const linkId = match[1];
            const linkData = content.links.find(link => link.id === linkId);
            
            if (linkData) {
                // Add text before the link
                if (match.index > lastIndex) {
                    const beforeText = text.substring(lastIndex, match.index);
                    fragment.appendChild(document.createTextNode(beforeText));
                }
                
                // Add the link element
                const linkElement = document.createElement('a');
                linkElement.href = linkData.href;
                linkElement.textContent = linkData.text;
                fragment.appendChild(linkElement);
                
                lastIndex = match.index + match[0].length;
            }
        }
        
        // Add remaining text after the last link
        if (lastIndex < text.length) {
            const remainingText = text.substring(lastIndex);
            fragment.appendChild(document.createTextNode(remainingText));
        }
    }

    public getAvailableLocales(): SupportedLocale[] {
        return Object.keys(LOCALES) as SupportedLocale[];
    }

    public getLocaleName(locale: SupportedLocale): string {
        return LOCALES[locale].language || locale;
    }
}

// 单例实例
let i18nInstance: I18nManager | null = null;

export function initI18n(locale?: SupportedLocale | string): I18nManager {
    const normalizedLocale = locale ? (typeof locale === 'string' ? normalizeLocale(locale) : locale) : DEFAULT_LOCALE;
    //console.log(`[i18n] Initializing i18n with locale: ${locale || DEFAULT_LOCALE} -> ${normalizedLocale}`);
    if (!i18nInstance) {
        i18nInstance = new I18nManager(normalizedLocale);
    } else {
        // If instance exists but we want to change locale
        i18nInstance.setLocale(normalizedLocale);
    }
    return i18nInstance;
}

export function getI18n(): I18nManager {
    if (!i18nInstance) {
        i18nInstance = new I18nManager();
    }
    return i18nInstance;
}
