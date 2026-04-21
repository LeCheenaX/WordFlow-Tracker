export const currentPluginVersion = '2.2.1';

export const changelog = {
'en': 
`
### 2.2.1 updates
🐛 **Bug Fixed:**
- Syntax change only updated today's note: now scans the entire folder for all periodic notes matching the format and containing data in the old syntax, and updates them all.

### 2.2.0 updates
✨ **New Features:**
- AI Diff Summary: Automatically generate a summary of note changes using LLM integration.
    - BYOK: Bring Your Own Key. You can use your own OpenAI API key to call LLM.

![example](https://github.com/user-attachments/assets/fc2e58f8-0a91-4faa-8d62-ab2b23cb72e3)

>[!Caution]
> If enabled this feature, an temporary index file will be created in \`.obsidian/\` folder, which can be syncronized by Obsidian or third party services。

### 2.1.0 updates
✨ **New Features:**
- Option to show and rank note properties. 
   - To show note properties of each note recorded in daily note: use \`\${property.propertyName}\` in the table syntax. For example: \`\${property.tags}\` will list all tags for each note. 
   - To rank note properties, the property type must be numbers. You can set alias for the note property in widget settings, and drop out the available properties in the widget. 

🐛 **Bugs Fixed:**
- Unability to count the edited words accurately in markdown table([issue #14](https://github.com/LeCheenaX/WordFlow-Tracker/issues/14)).
- Data racing issue when current data is updated in widget.
- Notes are not recorded when focused time is enough.
- Heatmap view sometimes may not be updated.
- Widget View frequently refreshing while editing the documents.

### 2.0.1 updates

✨ **New Features:**
- Option to ignore warnings: You can now choose to hide warning messages in settings for a cleaner experience.
- Heatmap view improvements:
    - Change time range: Select different time periods to view in the heatmap.
    - Smart cell sizing: Heatmap cells now automatically adjust to fit your sidebar width perfectly.
    - Week start day customization: Choose which day your week starts on in the heatmap view (Sunday or Monday).

🐛 **Bug Fixed:**
- Resolved a rare case where document word count could show negative values([issue #14](https://github.com/LeCheenaX/WordFlow-Tracker/issues/14)).
- Widget view now updates correctly on first launch when the plugin view is attached to the workspace.

### 2.0.0 updates

>[!caution]
>Weekly note, monthly note users should be careful:
>- if the periodic note title format is not a safe usecase of \`moment.js\`, you will be prompted to change title format or revert to 1.7.x version.
>- you should assign a property to mark your recorder as non-daily-note for best compatibility
>	- this feature is introduced in 2.0.0, in plugin settings > recorders > periodic note to record > periodic note type.

>[!important]
>Thanks for the companion and feedbacks in the previous 33 versions of this plugin since 1.0.0. In the future, this plugin will mainly focus on the following functions:
>1. **data analysis** and **periodic summary**
>2. **AI integration**
>
>Any idea or new notion will be warm welcomed by [raising an issue](https://github.com/LeCheenaX/WordFlow-Tracker/issues). You can also fetch the upcoming features in [developing roadmap](https://github.com/LeCheenaX/WordFlow-Tracker/wiki/Development-RoadMap).
>
>If you enjoy WordFlow Tracker, please consider giving it a star ⭐ on GitHub. 
> Your support is the greatest encouragement for me to keep improving this plugin.  
>👉 [Star WordFlow Tracker on GitHub](https://github.com/LeCheenaX/WordFlow-Tracker)
>
>— _LeCheenaX_  
>Thank you for being part of this journey! 🙏

🚀 **Key Insights:**
- New view: heatmap view is available for daily note recorder
- UI and control panel is completely reworked:
    - add view switch button with three modes (file list, tag list, heatmap)
    - add note navigation support for reviewing previous data
    - recorder switching panel is moved to the top of the widget
- Depreciated: \`enable tag-based view\` is replaced by \`default view on open\` in widget settings.

🔥 **Major Updates:**
- Heatmap view: *available for daily note recorder only*
    - Custom color and gradient levels is supported
    - dynamically adapt gradient thresholds to different properties based on existing data in daily notes, which ensures the note will be distributed on all levels for better visual hierarchy
        - hover on the legend to show detailed range
    - consistent behaviors from Obsidian: 
        - click the cell to open note
        - press ctrl + click on cell to open in new tab
        - press ctrl and hover on cell to preview daily note content
- Navigate panel: 
    - hidden by default, hover on the date in widget to show up
    - mark label based on date: today, yesterday, this week, last week, etc.
    - consistent behaviors from Obsidian: 
        - click the cell to open note
        - press ctrl + click on cell to open in new tab

🐛 **Bug Fixed:**
- No information is displayed is selected field has data but all data is zero

⚡️ **Enhancements:**
- Decoupling the function \`getOrCreateRecordNote\` into separate functions
- Improve folder creation logic with better error handling and validation
- Complete missing notification messages translations
- Error notifications will inform which note has issues

🎨 **UI Reworked:**
- New style for dropdown component
- Switching note support with navigation buttons
`,
'zh-CN': 
`
### 2.2.1 更新说明
🐛 **问题修复：**
- 语法变更仅更新今天的笔记：现会扫描整个文件夹中所有符合格式且包含旧语法数据的周期笔记，并全部更新。

### 2.2.0 更新说明
✨ **新功能：**
- AI 更改总结: 自动使用 LLM 总结周期笔记的修改。
    - BYOK: 使用自己的 API 密钥调用 LLM。

![example](https://github.com/user-attachments/assets/fc2e58f8-0a91-4faa-8d62-ab2b23cb72e3)

> [!Caution]
> 开启此功能会在 \`.obsidian/\` 文件夹内创建一个临时索引，可以被同步。

### 2.1.0 更新说明

✨ **新功能：**
- 支持显示和统计笔记属性。
   - 若要在日记记录中显示笔记属性，请在表格语法中使用 \`\${property.属性名称}\`。例如：使用 \`\${property.tags}\` 将列出每篇笔记的所有标签。
   - 若要对笔记属性进行排序/排名，属性类型必须为数字。您可以在组件设置中为笔记属性设置别名，并在组件中选择要展示的属性。

🐛 **问题修复：**
- 修复了无法准确统计 Markdown 表格中已编辑字数的问题（[issue #14](https://github.com/LeCheenaX/WordFlow-Tracker/issues/14)）。
- 修复了组件中更新当前数据时的竞态问题（Data racing）。
- 修复了专注时间足够但笔记未被记录的问题。
- 修复了热力图视图有时无法更新的问题。
- 修复了编辑文档时组件视图频繁刷新的问题。

### 2.0.1 更新说明

✨ **新功能：**
- 忽略警告选项：您现在可以在设置中选择隐藏警告消息，获得更清爽的使用体验。
- 热力图视图改进：
    - 更改时间范围：可选择不同的时间段在热力图中查看。
    - 智能单元格大小：热力图单元格现在会自动调整以完美适配您的侧边栏宽度。
    - 自定义每周起始日：在热力图视图中选择您的一周从哪天开始（周日或周一）。

🐛 **问题修复：**
- 解决了文档字数可能显示为负数的罕见情况([issue #14](https://github.com/LeCheenaX/WordFlow-Tracker/issues/14))。
- 修复了首次启动时，当插件视图附加到工作区时，组件视图无法正确更新的问题。

### 2.0.0 更新说明

>[!caution]
>每周笔记、每月笔记用户请注意：
>- 如果周期笔记的标题格式不是 \`moment.js\` 的安全用例，系统会提示您修改标题格式，或回退至 1.7.x 版本。
>- 为获得最佳兼容性，您应为记录器指定一个属性，将其标记为非日记笔记。
>	- 此功能于 2.0.0 版本引入，路径：插件设置 > 记录器 > 需记录的周期性笔记 > 周期性笔记类型。

>[!important]
>感谢您自 1.0.0 以来在之前的 33 个版本中给予的陪伴与反馈。未来，本插件将主要聚焦于以下功能：
>1. **数据分析**与**周期性总结**
>2. **AI 集成**
>
>任何想法或新概念，都欢迎通过[提交 Issue](https://github.com/LeCheenaX/WordFlow-Tracker/issues) 与我们分享。您也可以在[开发路线图](https://github.com/LeCheenaX/WordFlow-Tracker/wiki/Development-RoadMap)中了解即将推出的功能。
>
>如果您喜欢 WordFlow Tracker，不妨在 GitHub 上为我们点亮一颗星星 ⭐。  
>您的支持是我持续改进插件的最大动力。  
>👉 [在 GitHub 上为 WordFlow Tracker 点星](https://github.com/LeCheenaX/WordFlow-Tracker)
>
>— _LeCheenaX_  
>感谢您一路同行！ 🙏

🚀 **核心亮点：**
- 新增视图：日记记录器现已支持热力图视图。
- 界面与控制面板完全重构：
    - 增加视图切换按钮，提供三种模式（文件列表、标签列表、热力图）。
    - 增加笔记导航支持，便于回顾历史数据。
    - 记录器切换面板移至组件顶部。
- 弃用：\`启用基于标签的视图\' 已被替换为小部件设置中的 \'打开时默认视图\'.

🔥 **主要更新：**
- 热力图视图：*仅适用于日记*
    - 支持自定义颜色及渐变等级。
    - 根据日记笔记中的现有数据动态调整渐变阈值，确保笔记分布在各等级，以获得更佳的视觉层次。
        - 鼠标悬浮在图例上可查看具体范围
    - 与 Obsidian 一致的操作行为：
        - 点击单元格可打开笔记；
        - 按住 Ctrl 并点击单元格可在新标签页中打开；
        - 按住 Ctrl 并悬停单元格可预览日记笔记内容。
- 导航面板：
    - 默认隐藏，将鼠标悬停于小部件日期上方时显示。
    - 基于日期的标签标记：今天、昨天、本周、上周等。
    - 与 Obsidian 一致的操作行为：
        - 点击单元格可打开笔记；
        - 按住 Ctrl 并点击单元格可在新标签页中打开。

🐛 **问题修复：**
- 修复了当所选字段存在数据但所有数据均为零时，无信息显示的问题。

⚡️ **功能强化：**
- 将 \`getOrCreateRecordNote\` 函数解耦为多个独立函数。
- 改进文件夹创建逻辑，增强错误处理与验证。
- 补全缺失的通知消息翻译。
- 报错通知会显示哪个笔记出现了问题。

🎨 **界面重构：**
- 下拉组件新样式。
- 支持通过导航按钮切换笔记。
`
};