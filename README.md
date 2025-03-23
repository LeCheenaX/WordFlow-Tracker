# Wordflow Tracker
![image](https://img.shields.io/github/v/release/LeCheenaX/WordFlow-Tracker?label=Version&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest) ![image](https://img.shields.io/github/downloads/LeCheenaX/WordFlow-Tracker/total?logo=Obsidian&label=Downloads&labelColor=%237C3AED&color=%235b5b5b&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest)

[中文文档](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md) | [English](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README.md)

## Introduction
WorkFlow Tracker is a lite plugin that track your edits on each note and automatically record these edits statistics to your periodic note, like your daily note. 

![image](https://github.com/user-attachments/assets/64275f7a-81ed-4d5a-aebb-273a135659d6)


### Core Features
- Tracking the number of edits, editied words per note. This will reflect on the status bar at the bottom of note.
  ![image](https://github.com/user-attachments/assets/88e1d16b-893f-46a4-aa66-210a372ef753)
- Record the modified data automatically when the note is closed. Alternatively, use command or button to record all notes. The tracker will be set to 0 once the note is recorded.
- (planned) Display changes in a svg style to show the original contents v.s. modified contents. 
  ![image](https://github.com/user-attachments/assets/b4bc50e8-89d2-4d9f-bf99-2cfcd14e1569)
- Customization of which data to be recorded with ${dataName}, see in [Supported String Interpolations](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#supported-string-interpolations) below. 
- Customization of how the data to be recorded, like inserting a table or a list to the specified position of your note. 
### How does this plugin collect data?

We fetch the edit statistcs by access the history field of Obsidian editor, which is the place to store the undo/redo history of Obsidian. 
- No extra history database is created, thus don't worry about the performance burdens in large vault.
- No extra data file is created or exposed. This resolves the privacy concerns.

> All statics are fetched by diectly reading the Obsidian data, without adding additional thread to record the data, which means that enabling the recording will bring almost no performance loss or extra RAM occupation.
> 
> The temporary edit stats collected by the plugin are destroyed after recording to your note, and the Obsidian will destory the history data after you close the application.  


## Settings documentation
![image](https://github.com/user-attachments/assets/7e9b9d84-ccba-4b59-b542-f551a37b5592)
### Recorder
- **Create**: Create a new recorder so that the edit stats in tracker will be additionally recorded. Common usages are as followed:
	- Create a recorder for another periodic note: current recorder will record to daily note, and you create an additional one to record to monthly note. 
 	- Create a recorder for a different recording type: current recorder will record edits per note as table rows to your daily note, and you create another recorder to record total edits to the YAML of daily notes.

		![image](https://github.com/user-attachments/assets/56a03e3c-930c-4d0e-b901-a07e95099105)
- **Rename**: Rename your recorders.

	![image](https://github.com/user-attachments/assets/1dc7933a-a19f-4804-b636-58045b22e729)

- **Delete**: Delete the current recorder and abandon its settings. 
### Recorder Basics
- **Periodic note folder:** Set the folder for daily notes or weekly note to place, which should correspond to the same folder of Obsidian daily note plugin and of templater plugin(if installed).
	- **Enable dynamic folder:** Record the note to a dynamic folder rather than a static folder. If enabled, the folder must be in a [moment compatible format](https://momentjs.com/docs/#/displaying/format/).
	
	 	| Dynamic folder format  | Corresponding folder in vault | Periodic note format | Note path in vault                |
		| ---------------------- | ----------------------------- | -------------------- | --------------------------------- |
		| [Daily Notes/]YYYY-MM | Daily Notes/2025-03           | YYYY-MM-DD           | Daily Notes/2025-03/2025-03-21.md  |
		| [Monthly Notes/]YYYY  | Monthly Notes/2025            | MMM YYYY             | Monthly Notes/2025/Mar 2025.md     |

- **Periodic note format:** Set the file name for newly created daily notes or weekly note, which should correspond to the same format setting of Obsidian daily note plugin and of templater plugin(if installed).
### Recording Settings
- **Record content type:** Select a type of content to record on specified notes. Currently, table and bullet list are supported.
	- Note: when using a table format, the modified note must be at the first column.  
- **Insert to position:** If using a custom position, the start position and end position must exist and be unique in periodic note! Make sure your template is correctly applied while creating new periodic note.
- **Wordflow recording syntax:** Used for customizaing recording content. The regular expressions are supported with '${modifiedNote}', you can also generate link to the note by using a '[[${modifiedNote}]]'.

### Supported String Interpolations


| String Interpolation   | Description                                                                                                                                                                                         | Compatible Record Types | Example                              | Note                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ${modifiedNote}        | the Obsidian path to modified note                                                                                                                                                                  | table, bullet list     | Daily Notes/2025-03-23.md            | should always be put at the first colomn in a table, or the parent element in a bullet list.                                                                                                              |
| ${editedTimes}         | the number of edits in a period per note.                                                                                                                                                           | table, bullet list     | 100                                  | in Obsidian rule, inputted contents whose intervals are less than 0.5 second will be considered one edit. Each edit can be undone by pressing 'ctrl' + 'z', or redone by pressing 'ctrl' + 'shift' + 'z'. |
| ${editedWords}         | the number of words you edited in a period per note.                                                                                                                                                | table, bullet list     | 550                                  | equals to addedWords + deletedWords                                                                                                                                                                       |
| ${changedWords}        | the net change of  words in a note                                                                                                                                                                  | table, bullet list     | 150                                  | equals to addedWords - deletedWords                                                                                                                                                                       |
| ${deletedWords}        | the number of words you deleted in a period per note.                                                                                                                                               | table, bullet list     | 200                                  |                                                                                                                                                                                                           |
| ${addedWords}          | the number of words you added in a period per note.                                                                                                                                                 | table, bullet list     | 350                                  |                                                                                                                                                                                                           |
| ${docWords}            | the number of words per document, by the end of last recording.                                                                                                                                     | table, bullet list     | 1000                                 | includes words in YAML(Fromtmatter), which is not included in Obsidian **word count** core plugin.                                                                                                        |
| ${editedPercentage}    | (Alpha testing) the rate of edited words to the total words(edited + original), in a period of editing per note. Very useful when you want to track if the edits are little changes or huge efforts | table, bullet list     | 55%                                  | the content is html format, and will be styled to a string. (Using string directly is abandoned due to the growing loss of accuracy with the recorder updates this string. )                              |
| ${statsBar}            | (Alpha testing) the portion of original words, deleted words and added words in html format.  Very useful when you want to track if the edits are little changes or huge efforts                    | table                  | ![image](https://github.com/user-attachments/assets/c0d929a7-5ea8-4172-9d85-5de5f46e02bd) | the content will be styled to a svg bar, whose color can be customized in styles.css. Example uses the portion of 450:200:150                                                                                                                     |
| ${lastModifiedTime}    | the last modified time of your note that is recorded to periodic note, you can specify the format of this item in plugin settings                                                                   | table, bullet list     | 2025-03-23 16:00                     |                                                                                                                                                                                                           |
| ${totalEdits}          | the total number of edits of all notes you edited in a period.                                                                                                                                      | metadata               | 200                                  | can be used for other plugins, such as generating a heatmap                                                                                                                                               |
| ${totalWords}          | the total number of edited words of all notes you edited in a period.                                                                                                                               | metadata               | 2000                                 | can be used for other plugins, such as generating a heatmap                                                                                                                                               |



## Development Roadmap
See [Development Roadmap](https://github.com/LeCheenaX/WordFlow-Tracker/wiki/Development-RoadMap) for known issues and planned features! 

## Installation
### Manually installing the plugin

Copy over `main.js`, `manifest.json`, `styles.css` to your vault `VaultFolder/.obsidian/plugins/wordflow-tracker/`.

### Install via BRAT
See [BRAT docs](https://github.com/TfTHacker/obsidian42-brat).

## Similar plugins
This lite plugin tries to offer unique experience for tracking edits periodically with least obstacles. However, you can try the following alternatives if interested: 
- [Obsipulse plugin](https://github.com/jsifalda/obsipulse-plugin)
- [Daily File Logger](https://github.com/ashlovepink/daily-file-logger)
