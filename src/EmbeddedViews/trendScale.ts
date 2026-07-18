export interface IntegerScale {
    min: number;
    max: number;
    step: number;
    ticks: number[];
}

export function getNiceIntegerScale(values: number[], targetIntervals = 4): IntegerScale {
    const finiteValues = values.filter(Number.isFinite);
    if (finiteValues.length === 0) {
        return { min: 0, max: 1, step: 1, ticks: [0, 1] };
    }

    let dataMin = Math.min(...finiteValues);
    let dataMax = Math.max(...finiteValues);
    if (dataMin === dataMax) {
        const padding = Math.max(1, Math.abs(dataMax) * 0.1);
        dataMin -= padding;
        dataMax += padding;
    }

    const roughStep = Math.max(1, (dataMax - dataMin) / Math.max(2, targetIntervals));
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const normalizedStep = roughStep / magnitude;
    const niceFactor = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10;
    const step = Math.max(1, Math.round(niceFactor * magnitude));
    let min = Math.floor(dataMin / step) * step;
    let max = Math.ceil(dataMax / step) * step;

    if (dataMin >= 0 && dataMin <= step) min = 0;
    if (max <= min) max = min + step;

    const ticks: number[] = [];
    for (let value = min; value <= max + step / 2 && ticks.length < 12; value += step) {
        ticks.push(Math.round(value));
    }
    return { min, max, step, ticks };
}
