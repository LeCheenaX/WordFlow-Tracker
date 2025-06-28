export const currentPluginVersion = '1.4.3';

export const changelog = `
--> Kindly see full change logs including previous versions at [releases](https://github.com/LeCheenaX/WordFlow-Tracker/releases).

### 1.4.3 updates 
**Bug Fixed:**
1. The YAML recorder may unexpectedly add an empty line to the YAML.
2. The empty comment may be ignored by the table parser, leading to the column after the comment be extracted instead.
3. The noteThredhold not working when using command, ribbon button, or auto recording interval timed out.

**Feature:**
- Support core plugin "Templates" when creating periodic note. (fixes [issue 5](https://github.com/LeCheenaX/WordFlow-Tracker/issues/5))
- Reviewing changelogs when updates the plugin. 

**Enhancements:**
- New Settings with preview feature and validation check!

**Rebuilt:**
- Settings page are rebuilt to preview user input at real time, and validate legal inputs. 

### 1.4.2 updates
**Bug Fixed:**
- (Emergent fix) **The rebuilt logic could now record other notes in edit mode correctly**.
- Require none option is no longer flawed, now it can trigger the correct recording only when mode switched, and no longer trigger recording on active leaf change.
- Mode switch checking returns false if the note is in edit mode when enabling the plugin, after which is switched to reading mode.

**New features:**
- Option to choose whether auto record other notes in edit mode when quiting editing mode.
- Option to control status bar on mobile device.

**Enhancement:**
- Safer mode-switch checking

**Rebuilt:**
- Recording logics, now will only trigger recording on mode switch, and no longer triggers recording on active leaf change.
- Function 'getAllOpenedFiles()' will now return the mode of last active view, if the same file is opened in multiple tabs and the modes of tabs are different

### 1.4.1 updates
**Bug Fixed:**
- Status bar will update as expected if switched mode twice in a second, while maintain the ability added in 1.3.1 to update as expected when edit sth and immediately open a new note.
- Updates from prev-1.4.0 versions will now have no influence if not using new features. In 1.4.0, users may have to tolerate potential bugs from new features.

**Rebuilt:**
- Rebuilt the filter notes to record behavior, now we use mode switch rather than toggle button to control.
- No longer frequently create docTracker when switching mode, now only do this when new note opens. This is for the 1.5 version to record focused time under reading mode.
- The getAllOpenedFiles function will now get mode of current file

**Caution:**
- The new option: require none in notesToRecord is flawed: It should not trigger recording when active leaf changes but current view is reading mode (brought by getAllOpenedFiles rebuilding)

`;