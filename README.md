# 业务数据可视化看板 (B_Data_V)

这是一个前后端分离的存货智能分析与可视化看板项目，旨在通过读取企业 Excel 报表数据（如《存货收发存汇总》），自动进行数据清洗、关联分析、异常检测，并结合大模型（豆包 AI 等）提供深度的业务洞察与管理建议。

## ✨ 核心功能

- 📊 **存货仪表板**：展示库存概况，包括总金额、物料种类、出入库金额趋势（TOP10 物料分析），以及**库存周转天数 (Top10 / Bottom10)** 智能排序。
- 📈 **领用消耗分析**：提供部门需求分析与项目维度分析，支持数据表格与图表（横向/纵向柱状图）联动展示。
- ⚠️ **采购决策与异常预警**：
  - **低库存预警**：精准比对结存数量与基础需求数量，自动计算缺口。
  - **积压库存预警**：根据真实周转天数判定预警等级（>90 天标黄，>180 天或呆滞标红）。
  - **预测趋势图**：基于历史数据智能模拟并可视化“存货库存预测”、“在途采购”与“销售需求预测”的折线图走势。
- 🤖 **智能文字分析**：对接大语言模型（如火山引擎豆包），根据上传的存货特征与预警数据，一键生成专业的 Markdown 分析报告，并支持**一键导出为 PDF**。

## 🛠️ 技术栈

- **前端**：React 18 + Vite + TypeScript + Tailwind CSS
  - 状态管理：Zustand
  - 图表可视化：Chart.js (react-chartjs-2)
  - 路由：React Router DOM
  - 其它：lucide-react (图标), html2pdf.js (PDF 导出)
- **后端**：Python 3.10 + FastAPI
  - 数据处理：Pandas, openpyxl
  - AI 接口：openai (Python 客户端适配)
- **部署**：Docker + 腾讯云 CloudBase (云托管 Web)

## 🚀 本地开发指南

### 1. 克隆项目

```bash
git clone https://github.com/AirXsf/B_Data_V.git
cd B_Data_V
```

### 2. 后端配置与启动 (FastAPI)

```bash
cd backend
# 推荐使用虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量 (AI 服务)
# 在 backend 目录下创建 .env 文件，并填入您的 API 信息
# OPENAI_API_KEY=your_api_key
# OPENAI_MODEL=your_model_name
# OPENAI_API_BASE=your_api_base_url

# 启动服务 (默认运行在 http://127.0.0.1:8000)
uvicorn main:app --reload
```

### 3. 前端配置与启动 (React + Vite)

打开一个新的终端窗口：

```bash
cd frontend

# 安装依赖
yarn install  # 或者 npm install

# 启动开发服务器 (默认运行在 http://localhost:5173)
yarn dev      # 或者 npm run dev
```

## ☁️ 线上部署指南 (腾讯云 CloudBase 云托管)

本项目已提供标准的 `Dockerfile`，支持在腾讯云托管上一键部署，前后端将合并在同一容器和域名下运行，彻底解决跨域问题。

1. 登录 [腾讯云 CloudBase 控制台](https://console.cloud.tencent.com/tcb)。
2. 进入您的环境，选择 **云托管 -> 服务管理 -> 新建服务**。
3. 绑定本 GitHub 仓库，选择 `main` 分支。
4. **服务端口**：务必设置为 **`80`**。
5. **环境变量**：在控制台中添加后端的环境变量（`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_API_BASE`）。
6. 点击**部署**，等待云端自动拉取代码、构建镜像并发布。部署完成后即可获得可用的公网 HTTPS 访问链接。

## 📁 核心数据源要求

系统主要读取 Excel 文件的 `存货收发存汇总` sheet 表进行分析。
关键依赖字段（需确保 Excel 列名一致或支持代码中的模糊匹配）：

- `存货编码`
- `存货名称`
- `期初数量`
- `结存数量`
- `发出数量`
- `基础需求数量` (用于低库存预警)
- 相关入库、出库单据流水字段 (用于分析部门和项目消耗)

---

_Generated with ❤️ for B_Data_V._
