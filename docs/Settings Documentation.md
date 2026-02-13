## Settings documentation
### General 
- **Threshold for notes to record in edit mode**: Select a requirement for notes to be recorded in live preview and source mode.
	- Require edits means you should at least type anything or delete anything, even just a space.
	- Require focus time means you should leave the note under edit mode over 1 minute.
	- If require none above, the recorder will track all files you opened under edit mode.
- **Notes to record while quitting editing mode**: Select the behavior when switching a note from editing mode to reading mode.
	- Editing mode includes live preview and source mode.
	- If recording current note only, other notes may not be automatically recorded if you don't manually record.
- **Quick Reference**: Access essential plugin documentation and string interpolation reference directly from the settings page for quick lookup while configuring your recorders.
- **Link Format Compliance**: Newly generated links now follow your Obsidian link format settings (shortest path, relative path, or absolute path) instead of always using vault absolute paths. This ensures consistency with your vault's link management preferences.

### Focus Mode

When you are editing the notes, the number of edits you made, your edited words, the time you are on editing, etc. These statistics will automatically be tracked, and be recorded if you specify them in the wordflow recording syntax. 

However, since [version 1.5.0](https://github.com/LeCheenaX/WordFlow-Tracker/releases/tag/1.5.0), the focus mode is introduced to track more about the time. 

![Pasted image 20250706220031](https://github.com/user-attachments/assets/b3c568e2-f460-43d8-af8e-5ca35866bb2b)

In focus mode, the tracker will not only track the statistics in edit mode, but also the time you spent on each note in reading mode. This mainly does 3 things:
- record the reading time for each note
- record the editing time for each note, and the total time of editing and reading
- record other statistics in edit mode

> Note: moreover, the timer willl **no longer be interrupted** if you click elsewhere than the note in Obsidian, in focus mode. If not in focus mode, the timer will suspend immediately if you click the side pane, the ribbon, the settings, etc.

- **To enter focus mode**, kindly click the "play" button in the widget. 

- **In the focus mode**, the timer will automatically pause if idled for a long time. You can also manually pause the timer to suspend the focusing, and take a rest. 

  ![Pasted image 20250706221003](https://github.com/user-attachments/assets/5beb5412-2be1-4e9f-8b24-78c84a0b0131)

- **To quit focus mode**, you can kindly click the "save" button. And the statistics will automatically be recorded after quiting. 

  ![Pasted image 20250706221154](https://github.com/user-attachments/assets/669ba1f3-ff99-4d6b-b84d-3a8b072c324a)

- **Auto-resume after idle pause**: When enabled, focus mode will automatically resume tracking after an idle pause without requiring manual intervention. This ensures continuous time tracking even during brief interruptions or breaks.

### Localization

WordFlow Tracker now supports full localization with complete translations for:
- All settings and configuration options
- Notification messages and prompts
- Commands and UI elements
- Changelog and update logs

Currently supported languages:
- English
- Chinese (Simplified)

The plugin automatically detects your Obsidian language setting and displays the appropriate translation.

### Recorder
- **Create**: Create a new recorder so that the edit stats in tracker will be additionally recorded. Common usages are as followed:
	- Create a recorder for another periodic note: current recorder will record to daily note, and you create an additional one to record to monthly note. 
 	- Create a recorder for a different recording type: current recorder will record edits per note as table rows to your daily note, and you create another recorder to record total edits to the YAML of daily notes.

		![image](https://github.com/user-attachments/assets/56a03e3c-930c-4d0e-b901-a07e95099105)
- **Rename**: Rename your recorders.
- **Delete**: Delete the current recorder and abandon its settings. 
#### Recorder Basics
- **Periodic note folder:** Set the folder for daily notes or weekly note to place, which should correspond to the same folder of Obsidian daily note plugin and of templater plugin(if installed).
	- **Enable dynamic folder:** Record the note to a dynamic folder rather than a static folder. If enabled, the folder must be in a [moment compatible format](https://momentjs.com/docs/#/displaying/format/).
	
	 	| Dynamic folder format  | Corresponding folder in vault | Periodic note format | Note path in vault                |
		| ---------------------- | ----------------------------- | -------------------- | --------------------------------- |
		| [Daily Notes/]YYYY-MM | Daily Notes/2025-03           | YYYY-MM-DD           | Daily Notes/2025-03/2025-03-21.md  |
		| [Monthly Notes/]YYYY  | Monthly Notes/2025            | MMM YYYY             | Monthly Notes/2025/Mar 2025.md     |

- **Periodic note format:** Set the file name for newly created daily notes or weekly note, which should correspond to the same format setting of Obsidian daily note plugin and of templater plugin(if installed).
- **Template plugin:**
	- If you are using templater folder template feature, the default option should be selected, which will delegate the template applying to templater plugin.
 	- If you have your own method(scripts or other plugins) of applying templates after creating note in the folder, kindly also use the default option. You can ignore the templater plugin not enabled prompt in this case. 
  	- If you are using the obsidian core plugin "templates", select the "templates" option. This will apply the template you specified to periodic notes. 
#### Recording Settings
- **Record content type:** Select a type of content to record on specified notes. Currently, table and bullet list are supported.
	- Note: when using a table format, the modified note must be at the first column.  
- **Insert to position:** If using a custom position, the start position and end position must exist and be unique in periodic note! Make sure your template is correctly applied while creating new periodic note.
- **Wordflow recording syntax:** Used for customizing recording content. Regular expressions are supported with '${modifiedNote}', you can also generate links to notes by using '[[${modifiedNote}]]'.
- **Preview Recording Syntax**: Before applying changes to your recording syntax, you can preview how the result will look. This helps validate your configuration and ensures the output matches your expectations.
- **Adapt Existing Records**: When you change your recording syntax, the plugin can prompt you to adapt existing records in your periodic notes to match the new format. A preview is shown before applying changes, giving you full control over the migration.
- **Auto-clear Records for Deleted Files**: When enabled, the plugin will automatically remove records for files that have been deleted from your vault, keeping your periodic notes clean and up-to-date.

#### Supported String Interpolations

| String Interpolation | Description                                                                                                                                                                         | Compatible Record Types | Example                                                                                   | Note                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ${modifiedNote}      | the Obsidian path to modified note                                                                                                                                                  | table, bullet list      | Daily Notes/2025-03-23.md                                                                 | should always be put at the first colomn in a table, or the parent element in a bullet list.                                                                                                                                                                                                                                                     |
| ${noteTitle}         | the basename of modified note, without '.md' suffix.                                                                                                                                | table, bullet list      | 2025-03-23, Untitled, My Note Name                                                        | can be used independantly or as an alias for the link. Attention: When used as an alia, must use this format: [[${modifiedNote}\\\|${noteTitle}]] in table syntax (with **one back slash** before the separator '\|'), and this format: [[${modifiedNote}\|${noteTitle}]] in bullet list syntax (with **no back slash** before the separator '\|') |
| ${editedTimes}       | the number of edits in a period per note. (**different from** ${editTime})                                                                                                          | table, bullet list      | 100                                                                                       | in Obsidian rule, inputted contents whose intervals are less than 0.5 second will be considered one edit. Each edit can be undone by pressing 'ctrl' + 'z', or redone by pressing 'ctrl' + 'shift' + 'z'.                                                                                                                                        |
| ${editedWords}       | the number of words you edited in a period per note.                                                                                                                                | table, bullet list      | 550                                                                                       | equals to addedWords + deletedWords                                                                                                                                                                                                                                                                                                              |
| ${changedWords}      | the net change of words in a note                                                                                                                                                   | table, bullet list      | 150                                                                                       | equals to addedWords - deletedWords                                                                                                                                                                                                                                                                                                              |
| ${deletedWords}      | the number of words you deleted in a period per note.                                                                                                                               | table, bullet list      | 200                                                                                       |                                                                                                                                                                                                                                                                                                                                                  |
| ${addedWords}        | the number of words you added in a period per note.                                                                                                                                 | table, bullet list      | 350                                                                                       |                                                                                                                                                                                                                                                                                                                                                  |
| ${docWords}          | the number of words per document, by the end of last recording.                                                                                                                     | table, bullet list      | 1000                                                                                      | includes words in YAML(Fromtmatter), which is not included in Obsidian **word count** core plugin.                                                                                                                                                                                                                                               |
| ${editTime}          | the time when each note is under editing mode and not idle for a period.                                                                                                            | table, bullet list      | 1 h 0 min, 6 min                                                                          | when idled, the timer will automatically pause, and you can click the doc or make any changes to reactivate it. (this is **different from** ${editedTime})                                                                                                                                                                                       |
| ${readTime}          | the time when each note is under reading mode and not idle for a period.                                                                                                            | table, bullet list      | 1 h 0 min, 6 min                                                                          | will only increase in focus mode; when idled, the timer will automatically pause, and you can continue focusing by clicking the "play" button on widget                                                                                                                                                                                          |
| ${readEditTime}      | the total of readTime and editTime                                                                                                                                                  | table, bullet list      | 2 h 0 min, 12 min                                                                         | the reading time part will only increase in focus mode; when idled, the timer will automatically pause, and you can continue focusing by clicking the "play" button on widget                                                                                                                                                                    |
| ${editedPercentage}  | the rate of edited words to the total words(edited + original), in a period of editing per note. Very useful when you want to track if the edits are little changes or huge efforts | table, bullet list      | 55%                                                                                       | the content is html format, and will be styled to a string. (Using string directly is abandoned due to the growing loss of accuracy with the recorder updates this string. )                                                                                                                                                                     |
| ${statBar}           | the portion of original words, deleted words and added words in html format. Very useful when you want to track if the edits are little changes or huge efforts                     | table                   | ![image](https://github.com/user-attachments/assets/c0d929a7-5ea8-4172-9d85-5de5f46e02bd) | the content will be styled to a svg bar, whose color can be customized in styles.css. Example uses the portion of 450:200:150                                                                                                                                                                                                                    |
| ${lastModifiedTime}  | the last modified time of your note that is recorded to periodic note, you can specify the format of this item in plugin settings                                                   | table, bullet list      | 2025-03-23 16:00                                                                          |                                                                                                                                                                                                                                                                                                                                                  |
| ${comment}           | any comment that can be added by the user for existing record in periodic note                                                                                                      | table, bullet list      | this note is completed!                                                                   | this plugin will not modify this value, it's all up to you to add anything.                                                                                                                                                                                                                                                                      |
| ${totalEdits}        | the total number of edits of all notes you edited in a period.                                                                                                                      | metadata                | 200                                                                                       | can be used for other plugins, such as generating a heatmap                                                                                                                                                                                                                                                                                      |
| ${totalWords}        | the total number of edited words of all notes you edited in a period.                                                                                                               | metadata                | 2000                                                                                      | can be used for other plugins, such as generating a heatmap                                                                                                                                                                                                                                                                                      |
| ${totalEditTime}     | the total editing time of all notes you edited in a period.                                                                                                                         | metadata                | 1 h 13 min                                                                                | can be used for other plugins, such as generating a heatmap                                                                                                                                                                                                                                                                                      |
| ${totalReadTime}     | the total reading time of all notes you focused on.                                                                                                                                 | metadata                | 1 h 20 min                                                                                | will only increase in focus mode; this can be used for other plugins, such as generating a heatmap                                                                                                                                                                                                                                               |
| ${totalTime}         | the total of reading time and editing time of all notes you focused on.                                                                                                             | metadata                | 2 h 33 min                                                                                | the reading time part will only increase in focus mode; this can be used for other plugins, such as generating a heatmap                                                                                                                                                                                                                         |

### Widget

The widget provides three view modes that you can switch between using the view switch button at the top:

#### View Modes

1. **File List View**: Displays all edited files with their individual statistics
2. **Tag List View**: Groups files by tags with collapsible sections and hierarchical progress bars
3. **Heatmap View**: Visual calendar representation of your productivity (available for daily note recorder only)

#### Widget Settings

- **Default View on Open**: Choose which view mode the widget opens with (File List, Tag List, or Heatmap)

- **Field Aliases**: Customize how field names appear in the widget display
  - Create more readable labels for technical field names
  - Support for multiple languages
  - Improve widget usability with personalized terminology

#### Random Color Generation

These settings control how colors are automatically generated for files that don't have tag-based colors configured. Colors are generated using the HSL (Hue, Saturation, Lightness) color model.

- **Random Color Group Lightness**: Controls the brightness of generated colors (0-100)
  - Lower values (e.g., 30-50): Darker colors, better for light themes
  - Medium values (e.g., 50-70): Balanced colors, works well in most themes
  - Higher values (e.g., 70-90): Lighter colors, better for dark themes
  - Default: 66
  - Recommended examples:
    - Dark theme: 65-75
    - Light theme: 40-55
    - High contrast: 30 or 80

- **Random Color Group Saturation**: Controls the color intensity (0-100)
  - You can specify multiple values separated by spaces to create color variety
  - Lower values (e.g., 20-40): Muted, pastel colors
  - Medium values (e.g., 50-70): Balanced, natural colors
  - Higher values (e.g., 80-100): Vibrant, intense colors
  - Default: 60 85
  - Recommended examples:
    - Subtle palette: 30 45
    - Balanced palette: 60 85 (default)
    - Vibrant palette: 75 90
    - Wide variety: 40 60 80

How it works: The plugin randomly selects hue values (0-360°) and picks one saturation value from your list for each file, creating visually distinct colors while maintaining consistent lightness. Multiple saturation values help differentiate files with similar hues.

Note: Changes take effect after refreshing the widget or reloading the plugin.

#### Heatmap View (Daily Note Recorder Only)

The heatmap view provides a visual calendar representation of your productivity:

- **Custom Colors and Gradients**: Configure color schemes and gradient levels to match your preferences
- **Dynamic Thresholds**: Automatically adapts gradient levels based on your actual data distribution, ensuring notes are distributed across all visual levels for better hierarchy
- **Interactive Navigation**:
  - Click legend to open the note
  - Ctrl+Click to open in a new tab
  - Ctrl+Hover to preview note content
- **Date Navigation Panel**: 
  - Hidden by default, hover over the date in widget to reveal
  - Shows contextual labels: "today", "yesterday", "this week", "last week", etc.
  - Navigate through your history with intuitive controls

#### Tag-Based Colors

Configure custom colors for specific tags to override random color generation:

- **Configure Colors for Tags**: Assign specific colors to files based on their tags
  - Compatible with both file-based view and tag-based view
  - Files with multiple tags will have colors blended
  - Different files with the same tag will auto-distinguish by saturation variations
  - Custom group labels for tag groups (optional)
  - Maximum 10 tag color configurations allowed

When tag-based colors are configured, those files will use the assigned colors. Files without configured tags will use the random color generation settings described above.