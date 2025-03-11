# Wordflow Tracker
![image](https://img.shields.io/github/v/release/LeCheenaX/WordFlow-Tracker?label=Version&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest) ![image](https://img.shields.io/github/downloads/LeCheenaX/WordFlow-Tracker/total?logo=Obsidian&label=Downloads&labelColor=%237C3AED&color=%235b5b5b&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest)

[中文文档](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md) | [English](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README.md)

## 介绍
WordFlow Tracker 是一个实时跟踪每个笔记中的编辑数据的轻量插件，并自动将这些编辑数据记录到你的周期性笔记中，例如日记、周记。

![image](https://github.com/user-attachments/assets/bb8e3ba5-7e10-4576-b8b3-0d839a7ffa2f)

## 核心功能
- 跟踪每个笔记的编辑次数和编辑字数。这将在笔记底部的状态栏中显示。
- 在笔记关闭时自动记录修改的数据。或者，使用命令或按钮记录所有笔记。记录后，跟踪器将重置为0。
- （计划中）以SVG样式显示更改，展示原始内容与修改内容的对比。
- ![image](https://github.com/user-attachments/assets/b4bc50e8-89d2-4d9f-bf99-2cfcd14e1569)
- 自定义要记录的数据，使用${dataName}，详见下面的[[#支持的字符串插值]]。
- 自定义数据记录的方式，例如将表格或列表插入到笔记的指定位置。（目前仅提供插入文档底部的选项）

### 此插件如何收集数据？

我们通过访问Obsidian编辑器的历史字段(Historic Field)来获取编辑统计数据，历史字段即Obsidian本体存储撤销/重做历史的地方。
- 此插件以轻量化为目的开发，不创建额外的历史数据库，因此在大仓库中的负担。
- 追踪数据过程不创建临时文件，也不会暴露数据，因此不用担心隐私问题。
> 所有统计数据都是通过直接读取Obsidian数据获取的，没有添加额外的线程来记录数据，这意味着启用跟踪几乎不会带来性能损失或额外的内存占用。
> 
> 该插件收集的临时数据在记录到指定的周期笔记中后即自动销毁，Obsidian本体也会在关闭应用后清理所有历史数据。

## 设置
![44b4ed09c7c6821f4ace21393df0395](https://github.com/user-attachments/assets/36fdf7f9-173d-46f5-bb92-b7ce5b634b03)

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
