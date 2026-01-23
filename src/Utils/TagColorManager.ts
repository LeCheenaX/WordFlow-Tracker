/**
 * Tag-based color management system
 * Handles color assignment based on file tags with HSL color blending
 */

import { UniqueColorGenerator } from "./UniqueColorGenerator";

export interface TagColorConfig {
    tags: string[]; // 支持多个标签共享同一颜色
    color: string; // 完整的hex颜色值，如 #ff0000
    groupName?: string; // 可选的标签组名称
}

export interface HSL {
    h: number; // 0-360
    s: number; // 0-100
    l: number; // 0-100
}

export interface RGB {
    r: number; // 0-255
    g: number; // 0-255
    b: number; // 0-255
}

export class TagColorManager {
    private tagColors: Map<string, string> = new Map(); // tag -> hex color
    private readonly lightness: number = 60; // Fixed lightness (保留用于向后兼容)
    private readonly minSaturation: number = 50;
    private readonly maxSaturation: number = 86;

    constructor(
        private tagColorConfigs: TagColorConfig[], 
        private uniqueColorGenerator: UniqueColorGenerator
    ) {
        this.updateTagColors(this.tagColorConfigs);
    }

    /**
     * Update tag color configurations
     */
    public updateTagColors(tagColorConfigs: TagColorConfig[]): void {
        this.tagColors.clear();
        if (!tagColorConfigs || !Array.isArray(tagColorConfigs)) {
            return;
        }
        
        tagColorConfigs.forEach(config => {
            // 检查 config 是否存在，tags 是否为有效数组，color 是否为有效字符串
            if (config && 
                config.tags && 
                Array.isArray(config.tags) &&
                config.color && 
                typeof config.color === 'string' && 
                config.color.trim() !== '') {
                
                // 为每个标签设置相同的颜色值
                config.tags.forEach(tag => {
                    if (tag && typeof tag === 'string' && tag.trim() !== '') {
                        this.tagColors.set(tag.trim(), config.color.trim());
                    }
                });
            }
        });
    }

    /**
     * Get configured color for a specific tag as HSL
     * Returns the exact color user configured, converted to HSL
     */
    public getTagColorAsHSL(tag: string): HSL | null {
        const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
        const hexColor = this.tagColors.get(cleanTag) || null;
        if (!hexColor) return null;
        return this.hexToHsl(hexColor);
    }

    /**
     * Get color for a file based on its tags (for file progress bars and dots)
     * Uses hue from user-configured colors but applies dynamic saturation/lightness
     * @param fileTags Array of tags from the file
     * @param filePath Current file path
     * @param allFilesWithTags Map of tag -> array of file paths
     * @returns Final color as hex string
     */
    public getFileColor(
        fileTags: string[], 
        filePath: string, 
        allFilesWithTags: Map<string, string[]>
    ): string {
        const matchingTagColors = this.getMatchingTagColorsForFile(fileTags, filePath, allFilesWithTags);
        
        if (matchingTagColors.length === 0) {
            return this.uniqueColorGenerator.generate();
        }
        
        let resultColor: string;
        
        if (matchingTagColors.length === 1) {
            resultColor = this.hslToHex(matchingTagColors[0]);
        } else {
            // Blend multiple colors
            resultColor = this.blendColors(matchingTagColors);
        }
        
        // 将生成的标签颜色直接添加到 UniqueColorGenerator 的 generatedColors 中
        // 避免随机颜色生成器生成相同的颜色
        if (this.uniqueColorGenerator && resultColor) {
            // 直接添加到 generatedColors 集合中
            (this.uniqueColorGenerator as any).generatedColors.add(resultColor);
        }
        
        return resultColor;
    }

    /**
     * Get matching tag colors with saturation grading for file colors (not tag colors)
     * This extracts hue from user-configured colors and applies dynamic saturation
     */
    private getMatchingTagColorsForFile(
        fileTags: string[], 
        filePath: string, 
        allFilesWithTags: Map<string, string[]>
    ): HSL[] {
        const matchingColors: HSL[] = [];
        
        fileTags.forEach(tag => {
            // Remove # prefix if present for matching
            const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
            const configuredColor = this.tagColors.get(cleanTag);
            
            if (configuredColor) {
                // 从用户配置的颜色中提取hue值
                const hsl = this.hexToHsl(configuredColor);
                const filesWithThisTag = allFilesWithTags.get(cleanTag) || [];
                const saturation = this.calculateSaturation(filePath, filesWithThisTag);
                
                matchingColors.push({
                    h: hsl.h, // 使用用户配置颜色的hue
                    s: saturation, // 动态计算的饱和度
                    l: this.lightness // 固定亮度
                });
            }
        });
        
        return matchingColors;
    }

