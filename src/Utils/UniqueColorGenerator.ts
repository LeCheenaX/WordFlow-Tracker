/**
 * Converts an HSL color value to HEX. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 * 
 * @param   h       The hue (0-1)
 * @param   s       The saturation (0-1)
 * @param   l       The lightness (0-1)
 * @return  string  The HEX representation
 */
function hslToHex(h: number, s: number, l: number): string {
    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l; // 灰度处理
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

    const toHex = (x: number) => {
        const hex = Math.round(x * 255).toString(16).padStart(2, '0');
        return hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export class UniqueColorGenerator {
    private generatedColors: Set<string> = new Set();
    private generatedHues: Set<number> = new Set();
    private readonly lightness: number;       // [0-1]范围
    private readonly saturationArray: number[]; // [0-1]范围

    /**
     * 初始化颜色生成器
     * @param lightness 明度 (0-100)
     * @param saturationArray 饱和度数组 (0-100)
     */
    constructor(lightness: number, saturationArray: number[]) {
        this.lightness = lightness / 100;
        this.saturationArray = saturationArray.map(s => s / 100);
    }

    /**
     * 生成唯一随机色
     * @returns HEX颜色字符串 或 null（无可用颜色时）
     */
    public generate(): string {
        const saturationValues = this.saturationArray.length > 0 ? this.saturationArray : [0.7];
        const saturation = saturationValues[Math.floor(Math.random() * saturationValues.length)];
        let sourceHue = Math.floor(Math.random() * 360);
        let color = hslToHex(sourceHue / 360, saturation, this.lightness);
        let renderedHue = hexToHue(color) ?? sourceHue;

        if (this.generatedHues.size < 360) {
            let attempts = 0;
            while (
                (this.generatedHues.has(renderedHue) || this.generatedColors.has(color))
                && attempts < 720
            ) {
                sourceHue = Math.floor(Math.random() * 360);
                color = hslToHex(sourceHue / 360, saturation, this.lightness);
                renderedHue = hexToHue(color) ?? sourceHue;
                attempts++;
            }

            if (this.generatedHues.has(renderedHue) || this.generatedColors.has(color)) {
                const fallback = this.findUnusedColor(saturation);
                color = fallback.color;
                renderedHue = fallback.hue;
            }
        } else {
            console.warn('UniqueColorGenerator: all 360 unique hues have been used.');
        }

        this.generatedColors.add(color);
        this.generatedHues.add(renderedHue);
        return color;
    }

    public reserve(color: string): void {
        this.generatedColors.add(color);
        const hue = hexToHue(color);
        if (hue !== null) this.generatedHues.add(hue);
    }

    private findUnusedColor(saturation: number): { color: string; hue: number } {
        for (let sourceHue = 0; sourceHue < 360; sourceHue++) {
            const color = hslToHex(sourceHue / 360, saturation, this.lightness);
            const renderedHue = hexToHue(color) ?? sourceHue;
            if (!this.generatedHues.has(renderedHue) && !this.generatedColors.has(color)) {
                return { color, hue: renderedHue };
            }
        }
        return { color: hslToHex(0, saturation, this.lightness), hue: 0 };
    }
}

export function hexToHue(hex: string): number | null {
    const normalized = hex.trim().replace(/^#/, '');
    const expanded = normalized.length === 3
        ? normalized.split('').map(character => character + character).join('')
        : normalized;
    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;

    const r = parseInt(expanded.slice(0, 2), 16) / 255;
    const g = parseInt(expanded.slice(2, 4), 16) / 255;
    const b = parseInt(expanded.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 0;

    const delta = max - min;
    let hue: number;
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    return Math.round((hue * 60 + 360) % 360) % 360;
}

// 使用示例
// const generator = new UniqueHslColorGenerator(50, [70, 80, 90]);
// console.log(generator.generate());
