export const currentPluginVersion = '1.5.4';

export const changelog = {
'en': 
`
### 1.5.3 updates
**New Feature:**
- Option to exclude folders or file tags from being tracked by this plugin, thanks to [@Myrte46](https://github.com/Myrte46).

**Bug Fixed:**
1. The \${docWords} property may be updated by other note.
2. The totalValue in the sidebar widget may not update, if the widget is not updated on today but on the next day.
3. The false positive console error by Obsidian due to the async initialization. This does not affect the usage but just pollute the console logs

### 1.5.2 updates
**Bug Fixed:**
1. The \${statBar} property may be incorrect, which overrides the existing data with new data.
2. Widget view may not initialize properly, if the plugin is set to load with delay(by 3rd party plugin manager plugin) after Obsidian load.

### 1.5.1 updates
**Bug Fixed:**
1. MetaData will not update the following properties in 1.5.0:
    1. totalReadTime
    2. totalTime
2. The records on yesterday or earlier will be wrongly recorded on today's note, if Obsidian is opened up to the next day. 
3. Console log pollution in beta version 1.5.0.
4. Changed log version display is not correct. 
`,
'zh-CN': 
`
### 1.5.3 更新
**新功能：**
- 新增选项可以排除文件夹或文件标签不被此插件追踪，感谢 [@Myrte46](https://github.com/Myrte46)。

**错误修复：**
1. \${docWords} 属性可能会被其他笔记更新。
2. 如果侧边栏组件不是在今天更新而是在第二天更新，侧边栏组件中的 totalValue 可能不会更新。
3. 由于异步初始化导致的 Obsidian 误报控制台错误。这不会影响使用，但会污染控制台日志。

### 1.5.2 更新
**错误修复：**
1. \${statBar} 属性可能不正确，会用新数据覆盖现有数据。
2. 如果插件设置为在 Obsidian 加载后延迟加载（通过第三方插件管理器插件），组件视图可能无法正确初始化。

### 1.5.1 更新
**错误修复：**
1. 在 1.5.0 版本中，元数据不会更新以下属性：
    1. totalReadTime
    2. totalTime
2. 如果 Obsidian 开启到第二天，昨天或更早的记录会被错误地记录在今天的笔记上。
3. 1.5.0 测试版本中的控制台日志污染。
4. 更改日志版本显示不正确。
`
};