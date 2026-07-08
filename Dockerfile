# 阶段1：构建前端
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install
COPY frontend ./
RUN yarn build

# 阶段2：构建后端并合并前端静态文件
FROM python:3.10-slim
WORKDIR /app/backend

# 复制后端依赖并安装
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.tencent.com/pypi/simple/
# 安装挂载静态文件需要的库
RUN pip install --no-cache-dir aiofiles -i https://mirrors.tencent.com/pypi/simple/

# 复制后端源码
COPY backend ./

# 复制前端构建产物到后端 static 目录
COPY --from=frontend-builder /app/frontend/dist ./static

# 暴露端口（腾讯云托管默认推荐 80 端口）
EXPOSE 80

# 启动 FastAPI，并绑定到 80 端口
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]