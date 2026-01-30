export const currentPluginVersion = '1.7.3';

export const changelog = {
'en': 
`
### 1.7.3 updates
🐛 **Bug Fixed:**
- Race condition issues while recording [Issue 11](https://github.com/LeCheenaX/WordFlow-Tracker/issues/11).
- Widget silently collapses when data is corrupted by unexpected file rename or migration.

⚡️ **Enhancements:**
- Safeguarding the color updating mechanism to prevent racing issues.

### 1.7.2 updates
✨ **New Features:**
-  Custom tag group labels (optional)

🐛 **Bug Fixed:**
- Setting validation is incorrect.
- Widget timing will unexpectedly display seconds.

🎨 **UI Optimization:**
- Uniform font styles in the tag based view.
- Correcting setting styling when width is not enough.

### 1.7.1 updates
🐛 **Bug Fixed:**
- Tag colors are not saved correctly.

🎨 **UI Optimization:**
- Fixed mobile color picker distortion in tag color settings.

### 1.7.0 updates
🔥 **Major Updates:**
- Tag-based colors. Instead of randomly generated colors for file displaying in the widget, supports custom colors based on the file tags. 
- Tag-based data View: Hierarchical list view with collapsible tag groups and dual-layer progress bar for better data organization.

✨ **New Features:**
- Option to automatically resume focus mode after idle pause

🐛 **Bug Fixed:**
- Metadata of the notes may sometimes be duplicated in YAML frontmatter
- Status bar occasionally displaying incorrect content in reading mode
- Fixed settings page auto-closing when plugin is disabled while widget view is active

⚡️ **Enhancements:**
- Improved YAML frontmatter handling using Obsidian's metadataCache API for more reliable metadata operations
- Optimized plugin loading & unloading process to prevent UI conflicts

🎨 **UI Optimization:**
- Realigned the setting pages for clarity.
- More tooltips and hover behaviors. 
`,
'zh-CN': 
`
### 1.7.3 更新
🐛 **错误修复：**
- 侧栏组件静默崩溃，当文件被意外重命名或迁移导致数据污染后。
- 记录器触发竞态条件导致的记录失败 [Issue 11](https://github.com/LeCheenaX/WordFlow-Tracker/issues/11)。

⚡️ **性能增强：**
- 优化颜色更新机制，防止竞态问题

### 1.7.2 更新
✨ **新功能：**
- 自定义标签组标签（可选）

🐛 **错误修复：**
- 设置验证的结果显示与实际不符
- 侧栏组件计时会意外显示秒数

🎨 **界面优化：**
- 统一基于标签视图中的字体样式
- 修正宽度不足时的设置样式

### 1.7.1 更新
🐛 **错误修复：**
- 标签颜色无法正确保存

🎨 **界面优化：**
- 修复移动端标签颜色设置中颜色选择器变形

### 1.7.0 更新
🔥 **核心功能：**
- 基于自定义标签的颜色。侧栏组件中显示的数据可以根据笔记的标签指定显示颜色，让分类更清晰。
- 基于标签的层级化列表视图。支持标签组折叠和双层进度条，让数据组织更清晰。

✨ **新特性：**
- 新增设置：专注模式因闲置暂停后，回到文档可以自动恢复专注（默认关闭）

🐛 **错误修复：**
- YAML 前置元数据有时会被重复添加的问题
- 状态栏在阅读模式下有时会错误显示内容的问题
- 修复了在侧栏组件处于活动状态时禁用插件导致设置页面自动关闭的问题

⚡️ **性能增强：**
- 使用 Obsidian 的 metadataCache API 改进 YAML 前置元数据处理，提高元数据操作的可靠性
- 优化插件加载、卸载流程，防止界面冲突

🎨 **界面优化：**
- 重新整理设置页面，展示更清晰。
- 增加鼠标悬浮效果和提示。
`
};