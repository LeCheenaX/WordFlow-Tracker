# Wordflow Tracker
![image](https://img.shields.io/github/v/release/LeCheenaX/WordFlow-Tracker?label=Version&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest) ![image](https://img.shields.io/github/downloads/LeCheenaX/WordFlow-Tracker/total?logo=Obsidian&label=Downloads&labelColor=%237C3AED&color=%235b5b5b&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest)

[中文文档](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md) | [English](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file)

## 介绍
WordFlow Tracker 是一个实时跟踪每个笔记中的编辑数据的轻量插件，并自动将这些编辑数据记录到你的周期性笔记中，例如日记、周记。

![wordflow3](https://github.com/user-attachments/assets/e323477d-d38e-4a6c-8d98-83bda5818a07)

## 核心功能
- 跟踪每个笔记的编辑次数和编辑字数。这将在笔记底部的状态栏中显示。

  ![image](https://github.com/user-attachments/assets/88e1d16b-893f-46a4-aa66-210a372ef753)
- 在笔记关闭时自动记录修改的数据。或者，使用命令或按钮记录所有笔记。记录后，跟踪器将重置为0。
- 以比例条样式显示更改，展示原始内容(黄色)与修改内容(红色、绿色)的比例。
  ![image](https://github.com/user-attachments/assets/56c8336a-4761-4fed-99b7-3f6453de416a)
- 将编辑统计数据（例如你今天编辑的总字数）记录到日记的 YAML（Frontmatter）中。其他插件（如热图）可以使用这些元数据生成分析。

  ![image](https://github.com/user-attachments/assets/1e5bbe85-a943-4d10-b81c-ecef5e6b15bb)
- 自定义要记录的数据，使用${dataName}语法，详见下方[支持的字符串插值](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E6%94%AF%E6%8C%81%E7%9A%84%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%8F%92%E5%80%BC)。
- 自定义数据记录的方式，例如将表格或列表插入到笔记的指定位置。

### 此插件如何收集数据？

我们通过访问Obsidian编辑器的历史字段(Historic Field)来获取编辑统计数据，历史字段即Obsidian本体存储撤销/重做历史的地方。
- 此插件以轻量化为目的开发，不创建额外的历史数据库，因此在大仓库中的负担。
- 追踪数据过程不创建临时文件，也不会暴露数据，因此不用担心隐私问题。
> 所有统计数据都是通过直接读取Obsidian数据获取的，没有添加额外的线程来记录数据，这意味着启用跟踪几乎不会带来性能损失或额外的内存占用。
> 
> 该插件收集的临时数据在记录到指定的周期笔记中后即自动销毁，Obsidian本体也会在关闭应用后清理所有历史数据。

### 上手指南
步骤1：下载并[安装](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E5%AE%89%E8%A3%85)该插件。

步骤2：在 Obsidian > 设置 > 社区插件中启用该插件。

步骤3：在 Wordflow Tracker 设置中，指定你的[周期笔记文件夹(Periodic Note Folder)](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E5%9F%BA%E7%A1%80%E8%AE%BE%E7%BD%AE)，编辑统计数据将在此文件夹中的周期笔记中保存。

好了！现在插件会自动跟踪你所做的编辑，并显示在状态栏中。当以下任一情况发生时，编辑统计数据将被记录到周期笔记中：
1. 从 Obsidian 的编辑模式切换到预览模式。
2. 在编辑笔记后关闭笔记所在的标签页。
3. 手动点击 Obsidian 左侧功能区的“Record wordflows from edited notes”按钮。
4. 手动在 Obsidian 中运行“Record wordflows from edited notes to periodic notes”命令。
5. 自动记录间隔达到设置的时间，该时间可以在 Wordflow Tracker 插件设置中设定，以定期记录所有编辑过的笔记。

注意：记录完笔记后，跟踪器将归零。

### 高级自定义指南
#### 在记录之前将模板应用到新创建的笔记
确保你的设置的笔记模板将应用到同一个[周期笔记文件夹(Periodic Note Folder)](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E5%9F%BA%E7%A1%80%E8%AE%BE%E7%BD%AE)下。

如果你新创建的笔记会被其他插件重命名，例如核心插件“模板”或社区插件“Templater”，请确保其他插件指定的名称与[周期笔记格式(Periodic Note Format)](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E5%9F%BA%E7%A1%80%E8%AE%BE%E7%BD%AE)相同。

#### 自定义要记录的数据
在 Wordflow 记录语法中，你可以使用以下格式之一添加或删除数据：

- **表格：**

    在 Obsidian 中打开任意一个笔记，并通过以下方式添加一个空白表格：
    ```
    | |
    |-|
    | |
    ```
    然后，在标题中为 ${modifiedNote}指定名称，例如“Note Name”，并在行中添加“${modifiedNote}”。

    ![image](https://github.com/user-attachments/assets/de0e8909-727e-44d2-9cec-c647d51af48c)

    点击“在之后添加列”按钮，为新列指定标题名称和任何你想要添加的[字符串插值](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E6%94%AF%E6%8C%81%E7%9A%84%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%8F%92%E5%80%BC)。

    ![image](https://github.com/user-attachments/assets/0027b8f9-49f9-4f25-a8b4-38d369c6a115)

    最后，选择并复制整个表格，然后粘贴到 Wordflow Tracker 设置中。

    ![image](https://github.com/user-attachments/assets/de26aee0-e051-42b6-8fc1-e18e41db2f60)

    注意：${modifiedNote} 必须存在于表格语法中，否则记录器将无法合并笔记的现有数据与新数据。


- **无序列表：**

    添加一个换行符，按 tab 键进行适当的空格间隔，并输入你希望显示的数据名称。随后，添加形如“${docWords}”的[字符串插值](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E6%94%AF%E6%8C%81%E7%9A%84%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%8F%92%E5%80%BC)。

    ![image](https://github.com/user-attachments/assets/288f6fa4-1d0a-4187-aa9d-4b6b7e90e7bc)

    注意：${modifiedNote} 必须存在于无序列表语法中，否则记录器将无法合并笔记的现有数据与新数据。

- **元数据：**

    就像在“源代码模式下”添加元数据一样，添加一个以冒号结尾的属性名称，并在其后添加“[字符串插值](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E6%94%AF%E6%8C%81%E7%9A%84%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%8F%92%E5%80%BC)”，例如“${totalWords}”。

#### 将编辑统计同时记录到正文和元数据（YAML）中
在插件设置中，通过单击添加按钮来创建一个新的记录器：

![image](https://github.com/user-attachments/assets/a1eff9ee-6d56-4ebe-9d07-aaa3ca004d6e)

然后，将周期笔记文件夹和笔记格式调整到与其他记录器相同，以便记录到同一个笔记。

最后，将记录内容类型调整为不同类型。

注意，你应该避免将针对同一笔记的两个记录器的记录内容类型设置为相同。例如，避免一个记录器将表格插入到今日日记的底部，而另一个记录器将表格插入到今日日记的自定义位置。

#### 将编辑统计数据记录到动态文件夹
你可以将编辑统计数据记录到不仅是一个静态文件夹，例如“Daily Notes/2025-03-23.md”，还可以记录到一个动态文件夹，例如：“Daily Notes/2025-03/2025-03-23.md”。
具体实现方法详见[开启动态文件夹](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E5%9F%BA%E7%A1%80%E8%AE%BE%E7%BD%AE)。

## 设置
### 记录器设置
- **创建新记录器**: 创建新记录器来额外记录需要的功能，常用情况如下：
	- 为不同的周期笔记创建: 假设当前记录器会记录编辑数据到日记中，你可以添加一个新记录器使编辑数据还能记录到每周笔记，或者每月笔记中。
 	- 为不同的记录数据创建: 假设当前记录器会在日记中记录你编辑过的每条笔记，并以表格形式呈现, 你可以添加一个新记录器使编辑数据会汇总并记录到 YAML(Frontmatter) 中.

    	![image](https://github.com/user-attachments/assets/56a03e3c-930c-4d0e-b901-a07e95099105)

- **重命名**: 重命名记录器以便区分。
- **删除**: 删除现在的记录器。
### 基础设置
- **周期笔记文件夹 (Periodic note folder)**：设置每日笔记、周记等周期笔记的存放文件夹路径。需与以下插件配置保持完全一致:
	- Obsidian 原生「日记」插件
	- Templater 模板插件（若已安装）
- **开启动态周期笔记文件夹(Enable dynamic folder)**: 每日笔记、周记等周期笔记的存放文件夹将变为动态路径。 该路径需要使用 [moment 兼容格式](https://momentjs.com/docs/#/displaying/format/) 设置。 开启之后效果可见如下表格：

    | 周期笔记文件夹（开启动态文件夹）  | 对应Obsidian的文件夹 | 周期笔记格式 | 对应Obsidian的文件               |
	| ---------------------------------- | -------------------- | ------------- | --------------------------------- |
	| [Daily Notes/]YYYY-MM | Daily Notes/2025-03           | YYYY-MM-DD           | Daily Notes/2025-03/2025-03-21.md  |
	| [Monthly Notes/]YYYY  | Monthly Notes/2025            | MMM YYYY             | Monthly Notes/2025/Mar 2025.md     |
  
- **周期笔记格式 (Periodic note format)**：设置新创建的周期笔记（如日/周记）的文件名格式。需与以下插件配置保持完全一致:
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


| 字符串插值               | 描述                                                     | 支持记录类型             | 示例                                                                                        | 备注                                                                                                      |
| ------------------- | ------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| ${modifiedNote}     | 修改后的笔记的笔记路径                                            | 表格、无序列表            | Daily Notes/2025-03-23.md                                                                 | 表格中始终应放在第一列，无序列表中应放在父元素中。                                                                               |
| ${noteTitle}        | 笔记的标题，不带如".md"的文件类型后缀                                  | 表格、无序列表            | 2025-03-23, 未命名笔记, 新空白笔记0323                                                                    | 可以单独使用，也可以放在笔记链接中从而不显示笔记路径，而是笔记标题。放在链接中使用时，仅支持如下格式： [[${modifiedNote}\\\|${noteTitle}]] （**注意分隔符'\|'之前有一个反斜杠**） |
| ${editedTimes}      | 笔记在一段时间内的编辑次数(**注意与** ${editTime} **区分**)              | 表格、无序列表            | 100                                                                                       | 根据 Obsidian 规则，输入间隔小于0.5秒的所有输入被视为一次编辑。每次编辑都可以通过按 `ctrl` + `z` 撤销或者按 `ctrl` + `shift` + `z` 重做操作。        |
| ${editedWords}      | 笔记在一段时间内的编辑字数                                          | 表格、无序列表            | 550                                                                                       | 等于 addedWords + deletedWords                                                                            |
| ${changedWords}     | 笔记中字数的净变化                                              | 表格、无序列表            | 150                                                                                       | 等于 addedWords - deletedWords                                                                            |
| ${deletedWords}     | 笔记在一段时间内删除的字数                                          | 表格、无序列表            | 200                                                                                       |                                                                                                         |
| ${addedWords}       | 笔记在一段时间内添加的字数                                          | 表格、无序列表            | 350                                                                                       |                                                                                                         |
| ${docWords}         | 文档的总字数(截止上次记录)                                         | 表格、无序列表            | 1000                                                                                      | 包括 YAML（Frontmatter）中的字数，而 Obsidian 的字数统计核心插件不包括这部分。                                                    |
| ${editTime}         | 该笔记在编辑模式下所处的时间，长时间闲置将自动暂停。                             | 表格、无序列表            | 1 h 0 min, 6 min                                                                          | 闲置时，计时器会自动暂停，可以通过编辑笔记或者点击文档内容来刷新闲置时间 (**注意与** ${editedTimes} **区分**)                                    |
| ${editedPercentage} | 一段时间内编辑字数占总字数（编辑字数+原始字数）的比率，用于判断编辑是微调还是较大更改      | 表格、无序列表            | 55%                                                                                       | 内容是 HTML 格式，但样式会自动转为文字样式。（直接使用字符串因记录器更新字符串而导致准确性逐步降低而被弃用。）                                              |
| ${statBar}          | 以 HTML 格式展示原始字数、删除字数和添加字数的比例。用于判断编辑是否为微调还是还是较大更改 | 仅表格                | ![image](https://github.com/user-attachments/assets/c0d929a7-5ea8-4172-9d85-5de5f46e02bd) | 自动转化样式为 SVG 比例条，颜色可以在 styles.css 中自定义。示例中的比例为 450:200:150。                                              |
| ${lastModifiedTime} | 笔记的最后修改时间，你可以在插件设置中指定此项目的格式                            | 表格、无序列表            | 2025-03-23 16:00                                                                          |                                                                                                         |
| ${comment}          | 给已经记录的数据添加任何你想要的备注                                     | 表格、无序列表 | 已写完该笔记                                                                                    | 插件不会修改，只会留空给用户，备注什么都可以。                                                                                 |
| ${totalEdits}       | 所有笔记在一段时间内的总编辑次数                                       | 元数据                | 200                                                                                       | 可供其他插件使用，例如生成热力图。                                                                                       |
| ${totalWords}       | 所有笔记在一段时间内的总编辑字数                                       | 元数据                | 2000                                                                                      | 可供其他插件使用，例如生成热力图。                                                                                       |
| ${totalEditTime}    | 所有笔记的总编辑时间.                                            | 元数据                | 1 h 13 min                                                                                | 可供其他插件使用，例如生成热力图                                                                                        |

## 开发路线图
参见[开发路线图](https://github.com/LeCheenaX/WordFlow-Tracker/wiki/Development-RoadMap)了解已知问题和计划功能！

## 安装
### 通过Obsidian插件市场安装
在Obsidian设置 > 社区插件中，点击浏览社区插件。搜索 “Wordflow Tracker” 并点击安装。

### 手动安装插件
将`main.js`、`manifest.json`、`styles.css`复制到你的仓库`VaultFolder/.obsidian/plugins/wordflow-tracker/`中。

### 通过BRAT安装
参见[BRAT文档](https://github.com/TfTHacker/obsidian42-brat)。

## 类似插件
这个轻量级插件试图以最少的障碍提供独特的周期性编辑跟踪体验。然而，如果你感兴趣，可以尝试以下替代方案：
- [Obsipulse插件](https://github.com/jsifalda/obsipulse-plugin)
- [每日文件记录器](https://github.com/ashlovepink/daily-file-logger)
