class PerformanceStatsManager {
    constructor() {
        this.venues = [];
        this.filters = {
            startDate: null,
            endDate: null,
            venueSearch: '',
            sortOption: 'recent'
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadPerformanceStats();
    }

    bindEvents() {
        // 전체 기간 버튼
        document.getElementById('all-period-btn').addEventListener('click', () => {
            document.getElementById('stats-start-date').value = '';
            document.getElementById('stats-end-date').value = '';
            this.filters.startDate = null;
            this.filters.endDate = null;
            this.loadPerformanceStats();
        });

        // 날짜 범위 변경
        document.getElementById('stats-start-date').addEventListener('change', (e) => {
            this.filters.startDate = e.target.value;
            this.loadPerformanceStats();
        });

        document.getElementById('stats-end-date').addEventListener('change', (e) => {
            this.filters.endDate = e.target.value;
            this.loadPerformanceStats();
        });

        // 장소 검색
        document.getElementById('venue-search').addEventListener('input', (e) => {
            this.filters.venueSearch = e.target.value.trim();
            this.renderVenues();
        });

        // 정렬 옵션
        document.getElementById('sort-option').addEventListener('change', (e) => {
            this.filters.sortOption = e.target.value;
            this.renderVenues();
        });
    }

    async loadPerformanceStats() {
        try {
            const container = document.getElementById('performance-stats-list');
            window.app.showLoading(container);

            // 기간 필터 SQL 조건 생성
            let whereClause = '';
            let params = [];

            if (this.filters.startDate && this.filters.endDate) {
                whereClause = 'WHERE DATE(s.start_time) BETWEEN ? AND ?';
                params = [this.filters.startDate, this.filters.endDate];
            } else if (this.filters.startDate) {
                whereClause = 'WHERE DATE(s.start_time) >= ?';
                params = [this.filters.startDate];
            } else if (this.filters.endDate) {
                whereClause = 'WHERE DATE(s.start_time) <= ?';
                params = [this.filters.endDate];
            }

            // 장소별 통계 데이터 조회
            const venueStats = await window.app.dbAll(`
                SELECT 
                    s.venue,
                    COUNT(*) as total_count,
                    SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                    SUM(CASE WHEN s.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
                    MAX(s.start_time) as latest_performance,
                    GROUP_CONCAT(DISTINCT p.name) as performance_names
                FROM schedules s 
                LEFT JOIN performances p ON s.performance_id = p.id
                ${whereClause}
                GROUP BY s.venue
                ORDER BY latest_performance DESC
            `, params);

            // 전체 통계 계산
            let totalPerformances = 0;
            let totalCompleted = 0;
            let totalCancelled = 0;

            venueStats.forEach(venue => {
                totalPerformances += venue.total_count;
                totalCompleted += venue.completed_count;
                totalCancelled += venue.cancelled_count;
            });

            // 상단 통계 업데이트
            this.updateSummaryStats(totalPerformances, totalCompleted, totalCancelled);

            // 각 장소별 상세 정보 조회
            this.venues = await Promise.all(venueStats.map(async (venue) => {
                // 해당 장소의 최근 공연 목록
                const recentPerformances = await window.app.dbAll(`
                    SELECT s.*, p.name as performance_name
                    FROM schedules s 
                    LEFT JOIN performances p ON s.performance_id = p.id
                    WHERE s.venue = ? ${whereClause ? 'AND ' + whereClause.replace('WHERE ', '') : ''}
                    ORDER BY s.start_time DESC
                    LIMIT 10
                `, [venue.venue, ...params]);

                return {
                    ...venue,
                    recentPerformances
                };
            }));

            this.renderVenues();

        } catch (error) {
            console.error('공연 현황 로딩 실패:', error);
            const container = document.getElementById('performance-stats-list');
            window.app.showError(container, '공연 현황을 불러오는데 실패했습니다.');
        }
    }

    updateSummaryStats(total, completed, cancelled) {
        document.getElementById('total-performances').textContent = total;
        document.getElementById('completed-performances').textContent = completed;
        document.getElementById('cancelled-performances').textContent = cancelled;
    }

    renderVenues() {
        const container = document.getElementById('performance-stats-list');
        
        // 검색 필터 적용
        let filteredVenues = this.venues;
        if (this.filters.venueSearch) {
            filteredVenues = this.venues.filter(venue => 
                venue.venue.toLowerCase().includes(this.filters.venueSearch.toLowerCase())
            );
        }

        // 정렬 적용
        filteredVenues.sort((a, b) => {
            switch (this.filters.sortOption) {
                case 'recent':
                    return new Date(b.latest_performance) - new Date(a.latest_performance);
                case 'completed':
                    return b.completed_count - a.completed_count;
                case 'cancelled':
                    return b.cancelled_count - a.cancelled_count;
                default:
                    return 0;
            }
        });

        if (filteredVenues.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>공연 현황이 없습니다</h3>
                    <p>검색 조건을 확인해주세요.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredVenues.map(venue => this.renderVenueItem(venue)).join('');
    }

    renderVenueItem(venue) {
        const latestDate = venue.latest_performance ? 
            window.app.formatDateTime(venue.latest_performance) : '없음';
        
        const performanceNames = venue.performance_names ? 
            venue.performance_names.split(',').filter((name, index, arr) => arr.indexOf(name) === index) : [];

        const recentList = venue.recentPerformances.slice(0, 5).map(perf => {
            const statusText = this.getStatusText(perf.status);
            const statusClass = perf.status;
            return `
                <div class="performance-list-item">
                    <span class="status-${statusClass}">${statusText}</span> 
                    ${window.app.formatDateTime(perf.start_time)} - ${perf.performance_name}
                </div>
            `;
        }).join('');

        return `
            <div class="performance-stats-item">
                <div class="stats-venue-header">
                    <h3 class="venue-name">${venue.venue}</h3>
                    <div class="venue-summary">
                        <div class="summary-item">
                            <span class="summary-label">총 공연</span>
                            <span class="summary-value">${venue.total_count}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">완료</span>
                            <span class="summary-value completed">${venue.completed_count}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">취소</span>
                            <span class="summary-value cancelled">${venue.cancelled_count}</span>
                        </div>
                    </div>
                </div>
                
                <div class="venue-details">
                    <div class="detail-section">
                        <h4>최근 공연</h4>
                        <div class="recent-performance">
                            <strong>일시:</strong> ${latestDate}
                        </div>
                        <div class="recent-performance">
                            <strong>공연:</strong> ${performanceNames.slice(0, 3).join(', ')}
                            ${performanceNames.length > 3 ? ` 외 ${performanceNames.length - 3}개` : ''}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>최근 공연 목록</h4>
                        <div class="performance-list">
                            ${recentList || '<div class="performance-list-item">공연 기록이 없습니다.</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getStatusText(status) {
        switch (status) {
            case 'completed': return '완료';
            case 'cancelled': return '취소';
            case 'pending': return '예정';
            default: return '알 수 없음';
        }
    }

    async refresh() {
        await this.loadPerformanceStats();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.performanceStatsManager = new PerformanceStatsManager();
});