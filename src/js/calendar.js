class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.schedules = [];
        this.viewMode = 'monthly'; // 'monthly' or 'weekly'
        this.init();
    }

    init() {
        this.bindEvents();
        this.render();
        this.loadSchedules();
    }

    bindEvents() {
        document.getElementById('monthly-view-btn').addEventListener('click', () => {
            this.switchView('monthly');
        });

        document.getElementById('weekly-view-btn').addEventListener('click', () => {
            this.switchView('weekly');
        });

        document.getElementById('prev-period').addEventListener('click', () => {
            if (this.viewMode === 'monthly') {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            } else {
                this.currentDate.setDate(this.currentDate.getDate() - 7);
            }
            this.render();
            this.loadSchedules();
        });

        document.getElementById('next-period').addEventListener('click', () => {
            if (this.viewMode === 'monthly') {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            } else {
                this.currentDate.setDate(this.currentDate.getDate() + 7);
            }
            this.render();
            this.loadSchedules();
        });

        document.getElementById('today-btn').addEventListener('click', () => {
            this.currentDate = new Date();
            this.render();
            this.loadSchedules();
        });
    }

    switchView(mode) {
        this.viewMode = mode;
        
        // 버튼 상태 업데이트
        document.getElementById('monthly-view-btn').classList.toggle('active', mode === 'monthly');
        document.getElementById('weekly-view-btn').classList.toggle('active', mode === 'weekly');
        document.getElementById('monthly-view-btn').classList.toggle('btn-primary', mode === 'monthly');
        document.getElementById('monthly-view-btn').classList.toggle('btn-secondary', mode !== 'monthly');
        document.getElementById('weekly-view-btn').classList.toggle('btn-primary', mode === 'weekly');
        document.getElementById('weekly-view-btn').classList.toggle('btn-secondary', mode !== 'weekly');
        
        // 뷰 컨테이너 전환
        document.getElementById('monthly-calendar').classList.toggle('active', mode === 'monthly');
        document.getElementById('weekly-calendar').classList.toggle('active', mode === 'weekly');
        
        this.render();
        this.loadSchedules();
    }

    async loadSchedules() {
        try {
            let whereClause, params;
            
            if (this.viewMode === 'monthly') {
                const year = this.currentDate.getFullYear();
                const month = this.currentDate.getMonth() + 1;
                whereClause = `strftime('%Y', s.call_time) = ? AND strftime('%m', s.call_time) = ?`;
                params = [year.toString(), month.toString().padStart(2, '0')];
            } else {
                // 주간 뷰: 현재 주의 시작과 끝 날짜 계산
                const startOfWeek = new Date(this.currentDate);
                startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 6);
                
                whereClause = `date(s.call_time) BETWEEN ? AND ?`;
                params = [
                    startOfWeek.toISOString().split('T')[0],
                    endOfWeek.toISOString().split('T')[0]
                ];
            }
            
            this.schedules = await window.app.dbAll(`
                SELECT s.*, p.name as performance_name, p.roles as performance_roles,
                       GROUP_CONCAT(DISTINCT m.name || ':' || a.role) as assignments,
                       driver.name as driver_name
                FROM schedules s
                LEFT JOIN performances p ON s.performance_id = p.id
                LEFT JOIN assignments a ON s.id = a.schedule_id
                LEFT JOIN members m ON a.member_id = m.id
                LEFT JOIN members driver ON s.driver_id = driver.id
                WHERE ${whereClause}
                GROUP BY s.id
                ORDER BY s.call_time
            `, params);

            this.renderSchedules();
        } catch (error) {
            console.error('캘린더 스케줄 로딩 실패:', error);
        }
    }

    render() {
        this.updatePeriodDisplay();
        if (this.viewMode === 'monthly') {
            this.renderMonthlyCalendar();
        } else {
            this.renderWeeklyCalendar();
        }
    }

    updatePeriodDisplay() {
        const periodDisplay = document.getElementById('current-period');
        
        if (this.viewMode === 'monthly') {
            const options = { year: 'numeric', month: 'long' };
            periodDisplay.textContent = this.currentDate.toLocaleDateString('ko-KR', options);
        } else {
            const startOfWeek = new Date(this.currentDate);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            
            const startStr = startOfWeek.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
            const endStr = endOfWeek.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
            periodDisplay.textContent = `${startStr} - ${endStr}`;
        }
    }

    renderMonthlyCalendar() {
        const container = document.getElementById('monthly-calendar');
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        const endDate = new Date(lastDay);
        endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

        const calendar = document.createElement('table');
        calendar.className = 'calendar';

        const headerRow = document.createElement('tr');
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        days.forEach(day => {
            const th = document.createElement('th');
            th.textContent = day;
            headerRow.appendChild(th);
        });
        calendar.appendChild(headerRow);

        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const weekRow = document.createElement('tr');
            
            for (let i = 0; i < 7; i++) {
                const cell = document.createElement('td');
                const dayNumber = document.createElement('div');
                dayNumber.className = 'date-number';
                dayNumber.textContent = currentDate.getDate();

                if (currentDate.getMonth() !== month) {
                    cell.classList.add('other-month');
                }

                if (this.isToday(currentDate)) {
                    cell.classList.add('today');
                }

                const dateStr = this.formatDateForComparison(currentDate);
                const daySchedules = this.getSchedulesForDate(dateStr);
                
                if (daySchedules.length > 0) {
                    cell.classList.add('has-schedule');
                }

                cell.appendChild(dayNumber);

                daySchedules.slice(0, 3).forEach(schedule => {
                    const scheduleDiv = document.createElement('div');
                    scheduleDiv.className = 'schedule-item';
                    scheduleDiv.textContent = `${schedule.performance_name} ${this.formatTime(schedule.call_time)}`;
                    scheduleDiv.title = `${schedule.performance_name}\n콜타임: ${window.app.formatDateTime(schedule.call_time)}\n스타트타임: ${window.app.formatDateTime(schedule.start_time)}\n장소: ${schedule.venue}`;
                    scheduleDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.scheduleManager.showManualAssignModal(schedule.id);
                    });
                    cell.appendChild(scheduleDiv);
                });

                if (daySchedules.length > 3) {
                    const moreDiv = document.createElement('div');
                    moreDiv.className = 'schedule-item';
                    moreDiv.textContent = `+${daySchedules.length - 3}개 더`;
                    moreDiv.style.backgroundColor = '#95a5a6';
                    cell.appendChild(moreDiv);
                }

                cell.addEventListener('click', () => {
                    this.showDayDetail(new Date(currentDate), daySchedules);
                });

                weekRow.appendChild(cell);
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            calendar.appendChild(weekRow);
        }

        container.innerHTML = '';
        container.appendChild(calendar);
    }

    renderWeeklyCalendar() {
        const container = document.getElementById('weekly-calendar');
        
        // 현재 주의 시작일 계산
        const startOfWeek = new Date(this.currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        
        // 주간 스케줄 테이블 생성
        const weeklyTable = document.createElement('div');
        weeklyTable.className = 'weekly-schedule';
        
        // 헤더 생성
        const header = document.createElement('div');
        header.className = 'weekly-header';
        
        const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(dayDate.getDate() + i);
            
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            if (this.isToday(dayDate)) {
                dayHeader.classList.add('today');
            }
            
            dayHeader.innerHTML = `
                <div class="day-name">${days[i]}</div>
                <div class="day-date">${dayDate.getDate()}</div>
            `;
            
            header.appendChild(dayHeader);
        }
        
        weeklyTable.appendChild(header);
        
        // 스케줄 내용 생성
        const scheduleContent = document.createElement('div');
        scheduleContent.className = 'weekly-content';
        
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(dayDate.getDate() + i);
            
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            
            const dateStr = this.formatDateForComparison(dayDate);
            const daySchedules = this.getSchedulesForDate(dateStr);
            
            if (daySchedules.length === 0) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'empty-day';
                emptyDiv.textContent = '스케줄 없음';
                dayColumn.appendChild(emptyDiv);
            } else {
                daySchedules.forEach(schedule => {
                    const scheduleDiv = document.createElement('div');
                    scheduleDiv.className = 'weekly-schedule-item';
                    
                    const equipmentList = schedule.equipment_list ? JSON.parse(schedule.equipment_list) : [];
                    const equipmentStr = equipmentList.length > 0 ? equipmentList.join(', ') : '';
                    
                    const assignments = schedule.assignments ? 
                        schedule.assignments.split(',').map(a => {
                            const [name, role] = a.split(':');
                            return `${name}(${role})`;
                        }).join(', ') : '미배정';
                    
                    scheduleDiv.innerHTML = `
                        <div class="schedule-title">${schedule.performance_name}</div>
                        <div class="schedule-time">
                            <div>📞 ${this.formatTime(schedule.call_time)}</div>
                            <div>🎭 ${this.formatTime(schedule.start_time)}</div>
                        </div>
                        <div class="schedule-venue">📍 ${schedule.venue}</div>
                        <div class="schedule-assignments">👥 ${assignments}</div>
                        ${schedule.driver_name ? `<div class="schedule-driver">🚗 ${schedule.driver_name}</div>` : ''}
                        ${schedule.vehicle_type ? `<div class="schedule-vehicle">🚐 ${schedule.vehicle_type}</div>` : ''}
                        ${equipmentStr ? `<div class="schedule-equipment">📦 ${equipmentStr}</div>` : ''}
                    `;
                    
                    scheduleDiv.addEventListener('click', () => {
                        window.scheduleManager.showManualAssignModal(schedule.id);
                    });
                    
                    dayColumn.appendChild(scheduleDiv);
                });
            }
            
            scheduleContent.appendChild(dayColumn);
        }
        
        weeklyTable.appendChild(scheduleContent);
        
        container.innerHTML = '';
        container.appendChild(weeklyTable);
    }

    renderSchedules() {
        const calendarCells = document.querySelectorAll('.calendar td:not(.other-month)');
        calendarCells.forEach(cell => {
            const existingSchedules = cell.querySelectorAll('.schedule-item');
            existingSchedules.forEach(item => item.remove());
            
            cell.classList.remove('has-schedule');
            
            const dateNumber = cell.querySelector('.date-number');
            if (dateNumber) {
                const day = parseInt(dateNumber.textContent);
                const dateStr = this.formatDateForComparison(new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day));
                const daySchedules = this.getSchedulesForDate(dateStr);
                
                if (daySchedules.length > 0) {
                    cell.classList.add('has-schedule');
                    
                    daySchedules.slice(0, 3).forEach(schedule => {
                        const scheduleDiv = document.createElement('div');
                        scheduleDiv.className = 'schedule-item';
                        scheduleDiv.textContent = `${schedule.performance_name} ${this.formatTime(schedule.call_time)}`;
                        scheduleDiv.title = `${schedule.performance_name}\n콜타임: ${window.app.formatDateTime(schedule.call_time)}\n스타트타임: ${window.app.formatDateTime(schedule.start_time)}\n장소: ${schedule.venue}`;
                        scheduleDiv.addEventListener('click', (e) => {
                            e.stopPropagation();
                            window.scheduleManager.showManualAssignModal(schedule.id);
                        });
                        cell.appendChild(scheduleDiv);
                    });

                    if (daySchedules.length > 3) {
                        const moreDiv = document.createElement('div');
                        moreDiv.className = 'schedule-item';
                        moreDiv.textContent = `+${daySchedules.length - 3}개 더`;
                        moreDiv.style.backgroundColor = '#95a5a6';
                        cell.appendChild(moreDiv);
                    }
                }
            }
        });
    }

    getSchedulesForDate(dateStr) {
        return this.schedules.filter(schedule => {
            const scheduleDate = this.formatDateForComparison(new Date(schedule.call_time));
            return scheduleDate === dateStr;
        });
    }

    showDayDetail(date, schedules) {
        const dateStr = date.toLocaleDateString('ko-KR');
        
        let scheduleList = '';
        if (schedules.length === 0) {
            scheduleList = '<p>이 날에는 스케줄이 없습니다.</p>';
        } else {
            scheduleList = schedules.map(schedule => {
                const assignments = schedule.assignments ? 
                    schedule.assignments.split(',').map(a => {
                        const [name, role] = a.split(':');
                        return `${name}(${role})`;
                    }).join(', ') : '배정되지 않음';

                const equipmentList = schedule.equipment_list ? JSON.parse(schedule.equipment_list) : [];
                const equipmentStr = equipmentList.length > 0 ? equipmentList.join(', ') : '없음';

                return `
                    <div class="schedule-detail">
                        <h4>${schedule.performance_name}</h4>
                        <p><strong>콜타임:</strong> ${window.app.formatDateTime(schedule.call_time)}</p>
                        <p><strong>스타트타임:</strong> ${window.app.formatDateTime(schedule.start_time)}</p>
                        <p><strong>장소:</strong> ${schedule.venue}</p>
                        <p><strong>배정된 배우:</strong> ${assignments}</p>
                        <p><strong>운전자:</strong> ${schedule.driver_name || '미정'}</p>
                        <p><strong>차종:</strong> ${schedule.vehicle_type || '미정'}</p>
                        <p><strong>준비물품:</strong> ${equipmentStr}</p>
                        <div class="schedule-actions">
                            <button class="btn btn-success btn-sm" onclick="window.scheduleManager.showManualAssignModal(${schedule.id}); window.app.closeModal();">수동 배정</button>
                            <button class="btn btn-secondary btn-sm" onclick="window.scheduleManager.showEditScheduleModal(${schedule.id}); window.app.closeModal();">수정</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const modalContent = `
            <h3>${dateStr} 스케줄</h3>
            <div class="day-schedules">
                ${scheduleList}
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn-primary" onclick="window.app.closeModal()">확인</button>
            </div>
        `;

        window.app.showModal(modalContent);
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    formatDateForComparison(date) {
        return date.toISOString().split('T')[0];
    }

    formatTime(datetime) {
        return new Date(datetime).toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    async refresh() {
        await this.loadSchedules();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.calendar = new Calendar();
});