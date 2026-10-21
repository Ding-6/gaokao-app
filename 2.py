import requests
from io import StringIO
import os
import pandas as pd
import json
from collections import defaultdict

# ===================== 【每次运行前核对更新这里】 =====================
API_URL = "https://gk.hebeea.edu.cn:88/xxcx/xxcxzx/zsjhIframe"
# 从环境变量读取：PowerShell 用 $env:HEBEEA_COOKIE="..." 临时设置
COOKIE_STR = os.environ.get("HEBEEA_COOKIE", "")
if not COOKIE_STR:
    raise SystemExit("请先设置环境变量 HEBEEA_COOKIE，例如：$env:HEBEEA_COOKIE='JSESSIONID=...'")
# 分页范围，先测试1-3页，确认正常再改最大页数1365
START_PAGE = 1
END_PAGE = 1365
YEAR = 2026
PROVINCE = "河北"
OUTPUT_FILE = "河北2026招生计划_标准导入.json"
# =====================================================================

# 完整复刻浏览器请求头
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0",
    "Cookie": COOKIE_STR,
    "Referer": "https://gk.hebeea.edu.cn:88/xxcx/xxcxzx/zsjh",
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": "https://gk.hebeea.edu.cn:88",
    "sec-ch-ua": "\"Microsoft Edge\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "iframe",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "same-origin",
    "upgrade-insecure-requests": "1",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "zh-CN,zh;q=0.9"
}

def fetch_single_page(page_num):
    """请求单页接口，返回结构化专业列表"""
    form_data = {
        "pcdm": "3",
        "jhxzdm": "0",
        "kldm": "B",
        "zyms": "ZYPX",
        "page": str(page_num),
        "yxjblxmc": "",
        "yxmc": "",
        "zymc": ""
    }
    try:
        resp = requests.post(API_URL, headers=HEADERS, data=form_data, timeout=20)
        resp.encoding = "utf-8"
        html = resp.text
    except Exception as e:
        print(f"第{page_num}页网络请求失败：{str(e)}")
        return []

    # 会话失效判断（跳转到考生个人信息页）
    if "考生个人信息查看" in html:
        print(f"⚠️ 第{page_num}页会话过期，请复制浏览器最新Cookie替换COOKIE_STR！")
        return []
    if "zsjhTable" not in html:
        print(f"⚠️ 第{page_num}页页面无招生表格")
        return []

    # 解析页面内表格
    try:
        all_tables = pd.read_html(StringIO(html), header=0, flavor="lxml")
        target_table = None
        for tb in all_tables:
            cols = [str(c).strip().replace("\n", "") for c in tb.columns]
            if "院校代号" in cols and "计划数" in cols:
                target_table = tb
                break
        if target_table is None:
            print(f"第{page_num}页未匹配到招生表格")
            return []
        target_table = target_table.dropna(how="all")
        page_result = []
        for _, row in target_table.iterrows():
            # 清洗单元格多余空格&nbsp;
            college_code = str(row["院校代号"]).strip().replace(" ", "")
            college_name = str(row["院校名称"]).strip().replace(" ", "")
            major_code = str(row["专业代号"]).strip().replace(" ", "")
            major_name = str(row["专业名称"]).strip().replace(" ", "")
            remark = str(row.get("专业备注", "")).strip().replace(" ", "")
            reselect_subject = str(row["再选科目要求"]).strip().replace(" ", "")
            plan_num = str(row["计划数"]).strip().replace(" ", "")
            study_year = str(row["学制"]).strip().replace(" ", "")
            tuition = str(row["学费元/年"]).strip().replace(" ", "")

            page_result.append({
                "collegeCode": college_code,
                "collegeName": college_name,
                "majorCode": major_code,
                "majorName": major_name,
                "majorRemark": remark,
                "reSubjectReq": reselect_subject,
                "planCount": int(plan_num) if plan_num.isdigit() else None,
                "studyYears": study_year,
                "tuition": tuition
            })
        return page_result
    except Exception as err:
        print(f"第{page_num}页表格解析异常：{str(err)}")
        return []

def convert_to_import_json(all_raw_data):
    """转换为志愿系统要求的院校嵌套JSON格式"""
    college_group = defaultdict(list)
    for item in all_raw_data:
        code = item["collegeCode"]
        if not code:
            continue
        college_group[code].append(item)
    output_list = []
    for college_code, major_list in college_group.items():
        college_name = major_list[0]["collegeName"]
        majors_wrap = []
        for m in major_list:
            majors_wrap.append({
                "majorCode": m["majorCode"],
                "majorName": m["majorName"],
                "planCount": m["planCount"],
                "studyYears": m["studyYears"],
                "tuition": m["tuition"],
                "reSubjectReq": m["reSubjectReq"],
                "majorRemark": m["majorRemark"],
                "isRealData": True
            })
        output_list.append({
            "id": f"{college_code}_{YEAR}",
            "collegeCode": college_code,
            "collegeName": college_name,
            "province": PROVINCE,
            "year": YEAR,
            "isRealData": True,
            "majors": majors_wrap
        })
    return output_list

if __name__ == "__main__":
    total_data = []
    for page in range(START_PAGE, END_PAGE + 1):
        print(f"\n===== 正在抓取第 {page} 页 =====")
        page_data = fetch_single_page(page)
        total_data.extend(page_data)
        print(f"本页有效专业：{len(page_data)} 条 | 累计抓取：{len(total_data)} 条")
    # 生成最终导入文件
    final_json = convert_to_import_json(total_data)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_json, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\n===== 抓取任务完成 =====")
    print(f"院校总数量：{len(final_json)} 所")
    print(f"全部专业总条数：{len(total_data)} 条")
    print(f"输出文件路径：{OUTPUT_FILE}")