# Wordflow Tracker
![image](https://img.shields.io/github/v/release/LeCheenaX/WordFlow-Tracker?label=Version&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest) ![image](https://img.shields.io/github/downloads/LeCheenaX/WordFlow-Tracker/total?logo=Obsidian&label=Downloads&labelColor=%237C3AED&color=%235b5b5b&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest)

**Warning: 1.2 version is very buggy. As multiple classes are rebuilt, please stay in 1.1.1 version for a while until the bugs are fixed. **

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


## Settings that worth mentioning
![image](https://github.com/user-attachments/assets/6a1544be-a579-4744-8391-bf0e1c8fa298)
### Basic
- **Periodic note folder：** Set the folder for daily notes or weekly note to place, which should correspond to the same folder of Obsidian daily note plugin and of templater plugin(if installed).
- **Periodic note format：** Set the file name for newly created daily notes or weekly note, which should correspond to the same format setting of Obsidian daily note plugin and of templater plugin(if installed).
### Recording Settings
- **Record content type:** Select a type of content to record on specified notes. Currently, table and bullet list are supported.
	- Note: when using a table format, the modified note must be at the first column.  
- **Insert to position:** If using a custom position, the start position and end position must exist and be unique in periodic note! Make sure your template is correctly applied while creating new periodic note.
- **Wordflow recording syntax:** Used for customizaing recording content. The regular expressions are supported with '${modifiedNote}', you can also generate link to the note by using a '[[${modifiedNote}]]'.

### Supported String Interpolations
| String Interpolation  | Description |
| ------------------- | ------------------- |
| ${modifiedNote}    | the Obsidian path to modified note |
| ${editedWords} | the number of words you edited in a period per note |
| ${editedTimes} | the number of edits in a period per note. In Obsidian rule, if you input 2 characters in more than 0.5 second, they will be considered 2 edits |
| ${editedPercentage} | (Alpha testing) the rate of edited words of original words, in a period of editing per note. Very useful when you want to track if the edits are little changes or huge efforts |
| ${lastModifiedTime} | the last modified time of your note that is recorded to periodic note, you can specify the format of this item in plugin settings |

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
