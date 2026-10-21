import json

# -------------------------- 文件路径配置（和脚本同目录） --------------------------
plan_file_path = "招生计划_标准导入格式.json"
score_file_path = "录取数据_标准导入格式.json"
output_file = "融合后完整数据.json"
# --------------------------------------------------------------------------------

def load_json(file_path):
    """安全读取JSON，捕获文件缺失/格式错误"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"【致命错误】找不到文件：{file_path}")
        print("请确认文件名带 .json 后缀，且和3.py放在同一个文件夹！")
        exit(1)
    except json.JSONDecodeError:
        print(f"【致命错误】{file_path} JSON格式损坏，无法解析，请检查文件内容！")
        exit(1)

def is_special_school(school_name):
    """判断院校名称是否含专项关键词，是则整所院校剔除"""
    keywords = ["地方专项", "专项计划", "农村专项"]
    for kw in keywords:
        if kw in school_name:
            return True
    return False

# 1. 读取2026招生计划（唯一主数据源）
plan_raw = load_json(plan_file_path)
plan_list = plan_raw["admissionPlans"]

# 2. 读取往年录取数据，构建【院校名称+专业名称】映射字典
score_raw = load_json(score_file_path)
name_match_map = {}

for school in score_raw:
    school_name = school.get("collegeName", "").strip()
    if not school_name:
        continue
    for major in school["majors"]:
        major_name = major.get("majorName", "").strip()
        if not major_name:
            continue
        match_key = f"{school_name}|{major_name}"
        name_match_map[match_key] = {
            "minScore": major.get("minScore"),
            "avgScore": major.get("avgScore"),
            "minRank": major.get("minRank"),
            "volunteerType": major.get("volunteerType")
        }

# 3. 遍历招生计划，过滤专项院校 + 匹配录取分数
final_output = {"admissionPlans": []}
matched_major_count = 0
remove_school_count = 0

for school in plan_list:
    school_name = school["collegeName"].strip()
    # 规则：院校名称带专项关键词，直接跳过这一整所学校
    if is_special_school(school_name):
        remove_school_count += 1
        continue

    new_school_item = {
        "id": school.get("id", f"{school['collegeCode']}_2026_plan"),
        "collegeCode": school["collegeCode"],
        "collegeName": school["collegeName"],
        "province": school.get("province", "河北"),
        "year": school.get("year", 2026),
        "isRealData": school.get("isRealData", True),
        "majors": []
    }

    for major in school["majors"]:
        major_name = major["majorName"].strip()
        match_key = f"{school_name}|{major_name}"
        score_info = name_match_map.get(match_key, {})
        if score_info:
            matched_major_count += 1

        # 组装最终专业对象，完整保留招生计划字段
        merged_major = {
            "majorCode": major["majorCode"],
            "majorName": major["majorName"],
            "majorRemark": major.get("majorRemark") if major.get("majorRemark") else None,
            "subjectRequirementText": major.get("subjectRequirementText") if major.get("subjectRequirementText") else None,
            "planCount": major.get("planCount"),
            "duration": major.get("duration") if major.get("duration") else None,
            "tuition": major.get("tuition"),
            "minScore": score_info.get("minScore"),
            "avgScore": score_info.get("avgScore"),
            "minRank": score_info.get("minRank"),
            "volunteerType": score_info.get("volunteerType")
        }
        new_school_item["majors"].append(merged_major)
    
    # 院校有专业才写入结果
    if len(new_school_item["majors"]) > 0:
        final_output["admissionPlans"].append(new_school_item)

# 4. 输出融合后的标准JSON文件
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(final_output, f, ensure_ascii=False, indent=2)

# 统计打印
total_school = len(final_output["admissionPlans"])
total_major = sum(len(item["majors"]) for item in final_output["admissionPlans"])
print("==================== 数据融合&过滤完成 ====================")
print(f"剔除的专项类院校总数：{remove_school_count}")
print(f"剩余有效院校总数：{total_school}")
print(f"剩余有效专业总条数：{total_major}")
print(f"匹配到往年录取分的专业：{matched_major_count}")
print(f"输出文件：{output_file}")
print("执行规则说明：")
print("1. 仅以2026招生计划为基准，录取数据独有院校/专业全部丢弃")
print("2. 院校名称包含【地方专项/专项计划/农村专项】，整所院校直接删除")
print("3. 招生计划存在但无匹配录取数据的专业正常保留，分数字段为null")
print("4. 通过【院校全称+专业全称】完全一致才填充minScore/avgScore/minRank/volunteerType")
print("==========================================================")