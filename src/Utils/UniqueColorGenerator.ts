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
        const maxColors = 360 * this.saturationArray.length;
        if (this.generatedColors.size > maxColors) {
            console.warn("UniqueColorGenerator: no available colors that have not been used. ");
            this.generatedColors.clear();
        }

        let color: string;
        let attempts = 0;
        const maxAttempts = maxColors * 2;

        do {
            const h = Math.floor(Math.random() * 360);
            const s = this.saturationArray[
                Math.floor(Math.random() * this.saturationArray.length)
            ];
            color = hslToHex(h / 360, s, this.lightness);
            attempts++;

            if (attempts > maxAttempts) {
                console.warn("UniqueColorGenerator: no available colors that have not been used. ");
                this.generatedColors.clear();
            }
        } while (this.generatedColors.has(color));

        this.generatedColors.add(color);
        return color;
    }
}

// 使用示例
// const generator = new UniqueHslColorGenerator(50, [70, 80, 90]);
// console.log(generator.generate());
