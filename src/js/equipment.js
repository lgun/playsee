class EquipmentManager {
    constructor() {
        this.equipment = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadEquipment();
    }

    bindEvents() {
        document.getElementById('add-equipment').addEventListener('click', () => {
            this.showAddEquipmentModal();
        });
    }

    async loadEquipment() {
        try {
            const container = document.getElementById('equipment-list');
            window.app.showLoading(container);

            this.equipment = await window.app.dbAll(`
                SELECT * FROM equipment 
                WHERE is_active = 1 
                ORDER BY name
            `);

            this.renderEquipment();
        } catch (error) {
            console.error('물품 목록 로딩 실패:', error);
            const container = document.getElementById('equipment-list');
            window.app.showError(container, '물품 목록을 불러오는데 실패했습니다.');
        }
    }

    renderEquipment() {
        const container = document.getElementById('equipment-list');

        if (this.equipment.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>등록된 물품이 없습니다</h3>
                    <p>새 물품을 추가해주세요.</p>
                </div>
            `;
            return;
        }

        const equipmentHTML = this.equipment.map(equipment => `
            <div class="equipment-item" data-id="${equipment.id}">
                <div class="equipment-header">
                    <h3 class="equipment-name">${equipment.name}</h3>
                    <div class="equipment-actions">
                        <button class="btn btn-secondary btn-sm" onclick="window.equipmentManager.showEditEquipmentModal(${equipment.id})">
                            수정
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="window.equipmentManager.deleteEquipment(${equipment.id})">
                            삭제
                        </button>
                    </div>
                </div>
                
                ${equipment.description ? `
                    <div class="equipment-description">
                        <strong>설명:</strong> ${equipment.description}
                    </div>
                ` : ''}
                
                <div class="equipment-meta">
                    <span class="created-date">등록일: ${window.app.formatDate(equipment.created_at)}</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = equipmentHTML;
    }

    showAddEquipmentModal() {
        const modalContent = `
            <h3>물품 추가</h3>
            <form id="add-equipment-form">
                <div class="form-group">
                    <label for="equipment-name">물품명 *</label>
                    <input type="text" id="equipment-name" required placeholder="예: 스피커(대) 2세트">
                </div>

                <div class="form-group">
                    <label for="equipment-description">설명</label>
                    <textarea id="equipment-description" rows="3" placeholder="물품에 대한 설명을 입력하세요"></textarea>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">추가</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);
        this.bindEquipmentFormEvents();
    }

    showEditEquipmentModal(id) {
        const equipment = this.equipment.find(e => e.id === id);
        if (!equipment) return;

        const modalContent = `
            <h3>물품 수정</h3>
            <form id="edit-equipment-form">
                <div class="form-group">
                    <label for="equipment-name">물품명 *</label>
                    <input type="text" id="equipment-name" required value="${equipment.name}">
                </div>

                <div class="form-group">
                    <label for="equipment-description">설명</label>
                    <textarea id="equipment-description" rows="3">${equipment.description || ''}</textarea>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">수정</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);
        this.bindEquipmentFormEvents(id);
    }

    bindEquipmentFormEvents(equipmentId = null) {
        const form = document.getElementById(equipmentId ? 'edit-equipment-form' : 'add-equipment-form');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('equipment-name').value.trim();
            const description = document.getElementById('equipment-description').value.trim();

            if (!name) {
                await window.app.alert('물품명을 입력해주세요.');
                return;
            }

            try {
                if (equipmentId) {
                    await this.updateEquipment(equipmentId, name, description);
                } else {
                    await this.addEquipment(name, description);
                }
                
                window.app.closeModal();
                await this.loadEquipment();
            } catch (error) {
                console.error('물품 저장 실패:', error);
                await window.app.alert('물품 저장에 실패했습니다.');
            }
        });
    }

    async addEquipment(name, description) {
        try {
            await window.app.dbRun(
                'INSERT INTO equipment (name, description) VALUES (?, ?)',
                [name, description]
            );
            
            console.log(`물품 '${name}' 추가 완료`);
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('이미 등록된 물품명입니다.');
            }
            throw error;
        }
    }

    async updateEquipment(id, name, description) {
        try {
            await window.app.dbRun(
                'UPDATE equipment SET name = ?, description = ? WHERE id = ?',
                [name, description, id]
            );
            
            console.log(`물품 수정 완료: ${name}`);
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('이미 등록된 물품명입니다.');
            }
            throw error;
        }
    }

    async deleteEquipment(id) {
        const equipment = this.equipment.find(e => e.id === id);
        if (!equipment) return;

        const confirmed = await window.app.confirm(`'${equipment.name}' 물품을 삭제하시겠습니까?`);
        if (!confirmed) return;

        try {
            // 물리적 삭제 대신 비활성화
            await window.app.dbRun(
                'UPDATE equipment SET is_active = 0 WHERE id = ?',
                [id]
            );

            console.log(`물품 '${equipment.name}' 삭제 완료`);
            await this.loadEquipment();
        } catch (error) {
            console.error('물품 삭제 실패:', error);
            await window.app.alert('물품 삭제에 실패했습니다.');
        }
    }

    // 다른 모듈에서 사용할 수 있는 메서드
    async getActiveEquipment() {
        try {
            return await window.app.dbAll(`
                SELECT * FROM equipment 
                WHERE is_active = 1 
                ORDER BY name
            `);
        } catch (error) {
            console.error('활성 물품 목록 조회 실패:', error);
            return [];
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.equipmentManager = new EquipmentManager();
});