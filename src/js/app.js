const { ipcRenderer } = require('electron');

class App {
    constructor() {
        this.currentView = 'calendar';
        this.init();
    }

    async init() {
        this.bindEvents();
        this.showView('calendar');
        
        await this.loadData();
    }

    bindEvents() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('.nav-btn').dataset.view;
                this.showView(view);
            });
        });

        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        window.addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });
    }

    showView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        document.getElementById(`${viewName}-view`).classList.add('active');
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
        
        this.currentView = viewName;

        this.refreshCurrentView();
    }

    async refreshCurrentView() {
        switch(this.currentView) {
            case 'calendar':
                if (window.calendar) {
                    await window.calendar.refresh();
                }
                break;
            case 'performances':
                if (window.performanceManager) {
                    await window.performanceManager.loadPerformances();
                }
                break;
            case 'members':
                if (window.memberManager) {
                    await window.memberManager.loadMembers();
                }
                break;
            case 'schedules':
                if (window.scheduleManager) {
                    await window.scheduleManager.loadSchedules();
                }
                break;
            case 'assignment':
                if (window.assignmentManager) {
                    await window.assignmentManager.initializeMonthOptions();
                }
                break;
        }
    }

    showModal(content) {
        document.getElementById('modal-body').innerHTML = content;
        document.getElementById('modal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('modal').style.display = 'none';
        document.getElementById('modal-body').innerHTML = '';
    }

    async loadData() {
        try {
            console.log('기본 데이터 로딩 중...');
        } catch (error) {
            console.error('데이터 로딩 실패:', error);
        }
    }

    async dbRun(sql, params = []) {
        try {
            return await ipcRenderer.invoke('db-run', sql, params);
        } catch (error) {
            console.error('DB Run Error:', error);
            throw error;
        }
    }

    async dbGet(sql, params = []) {
        try {
            return await ipcRenderer.invoke('db-get', sql, params);
        } catch (error) {
            console.error('DB Get Error:', error);
            throw error;
        }
    }

    async dbAll(sql, params = []) {
        try {
            return await ipcRenderer.invoke('db-all', sql, params);
        } catch (error) {
            console.error('DB All Error:', error);
            throw error;
        }
    }

    showLoading(container) {
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
            </div>
        `;
    }

    showError(container, message) {
        container.innerHTML = `
            <div class="error-message">
                <h3>오류 발생</h3>
                <p>${message}</p>
            </div>
        `;
    }

    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('ko-KR');
    }

    formatDateTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleString('ko-KR');
    }

    formatTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    confirm(message) {
        return new Promise((resolve) => {
            const confirmed = window.confirm(message);
            resolve(confirmed);
        });
    }

    alert(message) {
        return new Promise((resolve) => {
            window.alert(message);
            resolve();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});