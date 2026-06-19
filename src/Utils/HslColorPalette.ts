export interface HSLColor {
    h: number;
    s: number;
    l: number;
}

type HSLRange = [number, number];

// Smallest adjacent lightness change used by the heatmap at nine color levels.
export const MIN_HSL_VARIATION_STEP = 6.875;
export const MAX_SL_LEVELS_PER_HUE = 9;
const CONFIGURED_TAG_SATURATION_RANGE: HSLRange = [30, 90];
const CONFIGURED_TAG_LIGHTNESS_RANGE: HSLRange = [25, 80];

export function buildFixedHueSlPalette(
    hue: number,
    requestedLevels: number
): HSLColor[] {
    const levels = Math.max(1, Math.min(MAX_SL_LEVELS_PER_HUE, requestedLevels));
    const normalizedHue = ((hue % 360) + 360) % 360;
    const saturationBounds = inferHeatmapBounds(CONFIGURED_TAG_SATURATION_RANGE);
    const lightnessBounds = inferHeatmapBounds(CONFIGURED_TAG_LIGHTNESS_RANGE);

    return Array.from({ length: levels }, (_, index) => ({
        h: normalizedHue,
        s: getSegmentCenter(saturationBounds, levels, index),
        l: getSegmentCenter(lightnessBounds, levels, index)
    }));
}

export function getBisectedHue(baseHue: number, hueRadius: number, groupIndex: number): number {
    if (groupIndex === 0 || hueRadius <= 0) return normalizeHue(baseHue);
    if (groupIndex === 1) return normalizeHue(baseHue - hueRadius);
    if (groupIndex === 2) return normalizeHue(baseHue + hueRadius);

    const midpointIndex = groupIndex - 3;
    const depth = Math.floor(Math.log2(midpointIndex + 2));
    const firstIndexAtDepth = Math.pow(2, depth) - 2;
    const position = midpointIndex - firstIndexAtDepth;
    const intervalCount = Math.pow(2, depth);
    const lower = baseHue - hueRadius;
    const intervalWidth = hueRadius * 2 / intervalCount;

    return normalizeHue(lower + (position + 0.5) * intervalWidth);
}

function inferHeatmapBounds(range: HSLRange): HSLRange {
    const step = (range[1] - range[0]) / (MAX_SL_LEVELS_PER_HUE - 1);
    return [range[0] - step / 2, range[1] + step / 2];
}

function getSegmentCenter(bounds: HSLRange, levels: number, index: number): number {
    const segmentLength = (bounds[1] - bounds[0]) / levels;
    return roundColorValue(bounds[1] - (index + 0.5) * segmentLength);
}

function normalizeHue(hue: number): number {
    return roundColorValue(((hue % 360) + 360) % 360);
}

function roundColorValue(value: number): number {
    return Math.round(value * 1000) / 1000;
}
