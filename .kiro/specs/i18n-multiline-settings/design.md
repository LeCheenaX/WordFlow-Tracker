# Design Document

## Overview

This design enhances the existing i18n system to support complete multi-line setting descriptions and provides a consistent, efficient pattern for accessing translations throughout the codebase. The solution introduces structured multi-line translation support and a centralized i18n access pattern while maintaining backward compatibility.

## Architecture

### Current Architecture Issues
- Each setting component manually calls `getI18n()` creating inconsistency
- Multi-line descriptions only translate the first line, leaving subsequent content in English
- Fragment building requires manual text concatenation with HTML elements
- No structured approach for complex, multi-segment translations

### Enhanced Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Settings Tab Classes                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │   GeneralTab    │ │  RecordersTab   │ │   WidgetTab     ││
│  │                 │ │                 │ │                 ││
│  │ + i18n: I18n    │ │ + i18n: I18n    │ │ + i18n: I18n    ││
│  │ + buildFragment │ │ + buildFragment │ │ + buildFragment ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Enhanced I18n Manager                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ + t(key, params?)                                       ││
│  │ + buildFragment(key, params?, fragmentBuilder)          ││
│  │ + getMultiLineContent(key)                              ││
│  │ + formatWithParams(text, params)                        ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Enhanced Translation Structure                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Multi-line descriptions stored as:                      ││
│  │ - Array of text segments                                ││
│  │ - Object with segments and metadata                     ││
│  │ - Support for parameter interpolation per segment       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Enhanced I18n Manager

```typescript
interface MultiLineContent {
    segments: string[];
    links?: Array<{
        id: string;  // Link identifier to be used in segment text as {linkId}
        text: string;
        href: string;
    }>;
    params?: Record<string, any>;
}

interface I18nManager {
    // Existing methods
    t(key: string, params?: Record<string, any>): string;
    setLocale(locale: SupportedLocale): void;
    getLocale(): SupportedLocale;
    
    // New methods for multi-line support
    buildFragment(
        key: string, 
        params?: Record<string, any>,
        customBuilder?: (f: DocumentFragment) => void
    ): DocumentFragment;
    
    getMultiLineContent(key: string): string[] | MultiLineContent | string;
    hasMultiLineContent(key: string): boolean;
    isArrayFormat(content: any): content is string[];
    isObjectFormat(content: any): content is MultiLineContent;
}
```

**Fragment Building Process:**
```typescript
// Example usage in settings:
const fragment = this.i18n.buildFragment('settings.recorders.periodicNote.format.desc');

// Internally handles:
// 1. Detect format (array vs object vs string)
// 2. Process segments with parameter interpolation
// 3. Insert <br> elements between segments
// 4. Insert <a> elements at specified positions
// 5. Return complete DocumentFragment ready for DOM
```

### Enhanced Settings Base Class

```typescript
abstract class WordflowSubSettingsTab {
    protected i18n: I18nManager;
    
    constructor(
        protected app: App, 
        protected plugin: WordflowTrackerPlugin, 
        protected container: HTMLElement
    ) {
        this.i18n = getI18n();
    }
    
    protected createMultiLineDesc(key: string, params?: Record<string, any>): DocumentFragment {
        return this.i18n.buildFragment(key, params);
    }
    
    abstract display(): void;
}
```

## Data Models

### Enhanced Translation Structure

Current structure (problematic):
```json
{
  "ignoredFolders": {
    "name": "Ignored folders",
    "desc": "Files inside these folders (or subfolders) will not be tracked."
  }
}
```

**Hybrid Approach - Auto-Detection:**
The system will auto-detect structure type and handle accordingly:
```json
{
  "simpleMultiLine": {
    "desc": ["Line 1", "Line 2", "Line 3"]
  },
  "complexWithLinks": {
    "desc": {
      "segments": ["Text before {link0} text after"],
      "links": [{"id": "link0", "text": "link text", "href": "url"}]
    }
  }
}
```

**Fragment Building Logic:**
1. **Array format**: Each element becomes a text segment with `<br>` between them
2. **Object format**: Segments are processed in order, with links inserted inline using `{linkId}` placeholders
3. **Backward compatibility**: String format continues to work as single-line description

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated:
- Properties 1.1, 1.2, and 3.3 all relate to multi-line segment translation and can be combined
- Properties 2.1, 2.2, and 2.5 all relate to consistent i18n access patterns and can be combined  
- Properties 3.1, 3.2, and 3.4 all relate to multi-line structure support and can be combined
- Properties 4.1, 4.2, 4.3, and 4.4 all relate to backward compatibility and can be combined
- Properties 5.1, 5.3, and 5.5 all relate to performance optimization and can be combined

### Core Properties

**Property 1: Multi-line translation completeness**
*For any* multi-line description key, all text segments should be translated and properly combined with HTML elements when building fragments
**Validates: Requirements 1.1, 1.2, 1.3**

**Property 2: Translation key structure support**
*For any* nested or hierarchical translation key, the I18n_Manager should resolve it correctly and support both array and object-based multi-line structures
**Validates: Requirements 1.4, 3.1, 3.2, 3.3, 3.4**

**Property 3: Error handling consistency**
*For any* missing or invalid translation key, the I18n_Manager should log a warning and return the key as fallback
**Validates: Requirements 1.5**

**Property 4: Consistent i18n access pattern**
*For any* setting component, i18n should be available through the base class without repeated initialization calls
**Validates: Requirements 2.1, 2.2, 2.5**

**Property 5: Language switching reactivity**
*For any* language change, all setting components should automatically reflect the new translations without manual refresh
**Validates: Requirements 2.4**

**Property 6: Cross-locale structure consistency**
*For any* multi-line translation key, the structure should be consistent across all supported locales
**Validates: Requirements 3.5**

**Property 7: Backward compatibility preservation**
*For any* existing translation key or pattern, the enhanced system should continue to work without breaking changes
**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

**Property 8: Performance optimization**
*For any* translation lookup or fragment building operation, the system should use caching and minimize DOM operations for optimal performance
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

## Error Handling

### Translation Key Resolution
- Missing keys return the key string as fallback with console warning
- Invalid key formats log errors and return empty string
- Malformed multi-line structures fall back to simple string translation

### Fragment Building
- Invalid HTML structures are sanitized automatically
- Missing link targets default to empty href with warning
- Parameter interpolation failures preserve original text with warning

### Language Switching
- Invalid locale codes fall back to default locale (English)
- Partial translation files merge with default locale for missing keys
- Component refresh failures are logged but don't break UI

## Testing Strategy

### Unit Testing Approach
- Test specific examples of multi-line descriptions with known structures
- Test error conditions with invalid keys and malformed data
- Test language switching with mock locale data
- Test fragment building with various HTML combinations

### Property-Based Testing Approach
- Generate random translation keys and verify resolution behavior
- Generate random multi-line structures and verify fragment building
- Generate random locale switching scenarios and verify consistency
- Generate random performance scenarios and verify optimization

**Testing Framework**: Jest with fast-check for property-based testing
**Minimum Iterations**: 100 per property test
**Test Tags**: Each property test tagged with **Feature: i18n-multiline-settings, Property {number}: {property_text}**

### Integration Testing
- Test complete settings tab rendering with enhanced i18n
- Test language switching across all settings tabs
- Test backward compatibility with existing translation files
- Test performance under realistic usage scenarios

<function_calls>
<invoke name="prework">
<parameter name="featureName">i18n-multiline-settings