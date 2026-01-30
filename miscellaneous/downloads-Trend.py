import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import numpy as np
import os

# 确保输出目录存在
output_dir = "./miscellaneous"
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# 设置matplotlib为非交互式模式
plt.switch_backend("Agg")

# 设置样式
plt.style.use("seaborn-v0_8")
plt.rcParams["font.sans-serif"] = ["Noto Sans CJK SC", "WenQuanYi Zen Hei", "PingFang SC", "Microsoft YaHei", "Arial Unicode MS"]
plt.rcParams["axes.unicode_minus"] = False

# 原始数据
data = [
    ("2025-03-04", 15, "1.0.0"),
    ("2025-03-05", 6, "1.0.1"),
    ("2025-03-07", 7, "1.0.2"),
    ("2025-03-07", 1, "1.0.3"),
    ("2025-03-09", 5, "1.0.4"),
    ("2025-03-09", 8, "1.0.5"),
    ("2025-03-12", 12, "1.1.0"),
    ("2025-03-13", 8, "1.1.1"),
    ("2025-03-13", 12, "1.2.0"),
    ("2025-03-13", 1, "1.2.1"),
    ("2025-03-19", 9, "1.2.2"),
    ("2025-03-21", 17, "1.2.3"),
    ("2025-03-24", 790, "1.3.0"),
    ("2025-05-31", 124, "1.3.1"),
    ("2025-06-03", 135, "1.3.2"),
    ("2025-06-06", 334, "1.4.0"),
    ("2025-06-19", 73, "1.4.1"),
    ("2025-06-20", 224, "1.4.2"),
    ("2025-06-28", 1643, "1.4.3"),
    ("2025-07-05", 1593, "1.5.0"),
    ("2025-11-10", 153, "1.5.1"),
    ("2025-11-13", 695, "1.5.2"),
    ("2025-12-07", 549, "1.5.3"),
    ("2025-12-30", 55, "1.6.0"),
    ("2025-12-30", 263, "1.6.1"),
    ("2026-01-05", 508, "1.6.2"),
    ("2026-01-16", 298, "1.6.3"),
    ("2026-01-21", 76, "1.7.0"),
    ("2026-01-22", 188, "1.7.1"),
    ("2026-01-24", 339, "1.7.2"),
]

# --- [修改 1] 动态获取当前日期并追加到数据末尾 ---
current_date_str = datetime.now().strftime("%Y-%m-%d")
data.append((current_date_str, 0, "unreleased"))

# --- 1. 数据处理 ---
dates_plot = [datetime.strptime(d[0], "%Y-%m-%d") for d in data]
downloads_raw = [d[1] for d in data]
versions_plot = [d[2] for d in data]

cumulative_downloads_plot = [0] 
current_total = 0

for i in range(len(downloads_raw) - 1):
    current_total += downloads_raw[i]
    cumulative_downloads_plot.append(current_total)

major_dates = []
major_cum_downloads = []
for i, ver in enumerate(versions_plot):
    if ver.endswith('.0'):
        major_dates.append(dates_plot[i])
        major_cum_downloads.append(cumulative_downloads_plot[i])

# --- 2. 绘图 ---
fig, ax = plt.subplots(figsize=(14, 8))

# A. 连线 (含最新当前日期)
# ax.plot(dates_plot, cumulative_downloads_plot, '-', linewidth=2, color='#2E86AB', label='累计下载量', zorder=1)
ax.plot(dates_plot, cumulative_downloads_plot, '-', linewidth=2, color='#2E86AB', zorder=1)
# B. 黑点 (仅大版本)
ax.plot(major_dates, major_cum_downloads, 'o', markersize=5,
        color='#2E86AB', markerfacecolor='black', markeredgecolor='black', zorder=2)

ax.fill_between(dates_plot, cumulative_downloads_plot, alpha=0.2, color='#2E86AB')

# --- 3. 标注逻辑 ---
for i in range(len(dates_plot)):
    version = versions_plot[i]
    date = dates_plot[i]
    cum_download = cumulative_downloads_plot[i]

    # 只标注大版本
    if version.endswith('.0'):
        ax.annotate(f'{version}', 
                    xy=(date, cum_download), 
                    xytext=(-5, 15) if version == "1.2.0" else (-5, 0), 
                    textcoords='offset points',
                    fontsize=10,
                    color='#333333',
                    ha='center',
                    rotation=30,
                    zorder=3)

# --- 4. 装饰与保存 ---
ax.set_title('Total downloads trend', fontsize=18, fontweight='bold', pad=20)
ax.set_ylabel('total downloads', fontsize=14)
ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
ax.xaxis.set_major_locator(mdates.MonthLocator(interval=1))
plt.xticks(rotation=45, ha='right')
ax.grid(True, linestyle='--', alpha=0.6)
#ax.legend(loc='upper left', fontsize=12)

# --- 纵坐标拓展：最大值 + 1000 ---
max_val = cumulative_downloads_plot[-1]
ax.set_ylim(bottom=0, top=max_val + 1000)

# --- 横坐标拓展：右侧留白一个月 (30天) ---
start_date = dates_plot[0]
end_date = dates_plot[-1] # 这里已经是当前日期了
ax.set_xlim(left=start_date - timedelta(days=5),
            right=end_date + timedelta(days=32))

plt.tight_layout()
plt.savefig('./miscellaneous/cumulative_downloads_trend.png', dpi=150, bbox_inches='tight')