// 브라우저 콘솔에서 실행 - 캘린더 날짜 디버깅

function debugCalendarDates() {
    const today = new Date();
    console.log('=== 날짜 디버깅 ===');
    console.log('현재 시간:', today.toString());
    console.log('오늘 날짜:', today.toDateString());
    console.log('요일 번호:', today.getDay(), '(0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토)');
    console.log('실제 요일:', ['일', '월', '화', '수', '목', '금', '토'][today.getDay()]);
    
    // 9월 캘린더 확인
    const year = 2024;
    const month = 8; // 9월 (0-based)
    
    console.log('\n=== 9월 캘린더 확인 ===');
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    console.log('9월 1일:', firstDay.toDateString(), '요일:', firstDay.getDay());
    console.log('9월 마지막일:', lastDay.toDateString(), '요일:', lastDay.getDay());
    
    // 월간 캘린더 시작/끝 날짜 계산
    const startDate = new Date(firstDay);
    if (firstDay.getDay() === 0) { // 일요일이면 다음 날로
        startDate.setDate(firstDay.getDate() + 1);
    } else {
        startDate.setDate(firstDay.getDate() - (firstDay.getDay() - 1));
    }
    
    const endDate = new Date(lastDay);
    if (lastDay.getDay() === 0) { // 일요일이면 전날로
        endDate.setDate(lastDay.getDate() - 1);
    } else {
        endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    }
    
    console.log('캘린더 시작일:', startDate.toDateString(), '요일:', startDate.getDay());
    console.log('캘린더 종료일:', endDate.toDateString(), '요일:', endDate.getDay());
    
    // 첫 주 날짜들 확인
    console.log('\n=== 첫 주 날짜들 ===');
    let currentDate = new Date(startDate);
    const days = ['월', '화', '수', '목', '금', '토'];
    
    for (let i = 0; i < 6; i++) {
        const dayOfWeek = currentDate.getDay();
        const expectedDay = (i + 1) % 7; // 월=1, 화=2, ..., 토=6
        
        console.log(`${days[i]}: ${currentDate.getDate()}일 (실제요일: ${dayOfWeek}, 기대요일: ${expectedDay})`);
        
        if (dayOfWeek !== expectedDay) {
            console.warn(`⚠️ 요일 불일치! ${days[i]}에 ${currentDate.getDate()}일이 오면 안됨`);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

// 실행
debugCalendarDates();