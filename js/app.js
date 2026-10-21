const App = {
  state: {
    province: '河北',
    year: 2026,
    userScore: null,
    userRank: null,
    plans: [],
    filtered: [],
    draft: [],
    thresholds: { chongPercent: 0.10, wenPercent: 0.15 }
  },
  currentPageName: 'home',
  filteredMajors: [],
  searchPage: 1,
  managePage: 1,
  searchFilters: {
    college: '',
    major: '',
    rankMin: '',
    rankMax: '',
    sort: 'minRank-asc'
  },
  currentUser: null,

  async init() {
    this.bindNavigation();
    await this.loadPlans();
    await this.refreshDataStatus();
    
    const savedUser = localStorage.getItem('gaokao_user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        document.body.classList.remove('login-mode');
        await this.loadUserData();
        this.switchPage('home');
      } catch (e) {
        this.showLoginPage();
      }
    } else {
      this.showLoginPage();
    }
  },

  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (!this.currentUser) {
          alert('请先登录！');
          this.showLoginPage();
          return;
        }
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.switchPage(item.dataset.page);
      });
    });
  },

  switchPage(pageName) {
    if (!this.currentUser) {
      this.showLoginPage();
      return;
    }
    this.currentPageName = pageName;
    const container = document.getElementById('main-content');
    container.innerHTML = '';
    
    switch(pageName) {
      case 'home':
        this.renderHomePage();
        break;
      case 'search':
        this.renderSearchPage();
        break;
      case 'manage':
        this.renderManagePage();
        break;
    }
  },

  async loadPlans() {
    const existing = await GaokaoDB.getAll('admissionPlans');
    if (existing.length === 0) {
      await GaokaoDB.seedFromJSON('data/colleges.json', 'colleges', 'colleges', 'college');
      await GaokaoDB.seedFromJSON('data/admission_plans.json', 'admissionPlans', 'admissionPlans', 'admissionPlan');
    }

    const plans = await GaokaoDB.getAll('admissionPlans');
    const colleges = await GaokaoDB.getAll('colleges');
    const collegeMap = new Map(colleges.map(c => [c.collegeCode, c]));

    this.state.plans = plans
      .filter(p => p.province === this.state.province && p.year === this.state.year)
      .map(p => {
        const college = collegeMap.get(p.collegeCode) || {};
        return {
          ...p,
          collegeName: p.collegeName || college.collegeName || '未知院校'
        };
      });
  },

  async refreshDataStatus() {
    try {
      const plansStatus = await GaokaoDB.countRealVsPlaceholder('admissionPlans');
      this.dataStatus = plansStatus;
    } catch (e) {
      this.dataStatus = { real: 0, placeholder: 0, total: 0 };
    }
  },

  getTotalMajors() {
    return this.state.plans.reduce((sum, p) => sum + (p.majors?.length || 0), 0);
  },

  showLoginPage() {
    document.body.classList.add('login-mode');
    const container = document.getElementById('main-content');
    container.innerHTML = `
      <div class="login-container">
        <div class="login-card">
          <div class="login-logo">🎓</div>
          <div class="login-title">高考志愿填报系统</div>
          <div class="login-subtitle">请登录您的账号</div>
          
          <div id="loginForm">
            <div class="form-group">
              <label class="form-label">用户名</label>
              <input type="text" class="form-input" id="loginUsername" placeholder="请输入用户名" onkeydown="if(event.key==='Enter'){document.getElementById('loginPassword').focus();}">
            </div>
            <div class="form-group">
              <label class="form-label">密码</label>
              <input type="password" class="form-input" id="loginPassword" placeholder="请输入密码" onkeydown="if(event.key==='Enter')App.handleLogin()">
            </div>
            <button class="btn btn-primary btn-block" onclick="App.handleLogin()">登 录</button>
            <div class="login-link">
              还没有账号？<a href="#" onclick="App.showRegisterForm()">立即注册</a>
            </div>
          </div>
          
          <div id="registerForm" style="display: none;">
            <div class="form-group">
              <label class="form-label">用户名</label>
              <input type="text" class="form-input" id="regUsername" placeholder="2-20个字符" onkeydown="if(event.key==='Enter'){document.getElementById('regDisplayName').focus();}">
              <span class="form-hint">2-20个字符</span>
            </div>
            <div class="form-group">
              <label class="form-label">显示名称</label>
              <input type="text" class="form-input" id="regDisplayName" placeholder="选填，用于显示" onkeydown="if(event.key==='Enter'){document.getElementById('regPassword').focus();}">
              <span class="form-hint">选填，用于在系统中显示您的名称</span>
            </div>
            <div class="form-group">
              <label class="form-label">密码</label>
              <input type="password" class="form-input" id="regPassword" placeholder="3-30个字符" onkeydown="if(event.key==='Enter')App.handleRegister()">
              <span class="form-hint">3-30个字符</span>
            </div>
            <button class="btn btn-primary btn-block" onclick="App.handleRegister()">注 册</button>
            <div class="login-link">
              已有账号？<a href="#" onclick="App.showLoginForm()">立即登录</a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
  },

  showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
  },

  async handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    if (!username) {
      alert('请输入用户名');
      return;
    }
    if (!password) {
      alert('请输入密码');
      return;
    }
    
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (!res.ok) {
        alert('服务器返回错误：' + res.status + ' ' + res.statusText);
        return;
      }
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        const text = await res.text();
        alert('服务器返回格式错误：' + text.substring(0, 200));
        return;
      }
      
      if (data.success) {
        this.currentUser = data.user;
        localStorage.setItem('gaokao_user', JSON.stringify(data.user));
        document.body.classList.remove('login-mode');
        await this.loadUserData();
        this.switchPage('home');
      } else {
        alert('登录失败：' + (data.error || '用户名或密码错误'));
      }
    } catch (err) {
      alert('登录失败：网络错误，请检查服务器是否运行\n' + err.message);
    }
  },

  async handleRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const displayName = document.getElementById('regDisplayName').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    
    const errors = [];
    if (!username) {
      errors.push('• 用户名不能为空');
    } else if (username.length < 2) {
      errors.push('• 用户名至少需要2个字符');
    } else if (username.length > 20) {
      errors.push('• 用户名不能超过20个字符');
    }
    
    if (!password) {
      errors.push('• 密码不能为空');
    } else if (password.length < 3) {
      errors.push('• 密码至少需要3个字符');
    } else if (password.length > 30) {
      errors.push('• 密码不能超过30个字符');
    }
    
    if (errors.length > 0) {
      alert('请检查以下问题：\n' + errors.join('\n'));
      return;
    }
    
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName, password })
      });
      
      if (!res.ok) {
        alert('服务器返回错误：' + res.status + ' ' + res.statusText);
        return;
      }
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        const text = await res.text();
        alert('服务器返回格式错误：' + text.substring(0, 200));
        return;
      }
      
      if (data.success) {
        alert('注册成功！请登录');
        this.showLoginForm();
      } else {
        alert('注册失败：' + (data.error || '未知错误'));
      }
    } catch (err) {
      alert('注册失败：网络错误，请检查服务器是否运行\n' + err.message);
    }
  },

  logout() {
    if (confirm('确定要退出登录吗？')) {
      this.currentUser = null;
      localStorage.removeItem('gaokao_user');
      this.state.draft = [];
      this.state.userScore = null;
      this.state.userRank = null;
      this.showLoginPage();
    }
  },

  async switchUser() {
    try {
      const res = await fetch('/api/users/list');
      const data = await res.json();
      
      if (!data.success || !data.users || data.users.length === 0) {
        alert('没有其他用户');
        return;
      }
      
      const users = data.users.map(u => ({
        label: u.display_name,
        value: JSON.stringify(u)
      }));
      
      const selected = prompt(`请选择要切换的用户：\n${data.users.map((u, i) => `${i + 1}. ${u.display_name}`).join('\n')}\n\n输入序号:`);
      
      if (selected) {
        const index = parseInt(selected) - 1;
        if (index >= 0 && index < data.users.length) {
          const user = data.users[index];
          this.currentUser = {
            id: user.id,
            username: user.username,
            display_name: user.display_name
          };
          localStorage.setItem('gaokao_user', JSON.stringify(this.currentUser));
          await this.loadUserData();
          this.switchPage(this.currentPageName);
          alert(`已切换到：${user.display_name}`);
        } else {
          alert('无效的选择');
        }
      }
    } catch (err) {
      alert('获取用户列表失败：' + err.message);
    }
  },

  async loadUserData() {
    try {
      const userId = this.currentUser?.id || 'default';
      const res = await fetch(`/api/user_data?user_id=${userId}`);
      const data = await res.json();
      if (data) {
        this.state.userScore = data.user_score || 0;
        this.state.userRank = data.user_rank || 0;
        this.state.draft = data.draft || [];
        console.log('用户数据已加载');
      }
    } catch (err) {
      console.error('加载用户数据失败:', err);
    }
  },

  async saveUserData() {
    try {
      const userId = this.currentUser?.id || 'default';
      const userData = {
        user_id: userId,
        user_score: this.state.userScore,
        user_rank: this.state.userRank,
        draft: this.state.draft,
        updated_at: new Date().toISOString()
      };
      
      await fetch('/api/user_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      console.log('用户数据已保存到数据库');
    } catch (err) {
      console.error('保存用户数据失败:', err);
    }
  },

  renderHomePage() {
    const container = document.getElementById('main-content');
    const totalMajors = this.getTotalMajors();
    
    container.innerHTML = `
      <div class="card" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 48px; height: 48px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 600;">
              ${this.currentUser?.display_name?.charAt(0) || '用'}
            </div>
            <div>
              <div style="font-weight: 600; font-size: 16px;">${this.currentUser?.display_name || '未知用户'}</div>
              <div style="font-size: 14px; color: var(--text-muted);">${this.currentUser?.username || ''}</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-secondary" onclick="App.switchUser()">切换用户</button>
            <button class="btn btn-sm btn-danger" onclick="App.logout()">退出登录</button>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${this.dataStatus.real}</div>
          <div class="stat-label">真实数据</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalMajors}</div>
          <div class="stat-label">专业数量</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.state.plans.length}</div>
          <div class="stat-label">院校数量</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this.state.draft.length}</div>
          <div class="stat-label">已选志愿</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">数据管理</div>
        </div>
        <div style="text-align: center; padding: 30px;">
          <input type="file" id="importFile" accept=".json" style="display:none">
          <button class="btn btn-primary btn-lg" onclick="document.getElementById('importFile').click()">导入招生数据</button>
          <button class="btn btn-secondary btn-lg" onclick="App.clearPlans()" style="margin-left: 12px;">清除招生数据</button>
          <p style="margin-top: 12px; color: var(--text-muted); font-size: 14px;">支持 JSON 格式文件</p>
        </div>
        ${this.dataStatus.real === 0 ? `
          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-top: 16px;">
            <p style="color: #d97706; font-weight: 500;">⚠ 当前数据库中没有真实数据</p>
            <p style="color: #d97706; font-size: 14px; margin-top: 4px;">请导入河北省招生计划数据后再使用志愿搜索功能</p>
          </div>
        ` : ''}
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">我的分数</div>
        </div>
        <div class="search-bar">
          <div style="flex: 1;">
            <label class="form-label">分数</label>
            <input type="number" class="form-input" id="homeScore" placeholder="如 650" value="${this.state.userScore || ''}">
          </div>
          <div style="flex: 1;">
            <label class="form-label">位次</label>
            <input type="number" class="form-input" id="homeRank" placeholder="如 15000" value="${this.state.userRank || ''}">
          </div>
          <div style="flex: 0 0 auto; align-self: flex-end;">
            <button class="btn btn-primary" onclick="App.saveScoreRank()">保存</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">快速开始</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div style="text-align: center; padding: 20px; background: #f8fafc; border-radius: 8px;">
            <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
            <div style="font-weight: 500; margin-bottom: 4px;">志愿搜索</div>
            <div style="font-size: 14px; color: var(--text-muted);">浏览所有院校专业</div>
            <button class="btn btn-secondary btn-sm" style="margin-top: 12px;" onclick="App.goToSearch()">进入</button>
          </div>
          <div style="text-align: center; padding: 20px; background: #f8fafc; border-radius: 8px;">
            <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
            <div style="font-weight: 500; margin-bottom: 4px;">志愿管理</div>
            <div style="font-size: 14px; color: var(--text-muted);">管理已选志愿</div>
            <button class="btn btn-secondary btn-sm" style="margin-top: 12px;" onclick="App.goToManage()">进入</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('importFile').addEventListener('change', (e) => this.handleImport(e));
  },

  goToSearch() {
    document.querySelector('[data-page="search"]').click();
  },

  goToManage() {
    document.querySelector('[data-page="manage"]').click();
  },

  saveScoreRank() {
    const score = parseInt(document.getElementById('homeScore').value);
    const rank = parseInt(document.getElementById('homeRank').value);
    
    if (!isNaN(score)) this.state.userScore = score;
    if (!isNaN(rank)) this.state.userRank = rank;
    
    this.saveUserData();
    alert('保存成功！');
  },

  async clearPlans() {
    if (!confirm('确定要清除所有招生数据吗？此操作不可恢复！')) {
      return;
    }
    
    try {
      await GaokaoDB.clear('admissionPlans');
      await this.loadPlans();
      await this.refreshDataStatus();
      this.switchPage(this.currentPageName);
      alert('招生数据已清除！');
    } catch (err) {
      alert('清除失败：' + err.message);
    }
  },

  async handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const result = await GaokaoDB.bulkImport('admissionPlans', data, 'admissionPlan');
      
      if (result.acceptedCount > 0) {
        await this.loadPlans();
        await this.refreshDataStatus();
        this.switchPage(this.currentPageName);
        alert(`成功导入 ${result.acceptedCount} 条招生计划！${result.rejectedCount > 0 ? `\n有 ${result.rejectedCount} 条被拒绝` : ''}`);
      } else {
        alert('没有可导入的数据，所有条目都被拒绝');
      }
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  },

  PAGE_SIZE: 50,
  PAGE_SIZE_SEARCH: 11,
  PAGE_SIZE_MANAGE: 11,
  currentPage: 1,

  renderSearchPage() {
    const container = document.getElementById('main-content');
    
    const collegeInput = document.getElementById('searchCollege');
    const majorInput = document.getElementById('searchMajor');
    const rankMinInput = document.getElementById('rankMin');
    const rankMaxInput = document.getElementById('rankMax');
    const sortSelect = document.getElementById('searchSort');
    
    if (collegeInput) {
      this.searchFilters.college = collegeInput.value;
      this.searchFilters.major = majorInput.value;
      this.searchFilters.rankMin = rankMinInput.value;
      this.searchFilters.rankMax = rankMaxInput.value;
      this.searchFilters.sort = sortSelect.value;
    }
    
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">志愿搜索</div>
          <span style="color: var(--text-muted); font-size: 14px;" id="totalCount">共 0 个专业</span>
        </div>
        
        <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <label class="form-label" style="margin-bottom: 0; white-space: nowrap;">院校名称</label>
            <input type="text" class="form-input" id="searchCollege" placeholder="搜索院校（回车搜索）" style="width: 200px;" value="${this.searchFilters.college}" onkeydown="if(event.key==='Enter')App.handleSearch()">
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <label class="form-label" style="margin-bottom: 0; white-space: nowrap;">专业名称</label>
            <input type="text" class="form-input" id="searchMajor" placeholder="搜索专业（回车搜索）" style="width: 200px;" value="${this.searchFilters.major}" onkeydown="if(event.key==='Enter')App.handleSearch()">
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <label class="form-label" style="margin-bottom: 0; white-space: nowrap;">位次区间</label>
            <input type="number" class="form-input" id="rankMin" placeholder="最低" style="width: 100px;" value="${this.searchFilters.rankMin}" onkeydown="if(event.key==='Enter')App.handleSearch()">
            <span>-</span>
            <input type="number" class="form-input" id="rankMax" placeholder="最高" style="width: 100px;" value="${this.searchFilters.rankMax}" onkeydown="if(event.key==='Enter')App.handleSearch()">
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <label class="form-label" style="margin-bottom: 0; white-space: nowrap;">排序</label>
            <select class="form-select" id="searchSort" style="width: 120px;">
              <option value="minRank-asc" ${this.searchFilters.sort === 'minRank-asc' ? 'selected' : ''}>位次升序</option>
              <option value="minRank-desc" ${this.searchFilters.sort === 'minRank-desc' ? 'selected' : ''}>位次降序</option>
              <option value="minScore-desc" ${this.searchFilters.sort === 'minScore-desc' ? 'selected' : ''}>分数降序</option>
              <option value="minScore-asc" ${this.searchFilters.sort === 'minScore-asc' ? 'selected' : ''}>分数升序</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="App.handleSearch()">搜索</button>
        </div>

        <div id="tableContainer">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 3%;">序号</th>
                <th style="width: 4%;">院校代号</th>
                <th style="width: 12%;">院校名称</th>
                <th style="width: 4%;">专业代号</th>
                <th style="width: 15%;">专业名称</th>
                <th style="width: 4%;">招生人数</th>
                <th style="width: 3%;">学制</th>
                <th style="width: 5%;">学费</th>
                <th style="width: 4%;">最低分</th>
                <th style="width: 4%;">平均分</th>
                <th style="width: 6%;">最低位次</th>
                <th style="width: 4%;">志愿号</th>
                <th style="width: 5%;">科目要求</th>
                <th style="width: 10%;">操作</th>
              </tr>
            </thead>
            <tbody id="searchTableBody">
            </tbody>
          </table>
        </div>
        
        <div id="pagination" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;">
        </div>
      </div>
    `;

    document.getElementById('searchCollege').addEventListener('input', () => { this.searchPage = 1; });
    document.getElementById('searchMajor').addEventListener('input', () => { this.searchPage = 1; });
    document.getElementById('rankMin').addEventListener('input', () => { this.searchPage = 1; });
    document.getElementById('rankMax').addEventListener('input', () => { this.searchPage = 1; });
    document.getElementById('searchSort').addEventListener('change', () => { this.searchPage = 1; });
    
    if (this.filteredMajors.length > 0) {
      this.renderSearchResults();
    } else {
      this.handleSearch();
    }
  },

  getAllMajors() {
    const majors = [];
    this.state.plans.forEach(plan => {
      (plan.majors || []).forEach((major, idx) => {
        majors.push({
          planId: plan.id,
          plan: plan,
          major: major,
          majorIndex: idx
        });
      });
    });
    return majors;
  },

  handleSearch() {
    const collegeKeyword = document.getElementById('searchCollege').value.toLowerCase();
    const majorKeyword = document.getElementById('searchMajor').value.toLowerCase();
    const rankMin = parseInt(document.getElementById('rankMin').value);
    const rankMax = parseInt(document.getElementById('rankMax').value);
    const sort = document.getElementById('searchSort').value;
    
    this.searchFilters.college = document.getElementById('searchCollege').value;
    this.searchFilters.major = document.getElementById('searchMajor').value;
    this.searchFilters.rankMin = document.getElementById('rankMin').value;
    this.searchFilters.rankMax = document.getElementById('rankMax').value;
    this.searchFilters.sort = sort;
    
    let majors = this.getAllMajors();
    
    if (collegeKeyword) {
      majors = majors.filter(item => 
        item.plan.collegeName.toLowerCase().includes(collegeKeyword)
      );
    }
    
    if (majorKeyword) {
      majors = majors.filter(item => 
        item.major.majorName.toLowerCase().includes(majorKeyword)
      );
    }
    
    if (!isNaN(rankMin)) {
      majors = majors.filter(item => (item.major.minRank || 0) >= rankMin);
    }
    
    if (!isNaN(rankMax)) {
      majors = majors.filter(item => (item.major.minRank || 0) <= rankMax);
    }
    
    const [field, order] = sort.split('-');
    majors.sort((a, b) => {
      const av = a.major[field] || 0;
      const bv = b.major[field] || 0;
      return order === 'asc' ? av - bv : bv - av;
    });
    
    this.filteredMajors = majors;
    this.searchPage = 1;
    document.getElementById('totalCount').textContent = `共 ${majors.length} 个专业`;
    
    this.renderSearchResults();
  },

  renderSearchResults() {
    const totalPages = Math.ceil(this.filteredMajors.length / this.PAGE_SIZE_SEARCH);
    const start = (this.searchPage - 1) * this.PAGE_SIZE_SEARCH;
    const end = start + this.PAGE_SIZE_SEARCH;
    const pageData = this.filteredMajors.slice(start, end);
    
    document.getElementById('searchTableBody').innerHTML = this.renderSearchTable(pageData, start);
    this.renderSearchPagination(totalPages);
  },

  renderSearchPagination(totalPages) {
    const container = document.getElementById('pagination');
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    
    let html = '';
    
    html += `<button class="btn btn-sm btn-secondary" onclick="App.goSearchPage(${this.searchPage - 1})" ${this.searchPage === 1 ? 'disabled' : ''}>上一页</button>`;
    
    const maxVisible = 5;
    let startPage = Math.max(1, this.searchPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
      html += `<button class="btn btn-sm" onclick="App.goSearchPage(1)">1</button>`;
      if (startPage > 2) html += `<span style="color: var(--text-muted);">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="btn btn-sm ${i === this.searchPage ? 'btn-primary' : ''}" onclick="App.goSearchPage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span style="color: var(--text-muted);">...</span>`;
      html += `<button class="btn btn-sm" onclick="App.goSearchPage(${totalPages})">${totalPages}</button>`;
    }
    
    html += `<button class="btn btn-sm btn-secondary" onclick="App.goSearchPage(${this.searchPage + 1})" ${this.searchPage === totalPages ? 'disabled' : ''}>下一页</button>`;
    
    container.innerHTML = html;
  },

  goSearchPage(page) {
    const totalPages = Math.ceil(this.filteredMajors.length / this.PAGE_SIZE_SEARCH);
    if (page < 1 || page > totalPages) return;
    this.searchPage = page;
    this.renderSearchResults();
  },

  renderSearchTable(majors, startIndex = 0) {
    if (majors.length === 0) {
      return `<tr><td colspan="14" class="empty-state">暂无匹配数据</td></tr>`;
    }
    
    return majors.map((item, index) => {
      const { plan, major, planId, majorIndex } = item;
      const tier = this.state.userRank ? 
        GaokaoAlgo.classify(this.state.userRank, major.minRank, this.state.thresholds) : 
        { tier: '', label: '' };
      
      const isAdded = this.state.draft.some(d => 
        d.planId === planId && d.majorIndex === majorIndex
      );
      
      return `
        <tr>
          <td>${startIndex + index + 1}</td>
          <td>${plan.collegeCode || '-'}</td>
          <td class="college-name" title="${plan.collegeName}">${plan.collegeName}</td>
          <td>${major.majorCode || '-'}</td>
          <td class="major-name" title="${major.majorName}">${major.majorName}</td>
          <td>${major.planCount || '-'}</td>
          <td>${major.duration ? major.duration + '年' : '-'}</td>
          <td>${major.tuition ? '¥' + major.tuition.toLocaleString() : '-'}</td>
          <td class="score">${major.minScore || '-'}</td>
          <td>${major.avgScore || '-'}</td>
          <td class="rank">${(major.minRank || 0).toLocaleString()}</td>
          <td>${major.volunteerType || '-'}</td>
          <td>${major.subjectRequirementText || '-'}</td>
          <td>
            ${tier.label ? `<span class="tier-badge tier-${tier.tier}">${tier.label}</span>` : ''}
            ${isAdded ? 
              `<button class="btn btn-sm btn-secondary" onclick="App.removeFromDraftByPlanId('${planId}', ${majorIndex})">取消</button>` :
              `<button class="btn btn-sm btn-primary" onclick="App.addToDraft('${planId}', ${majorIndex})">加入</button>`
            }
          </td>
        </tr>
      `;
    }).join('');
  },

  addToDraft(planId, majorIndex) {
    const plan = this.state.plans.find(p => p.id === planId);
    if (!plan) return;
    
    const major = plan.majors?.[majorIndex];
    if (!major) return;
    
    const exists = this.state.draft.some(d => d.planId === planId && d.majorIndex === majorIndex);
    if (exists) return;
    
    this.state.draft.push({
      seq: this.state.draft.length + 1,
      planId: planId,
      majorIndex: majorIndex,
      collegeCode: plan.collegeCode,
      collegeName: plan.collegeName,
      majorCode: major.majorCode,
      majorName: major.majorName,
      planCount: major.planCount,
      duration: major.duration,
      tuition: major.tuition,
      minScore: major.minScore,
      minRank: major.minRank,
      avgScore: major.avgScore,
      volunteerType: major.volunteerType,
      subjectRequirementText: major.subjectRequirementText
    });
    
    this.saveUserData();
    if (this.currentPageName === 'search') {
      this.renderSearchResults();
    } else if (this.currentPageName === 'manage') {
      this.renderManageResults();
    }
  },

  removeFromDraftByPlanId(planId, majorIndex) {
    const index = this.state.draft.findIndex(d => d.planId === planId && d.majorIndex === majorIndex);
    if (index !== -1) {
      this.state.draft.splice(index, 1);
      this.state.draft.forEach((d, i) => { d.seq = i + 1; });
      this.saveUserData();
      if (this.currentPageName === 'search') {
        this.renderSearchResults();
      } else if (this.currentPageName === 'manage') {
        this.renderManageResults();
      }
    }
  },

  showMajorDetail(planId, majorIndex) {
    const plan = this.state.plans.find(p => p.id === planId);
    if (!plan) return;
    
    const major = plan.majors?.[majorIndex];
    if (!major) return;
    
    const detailHtml = `
      <div class="modal-overlay" onclick="App.closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">专业详情</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="detail-section">
              <h4>院校信息</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">院校代号</span>
                  <span class="detail-value">${plan.collegeCode || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">院校名称</span>
                  <span class="detail-value">${plan.collegeName}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">省份</span>
                  <span class="detail-value">${plan.province || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">年份</span>
                  <span class="detail-value">${plan.year || '-'}</span>
                </div>
              </div>
            </div>
            
            <div class="detail-section">
              <h4>专业信息</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">专业代号</span>
                  <span class="detail-value">${major.majorCode || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">专业名称</span>
                  <span class="detail-value">${major.majorName}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">专业备注</span>
                  <span class="detail-value">${major.majorRemark || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">科目要求</span>
                  <span class="detail-value">${major.subjectRequirementText || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">学制</span>
                  <span class="detail-value">${major.duration ? major.duration + '年' : '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">学费</span>
                  <span class="detail-value">${major.tuition ? '¥' + major.tuition.toLocaleString() + '/年' : '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">招生人数</span>
                  <span class="detail-value">${major.planCount || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">志愿类型</span>
                  <span class="detail-value">${major.volunteerType || '-'}</span>
                </div>
              </div>
            </div>
            
            <div class="detail-section">
              <h4>录取情况</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">最低分</span>
                  <span class="detail-value">${major.minScore || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">平均分</span>
                  <span class="detail-value">${major.avgScore || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">最低位次</span>
                  <span class="detail-value">${major.minRank ? major.minRank.toLocaleString() : '-'}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="App.closeModal()">关闭</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', detailHtml);
  },

  closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
  },

  showDraftDetail(index) {
    const item = this.state.draft[index];
    if (!item) return;
    
    const plan = this.state.plans.find(p => p.id === item.planId);
    const major = plan ? plan.majors?.[item.majorIndex] : null;
    
    const detailHtml = `
      <div class="modal-overlay" onclick="App.closeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">志愿详情</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="detail-section">
              <h4>院校信息</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">院校代号</span>
                  <span class="detail-value">${item.collegeCode || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">院校名称</span>
                  <span class="detail-value">${item.collegeName}</span>
                </div>
              </div>
            </div>
            
            <div class="detail-section">
              <h4>专业信息</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">专业代号</span>
                  <span class="detail-value">${item.majorCode || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">专业名称</span>
                  <span class="detail-value">${item.majorName}</span>
                </div>
                ${major ? `
                <div class="detail-item">
                  <span class="detail-label">专业备注</span>
                  <span class="detail-value">${major.majorRemark || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">科目要求</span>
                  <span class="detail-value">${major.subjectRequirementText || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">学制</span>
                  <span class="detail-value">${major.duration ? major.duration + '年' : '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">学费</span>
                  <span class="detail-value">${major.tuition ? '¥' + major.tuition.toLocaleString() + '/年' : '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">招生人数</span>
                  <span class="detail-value">${major.planCount || '-'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">志愿类型</span>
                  <span class="detail-value">${major.volunteerType || '-'}</span>
                </div>
                ` : ''}
              </div>
            </div>
            
            <div class="detail-section">
              <h4>录取情况</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">最低分</span>
                  <span class="detail-value">${item.minScore || '-'}</span>
                </div>
                ${major ? `
                <div class="detail-item">
                  <span class="detail-label">平均分</span>
                  <span class="detail-value">${major.avgScore || '-'}</span>
                </div>
                ` : ''}
                <div class="detail-item">
                  <span class="detail-label">最低位次</span>
                  <span class="detail-value">${item.minRank ? item.minRank.toLocaleString() : '-'}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="App.closeModal()">关闭</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', detailHtml);
  },

  renderManagePage() {
    const container = document.getElementById('main-content');
    
    if (!this.managePage) this.managePage = 1;
    
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">志愿管理</div>
          <div class="draft-counter">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${Math.min(100, (this.state.draft.length / 96) * 100)}%"></div>
            </div>
            <span class="draft-counter-text ${this.state.draft.length > 96 ? 'exceeded' : ''}">
              ${this.state.draft.length} / 96
            </span>
          </div>
        </div>

        ${this.state.draft.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-title">暂无志愿</div>
            <div class="empty-state-desc">去志愿搜索页添加志愿吧</div>
            <button class="btn btn-primary" style="margin-top: 16px;" onclick="App.goToSearch()">去搜索</button>
          </div>
        ` : `
          <div id="manageTableContainer">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 80px;">序号</th>
                  <th style="width: 40px;">拖拽</th>
                  <th>院校代号</th>
                  <th>院校名称</th>
                  <th>专业代号</th>
                  <th>专业名称</th>
                  <th>最低分</th>
                  <th>最低位次</th>
                  <th style="width: 60px;">详情</th>
                  <th style="width: 160px;">操作</th>
                </tr>
              </thead>
              <tbody id="manageTableBody">
              </tbody>
            </table>
          </div>

          <div id="managePagination" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;">
          </div>

          <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-sm btn-secondary" onclick="App.sortDraft('minRank-asc')">按位次↑排序</button>
            </div>
            <div style="display: flex; gap: 12px;">
              <button class="btn btn-secondary" onclick="if(confirm('确定清空所有志愿？')) App.clearDraft()">清空全部</button>
              <button class="btn btn-primary" onclick="App.exportDraft()">导出志愿表</button>
            </div>
          </div>
        `}
      </div>
    `;
    
    this.renderManageResults();
  },

  renderManageResults() {
    const totalPages = Math.ceil(this.state.draft.length / this.PAGE_SIZE_MANAGE);
    if (this.managePage > totalPages) this.managePage = totalPages || 1;
    
    const start = (this.managePage - 1) * this.PAGE_SIZE_MANAGE;
    const end = start + this.PAGE_SIZE_MANAGE;
    const pageData = this.state.draft.slice(start, end);
    
    document.getElementById('manageTableBody').innerHTML = pageData.map((item, idx) => {
      const realIndex = start + idx;
      return `
        <tr draggable="true" ondragstart="App.handleDragStart(event, ${realIndex})" 
            ondragover="App.handleDragOver(event)" 
            ondrop="App.handleDrop(event, ${realIndex})" 
            class="draggable-row">
          <td>
            <input type="number" min="1" max="${this.state.draft.length}" 
                   value="${realIndex + 1}" 
                   onchange="App.updateSeq(${realIndex}, this.value)"
                   class="seq-input">
          </td>
          <td class="drag-handle">☰</td>
          <td>${item.collegeCode || '-'}</td>
          <td class="college-name" title="${item.collegeName}">${item.collegeName}</td>
          <td>${item.majorCode || '-'}</td>
          <td class="major-name" title="${item.majorName}">${item.majorName}</td>
          <td class="score">${item.minScore || '-'}</td>
          <td class="rank">${(item.minRank || 0).toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-info" onclick="App.showDraftDetail(${realIndex})">详情</button>
          </td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="App.moveUp(${realIndex})" ${realIndex === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn btn-sm btn-secondary" onclick="App.moveDown(${realIndex})" ${realIndex === this.state.draft.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn btn-sm btn-danger" onclick="App.removeFromDraft(${realIndex})">删除</button>
          </td>
        </tr>
      `;
    }).join('');
    
    this.renderManagePagination(totalPages);
  },

  renderManagePagination(totalPages) {
    const container = document.getElementById('managePagination');
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }
    
    let html = '';
    
    html += `<button class="btn btn-sm btn-secondary" onclick="App.goManagePage(${this.managePage - 1})" ${this.managePage === 1 ? 'disabled' : ''}>上一页</button>`;
    
    const maxVisible = 5;
    let startPage = Math.max(1, this.managePage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
      html += `<button class="btn btn-sm" onclick="App.goManagePage(1)">1</button>`;
      if (startPage > 2) html += `<span style="color: var(--text-muted);">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="btn btn-sm ${i === this.managePage ? 'btn-primary' : ''}" onclick="App.goManagePage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span style="color: var(--text-muted);">...</span>`;
      html += `<button class="btn btn-sm" onclick="App.goManagePage(${totalPages})">${totalPages}</button>`;
    }
    
    html += `<button class="btn btn-sm btn-secondary" onclick="App.goManagePage(${this.managePage + 1})" ${this.managePage === totalPages ? 'disabled' : ''}>下一页</button>`;
    
    container.innerHTML = html;
  },

  goManagePage(page) {
    const totalPages = Math.ceil(this.state.draft.length / this.PAGE_SIZE_MANAGE);
    if (page < 1 || page > totalPages) return;
    this.managePage = page;
    this.renderManageResults();
  },

  updateSeq(index, newSeq) {
    const seq = parseInt(newSeq);
    if (isNaN(seq) || seq < 1 || seq > this.state.draft.length) return;
    
    const item = this.state.draft.splice(index, 1)[0];
    this.state.draft.splice(seq - 1, 0, item);
    this.saveUserData();
    this.renderManageResults();
  },

  moveUp(index) {
    if (index <= 0) return;
    const temp = this.state.draft[index];
    this.state.draft[index] = this.state.draft[index - 1];
    this.state.draft[index - 1] = temp;
    this.saveUserData();
    this.renderManageResults();
  },

  moveDown(index) {
    if (index >= this.state.draft.length - 1) return;
    const temp = this.state.draft[index];
    this.state.draft[index] = this.state.draft[index + 1];
    this.state.draft[index + 1] = temp;
    this.saveUserData();
    this.renderManageResults();
  },

  handleDragStart(event, index) {
    event.dataTransfer.setData('text/plain', index);
    event.target.classList.add('dragging');
  },

  handleDragOver(event) {
    event.preventDefault();
    event.target.classList.add('drag-over');
  },

  handleDrop(event, targetIndex) {
    event.preventDefault();
    const sourceIndex = parseInt(event.dataTransfer.getData('text/plain'));
    
    if (sourceIndex !== targetIndex) {
      const item = this.state.draft.splice(sourceIndex, 1)[0];
      this.state.draft.splice(targetIndex, 0, item);
      this.saveUserData();
      this.renderManageResults();
    }
    
    event.target.classList.remove('dragging', 'drag-over');
  },

  removeFromDraft(index) {
    this.state.draft.splice(index, 1);
    this.saveUserData();
    this.renderManageResults();
  },

  clearDraft() {
    this.state.draft = [];
    this.saveUserData();
    this.renderManageResults();
  },

  sortDraft(sortType) {
    const [field, order] = sortType.split('-');
    this.state.draft.sort((a, b) => {
      const av = a[field] || 0;
      const bv = b[field] || 0;
      return order === 'asc' ? av - bv : bv - av;
    });
    this.saveUserData();
    this.managePage = 1;
    this.renderManageResults();
  },

  async exportDraft() {
    if (this.state.draft.length === 0) {
      alert('没有可导出的志愿');
      return;
    }
    
    try {
      // 转换为中文表头
      const exportData = this.state.draft.map((item, index) => ({
        '序号': index + 1,
        '院校代号': item.collegeCode || '-',
        '院校名称': item.collegeName,
        '专业代号': item.majorCode || '-',
        '专业名称': item.majorName,
        '招生人数': item.planCount || '-',
        '学制': item.duration ? item.duration + '年' : '-',
        '学费': item.tuition ? '¥' + item.tuition.toLocaleString() : '-',
        '最低分': item.minScore || '-',
        '最低位次': item.minRank || '-'
      }));
      
      await ExportUtils.toExcel(exportData, '河北高考志愿表');
      alert('导出成功！');
    } catch (err) {
      alert('导出失败：' + err.message);
    }
  },

};

document.addEventListener('DOMContentLoaded', () => App.init());