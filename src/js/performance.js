class PerformanceManager {
    constructor() {
        this.performances = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadPerformances();
    }

    bindEvents() {
        document.getElementById('add-performance').addEventListener('click', () => {
            this.showAddPerformanceModal();
        });
    }

    async loadPerformances() {
        try {
            const container = document.getElementById('performances-list');
            window.app.showLoading(container);

            this.performances = await window.app.dbAll('SELECT * FROM performances ORDER BY created_at DESC');
            this.renderPerformances();
        } catch (error) {
            console.error('공연 목록 로딩 실패:', error);
            const container = document.getElementById('performances-list');
            window.app.showError(container, '공연 목록을 불러오는데 실패했습니다.');
        }
    }

    renderPerformances() {
        const container = document.getElementById('performances-list');
        
        if (this.performances.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>등록된 공연이 없습니다</h3>
                    <p>새 공연을 추가해주세요.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.performances.map(performance => {
            const roles = JSON.parse(performance.roles || '[]');
            return `
                <div class="list-item" data-id="${performance.id}">
                    <h3>${performance.name}</h3>
                    <p><strong>역할:</strong> ${roles.join(', ')}</p>
                    <p><strong>비고:</strong> ${performance.notes || '없음'}</p>
                    <p><strong>등록일:</strong> ${window.app.formatDateTime(performance.created_at)}</p>
                    <div class="actions">
                        <button class="btn btn-secondary edit-performance" data-id="${performance.id}">수정</button>
                        <button class="btn btn-danger delete-performance" data-id="${performance.id}">삭제</button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.edit-performance').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.showEditPerformanceModal(parseInt(id));
            });
        });

        container.querySelectorAll('.delete-performance').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const performance = this.performances.find(p => p.id == id);
                const confirmed = await window.app.confirm(`"${performance.name}" 공연을 삭제하시겠습니까?`);
                if (confirmed) {
                    await this.deletePerformance(parseInt(id));
                }
            });
        });
    }

    showAddPerformanceModal() {
        const modalContent = `
            <h3>공연 추가</h3>
            <form id="add-performance-form">
                <div class="form-group">
                    <label for="performance-name">공연명 *</label>
                    <input type="text" id="performance-name" required>
                </div>
                
                <div class="form-group">
                    <label>역할 설정</label>
                    <div id="roles-container">
                        <div class="role-input">
                            <input type="text" class="role-name" placeholder="역할명" value="주연">
                        </div>
                        <div class="role-input">
                            <input type="text" class="role-name" placeholder="역할명" value="조연">
                        </div>
                        <div class="role-input">
                            <input type="text" class="role-name" placeholder="역할명" value="단역">
                        </div>
                    </div>
                    <button type="button" id="add-role" class="btn btn-secondary" style="margin-top: 10px;">역할 추가</button>
                </div>

                <div class="form-group">
                    <label for="performance-notes">비고</label>
                    <textarea id="performance-notes" placeholder="공연에 대한 추가 정보"></textarea>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">추가</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);
        this.bindRoleEvents();
        this.bindPerformanceFormEvents();
    }

    showEditPerformanceModal(id) {
        const performance = this.performances.find(p => p.id === id);
        if (!performance) return;

        const roles = JSON.parse(performance.roles || '[]');
        const rolesHtml = roles.map(role => `
            <div class="role-input">
                <input type="text" class="role-name" placeholder="역할명" value="${role}">
                <button type="button" class="remove-role">×</button>
            </div>
        `).join('');

        const modalContent = `
            <h3>공연 수정</h3>
            <form id="edit-performance-form" data-id="${performance.id}">
                <div class="form-group">
                    <label for="performance-name">공연명 *</label>
                    <input type="text" id="performance-name" value="${performance.name}" required>
                </div>
                
                <div class="form-group">
                    <label>역할 설정</label>
                    <div id="roles-container">
                        ${rolesHtml || '<div class="role-input"><input type="text" class="role-name" placeholder="역할명"></div>'}
                    </div>
                    <button type="button" id="add-role" class="btn btn-secondary" style="margin-top: 10px;">역할 추가</button>
                </div>

                <div class="form-group">
                    <label for="performance-notes">비고</label>
                    <textarea id="performance-notes" placeholder="공연에 대한 추가 정보">${performance.notes || ''}</textarea>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">수정</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);
        this.bindRoleEvents();
        this.bindPerformanceFormEvents();
    }

    bindRoleEvents() {
        document.getElementById('add-role').addEventListener('click', () => {
            const container = document.getElementById('roles-container');
            const roleInputs = container.querySelectorAll('.role-input');
            
            if (roleInputs.length >= 10) {
                window.app.alert('최대 10개의 역할까지만 추가할 수 있습니다.');
                return;
            }

            const roleDiv = document.createElement('div');
            roleDiv.className = 'role-input';
            roleDiv.innerHTML = `
                <input type="text" class="role-name" placeholder="역할명">
                <button type="button" class="remove-role">×</button>
            `;
            container.appendChild(roleDiv);

            roleDiv.querySelector('.remove-role').addEventListener('click', () => {
                roleDiv.remove();
            });
        });

        document.querySelectorAll('.remove-role').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.role-input').remove();
            });
        });
    }

    bindPerformanceFormEvents() {
        const form = document.querySelector('#add-performance-form, #edit-performance-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('performance-name').value.trim();
            const notes = document.getElementById('performance-notes').value.trim();
            
            const roleInputs = document.querySelectorAll('.role-name');
            const roles = Array.from(roleInputs)
                .map(input => input.value.trim())
                .filter(role => role.length > 0);

            if (!name) {
                window.app.alert('공연명을 입력해주세요.');
                return;
            }

            if (roles.length === 0) {
                window.app.alert('최소 하나의 역할을 입력해주세요.');
                return;
            }

            try {
                if (form.id === 'add-performance-form') {
                    await this.addPerformance(name, roles, notes);
                } else {
                    const id = parseInt(form.dataset.id);
                    await this.updatePerformance(id, name, roles, notes);
                }
                window.app.closeModal();
                await this.loadPerformances();
            } catch (error) {
                console.error('공연 저장 실패:', error);
                window.app.alert('저장 중 오류가 발생했습니다.');
            }
        });
    }

    async addPerformance(name, roles, notes) {
        const sql = 'INSERT INTO performances (name, roles, notes) VALUES (?, ?, ?)';
        const params = [name, JSON.stringify(roles), notes];
        
        return await window.app.dbRun(sql, params);
    }

    async updatePerformance(id, name, roles, notes) {
        const sql = 'UPDATE performances SET name = ?, roles = ?, notes = ? WHERE id = ?';
        const params = [name, JSON.stringify(roles), notes, id];
        
        return await window.app.dbRun(sql, params);
    }

    async deletePerformance(id) {
        try {
            await window.app.dbRun('DELETE FROM performances WHERE id = ?', [id]);
            await this.loadPerformances();
        } catch (error) {
            console.error('공연 삭제 실패:', error);
            window.app.alert('삭제 중 오류가 발생했습니다.');
        }
    }

    getPerformanceById(id) {
        return this.performances.find(p => p.id === id);
    }

    getAllPerformances() {
        return this.performances;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.performanceManager = new PerformanceManager();
});