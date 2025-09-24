class MemberManager {
    constructor() {
        this.members = [];
        this.performances = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadMembers();
    }

    bindEvents() {
        document.getElementById('add-member').addEventListener('click', () => {
            this.showAddMemberModal();
        });
    }

    async loadMembers() {
        try {
            const container = document.getElementById('members-list');
            window.app.showLoading(container);

            this.members = await window.app.dbAll(`
                SELECT m.*, GROUP_CONCAT(mp.performance_id) as performance_ids,
                       GROUP_CONCAT(p.name) as performance_names
                FROM members m
                LEFT JOIN member_performances mp ON m.id = mp.member_id
                LEFT JOIN performances p ON mp.performance_id = p.id
                GROUP BY m.id
                ORDER BY m.created_at DESC
            `);

            this.performances = await window.app.dbAll('SELECT * FROM performances ORDER BY name');
            this.renderMembers();
        } catch (error) {
            console.error('단원 목록 로딩 실패:', error);
            const container = document.getElementById('members-list');
            window.app.showError(container, '단원 목록을 불러오는데 실패했습니다.');
        }
    }

    renderMembers() {
        const container = document.getElementById('members-list');
        
        if (this.members.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>등록된 단원이 없습니다</h3>
                    <p>새 단원을 추가해주세요.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.members.map(member => {
            const performanceNames = member.performance_names ? 
                member.performance_names.split(',').join(', ') : '없음';
            const avoidTimes = member.avoid_times ? JSON.parse(member.avoid_times) : [];
            const avoidDays = member.avoid_days ? JSON.parse(member.avoid_days) : [];
            
            return `
                <div class="list-item" data-id="${member.id}">
                    <h3>${member.name}</h3>
                    <p><strong>자동 배정:</strong> ${member.auto_assign ? '포함' : '제외'}</p>
                    <p><strong>월 최대 공연횟수:</strong> ${member.max_monthly}회</p>
                    <p><strong>참여 가능한 공연:</strong> ${performanceNames}</p>
                    ${avoidTimes.length > 0 ? `<p><strong>비선호 시간대:</strong> ${avoidTimes.join(', ')}</p>` : ''}
                    ${avoidDays.length > 0 ? `<p><strong>비선호 요일:</strong> ${avoidDays.join(', ')}</p>` : ''}
                    <p><strong>등록일:</strong> ${window.app.formatDateTime(member.created_at)}</p>
                    <div class="actions">
                        <button class="btn btn-secondary edit-member" data-id="${member.id}">상세 설정</button>
                        <button class="btn btn-danger delete-member" data-id="${member.id}">삭제</button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.edit-member').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.showEditMemberModal(parseInt(id));
            });
        });

        container.querySelectorAll('.delete-member').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const member = this.members.find(m => m.id == id);
                const confirmed = await window.app.confirm(`"${member.name}" 단원을 삭제하시겠습니까?`);
                if (confirmed) {
                    await this.deleteMember(parseInt(id));
                }
            });
        });
    }

    showAddMemberModal() {
        const modalContent = `
            <h3>단원 추가</h3>
            <form id="add-member-form">
                <div class="form-group">
                    <label for="member-name">이름 *</label>
                    <input type="text" id="member-name" required>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">추가</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);
        
        document.getElementById('add-member-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('member-name').value.trim();
            
            if (!name) {
                window.app.alert('이름을 입력해주세요.');
                return;
            }

            try {
                await this.addMember(name);
                window.app.closeModal();
                await this.loadMembers();
            } catch (error) {
                console.error('단원 추가 실패:', error);
                window.app.alert('추가 중 오류가 발생했습니다.');
            }
        });
    }

    async showEditMemberModal(id) {
        const member = this.members.find(m => m.id === id);
        if (!member) return;

        const memberPerformances = await window.app.dbAll(
            'SELECT mp.*, p.name, p.roles FROM member_performances mp LEFT JOIN performances p ON mp.performance_id = p.id WHERE mp.member_id = ?',
            [id]
        );

        const personalSchedules = await window.app.dbAll(
            'SELECT * FROM personal_schedules WHERE member_id = ? ORDER BY date',
            [id]
        );

        const avoidTimes = member.avoid_times ? JSON.parse(member.avoid_times) : [];
        const avoidDays = member.avoid_days ? JSON.parse(member.avoid_days) : [];

        const performanceOptions = this.performances.map(perf => {
            const memberPerf = memberPerformances.find(mp => mp.performance_id === perf.id);
            const availableRoles = memberPerf ? JSON.parse(memberPerf.available_roles || '[]') : [];
            const roles = JSON.parse(perf.roles || '[]');
            
            const roleCheckboxes = roles.map(role => `
                <label class="checkbox-item">
                    <input type="checkbox" name="role_${perf.id}" value="${role}" 
                           ${availableRoles.includes(role) ? 'checked' : ''}>
                    ${role}
                </label>
            `).join('');

            return `
                <div class="performance-section">
                    <h4>${perf.name}</h4>
                    <div class="checkbox-group">
                        ${roleCheckboxes}
                    </div>
                </div>
            `;
        }).join('');

        const timeOptions = ['오전(09-12시)', '오후(13-17시)', '저녁(18-21시)', '야간(21시 이후)'];
        const dayOptions = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

        const personalSchedulesList = personalSchedules.map(schedule => `
            <div class="schedule-item">
                <span>${window.app.formatDate(schedule.date)}</span>
                <span>${schedule.reason || ''}</span>
                <button type="button" class="btn btn-danger btn-sm delete-schedule" data-id="${schedule.id}">삭제</button>
            </div>
        `).join('');

        const modalContent = `
            <h3>${member.name} 상세 설정</h3>
            <form id="edit-member-form" data-id="${member.id}">
                <div class="form-group">
                    <label for="member-name">이름 *</label>
                    <input type="text" id="member-name" value="${member.name}" required>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="auto-assign" ${member.auto_assign ? 'checked' : ''}>
                        자동 배정에 포함
                    </label>
                </div>

                <div class="form-group">
                    <label for="max-monthly">월 최대 공연횟수</label>
                    <input type="number" id="max-monthly" value="${member.max_monthly}" min="1" max="31">
                </div>

                <div class="form-group">
                    <label>비선호 시간대</label>
                    <div class="checkbox-group">
                        ${timeOptions.map(time => `
                            <label class="checkbox-item">
                                <input type="checkbox" name="avoid-time" value="${time}" 
                                       ${avoidTimes.includes(time) ? 'checked' : ''}>
                                ${time}
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="form-group">
                    <label>비선호 요일</label>
                    <div class="checkbox-group">
                        ${dayOptions.map(day => `
                            <label class="checkbox-item">
                                <input type="checkbox" name="avoid-day" value="${day}" 
                                       ${avoidDays.includes(day) ? 'checked' : ''}>
                                ${day}
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="form-group">
                    <label>공연 가능 목록</label>
                    <div class="performances-container">
                        ${performanceOptions}
                    </div>
                </div>

                <div class="form-group">
                    <label>개인 스케줄 (3개월 뒤까지)</label>
                    <div class="personal-schedule-container">
                        <div class="add-schedule-form">
                            <input type="date" id="new-schedule-date" min="${new Date().toISOString().split('T')[0]}" 
                                   max="${new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0]}">
                            <input type="text" id="new-schedule-reason" placeholder="사유">
                            <button type="button" id="add-schedule-btn" class="btn btn-secondary">추가</button>
                        </div>
                        <div class="schedule-list">
                            ${personalSchedulesList}
                        </div>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.app.closeModal()">취소</button>
                    <button type="submit" class="btn btn-primary">저장</button>
                </div>
            </form>
        `;

        window.app.showModal(modalContent);
        this.bindEditMemberEvents(id);
    }

    bindEditMemberEvents(memberId) {
        document.getElementById('add-schedule-btn').addEventListener('click', async () => {
            const date = document.getElementById('new-schedule-date').value;
            const reason = document.getElementById('new-schedule-reason').value.trim();

            if (!date) {
                window.app.alert('날짜를 선택해주세요.');
                return;
            }

            try {
                await window.app.dbRun(
                    'INSERT OR REPLACE INTO personal_schedules (member_id, date, reason) VALUES (?, ?, ?)',
                    [memberId, date, reason]
                );
                
                this.showEditMemberModal(memberId);
            } catch (error) {
                console.error('개인 스케줄 추가 실패:', error);
                window.app.alert('개인 스케줄 추가 중 오류가 발생했습니다.');
            }
        });

        document.querySelectorAll('.delete-schedule').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const scheduleId = e.target.dataset.id;
                try {
                    await window.app.dbRun('DELETE FROM personal_schedules WHERE id = ?', [scheduleId]);
                    this.showEditMemberModal(memberId);
                } catch (error) {
                    console.error('개인 스케줄 삭제 실패:', error);
                    window.app.alert('삭제 중 오류가 발생했습니다.');
                }
            });
        });

        document.getElementById('edit-member-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('member-name').value.trim();
            const autoAssign = document.getElementById('auto-assign').checked;
            const maxMonthly = parseInt(document.getElementById('max-monthly').value) || 10;
            
            const avoidTimes = Array.from(document.querySelectorAll('input[name="avoid-time"]:checked'))
                .map(cb => cb.value);
            const avoidDays = Array.from(document.querySelectorAll('input[name="avoid-day"]:checked'))
                .map(cb => cb.value);

            if (!name) {
                window.app.alert('이름을 입력해주세요.');
                return;
            }

            try {
                await this.updateMember(memberId, name, autoAssign, maxMonthly, avoidTimes, avoidDays);
                await this.updateMemberPerformances(memberId);
                window.app.closeModal();
                await this.loadMembers();
            } catch (error) {
                console.error('단원 수정 실패:', error);
                window.app.alert('수정 중 오류가 발생했습니다.');
            }
        });
    }

    async updateMemberPerformances(memberId) {
        await window.app.dbRun('DELETE FROM member_performances WHERE member_id = ?', [memberId]);

        for (const performance of this.performances) {
            const checkedRoles = Array.from(document.querySelectorAll(`input[name="role_${performance.id}"]:checked`))
                .map(cb => cb.value);
            
            if (checkedRoles.length > 0) {
                await window.app.dbRun(
                    'INSERT INTO member_performances (member_id, performance_id, available_roles) VALUES (?, ?, ?)',
                    [memberId, performance.id, JSON.stringify(checkedRoles)]
                );
            }
        }
    }

    async addMember(name) {
        const sql = 'INSERT INTO members (name) VALUES (?)';
        return await window.app.dbRun(sql, [name]);
    }

    async updateMember(id, name, autoAssign, maxMonthly, avoidTimes, avoidDays) {
        const sql = `UPDATE members SET 
                     name = ?, auto_assign = ?, max_monthly = ?, 
                     avoid_times = ?, avoid_days = ? 
                     WHERE id = ?`;
        const params = [
            name, 
            autoAssign, 
            maxMonthly, 
            JSON.stringify(avoidTimes),
            JSON.stringify(avoidDays),
            id
        ];
        
        return await window.app.dbRun(sql, params);
    }

    async deleteMember(id) {
        try {
            await window.app.dbRun('DELETE FROM members WHERE id = ?', [id]);
            await this.loadMembers();
        } catch (error) {
            console.error('단원 삭제 실패:', error);
            window.app.alert('삭제 중 오류가 발생했습니다.');
        }
    }

    getMemberById(id) {
        return this.members.find(m => m.id === id);
    }

    getAllMembers() {
        return this.members;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.memberManager = new MemberManager();
});