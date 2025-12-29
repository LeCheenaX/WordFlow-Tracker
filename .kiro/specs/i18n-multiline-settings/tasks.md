# Implementation Plan: I18n Multiline Settings

## Overview

This implementation plan transforms the current i18n system to support complete multi-line setting descriptions and provides a consistent pattern for accessing translations. The approach focuses on enhancing the existing I18nManager class and updating the settings base class to eliminate repeated `getI18n()` calls while maintaining backward compatibility.

## Tasks

- [x] 1. Enhance I18nManager with multi-line support
  - Extend I18nManager class to support array and object-based multi-line translations
  - Add buildFragment method for HTML-compatible fragment building
  - Implement auto-detection for different translation formats (string, array, object)
  - Add helper methods for link insertion and parameter interpolation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4_

- [ ]* 1.1 Write property test for multi-line translation completeness
  - **Property 1: Multi-line translation completeness**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [ ]* 1.2 Write property test for translation key structure support
  - **Property 2: Translation key structure support**
  - **Validates: Requirements 1.4, 3.1, 3.2, 3.3, 3.4**

- [ ]* 1.3 Write property test for error handling consistency
  - **Property 3: Error handling consistency**
  - **Validates: Requirements 1.5**

- [x] 2. Update WordflowSubSettingsTab base class
  - Add i18n instance as protected property in constructor
  - Create createMultiLineDesc helper method for fragment building
  - Ensure all subclasses inherit i18n access without manual initialization
  - _Requirements: 2.1, 2.2, 2.5_

- [ ]* 2.1 Write property test for consistent i18n access pattern
  - **Property 4: Consistent i18n access pattern**
  - **Validates: Requirements 2.1, 2.2, 2.5**

- [x] 3. Update translation files with multi-line structures
  - Convert existing hardcoded multi-line descriptions to array format in en.json
  - Convert existing hardcoded multi-line descriptions to array format in zh-CN.json
  - Add object format examples for descriptions with links
  - Ensure structural consistency between locales
  - _Requirements: 3.5_

- [ ]* 3.1 Write property test for cross-locale structure consistency
  - **Property 6: Cross-locale structure consistency**
  - **Validates: Requirements 3.5**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update GeneralTab settings implementation
  - Remove manual `const i18n = getI18n()` declarations
  - Replace createFragment calls with this.createMultiLineDesc() for multi-line descriptions
  - Update ignoredFolders, ignoredTags, noteThreshold, and other settings with multi-line descriptions
  - _Requirements: 2.3, 2.4_

- [ ]* 5.1 Write property test for language switching reactivity
  - **Property 5: Language switching reactivity**
  - **Validates: Requirements 2.4**

- [x] 6. Update RecordersTab settings implementation
  - Remove manual `const i18n = getI18n()` declarations
  - Replace createFragment calls with this.createMultiLineDesc() for complex descriptions
  - Update periodicNote, templatePlugin, and recordingContents sections
  - _Requirements: 2.3, 2.4_

- [x] 7. Update remaining settings tabs (TimersTab, WidgetTab, StatusBarTab)
  - Apply consistent i18n pattern to all remaining tabs
  - Replace manual fragment building with helper methods
  - Ensure all multi-line descriptions use new translation structure
  - _Requirements: 2.3, 2.4_

- [ ]* 7.1 Write property test for backward compatibility preservation
  - **Property 7: Backward compatibility preservation**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [ ] X. User-feedback
  - Do nothing except: ask user if there's anything else to improve or add for the i18n
  - _Requirements: 2.3, 2.4_

- [ ] 8. Performance optimization and caching
  - Implement translation lookup caching in I18nManager
  - Optimize fragment building to minimize DOM operations
  - Add efficient memory management for i18n instances
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 8.1 Write property test for performance optimization
  - **Property 8: Performance optimization**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 9. Integration testing and validation
  - Test complete settings UI with enhanced i18n system
  - Verify language switching works across all tabs
  - Validate backward compatibility with existing translation keys
  - Test performance under realistic usage scenarios
  - _Requirements: All requirements integration_

- [ ] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation maintains backward compatibility throughout the process
- Performance optimizations are implemented incrementally to avoid breaking changes