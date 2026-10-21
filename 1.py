import requests
import pandas as pd
import json
import os
import time
import random
from io import StringIO
from collections import defaultdict

# ========== 配置区，Cookie失效后更新即可 ==========
# 从环境变量读取：PowerShell 用 $env:HEBEEA_COOKIE="..." 临时设置
COOKIE = os.environ.get("HEBEEA_COOKIE", "")
if not COOKIE:
    raise SystemExit("请先设置环境变量 HEBEEA_COOKIE，例如：$env:HEBEEA_COOKIE='JSESSIONID=...'")
URL = "https://gk.hebeea.edu.cn:88/xxcx/xxcxzx/lnwc"

BASE_FORM = {
    "id": "a952ff48-6008-4867-857c-d9049cce9371",
    "pcdm": "",
    "jhxzdm": "",
    "kldm": "",
    "yxsl": "",
    "lsnf": "2025",
    "lspcdm": "3",
    "lskldm": "B0",
    "lsklmc": "物理科目组合",
    "lsyxmc": "",
    "lszymc": "",
    "lskswc": "",
    "lsjswc": "",
    "page": "1"
}

# 抓取范围
START_PAGE = 1
END_PAGE = 1366
PROVINCE = "河北"
OUTPUT_FILE = "录取数据_标准导入格式.json"
# ==================================================

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Cookie": COOKIE,
    "Referer": URL,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
}

def to_int(val):
    try:
        return int(float(str(val).strip()))
    except:
        return None

def parse_page(html):
    """解析单页HTML，返回扁平的专业列表"""
    try:
        dfs = pd.read_html(StringIO(html), flavor="lxml", header=[0, 1])
        if not dfs:
            return []
        
        df = dfs[0].dropna(how="all")
        # 展平双行表头
        df.columns = [col[1] for col in df.columns]
        df.columns = [str(c).strip() for c in df.columns]
        
        result = []
        for _, row in df.iterrows():
            result.append({
                "year": to_int(row["年度"]),
                "collegeCode": str(row["院校 代号"]).strip(),
                "collegeName": str(row["院校名称"]).strip(),
                "majorCode": str(row["专业 代号"]).strip(),
                "majorName": str(row["专业名称"]).strip(),
                "minScore": to_int(row["最低分"]),
                "avgScore": to_int(row["平均分"]),
                "minRank": to_int(row["最低位次"]),
                "volunteerType": str(row["志愿号"]).strip()
            })
        return result
    except Exception as e:
        print(f"解析出错：{e}")
        return []

def build_target_format(flat_list):
    """按你指定的格式，构建 院校+majors 嵌套结构"""
    college_map = defaultdict(list)
    
    # 按院校代号分组
    for item in flat_list:
        college_map[item["collegeCode"]].append(item)
    
    result = []
    for code, items in college_map.items():
        college_name = items[0]["collegeName"]
        year = items[0]["year"]
        
        # 构建专业数组
        majors = []
        for item in items:
            majors.append({
                "majorCode": item["majorCode"],
                "majorName": item["majorName"],
                "minScore": item["minScore"],
                "avgScore": item["avgScore"],
                "minRank": item["minRank"],
                "volunteerType": item["volunteerType"]
            })
        
        # 构建单条院校数据
        result.append({
            "id": f"{code}_{year}",
            "collegeCode": code,
            "collegeName": college_name,
            "province": PROVINCE,
            "year": year,
            "isRealData": True,
            "majors": majors
        })
    
    return result

def main():
    all_flat = []
    
    for page in range(START_PAGE, END_PAGE + 1):
        form = BASE_FORM.copy()
        form["page"] = str(page)
        
        try:
            resp = requests.post(URL, data=form, headers=HEADERS, timeout=20)
            resp.encoding = "utf-8"
            
            if resp.status_code != 200:
                print(f"第{page}页请求失败")
                continue
            
            page_data = parse_page(resp.text)
            all_flat.extend(page_data)
            print(f"第{page}/{END_PAGE}页：解析 {len(page_data)} 条专业，累计 {len(all_flat)} 条")
            
            time.sleep(random.uniform(2, 3.5))
            
        except Exception as e:
            print(f"第{page}页异常：{e}")
            continue
    
    # 转为目标格式
    final_data = build_target_format(all_flat)
    
    # 保存JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, separators=(",", ":"))
    
    print(f"\n✅ 生成完成，共 {len(final_data)} 所院校，{len(all_flat)} 个专业")
    print(f"📄 文件：{OUTPUT_FILE}")
    print("💡 格式与你指定的完全一致，可直接导入系统")

if __name__ == "__main__":
    main()