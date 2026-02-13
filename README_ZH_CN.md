# Wordflow Tracker
![image](https://img.shields.io/github/v/release/LeCheenaX/WordFlow-Tracker?label=Version&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest) ![image](https://img.shields.io/github/downloads/LeCheenaX/WordFlow-Tracker/total?logo=Obsidian&label=Downloads&labelColor=%237C3AED&color=%235b5b5b&link=https%3A%2F%2Fgithub.com%2FLeCheenaX%2FWordFlow-Tracker%2Freleases%2Flatest)

[中文文档](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md) | [English](https://github.com/LeCheenaX/WordFlow-Tracker/tree/main?tab=readme-ov-file)

![image](https://github.com/user-attachments/assets/7a39fcb6-d660-4fd2-a658-b1a1076ddcf3)

## 介绍
WordFlow Tracker 是一个轻量级插件，可以跟踪每个笔记的专注时间和编辑统计数据，并自动记录到你的日记或周期性笔记中。

![wordflow155](https://github.com/user-attachments/assets/84446e86-da99-47fe-b282-ff559e53d265)

### 核心功能
- 跟踪每个笔记的专注时间、编辑次数和编辑字数。
- 通过多种视图显示统计数据比例：
    - 文件列表视图：

      <img width="410" height="240" alt="image" src="https://github.com/user-attachments/assets/afd8a8c7-45bb-43ab-b84a-96f3de4d08e0" />
    - 标签列表视图：*支持可折叠分组和双层进度条*

      <img width="409" height="341" alt="image" src="https://github.com/user-attachments/assets/cbef9fff-6eaf-4c5b-accd-d70b44b0264d" />
    - 热力图视图：*支持自定义颜色渐变和笔记导航*

	  <img width="349" height="319" alt="image" src="https://github.com/user-attachments/assets/90ed17df-e5c1-4578-b186-b46baaef1067" />
- 支持通过字段别名自定义状态栏显示内容。
  
  ![image](https://github.com/user-attachments/assets/51ce15a6-a935-46c2-9676-5525bd6b092f)
  
  ![image](https://github.com/user-attachments/assets/8422a96d-0ab5-417a-a474-7a838825de1e)
- 在笔记关闭时自动记录修改的数据。或者，使用命令或按钮记录所有笔记。
- 在侧栏组件中展示更改。
  
  ![Pasted image 20250706223743](https://github.com/user-attachments/assets/6edc1be0-f262-4054-8803-1b1b37caeec7)
- 以比例条样式显示更改，展示原始内容(黄色)与修改内容(红色：删除的字数，绿色：添加的字数)的比例。

  ![image](https://github.com/user-attachments/assets/6c977b5f-0aba-4481-847b-f0fda6c5cd98)

- 将编辑统计数据（例如你今天编辑的总字数）记录到日记的 YAML（Frontmatter）中。其他插件可以使用这些元数据生成分析。
- 自定义要记录的数据，使用 ${dataName} 语法，详见[支持的字符串插值](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/docs/%E8%AE%BE%E7%BD%AE%E6%96%87%E6%A1%A3.md#%E6%94%AF%E6%8C%81%E7%9A%84%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%8F%92%E5%80%BC)。
- 自定义数据记录的方式，例如将表格或列表插入到笔记的指定位置。应用更改前可预览记录语法。
### 此插件如何收集数据？

我们通过访问 Obsidian 编辑器的历史字段来获取编辑统计数据，这是 Obsidian 存储撤销/重做历史的地方。
- 不创建额外的历史数据库，因此不用担心大型仓库中的性能负担。
- 不创建或暴露额外的数据文件。这解决了隐私问题。

> 所有统计数据都是通过直接读取 Obsidian 数据获取的，没有添加额外的线程来记录数据，这意味着启用记录几乎不会带来性能损失或额外的内存占用。
> 
> 插件收集的临时编辑统计数据在记录到你的笔记后会被销毁，Obsidian 会在你关闭应用程序后销毁历史数据。

### 上手指南
步骤 1：下载并[安装](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E5%AE%89%E8%A3%85)该插件。

步骤 2：在 Obsidian > 设置 > 社区插件中启用该插件。

步骤 3：在 Wordflow Tracker 设置中，指定你的[周期笔记文件夹](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E5%9F%BA%E7%A1%80%E8%AE%BE%E7%BD%AE)用于放置周期性笔记，编辑统计数据将保存在其中。

现在插件会自动跟踪你所做的编辑并显示在状态栏中。当满足以下任一条件时，编辑统计数据也会被记录到你的周期性笔记中：
1. 在 Obsidian 中从编辑模式切换到阅读模式；
2. 编辑笔记后关闭笔记标签页；
3. 手动点击 Obsidian 左侧功能区的"Record wordflows from edited notes"按钮；
4. 手动在 Obsidian 中运行"Record wordflows from edited notes to periodic notes"命令；
5. 自动记录间隔超时，可以在 Wordflow Tracker 插件设置中设置，以记录所有编辑过的笔记。

注意：笔记记录后，跟踪器将重置为 0。

### 高级自定义指南
#### 在记录之前将模板应用到新创建的笔记
确保你的模板将应用到同一个[周期笔记文件夹](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E5%9F%BA%E7%A1%80%E8%AE%BE%E7%BD%AE)下的笔记。

如果你新创建的笔记会被其他插件重命名，例如 **Templates**（核心插件）或 **Templater**（社区插件），请确保其他插件指定的名称与[周期笔记格式](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E5%9F%BA%E7%A1%80%E8%AE%BE%E7%BD%AE)相同。

#### 自定义要记录的数据
在 Wordflow 记录语法中，你可以使用以下格式之一添加或删除数据：

- **表格：**
	在标题中为 ${modifiedNote} 指定名称（例如"文档字数"），并在行中添加"${docWords}"。可用的属性列在[支持的字符串插值](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/docs/%E8%AE%BE%E7%BD%AE%E6%96%87%E6%A1%A3.md#%E6%94%AF%E6%8C%81%E7%9A%84%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%8F%92%E5%80%BC)中。

	<img width="1030" height="444" alt="image" src="https://github.com/user-attachments/assets/40a9a731-948e-4e28-b543-3ccbf8f50cfc" />

	在语法中完成 Markdown 表格后，你可以在下方预览结果，并会提示你确认更改：

	<img width="1016" height="316" alt="image" src="https://github.com/user-attachments/assets/ae4e1874-85a7-4c8a-b3ff-79cd59b9d7dd" />


    注意：${modifiedNote} 必须存在于表格语法中，否则记录器将无法合并笔记的现有数据与新数据

- **无序列表：**

    添加一个换行符，按 tab 键进行适当的空格间隔，并指定你期望的数据名称。
	
    最后，添加形如"${docWords}"的[字符串插值](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/docs/%E8%AE%BE%E7%BD%AE%E6%96%87%E6%A1%A3.md#%E6%94%AF%E6%8C%81%E7%9A%84%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%8F%92%E5%80%BC)。
    你可以在下方预览结果，并会提示你确认更改：

    <img width="1037" height="691" alt="image" src="https://github.com/user-attachments/assets/2a0db911-db45-402c-b3e8-af98c4889fe4" />

    注意：${modifiedNote} 必须存在于无序列表语法中，否则记录器将无法合并笔记的现有数据与新数据
	
- **元数据：**

    就像在"源代码模式"下添加元数据一样，添加一个以冒号结尾的属性名称，并在其后添加[字符串插值](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/docs/%E8%AE%BE%E7%BD%AE%E6%96%87%E6%A1%A3.md#%E6%94%AF%E6%8C%81%E7%9A%84%E5%AD%97%E7%AC%A6%E4%B8%B2%E6%8F%92%E5%80%BC)，例如"${totalWords}"
  
  	<img width="1018" height="509" alt="image" src="https://github.com/user-attachments/assets/fb5aa570-3e54-4435-ad8d-eab27948b60f" />


#### 将编辑统计数据同时记录到笔记内容和 YAML（Frontmatter）中
在插件设置中，通过单击添加按钮创建一个记录器：

![image](https://github.com/user-attachments/assets/a1eff9ee-6d56-4ebe-9d07-aaa3ca004d6e)

然后，将周期笔记文件夹和笔记格式调整为与其他记录器相同，以记录到同一个笔记。

最后，将记录内容类型调整为不同的类型。

注意，你应该**避免将针对同一笔记的 2 个记录器的记录内容类型设置为相同**。例如，避免一个记录器将表格插入到今天日记的底部，而另一个记录器将表格插入到今天日记的自定义位置。

#### 将编辑统计数据记录到动态文件夹
你可以将编辑统计数据记录到不仅是静态文件夹（例如"Daily Notes/2025-03-23.md"），还可以记录到动态文件夹，例如："Daily Notes/2025-03/2025-03-23.md"。

有关如何实现此功能的详细信息，请参阅[启用动态文件夹](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/README_ZH_CN.md#%E5%9F%BA%E7%A1%80%E8%AE%BE%E7%BD%AE)

还请确保此文件夹与其他插件应用模板的文件夹相同。

## 设置文档
详见[设置文档](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/docs/%E8%AE%BE%E7%BD%AE%E6%96%87%E6%A1%A3.md)。

## 开发路线图
参见[开发路线图](https://github.com/LeCheenaX/WordFlow-Tracker/wiki/Development-RoadMap)了解已知问题和计划功能！

想了解这个项目是如何构建的？或者想在这个插件上合作？详见 https://deepwiki.com/LeCheenaX/WordFlow-Tracker

![下载量趋势](https://github.com/LeCheenaX/WordFlow-Tracker/blob/main/miscellaneous/cumulative_downloads_trend.png)

## 安装
### 在 Obsidian 中安装
打开 Obsidian 设置 > 社区插件 > 浏览，在弹出窗口中搜索 Wordflow Tracker，然后点击安装按钮。

安装后，点击启用按钮开始体验。

### 手动安装插件
将 `main.js`、`manifest.json`、`styles.css` 复制到你的仓库 `VaultFolder/.obsidian/plugins/wordflow-tracker/` 中。

### 通过 BRAT 安装
参见 [BRAT 文档](https://github.com/TfTHacker/obsidian42-brat)。

## 类似插件
这个轻量级插件试图以最少的障碍提供独特的周期性编辑跟踪体验。然而，如果你感兴趣，可以尝试以下替代方案：
- [Obsipulse插件](https://github.com/jsifalda/obsipulse-plugin)
- [每日文件记录器](https://github.com/ashlovepink/daily-file-logger)
- [Obsidian toggl integration](https://github.com/mcndt/obsidian-toggl-integration)
