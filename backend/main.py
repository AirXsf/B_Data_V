from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import io
import os
import json
import httpx
from dotenv import load_dotenv
import re

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

def safe_text(val, default=""):
    if pd.isnull(val):
        return default
    text = str(val).strip()
    return text if text else default

def read_text_field(row, column, missing_default="", blank_default=""):
    if not column:
        return missing_default
    value = safe_text(row.get(column))
    return value if value else blank_default

def normalize_header(text):
    return str(text).strip().replace(" ", "").replace("\n", "").replace("\r", "")

def natural_label_sort_key(text):
    value = safe_text(text)
    match = re.search(r'(\d+)$', value)
    if match:
        return (value[:match.start()], int(match.group(1)))
    return (value, float('inf'))

def unique_headers(values):
    counts = {}
    headers = []
    for value in values:
        base = normalize_header(value) or "unnamed"
        counts[base] = counts.get(base, 0) + 1
        if counts[base] == 1:
            headers.append(base)
        else:
            headers.append(f"{base}__{counts[base]}")
    return headers

def header_alias_score(header, exact_aliases=None, contains_aliases=None):
    exact_aliases = exact_aliases or []
    contains_aliases = contains_aliases or []
    normalized = normalize_header(header)
    score = 0

    for alias in exact_aliases:
        if normalized == normalize_header(alias):
            score += 100
    for alias in contains_aliases:
        normalized_alias = normalize_header(alias)
        if normalized_alias and normalized_alias in normalized:
            score += 20
    return score

def sample_non_empty(series, limit=12):
    values = []
    for value in series:
        text = safe_text(value)
        if text:
            values.append(text)
        if len(values) >= limit:
            break
    return values

def ratio_score(samples, predicate):
    if not samples:
        return 0
    matches = 0
    for sample in samples:
        if predicate(sample):
            matches += 1
    return int((matches / len(samples)) * 40)

def looks_like_date_text(text):
    if not text:
        return False
    if parse_date(text):
        return True
    normalized = text.replace("/", "-").replace(".", "-")
    try:
        dt = pd.to_datetime(normalized, errors='coerce')
        return pd.notnull(dt)
    except:
        return False

def looks_like_material_code(text):
    if not text:
        return False
    stripped = text.strip()
    if len(stripped) < 4:
        return False
    has_digit = any(ch.isdigit() for ch in stripped)
    has_alpha = any(ch.isalpha() for ch in stripped)
    return has_digit and (has_alpha or "-" in stripped)

def is_department_value(text):
    return any(token in text for token in ["部", "科", "车间", "中心", "仓", "组", "线", "team", "department"])

def is_project_value(text):
    return any(token in text for token in ["项目", "工程", "课题", "project", "订单"])

def is_inbound_category_value(text):
    return any(token in text for token in ["入库", "采购", "调拨", "盘盈", "退货", "委外"])

def is_outbound_category_value(text):
    return any(token in text for token in ["出库", "领用", "消耗", "委外", "借料", "退料"])

def looks_like_material_name(text):
    if not text:
        return False
    if looks_like_material_code(text):
        return False
    if any(token in text for token in ["公司", "供应商", "项目", "部门"]):
        return False
    return True

def choose_best_column(df, exact_aliases=None, contains_aliases=None, value_checker=None):
    candidates = []
    for column in df.columns:
        samples = sample_non_empty(df[column])
        score = header_alias_score(column, exact_aliases, contains_aliases)
        if value_checker:
            score += ratio_score(samples, value_checker)
        if score > 0:
            candidates.append((score, column))

    if not candidates:
        return None
    candidates.sort(key=lambda item: (-item[0], list(df.columns).index(item[1])))
    return candidates[0][1]

def detect_header_row(raw_df, required_aliases):
    best_idx = 0
    best_score = -1
    max_scan = min(len(raw_df), 8)
    for idx in range(max_scan):
        row_values = [normalize_header(value) for value in raw_df.iloc[idx].tolist()]
        score = 0
        for alias_group in required_aliases:
            if any(normalize_header(alias) in row_values for alias in alias_group):
                score += 1
        if score > best_score:
            best_idx = idx
            best_score = score
    return best_idx

