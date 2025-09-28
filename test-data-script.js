// 테스트 데이터 생성 스크립트 - 브라우저 콘솔에서 실행

async function createTestData() {
    console.log('테스트 데이터 생성 시작...');
    
    try {
        // 1. 기존 데이터 확인
        const existingPerformances = await window.app.dbAll('SELECT * FROM performances');
        const existingMembers = await window.app.dbAll('SELECT * FROM members');
        
        console.log('기존 공연:', existingPerformances.length, '개');
        console.log('기존 단원:', existingMembers.length, '명');
        
        // 2. 테스트용 공연 추가
        const performances = [
            { name: '햄릿', roles: '["햄릿", "오필리아", "클로디어스"]', notes: '셰익스피어 작품' },
            { name: '로미오와 줄리엣', roles: '["로미오", "줄리엣", "머큐시오"]', notes: '사랑 이야기' },
            { name: '맥베스', roles: '["맥베스", "레이디 맥베스", "던칸"]', notes: '비극 작품' },
            { name: '리어왕', roles: '["리어왕", "코델리아", "고네릴"]', notes: '가족 갈등' }
        ];
        
        for (const perf of performances) {
            try {
                await window.app.dbRun(
                    'INSERT OR IGNORE INTO performances (name, roles, notes) VALUES (?, ?, ?)',
                    [perf.name, perf.roles, perf.notes]
                );
                console.log(`공연 추가: ${perf.name}`);
            } catch (e) {
                console.log(`공연 이미 존재: ${perf.name}`);
            }
        }
        
        // 3. 테스트용 단원 추가
        const members = [
            '김철수', '이영희', '박민수', '최지영', '정현우', 
            '조미영', '윤석진', '한소영', '임동욱', '강지은'
        ];
        
        for (const memberName of members) {
            try {
                await window.app.dbRun(
                    'INSERT OR IGNORE INTO members (name, auto_assign, max_monthly) VALUES (?, 1, 10)',
                    [memberName]
                );
                console.log(`단원 추가: ${memberName}`);
            } catch (e) {
                console.log(`단원 이미 존재: ${memberName}`);
            }
        }
        
        // 4. 최신 공연 및 단원 목록 가져오기
        const allPerformances = await window.app.dbAll('SELECT * FROM performances');
        const allMembers = await window.app.dbAll('SELECT * FROM members');
        
        // 5. 9월 테스트 스케줄 생성
        const schedules = [
            // 9월 2일 (월) - 햄릿 단독
            {
                date: '2024-09-02',
                call_time: '08:00',
                start_time: '10:00',
                performance: '햄릿',
                venue: '대학로 소극장'
            },
            // 9월 3일 (화) - 로미오와 줄리엣 두 시간대
            {
                date: '2024-09-03',
                call_time: '08:30',
                start_time: '10:00',
                performance: '로미오와 줄리엣',
                venue: '홍대 아트센터'
            },
            {
                date: '2024-09-03',
                call_time: '09:00',
                start_time: '14:00',
                performance: '로미오와 줄리엣',
                venue: '홍대 아트센터'
            },
            // 9월 4일 (수) - 같은 공연 다른 팀
            {
                date: '2024-09-04',
                call_time: '08:00',
                start_time: '11:00',
                performance: '햄릿',
                venue: '강남 문화회관'
            },
            {
                date: '2024-09-04',
                call_time: '08:30',
                start_time: '11:00',
                performance: '햄릿',
                venue: '종로구민회관'
            },
            // 9월 5일 (목) - 다양한 공연
            {
                date: '2024-09-05',
                call_time: '08:00',
                start_time: '10:00',
                performance: '맥베스',
                venue: '성동구 문화회관'
            },
            {
                date: '2024-09-05',
                call_time: '09:00',
                start_time: '12:00',
                performance: '리어왕',
                venue: '마포 아트센터'
            },
            // 9월 6일 (금) - 복합 스케줄
            {
                date: '2024-09-06',
                call_time: '08:00',
                start_time: '10:00',
                performance: '햄릿',
                venue: '대학로 소극장'
            },
            {
                date: '2024-09-06',
                call_time: '08:30',
                start_time: '11:00',
                performance: '로미오와 줄리엣',
                venue: '홍대 아트센터'
            },
            {
                date: '2024-09-06',
                call_time: '09:00',
                start_time: '14:00',
                performance: '맥베스',
                venue: '강남 문화회관'
            },
            // 9월 7일 (토) - 주말 공연
            {
                date: '2024-09-07',
                call_time: '08:00',
                start_time: '10:00',
                performance: '리어왕',
                venue: '세종문화회관'
            },
            {
                date: '2024-09-07',
                call_time: '08:30',
                start_time: '14:00',
                performance: '리어왕',
                venue: '세종문화회관'
            },
            // 9월 9일 (월) - 새로운 주
            {
                date: '2024-09-09',
                call_time: '08:00',
                start_time: '11:00',
                performance: '햄릿',
                venue: '종로구민회관'
            },
            // 9월 10일 (화) - 다중 공연 다중 시간
            {
                date: '2024-09-10',
                call_time: '08:00',
                start_time: '10:00',
                performance: '맥베스',
                venue: '대학로 소극장'
            },
            {
                date: '2024-09-10',
                call_time: '08:30',
                start_time: '12:00',
                performance: '맥베스',
                venue: '대학로 소극장'
            },
            {
                date: '2024-09-10',
                call_time: '09:00',
                start_time: '14:00',
                performance: '로미오와 줄리엣',
                venue: '홍대 아트센터'
            }
        ];
        
        // 6. 스케줄 생성
        for (const schedule of schedules) {
            const performance = allPerformances.find(p => p.name === schedule.performance);
            if (!performance) {
                console.log(`공연을 찾을 수 없음: ${schedule.performance}`);
                continue;
            }
            
            const callDateTime = `${schedule.date} ${schedule.call_time}:00`;
            const startDateTime = `${schedule.date} ${schedule.start_time}:00`;
            
            try {
                const result = await window.app.dbRun(
                    'INSERT INTO schedules (call_time, start_time, performance_id, venue) VALUES (?, ?, ?, ?)',
                    [callDateTime, startDateTime, performance.id, schedule.venue]
                );
                
                console.log(`스케줄 생성: ${schedule.date} ${schedule.start_time} ${schedule.performance} @ ${schedule.venue}`);
                
                // 7. 임의 단원 배정 (각 스케줄에 2-3명)
                const shuffledMembers = [...allMembers].sort(() => Math.random() - 0.5);
                const assignCount = Math.floor(Math.random() * 2) + 2; // 2-3명
                
                for (let i = 0; i < assignCount; i++) {
                    const member = shuffledMembers[i];
                    const roles = JSON.parse(performance.roles);
                    const role = roles[i % roles.length];
                    
                    try {
                        await window.app.dbRun(
                            'INSERT INTO assignments (schedule_id, member_id, role, is_manual) VALUES (?, ?, ?, 1)',
                            [result.id, member.id, role]
                        );
                        console.log(`  - ${member.name}: ${role}`);
                    } catch (e) {
                        console.log(`  - 배정 실패: ${member.name}`);
                    }
                }
                
            } catch (e) {
                console.error(`스케줄 생성 실패: ${schedule.date} ${schedule.performance}`, e);
            }
        }
        
        console.log('테스트 데이터 생성 완료!');
        
        // 8. 캘린더 새로고침
        if (window.calendar) {
            await window.calendar.refresh();
            console.log('캘린더 새로고침 완료');
        }
        
    } catch (error) {
        console.error('테스트 데이터 생성 중 오류:', error);
    }
}

// 실행 함수
createTestData();