export const currentPluginVersion = '1.6.4';

export const changelog = {
'en': 
`
### 1.6.4 updates
✨ **New Features:**
- Option to automatically resume focus mode after idle pause.

🐛 **Bug Fixed:**
- Metadata of the notes may sometimes be duplicated in YAML frontmatter
- Status bar occasionally displaying incorrect content in reading mode

⚡️ **Enhancements:**
- Improved YAML frontmatter handling using Obsidian's metadataCache API for more reliable metadata operations

### 1.6.3 updates
🎨 **UI Enhancement**
- Mobile status bar(if enabled) is now compatible with Obsidian 1.11.x version (Android and iOS).

### 1.6.2 updates
✨ **New Features**
- Quick Reference: In the setting page, offer quick reference to essential plugin documentation and string interpolation reference.

### 1.6.1 updates
🐛 **Bug Fixed:**
- Fixed \${docWords} not working properly for status bar tracker

⚡️ **Enhancements:**
1. Faster plugin reaction and performance improvements
2. Word counting is now identical with Obsidian's native word counting
3. Rebuilt word counting functions for better readability, stability and performance
4. Module rebuilds for de-coupling and compatibility

### 1.6.0 updates
✨ **New Features:**
1. Custom status bar content - Add customizable status bar elements to display note information
2. Field alias support - Add alias functionality for field names in widget to improve usability
3. Full Chinese localization - Complete Chinese language support for settings, notifications, and commands
4. Bilingual changelog support - Support for both English and Chinese in update logs

🎨 **Interface Improvements:**
1. Adjusted CSS classes for setting tabs to improve visual consistency
2. Enhanced UI display effects and styling


`,
'zh-CN': 
`
### 1.6.4 更新
✨ **新功能：**
- 新增设置：专注模式因闲置暂停后，回到文档可以自动恢复专注（默认关闭）。

🐛 **错误修复：**
- YAML 前置元数据有时会被重复添加的问题
- 状态栏在阅读模式下有时会错误显示内容的问题

⚡️ **性能增强：**
- 使用 Obsidian 的 metadataCache API 改进 YAML 前置元数据处理，提高元数据操作的可靠性

### 1.6.3 更新
🎨 **界面优化：**
- 开启移动端的状态栏后，在 Obsidian 1.11.x 移动端大改后的界面不再崩溃。

### 1.6.2 更新
✨ **新功能**
- 快速参考：可在插件设置中查看，提供快速的插件文档和字符串插值参考

### 1.6.1 更新
🐛 **错误修复：**
- 修复了状态栏追踪器中 \${docWords} 无法正常工作的问题

⚡️ **性能增强：**
1. 更快的插件响应速度和性能改进
2. 单词计数现在与 Obsidian 原生单词计数保持一致
3. 重构了单词计数功能，提高了可读性、稳定性和性能
4. 模块重构以提高兼容性

### 1.6.0 更新
✨ **新功能：**
1. 自定义状态栏内容 - 添加可自定义的状态栏元素来显示文档信息
2. 侧栏显示属性别名 - 为侧栏中显示的属性添加自定义名称，以提高可用性
3. 完整中文本地化 - 为设置、通知和命令提供完整的中文语言支持
4. 双语更新日志支持 - 支持中英文双语更新日志

🎨 **界面改进：**
1. 调整设置标签页的CSS样式类以提高视觉一致性
2. 增强UI显示效果和样式

`
};