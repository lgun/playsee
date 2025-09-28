class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.schedules = [];
        this.viewMode = 'monthly';
        this.init();
    }

    async init() {
        this.bindEvents();
        this.setupInitialView();
        this.render();
        await this.loadSchedules();
    }

    setupInitialView() {
        // 초기 월간 뷰 설정
        this.viewMode = 'monthly';
        document.getElementById('monthly-view-btn').classList.add('active', 'btn-primary');
        document.getElementById('monthly-view-btn').classList.remove('btn-secondary');
        document.getElementById('weekly-view-btn').classList.add('btn-secondary');
        document.getElementById('weekly-view-btn').classList.remove('active', 'btn-primary');
        document.getElementById('monthly-calendar').classList.add('active');
        document.getElementById('weekly-calendar').classList.remove('active');
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
            this.updatePeriodDisplay();
            this.loadSchedules();
        });

        document.getElementById('next-period').addEventListener('click', () => {
            if (this.viewMode === 'monthly') {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            } else {
                this.currentDate.setDate(this.currentDate.getDate() + 7);
            }
            this.updatePeriodDisplay();
            this.loadSchedules();
        });

        document.getElementById('today-btn').addEventListener('click', () => {
            this.currentDate = new Date();
            this.updatePeriodDisplay();
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
                // 주간 뷰: 월요일~토요일 기준으로 주 계산
                const startOfWeek = new Date(this.currentDate);
                const dayOfWeek = startOfWeek.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
                
                // 월요일로 이동 (일요일이면 이전 주 월요일로)
                if (dayOfWeek === 0) { // 일요일
                    startOfWeek.setDate(startOfWeek.getDate() - 6);
                } else { // 월~토요일
                    startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek - 1));
                }
                
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 5); // 토요일까지
                
                whereClause = `date(s.call_time) BETWEEN ? AND ?`;
                params = [
                    startOfWeek.toISOString().split('T')[0],
                    endOfWeek.toISOString().split('T')[0]
                ];
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
                WHERE ${whereClause}
                GROUP BY s.id
                ORDER BY s.call_time
            `, params);

            // 스케줄 데이터 로딩 완료 후 현재 뷰 모드에 따라 렌더링
            if (this.viewMode === 'monthly') {
                // 월간 뷰는 다시 렌더링해서 스케줄 포함
                this.renderMonthlyCalendar();
            } else {
                // 주간 뷰는 다시 렌더링해서 스케줄 포함
                this.renderWeeklyCalendar();
            }
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
            // 월요일~토요일 기준으로 주 계산
            const startOfWeek = new Date(this.currentDate);
            const dayOfWeek = startOfWeek.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
            
            // 월요일로 이동 (일요일이면 이전 주 월요일로)
            if (dayOfWeek === 0) { // 일요일
                startOfWeek.setDate(startOfWeek.getDate() - 6);
            } else { // 월~토요일
                startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek - 1));
            }
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 5); // 토요일까지
            
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
        
        // 월간 캘린더에 표시할 첫 번째 날 (해당 월의 첫 번째 월요일 또는 이전 월의 월요일)
        const startDate = new Date(firstDay);
        const firstDayOfWeek = firstDay.getDay(); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
        
        // 달의 첫날이 월요일(1)이 아니면 이전 월의 월요일부터 시작
        if (firstDayOfWeek === 0) { // 일요일이면 이전 주 월요일부터
            startDate.setDate(firstDay.getDate() - 6);
        } else if (firstDayOfWeek !== 1) { // 월요일이 아니면 해당 주의 월요일로
            startDate.setDate(firstDay.getDate() - (firstDayOfWeek - 1));
        }
        
        // 마지막 토요일 계산
        const endDate = new Date(lastDay);
        const lastDayOfWeek = lastDay.getDay();
        
        if (lastDayOfWeek === 0) { // 일요일이면 전날 토요일까지
            endDate.setDate(lastDay.getDate() - 1);
        } else if (lastDayOfWeek !== 6) { // 토요일이 아니면 해당 주의 토요일까지
            endDate.setDate(lastDay.getDate() + (6 - lastDayOfWeek));
        }

        const calendar = document.createElement('table');
        calendar.className = 'calendar monthly-calendar';

        // 헤더 생성 (월~토)
        const headerRow = document.createElement('tr');
        const days = ['월', '화', '수', '목', '금', '토'];
        days.forEach(day => {
            const th = document.createElement('th');
            th.textContent = day;
            headerRow.appendChild(th);
        });
        calendar.appendChild(headerRow);

        // 날짜를 요일에 맞게 정확히 배치
        let currentWeekStart = new Date(startDate);
        
        while (currentWeekStart <= endDate) {
            const weekRow = document.createElement('tr');
            
            // 월요일(1)부터 토요일(6)까지
            for (let targetDayOfWeek = 1; targetDayOfWeek <= 6; targetDayOfWeek++) {
                const cell = document.createElement('td');
                cell.className = 'monthly-cell';
                
                // 현재 주에서 해당 요일의 날짜 계산
                const cellDate = new Date(currentWeekStart);
                const currentWeekStartDay = currentWeekStart.getDay();
                
                // 현재 주 시작이 월요일(1)이 아닐 수 있으므로 조정
                let daysToAdd;
                if (currentWeekStartDay === 0) { // 일요일 시작이면
                    daysToAdd = targetDayOfWeek; // 월요일=1일 추가, 화요일=2일 추가...
                } else { // 월~토요일 시작이면
                    daysToAdd = targetDayOfWeek - currentWeekStartDay;
                }
                
                cellDate.setDate(currentWeekStart.getDate() + daysToAdd);
                
                // 셀에 날짜 표시 (범위 내에 있고 일요일이 아닌 경우만)
                if (cellDate >= startDate && cellDate <= endDate && cellDate.getDay() !== 0) {
                    const dayNumber = document.createElement('div');
                    dayNumber.className = 'date-number';
                    dayNumber.textContent = cellDate.getDate();

                    if (cellDate.getMonth() !== month) {
                        cell.classList.add('other-month');
                    }

                    if (this.isToday(cellDate)) {
                        cell.classList.add('today');
                    }

                    const dateStr = this.formatDateForComparison(cellDate);
                    const daySchedules = this.getSchedulesForDate(dateStr);
                    
                    if (daySchedules.length > 0) {
                        cell.classList.add('has-schedule');
                    }

                    cell.appendChild(dayNumber);

                    // 스케줄 표시
                    this.renderDaySchedules(cell, daySchedules);

                    // 클릭 이벤트 (날짜 복사)
                    const clickDate = new Date(cellDate);
                    cell.addEventListener('click', () => {
                        this.showDayDetail(clickDate, daySchedules);
                    });
                } else {
                    // 빈 셀
                    cell.classList.add('empty-cell');
                }

                weekRow.appendChild(cell);
            }
            
            calendar.appendChild(weekRow);
            
            // 다음 주로 이동 (7일 추가)
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        }

        container.innerHTML = '';
        container.appendChild(calendar);
    }

    renderDaySchedules(cell, daySchedules) {
        if (daySchedules.length === 0) return;

        // 공연별로 그룹화
        const performanceGroups = {};
        daySchedules.forEach(schedule => {
            const key = schedule.performance_name;
            if (!performanceGroups[key]) {
                performanceGroups[key] = [];
            }
            performanceGroups[key].push(schedule);
        });

        // 각 공연별로 표시
        Object.entries(performanceGroups).forEach(([performanceName, schedules]) => {
            // 같은 공연의 다른 시간대를 그룹화
            const timeGroups = {};
            schedules.forEach(schedule => {
                const venue = schedule.venue;
                if (!timeGroups[venue]) {
                    timeGroups[venue] = [];
                }
                timeGroups[venue].push(schedule);
            });

            // 각 장소별로 표시
            Object.entries(timeGroups).forEach(([venue, venueSchedules]) => {
                const scheduleDiv = document.createElement('div');
                scheduleDiv.className = 'monthly-schedule-item';
                
                // 시간 정보 처리 (같은 공연이 다른 시간대에 있을 경우)
                const times = venueSchedules.map(s => this.formatTime(s.start_time));
                const timeDisplay = times.length > 1 ? times.join(' / ') : times[0];
                
                // 3줄 표기: 장소, 시간, 공연명
                const scheduleContent = document.createElement('div');
                scheduleContent.innerHTML = `
                    <div class="schedule-venue">${venue}</div>
                    <div class="schedule-time">${timeDisplay}</div>
                    <div class="schedule-performance">${performanceName}</div>
                `;
                scheduleDiv.appendChild(scheduleContent);

                // 단원 목록 표기
                const membersList = this.getMembersForSchedules(venueSchedules);
                if (membersList.length > 0) {
                    const membersDiv = document.createElement('div');
                    membersDiv.className = 'schedule-members';
                    membersDiv.textContent = membersList.join(', ');
                    scheduleDiv.appendChild(membersDiv);
                }

                // 클릭 이벤트
                scheduleDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.scheduleManager.showManualAssignModal(venueSchedules[0].id);
                });

                cell.appendChild(scheduleDiv);
            });
        });
    }

    getMembersForSchedules(schedules) {
        const allMembers = new Set();
        
        schedules.forEach(schedule => {
            if (schedule.assignments) {
                const assignments = schedule.assignments.split(',');
                assignments.forEach(assignment => {
                    const [memberName, role] = assignment.split(':');
                    if (memberName && memberName.trim()) {
                        // 성 제외한 이름만 사용
                        const firstName = memberName.trim().split(' ').slice(-1)[0];
                        allMembers.add(firstName);
                    }
                });
            }
        });
        
        return Array.from(allMembers);
    }

    renderWeeklyCalendar() {
        const container = document.getElementById('weekly-calendar');
        
        // 월요일부터 토요일까지의 주간 계산 (일요일 제외)
        const monday = new Date(this.currentDate);
        const dayOfWeek = monday.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
        
        // 월요일로 이동 (일요일이면 이전 주 월요일로)
        if (dayOfWeek === 0) { // 일요일
            monday.setDate(monday.getDate() - 6);
        } else { // 월~토요일
            monday.setDate(monday.getDate() - (dayOfWeek - 1));
        }
        
        const saturday = new Date(monday);
        saturday.setDate(saturday.getDate() + 5); // 토요일까지
        
        // 주간 스케줄들을 수집
        const weekSchedules = [];
        for (let i = 0; i < 6; i++) {
            const dayDate = new Date(monday);
            dayDate.setDate(dayDate.getDate() + i);
            const dateStr = this.formatDateForComparison(dayDate);
            const daySchedules = this.getSchedulesForDate(dateStr);
            weekSchedules.push(...daySchedules);
        }
        
        // 공연별로 그룹화
        const performanceGroups = {};
        weekSchedules.forEach(schedule => {
            if (!performanceGroups[schedule.performance_name]) {
                performanceGroups[schedule.performance_name] = [];
            }
            performanceGroups[schedule.performance_name].push(schedule);
        });
        
        // 주간 일정표 생성
        let weeklyHTML = `
            <div class="weekly-schedule-table">
                <h3>${monday.toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })} ~ ${saturday.toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })} 공연 일정표</h3>
        `;
        
        // 각 공연별 테이블 생성
        Object.entries(performanceGroups).forEach(([performanceName, schedules]) => {
            weeklyHTML += this.generatePerformanceTable(performanceName, schedules, monday);
        });
        
        // 연습 일정 추가 (임시로 빈 섹션 추가)
        weeklyHTML += `
                <div class="practice-schedule">
                    <h4>연습(공지)</h4>
                    <div class="practice-content">
                        연습 일정이 없습니다.
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = weeklyHTML;
        
        // 클릭 이벤트 추가
        container.querySelectorAll('.schedule-cell').forEach(cell => {
            const scheduleId = cell.dataset.scheduleId;
            if (scheduleId) {
                cell.addEventListener('click', () => {
                    window.scheduleManager.showManualAssignModal(parseInt(scheduleId));
                });
            }
        });
    }
    
    generatePerformanceTable(performanceName, schedules, monday) {
        const days = ['월(Mon)', '화(Tue)', '수(Wed)', '목(Thu)', '금(Fri)', '토(Sat)'];
        const dates = [];
        const schedulesByDay = [{}, {}, {}, {}, {}, {}]; // 월~토
        
        // 날짜 배열 생성 및 스케줄 분류
        for (let i = 0; i < 6; i++) {
            const dayDate = new Date(monday);
            dayDate.setDate(dayDate.getDate() + i);
            dates.push(dayDate.getDate());
            
            const dateStr = this.formatDateForComparison(dayDate);
            schedulesByDay[i] = schedules.filter(s => 
                this.formatDateForComparison(new Date(s.call_time)) === dateStr
            );
        }
        
        let tableHTML = `
            <table class="performance-table">
                <thead>
                    <tr>
                        <th class="row-header">요일</th>
                        ${days.map(day => `<th>${day}</th>`).join('')}
                    </tr>
                    <tr>
                        <th class="row-header">일</th>
                        ${dates.map(date => `<th>${date}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="row-header">공연</td>
                        ${schedulesByDay.map((daySchedules, dayIndex) => {
                            if (daySchedules.length === 0) {
                                return '<td class="schedule-cell">-</td>';
                            }
                            
                            // 같은 날에 같은 공연의 다른 시간대가 있는지 확인
                            const timesByVenue = {};
                            daySchedules.forEach(schedule => {
                                if (!timesByVenue[schedule.venue]) {
                                    timesByVenue[schedule.venue] = [];
                                }
                                timesByVenue[schedule.venue].push(this.formatTime(schedule.start_time));
                            });
                            
                            const performanceInfo = Object.entries(timesByVenue).map(([venue, times]) => {
                                const timeDisplay = times.length > 1 ? times.join(' / ') : times[0];
                                return `${venue}<br/>${timeDisplay}<br/>${daySchedules[0].performance_name}`;
                            }).join('<br/>');
                            
                            return `<td class="schedule-cell" data-schedule-id="${daySchedules[0].id}">${performanceInfo}</td>`;
                        }).join('')}
                    </tr>
                    <tr>
                        <td class="row-header">단원</td>
                        ${schedulesByDay.map(daySchedules => {
                            if (daySchedules.length === 0) {
                                return '<td class="schedule-cell">-</td>';
                            }
                            
                            const memberNames = daySchedules.flatMap(schedule => {
                                if (!schedule.assignments) return [];
                                return schedule.assignments.split(',').map(a => {
                                    const [name, role] = a.split(':');
                                    const firstName = name.split(' ').slice(-1)[0]; // 성 제외한 이름
                                    const isDriver = schedule.driver_name && name === schedule.driver_name;
                                    return isDriver ? `<u>${firstName}</u>` : firstName;
                                });
                            });
                            
                            return `<td class="schedule-cell">${memberNames.join(', ') || '-'}</td>`;
                        }).join('')}
                    </tr>
                    <tr>
                        <td class="row-header">물품</td>
                        ${schedulesByDay.map(daySchedules => {
                            if (daySchedules.length === 0) {
                                return '<td class="schedule-cell">-</td>';
                            }
                            
                            const equipmentSets = daySchedules.map(schedule => {
                                const equipmentList = schedule.equipment_list ? JSON.parse(schedule.equipment_list) : [];
                                return equipmentList.join(' / ');
                            }).filter(eq => eq);
                            
                            return `<td class="schedule-cell">${equipmentSets.join('<br/>') || '-'}</td>`;
                        }).join('')}
                    </tr>
                    <tr>
                        <td class="row-header">출발</td>
                        ${schedulesByDay.map(daySchedules => {
                            if (daySchedules.length === 0) {
                                return '<td class="schedule-cell">-</td>';
                            }
                            
                            const departureInfo = daySchedules.map(schedule => {
                                const callTime = new Date(schedule.call_time).toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit', 
                                    hour12: true 
                                });
                                const vehicle = schedule.vehicle_type || '미정';
                                return `${callTime} / ${vehicle}`;
                            });
                            
                            return `<td class="schedule-cell">${departureInfo.join('<br/>')}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        `;
        
        return tableHTML;
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
                        moreDiv.style.backgroundColor = '#f5f5f5';
                        moreDiv.style.color = '#666';
                        moreDiv.style.border = '1px solid #ddd';
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

document.addEventListener('DOMContentLoaded', async () => {
    window.calendar = new Calendar();
});