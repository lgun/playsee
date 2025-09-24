class ScheduleManager {
    constructor() {
        this.schedules = [];
        this.performances = [];
        this.members = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSchedules();
    }

    bindEvents() {
        document.getElementById('add-schedule').addEventListener('click', () => {
            this.showAddScheduleModal();
        });
    }

    async loadSchedules() {
        try {
            const container = document.getElementById('schedules-list');
            window.app.showLoading(container);

            this.schedules = await window.app.dbAll(`
                SELECT s.*, p.name as performance_name, p.roles as performance_roles,
                       GROUP_CONCAT(DISTINCT m.name || ':' || a.role) as assignments,
                       driver.name as driver_name
                FROM schedules s
                LEFT JOIN performances p ON s.performance_id = p.id
                LEFT JOIN assignments a ON s.id = a.schedule_id
                LEFT JOIN members m ON a.member_id = m.id
                LEFT JOIN members driver ON s.driver_id = driver.id
                GROUP BY s.id
                ORDER BY s.call_time DESC
            `);

            this.performances = await window.app.dbAll('SELECT * FROM performances ORDER BY name');
            this.members = await window.app.dbAll('SELECT * FROM members ORDER BY name');
            
            this.renderSchedules();
        } catch (error) {
            console.error('스케줄 목록 로딩 실패:', error);
            const container = document.getElementById('schedules-list');
            window.app.showError(container, '스케줄 목록을 불러오는데 실패했습니다.');
        }
    }

    renderSchedules() {
        const container = document.getElementById('schedules-list');
        
        if (this.schedules.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>등록된 스케줄이 없습니다</h3>
                    <p>새 스케줄을 추가해주세요.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.schedules.map(schedule => {
            const assignments = schedule.assignments ? 
                schedule.assignments.split(',').map(a => {
                    const [name, role] = a.split(':');
                    return `${name}(${role})`;
                }).join(', ') : '배정되지 않음';

            const equipmentList = schedule.equipment_list ? JSON.parse(schedule.equipment_list) : [];
            const equipmentStr = equipmentList.length > 0 ? equipmentList.join(', ') : '없음';

            return `
                <div class="list-item" data-id="${schedule.id}">
                    <h3>${schedule.performance_name}</h3>
                    <p><strong>콜타임:</strong> ${window.app.formatDateTime(schedule.call_time)}</p>
                    <p><strong>스타트타임:</strong> ${window.app.formatDateTime(schedule.start_time)}</p>
                    <p><strong>장소:</strong> ${schedule.venue}</p>
                    <p><strong>배정된 배우:</strong> ${assignments}</p>
                    <p><strong>운전자:</strong> ${schedule.driver_name || '미정'}</p>
                    <p><strong>차종:</strong> ${schedule.vehicle_type || '미정'}</p>
                    <p><strong>준비물품:</strong> ${equipmentStr}</p>
                    <p><strong>등록일:</strong> ${window.app.formatDateTime(schedule.created_at)}</p>
                    <div class="actions">
                        <button class="btn btn-success assign-manual" data-id="${schedule.id}">수동 배정</button>
                        <button class="btn btn-secondary edit-schedule" data-id="${schedule.id}">수정</button>
                        <button class="btn btn-danger delete-schedule" data-id="${schedule.id}">삭제</button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.assign-manual').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.showManualAssignModal(parseInt(id));
            });
        });

        container.querySelectorAll('.edit-schedule').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.showEditScheduleModal(parseInt(id));
            });
        });

        container.querySelectorAll('.delete-schedule').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const schedule = this.schedules.find(s => s.id == id);
                const confirmed = await window.app.confirm(`${schedule.performance_name} 스케줄을 삭제하시겠습니까?`);
                if (confirmed) {
                    await this.deleteSchedule(parseInt(id));
                }
            });
        });
    }

    showAddScheduleModal() {
        const performanceOptions = this.performances.map(perf => 
            `<option value="${perf.id}">${perf.name}</option>`
        ).join('');

        const memberOptions = this.members.map(member => 
            `<option value="${member.id}">${member.name}</option>`
        ).join('');

        const modalContent = `
            <h3>스케줄 추가</h3>
            <form id="add-schedule-form">
                <div class="form-group">
                    <label for="performance-select">공연 선택 *</label>
                    <select id="performance-select" required>
                        <option value="">공연을 선택하세요</option>
                        ${performanceOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label for="schedule-date">공연 날짜 *</label>
                    <input type="date" id="schedule-date" required>
                </div>

                <div class="form-group">
                    <label for="call-time">콜타임 *</label>
                    <input type="time" id="call-time" required>
                </div>

                <div class="form-group">
                    <label for="start-time">스타트타임 *</label>
                    <input type="time" id="start-time" required>
                </div>

                <div class="form-group">
                    <label for="venue">장소 *</label>
                    <input type="text" id="venue" required>
                </div>

                <div class="form-group">
                    <label for="driver-select">운전자</label>
                    <select id="driver-select">
                        <option value="">운전자를 선택하세요</option>
                        ${memberOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label for="vehicle-select">차종</label>
                    <select id="vehicle-select">
                        <option value="">차종을 선택하세요</option>
                        <option value="스타렉스">스타렉스</option>
                        <option value="카니발">카니발</option>
                        <option value="카니발 2">카니발 2</option>
                        <option value="그외">그외</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>준비 물품</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" name="equipment" value="스피커(대) 2세트"> 스피커(대) 2세트</label>
                        <label><input type="checkbox" name="equipment" value="스탠드스피커"> 스탠드스피커</label>
                        <label><input type="checkbox" name="equipment" value="스피커(소) 1세트"> 스피커(소) 1세트</label>
                        <label><input type="checkbox" name="equipment" value="조명 2세트"> 조명 2세트</label>
                        <label><input type="checkbox" name="equipment" value="무빙"> 무빙</label>
                        <label><input type="checkbox" name="equipment" value="레이저"> 레이저</label>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">추가</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);
        this.bindScheduleFormEvents();
    }

    showEditScheduleModal(id) {
        const schedule = this.schedules.find(s => s.id === id);
        if (!schedule) return;

        const performanceOptions = this.performances.map(perf => 
            `<option value="${perf.id}" ${perf.id == schedule.performance_id ? 'selected' : ''}>${perf.name}</option>`
        ).join('');

        const memberOptions = this.members.map(member => 
            `<option value="${member.id}" ${member.id == schedule.driver_id ? 'selected' : ''}>${member.name}</option>`
        ).join('');

        const callTimeDate = new Date(schedule.call_time);
        const startTimeDate = new Date(schedule.start_time);
        const scheduleDateStr = callTimeDate.toISOString().split('T')[0];
        const callTimeStr = callTimeDate.toTimeString().slice(0, 5);
        const startTimeStr = startTimeDate.toTimeString().slice(0, 5);

        const equipmentList = schedule.equipment_list ? JSON.parse(schedule.equipment_list) : [];
        const equipmentCheckboxes = [
            '스피커(대) 2세트', '스탠드스피커', '스피커(소) 1세트', 
            '조명 2세트', '무빙', '레이저'
        ].map(item => `
            <label><input type="checkbox" name="equipment" value="${item}" ${equipmentList.includes(item) ? 'checked' : ''}> ${item}</label>
        `).join('');

        const modalContent = `
            <h3>스케줄 수정</h3>
            <form id="edit-schedule-form" data-id="${schedule.id}">
                <div class="form-group">
                    <label for="performance-select">공연 선택 *</label>
                    <select id="performance-select" required>
                        <option value="">공연을 선택하세요</option>
                        ${performanceOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label for="schedule-date">공연 날짜 *</label>
                    <input type="date" id="schedule-date" value="${scheduleDateStr}" required>
                </div>

                <div class="form-group">
                    <label for="call-time">콜타임 *</label>
                    <input type="time" id="call-time" value="${callTimeStr}" required>
                </div>

                <div class="form-group">
                    <label for="start-time">스타트타임 *</label>
                    <input type="time" id="start-time" value="${startTimeStr}" required>
                </div>

                <div class="form-group">
                    <label for="venue">장소 *</label>
                    <input type="text" id="venue" value="${schedule.venue}" required>
                </div>

                <div class="form-group">
                    <label for="driver-select">운전자</label>
                    <select id="driver-select">
                        <option value="">운전자를 선택하세요</option>
                        ${memberOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label for="vehicle-select">차종</label>
                    <select id="vehicle-select">
                        <option value="">차종을 선택하세요</option>
                        <option value="스타렉스" ${schedule.vehicle_type === '스타렉스' ? 'selected' : ''}>스타렉스</option>
                        <option value="카니발" ${schedule.vehicle_type === '카니발' ? 'selected' : ''}>카니발</option>
                        <option value="카니발 2" ${schedule.vehicle_type === '카니발 2' ? 'selected' : ''}>카니발 2</option>
                        <option value="그외" ${schedule.vehicle_type === '그외' ? 'selected' : ''}>그외</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>준비 물품</label>
                    <div class="checkbox-group">
                        ${equipmentCheckboxes}
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">수정</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);
        this.bindScheduleFormEvents();
    }

    async showManualAssignModal(scheduleId) {
        const schedule = this.schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        const performance = this.performances.find(p => p.id === schedule.performance_id);
        if (!performance) return;

        const roles = JSON.parse(performance.roles || '[]');
        const currentAssignments = await window.app.dbAll(
            'SELECT * FROM assignments WHERE schedule_id = ?',
            [scheduleId]
        );

        const eligibleMembers = await window.app.dbAll(`
            SELECT m.*, mp.available_roles 
            FROM members m
            LEFT JOIN member_performances mp ON m.id = mp.member_id AND mp.performance_id = ?
            WHERE mp.member_id IS NOT NULL
            ORDER BY m.name
        `, [performance.id]);

        const roleSelects = roles.map(role => {
            const currentAssignment = currentAssignments.find(a => a.role === role);
            const memberOptions = eligibleMembers
                .filter(member => {
                    const availableRoles = JSON.parse(member.available_roles || '[]');
                    return availableRoles.includes(role);
                })
                .map(member => 
                    `<option value="${member.id}" ${member.id == currentAssignment?.member_id ? 'selected' : ''}>${member.name}</option>`
                ).join('');

            return `
                <div class="form-group">
                    <label for="role-${role}">${role}</label>
                    <select id="role-${role}" data-role="${role}">
                        <option value="">선택 안함</option>
                        ${memberOptions}
                    </select>
                </div>
            `;
        }).join('');

        const modalContent = `
            <h3>수동 배정 - ${schedule.performance_name}</h3>
            <p><strong>일시:</strong> ${window.app.formatDateTime(schedule.call_time)} (콜) / ${window.app.formatDateTime(schedule.start_time)} (시작)</p>
            <p><strong>장소:</strong> ${schedule.venue}</p>
            
            <form id="manual-assign-form" data-schedule-id="${scheduleId}">
                ${roleSelects}

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">배정 저장</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);

        document.getElementById('manual-assign-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const assignments = [];
            roles.forEach(role => {
                const select = document.getElementById(`role-${role}`);
                if (select.value) {
                    assignments.push({
                        role: role,
                        memberId: parseInt(select.value)
                    });
                }
            });

            try {
                await this.saveManualAssignments(scheduleId, assignments);
                window.app.closeModal();
                await this.loadSchedules();
            } catch (error) {
                console.error('수동 배정 저장 실패:', error);
                window.app.alert('배정 저장 중 오류가 발생했습니다.');
            }
        });
    }

    bindScheduleFormEvents() {
        const form = document.querySelector('#add-schedule-form, #edit-schedule-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const performanceId = document.getElementById('performance-select').value;
            const scheduleDate = document.getElementById('schedule-date').value;
            const callTimeStr = document.getElementById('call-time').value;
            const startTimeStr = document.getElementById('start-time').value;
            const venue = document.getElementById('venue').value.trim();
            
            // 날짜와 시간을 합쳐서 datetime 생성
            const callTime = `${scheduleDate}T${callTimeStr}`;
            const startTime = `${scheduleDate}T${startTimeStr}`;
            const driverId = document.getElementById('driver-select').value || null;
            const vehicleType = document.getElementById('vehicle-select').value || null;
            
            // 체크된 장비들 수집
            const equipmentCheckboxes = document.querySelectorAll('input[name="equipment"]:checked');
            const equipmentList = Array.from(equipmentCheckboxes).map(cb => cb.value);
            
            if (!performanceId || !scheduleDate || !callTimeStr || !startTimeStr || !venue) {
                window.app.alert('모든 필드를 입력해주세요.');
                return;
            }

            if (new Date(callTime) >= new Date(startTime)) {
                window.app.alert('콜타임은 스타트타임보다 이전이어야 합니다.');
                return;
            }

            try {
                if (form.id === 'add-schedule-form') {
                    await this.addSchedule(performanceId, callTime, startTime, venue, driverId, vehicleType, equipmentList);
                } else {
                    const id = parseInt(form.dataset.id);
                    await this.updateSchedule(id, performanceId, callTime, startTime, venue, driverId, vehicleType, equipmentList);
                }
                window.app.closeModal();
                await this.loadSchedules();
            } catch (error) {
                console.error('스케줄 저장 실패:', error);
                window.app.alert('저장 중 오류가 발생했습니다.');
            }
        });
    }

    async saveManualAssignments(scheduleId, assignments) {
        await window.app.dbRun('DELETE FROM assignments WHERE schedule_id = ?', [scheduleId]);
        
        for (const assignment of assignments) {
            await window.app.dbRun(
                'INSERT INTO assignments (schedule_id, member_id, role, is_manual) VALUES (?, ?, ?, 1)',
                [scheduleId, assignment.memberId, assignment.role]
            );
        }
    }

    async addSchedule(performanceId, callTime, startTime, venue, driverId, vehicleType, equipmentList) {
        const sql = 'INSERT INTO schedules (performance_id, call_time, start_time, venue, driver_id, vehicle_type, equipment_list) VALUES (?, ?, ?, ?, ?, ?, ?)';
        const params = [performanceId, callTime, startTime, venue, driverId, vehicleType, JSON.stringify(equipmentList)];
        
        return await window.app.dbRun(sql, params);
    }

    async updateSchedule(id, performanceId, callTime, startTime, venue, driverId, vehicleType, equipmentList) {
        const sql = 'UPDATE schedules SET performance_id = ?, call_time = ?, start_time = ?, venue = ?, driver_id = ?, vehicle_type = ?, equipment_list = ? WHERE id = ?';
        const params = [performanceId, callTime, startTime, venue, driverId, vehicleType, JSON.stringify(equipmentList), id];
        
        return await window.app.dbRun(sql, params);
    }

    async deleteSchedule(id) {
        try {
            await window.app.dbRun('DELETE FROM schedules WHERE id = ?', [id]);
            await this.loadSchedules();
        } catch (error) {
            console.error('스케줄 삭제 실패:', error);
            window.app.alert('삭제 중 오류가 발생했습니다.');
        }
    }

    getScheduleById(id) {
        return this.schedules.find(s => s.id === id);
    }

    getAllSchedules() {
        return this.schedules;
    }

    getSchedulesByMonth(year, month) {
        return this.schedules.filter(schedule => {
            const scheduleDate = new Date(schedule.call_time);
            return scheduleDate.getFullYear() === year && scheduleDate.getMonth() === month;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.scheduleManager = new ScheduleManager();
});