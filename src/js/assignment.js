class AssignmentManager {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeMonthOptions();
    }

    bindEvents() {
        document.getElementById('run-assignment').addEventListener('click', () => {
            this.runAutoAssignment();
        });
    }

    async initializeMonthOptions() {
        const select = document.getElementById('assignment-month');
        const currentDate = new Date();
        
        select.innerHTML = '<option value="">월 선택</option>';
        
        for (let i = 0; i < 12; i++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
            const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const text = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
            
            const option = document.createElement('option');
            option.value = value;
            option.textContent = text;
            select.appendChild(option);
        }
    }

    async runAutoAssignment() {
        const monthSelect = document.getElementById('assignment-month');
        const selectedMonth = monthSelect.value;
        
        if (!selectedMonth) {
            window.app.alert('배정할 월을 선택해주세요.');
            return;
        }

        const resultsContainer = document.getElementById('assignment-results');
        resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            const [year, month] = selectedMonth.split('-');
            const results = await this.performAutoAssignment(parseInt(year), parseInt(month));
            this.displayAssignmentResults(results);
        } catch (error) {
            console.error('자동 배정 실패:', error);
            resultsContainer.innerHTML = `
                <div class="assignment-result error">
                    <h4>배정 실패</h4>
                    <p>자동 배정 중 오류가 발생했습니다: ${error.message}</p>
                </div>
            `;
        }
    }

    async performAutoAssignment(year, month) {
        const schedules = await this.getSchedulesForMonth(year, month);
        const members = await this.getEligibleMembers();
        const results = [];

        if (schedules.length === 0) {
            throw new Error('해당 월에 스케줄이 없습니다.');
        }

        if (members.length === 0) {
            throw new Error('자동 배정에 포함된 단원이 없습니다.');
        }

        const memberStats = this.initializeMemberStats(members);
        const dailyAssignments = new Map();

        schedules.sort((a, b) => new Date(a.call_time) - new Date(b.call_time));

        for (const schedule of schedules) {
            try {
                const performance = await this.getPerformanceById(schedule.performance_id);
                const roles = JSON.parse(performance.roles || '[]');
                const scheduleDate = new Date(schedule.call_time).toDateString();
                
                await this.clearExistingAssignments(schedule.id);
                
                const assignments = await this.assignRoles(
                    schedule, 
                    roles, 
                    members, 
                    memberStats, 
                    dailyAssignments,
                    scheduleDate,
                    year,
                    month
                );

                if (assignments.length > 0) {
                    for (const assignment of assignments) {
                        await this.saveAssignment(schedule.id, assignment.memberId, assignment.role, false);
                        memberStats[assignment.memberId].count++;
                    }

                    results.push({
                        success: true,
                        schedule: schedule,
                        performance: performance,
                        assignments: assignments
                    });
                } else {
                    results.push({
                        success: false,
                        schedule: schedule,
                        performance: performance,
                        error: '배정 가능한 단원이 없습니다.'
                    });
                }
            } catch (error) {
                results.push({
                    success: false,
                    schedule: schedule,
                    error: error.message
                });
            }
        }

        return results;
    }

    async assignRoles(schedule, roles, members, memberStats, dailyAssignments, scheduleDate, year, month) {
        const assignments = [];
        const usedMembers = new Set();
        
        const sameTimeSchedules = await this.getSameTimeSchedules(schedule);
        const existingTeam = this.getExistingTeam(sameTimeSchedules, dailyAssignments);

        for (const role of roles) {
            let assignedMember = null;

            if (existingTeam && existingTeam.has(role)) {
                const teamMemberId = existingTeam.get(role);
                const member = members.find(m => m.id === teamMemberId);
                
                if (member && await this.canMemberBeAssigned(member, schedule, scheduleDate, year, month)) {
                    assignedMember = member;
                }
            }

            if (!assignedMember) {
                const eligibleMembers = await this.getEligibleMembersForRole(
                    role, schedule.performance_id, members, usedMembers, schedule, scheduleDate, year, month
                );

                if (eligibleMembers.length === 0) continue;

                eligibleMembers.sort((a, b) => {
                    return memberStats[a.id].count - memberStats[b.id].count;
                });

                assignedMember = eligibleMembers[0];
            }

            if (assignedMember) {
                assignments.push({
                    memberId: assignedMember.id,
                    memberName: assignedMember.name,
                    role: role
                });
                usedMembers.add(assignedMember.id);

                if (!dailyAssignments.has(scheduleDate)) {
                    dailyAssignments.set(scheduleDate, new Map());
                }
                dailyAssignments.get(scheduleDate).set(role, assignedMember.id);
            }
        }

        return assignments;
    }

    async getSameTimeSchedules(currentSchedule) {
        const currentDate = new Date(currentSchedule.call_time).toDateString();
        return await window.app.dbAll(`
            SELECT * FROM schedules 
            WHERE date(call_time) = date(?) AND performance_id = ? AND id != ?
            ORDER BY call_time
        `, [currentSchedule.call_time, currentSchedule.performance_id, currentSchedule.id]);
    }

    getExistingTeam(sameTimeSchedules, dailyAssignments) {
        if (sameTimeSchedules.length === 0) return null;

        const earliestSchedule = sameTimeSchedules[0];
        const scheduleDate = new Date(earliestSchedule.call_time).toDateString();
        
        return dailyAssignments.get(scheduleDate);
    }

    async canMemberBeAssigned(member, schedule, scheduleDate, year, month) {
        const currentCount = await this.getMemberMonthlyCount(member.id, year, month);
        if (currentCount >= member.max_monthly) return false;

        const callTime = new Date(schedule.call_time);
        const dayOfWeek = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][callTime.getDay()];
        const hour = callTime.getHours();
        
        let timeRange = '';
        if (hour >= 9 && hour < 12) timeRange = '오전(09-12시)';
        else if (hour >= 13 && hour < 17) timeRange = '오후(13-17시)';
        else if (hour >= 18 && hour < 21) timeRange = '저녁(18-21시)';
        else if (hour >= 21 || hour < 9) timeRange = '야간(21시 이후)';

        const avoidTimes = member.avoid_times ? JSON.parse(member.avoid_times) : [];
        const avoidDays = member.avoid_days ? JSON.parse(member.avoid_days) : [];

        if (avoidTimes.includes(timeRange) || avoidDays.includes(dayOfWeek)) {
            return false;
        }

        const personalSchedule = await window.app.dbGet(
            'SELECT * FROM personal_schedules WHERE member_id = ? AND date = ?',
            [member.id, new Date(schedule.call_time).toISOString().split('T')[0]]
        );

        return !personalSchedule;
    }

    async getEligibleMembersForRole(role, performanceId, members, usedMembers, schedule, scheduleDate, year, month) {
        const eligibleMembers = [];

        for (const member of members) {
            if (usedMembers.has(member.id)) continue;
            if (!member.auto_assign) continue;

            const memberPerformance = await window.app.dbGet(
                'SELECT available_roles FROM member_performances WHERE member_id = ? AND performance_id = ?',
                [member.id, performanceId]
            );

            if (!memberPerformance) continue;

            const availableRoles = JSON.parse(memberPerformance.available_roles || '[]');
            if (!availableRoles.includes(role)) continue;

            if (await this.canMemberBeAssigned(member, schedule, scheduleDate, year, month)) {
                eligibleMembers.push(member);
            }
        }

        return eligibleMembers;
    }

    async getMemberMonthlyCount(memberId, year, month) {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
        
        const result = await window.app.dbGet(`
            SELECT COUNT(*) as count FROM assignments a
            JOIN schedules s ON a.schedule_id = s.id
            WHERE a.member_id = ? AND date(s.call_time) BETWEEN ? AND ?
        `, [memberId, startDate, endDate]);
        
        return result ? result.count : 0;
    }

    async getSchedulesForMonth(year, month) {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
        
        return await window.app.dbAll(`
            SELECT s.*, p.name as performance_name FROM schedules s
            LEFT JOIN performances p ON s.performance_id = p.id
            WHERE date(s.call_time) BETWEEN ? AND ?
            ORDER BY s.call_time
        `, [startDate, endDate]);
    }

    async getEligibleMembers() {
        return await window.app.dbAll(
            'SELECT * FROM members WHERE auto_assign = 1 ORDER BY name'
        );
    }

    async getPerformanceById(id) {
        return await window.app.dbGet('SELECT * FROM performances WHERE id = ?', [id]);
    }

    initializeMemberStats(members) {
        const stats = {};
        members.forEach(member => {
            stats[member.id] = { count: 0 };
        });
        return stats;
    }

    async clearExistingAssignments(scheduleId) {
        await window.app.dbRun('DELETE FROM assignments WHERE schedule_id = ? AND is_manual = 0', [scheduleId]);
    }

    async saveAssignment(scheduleId, memberId, role, isManual) {
        await window.app.dbRun(
            'INSERT INTO assignments (schedule_id, member_id, role, is_manual) VALUES (?, ?, ?, ?)',
            [scheduleId, memberId, role, isManual]
        );
    }

    displayAssignmentResults(results) {
        const container = document.getElementById('assignment-results');
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="assignment-result">
                    <h4>배정 완료</h4>
                    <p>배정할 스케줄이 없습니다.</p>
                </div>
            `;
            return;
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        let html = `
            <div class="assignment-summary">
                <h3>자동 배정 결과</h3>
                <p>총 ${results.length}개 스케줄 중 ${successCount}개 성공, ${failureCount}개 실패</p>
            </div>
        `;

        results.forEach((result, index) => {
            const cssClass = result.success ? 'success' : 'error';
            const schedule = result.schedule;
            const performance = result.performance;

            if (result.success) {
                const assignmentList = result.assignments.map(a => 
                    `${a.memberName}(${a.role})`
                ).join(', ');

                html += `
                    <div class="assignment-result ${cssClass}">
                        <h4>${performance.name}</h4>
                        <p><strong>일시:</strong> ${window.app.formatDateTime(schedule.call_time)} (콜) / ${window.app.formatDateTime(schedule.start_time)} (시작)</p>
                        <p><strong>장소:</strong> ${schedule.venue}</p>
                        <p><strong>배정 결과:</strong> ${assignmentList}</p>
                    </div>
                `;
            } else {
                html += `
                    <div class="assignment-result ${cssClass}">
                        <h4>${performance ? performance.name : '알 수 없는 공연'}</h4>
                        <p><strong>일시:</strong> ${window.app.formatDateTime(schedule.call_time)}</p>
                        <p><strong>오류:</strong> ${result.error}</p>
                    </div>
                `;
            }
        });

        container.innerHTML = html;

        if (window.calendar) {
            window.calendar.refresh();
        }
        if (window.scheduleManager) {
            window.scheduleManager.loadSchedules();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.assignmentManager = new AssignmentManager();
});