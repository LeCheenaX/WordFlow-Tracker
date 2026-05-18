export const currentPluginVersion = '2.2.4';

export const changelog = {
'en': 
`
### 2.2.4 updates
🎨 **UI Optimization:**
- CSS standardization according to Obsidian specifications.

### 2.2.3 updates
✨ **New Features:**
- AI Diff Summary could now using line-breaks by default. 

⚡ **Enhancements:**
- Removed unnecessary \`!important\` declarations in CSS by increasing selector specificity.
- Fixed duplicate CSS selector in widget settings.
- Replaced deprecated \`builtin-modules\` package with Node.js native \`node:module\`.
- Optimized tag retrieval: replaced vault file enumeration with \`metadataCache.getTags()\` for O(1) performance.

### 2.2.2 updates
🎨 **UI Optimization:**
- Improved Heatmap color gradient generation logic.

⚡ **Enhancements:**
- Refactored core code structure for better maintainability and performance.
- Optimized Widget property retrieval logic.
- Enhanced i18n content processing.

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
`,
'zh-CN': 
`
### 2.2.4 updates
🎨 **UI Optimization:**
- 根据 Obsidian 要求，标准化了 css 的使用。

### 2.2.3 更新说明
✨ **新功能：**
- AI 差异总结现在默认支持换行。

⚡ **功能强化：**
- 通过提高选择器特异性移除 CSS 中不必要的 \`!important\` 声明。
- 修复小部件设置中重复的 CSS 选择器。
- 将已弃用的 \`builtin-modules\` 包替换为 Node.js 内置 \`node:module\`。
- 优化标签获取：使用 \`metadataCache.getTags()\` 替代遍历仓库文件，性能提升至 O(1)。

### 2.2.2 更新说明
🎨 **界面优化：**
- 改进热力图颜色渐变生成逻辑。

⚡ **功能强化：**
- 重构核心代码结构，提升可维护性和性能。
- 优化组件属性获取逻辑。
- 增强国际化内容处理。

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
`
};