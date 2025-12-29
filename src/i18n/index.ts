import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';
import { LocaleResources } from './types';

export type SupportedLocale = 'en' | 'zh-CN';

export const LOCALES: Record<SupportedLocale, LocaleResources> = {
    'en': en as LocaleResources,
    'zh-CN': zhCN as LocaleResources
};

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export class I18nManager {
    private currentLocale: SupportedLocale;
    private resources: LocaleResources;

    constructor(locale: SupportedLocale = DEFAULT_LOCALE) {
        this.currentLocale = locale;
        this.resources = LOCALES[locale];
    }

    public setLocale(locale: SupportedLocale): void {
        this.currentLocale = locale;
        this.resources = LOCALES[locale];
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

    public getAvailableLocales(): SupportedLocale[] {
        return Object.keys(LOCALES) as SupportedLocale[];
    }

    public getLocaleName(locale: SupportedLocale): string {
        return LOCALES[locale].language || locale;
    }
}

// 单例实例
let i18nInstance: I18nManager | null = null;

export function initI18n(locale?: SupportedLocale): I18nManager {
    if (!i18nInstance) {
        i18nInstance = new I18nManager(locale);
    }
    return i18nInstance;
}

export function getI18n(): I18nManager {
    if (!i18nInstance) {
        i18nInstance = new I18nManager();
    }
    return i18nInstance;
}
