// BLACKSENTINEL AI - Frontend Application
const App = {
  // Configuration
  config: {
    apiBase: 'http://localhost:8080/api/v1',
    wsUrl: 'ws://localhost:8080/ws',
    refreshInterval: 5000,
  },

  // State
  state: {
    currentPage: 'dashboard',
    alerts: [],
    alertsFilter: 'all',
    agents: [],
    ws: null,
    token: null,
    user: null,
  },

  // Initialize
  init() {
    // Check authentication
    if (!this.checkAuth()) {
      window.location.href = '/login.html';
      return;
    }

    this.loadUser();
    this.bindEvents();
    this.loadDashboard();
    this.connectWebSocket();
    this.startAutoRefresh();
  },

  // Authentication
  checkAuth() {
    return localStorage.getItem('bs_token') !== null;
  },

  loadUser() {
    const userStr = localStorage.getItem('bs_user');
    if (userStr) {
      this.state.user = JSON.parse(userStr);
      this.updateUserDisplay();
    }
  },

  updateUserDisplay() {
    const user = this.state.user;
    if (user) {
      const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
      document.querySelectorAll('.sidebar-avatar, .header-avatar').forEach(el => {
        el.textContent = initials;
      });
      document.querySelectorAll('.sidebar-user-name').forEach(el => {
        el.textContent = user.name;
      });
      document.querySelectorAll('.sidebar-user-role').forEach(el => {
        el.textContent = user.role.replace('_', ' ');
      });
    }
  },

  logout() {
    localStorage.removeItem('bs_token');
    localStorage.removeItem('bs_user');
    window.location.href = '/login.html';
  },

  // Event Binding
  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page) this.navigateTo(page);
      });
    });

    // Chat
    document.getElementById('chat-send')?.addEventListener('click', () => this.sendMessage());
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Settings
    document.getElementById('btn-save-settings')?.addEventListener('click', () => this.saveSettings());

    // Reports
    document.getElementById('btn-ciso-report')?.addEventListener('click', () => this.generateReport('ciso'));
    document.getElementById('btn-exec-report')?.addEventListener('click', () => this.generateReport('executive'));

    // Menu toggle
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());

    // New Alert Modal
    document.getElementById('btn-new-alert')?.addEventListener('click', () => this.showNewAlertModal());
    document.getElementById('close-alert-modal')?.addEventListener('click', () => this.hideNewAlertModal());
    document.getElementById('cancel-alert')?.addEventListener('click', () => this.hideNewAlertModal());
    document.getElementById('submit-alert')?.addEventListener('click', () => this.submitNewAlert());

    // Investigation Modal
    document.getElementById('btn-new-investigation')?.addEventListener('click', () => this.showNewInvestigationModal());
    document.getElementById('close-investigation-modal')?.addEventListener('click', () => this.hideNewInvestigationModal());
    document.getElementById('cancel-investigation')?.addEventListener('click', () => this.hideNewInvestigationModal());
    document.getElementById('submit-investigation')?.addEventListener('click', () => this.submitNewInvestigation());

    // Playbook Modal
    document.getElementById('btn-new-playbook')?.addEventListener('click', () => this.showNewPlaybookModal());
    document.getElementById('close-playbook-modal')?.addEventListener('click', () => this.hideNewPlaybookModal());
    document.getElementById('cancel-playbook')?.addEventListener('click', () => this.hideNewPlaybookModal());
    document.getElementById('submit-playbook')?.addEventListener('click', () => this.submitNewPlaybook());

    // Threat Intel Modal
    document.getElementById('btn-new-ioc')?.addEventListener('click', () => this.showNewIOCModal());
    document.getElementById('close-ioc-modal')?.addEventListener('click', () => this.hideNewIOCModal());
    document.getElementById('cancel-ioc')?.addEventListener('click', () => this.hideNewIOCModal());
    document.getElementById('submit-ioc')?.addEventListener('click', () => this.submitNewIOC());

    // Artifact Generator
    document.getElementById('btn-generate')?.addEventListener('click', () => this.generateArtifact());
  },

  // Navigation
  navigateTo(page) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    // Update header
    const titles = {
      dashboard: ['Dashboard', 'Real-time security overview'],
      alerts: ['Alerts', 'Manage and investigate alerts'],
      chat: ['AI Assistant', 'Chat with BlackSentinel AI'],
      agents: ['Agents', 'Specialized AI agents'],
      investigations: ['Investigations', 'Active security investigations'],
      playbooks: ['Playbooks', 'Incident response playbooks'],
      knowledge: ['Knowledge Graph', 'Explore security knowledge'],
      memory: ['Memory', '8-tier hierarchical memory system'],
      generative: ['Artifact Generator', 'Generate security artifacts'],
      reports: ['Reports', 'Security reports and analytics'],
      models: ['Models', 'AI model management'],
      threats: ['Threat Intel', 'Threat intelligence feeds'],
      settings: ['Settings', 'System configuration'],
    };

    const [title, subtitle] = titles[page] || ['Dashboard', ''];
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-subtitle').textContent = subtitle;

    this.state.currentPage = page;

    // Load page data
    this.loadPageData(page);
  },

  // Load page data
  async loadPageData(page) {
    switch (page) {
      case 'dashboard':
        await this.loadDashboard();
        break;
      case 'alerts':
        await this.loadAlerts();
        break;
      case 'agents':
        await this.loadAgents();
        break;
      case 'investigations':
        await this.loadInvestigations();
        break;
      case 'playbooks':
        await this.loadPlaybooks();
        break;
      case 'knowledge':
        await this.loadKnowledgeGraph();
        break;
      case 'memory':
        await this.loadMemory();
        break;
      case 'threats':
        await this.loadThreatIntel();
        break;
      case 'reports':
        await this.loadReports();
        break;
    }
  },

  // Toggle a button into/out of its loading state (spinner replaces the
  // label, clicks are blocked) for the duration of a real async call —
  // previously every async button (Generate Report, Generate Artifact,
  // Send) gave no visual feedback at all beyond a toast that only arrived
  // after the request finished.
  setButtonLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('is-loading', loading);
    btn.disabled = loading;
  },

  // API Calls
  async api(endpoint, options = {}) {
    try {
      // The login flow stored a real JWT in localStorage but nothing ever
      // sent it back to the server, so every authenticated route rejected
      // (or, until it was fixed, ran without a tenant) every request from
      // this app. Attach it here.
      const token = localStorage.getItem('bs_token');
      const response = await fetch(`${this.config.apiBase}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
        ...options,
      });

      if (response.status === 401) {
        this.logout();
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      return null;
    }
  },

  // Load Dashboard
  async loadDashboard() {
    const health = await this.api('/health');
    if (health) {
      document.getElementById('stat-agents').textContent = health.components?.length || 10;
    }

    // These three tiles used to be Math.random() on every page load,
    // unrelated to anything in the database. Real counts from
    // /api/v1/alerts/stats instead.
    const statsResponse = await this.api('/alerts/stats');
    const stats = statsResponse?.stats;
    if (stats) {
      document.getElementById('stat-critical').textContent = stats.critical ?? 0;
      document.getElementById('stat-warning').textContent = stats.high ?? 0;
      document.getElementById('stat-resolved').textContent = stats.resolved_count ?? 0;
    }

    this.loadRecentAlerts();
  },

  // Load Recent Alerts (from database)
  async loadRecentAlerts() {
    const response = await this.api('/alerts');
    const alerts = response?.alerts || [];

    const tbody = document.getElementById('alerts-table-body');
    if (tbody) {
      tbody.innerHTML = alerts.map(alert => `
        <tr>
          <td><span class="badge badge-${alert.severity}"><span class="badge-dot"></span> ${alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}</span></td>
          <td>${alert.title}</td>
          <td>${alert.source}</td>
          <td>${new Date(alert.created_at).toLocaleString()}</td>
          <td><span class="badge badge-${alert.status === 'resolved' ? 'success' : alert.status === 'new' ? 'info' : 'warning'}">${alert.status}</span></td>
          <td><button class="btn btn-primary btn-sm" onclick="App.investigateAlert('${alert.id}')">Investigate</button></td>
        </tr>
      `).join('');
    }

    // Update badge
    document.getElementById('alerts-badge').textContent = alerts.filter(a => a.status !== 'resolved').length;

    this.renderSeverityMix(alerts);

    // Load stats
    const statsResponse = await this.api('/alerts/stats');
    if (statsResponse?.stats) {
      document.getElementById('stat-critical').textContent = statsResponse.stats.critical || 0;
      document.getElementById('stat-warning').textContent = (parseInt(statsResponse.stats.high) || 0) + (parseInt(statsResponse.stats.medium) || 0);
      document.getElementById('stat-resolved').textContent = statsResponse.stats.resolved_count || 0;
    }
  },

  // Render the dashboard's Severity Mix panel — a real distribution of the
  // currently open alerts (same list the Recent Alerts table renders),
  // not a fabricated trend. Open alerts only, since a resolved backlog
  // would otherwise dilute what the panel is meant to show: what needs
  // attention right now.
  renderSeverityMix(alerts) {
    const bar = document.getElementById('severity-mix-bar');
    const legend = document.getElementById('severity-mix-legend');
    const subtitle = document.getElementById('severity-mix-subtitle');
    if (!bar || !legend) return;

    const open = alerts.filter(a => a.status !== 'resolved');
    const order = ['critical', 'high', 'medium', 'low'];
    const colors = { critical: 'var(--bs-critical)', high: 'var(--bs-orange)', medium: 'var(--bs-warning)', low: 'var(--bs-info)' };
    const counts = order.reduce((acc, sev) => {
      acc[sev] = open.filter(a => a.severity === sev).length;
      return acc;
    }, {});

    subtitle.textContent = `Distribución de severidad · ${open.length} alerta${open.length === 1 ? '' : 's'} abierta${open.length === 1 ? '' : 's'}`;

    if (open.length === 0) {
      bar.innerHTML = `<span style="flex: 1; background: var(--bs-gray-dark);"></span>`;
      legend.innerHTML = `<div style="font-size: .84rem; color: var(--bs-text-muted);">No open alerts.</div>`;
      return;
    }

    bar.innerHTML = order
      .filter(sev => counts[sev] > 0)
      .map(sev => `<span style="flex: ${counts[sev]}; background: ${colors[sev]};"></span>`)
      .join('');

    legend.innerHTML = order.map(sev => `
      <div style="display: flex; align-items: center; gap: 10px; font-size: .84rem;">
        <span style="width: 8px; height: 8px; border-radius: 2px; background: ${colors[sev]}; flex-shrink: 0;"></span>
        <span style="flex: 1; color: var(--bs-text-secondary); text-transform: capitalize;">${sev}</span>
        <span style="font-family: var(--bs-font-mono); color: var(--bs-white);">${counts[sev]}</span>
      </div>
    `).join('');
  },

  // Load Alerts (full Alerts page — separate table/id from the Dashboard's
  // "Recent Alerts" widget, which loadRecentAlerts() feeds. This page's
  // tbody (#alerts-list) had no load function wired to it at all until now,
  // so the page always rendered empty even though the API returned data.
  async loadAlerts() {
    const response = await this.api('/alerts');
    this.state.alerts = response?.alerts || [];
    this.renderAlertsList();

    document.getElementById('alerts-badge').textContent =
      this.state.alerts.filter(a => a.status !== 'resolved').length;
  },

  // Render the Alerts page table from state, applying the active severity filter
  renderAlertsList() {
    const tbody = document.getElementById('alerts-list');
    if (!tbody) return;

    const filter = this.state.alertsFilter;
    const alerts = filter === 'all'
      ? this.state.alerts
      : this.state.alerts.filter(a => a.severity === filter);

    if (alerts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            ${this.state.alerts.length === 0 ? 'No alerts. All clear.' : `No ${filter} alerts.`}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = alerts.map(alert => `
      <tr>
        <td><span class="badge badge-${alert.severity}"><span class="badge-dot"></span> ${alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}</span></td>
        <td>${alert.title}</td>
        <td>${alert.source}</td>
        <td>${new Date(alert.created_at).toLocaleString()}</td>
        <td><span class="badge badge-${alert.status === 'resolved' ? 'success' : alert.status === 'new' ? 'info' : 'warning'}">${alert.status}</span></td>
        <td><button class="btn btn-primary btn-sm" onclick="App.investigateAlert('${alert.id}')">Investigate</button></td>
      </tr>
    `).join('');
  },

  // Switch the Alerts page severity filter and re-render from cached state
  // (no refetch needed — the full list is already in memory)
  filterAlerts(severity) {
    this.state.alertsFilter = severity;

    document.querySelectorAll('#alerts-filter-group [data-severity]').forEach(btn => {
      const active = btn.dataset.severity === severity;
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
    });

    this.renderAlertsList();
  },

  // Investigate Alert
  investigateAlert(id) {
    this.showToast('Opening investigation...', 'info');
    this.navigateTo('investigations');
  },

  // Load Agents
  async loadAgents() {
    const agents = [
      { type: 'soc', name: 'SOC Agent', icon: 'S', tasks: 142, accuracy: 94, uptime: 99.9 },
      { type: 'threat-hunter', name: 'Threat Hunter', icon: 'TH', tasks: 89, accuracy: 91, uptime: 99.8 },
      { type: 'incident-response', name: 'Incident Response', icon: 'IR', tasks: 67, accuracy: 96, uptime: 99.9 },
      { type: 'threat-intel', name: 'Threat Intelligence', icon: 'TI', tasks: 234, accuracy: 88, uptime: 99.7 },
      { type: 'vulnerability', name: 'Vulnerability Agent', icon: 'VA', tasks: 178, accuracy: 92, uptime: 99.9 },
      { type: 'identity', name: 'Identity Agent', icon: 'IA', tasks: 95, accuracy: 95, uptime: 99.8 },
      { type: 'endpoint', name: 'Endpoint Agent', icon: 'EA', tasks: 312, accuracy: 93, uptime: 99.9 },
      { type: 'cloud', name: 'Cloud Agent', icon: 'CA', tasks: 156, accuracy: 90, uptime: 99.7 },
      { type: 'executive', name: 'Executive Agent', icon: 'EX', tasks: 45, accuracy: 97, uptime: 99.9 },
      { type: 'automation', name: 'Automation Agent', icon: 'AU', tasks: 523, accuracy: 99, uptime: 99.9 },
    ];

    const grid = document.getElementById('agents-grid');
    if (grid) {
      grid.innerHTML = agents.map(agent => `
        <div class="agent-card agent-${agent.type}">
          <div class="agent-header">
            <div class="agent-avatar">${agent.icon}</div>
            <div class="agent-info">
              <h3>${agent.name}</h3>
              <span class="badge badge-success"><span class="badge-dot"></span> Active</span>
            </div>
          </div>
          <div class="agent-stats">
            <div class="agent-stat">
              <div class="agent-stat-value">${agent.tasks}</div>
              <div class="agent-stat-label">Tasks</div>
            </div>
            <div class="agent-stat">
              <div class="agent-stat-value">${agent.accuracy}%</div>
              <div class="agent-stat-label">Accuracy</div>
            </div>
            <div class="agent-stat">
              <div class="agent-stat-value">${agent.uptime}%</div>
              <div class="agent-stat-label">Uptime</div>
            </div>
          </div>
        </div>
      `).join('');
    }
  },

  // Load Investigations (from database)
  async loadInvestigations() {
    const response = await this.api('/investigations');
    const investigations = response?.investigations || [];

    const tbody = document.getElementById('investigations-list');
    if (tbody) {
      if (investigations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No investigations yet. Open one from an alert, or start one with "New Investigation".</td></tr>`;
        return;
      }
      tbody.innerHTML = investigations.map(inv => `
        <tr>
          <td><span style="font-family: var(--bs-font-mono); font-size: 0.85rem;">${inv.investigation_id}</span></td>
          <td>${inv.title}</td>
          <td><span class="badge badge-${inv.severity}"><span class="badge-dot"></span> ${inv.severity.charAt(0).toUpperCase() + inv.severity.slice(1)}</span></td>
          <td><span class="badge badge-${inv.status === 'active' ? 'info' : inv.status === 'completed' ? 'success' : 'warning'}">${inv.status}</span></td>
          <td>${inv.assigned_to || 'Unassigned'}</td>
          <td>${new Date(inv.created_at).toLocaleString()}</td>
          <td>${inv.findings?.length || 0}</td>
          <td><button class="btn btn-outline btn-sm" onclick="App.viewInvestigation('${inv.id}')">View</button></td>
        </tr>
      `).join('');
    }
  },

  // View Investigation
  viewInvestigation(id) {
    this.showToast(`Opening investigation ${id}...`, 'info');
  },

  // Load Playbooks (from database)
  async loadPlaybooks() {
    const response = await this.api('/playbooks');
    const playbooks = response?.playbooks || [];

    const grid = document.getElementById('playbooks-grid');
    if (grid) {
      grid.innerHTML = playbooks.map(pb => `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 4px;">${pb.name}</h3>
              ${pb.description ? `<p style="font-size: 0.8rem; color: var(--bs-text-muted);">${pb.description}</p>` : ''}
            </div>
            <span class="badge badge-accent">${pb.playbook_id}</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--bs-spacing-md); margin: var(--bs-spacing-md) 0; padding: var(--bs-spacing-md); background: var(--bs-gray-dark); border-radius: var(--bs-radius-md);">
            <div style="text-align: center;">
              <div style="font-size: 1.25rem; font-weight: 600;">${pb.steps?.length || 0}</div>
              <div style="font-size: 0.7rem; color: var(--bs-text-muted); text-transform: uppercase;">Steps</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.25rem; font-weight: 600; color: var(--bs-success);">${pb.success_rate || 0}%</div>
              <div style="font-size: 0.7rem; color: var(--bs-text-muted); text-transform: uppercase;">Success</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.85rem; font-weight: 500;">${pb.last_used_at ? new Date(pb.last_used_at).toLocaleDateString() : 'Never'}</div>
              <div style="font-size: 0.7rem; color: var(--bs-text-muted); text-transform: uppercase;">Last Used</div>
            </div>
          </div>
          <div style="display: flex; gap: var(--bs-spacing-sm);">
            <button class="btn btn-primary btn-sm" onclick="App.executePlaybook('${pb.id}')">Execute</button>
            <button class="btn btn-outline btn-sm" onclick="App.viewPlaybook('${pb.id}')">View Details</button>
          </div>
        </div>
      `).join('');
    }
  },

  // Execute Playbook
  executePlaybook(id) {
    this.showToast(`Executing playbook ${id}...`, 'info');
  },

  // View Playbook
  viewPlaybook(id) {
    this.showToast(`Opening playbook ${id}...`, 'info');
  },

  // Load Knowledge Graph
  async loadKnowledgeGraph() {
    const stats = await this.api('/knowledge/graph/stats');
    if (stats) {
      document.getElementById('kg-nodes').textContent = stats.totalNodes || 0;
      document.getElementById('kg-edges').textContent = stats.totalEdges || 0;
      document.getElementById('kg-types').textContent = Object.keys(stats.nodeTypes || {}).length;
    }
    this.renderKnowledgeGraph();
  },

  // Render Knowledge Graph (3D)
  renderKnowledgeGraph() {
    const canvas = document.getElementById('knowledge-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Create nodes with 3D-like properties
    const nodes = [];
    const edges = [];
    const nodeTypes = ['Entity', 'Threat', 'Vulnerability', 'Asset', 'Person', 'Malware', 'Campaign', 'Tool'];
    const nodeColors = ['#FF6B00', '#EF4444', '#22C55E', '#3B82F6', '#FACC15', '#FF8C1A', '#FF9933', '#D9D9D9'];

    // Generate 50 nodes
    for (let i = 0; i < 50; i++) {
      const typeIndex = Math.floor(Math.random() * nodeTypes.length);
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 8 + 4,
        color: nodeColors[typeIndex],
        type: nodeTypes[typeIndex],
        label: `${nodeTypes[typeIndex]}-${i}`,
      });
    }

    // Generate edges
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (dist < 150 && Math.random() > 0.7) {
          edges.push({ from: i, to: j });
        }
      }
    }

    // Animation loop
    const animate = () => {
      ctx.fillStyle = 'rgba(11, 11, 11, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update positions
      nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
      });

      // Draw edges
      ctx.strokeStyle = 'rgba(35, 35, 35, 0.5)';
      ctx.lineWidth = 1;
      edges.forEach(edge => {
        ctx.beginPath();
        ctx.moveTo(nodes[edge.from].x, nodes[edge.from].y);
        ctx.lineTo(nodes[edge.to].x, nodes[edge.to].y);
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach(node => {
        const size = node.radius * (1 + node.z / 200);
        
        // Glow effect
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 2);
        gradient.addColorStop(0, node.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Node
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = '#0B0B0B';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      requestAnimationFrame(animate);
    };

    animate();
  },

  // Load Memory
  async loadMemory() {
    const stats = await this.api('/memory/stats');
    if (stats) {
      const layers = stats.layers || [];
      layers.forEach(layer => {
        const el = document.getElementById(`mem-${layer.name}`);
        if (el) el.textContent = layer.count || 0;
      });
    }
  },

  // Load Threat Intel (from database)
  async loadThreatIntel() {
    const response = await this.api('/threat-intel');
    const iocs = response?.iocs || [];

    const tbody = document.getElementById('threats-list');
    if (tbody) {
      if (iocs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No indicators of compromise yet. Add one with "Add IOC".</td></tr>`;
        return;
      }
      tbody.innerHTML = iocs.map(ioc => `
        <tr>
          <td><span class="badge badge-accent">${ioc.type}</span></td>
          <td><code style="background: var(--bs-gray-dark); padding: 2px 6px; border-radius: 4px; font-family: var(--bs-font-mono); font-size: 0.85rem;">${ioc.value}</code></td>
          <td>${ioc.threat_type || 'Unknown'}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="progress" style="width: 60px;">
                <div class="progress-bar ${(ioc.confidence * 100) >= 90 ? 'success' : (ioc.confidence * 100) >= 70 ? 'warning' : 'critical'}" style="width: ${ioc.confidence * 100}%;"></div>
              </div>
              <span>${Math.round(ioc.confidence * 100)}%</span>
            </div>
          </td>
          <td>${ioc.source}</td>
          <td>${new Date(ioc.first_seen_at).toLocaleDateString()}</td>
          <td>${new Date(ioc.last_seen_at).toLocaleDateString()}</td>
          <td><button class="btn btn-outline btn-sm" onclick="App.viewIOC('${ioc.id}')">View</button></td>
        </tr>
      `).join('');
    }
  },

  // View IOC
  viewIOC(id) {
    this.showToast('Opening IOC details...', 'info');
  },

  // Send Chat Message
  async sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input?.value.trim();
    if (!message) return;

    // Add user message
    this.addChatMessage(message, 'user');
    input.value = '';

    const sendBtn = document.getElementById('chat-send');
    this.setButtonLoading(sendBtn, true);
    input.disabled = true;

    // Show processing
    const processingId = this.addChatMessage('Processing your query...', 'ai', true);

    // Call API
    const response = await this.api('/query', {
      method: 'POST',
      body: JSON.stringify({ query: message }),
    });

    // Remove processing message
    document.getElementById(processingId)?.remove();
    this.setButtonLoading(sendBtn, false);
    input.disabled = false;
    input.focus();

    // A truthy response used to be treated as success even for an error
    // body, which meant a real backend failure silently showed a
    // hardcoded "I have analyzed your query..." canned line that claimed
    // to have used the Knowledge Graph, Memory Service, and Threat Intel
    // feeds — none of which happened. Only fall back to that line when
    // the agent genuinely returned no text at all; report real failures
    // honestly.
    if (response && !response.error) {
      this.addChatMessage(response.answer || response.response || 'The agent returned no text for this query.', 'ai');
    } else {
      this.addChatMessage(response?.error?.message || 'I am unable to process your request right now. Please ensure the AI Engine is running and try again.', 'ai');
    }
  },

  // Add Chat Message
  addChatMessage(content, type, isProcessing = false) {
    const container = document.getElementById('chat-messages');
    if (!container) return null;

    const messageId = 'msg-' + Date.now();
    const message = document.createElement('div');
    message.className = `chat-message ${type}`;
    message.id = messageId;
    message.innerHTML = `
      <div class="chat-message-avatar">${type === 'user' ? (this.state.user?.name?.charAt(0) || 'U') : 'AI'}</div>
      <div class="chat-message-content">${isProcessing ? '<span class="loading-spinner" style="display: inline-block; width: 14px; height: 14px; border: 2px solid transparent; border-top-color: currentColor; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px;"></span>' : ''}${content}</div>
    `;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
    return messageId;
  },

  // Generate Report
  //
  // Used to declare success for any parsed JSON body, including error
  // responses — the /reports/ciso call was actually failing Zod validation
  // server-side (missing tenantId) on every single click, returning HTTP
  // 500, while this still showed "Report generated successfully" with the
  // real content thrown away. Both the false-positive and the dropped
  // output are fixed: check for the error shape explicitly, then render
  // the real, DB-backed report (including the risk assessment and the
  // data gaps the backend deliberately admits to) instead of just a toast.
  async generateReport(type) {
    const btn = document.getElementById(type === 'executive' ? 'btn-exec-report' : 'btn-ciso-report');
    this.setButtonLoading(btn, true);

    const response = await this.api(`/reports/${type === 'executive' ? 'ciso' : type}`, {
      method: 'POST',
      body: JSON.stringify({ format: 'json' }),
    });

    this.setButtonLoading(btn, false);

    if (!response || response.error) {
      this.showToast(response?.error?.message || 'Failed to generate report', 'error');
      return;
    }

    this.showToast('Report generated successfully', 'success');
    this.renderReportOutput(type, response);
  },

  // Render a generated report's real content into the Reports page
  renderReportOutput(type, report) {
    const panel = document.getElementById('report-output');
    if (!panel) return;

    const m = report.keyMetrics || {};
    const risk = report.riskAssessment || {};

    panel.hidden = false;
    panel.innerHTML = `
      <div class="card-header">
        <div>
          <h3 style="font-size: 1rem; font-weight: 600;">${type === 'executive' ? 'Executive Summary' : 'CISO Report'}</h3>
          <p style="font-size: 0.8rem; color: var(--bs-text-muted);">Generated ${new Date(report.generatedAt).toLocaleString()}</p>
        </div>
        <span class="badge badge-${risk.overall || 'info'}"><span class="badge-dot"></span> ${(risk.overall || 'unknown').toUpperCase()} RISK</span>
      </div>
      <p style="margin: var(--bs-spacing-md) 0;">${report.executiveSummary || ''}</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--bs-spacing-md); margin: var(--bs-spacing-md) 0; padding: var(--bs-spacing-md); background: var(--bs-gray-dark); border-radius: var(--bs-radius-md);">
        <div style="text-align: center;">
          <div style="font-size: 1.25rem; font-weight: 600;">${m.openAlerts ?? '—'}</div>
          <div style="font-size: 0.7rem; color: var(--bs-text-muted); text-transform: uppercase;">Open Alerts</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 1.25rem; font-weight: 600; color: var(--bs-critical);">${m.criticalAlerts ?? '—'}</div>
          <div style="font-size: 0.7rem; color: var(--bs-text-muted); text-transform: uppercase;">Critical</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 1.25rem; font-weight: 600;">${m.openIncidents ?? '—'}</div>
          <div style="font-size: 0.7rem; color: var(--bs-text-muted); text-transform: uppercase;">Open Incidents</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 1.25rem; font-weight: 600;">${m.resolvedLast24h ?? '—'}</div>
          <div style="font-size: 0.7rem; color: var(--bs-text-muted); text-transform: uppercase;">Resolved 24h</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 1.25rem; font-weight: 600;">${m.meanTimeToResolveHours ?? '—'}</div>
          <div style="font-size: 0.7rem; color: var(--bs-text-muted); text-transform: uppercase;">MTTR (hrs)</div>
        </div>
      </div>
      ${report.recommendations?.length ? `
        <div style="margin-bottom: var(--bs-spacing-md);">
          <h4 style="font-size: 0.85rem; font-weight: 600; margin-bottom: var(--bs-spacing-sm);">Recommendations</h4>
          <ul style="padding-left: 1.2em; font-size: 0.85rem; color: var(--bs-text-secondary);">
            ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${report.dataGaps?.length ? `
        <div style="border-top: 1px solid var(--bs-border); padding-top: var(--bs-spacing-md);">
          <h4 style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--bs-text-muted); margin-bottom: var(--bs-spacing-sm);">Not yet covered</h4>
          <ul style="padding-left: 1.2em; font-size: 0.78rem; color: var(--bs-text-muted);">
            ${report.dataGaps.map(g => `<li>${g}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  },

  // Load Report history (GET /reports — honestly empty until a `reports`
  // table exists server-side to persist generated reports; see reports.ts)
  async loadReports() {
    const response = await this.api('/reports');
    const reports = response?.reports || [];

    const tbody = document.getElementById('reports-list');
    if (!tbody) return;

    if (reports.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            ${response?.note || 'No report history yet. Generate one above.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = reports.map(r => `
      <tr>
        <td>${r.title}</td>
        <td><span class="badge badge-accent">${r.type}</span></td>
        <td>${new Date(r.generatedAt).toLocaleString()}</td>
        <td><button class="btn btn-outline btn-sm">Download</button></td>
      </tr>
    `).join('');
  },

  // Generate Artifact
  async generateArtifact() {
    const description = document.querySelector('#page-generative textarea')?.value;
    const type = document.querySelector('#page-generative select')?.value;

    if (!description) {
      this.showToast('Please enter a description', 'warning');
      return;
    }

    const btn = document.getElementById('btn-generate');
    this.setButtonLoading(btn, true);

    const response = await this.api('/generative/generate', {
      method: 'POST',
      body: JSON.stringify({
        type: type?.toLowerCase().replace(' ', '') || 'sigma',
        description: description,
      }),
    });

    this.setButtonLoading(btn, false);

    // Same false-positive-success bug as the report generator had: any
    // parsed JSON body (including an { error: ... } response) counted as
    // success here before.
    if (!response || response.error) {
      this.showToast(response?.error?.message || 'Failed to generate artifact', 'error');
      return;
    }

    const output = document.querySelector('#page-generative pre code');
    if (output) {
      output.textContent = response.content || JSON.stringify(response, null, 2);
    }
    this.showToast('Artifact generated successfully', 'success');
  },

  // Modal Functions
  showNewAlertModal() {
    document.getElementById('new-alert-modal').classList.add('active');
  },

  hideNewAlertModal() {
    document.getElementById('new-alert-modal').classList.remove('active');
  },

  async submitNewAlert() {
    const title = document.getElementById('alert-title').value;
    const severity = document.getElementById('alert-severity').value;
    const source = document.getElementById('alert-source').value;
    const description = document.getElementById('alert-description').value;

    if (!title || !severity) {
      this.showToast('Please fill in all required fields', 'warning');
      return;
    }

    const response = await this.api('/alerts', {
      method: 'POST',
      body: JSON.stringify({ title, severity, source, description }),
    });

    if (response?.alert) {
      this.hideNewAlertModal();
      this.showToast('Alert created successfully', 'success');
      this.loadRecentAlerts();

      // Clear form
      document.getElementById('alert-title').value = '';
      document.getElementById('alert-description').value = '';
    } else {
      this.showToast('Failed to create alert', 'error');
    }
  },

  showNewInvestigationModal() {
    document.getElementById('new-investigation-modal').classList.add('active');
  },

  hideNewInvestigationModal() {
    document.getElementById('new-investigation-modal').classList.remove('active');
  },

  async submitNewInvestigation() {
    const title = document.getElementById('investigation-title').value;
    const severity = document.getElementById('investigation-severity').value;
    const assignedTo = document.getElementById('investigation-assigned').value;

    if (!title) {
      this.showToast('Please enter a title', 'warning');
      return;
    }

    const response = await this.api('/investigations', {
      method: 'POST',
      body: JSON.stringify({ title, severity, assigned_to: assignedTo }),
    });

    if (response?.investigation) {
      this.hideNewInvestigationModal();
      this.showToast('Investigation created successfully', 'success');
      this.loadInvestigations();
    } else {
      this.showToast('Failed to create investigation', 'error');
    }
  },

  showNewPlaybookModal() {
    document.getElementById('new-playbook-modal').classList.add('active');
  },

  hideNewPlaybookModal() {
    document.getElementById('new-playbook-modal').classList.remove('active');
  },

  async submitNewPlaybook() {
    const name = document.getElementById('playbook-name').value;
    const description = document.getElementById('playbook-description').value;

    if (!name) {
      this.showToast('Please enter a name', 'warning');
      return;
    }

    const response = await this.api('/playbooks', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });

    if (response?.playbook) {
      this.hideNewPlaybookModal();
      this.showToast('Playbook created successfully', 'success');
      this.loadPlaybooks();
    } else {
      this.showToast('Failed to create playbook', 'error');
    }
  },

  showNewIOCModal() {
    document.getElementById('new-ioc-modal').classList.add('active');
  },

  hideNewIOCModal() {
    document.getElementById('new-ioc-modal').classList.remove('active');
  },

  async submitNewIOC() {
    const type = document.getElementById('ioc-type').value;
    const value = document.getElementById('ioc-value').value;
    const threat = document.getElementById('ioc-threat').value;

    if (!type || !value) {
      this.showToast('Please fill in all required fields', 'warning');
      return;
    }

    const response = await this.api('/threat-intel', {
      method: 'POST',
      body: JSON.stringify({ type, value, threat_type: threat }),
    });

    if (response?.ioc) {
      this.hideNewIOCModal();
      this.showToast('IOC added successfully', 'success');
      this.loadThreatIntel();
    } else {
      this.showToast('Failed to add IOC', 'error');
    }
  },

  // WebSocket Connection
  connectWebSocket() {
    try {
      this.state.ws = new WebSocket(this.config.wsUrl);

      this.state.ws.onopen = () => {
        console.log('WebSocket connected');
        document.getElementById('system-status').textContent = 'Online';
        document.getElementById('system-status').style.color = 'var(--bs-success)';
      };

      this.state.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      };

      this.state.ws.onclose = () => {
        console.log('WebSocket disconnected');
        document.getElementById('system-status').textContent = 'Offline';
        document.getElementById('system-status').style.color = 'var(--bs-critical)';
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.state.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  },

  // Handle WebSocket Messages
  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'alert':
        this.handleNewAlert(data);
        break;
      case 'decision':
        this.handleNewDecision(data);
        break;
      case 'update':
        this.handleUpdate(data);
        break;
    }
  },

  handleNewAlert(alert) {
    this.showToast(`New ${alert.severity} alert: ${alert.title}`, alert.severity);
    if (this.state.currentPage === 'dashboard') {
      this.loadDashboard();
    }
  },

  handleNewDecision(decision) {
    this.showToast(`AI Decision: ${decision.action}`, 'info');
  },

  handleUpdate(data) {
    this.loadPageData(this.state.currentPage);
  },

  // Auto Refresh
  startAutoRefresh() {
    setInterval(() => {
      if (this.state.currentPage === 'dashboard') {
        this.loadDashboard();
      }
    }, this.config.refreshInterval);
  },

  // Save Settings
  saveSettings() {
    const engineUrl = document.getElementById('setting-engine-url')?.value;
    const wsUrl = document.getElementById('setting-ws-url')?.value;
    const refresh = document.getElementById('setting-refresh')?.value;

    if (engineUrl) this.config.apiBase = `${engineUrl}/api/v1`;
    if (wsUrl) this.config.wsUrl = wsUrl;
    if (refresh) this.config.refreshInterval = parseInt(refresh);

    this.showToast('Settings saved', 'success');
  },

  // Toast Notifications
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
      error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
      warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      ${icons[type] || icons.info}
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 5000);
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
