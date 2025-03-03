## Introduction
![image](https://github.com/user-attachments/assets/e8af3671-0277-4d35-9161-4b9df8e2f0fb)

WorkFlow Tracker is a lite plugin that track your edits on each note and automatically record these edits statistics to your periodic note, like your daily note. 

You can customize which data to be recorded in [[#Supported regular expressions]] below. 

You can also customize how the data to be recorded, like inserting a table or a list to the specified position of your note. 

![44b4ed09c7c6821f4ace21393df0395](https://github.com/user-attachments/assets/36fdf7f9-173d-46f5-bb92-b7ce5b634b03)


### How does this plugin collect data?
> All statics are fetched by diectly reading the Obsidian data, without adding additional thread to record the data, which means that enabling the recording will bring almost no performance loss or extra RAM occupation.

We fetch the edit statistcs by access the history field of Obsidian editor, which is the place to store the undo/redo history of Obsidian. No extra history database is created, thus don't worry about the burdens in large vault. 

## Supported regular expressions
| Regular Expression  | Description |
| ------------------- | ------------------- |
| ${modifiedNoteName}    | the name of modified note |
| ${editedWords} | the number of words you edited in a period per note |
| ${editedTimes} | the number of edits in a period per note. In Obsidian rule, if you input 2 characters in more than 0.5 second, they will be considered 2 edits |
| ${editedPercentage} | the rate of edited words of original words, in a period of editing per note. Very useful when you want to track if the edits are little changes or huge efforts |
| ${lastModifiedTime} | the last modified time of your note that is recorded to periodic note, you can specify the format of this item in plugin settings |


## Manually installing the plugin

Copy over `main.js`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/wordflow-tracker/`.