def read_sheet_with_detected_header(excel_data, sheet_name, required_aliases):
    raw_df = pd.read_excel(excel_data, sheet_name=sheet_name, header=None)
    if raw_df.empty:
        return raw_df
    header_row_idx = detect_header_row(raw_df, required_aliases)
    headers = unique_headers(raw_df.iloc[header_row_idx].tolist())
    df = raw_df.iloc[header_row_idx + 1:].copy().reset_index(drop=True)
    df.columns = headers
    return df

def parse_date(val):
    if pd.isnull(val):
        return None
    
    # Check if the value is a string that looks like a pure number (e.g. "202503" or "2025010")
    s = str(val).strip()
    if s.isdigit():
        if len(s) >= 5:
            year = s[:4]
            month_part = s[4:]
            try:
                month = int(month_part)
                if 1 <= month <= 12:
                    return f"{year}-{str(month).zfill(2)}"
            except:
                pass
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

        df_in = read_sheet_with_detected_header(
            excel_data,
            in_sheet,
            [
                ['入库日期', '日期'],
                ['存货编码', '物料编码', '材料编码', '编码'],
                ['本币无税金额', '入库金额', '金额'],
                ['数量', '入库数量']
            ]
        )
        df_out = read_sheet_with_detected_header(
            excel_data,
            out_sheet,
            [
                ['出库日期', '日期'],
                ['材料编码', '存货编码', '物料编码', '编码'],
                ['金额', '本币无税金额', '出库金额'],
                ['数量', '出库数量']
            ]
        )
        df_stock = read_sheet_with_detected_header(
            excel_data,
            stock_sheet,
            [
                ['存货编码', '物料编码', '材料编码', '编码'],
                ['期初金额'],
                ['结存金额'],
                ['基础需求数量', '基础需求']
            ]
        )
        
        in_date_col = choose_best_column(df_in, ['入库日期', '日期'], ['date'], looks_like_date_text)
        in_code_col = choose_best_column(df_in, ['存货编码', '物料编码', '材料编码', '编码'], ['code'], looks_like_material_code)
        in_name_col = choose_best_column(df_in, ['存货名称', '物料名称', '材料名称'], ['material'], looks_like_material_name)
        in_qty_col = choose_best_column(df_in, ['入库数量', '数量'], ['qty'], lambda text: safe_number(text) != 0)
        in_amt_col = choose_best_column(df_in, ['本币无税金额', '入库金额', '金额'], ['amount', '总价'], lambda text: safe_number(text) != 0)
        in_cat_col = choose_best_column(df_in, ['入库类别'], ['category'], is_inbound_category_value)
        in_dept_col = choose_best_column(df_in, ['需求部门', '部门'], ['department'], is_department_value)
        in_proj_col = choose_best_column(df_in, ['需求项目', '项目'], ['project'], is_project_value)
        
        inbound = []
        if in_qty_col and in_amt_col and in_code_col:
            for _, row in df_in.iterrows():
                qty = safe_number(row.get(in_qty_col))
                amount = safe_number(row.get(in_amt_col))
                if qty == 0 and amount == 0:
                    continue
                d_str = parse_date(row.get(in_date_col)) if in_date_col else None
                if not d_str: continue # Skip rows without valid date
                material_code = safe_text(row.get(in_code_col))
                if not material_code:
                    continue
                inbound.append({
                    "date": d_str,
                    "materialCode": material_code,
                    "materialName": read_text_field(row, in_name_col, "", material_code),
                    "category": safe_text(row.get(in_cat_col), "其他"),
                    "department": read_text_field(row, in_dept_col, "", "未分配"),
                    "project": read_text_field(row, in_proj_col, "", "未分配"),
                    "quantity": qty,
                    "amount": amount,
                    "type": "in"
                })

        # Standardize columns for OUT
        out_date_col = choose_best_column(df_out, ['出库日期', '日期'], ['date'], looks_like_date_text)
        out_code_col = choose_best_column(df_out, ['材料编码', '存货编码', '物料编码', '编码'], ['code'], looks_like_material_code)
        out_name_col = choose_best_column(df_out, ['存货名称', '物料名称', '材料名称'], ['material'], looks_like_material_name)
        out_qty_col = choose_best_column(df_out, ['出库数量', '数量'], ['qty'], lambda text: safe_number(text) != 0)
        out_amt_col = choose_best_column(df_out, ['本币无税金额', '出库金额', '金额'], ['amount', '总价'], lambda text: safe_number(text) != 0)
        out_cat_col = choose_best_column(df_out, ['出库类别'], ['category'], is_outbound_category_value)
        out_dept_col = choose_best_column(df_out, ['需求部门', '部门'], ['department'], is_department_value)
        out_proj_col = choose_best_column(df_out, ['需求项目', '项目'], ['project'], is_project_value)
        
        outbound = []
        if out_qty_col and out_amt_col and out_code_col:
            for _, row in df_out.iterrows():
                qty = safe_number(row.get(out_qty_col))
                amount = safe_number(row.get(out_amt_col))
                if qty == 0 and amount == 0:
                    continue
                d_str = parse_date(row.get(out_date_col)) if out_date_col else None
                if not d_str: continue # Skip rows without valid date
                material_code = safe_text(row.get(out_code_col))
                if not material_code:
                    continue
                outbound.append({
                    "date": d_str,
                    "materialCode": material_code,
                    "materialName": read_text_field(row, out_name_col, "", material_code),
                    "category": safe_text(row.get(out_cat_col), "其他"),
                    "department": read_text_field(row, out_dept_col, "", "未分配"),
                    "project": read_text_field(row, out_proj_col, "", "未分配"),
                    "quantity": qty,
                    "amount": amount,
                    "type": "out"
                })

        df_inbound = pd.DataFrame(inbound)
        df_outbound = pd.DataFrame(outbound)
        
        # Get initial balance from df_stock if available
        initial_balance = 0
        stock_data = []
        if not df_stock.empty:
            init_amt_col = choose_best_column(df_stock, ['期初金额'], ['期初金额'], lambda text: safe_number(text) != 0)
            if init_amt_col:
                initial_balance = pd.to_numeric(df_stock[init_amt_col], errors='coerce').sum()
                if pd.isna(initial_balance):
                    initial_balance = 0

            stock_code_col = choose_best_column(df_stock, ['存货编码', '物料编码', '材料编码', '编码'], ['code'], looks_like_material_code)
            stock_name_col = choose_best_column(df_stock, ['存货名称', '物料名称', '材料名称'], ['material'], looks_like_material_name)
            stock_balance_qty_col = choose_best_column(df_stock, ['结存数量', '库存数量', '数量'], ['quantity'], lambda text: safe_number(text) != 0)
            stock_balance_amt_col = choose_best_column(df_stock, ['结存金额', '库存金额', '金额'], ['amount'], lambda text: safe_number(text) != 0)
            stock_base_demand_col = choose_best_column(df_stock, ['基础需求数量', '基础需求'], ['基础需求'], lambda text: safe_number(text) != 0)

            if stock_code_col:
                for _, row in df_stock.iterrows():
                    code = safe_text(row.get(stock_code_col))
                    if not code:
                        continue
                    stock_data.append({
                        "materialCode": code,
                        "materialName": read_text_field(row, stock_name_col, "", code),
                        "balanceQuantity": safe_number(row.get(stock_balance_qty_col)) if stock_balance_qty_col else 0,
                        "balanceAmount": safe_number(row.get(stock_balance_amt_col)) if stock_balance_amt_col else 0,
                        "baseDemandQuantity": safe_number(row.get(stock_base_demand_col)) if stock_base_demand_col else 0
                    })

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
        inbound_composition = [{
            "materialCode": r["category"],
            "materialName": r["category"],
            "amount": r["amount"],
            "percentage": (r["amount"]/in_total*100) if in_total>0 else 0
        } for _, r in in_cat.iterrows()]

        out_cat = df_outbound.groupby("category")["amount"].sum().reset_index() if not df_outbound.empty else pd.DataFrame(columns=["category", "amount"])
        out_total = out_cat["amount"].sum()
        outbound_composition = [{
            "materialCode": r["category"],
            "materialName": r["category"],
            "amount": r["amount"],
            "percentage": (r["amount"]/out_total*100) if out_total>0 else 0
        } for _, r in out_cat.iterrows()]

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
                d = str(r['department']).strip() if pd.notna(r['department']) else ""
                if not d or d.lower() == 'nan': continue
                if d not in dept_map: dept_map[d] = {"in": 0, "out": 0}
                dept_map[d]["in"] += float(r['amount']) if pd.notna(r['amount']) else 0
        if not df_outbound.empty:
            for _, r in df_outbound.iterrows():
                d = str(r['department']).strip() if pd.notna(r['department']) else ""
                if not d or d.lower() == 'nan': continue
                if d not in dept_map: dept_map[d] = {"in": 0, "out": 0}
                dept_map[d]["out"] += float(r['amount']) if pd.notna(r['amount']) else 0
        
        dept_analysis = [{"department": k, "inAmount": v["in"], "outAmount": v["out"], "difference": v["in"]-v["out"]} for k, v in dept_map.items()]

        # Combine inventory data to send back to frontend store
        all_inventory = inbound + outbound

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

        # Project Analysis Map
        proj_map = {}
        if not df_inbound.empty:
            for _, r in df_inbound.iterrows():
                p = str(r['project']).strip() if pd.notna(r['project']) else ""
                if not p or p.lower() == 'nan': continue
                if p not in proj_map: proj_map[p] = {"in": 0, "out": 0}
                proj_map[p]["in"] += float(r['amount']) if pd.notna(r['amount']) else 0
        if not df_outbound.empty:
            for _, r in df_outbound.iterrows():
                p = str(r['project']).strip() if pd.notna(r['project']) else ""
                if not p or p.lower() == 'nan': continue
                if p not in proj_map: proj_map[p] = {"in": 0, "out": 0}
                proj_map[p]["out"] += float(r['amount']) if pd.notna(r['amount']) else 0

        # Department Composition: strictly grouped from inbound purchase sheet
        if not df_inbound.empty:
            dept_source = df_inbound.copy()
            dept_source["department"] = dept_source["department"].apply(lambda value: safe_text(value))
            dept_source = dept_source[dept_source["department"] != ""]
            dept_cat = dept_source.groupby("department", sort=False)["amount"].sum().reset_index() if not dept_source.empty else pd.DataFrame(columns=["department", "amount"])
            dept_total = dept_cat["amount"].sum()
            dept_composition = [{
                "materialCode": r["department"],
                "materialName": r["department"],
                "amount": round(float(r["amount"]), 2),
                "percentage": round((float(r["amount"]) / dept_total * 100), 2) if dept_total > 0 else 0
            } for _, r in dept_cat.iterrows()]
        else:
            dept_composition = []

        # Project Composition: strictly grouped from inbound purchase sheet
        if not df_inbound.empty:
            proj_source = df_inbound.copy()
            proj_source["project"] = proj_source["project"].apply(lambda value: safe_text(value))
            proj_source = proj_source[proj_source["project"] != ""]
            proj_cat = proj_source.groupby("project", sort=False)["amount"].sum().reset_index() if not proj_source.empty else pd.DataFrame(columns=["project", "amount"])
            if not proj_cat.empty:
                proj_cat = proj_cat.sort_values(by="project", key=lambda col: col.map(natural_label_sort_key)).reset_index(drop=True)
            proj_total = proj_cat["amount"].sum()
            proj_composition = [{
                "materialCode": r["project"],
                "materialName": r["project"],
                "amount": round(float(r["amount"]), 2),
                "percentage": round((float(r["amount"]) / proj_total * 100), 2) if proj_total > 0 else 0
            } for _, r in proj_cat.iterrows()]
        else:
            proj_composition = []

        # Project Analysis List
        proj_analysis = []
        for k, v in proj_map.items():
            status = "normal"
            if v["out"] > v["in"]: status = "overbudget"
            elif v["in"] > v["out"] * 1.5 and v["out"] > 0: status = "waste"
            proj_analysis.append({"project": k, "purchaseAmount": round(v["in"], 2), "usedAmount": round(v["out"], 2), "status": status})

        base_demand_map = {}
        if not df_stock.empty:
            code_col = choose_best_column(df_stock, ['存货编码', '物料编码', '材料编码', '编码'], ['code'], looks_like_material_code)
            base_col = choose_best_column(df_stock, ['基础需求数量', '基础需求'], ['基础需求'], lambda text: safe_number(text) != 0)
            if code_col and base_col:
                for _, r in df_stock.iterrows():
                    code = safe_text(r.get(code_col)).strip()
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
            "stockData": stock_data,
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
