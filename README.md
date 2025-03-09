## Introduction
WorkFlow Tracker is a lite plugin that track your edits on each note and automatically record these edits statistics to your periodic note, like your daily note. 

![image](https://github.com/user-attachments/assets/bb8e3ba5-7e10-4576-b8b3-0d839a7ffa2f)




## Core Features
- Tracking the number of edits, editied words per note. This will reflect on the status bar at the bottom of note. 
- Record the modified data automatically when the note is closed. Alternatively, use command or button to record all notes. The tracker will be set to 0 once the note is recorded.
- (planned) Display changes in a svg style to show the original contents v.s. modified contents. 
- ![image](https://github.com/user-attachments/assets/b4bc50e8-89d2-4d9f-bf99-2cfcd14e1569)
- Customization of which data to be recorded with ${dataName}, see in [[#Supported String Interpolations]] below. 
- Customization of how the data to be recorded, like inserting a table or a list to the specified position of your note. (Currently only have one option to insert to the bottom)

### How does this plugin collect data?
> All statics are fetched by diectly reading the Obsidian data, without adding additional thread to record the data, which means that enabling the recording will bring almost no performance loss or extra RAM occupation.

We fetch the edit statistcs by access the history field of Obsidian editor, which is the place to store the undo/redo history of Obsidian. No extra history database is created, thus don't worry about the burdens in large vault. 
## Settings 
![44b4ed09c7c6821f4ace21393df0395](https://github.com/user-attachments/assets/36fdf7f9-173d-46f5-bb92-b7ce5b634b03)
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

## Manually installing the plugin

Copy over `main.js`, `manifest.json`, `styles.css` to your vault `VaultFolder/.obsidian/plugins/wordflow-tracker/`.

