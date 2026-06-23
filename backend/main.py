from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import io
import os
import json
import httpx
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Allow CORS for local dev and cloud deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def safe_number(val):
    try:
        return float(val) if pd.notnull(val) else 0.0
    except:
        return 0.0

def parse_date(val):
    if pd.isnull(val):
        return None
    
    # Check if the value is a string that looks like a pure number (e.g. "202503")
    s = str(val).strip()
    # Handle normal format like 202501 (YYYYMM)
    if s.isdigit():
        if len(s) == 6:
            return f"{s[:4]}-{s[4:]}"
        # If it's a weird format like 2025010, treat it as dirty data and filter it out
        else:
            return None
        
    # Handle normal dates using pandas
    try:
        dt = pd.to_datetime(val)
        # Sometimes pd.to_datetime parses weird strings to 1970
        if dt.year < 2000 or dt.year > 2100:
            return None
        return dt.strftime("%Y-%m")
    except:
        # Fallback for Excel serial dates if pd.to_datetime fails
        if isinstance(val, (int, float)) or (isinstance(val, str) and val.replace('.', '', 1).isdigit()):
            try:
                num_val = float(val)
                # Excel dates are usually > 40000 (year 2009+) and < 60000 (year 2064+)
                if 30000 < num_val < 70000:
                    return pd.to_datetime(num_val, unit='D', origin='1899-12-30').strftime("%Y-%m")
            except:
                pass
        return None

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        try:
            excel_data = pd.ExcelFile(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid Excel file")
            
        sheet_names = excel_data.sheet_names
        
        in_sheet = next((s for s in sheet_names if any(x in s for x in ['入', '采购', 'purchase', 'in'])), sheet_names[0])
        out_sheet = next((s for s in sheet_names if any(x in s for x in ['出', '领', 'issue', 'out'])), sheet_names[1] if len(sheet_names)>1 else sheet_names[0])
        stock_sheet = next((s for s in sheet_names if any(x in s for x in ['结存', '库存', 'stock', 'summary', '汇总'])), sheet_names[2] if len(sheet_names)>2 else sheet_names[0])

        df_in = pd.read_excel(excel_data, sheet_name=in_sheet)
        df_out = pd.read_excel(excel_data, sheet_name=out_sheet)
        df_stock = pd.read_excel(excel_data, sheet_name=stock_sheet)
        
        # If stock sheet has a title row, the actual headers might be in row 0
        if 'Unnamed: 1' in df_stock.columns or 'Unnamed: 2' in df_stock.columns:
            # Let's try to find the row that contains '存货编码' or '期初'
            for idx, row in df_stock.head(5).iterrows():
                row_strs = [str(x) for x in row.values]
                if any('编码' in x for x in row_strs) or any('期初' in x for x in row_strs):
                    df_stock.columns = row.values
                    df_stock = df_stock.iloc[idx+1:].reset_index(drop=True)
                    break

        # Standardize columns for IN
        df_in.columns = [str(c).strip() for c in df_in.columns]
        in_date_col = next((c for c in df_in.columns if any(x in c for x in ['日期', '单据', 'date'])), None)
        in_code_col = next((c for c in df_in.columns if any(x in c for x in ['存货编码', '物料编码', '编码', 'code'])), None)
        in_name_col = next((c for c in df_in.columns if any(x in c for x in ['存货名称', '物料名称', '名称', 'material'])), None)
        in_qty_col = next((c for c in df_in.columns if any(x in c for x in ['数量', '入库数量', 'qty'])), None)
        in_amt_col = next((c for c in df_in.columns if any(x in c for x in ['金额', '本币无税金额', '总价', 'amount'])), None)
        in_cat_col = next((c for c in df_in.columns if any(x in c for x in ['入库类别', '类别', 'category'])), None)
        in_dept_col = next((c for c in df_in.columns if any(x in c for x in ['需求部门', '部门', 'department'])), None)
        in_proj_col = next((c for c in df_in.columns if any(x in c for x in ['需求项目', '项目', 'project'])), None)
        
        inbound = []
        if in_qty_col and in_amt_col and in_code_col:
            for _, row in df_in.iterrows():
                qty = safe_number(row.get(in_qty_col))
                if qty <= 0: continue
                d_str = parse_date(row.get(in_date_col)) if in_date_col else None
                if not d_str: continue # Skip rows without valid date
                inbound.append({
                    "date": d_str,
                    "materialCode": str(row.get(in_code_col)),
                    "materialName": str(row.get(in_name_col)) if in_name_col else "",
                    "category": str(row.get(in_cat_col, "其他")),
                    "department": str(row.get(in_dept_col, "未分配")),
                    "project": str(row.get(in_proj_col, "未分配")),
                    "quantity": qty,
                    "amount": safe_number(row.get(in_amt_col)),
                    "type": "in"
                })

        # Standardize columns for OUT
        df_out.columns = [str(c).strip() for c in df_out.columns]
        out_date_col = next((c for c in df_out.columns if any(x in c for x in ['日期', '单据', 'date'])), None)
        out_code_col = next((c for c in df_out.columns if any(x in c for x in ['存货编码', '物料编码', '编码', 'code'])), None)
        out_name_col = next((c for c in df_out.columns if any(x in c for x in ['存货名称', '物料名称', '名称', 'material'])), None)
        out_qty_col = next((c for c in df_out.columns if any(x in c for x in ['数量', '出库数量', 'qty'])), None)
        out_amt_col = next((c for c in df_out.columns if any(x in c for x in ['金额', '本币无税金额', '总价', 'amount'])), None)
        out_cat_col = next((c for c in df_out.columns if any(x in c for x in ['出库类别', '类别', 'category'])), None)
        out_dept_col = next((c for c in df_out.columns if any(x in c for x in ['需求部门', '部门', 'department'])), None)
        out_proj_col = next((c for c in df_out.columns if any(x in c for x in ['需求项目', '项目', 'project'])), None)
        
        outbound = []
        if out_qty_col and out_amt_col and out_code_col:
            for _, row in df_out.iterrows():
                qty = safe_number(row.get(out_qty_col))
                if qty <= 0: continue
                d_str = parse_date(row.get(out_date_col)) if out_date_col else None
                if not d_str: continue # Skip rows without valid date
                outbound.append({
                    "date": d_str,
                    "materialCode": str(row.get(out_code_col)),
                    "materialName": str(row.get(out_name_col)) if out_name_col else "",
                    "category": str(row.get(out_cat_col, "其他")),
                    "department": str(row.get(out_dept_col, "未分配")),
                    "project": str(row.get(out_proj_col, "未分配")),
                    "quantity": qty,
                    "amount": safe_number(row.get(out_amt_col)),
                    "type": "out"
                })

        df_inbound = pd.DataFrame(inbound)
        df_outbound = pd.DataFrame(outbound)
        
        # Get initial balance from df_stock if available
        initial_balance = 0
        if not df_stock.empty:
            df_stock.columns = [str(c).strip() for c in df_stock.columns]
            init_amt_col = next((c for c in df_stock.columns if '期初金额' in c), None)
            if init_amt_col:
                initial_balance = pd.to_numeric(df_stock[init_amt_col], errors='coerce').sum()
                if pd.isna(initial_balance):
                    initial_balance = 0

        # 1. Trend Data
        trend_map = {}
        if not df_inbound.empty:
            for _, r in df_inbound.iterrows():
                m = r['date']
                if m not in trend_map: trend_map[m] = {"inAmount": 0, "outAmount": 0, "balance": 0}
                trend_map[m]["inAmount"] += r['amount']
        if not df_outbound.empty:
            for _, r in df_outbound.iterrows():
                m = r['date']
                if m not in trend_map: trend_map[m] = {"inAmount": 0, "outAmount": 0, "balance": 0}
                trend_map[m]["outAmount"] += r['amount']
        
        months = sorted(list(trend_map.keys()))
        trend_data = []
        running_balance = initial_balance
        for m in months:
            running_balance += (trend_map[m]["inAmount"] - trend_map[m]["outAmount"])
            trend_data.append({
                "month": m,
                "inAmount": trend_map[m]["inAmount"],
                "outAmount": trend_map[m]["outAmount"],
                "balance": running_balance
            })

        # 2. Category Composition
        in_cat = df_inbound.groupby("category")["amount"].sum().reset_index() if not df_inbound.empty else pd.DataFrame(columns=["category", "amount"])
        in_total = in_cat["amount"].sum()
        inbound_composition = [{"materialName": r["category"], "amount": r["amount"], "percentage": (r["amount"]/in_total*100) if in_total>0 else 0} for _, r in in_cat.iterrows()]

        out_cat = df_outbound.groupby("category")["amount"].sum().reset_index() if not df_outbound.empty else pd.DataFrame(columns=["category", "amount"])
        out_total = out_cat["amount"].sum()
        outbound_composition = [{"materialName": r["category"], "amount": r["amount"], "percentage": (r["amount"]/out_total*100) if out_total>0 else 0} for _, r in out_cat.iterrows()]

        # 3. Top Materials (IN)
        if not df_inbound.empty:
            top_mats = df_inbound.groupby(["materialCode", "materialName"])["amount"].sum().reset_index()
            top_mats = top_mats.sort_values(by="amount", ascending=False).head(10)
            top_materials = [{"materialCode": r["materialCode"], "materialName": r["materialName"], "amount": r["amount"], "rank": i+1} for i, r in top_mats.iterrows()]
        else:
            top_materials = []

        # Department Analysis
        dept_map = {}
        if not df_inbound.empty:
            for _, r in df_inbound.iterrows():
                d = r['department']
                if d not in dept_map: dept_map[d] = {"in": 0, "out": 0}
                dept_map[d]["in"] += r['amount']
        if not df_outbound.empty:
            for _, r in df_outbound.iterrows():
                d = r['department']
                if d not in dept_map: dept_map[d] = {"in": 0, "out": 0}
                dept_map[d]["out"] += r['amount']
        
        dept_analysis = [{"department": k, "inAmount": v["in"], "outAmount": v["out"], "difference": v["in"]-v["out"]} for k, v in dept_map.items()]

        # Combine inventory data to send back to frontend store
        all_inventory = inbound + outbound

        df_all = pd.DataFrame(all_inventory)

        # Turnover Rate
        top_turnover = []
        bottom_turnover = []
        if not df_outbound.empty and not df_inbound.empty:
            out_qty = df_outbound.groupby(["materialCode", "materialName"])["quantity"].sum().reset_index()
            out_qty.rename(columns={"quantity": "monthlyOutQty"}, inplace=True)
            
            in_qty = df_inbound.groupby(["materialCode", "materialName"])["quantity"].sum().reset_index()
            in_qty.rename(columns={"quantity": "avgStock"}, inplace=True) # Approximate avg stock with inbound for now
            
            turnover_df = pd.merge(out_qty, in_qty, on=["materialCode", "materialName"], how="outer").fillna(0)
            turnover_df["avgStock"] = turnover_df["avgStock"].replace(0, 1) # avoid division by zero
            turnover_df["turnoverRate"] = (turnover_df["monthlyOutQty"] / turnover_df["avgStock"]) * 100
            
            turnover_df = turnover_df.sort_values(by="turnoverRate", ascending=False)
            
            top_t = turnover_df.head(10)
            bot_t = turnover_df.tail(10)
            
            top_turnover = [{"materialCode": r["materialCode"], "materialName": r["materialName"], "turnoverRate": r["turnoverRate"], "monthlyOutQty": r["monthlyOutQty"], "avgStock": r["avgStock"]} for _, r in top_t.iterrows()]
            bottom_turnover = [{"materialCode": r["materialCode"], "materialName": r["materialName"], "turnoverRate": r["turnoverRate"], "monthlyOutQty": r["monthlyOutQty"], "avgStock": r["avgStock"]} for _, r in bot_t.iterrows()]
            
        # Department Composition
        if not df_all.empty:
            dept_cat = df_all.groupby("department")["amount"].sum().reset_index()
            dept_total = dept_cat["amount"].sum()
            dept_composition = [{"materialName": r["department"], "amount": r["amount"], "percentage": (r["amount"]/dept_total*100) if dept_total>0 else 0} for _, r in dept_cat.iterrows()]
        else:
            dept_composition = []

        # Project Composition
        if not df_all.empty:
            proj_cat = df_all.groupby("project")["amount"].sum().reset_index()
            proj_total = proj_cat["amount"].sum()
            proj_composition = [{"materialName": r["project"], "amount": r["amount"], "percentage": (r["amount"]/proj_total*100) if proj_total>0 else 0} for _, r in proj_cat.iterrows()]
        else:
            proj_composition = []

        # Project Analysis
        proj_map = {}
        if not df_inbound.empty:
            for _, r in df_inbound.iterrows():
                p = r['project']
                if p not in proj_map: proj_map[p] = {"in": 0, "out": 0}
                proj_map[p]["in"] += r['amount']
        if not df_outbound.empty:
            for _, r in df_outbound.iterrows():
                p = r['project']
                if p not in proj_map: proj_map[p] = {"in": 0, "out": 0}
                proj_map[p]["out"] += r['amount']
        
        proj_analysis = []
        for k, v in proj_map.items():
            status = "normal"
            if v["out"] > v["in"]: status = "overbudget"
            elif v["in"] > v["out"] * 1.5 and v["out"] > 0: status = "waste"
            proj_analysis.append({"project": k, "purchaseAmount": v["in"], "usedAmount": v["out"], "status": status})

        base_demand_map = {}
        if not df_stock.empty:
            code_col = next((c for c in df_stock.columns if '编码' in c or 'code' in c.lower()), None)
            base_col = next((c for c in df_stock.columns if '基础需求' in c), None)
            if code_col and base_col:
                for _, r in df_stock.iterrows():
                    code = str(r.get(code_col)).strip()
                    base = safe_number(r.get(base_col))
                    if base > 0:
                        base_demand_map[code] = base

        warnings = []
        
        # 呆滞库存预警 & 低库存预警
        if not df_inbound.empty and not df_outbound.empty:
            df_inbound['date_dt'] = pd.to_datetime(df_inbound['date'], errors='coerce')
            df_outbound['date_dt'] = pd.to_datetime(df_outbound['date'], errors='coerce')
            
            # Group by material
            last_out = df_outbound.groupby(["materialCode", "materialName"])['date_dt'].max().reset_index()
            total_in = df_inbound.groupby(["materialCode", "materialName"])['quantity'].sum().reset_index()
            total_out = df_outbound.groupby(["materialCode", "materialName"])['quantity'].sum().reset_index()
            
            stock_status = pd.merge(total_in, total_out, on=["materialCode", "materialName"], how="outer", suffixes=('_in', '_out')).fillna(0)
            stock_status['currentStock'] = stock_status['quantity_in'] - stock_status['quantity_out']
            stock_status = pd.merge(stock_status, last_out, on=["materialCode", "materialName"], how="left")
            
            now = pd.to_datetime('2025-06-01') # Use a fixed date for demo or datetime.now()
            
            for i, r in stock_status.iterrows():
                mat_code = r['materialCode']
                mat_name = r['materialName']
                current_stock = r['currentStock']
                last_out_date = r['date_dt']
                
                # 呆滞预警
                if pd.notnull(last_out_date) and current_stock > 0:
                    months_idle = (now.year - last_out_date.year) * 12 + now.month - last_out_date.month
                    if months_idle > 6:
                        warnings.append({
                            "id": f"w-{i}-stale-6", "type": "stale", "level": "danger",
                            "materialCode": mat_code, "materialName": mat_name,
                            "message": f"严重呆滞: 超过 {months_idle} 个月未出库",
                            "currentStock": current_stock, "threshold": 6, "baselineDemand": 0,
                            "monthsSinceLastTransaction": months_idle,
                            "suggestion": "建议立即评估折价处理或报废"
                        })
                    elif months_idle > 3:
                        warnings.append({
                            "id": f"w-{i}-stale-3", "type": "stale", "level": "warning",
                            "materialCode": mat_code, "materialName": mat_name,
                            "message": f"呆滞风险: 超过 {months_idle} 个月未出库",
                            "currentStock": current_stock, "threshold": 3, "baselineDemand": 0,
                            "monthsSinceLastTransaction": months_idle,
                            "suggestion": "建议优先跨部门调拨"
                        })
                
                # 低库存预警 (使用基础需求数量)
                base_demand = base_demand_map.get(mat_code, 0)
                
                # 如果没有配置基础需求量，用历史平均作为 fallback
                if base_demand == 0:
                    avg_monthly_out = r['quantity_out'] / max(1, len(months))
                    base_demand = avg_monthly_out * 1.5
                
                if current_stock < base_demand and current_stock >= 0:
                    warnings.append({
                        "id": f"w-{i}-low", "type": "low_stock", "level": "warning",
                        "materialCode": mat_code, "materialName": mat_name,
                        "message": f"库存不足: 当前库存({current_stock})低于基础需求({round(base_demand,1)})",
                        "currentStock": current_stock, "threshold": base_demand, "baselineDemand": base_demand,
                        "monthsSinceLastTransaction": 0,
                        "suggestion": "建议尽快安排采购补货"
                    })

        # Forecast Data
        forecast_data = []
        if trend_data:
            latest_month = trend_data[-1]
            avg_in = sum(t["inAmount"] for t in trend_data) / len(trend_data)
            avg_out = sum(t["outAmount"] for t in trend_data) / len(trend_data)
            
            y, m = map(int, latest_month["month"].split('-'))
            current_balance = latest_month["balance"]
            
            for i in range(1, 7):
                m += 1
                if m > 12:
                    m -= 12
                    y += 1
                
                f_in = int(avg_in * (0.9 + np.random.random() * 0.2))
                f_out = int(avg_out * (0.9 + np.random.random() * 0.2))
                current_balance += (f_in - f_out)
                
                forecast_data.append({
                    "month": f"{y}-{str(m).zfill(2)}",
                    "forecastStock": current_balance,
                    "forecastInAmount": f_in,
                    "forecastOutAmount": f_out,
                    "inTransitPurchase": int(f_in * 0.5),
                    "salesDemand": f_out
                })

        return {
            "inventoryData": all_inventory,
            "stockData": [], # Simplified for now, unless we parse stock_sheet fully
            "analyticsResult": {
                "trendData": trend_data,
                "inboundComposition": inbound_composition,
                "outboundComposition": outbound_composition,
                "departmentComposition": dept_composition,
                "projectComposition": proj_composition,
                "topMaterials": top_materials,
                "topTurnover": top_turnover,
                "bottomTurnover": bottom_turnover,
                "departmentAnalysis": dept_analysis,
                "projectAnalysis": proj_analysis,
                "warnings": warnings,
                "forecastData": forecast_data,
                "analysisText": ""
            }
        }
        
    except Exception as e:
        print(f"Error parsing excel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze")
async def analyze_data(data: dict):
    # 获取模型配置，优先使用标准的 OPENAI 环境变量
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY environment variable")

    model = os.getenv("OPENAI_MODEL")
    if not model:
        raise HTTPException(status_code=500, detail="Missing OPENAI_MODEL environment variable")

    # 默认使用 OpenAI 官方地址，如果是豆包则使用配置的火山引擎地址
    api_base = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    url = f"{api_base.rstrip('/')}/chat/completions"

    # Build prompt
    prompt = f"""
    你是一位专业的企业存货管理分析专家，请基于以下存货管理数据，生成一份中文分析报告。

    【数据概览】
    - 出入库记录数：{data.get('totalRecords', 0)} 条
    - 入库总金额：{data.get('totalIn', 0)} 元
    - 出库总金额：{data.get('totalOut', 0)} 元

    【趋势分析】
    {data.get('trendSummary', '')}

    【报告格式要求】
    1. 请使用中文输出
    2. 使用 Markdown 格式
    3. 内容控制在 500~800 字
    """

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "你是一位经验丰富的企业供应链与库存管理专家。"},
            {"role": "user", "content": prompt}
        ],
        "stream": True 
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    async def stream_generator():
        try:
            # Format the API URL dynamically to support any OpenAI-compatible endpoint
            endpoint = f"{api_base.rstrip('/')}/chat/completions"
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", endpoint, json=payload, headers=headers) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if line:
                            # 必须严格加上两个换行符 \n\n，这是 Server-Sent Events (SSE) 协议强制要求的 flush 标志
                            # 如果只加一个 \n，很多前端浏览器或代理服务器会将其当做未完成的块一直缓存在内存里，直到攒够一大波才吐给前端，导致严重的延迟。
                            yield line + "\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'choices':[{'delta':{'content':f'AI调用失败: {str(e)}'}}]})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no" # Disable buffering in Nginx/proxies
    })

