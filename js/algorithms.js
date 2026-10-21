/**
 * algorithms.js — 核心业务算法
 * 1) 分数 <-> 位次 换算（基于一分一段表）
 * 2) 冲/稳/保 分层算法
 * 3) 多维度排序
 * 4) 多条件筛选
 *
 * 设计原则：算法本身与具体数据真实性解耦——
 * 数据是否真实由 db.js 的 isRealData 标记负责，这里只负责"如果数据存在，如何正确计算"。
 * 任何依赖一分一段表的函数，在表为空时会显式返回"数据不足"而不是编造结果。
 */

const GaokaoAlgo = {

  /**
   * 分数 -> 位次。
   * 在一分一段表中找该分数对应的累计人数区间。
   * 同分情况下，取该分数段的最大位次（即"最低位次"口径，对考生更保守、更安全）。
   */
  scoreToRank(score, scoreRankTable) {
    if (!scoreRankTable || !Array.isArray(scoreRankTable.table) || scoreRankTable.table.length === 0) {
      return { ok: false, reason: '暂无该省/该年/该科类的一分一段表数据，请先在数据管理中导入后再换算。' };
    }
    const table = scoreRankTable.table;
    const sorted = [...table].sort((a, b) => b.score - a.score);
    const hit = sorted.find(row => row.score === score);
    if (hit) return { ok: true, rank: hit.cumulativeCount };

    // 精确分数未命中时，取最接近且不高于该分的一档（向保守方向取整）
    const lower = sorted.find(row => row.score < score);
    const higher = [...sorted].reverse().find(row => row.score > score);
    if (lower) {
      return { ok: true, rank: lower.cumulativeCount, approximate: true, note: `表中无精确匹配，按${lower.score}分位次近似估算` };
    }
    if (higher) {
      return { ok: true, rank: higher.cumulativeCount, approximate: true, note: `分数超出表内最高分，按最高档${higher.score}分位次估算` };
    }
    return { ok: false, reason: '分数超出一分一段表覆盖范围' };
  },

  /**
   * 位次 -> 分数（反向查找，用于按位次输入时展示参考分数）
   */
  rankToScore(rank, scoreRankTable) {
    if (!scoreRankTable || !Array.isArray(scoreRankTable.table) || scoreRankTable.table.length === 0) {
      return { ok: false, reason: '暂无该省/该年/该科类的一分一段表数据' };
    }
    const sorted = [...scoreRankTable.table].sort((a, b) => a.cumulativeCount - b.cumulativeCount);
    const hit = sorted.find(row => row.cumulativeCount >= rank);
    if (hit) return { ok: true, score: hit.score };
    return { ok: false, reason: '位次超出表内范围' };
  },

  /**
   * 冲/稳/保 分层。
   * 基于"考生位次"与"该专业组近年最低位次"的相对差值（位次差百分比，比绝对分差更跨年稳定）。
   * 约定：位次数字越小 = 排名越靠前 = 越难考上。
   *   - 冲（chong）：目标校最低位次明显小于考生位次（更难考）=> diffPercent > chongPercent
   *   - 稳（wen）：两者接近，落在 [-wenPercent, chongPercent] 区间
   *   - 保（bao）：目标校最低位次明显大于考生位次（更容易考）=> diffPercent < -wenPercent
   * thresholds 可由用户自定义阈值（chongPercent, wenPercent）。
   */
  classify(userRank, targetMinRank, thresholds = {}) {
    const {
      chongPercent = 0.10,   // 目标位次比考生位次小10%以内 => 冲
      wenPercent = 0.15,     // 上下15%以内 => 稳
    } = thresholds;

    if (typeof userRank !== 'number' || typeof targetMinRank !== 'number' || userRank <= 0) {
      return { tier: 'unknown', reason: '位次数据不完整，无法分层' };
    }

    // diff > 0：目标校录取位次比考生位次"数字更小"，即录取门槛更靠前/更难 => 冲
    // diff < 0：目标校录取位次比考生位次"数字更大"，即门槛更宽松 => 保
    const diff = userRank - targetMinRank;
    const diffPercent = diff / userRank;

    if (diffPercent > chongPercent) {
      return { tier: 'chong', label: '冲', diffPercent, diff };
    }
    if (diffPercent >= -wenPercent && diffPercent <= chongPercent) {
      return { tier: 'wen', label: '稳', diffPercent, diff };
    }
    return { tier: 'bao', label: '保', diffPercent, diff };
  },

  /**
   * 批量为院校专业组列表打上冲稳保标签
   */
  classifyList(userRank, plans, thresholds) {
    return plans.map(plan => ({
      ...plan,
      classification: this.classify(userRank, plan.minRankGroup ?? plan.majors?.[0]?.minRank, thresholds)
    }));
  },

  /**
   * 多维度排序
   * field: 'minScore' | 'minRank' | 'levelPriority' | 'admissionProbability' | 'planCount'
   * order: 'asc' | 'desc'
   */
  sortPlans(plans, field, order = 'desc') {
    const levelRank = { '985': 4, '211': 3, '双一流': 2, '省重点': 1 };
    const getLevelScore = (plan) => {
      if (!plan.collegeTags) return 0;
      return Math.max(0, ...plan.collegeTags.map(t => levelRank[t] || 0));
    };
    const tierRank = { chong: 3, wen: 2, bao: 1, unknown: 0 };

    const sorted = [...plans].sort((a, b) => {
      let av, bv;
      switch (field) {
        case 'minScore':
          av = a.minScoreGroup ?? a.majors?.[0]?.minScore ?? 0;
          bv = b.minScoreGroup ?? b.majors?.[0]?.minScore ?? 0;
          break;
        case 'minRank':
          av = a.minRankGroup ?? a.majors?.[0]?.minRank ?? 0;
          bv = b.minRankGroup ?? b.majors?.[0]?.minRank ?? 0;
          break;
        case 'levelPriority':
          av = getLevelScore(a); bv = getLevelScore(b);
          break;
        case 'admissionProbability':
          av = tierRank[a.classification?.tier] ?? 0;
          bv = tierRank[b.classification?.tier] ?? 0;
          break;
        case 'planCount':
          av = a.majors?.reduce((s, m) => s + (m.planCount || 0), 0) ?? 0;
          bv = b.majors?.reduce((s, m) => s + (m.planCount || 0), 0) ?? 0;
          break;
        default:
          av = 0; bv = 0;
      }
      return order === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  },

  /**
   * 多条件筛选（组合使用）
   * filters: { province, city, ownership, level, majorCategory, tuitionMin, tuitionMax, tier, tags }
   */
  filterPlans(plans, filters = {}) {
    return plans.filter(plan => {
      if (filters.province && plan.province !== filters.province) return false;
      if (filters.city && plan.collegeCity !== filters.city) return false;
      if (filters.ownership && plan.collegeOwnership !== filters.ownership) return false;
      if (filters.level && plan.collegeLevel !== filters.level) return false;
      if (filters.tier && plan.classification?.tier !== filters.tier) return false;
      if (filters.tags && filters.tags.length > 0) {
        const hasTag = filters.tags.some(t => (plan.collegeTags || []).includes(t));
        if (!hasTag) return false;
      }
      if (filters.tuitionMin != null || filters.tuitionMax != null) {
        const tuitions = (plan.majors || []).map(m => m.tuition).filter(t => typeof t === 'number');
        const minT = Math.min(...tuitions, Infinity);
        if (filters.tuitionMin != null && minT < filters.tuitionMin) return false;
        if (filters.tuitionMax != null && minT > filters.tuitionMax) return false;
      }
      if (filters.majorCategory) {
        const hasMatch = (plan.majors || []).some(m => m.majorCategory === filters.majorCategory);
        if (!hasMatch) return false;
      }
      return true;
    });
  },

  /**
   * 校验某省志愿数量是否超出该批次上限
   */
  checkVolunteerLimit(currentList, batchConfig) {
    const max = batchConfig?.maxVolunteers ?? Infinity;
    return {
      count: currentList.length,
      max,
      exceeded: currentList.length > max,
      remaining: Math.max(0, max - currentList.length)
    };
  }
};

if (typeof window !== 'undefined') window.GaokaoAlgo = GaokaoAlgo;
if (typeof module !== 'undefined') module.exports = { GaokaoAlgo };
