const API_BASE = '/api';

const GaokaoDB = {
  async bulkImport(storeName, items, validatorName) {
    if (storeName === 'admissionPlans') {
      try {
        const res = await fetch(`${API_BASE}/plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(items)
        });
        const result = await res.json();
        return {
          total: items.length,
          acceptedCount: result.success,
          rejectedCount: result.failed,
          rejected: []
        };
      } catch (e) {
        console.error('导入失败:', e);
        return { total: 0, acceptedCount: 0, rejectedCount: items.length, rejected: [] };
      }
    }
    return { total: 0, acceptedCount: 0, rejectedCount: 0, rejected: [] };
  },

  async getAll(storeName) {
    if (storeName === 'admissionPlans') {
      try {
        const res = await fetch(`${API_BASE}/plans`);
        return res.json();
      } catch (e) {
        console.error('获取数据失败:', e);
        return [];
      }
    }
    return [];
  },

  async getByProvinceYear(storeName, indexName, province, year) {
    const all = await this.getAll(storeName);
    return all.filter(x => x.province === province && (year ? x.year === year : true));
  },

  async clear(storeName) {
    if (storeName === 'admissionPlans') {
      try {
        await fetch(`${API_BASE}/clear_plans`, { method: 'POST' });
      } catch (e) {
        console.error('清空数据失败:', e);
      }
    }
  },

  async seedFromJSON(jsonUrl, storeName, dataKey, validatorName) {
    const res = await fetch(jsonUrl);
    const json = await res.json();
    const items = json[dataKey] || json;
    return this.bulkImport(storeName, items, validatorName);
  },

  async countRealVsPlaceholder(storeName) {
    if (storeName === 'admissionPlans') {
      try {
        const res = await fetch(`${API_BASE}/plans/count`);
        const data = await res.json();
        return { total: data.total_plans, real: data.total_plans, placeholder: 0 };
      } catch (e) {
        console.error('获取统计失败:', e);
        return { total: 0, real: 0, placeholder: 0 };
      }
    }
    return { total: 0, real: 0, placeholder: 0 };
  }
};

if (typeof window !== 'undefined') window.GaokaoDB = GaokaoDB;
if (typeof module !== 'undefined') module.exports = { GaokaoDB };