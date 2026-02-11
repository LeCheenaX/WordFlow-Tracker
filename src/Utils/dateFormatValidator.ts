import { I18nManager } from '../i18n';

/**
 * Validates a moment.js date format string for conflicting tokens
 * @param dateFormat - The moment.js format string to validate
 * @param i18n - I18n manager for localized messages
 * @returns Error message with ⚠️ icon if invalid, null if valid
 */
export function getDateValidationErrorResult(dateFormat: string, i18n: I18nManager): string | null {
    if (!dateFormat || dateFormat.trim() === '') {
        return null;
    }

    // Remove escaped text in brackets [text] to avoid false positives
    const cleanFormat = dateFormat.replace(/\[.*?\]/g, '');

    // Define token patterns
    const calendarTokens = {
        year: /Y{1,4}/,
        month: /M{1,4}/,
        day: /D{1,2}(?!D)/  // DD or D, but not DDD
    };

    const weekTokens = {
        isoWeekYear: /G{4}/,
        weekYear: /g{4}/,
        isoWeek: /W{1,2}/,
        week: /w{1,2}/,
        isoWeekday: /E/,
        weekday: /e/,
        dayOfWeek: /d{1}(?!d)/  // d but not dd
    };

    const ordinalTokens = {
        dayOfYear: /D{3}/  // DDD
    };

    // Check for conflicts
    const hasCalendarYear = calendarTokens.year.test(cleanFormat);
    const hasCalendarMonth = calendarTokens.month.test(cleanFormat);
    const hasCalendarDay = calendarTokens.day.test(cleanFormat);
    const hasAnyCalendarField = hasCalendarYear || hasCalendarMonth || hasCalendarDay;

    const hasISOWeekYear = weekTokens.isoWeekYear.test(cleanFormat);
    const hasWeekYear = weekTokens.weekYear.test(cleanFormat);
    const hasISOWeek = weekTokens.isoWeek.test(cleanFormat);
    const hasWeek = weekTokens.week.test(cleanFormat);
    const hasISOWeekday = weekTokens.isoWeekday.test(cleanFormat);
    const hasWeekday = weekTokens.weekday.test(cleanFormat);
    const hasDayOfWeek = weekTokens.dayOfWeek.test(cleanFormat);
    const hasAnyWeekField = hasISOWeekYear || hasWeekYear || hasISOWeek || hasWeek || hasISOWeekday || hasWeekday || hasDayOfWeek;

    const hasDayOfYear = ordinalTokens.dayOfYear.test(cleanFormat);

    // Conflict 1: Mixed locale week systems
    if ((hasWeek || hasWeekday) && (hasISOWeek || hasISOWeekday)) {
        return i18n.t('settings.momentValidation.mixedWeekSystems');
    }

    // Conflict 2: Calendar fields vs Week fields
    if (hasAnyCalendarField && hasAnyWeekField) {
        return i18n.t('settings.momentValidation.calendarVsWeek');
    }

    // Conflict 3: Calendar fields vs Day of year
    if (hasAnyCalendarField && hasDayOfYear) {
        return i18n.t('settings.momentValidation.calendarVsDayOfYear');
    }

    // Conflict 4: Day of week with specific date
    if (hasCalendarDay && (hasDayOfWeek || hasWeekday || hasISOWeekday)) {
        return i18n.t('settings.momentValidation.dateVsWeekday');
    }

    // Conflict 5: ISO week year with calendar month
    if (hasISOWeekYear && hasCalendarMonth) {
        return i18n.t('settings.momentValidation.isoWeekYearVsMonth');
    }

    // Conflict 6: Week number with specific day
    if ((hasISOWeek || hasWeek) && hasCalendarDay) {
        return i18n.t('settings.momentValidation.weekVsDay');
    }

    return null;
}
