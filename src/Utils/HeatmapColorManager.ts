interface HSL {
    h: number;
    s: number;
    l: number;
}

interface RGB {
    r: number;
    g: number;
    b: number;
}

export class HeatmapColorManager {
    private baseHue: number;
    private gradientLevels: number;
    private colorScale: string[] = [];

    constructor(baseColor: string, gradientLevels: number) {
        this.baseHue = this.hexToHue(baseColor);
        // gradientLevels includes the zero level, so we generate (gradientLevels - 1) colors
        this.gradientLevels = gradientLevels - 1;
        this.generateColorScale();
    }

    /**
     * Generate color scale based on base hue and gradient levels
     * Classic heatmap style: fixed H, varying L with minor S compensation
     */
    private generateColorScale(): void {
        this.colorScale = [];
        
        for (let i = 0; i < this.gradientLevels; i++) {
            // Main variation: Lightness from high to low (80% to 25%)
            // Large range for clear contrast: light colors for low values, dark for high values
            const lightness = 80 - (80 - 25) * (i / (this.gradientLevels - 1));
            
            // High saturation throughout (70% to 95%)
            // Maintains vibrant, non-grayish colors across all levels
            const saturation = 70 + (95 - 70) * (i / (this.gradientLevels - 1));
            
            const hsl: HSL = {
                h: Math.max(0, Math.min(360, this.baseHue)),
                s: Math.max(0, Math.min(100, saturation)),
                l: Math.max(0, Math.min(100, lightness))
            };
            
            this.colorScale.push(this.hslToHex(hsl));
        }
    }

    /**
     * Calculate color for a value based on intelligent extremes
     * @param value The value to get color for
     * @param allValues All values in the dataset
     * @returns Hex color string
     */
    public getColorForValue(value: number, allValues: number[]): string {
        if (allValues.length === 0) return this.colorScale[Math.floor(this.gradientLevels / 2)];
        if (allValues.length === 1) return this.colorScale[Math.floor(this.gradientLevels / 2)];

        // Sort values
        const sortedValues = [...allValues].sort((a, b) => a - b);
        
        let minValue: number;
        let maxValue: number;

        if (sortedValues.length <= 6) {
            // If 6 or fewer values, use actual min and max
            minValue = sortedValues[0];
            maxValue = sortedValues[sortedValues.length - 1];
        } else {
            // Exclude 3 smallest and 3 largest values
            minValue = sortedValues[3];
            maxValue = sortedValues[sortedValues.length - 4];
        }

        // Handle edge cases
        if (minValue === maxValue) {
            return this.colorScale[Math.floor(this.gradientLevels / 2)];
        }

        // Normalize value to 0-1 range
        let normalizedValue = (value - minValue) / (maxValue - minValue);
        normalizedValue = Math.max(0, Math.min(1, normalizedValue));

        // Map to color scale index
        const index = Math.floor(normalizedValue * (this.gradientLevels - 1));
        return this.colorScale[index];
    }

    /**
     * Get all colors in the scale
     */
    public getColorScale(): string[] {
        return [...this.colorScale];
    }

    /**
     * Convert hex color to hue value
     */
    private hexToHue(hex: string): number {
        const hsl = this.hexToHsl(hex);
        return hsl.h;
    }

    /**
     * Convert hex to HSL
     */
    private hexToHsl(hex: string): HSL {
        const rgb = this.hexToRgb(hex);
        return this.rgbToHsl(rgb);
    }

    /**
     * Convert hex to RGB
     */
    private hexToRgb(hex: string): RGB {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : { r: 0, g: 0, b: 0 };
    }

    /**
     * Convert RGB to HSL
     */
    private rgbToHsl(rgb: RGB): HSL {
        const max = Math.max(rgb.r, rgb.g, rgb.b);
        const min = Math.min(rgb.r, rgb.g, rgb.b);
        let h = 0, s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case rgb.r:
                    h = ((rgb.g - rgb.b) / d + (rgb.g < rgb.b ? 6 : 0)) / 6;
                    break;
                case rgb.g:
                    h = ((rgb.b - rgb.r) / d + 2) / 6;
                    break;
                case rgb.b:
                    h = ((rgb.r - rgb.g) / d + 4) / 6;
                    break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    /**
     * Convert HSL to hex
     */
    private hslToHex(hsl: HSL): string {
        const rgb = this.hslToRgb(hsl);
        const r = Math.round(rgb.r * 255);
        const g = Math.round(rgb.g * 255);
        const b = Math.round(rgb.b * 255);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    /**
     * Convert HSL to RGB
     */
    private hslToRgb(hsl: HSL): RGB {
        const h = hsl.h / 360;
        const s = hsl.s / 100;
        const l = hsl.l / 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
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

        return { r, g, b };
    }
}
