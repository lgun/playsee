const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const Database = require('./src/js/database');

let mainWindow;
let database;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        // icon: path.join(__dirname, 'assets/icon.ico') // 아이콘 파일이 없을 때 주석 처리
    });

    mainWindow.loadFile('src/index.html');

    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    const template = [
        {
            label: '파일',
            submenu: [
                {
                    label: '종료',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '편집',
            submenu: [
                { role: 'undo', label: '실행 취소' },
                { role: 'redo', label: '다시 실행' },
                { type: 'separator' },
                { role: 'cut', label: '잘라내기' },
                { role: 'copy', label: '복사' },
                { role: 'paste', label: '붙여넣기' }
            ]
        },
        {
            label: '보기',
            submenu: [
                { role: 'reload', label: '새로 고침' },
                { role: 'forcereload', label: '강제 새로 고침' },
                { role: 'toggledevtools', label: '개발자 도구' },
                { type: 'separator' },
                { role: 'resetzoom', label: '실제 크기' },
                { role: 'zoomin', label: '확대' },
                { role: 'zoomout', label: '축소' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: '전체 화면' }
            ]
        },
        {
            label: '도움말',
            submenu: [
                {
                    label: 'Playsee 정보',
                    click: () => {
                        const { dialog } = require('electron');
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Playsee 정보',
                            message: 'Playsee v1.0.0',
                            detail: '극단 공연 스케줄 및 단원 배분 관리 프로그램'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
    try {
        database = new Database();
        await database.init();
        createWindow();
    } catch (error) {
        console.error('애플리케이션 초기화 실패:', error);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    if (database) {
        await database.close();
    }
});

ipcMain.handle('db-run', async (event, sql, params) => {
    try {
        return await database.run(sql, params);
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('db-get', async (event, sql, params) => {
    try {
        return await database.get(sql, params);
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('db-all', async (event, sql, params) => {
    try {
        return await database.all(sql, params);
    } catch (error) {
        throw error;
    }
});