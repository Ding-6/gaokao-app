# 高考志愿模拟填报系统

河北高考志愿模拟填报工具，前端负责搜索、筛选、志愿管理、拖拽排序和导出，后端使用 Flask + SQLite 保存招生数据和用户志愿草稿。

## 启动方式

1. 安装 Python 3.10+。
2. 安装依赖：

```bash
pip install -r requirements.txt
```

3. 启动后端：

```bash
python server.py
```

4. 浏览器打开：

```text
http://localhost:5000
```

如果 5000 端口已被占用，可以改用其他端口：

```bash
PORT=5001 python server.py
```

Windows PowerShell：

```powershell
$env:PORT=5001; python server.py
```

也可以在 Windows 上双击 `启动服务器.bat`。如果提示缺少依赖，先执行上面的 `pip install -r requirements.txt`。

## 数据保存

- SQLite 数据库文件：`gaokao.db`
- 用户分数、位次、已选志愿：`user_data` 表
- 招生计划：`admission_plans` 表
- 院校基础信息：`colleges` 表
- 一分一段表：`score_rank_tables` 表

首次打开页面时，如果数据库为空，系统会把 `data/` 目录里的示例数据导入 SQLite。首页“导入招生数据”导入的 JSON 也会保存到 SQLite。

## 目录说明

```text
gaokao-app/
├── server.py                 Flask API + SQLite 初始化/迁移
├── gaokao.db                 SQLite 数据库
├── requirements.txt          Python 依赖
├── index.html                主页面
├── css/main.css              样式
├── js/
│   ├── db.js                 API 数据访问层
│   ├── algorithms.js         位次换算/冲稳保/排序/筛选算法
│   ├── export.js             Excel/PDF/CSV 导出
│   └── app.js                主应用逻辑
└── data/                     初始导入数据
```

## 说明

内置 `data/admission_plans.json` 和 `data/score_rank_tables.json` 主要是结构示例，不代表真实填报建议。正式使用前请导入你核实过的河北 2025 招生/录取数据。
