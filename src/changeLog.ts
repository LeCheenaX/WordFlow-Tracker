export const currentPluginVersion = '1.5.1';

export const changelog = `
--> Kindly see full change logs including previous versions at [releases](https://github.com/LeCheenaX/WordFlow-Tracker/releases).
### 1.5.1 updates
**Bug Fixed:**
1. MetaData will not update the following properties in 1.5.0:
    1. totalReadTime
    2. totalTime
2. The records on yesterday or earlier will be wrongly recorded on today's note, if Obsidian is opened up to the next day. 
3. Console log pollution in beta version 1.5.0.
4. Changed log version display is not correct. 

### 1.5.0 updates
**New Features:**
1. Side pane widget to display timer and other stats.
2. New interpolation expressions:
    1. \${readTime} to record reading time per note 
    2. \${readEditTime} to combine reading time + editing time per note
    3. \${totalReadTime} for total reading time from all notes
    4. \${totalTime} to combine reading total time + editing total time from all notes
3. Focus mode that could be controled by the widget:
    1. when entering focus mode, the reading time will be recorded, this will accumulate the new fields \${readTime} and \${readEditTime}. 
    2. when focused, the docTracker will no longer be deactivated when you click elsewhere of Obsidian.
    3. when focused, the docTracker will not be really deactivated when mode switched. Instead, it will switch mode to either track editing or track reading.
    4. when pausing from focused, the reading timer will be paused, while the editing timer will still function to accumulate \${editTime} and \${readEditTime}.
    5. when quiting focus mode, the statistics of notes will be recorded to periodic notes.
4. Open files in current tab or in new tab by clicking file entries in the Widget. 
5. Display seconds for the timer in the widget. 
    note: Technically, this could be applied to status bar, existing data in periodic note. However, this is restricted to the timer in widget in this version, as this introduces multiple undefined issues otherwise. 

**Rebuilt:** 
- EditTimer is rebuilt into Timer, with capability of mode detecting.

`;