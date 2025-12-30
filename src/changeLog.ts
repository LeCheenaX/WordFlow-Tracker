export const currentPluginVersion = '1.6.1';

export const changelog = {
'en': 
`
### 1.6.1 updates
**Bug Fixed:**
1. Fixed \${docWords} not working properly for status bar tracker

**Enhancements:**
1. Faster plugin reaction and performance improvements
2. Word counting is now identical with Obsidian's native word counting
3. Rebuilt word counting functions for better readability, stability and performance
4. Module rebuilds for de-coupling and compatibility

### 1.6.0 updates
**New Features:**
1. Custom status bar content - Add customizable status bar elements to display note information
2. Field alias support - Add alias functionality for field names in widget to improve usability
3. Full Chinese localization - Complete Chinese language support for settings, notifications, and commands
4. Bilingual changelog support - Support for both English and Chinese in update logs

**Interface Improvements:**
1. Adjusted CSS classes for setting tabs to improve visual consistency
2. Enhanced UI display effects and styling

### 1.5.3 updates
**New Feature:**
- Option to exclude folders or file tags from being tracked by this plugin, thanks to [@Myrte46](https://github.com/Myrte46).

**Bug Fixed:**
1. The \${docWords} property may be updated by other note.
2. The totalValue in the sidebar widget may not update, if the widget is not updated on today but on the next day.
3. The false positive console error by Obsidian due to the async initialization. This does not affect the usage but just pollute the console logs

`,
'zh-CN': 
`
### 1.6.1 更新
**错误修复：**
1. 修复了状态栏追踪器中 \${docWords} 无法正常工作的问题

**功能增强：**
1. 更快的插件响应速度和性能改进
2. 单词计数现在与 Obsidian 原生单词计数保持一致
3. 重构了单词计数功能，提高了可读性、稳定性和性能
4. 模块重构以提高兼容性

### 1.6.0 更新
**新功能：**
1. 自定义状态栏内容 - 添加可自定义的状态栏元素来显示文档信息
2. 侧栏显示属性别名 - 为侧栏中显示的属性添加自定义名称，以提高可用性
3. 完整中文本地化 - 为设置、通知和命令提供完整的中文语言支持
4. 双语更新日志支持 - 支持中英文双语更新日志

**界面改进：**
1. 调整设置标签页的CSS样式类以提高视觉一致性
2. 增强UI显示效果和样式

### 1.5.3 更新
**新功能：**
- 新增选项可以排除文件夹或文件标签不被此插件追踪，感谢 [@Myrte46](https://github.com/Myrte46)。

**错误修复：**
1. \${docWords} 属性可能会被其他笔记更新。
2. 如果侧边栏组件不是在今天更新而是在第二天更新，侧边栏组件中的 totalValue 可能不会更新。
3. 由于异步初始化导致的 Obsidian 误报控制台错误。这不会影响使用，但会污染控制台日志。

`
};