# Wordflow Tracker
![image](https://img.shields.io/github/v/release/LeCheenaX/WordFlow-Tracker?label=Version&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest) ![image](https://img.shields.io/github/downloads/LeCheenaX/WordFlow-Tracker/total?logo=Obsidian&label=Downloads&labelColor=%237C3AED&color=%235b5b5b&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest)

[中文文档](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md) | [English](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file)

![image](https://github.com/user-attachments/assets/7a39fcb6-d660-4fd2-a658-b1a1076ddcf3)

## Introduction
WordFlow Tracker is a lite plugin that tracks your focused time and edit statistics on each note and automatically records to your daily note or periodic notes. 

![wordflow155](https://github.com/user-attachments/assets/84446e86-da99-47fe-b282-ff559e53d265)

### Core Features
- Tracking the focused time, number of edits, edited words per note. Customize status bar content with field aliases for personalized display.
  
  ![image](https://github.com/user-attachments/assets/51ce15a6-a935-46c2-9676-5525bd6b092f)
  
  ![image](https://github.com/user-attachments/assets/8422a96d-0ab5-417a-a474-7a838825de1e)
- Record the modified data automatically when the note is closed. Alternatively, use command or button to record all notes.
- Display the changes in the side pane widget. Switch between three view modes: file list, tag list, and heatmap (daily note recorder only).
  
  ![Pasted image 20250706223743](https://github.com/user-attachments/assets/6edc1be0-f262-4054-8803-1b1b37caeec7)
- Display changes in a bar style to show the portion of original contents(yellow) v.s. modified contents(red: deleted words, green: added words).

  ![image](https://github.com/user-attachments/assets/6c977b5f-0aba-4481-847b-f0fda6c5cd98)
- Display the portions of statistics with multiple views:
    - file list view:

      <img width="410" height="240" alt="image" src="https://github.com/user-attachments/assets/afd8a8c7-45bb-43ab-b84a-96f3de4d08e0" />
    - tag list view: *with collapsible groups and dual-layer progress bars*

      <img width="409" height="341" alt="image" src="https://github.com/user-attachments/assets/cbef9fff-6eaf-4c5b-accd-d70b44b0264d" />
    - heatmap view with custom color gradients and note navigation:
    

- Record edited statistics such as total words you edited today, to the YAML(Frontmatter) of daily note. Other plugins such as heatmap could use these metadata to generate analysis.

  ![image](https://github.com/user-attachments/assets/1e5bbe85-a943-4d10-b81c-ecef5e6b15bb)
- Customization of which data to be recorded with ${dataName}, see in [Supported String Interpolations](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file#supported-string-interpolations) below. 
- Customization of how the data to be recorded, like inserting a table or a list to the specified position of your note. Preview recording syntax before applying changes. 
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
See [settings documentation](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/docs/Settings%20Documentation.md). 

## Development Roadmap
See [Development Roadmap](https://github.com/LeCheenaX/WordFlow-Tracker/wiki/Development-RoadMap) for known issues and planned features! 

Want to know how this project is built? Or wanna collaborate on this plugin? See details at https://deepwiki.com/LeCheenaX/WordFlow-Tracker

![Downloads trend](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/miscellaneous/cumulative_downloads_trend.png)

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
- [Yourpulse plugin](https://github.com/jsifalda/obsipulse-plugin) 
- [Daily File Logger](https://github.com/ashlovepink/daily-file-logger)
- [Obsidian toggl integration](https://github.com/mcndt/obsidian-toggl-integration)
