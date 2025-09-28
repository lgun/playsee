class ScheduleManager {
    constructor() {
        this.schedules = [];
        this.performances = [];
        this.members = [];
        this.currentFilters = {
            startDate: null,
            endDate: null,
            status: 'all',
            venue: '',
            actor: 'all'
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupInitialFilters();
        this.setupKeyboardShortcuts();
        this.loadSchedules();
    }

    bindEvents() {
        document.getElementById('add-schedule').addEventListener('click', () => {
            this.showAddScheduleModal();
        });

        // 필터 이벤트
        document.getElementById('schedule-start-date').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('schedule-end-date').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('status-filter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('venue-filter').addEventListener('input', () => {
            this.applyFilters();
        });

        document.getElementById('actor-filter').addEventListener('change', () => {
            this.applyFilters();
        });

        // 빠른 필터 버튼
        document.getElementById('today-range-btn').addEventListener('click', () => {
            this.setTodayRange();
        });

        document.getElementById('month-range-btn').addEventListener('click', () => {
            this.setMonthRange();
        });
    }

    setupInitialFilters() {
        // 기본적으로 이번 달 1일~말일로 설정
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        document.getElementById('schedule-start-date').value = startOfMonth.toISOString().split('T')[0];
        document.getElementById('schedule-end-date').value = endOfMonth.toISOString().split('T')[0];
        
        this.currentFilters.startDate = startOfMonth.toISOString().split('T')[0];
        this.currentFilters.endDate = endOfMonth.toISOString().split('T')[0];
        this.currentFilters.venue = '';
        this.currentFilters.actor = 'all';
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+T: 오늘로 설정
            if (e.ctrlKey && e.key === 't') {
                e.preventDefault();
                this.setTodayRange();
            }
        });
    }

    setTodayRange() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('schedule-start-date').value = today;
        document.getElementById('schedule-end-date').value = today;
        this.applyFilters();
    }

    setMonthRange() {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        document.getElementById('schedule-start-date').value = startOfMonth.toISOString().split('T')[0];
        document.getElementById('schedule-end-date').value = endOfMonth.toISOString().split('T')[0];
        this.applyFilters();
    }

    applyFilters() {
        this.currentFilters.startDate = document.getElementById('schedule-start-date').value;
        this.currentFilters.endDate = document.getElementById('schedule-end-date').value;
        this.currentFilters.status = document.getElementById('status-filter').value;
        this.currentFilters.venue = document.getElementById('venue-filter').value.trim();
        this.currentFilters.actor = document.getElementById('actor-filter').value;
        
        this.loadSchedules();
    }

    async loadSchedules() {
        try {
            const container = document.getElementById('schedules-list');
            window.app.showLoading(container);

            // 필터 조건 생성
            let whereClause = 'WHERE 1=1';
            let params = [];

            if (this.currentFilters.startDate) {
                whereClause += ' AND date(s.call_time) >= ?';
                params.push(this.currentFilters.startDate);
            }

            if (this.currentFilters.endDate) {
                whereClause += ' AND date(s.call_time) <= ?';
                params.push(this.currentFilters.endDate);
            }

            if (this.currentFilters.status !== 'all') {
                whereClause += ' AND s.status = ?';
                params.push(this.currentFilters.status);
            }

            if (this.currentFilters.venue) {
                whereClause += ' AND s.venue LIKE ?';
                params.push(`%${this.currentFilters.venue}%`);
            }

            if (this.currentFilters.actor !== 'all') {
                whereClause += ' AND EXISTS (SELECT 1 FROM assignments a2 WHERE a2.schedule_id = s.id AND a2.member_id = ?)';
                params.push(this.currentFilters.actor);
            }

            this.schedules = await window.app.dbAll(`
                SELECT s.*, p.name as performance_name, p.roles as performance_roles,
                       GROUP_CONCAT(DISTINCT m.name || ':' || a.role) as assignments,
                       GROUP_CONCAT(DISTINCT sv.vehicle_type || ':' || COALESCE(driver.name, '')) as vehicle_info
                FROM schedules s
                LEFT JOIN performances p ON s.performance_id = p.id
                LEFT JOIN assignments a ON s.id = a.schedule_id
                LEFT JOIN members m ON a.member_id = m.id
                LEFT JOIN schedule_vehicles sv ON s.id = sv.schedule_id
                LEFT JOIN members driver ON sv.driver_id = driver.id
                ${whereClause}
                GROUP BY s.id
                ORDER BY s.call_time ASC
            `, params);

            this.performances = await window.app.dbAll('SELECT * FROM performances ORDER BY name');
            this.members = await window.app.dbAll('SELECT * FROM members ORDER BY name');
            
            // 배우 필터 옵션 업데이트
            this.updateActorFilterOptions();
            
            this.renderSchedules();
        } catch (error) {
            console.error('스케줄 목록 로딩 실패:', error);
            const container = document.getElementById('schedules-list');
            window.app.showError(container, '스케줄 목록을 불러오는데 실패했습니다.');
        }
    }

    updateActorFilterOptions() {
        const actorFilter = document.getElementById('actor-filter');
        const currentValue = actorFilter.value;
        
        // 기존 옵션 제거 (전체 옵션 제외)
        actorFilter.innerHTML = '<option value="all">전체</option>';
        
        // 배우 옵션 추가
        this.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            actorFilter.appendChild(option);
        });
        
        // 이전 선택값 복원
        if (currentValue && actorFilter.querySelector(`option[value="${currentValue}"]`)) {
            actorFilter.value = currentValue;
        }
    }

    renderSchedules() {
        const container = document.getElementById('schedules-list');

        if (this.schedules.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>스케줄이 없습니다</h3>
                    <p>선택한 기간과 조건에 해당하는 스케줄이 없습니다.</p>
                </div>
            `;
            return;
        }

        const scheduleHTML = this.schedules.map(schedule => {
            const status = schedule.status || 'pending';
            const statusText = {
                'pending': '미완료',
                'completed': '완료',
                'cancelled': '취소'
            }[status];

            const assignments = schedule.assignments ? 
                schedule.assignments.split(',').map(a => {
                    const [name, role] = a.split(':');
                    return `${name}(${role})`;
                }).join(', ') : '배정되지 않음';

            const equipmentList = schedule.equipment_list ? JSON.parse(schedule.equipment_list) : [];
            const equipmentStr = equipmentList.length > 0 ? equipmentList.join(', ') : '없음';

            return `
                <div class="schedule-item status-${status}">
                    <div class="schedule-header">
                        <h3 class="schedule-title">${schedule.performance_name}</h3>
                        <span class="schedule-status ${status}">${statusText}</span>
                    </div>
                    
                    <div class="schedule-info">
                        <div class="info-row">
                            <div class="info-group">
                                <div class="info-item">
                                    <strong>날짜:</strong> ${window.app.formatDate(schedule.call_time)}
                                </div>
                                <div class="info-item">
                                    <strong>콜타임:</strong> ${window.app.formatTime(schedule.call_time)}
                                </div>
                                <div class="info-item">
                                    <strong>스타트타임:</strong> ${window.app.formatTime(schedule.start_time)}
                                </div>
                            </div>
                            
                            <div class="info-group">
                                <div class="info-item">
                                    <strong>장소:</strong> ${schedule.venue}
                                </div>
                                <div class="info-item">
                                    <strong>차량:</strong> ${schedule.vehicle_type || '미정'}
                                </div>
                            </div>
                        </div>
                        
                        <div class="info-row">
                            <div class="info-group">
                                <div class="info-item">
                                    <strong>준비물품:</strong> ${equipmentStr}
                                </div>
                            </div>
                        </div>
                        
                        <div class="info-row">
                            <div class="info-group">
                                <div class="info-item">
                                    <strong>배정된 배우:</strong> ${assignments}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="schedule-actions">
                        <div class="status-buttons">
                            <button class="status-btn pending ${status === 'pending' ? 'active' : ''}" 
                                    data-schedule-id="${schedule.id}" data-status="pending">
                                미완료
                            </button>
                            <button class="status-btn completed ${status === 'completed' ? 'active' : ''}" 
                                    data-schedule-id="${schedule.id}" data-status="completed">
                                완료
                            </button>
                            <button class="status-btn cancelled ${status === 'cancelled' ? 'active' : ''}" 
                                    data-schedule-id="${schedule.id}" data-status="cancelled">
                                취소
                            </button>
                        </div>
                        
                        <div class="action-buttons">
                            <button class="btn btn-success btn-sm" onclick="window.scheduleManager.showManualAssignModal(${schedule.id})">
                                배정
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="window.scheduleManager.showEditScheduleModal(${schedule.id})">
                                수정
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="window.scheduleManager.deleteSchedule(${schedule.id})">
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = scheduleHTML;

        // 상태 버튼 이벤트 바인딩
        container.querySelectorAll('.status-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const scheduleId = parseInt(e.target.dataset.scheduleId);
                const newStatus = e.target.dataset.status;
                const currentStatus = e.target.classList.contains('active');
                
                // 이미 활성화된 상태를 다시 누르면 무시
                if (currentStatus) return;
                
                await this.updateScheduleStatus(scheduleId, newStatus);
            });
        });
    }

    async updateScheduleStatus(scheduleId, status) {
        try {
            // 버튼 상태를 먼저 즉시 업데이트 (UI 반응성)
            this.updateStatusButtonsUI(scheduleId, status);
            
            // 데이터베이스 업데이트
            await window.app.dbRun(
                'UPDATE schedules SET status = ? WHERE id = ?',
                [status, scheduleId]
            );
            
            // 메모리의 스케줄 데이터도 즉시 업데이트
            const schedule = this.schedules.find(s => s.id === scheduleId);
            if (schedule) {
                schedule.status = status;
                // 스케줄 아이템의 상태 클래스도 업데이트
                this.updateScheduleItemClass(scheduleId, status);
            }
            
            // 캘린더도 새로고침
            if (window.calendar) {
                await window.calendar.refresh();
            }
            
            console.log(`스케줄 ${scheduleId} 상태를 ${status}로 변경했습니다.`);
        } catch (error) {
            console.error('스케줄 상태 업데이트 실패:', error);
            await window.app.alert('상태 업데이트에 실패했습니다.');
            // 원래 상태로 되돌리기
            this.loadSchedules();
        }
    }

    updateStatusButtonsUI(scheduleId, newStatus) {
        // 해당 스케줄의 모든 상태 버튼 찾기
        const statusButtons = document.querySelectorAll(`[data-schedule-id="${scheduleId}"].status-btn`);
        
        statusButtons.forEach(btn => {
            if (btn.dataset.status === newStatus) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    updateScheduleItemClass(scheduleId, newStatus) {
        // 스케줄 아이템 찾기
        const scheduleItem = document.querySelector(`[data-schedule-id="${scheduleId}"]`).closest('.schedule-item');
        if (scheduleItem) {
            // 기존 상태 클래스 제거
            scheduleItem.classList.remove('status-pending', 'status-completed', 'status-cancelled');
            // 새 상태 클래스 추가
            scheduleItem.classList.add(`status-${newStatus}`);
            
            // 상태 표시 텍스트도 업데이트
            const statusSpan = scheduleItem.querySelector('.schedule-status');
            if (statusSpan) {
                const statusText = {
                    'pending': '미완료',
                    'completed': '완료',
                    'cancelled': '취소'
                }[newStatus];
                
                statusSpan.textContent = statusText;
                statusSpan.className = `schedule-status ${newStatus}`;
            }
        }
    }

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

    async showAddScheduleModal() {
        const performanceOptions = this.performances.map(perf => 
            `<option value="${perf.id}">${perf.name}</option>`
        ).join('');

        const memberOptions = this.members.map(member => 
            `<option value="${member.id}">${member.name}</option>`
        ).join('');

        // 동적으로 물품 목록 가져오기
        const equipmentList = await this.getActiveEquipment();
        const equipmentCheckboxes = equipmentList.map(item => `
            <label><input type="checkbox" name="equipment" value="${item.name}"> ${item.name}</label>
        `).join('');

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
                    <label>준비 물품</label>
                    <div class="checkbox-group">
                        ${equipmentCheckboxes}
                    </div>
                    ${equipmentList.length === 0 ? '<p class="text-muted">등록된 물품이 없습니다. <a href="#" onclick="window.app.showView(\'equipment\'); window.app.closeModal();">물품 관리</a>에서 물품을 추가해주세요.</p>' : ''}
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

    async showEditScheduleModal(id) {
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
        
        // 동적으로 물품 목록 가져오기
        const activeEquipment = await this.getActiveEquipment();
        const equipmentCheckboxes = activeEquipment.map(item => `
            <label><input type="checkbox" name="equipment" value="${item.name}" ${equipmentList.includes(item.name) ? 'checked' : ''}> ${item.name}</label>
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

        // 해당 공연에 참여 가능한 단원들을 조회
        const eligibleMembers = await window.app.dbAll(`
            SELECT m.*, mp.available_roles 
            FROM members m
            LEFT JOIN member_performances mp ON m.id = mp.member_id AND mp.performance_id = ?
            WHERE mp.member_id IS NOT NULL
            ORDER BY m.name
        `, [performance.id]);

        console.log('Eligible members:', eligibleMembers);
        console.log('Performance roles:', roles);

        // 만약 해당 공연에 참여 가능한 단원이 없다면, 모든 단원을 보여줌
        let allMembers = eligibleMembers;
        if (eligibleMembers.length === 0) {
            allMembers = await window.app.dbAll(`
                SELECT * FROM members ORDER BY name
            `);
        }

        const roleSelects = roles.map(role => {
            const currentAssignment = currentAssignments.find(a => a.role === role);
            let memberOptions;
            
            if (eligibleMembers.length > 0) {
                // 공연별 가능한 역할이 설정된 경우
                memberOptions = eligibleMembers
                    .filter(member => {
                        const availableRoles = JSON.parse(member.available_roles || '[]');
                        return availableRoles.includes(role);
                    })
                    .map(member => 
                        `<option value="${member.id}" ${member.id == currentAssignment?.member_id ? 'selected' : ''}>${member.name}</option>`
                    ).join('');
            } else {
                // 공연별 가능한 역할이 설정되지 않은 경우 모든 단원을 보여줌
                memberOptions = allMembers
                    .map(member => 
                        `<option value="${member.id}" ${member.id == currentAssignment?.member_id ? 'selected' : ''}>${member.name}</option>`
                    ).join('');
            }

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

        // 현재 설정된 차량들 조회
        const currentVehicles = await window.app.dbAll(
            'SELECT * FROM schedule_vehicles WHERE schedule_id = ?',
            [scheduleId]
        );

        const modalContent = `
            <h3>수동 배정 - ${schedule.performance_name}</h3>
            <p><strong>일시:</strong> ${window.app.formatDateTime(schedule.call_time)} (콜) / ${window.app.formatDateTime(schedule.start_time)} (시작)</p>
            <p><strong>장소:</strong> ${schedule.venue}</p>
            
            <form id="manual-assign-form" data-schedule-id="${scheduleId}">
                <div class="assignment-section">
                    <h4>배우 배정</h4>
                    ${roleSelects}
                </div>

                <div class="assignment-section">
                    <h4>차량 및 운전자 배정</h4>
                    <div id="vehicle-assignments">
                        ${this.generateVehicleAssignments(currentVehicles)}
                    </div>
                    <button type="button" id="add-vehicle-btn" class="btn btn-secondary btn-sm">차량 추가</button>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">배정 저장</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);

        // 차량 추가 버튼 이벤트
        document.getElementById('add-vehicle-btn').addEventListener('click', () => {
            const vehicleContainer = document.getElementById('vehicle-assignments');
            const vehicleCount = vehicleContainer.children.length;
            const newVehicleHTML = this.generateVehicleAssignment(null, vehicleCount);
            vehicleContainer.insertAdjacentHTML('beforeend', newVehicleHTML);
            this.bindVehicleRemoveEvent();
        });

        this.bindVehicleRemoveEvent();

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

            // 차량 정보 수집
            const vehicles = [];
            const vehicleAssignments = document.querySelectorAll('.vehicle-assignment');
            vehicleAssignments.forEach((div, index) => {
                const vehicleType = div.querySelector(`[name="vehicle-type-${index}"]`).value;
                const driverId = div.querySelector(`[name="driver-${index}"]`).value || null;
                
                if (vehicleType) {
                    vehicles.push({
                        vehicleType: vehicleType,
                        driverId: driverId ? parseInt(driverId) : null
                    });
                }
            });

            try {
                await this.saveManualAssignments(scheduleId, assignments, vehicles);
                window.app.closeModal();
                await this.loadSchedules();
                
                // 단원 목록 갱신 (공연 횟수 업데이트)
                if (window.memberManager) {
                    await window.memberManager.loadMembers();
                }
            } catch (error) {
                console.error('수동 배정 저장 실패:', error);
                window.app.alert('배정 저장 중 오류가 발생했습니다.');
            }
        });
    }

    generateVehicleAssignments(currentVehicles) {
        if (currentVehicles.length === 0) {
            return this.generateVehicleAssignment(null, 0);
        }
        
        return currentVehicles.map((vehicle, index) => 
            this.generateVehicleAssignment(vehicle, index)
        ).join('');
    }

    generateVehicleAssignment(vehicle, index) {
        const memberOptions = this.members.map(member => 
            `<option value="${member.id}" ${vehicle && member.id == vehicle.driver_id ? 'selected' : ''}>${member.name}</option>`
        ).join('');

        return `
            <div class="vehicle-assignment" data-index="${index}">
                <div class="vehicle-row">
                    <div class="form-group-inline">
                        <label>차종:</label>
                        <select name="vehicle-type-${index}" required>
                            <option value="">차종 선택</option>
                            <option value="스타렉스" ${vehicle && vehicle.vehicle_type === '스타렉스' ? 'selected' : ''}>스타렉스</option>
                            <option value="카니발" ${vehicle && vehicle.vehicle_type === '카니발' ? 'selected' : ''}>카니발</option>
                            <option value="카니발 2" ${vehicle && vehicle.vehicle_type === '카니발 2' ? 'selected' : ''}>카니발 2</option>
                            <option value="그외" ${vehicle && vehicle.vehicle_type === '그외' ? 'selected' : ''}>그외</option>
                        </select>
                    </div>
                    <div class="form-group-inline">
                        <label>운전자:</label>
                        <select name="driver-${index}">
                            <option value="">운전자 선택</option>
                            ${memberOptions}
                        </select>
                    </div>
                    <button type="button" class="btn btn-danger btn-sm remove-vehicle" data-index="${index}">제거</button>
                </div>
            </div>
        `;
    }

    bindVehicleRemoveEvent() {
        document.querySelectorAll('.remove-vehicle').forEach(btn => {
            btn.removeEventListener('click', this.removeVehicleHandler);
            btn.addEventListener('click', this.removeVehicleHandler);
        });
    }

    removeVehicleHandler = (e) => {
        const vehicleDiv = e.target.closest('.vehicle-assignment');
        vehicleDiv.remove();
        
        // 인덱스 재정렬
        const vehicleAssignments = document.querySelectorAll('.vehicle-assignment');
        vehicleAssignments.forEach((div, newIndex) => {
            div.dataset.index = newIndex;
            div.querySelector('[name^="vehicle-type-"]').name = `vehicle-type-${newIndex}`;
            div.querySelector('[name^="driver-"]').name = `driver-${newIndex}`;
            div.querySelector('.remove-vehicle').dataset.index = newIndex;
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
                    await this.addSchedule(performanceId, callTime, startTime, venue, equipmentList);
                } else {
                    const id = parseInt(form.dataset.id);
                    await this.updateSchedule(id, performanceId, callTime, startTime, venue, equipmentList);
                }
                window.app.closeModal();
                await this.loadSchedules();
                
                // 단원 목록 갱신 (공연 횟수 업데이트)
                if (window.memberManager) {
                    await window.memberManager.loadMembers();
                }
            } catch (error) {
                console.error('스케줄 저장 실패:', error);
                window.app.alert('저장 중 오류가 발생했습니다.');
            }
        });
    }

    async saveManualAssignments(scheduleId, assignments, vehicles = []) {
        // 기존 배정 삭제
        await window.app.dbRun('DELETE FROM assignments WHERE schedule_id = ?', [scheduleId]);
        
        // 기존 차량 정보 삭제
        await window.app.dbRun('DELETE FROM schedule_vehicles WHERE schedule_id = ?', [scheduleId]);
        
        // 새 배정 저장
        for (const assignment of assignments) {
            await window.app.dbRun(
                'INSERT INTO assignments (schedule_id, member_id, role, is_manual) VALUES (?, ?, ?, 1)',
                [scheduleId, assignment.memberId, assignment.role]
            );
        }
        
        // 새 차량 정보 저장
        for (const vehicle of vehicles) {
            await window.app.dbRun(
                'INSERT INTO schedule_vehicles (schedule_id, vehicle_type, driver_id) VALUES (?, ?, ?)',
                [scheduleId, vehicle.vehicleType, vehicle.driverId]
            );
        }
    }

    async addSchedule(performanceId, callTime, startTime, venue, equipmentList) {
        const sql = 'INSERT INTO schedules (performance_id, call_time, start_time, venue, equipment_list) VALUES (?, ?, ?, ?, ?)';
        const params = [performanceId, callTime, startTime, venue, JSON.stringify(equipmentList)];
        
        return await window.app.dbRun(sql, params);
    }

    async updateSchedule(id, performanceId, callTime, startTime, venue, equipmentList) {
        const sql = 'UPDATE schedules SET performance_id = ?, call_time = ?, start_time = ?, venue = ?, equipment_list = ? WHERE id = ?';
        const params = [performanceId, callTime, startTime, venue, JSON.stringify(equipmentList), id];
        
        return await window.app.dbRun(sql, params);
    }

    async deleteSchedule(id) {
        try {
            await window.app.dbRun('DELETE FROM schedules WHERE id = ?', [id]);
            await this.loadSchedules();
            
            // 단원 목록 갱신 (공연 횟수 업데이트)
            if (window.memberManager) {
                await window.memberManager.loadMembers();
            }
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