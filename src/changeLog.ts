export const currentPluginVersion = '1.6.4';

export const changelog = {
'en': 
`
### 1.6.4 updates
🔥 **Key Insights:**
- Tag group based colors. Instead of randomly generated colors for file displaying in the widget, supports custom colors based on the file tags. 

✨ **New Features:**
- Option to automatically resume focus mode after idle pause

🐛 **Bug Fixed:**
- Metadata of the notes may sometimes be duplicated in YAML frontmatter
- Status bar occasionally displaying incorrect content in reading mode
- Fixed settings page auto-closing when plugin is disabled while widget view is active

⚡️ **Enhancements:**
- Improved YAML frontmatter handling using Obsidian's metadataCache API for more reliable metadata operations
- Optimized plugin loading & unloading process to prevent UI conflicts

### 1.6.3 updates
🎨 **UI Enhancement**
- Mobile status bar(if enabled) is now compatible with Obsidian 1.11.x version (Android and iOS).

### 1.6.2 updates
✨ **New Features**
- Quick Reference: In the setting page, offer quick reference to essential plugin documentation and string interpolation reference.
`,
'zh-CN': 
`
### 1.6.4 更新
🔥 **核心亮点：**
- 基于自定义标签组的颜色。侧栏组件中显示的数据可以根据笔记的标签指定显示颜色，让分类更清晰。

✨ **新功能：**
- 新增设置：专注模式因闲置暂停后，回到文档可以自动恢复专注（默认关闭）

🐛 **错误修复：**
- YAML 前置元数据有时会被重复添加的问题
- 状态栏在阅读模式下有时会错误显示内容的问题
- 修复了在侧栏组件处于活动状态时禁用插件导致设置页面自动关闭的问题

⚡️ **性能增强：**
- 使用 Obsidian 的 metadataCache API 改进 YAML 前置元数据处理，提高元数据操作的可靠性
- 优化插件加载、卸载流程，防止界面冲突


### 1.6.3 更新
🎨 **界面优化：**
- 开启移动端的状态栏后，在 Obsidian 1.11.x 移动端大改后的界面不再崩溃。

### 1.6.2 更新
✨ **新功能**
- 快速参考：可在插件设置中查看，提供快速的插件文档和字符串插值参考
`
};