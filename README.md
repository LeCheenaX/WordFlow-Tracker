# Wordflow Tracker
![image](https://img.shields.io/github/v/release/LeCheenaX/WordFlow-Tracker?label=Version&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest) ![image](https://img.shields.io/github/downloads/LeCheenaX/WordFlow-Tracker/total?logo=Obsidian&label=Downloads&labelColor=%237C3AED&color=%235b5b5b&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest)

[中文文档](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md) | [English](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file)

## Introduction
WordFlow Tracker is a lite plugin that track your focused time and edits statistics on each note and automatically record to your daily note or periodic notes. 

![wordflow3](https://github.com/user-attachments/assets/e323477d-d38e-4a6c-8d98-83bda5818a07)

### Core Features
- Tracking the focused time, number of edits, editied words per note. This will reflect on the status bar at the bottom of note.
  ![image](https://github.com/user-attachments/assets/51ce15a6-a935-46c2-9676-5525bd6b092f)
- Record the modified data automatically when the note is closed. Alternatively, use command or button to record all notes. 
- Display changes in a bar style to show the portion of original contents v.s. modified contents. 
  ![image](https://github.com/user-attachments/assets/6c977b5f-0aba-4481-847b-f0fda6c5cd98)
- Record edited statistics such as total words you edited today, to the YAML(Frontmatter) of daily note. Other plugins such as heatmap could use these metadata to generate analysis.

  ![image](https://github.com/user-attachments/assets/1e5bbe85-a943-4d10-b81c-ecef5e6b15bb)
- Customization of which data to be recorded with ${dataName}, see in [Supported String Interpolations](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#supported-string-interpolations) below. 
- Customization of how the data to be recorded, like inserting a table or a list to the specified position of your note. 
### How does this plugin collect data?

We fetch the edit statistcs by access the history field of Obsidian editor, which is the place to store the undo/redo history of Obsidian. 
- No extra history database is created, thus don't worry about the performance burdens in large vault.
- No extra data file is created or exposed. This resolves the privacy concerns.

> All statics are fetched by diectly reading the Obsidian data, without adding additional thread to record the data, which means that enabling the recording will bring almost no performance loss or extra RAM occupation.
> 
> The temporary edit stats collected by the plugin are destroyed after recording to your note, and the Obsidian will destory the history data after you close the application.  

### Guide for beginners
Step 1: Download and [install](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#installation) the plugin.

Step 2: Enable the plugin in Obsidian > Settings > Community plugins.

Step 3: In Wordflow Tracker settings, specify your [periodic note folder](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#recorder-basics) for placing your periodic notes, in which the edit stats will be saved.

Now the plugin will automatically track the edits you made and display them in the status bar. The edits stats will also be recorded to your periodic note, when any one of the following is met:
1. you switch from editing mode to reading mode in Obsidian;
2. you close a tab of notes after editing them;
3. you manually click the button "Record wordflows from edited notes" in the left ribbon of Obsidian;
4. you manually run the command "Record wordflows from edited notes to periodic notes" in Obsidian;
5. the automatic recording interval is timed out, which could be set in the setting of Wordflow Tracker plugin, to record all edited notes.

Note: the tracker will be set to 0 once the note is recorded.

### Advanced guide for customization
#### Apply templates to newly created notes before recording
Make sure your template will be applied to notes under the same [periodic note folder](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#recorder-basics). 

If your newly created notes will be renamed by other plugins, such as **Templates**(core plugin) or **Templater**(community plugin), make sure that the name that other plugin specified is the same as [periodic note format](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#recorder-basics)

#### Customize which data to be recorded
In wordflow recording syntax, you can add or delete the data in one of the following formats:

- **Table:**

    Open any note in Obsidian, and add a blank table with:
  
	| |
	|-|
	| |

    Then, specify the name in heading for ${modifiedNote}, such as "Note Name" and add "${modifiedNote}" to the row.
  
    ![image](https://github.com/user-attachments/assets/de0e8909-727e-44d2-9cec-c647d51af48c)

    Now click the 'add column after' button, and specify the new heading names and any [string interpolations](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#supported-string-interpolations) you would like.

    ![image](https://github.com/user-attachments/assets/0027b8f9-49f9-4f25-a8b4-38d369c6a115)

    Lastly, select and copy the whole table, and paste it into Wordflow Tracker settings.

	![image](https://github.com/user-attachments/assets/de26aee0-e051-42b6-8fc1-e18e41db2f60)

    Note: ${modifiedNote} must exist in the table syntax, or the recorder will have trouble merging the existing data of note with the new data

- **Bullet List:** 

    Add a linebreak, press the tab key for proper spacing, and specify any name you expect for this data. 
	
    Lastly, add a [string interpolations](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#supported-string-interpolations) like "${docWords}"

    ![image](https://github.com/user-attachments/assets/288f6fa4-1d0a-4187-aa9d-4b6b7e90e7bc)

    Note: ${modifiedNote} must exist in the bullet list syntax, or the recorder will have trouble merging the existing data of note with the new data
	
- **Metadata:**

    Just like adding a metadata in "source mode", you can add a property name ends with ':', and a [string interpolations](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#supported-string-interpolations) after it, like "${totalWords}"

#### Record edit stats to both note content and yaml(frontmatter)
In plugin settings, create a recorder by clicking the add button:

![image](https://github.com/user-attachments/assets/a1eff9ee-6d56-4ebe-9d07-aaa3ca004d6e)

Then, adjust the perodic note folder and note format to the same as the other recorder, to record on the same note. 

Lastly, adjust the record content type to a different one. 

Note that you should **avoid having the same record content type of 2 recorders that target on the same note**. For example, avoid having one recorder which inserts table to the bottom of today's daily note, while having the other recorder which inserts table to a custom position of today's daily note. 

#### Record edit stats to a dynamic folder
You can record edit statistics to not only a static folder, such as "Daily Notes/2025-03-23.md", but also on a dynamic folder like: "Daily Notes/2025-03/2025-03-23.md".

For details regarding how to implement this, see [Enable dynamic folder](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#recorder-basics)

Please also ensure that this folder is the same folder where templates from other plugin will be applied. 

## Settings documentation
### General 
- **Threshold for notes to record in edit mode**: Select a requirement for notes to be recorded in live preview and source mode.
	- Require edits means you should at least type anything or delete anything, even just a space.
	- Require focus time means you should leave the note under edit mode over 1 minute.
	- If require none above, the recorder will track all files you opened under edit mode.
 - **Notes to record while quiting editing mode**: Select the behavior when switching a note from editing mode to reading mode.
	- Editing mode includes live preview and source mode.
	- If recording current note only, other notes may not be automactically recorded if you don\'t manually record.
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
- **Wordflow recording syntax:** Used for customizaing recording content. The regular expressions are supported with '${modifiedNote}', you can also generate link to the note by using a '[[${modifiedNote}]]'.

#### Supported String Interpolations


| String Interpolation   | Description                                                                                                                                                                         | Compatible Record Types | Example                                                                                   | Note                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ${modifiedNote}        | the Obsidian path to modified note                                                                                                                                                  | table, bullet list      | Daily Notes/2025-03-23.md                                                                 | should always be put at the first colomn in a table, or the parent element in a bullet list.                                                                                                              |
| ${noteTitle}           | the basename of modified note, without '.md' suffix.                                                                                                                                | table, bullet list      | 2025-03-23, Untitled, My Note Name                                                        | can be used independantly or as an alias for the link, the latter of which must use this format: [[${modifiedNote}\\\|${noteTitle}]]  (with **one back slash** before the separator '|')                                                                       |
| ${editedTimes}         | the number of edits in a period per note. (**different from** ${editTime})                                                                                                           | table, bullet list      | 100                                                                                       | in Obsidian rule, inputted contents whose intervals are less than 0.5 second will be considered one edit. Each edit can be undone by pressing 'ctrl' + 'z', or redone by pressing 'ctrl' + 'shift' + 'z'. |
| ${editedWords}         | the number of words you edited in a period per note.                                                                                                                                | table, bullet list      | 550                                                                                       | equals to addedWords + deletedWords                                                                                                                                                                       |
| ${changedWords}        | the net change of  words in a note                                                                                                                                                  | table, bullet list      | 150                                                                                       | equals to addedWords - deletedWords                                                                                                                                                                       |
| ${deletedWords}        | the number of words you deleted in a period per note.                                                                                                                               | table, bullet list      | 200                                                                                       |                                                                                                                                                                                                           |
| ${addedWords}          | the number of words you added in a period per note.                                                                                                                                 | table, bullet list      | 350                                                                                       |                                                                                                                                                                                                           |
| ${docWords}            | the number of words per document, by the end of last recording.                                                                                                                     | table, bullet list      | 1000                                                                                      | includes words in YAML(Fromtmatter), which is not included in Obsidian **word count** core plugin.                                                                                                        |
| ${editTime}            | the time when each note is under editing mode and not idle for a period.                                                                                                            | table, bullet list      | 1 h 0 min, 6 min                                                                          | when idled, the timer will automatically pause, and you can click the doc or make any changes to reactivate it. (this is **different from** ${editedTime})                                                |
| ${editedPercentage}    | the rate of edited words to the total words(edited + original), in a period of editing per note. Very useful when you want to track if the edits are little changes or huge efforts | table, bullet list      | 55%                                                                                       | the content is html format, and will be styled to a string. (Using string directly is abandoned due to the growing loss of accuracy with the recorder updates this string. )                              |
| ${statBar}             | the portion of original words, deleted words and added words in html format.  Very useful when you want to track if the edits are little changes or huge efforts                    | table                   | ![image](https://github.com/user-attachments/assets/c0d929a7-5ea8-4172-9d85-5de5f46e02bd) | the content will be styled to a svg bar, whose color can be customized in styles.css. Example uses the portion of 450:200:150                                                                             |
| ${lastModifiedTime}    | the last modified time of your note that is recorded to periodic note, you can specify the format of this item in plugin settings                                                   | table, bullet list      | 2025-03-23 16:00                                                                          |                                                                                                                                                                                                           |
| ${comment}             | any comment that can be added by the user for existing record in periodic note                                                                                                      | table, bullet list      | this note is completed!                                                                   | this plugin will not modify this value, it's all up to you to add anything.                                                                                                                               |
| ${totalEdits}          | the total number of edits of all notes you edited in a period.                                                                                                                      | metadata                | 200                                                                                       | can be used for other plugins, such as generating a heatmap                                                                                                                                               |
| ${totalWords}          | the total number of edited words of all notes you edited in a period.                                                                                                               | metadata                | 2000                                                                                      | can be used for other plugins, such as generating a heatmap                                                                                                                                               |
| ${totalEditTime}       | the total editing time of all notes you edited in a period.                                                                                                                         | metadata                | 1 h 13 min                                                                                | can be used for other plugins, such as generating a heatmap                                                                                                                                               |



## Development Roadmap
See [Development Roadmap](https://github.com/LeCheenaX/WordFlow-Tracker/wiki/Development-RoadMap) for known issues and planned features! 

What to know how this project is built? Or wanna collaborate on this plugin? See details at https://deepwiki.com/LeCheenaX/WordFlow-Tracker

## Installation
### Install in Obsidian
Open obsidian settings > community plugins > browse，in the pop up windows, search for Wordflow Tracker, and click the install button. 

After installed, click the enable button to start the experience.

### Manually installing the plugin

Copy over `main.js`, `manifest.json`, `styles.css` to your vault `VaultFolder/.obsidian/plugins/wordflow-tracker/`.

### Install via BRAT
See [BRAT docs](https://github.com/TfTHacker/obsidian42-brat).

## Similar plugins
This lite plugin tries to offer unique experience for tracking edits periodically with least obstacles. However, you can try the following alternatives if interested: 
- [Obsipulse plugin](https://github.com/jsifalda/obsipulse-plugin)
- [Daily File Logger](https://github.com/ashlovepink/daily-file-logger)
