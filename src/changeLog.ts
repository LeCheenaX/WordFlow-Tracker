export const currentPluginVersion = '1.5.3';

export const changelog = `
--> Kindly see full change logs including previous versions at [releases](https://github.com/LeCheenaX/WordFlow-Tracker/releases).
### 1.5.3 updates
**New Feature:**
- Option to exclude folders or file tags from being tracked by this plugin, thanks to [@Myrte46](https://github.com/Myrte46).

**Bug Fixed:**
1. The \${docWords} property may be updated by other note.
2. The totalValue in the sidebar widget may not update, if the widget is not updated on today but on the next day.
3. The false positive console error by Obsidian due to the async initialization. This does not affect the usage but just pollute the console logs

### 1.5.2 updates
**Bug Fixed:**
1. The \${statBar} property may be incorrect, which overrides the existing data with new data.
2. Widget view may not initialize properly, if the plugin is set to load with delay(by 3rd party plugin manager plugin) after Obsidian load.

### 1.5.1 updates
**Bug Fixed:**
1. MetaData will not update the following properties in 1.5.0:
    1. totalReadTime
    2. totalTime
2. The records on yesterday or earlier will be wrongly recorded on today's note, if Obsidian is opened up to the next day. 
3. Console log pollution in beta version 1.5.0.
4. Changed log version display is not correct. 
`;