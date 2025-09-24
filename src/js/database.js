const Database_BetterSqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class Database {
    constructor() {
        this.db = null;
    }

    init() {
        try {
            const dbDir = path.join(__dirname, '../../database');
            const dbPath = path.join(dbDir, 'playsee.db');
            
            // 데이터베이스 디렉토리가 없으면 생성
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            
            this.db = new Database_BetterSqlite3(dbPath);
            console.log('SQLite 데이터베이스 연결 성공');
            this.createTables();
            return Promise.resolve();
        } catch (err) {
            console.error('데이터베이스 연결 실패:', err);
            return Promise.reject(err);
        }
    }

    createTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS performances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                roles TEXT NOT NULL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                auto_assign BOOLEAN DEFAULT 1,
                max_monthly INTEGER DEFAULT 10,
                avoid_times TEXT,
                avoid_days TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS member_performances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER,
                performance_id INTEGER,
                available_roles TEXT,
                FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
                FOREIGN KEY (performance_id) REFERENCES performances (id) ON DELETE CASCADE,
                UNIQUE(member_id, performance_id)
            )`,
            `CREATE TABLE IF NOT EXISTS schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_time DATETIME NOT NULL,
                start_time DATETIME NOT NULL,
                performance_id INTEGER NOT NULL,
                venue TEXT NOT NULL,
                driver_id INTEGER,
                vehicle_type TEXT,
                equipment_list TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (performance_id) REFERENCES performances (id) ON DELETE CASCADE,
                FOREIGN KEY (driver_id) REFERENCES members (id) ON DELETE SET NULL
            )`,
            `CREATE TABLE IF NOT EXISTS assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schedule_id INTEGER NOT NULL,
                member_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                is_manual BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (schedule_id) REFERENCES schedules (id) ON DELETE CASCADE,
                FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
                UNIQUE(schedule_id, role)
            )`,
            `CREATE TABLE IF NOT EXISTS personal_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL,
                date DATE NOT NULL,
                reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
                UNIQUE(member_id, date)
            )`
        ];

        try {
            // 외래 키 제약 조건 활성화
            this.db.pragma('foreign_keys = ON');
            
            tables.forEach((sql) => {
                this.db.exec(sql);
            });
            
            // 기존 데이터베이스에 새 컬럼 추가 (마이그레이션)
            this.migrateDatabase();
            
            console.log('모든 테이블 생성 완료');
        } catch (err) {
            console.error('테이블 생성 실패:', err);
            throw err;
        }
    }

    migrateDatabase() {
        try {
            // schedules 테이블에 새 컬럼들이 있는지 확인하고 없으면 추가
            const tableInfo = this.db.pragma('table_info(schedules)');
            const columnNames = tableInfo.map(col => col.name);
            
            if (!columnNames.includes('driver_id')) {
                this.db.exec('ALTER TABLE schedules ADD COLUMN driver_id INTEGER');
                console.log('driver_id 컬럼 추가됨');
            }
            
            if (!columnNames.includes('vehicle_type')) {
                this.db.exec('ALTER TABLE schedules ADD COLUMN vehicle_type TEXT');
                console.log('vehicle_type 컬럼 추가됨');
            }
            
            if (!columnNames.includes('equipment_list')) {
                this.db.exec('ALTER TABLE schedules ADD COLUMN equipment_list TEXT');
                console.log('equipment_list 컬럼 추가됨');
            }
        } catch (err) {
            console.error('데이터베이스 마이그레이션 실패:', err);
        }
    }

    run(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            const result = stmt.run(params);
            return Promise.resolve({ id: result.lastInsertRowid, changes: result.changes });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    get(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            const result = stmt.get(params);
            return Promise.resolve(result);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    all(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            const result = stmt.all(params);
            return Promise.resolve(result);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    close() {
        try {
            if (this.db) {
                this.db.close();
                console.log('데이터베이스 연결 종료');
            }
            return Promise.resolve();
        } catch (err) {
            return Promise.reject(err);
        }
    }
}

module.exports = Database;