    /**
     * Calculate saturation based on file position among files with the same tag
     */
    private calculateSaturation(filePath: string, filesWithTag: string[]): number {
        const fileCount = filesWithTag.length;
        if (fileCount === 0) return 60; // Default saturation
        if (fileCount === 1) return 60; // Single file gets middle saturation
        
        // Find the index of current file in the sorted array
        const sortedFiles = [...filesWithTag].sort();
        const fileIndex = sortedFiles.indexOf(filePath);
        
        if (fileIndex === -1) return 60; // Fallback
        
        if (fileCount === 2) {
            // Special case for 2 files: 52, 69
            return fileIndex === 0 ? 52 : 69;
        }
        
        // For 3+ files: distribute evenly between 35-85
        const step = (this.maxSaturation - this.minSaturation) / (fileCount - 1);
        return Math.round(this.minSaturation + step * fileIndex);
    }

    /**
     * Blend multiple HSL colors using RGB intermediate conversion
     */
    private blendColors(hslColors: HSL[]): string {
        if (hslColors.length === 0) return '#000000';
        if (hslColors.length === 1) return this.hslToHex(hslColors[0]);

        // Convert all HSL to RGB
        const rgbColors = hslColors.map(hsl => this.hslToRgb(hsl));
        
        // Average RGB values
        const avgRgb: RGB = {
            r: Math.round(rgbColors.reduce((sum, rgb) => sum + rgb.r, 0) / rgbColors.length),
            g: Math.round(rgbColors.reduce((sum, rgb) => sum + rgb.g, 0) / rgbColors.length),
            b: Math.round(rgbColors.reduce((sum, rgb) => sum + rgb.b, 0) / rgbColors.length)
        };
        
        // Convert back to HSL
        const blendedHsl = this.rgbToHsl(avgRgb);
        
        // Adjust lightness and saturation as specified
        blendedHsl.l = Math.max(0, Math.min(100, blendedHsl.l - 6)); // Lower lightness
        blendedHsl.s = Math.max(0, Math.min(100, blendedHsl.s + 8));  // Slightly higher saturation
        
        return this.hslToHex(blendedHsl);
    }

    /**
     * Convert HSL to RGB
     */
    private hslToRgb(hsl: HSL): RGB {
        const h = hsl.h / 360;
        const s = hsl.s / 100;
        const l = hsl.l / 100;

        let r: number, g: number, b: number;

        if (s === 0) {
            r = g = b = l; // Grayscale
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    /**
     * Convert RGB to HSL
     */
    private rgbToHsl(rgb: RGB): HSL {
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h: number, s: number;
        const l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // Grayscale
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
                default: h = 0;
            }
            h /= 6;
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    /**
     * Convert HSL to hex color
     */
    private hslToHex(hsl: HSL): string {
        const rgb = this.hslToRgb(hsl);
        const toHex = (x: number) => {
            const hex = Math.round(x).toString(16).padStart(2, '0');
            return hex;
        };
        return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
    }

    /**
     * Get all configured tags
     */
    public getConfiguredTags(): string[] {
        return Array.from(this.tagColors.keys());
    }

    /**
     * Check if a tag has a configured color
     */
    public hasTagColor(tag: string): boolean {
        const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
        return this.tagColors.has(cleanTag);
    }

    /**
     * Convert hue (0-360) to hex color for color picker display (向后兼容)
     */
    public hueToHex(hue: number): string {
        const hsl: HSL = { h: hue, s: 70, l: 50 }; // Use standard S and L for display
        return this.hslToHex(hsl);
    }

    /**
     * Extract hue from hex color (向后兼容)
     */
    public hexToHue(hex: string): number {
        const hsl = this.hexToHsl(hex);
        return hsl.h;
    }

    /**
     * Build a map of tag -> array of file paths for saturation calculation
     */
    public buildFilesWithTagsMap(app: any, dataMap: Map<string, any>): Map<string, string[]> {
        const filesWithTags = new Map<string, string[]>();
        
        if (!dataMap) return filesWithTags;
        
        dataMap.forEach((data, filePath) => {
            const file = app.vault.getFileByPath(filePath);
            if (!file) return;
            
            const fileTags = this.getFileTags(app, file);
            fileTags.forEach(tag => {
                const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                if (!filesWithTags.has(cleanTag)) {
                    filesWithTags.set(cleanTag, []);
                }
                const fileList = filesWithTags.get(cleanTag)!;
                if (!fileList.includes(filePath)) {
                    fileList.push(filePath);
                }
            });
        });
        
        return filesWithTags;
    }

    /**
     * Get tags from a file's frontmatter only (excluding inline tags)
     */
    public getFileTags(app: any, file: any): string[] {
        const cache = app.metadataCache.getFileCache(file);
        const tags: string[] = [];

        // Get tags from frontmatter only
        if (cache?.frontmatter?.tags) {
            const frontmatterTags = cache.frontmatter.tags;
            if (Array.isArray(frontmatterTags)) {
                tags.push(...frontmatterTags);
            } else if (typeof frontmatterTags === 'string') {
                tags.push(frontmatterTags);
            }
        }

        // Inline tags are excluded to avoid unintended color influence

        return tags;
    }

    /**
     * Convert hex to HSL
     */
    private hexToHsl(hex: string): HSL {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h: number, s: number;
        const l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
                default: h = 0;
            }
            h /= 6;
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }
}