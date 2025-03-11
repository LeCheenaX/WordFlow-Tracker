# Wordflow Tracker
![image](https://img.shields.io/github/v/release/LeCheenaX/WordFlow-Tracker?label=Version&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest) ![image](https://img.shields.io/github/downloads/LeCheenaX/WordFlow-Tracker/total?logo=Obsidian&label=Downloads&labelColor=%237C3AED&color=%235b5b5b&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest)

[中文文档](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md) | [English](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README.md)

## 介绍
WordFlow Tracker 是一个实时跟踪每个笔记中的编辑数据的轻量插件，并自动将这些编辑数据记录到你的周期性笔记中，例如日记、周记。

![image](https://github.com/user-attachments/assets/64275f7a-81ed-4d5a-aebb-273a135659d6)

## 核心功能
- 跟踪每个笔记的编辑次数和编辑字数。这将在笔记底部的状态栏中显示。

  ![image](https://github.com/user-attachments/assets/88e1d16b-893f-46a4-aa66-210a372ef753)
- 在笔记关闭时自动记录修改的数据。或者，使用命令或按钮记录所有笔记。记录后，跟踪器将重置为0。
- （计划中）以SVG样式显示更改，展示原始内容与修改内容的对比。
  ![image](https://github.com/user-attachments/assets/b4bc50e8-89d2-4d9f-bf99-2cfcd14e1569)
- 自定义要记录的数据，使用${dataName}语法，详见下方[支持的字符串插值](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E6%94%AF%E6%8C%81%E7%9A%84%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%8F%92%E5%80%BC)。
- 自定义数据记录的方式，例如将表格或列表插入到笔记的指定位置。（目前仅提供插入文档底部的选项）

### 此插件如何收集数据？

我们通过访问Obsidian编辑器的历史字段(Historic Field)来获取编辑统计数据，历史字段即Obsidian本体存储撤销/重做历史的地方。
- 此插件以轻量化为目的开发，不创建额外的历史数据库，因此在大仓库中的负担。
- 追踪数据过程不创建临时文件，也不会暴露数据，因此不用担心隐私问题。
> 所有统计数据都是通过直接读取Obsidian数据获取的，没有添加额外的线程来记录数据，这意味着启用跟踪几乎不会带来性能损失或额外的内存占用。
> 
> 该插件收集的临时数据在记录到指定的周期笔记中后即自动销毁，Obsidian本体也会在关闭应用后清理所有历史数据。

## 设置
![image](https://github.com/user-attachments/assets/6a1544be-a579-4744-8391-bf0e1c8fa298)
### 基础设置
- 周期笔记文件夹 (Periodic note folder)：设置每日笔记、周记等周期笔记的存放文件夹路径。需与以下插件配置保持完全一致:
	- Obsidian 原生「日记」插件
	- Templater 模板插件（若已安装）
- 周期笔记格式 (Periodic note format)：设置新创建的周期笔记（如日/周记）的文件名格式。需与以下插件配置保持完全一致:
	- Obsidian 原生「日记」插件
	- Templater 模板插件（若已安装）
### 记录设置
- 记录内容类型 (Record content type)：选择在周期笔记中插入内容的格式类型。当前支持:
	- 表格 (Table) : 以表格形式记录（⚠️ 使用表格时，modifiedNote 必须位于第一列）
	- 无序列表 (Bullet List) : 以列表形式记录
- 插入位置 (Insert to position)：支持底部插入和自定义插入
	- ⚠️ 若选择「自定义位置」需满足: 起始标记 (start position) 和结束标记 (end position) 必须在周期笔记中存在且唯一
	- 确保创建新周期笔记时模板已正确应用这些标记
- Wordflow 记录语法 (Wordflow recording syntax)：通过字符串插值自定义记录内容，如使用 ${modifiedNote} 获取修改笔记的路径，或使用 [[${modifiedNote}]] 格式生成笔记链接。

### 支持的字符串插值
| 字符串插值  | 描述 |
| ------------------- | ------------------- |
| ${modifiedNote}    | 修改笔记的Obsidian路径 |
| ${editedWords} | 每个笔记在一段时间内编辑的字数 |
| ${editedTimes} | 每个笔记在一段时间内的编辑次数。在Obsidian规则中，如果你在超过0.5秒内输入2个字符，它们将被视为2次编辑 |
| ${editedPercentage} | （Alpha测试中）每个笔记在一段时间内编辑字数与原始字数的比率。可用于反映编辑是微调还是大改动。 |
| ${lastModifiedTime} | 记录到周期性笔记中的笔记的最后修改时间，可以在插件设置中指定此时间格式 |

## 开发路线图
参见[开发路线图](https://github.com/LeCheenaX/WordFlow-Tracker/wiki/Development-RoadMap)了解已知问题和计划功能！

## 安装
### 手动安装插件

将`main.js`、`manifest.json`、`styles.css`复制到你的仓库`VaultFolder/.obsidian/plugins/wordflow-tracker/`中。

### 通过BRAT安装
参见[BRAT文档](https://github.com/TfTHacker/obsidian42-brat)。

## 类似插件
这个轻量级插件试图以最少的障碍提供独特的周期性编辑跟踪体验。然而，如果你感兴趣，可以尝试以下替代方案：
- [Obsipulse插件](https://github.com/jsifalda/obsipulse-plugin)
- [每日文件记录器](https://github.com/ashlovepink/daily-file-logger)
