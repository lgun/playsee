class VehicleManager {
    constructor() {
        this.vehicleTypes = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadVehicleTypes();
    }

    bindEvents() {
        document.getElementById('add-vehicle-type').addEventListener('click', () => {
            this.showAddVehicleTypeModal();
        });
    }

    async loadVehicleTypes() {
        try {
            const container = document.getElementById('vehicles-list');
            window.app.showLoading(container);

            this.vehicleTypes = await window.app.dbAll('SELECT * FROM vehicle_types ORDER BY created_at DESC');
            this.renderVehicleTypes();
        } catch (error) {
            console.error('차종 목록 로딩 실패:', error);
            const container = document.getElementById('vehicles-list');
            window.app.showError(container, '차종 목록을 불러오는데 실패했습니다.');
        }
    }

    renderVehicleTypes() {
        const container = document.getElementById('vehicles-list');
        
        if (this.vehicleTypes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>등록된 차종이 없습니다</h3>
                    <p>새 차종을 추가해주세요.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.vehicleTypes.map(vehicleType => `
            <div class="list-item vehicle-item" data-id="${vehicleType.id}">
                <div class="vehicle-header">
                    <h3 class="vehicle-name">${vehicleType.name}</h3>
                    <div class="vehicle-actions">
                        <button class="btn btn-secondary btn-sm edit-vehicle-type" data-id="${vehicleType.id}">수정</button>
                        <button class="btn btn-danger btn-sm delete-vehicle-type" data-id="${vehicleType.id}">삭제</button>
                    </div>
                </div>
                ${vehicleType.description ? `<div class="vehicle-description">${vehicleType.description}</div>` : ''}
                <div class="vehicle-meta">
                    <span class="created-date">등록일: ${window.app.formatDateTime(vehicleType.created_at)}</span>
                </div>
            </div>
        `).join('');

        this.bindVehicleTypeEvents();
    }

    bindVehicleTypeEvents() {
        const container = document.getElementById('vehicles-list');

        container.querySelectorAll('.edit-vehicle-type').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                this.showEditVehicleTypeModal(id);
            });
        });

        container.querySelectorAll('.delete-vehicle-type').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.dataset.id);
                const vehicleType = this.vehicleTypes.find(v => v.id === id);
                const confirmed = await window.app.confirm(`"${vehicleType.name}" 차종을 삭제하시겠습니까?`);
                if (confirmed) {
                    await this.deleteVehicleType(id);
                }
            });
        });
    }

    showAddVehicleTypeModal() {
        const modalContent = `
            <h3>차종 추가</h3>
            <form id="add-vehicle-type-form">
                <div class="form-group">
                    <label for="vehicle-type-name">차종명 *</label>
                    <input type="text" id="vehicle-type-name" required>
                </div>
                
                <div class="form-group">
                    <label for="vehicle-type-description">설명</label>
                    <textarea id="vehicle-type-description" placeholder="차종에 대한 설명"></textarea>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">추가</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);
        this.bindVehicleTypeFormEvents();
    }

    showEditVehicleTypeModal(id) {
        const vehicleType = this.vehicleTypes.find(v => v.id === id);
        if (!vehicleType) return;

        const modalContent = `
            <h3>차종 수정</h3>
            <form id="edit-vehicle-type-form" data-id="${vehicleType.id}">
                <div class="form-group">
                    <label for="vehicle-type-name">차종명 *</label>
                    <input type="text" id="vehicle-type-name" value="${vehicleType.name}" required>
                </div>
                
                <div class="form-group">
                    <label for="vehicle-type-description">설명</label>
                    <textarea id="vehicle-type-description" placeholder="차종에 대한 설명">${vehicleType.description || ''}</textarea>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">수정</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);
        this.bindVehicleTypeFormEvents();
    }

    bindVehicleTypeFormEvents() {
        const form = document.querySelector('#add-vehicle-type-form, #edit-vehicle-type-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('vehicle-type-name').value.trim();
            const description = document.getElementById('vehicle-type-description').value.trim();
            
            if (!name) {
                window.app.alert('차종명을 입력해주세요.');
                return;
            }

            try {
                if (form.id === 'add-vehicle-type-form') {
                    await this.addVehicleType(name, description);
                } else {
                    const id = parseInt(form.dataset.id);
                    await this.updateVehicleType(id, name, description);
                }
                window.app.closeModal();
                await this.loadVehicleTypes();
            } catch (error) {
                console.error('차종 저장 실패:', error);
                if (error.message.includes('UNIQUE constraint failed')) {
                    window.app.alert('이미 존재하는 차종명입니다.');
                } else {
                    window.app.alert('저장 중 오류가 발생했습니다.');
                }
            }
        });
    }

    async addVehicleType(name, description) {
        const sql = 'INSERT INTO vehicle_types (name, description) VALUES (?, ?)';
        const params = [name, description];
        
        return await window.app.dbRun(sql, params);
    }

    async updateVehicleType(id, name, description) {
        const sql = 'UPDATE vehicle_types SET name = ?, description = ? WHERE id = ?';
        const params = [name, description, id];
        
        return await window.app.dbRun(sql, params);
    }

    async deleteVehicleType(id) {
        try {
            // 사용 중인 차종인지 확인
            const usageCheck = await window.app.dbGet(`
                SELECT COUNT(*) as count 
                FROM schedule_vehicles sv 
                JOIN vehicle_types vt ON sv.vehicle_type = vt.name 
                WHERE vt.id = ?
            `, [id]);

            if (usageCheck.count > 0) {
                window.app.alert('현재 스케줄에서 사용 중인 차종은 삭제할 수 없습니다.');
                return;
            }

            await window.app.dbRun('DELETE FROM vehicle_types WHERE id = ?', [id]);
            await this.loadVehicleTypes();
        } catch (error) {
            console.error('차종 삭제 실패:', error);
            window.app.alert('삭제 중 오류가 발생했습니다.');
        }
    }

    getVehicleTypeById(id) {
        return this.vehicleTypes.find(v => v.id === id);
    }

    getAllVehicleTypes() {
        return this.vehicleTypes.filter(v => v.is_active);
    }

    async getActiveVehicleTypes() {
        return await window.app.dbAll('SELECT * FROM vehicle_types WHERE is_active = 1 ORDER BY name');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.vehicleManager = new VehicleManager();
});