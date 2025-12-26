// ==UserScript==
// @name         Diamond Valley Auto Fishing
// @namespace    http://tampermonkey.net/
// @version      2025-12-24
// @description  Auto fishing in Diamond Valley. Sit back, relax, and let the fish come to you.
// @author       HearSilent
// @match        https://diamondvalley.withgoogle.com/intl/ALL_tw/game/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    let pressCount = 0,
        isRunning = false,
        isPanelExpanded = true;
    let stream = null,
        video = null,
        canvas = null;

    const BRIGHT_GREEN_R = 60,
        BRIGHT_GREEN_G = 220,
        BRIGHT_GREEN_B = 0;
    const DARK_GREEN_R = 4,
        DARK_GREEN_G = 111,
        DARK_GREEN_B = 0;
    const TOLERANCE = 50;

    function isGreen(r, g, b) {
        const brightDist = Math.abs(r - BRIGHT_GREEN_R) + Math.abs(g - BRIGHT_GREEN_G) + Math.abs(b - BRIGHT_GREEN_B);
        const darkDist = Math.abs(r - DARK_GREEN_R) + Math.abs(g - DARK_GREEN_G) + Math.abs(b - DARK_GREEN_B);
        return brightDist < TOLERANCE || darkDist < TOLERANCE;
    }

    function isArrow(r, g, b) {
        return !isGreen(r, g, b) && r > 100 && g > 30 && b < 100;
    }

    function updateBtnState() {
        startBtn.disabled = isRunning;
        startBtn.style.opacity = isRunning ? '0.5' : '1';
        startBtn.style.cursor = isRunning ? 'not-allowed' : 'pointer';
        stopBtn.disabled = !isRunning;
        stopBtn.style.opacity = !isRunning ? '0.5' : '1';
        stopBtn.style.cursor = !isRunning ? 'not-allowed' : 'pointer';
    }

    function createControlPanel() {
        const containerDiv = document.createElement('div');
        containerDiv.id = 'arrow-panel-container';
        containerDiv.style.cssText = 'position: fixed; left: 0; top: 50%; transform: translateY(-50%); z-index: 10000; font-family: Arial, sans-serif; user-select: none;';

        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'arrow-toggle-btn';
        toggleBtn.style.cssText = 'position: absolute; left: 0; top: 0; width: 40px; height: 40px; background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); border: 2px solid #0f3460; border-radius: 0 12px 12px 0; display: none; align-items: center; justify-content: center; cursor: pointer; color: #00d4ff; font-size: 20px; font-weight: bold; user-select: none;';
        toggleBtn.textContent = '◀';
        toggleBtn.onmouseover = () => toggleBtn.style.background = 'linear-gradient(135deg, #1a5490 0%, #1e6bb8 100%)';
        toggleBtn.onmouseout = () => toggleBtn.style.background = 'linear-gradient(135deg, #0f3460 0%, #16213e 100%)';

        const panel = document.createElement('div');
        panel.id = 'arrow-control-panel';
        panel.style.cssText = 'background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 2px solid #0f3460; border-radius: 0 12px 12px 0; padding: 20px; box-shadow: 2px 8px 32px rgba(0, 0, 0, 0.5); min-width: 300px; color: #e0e0e0; cursor: grab; max-height: 600px; opacity: 1; overflow: visible;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 15px; text-align: center; color: #00d4ff; border-bottom: 2px solid #0f3460; padding-bottom: 10px; cursor: grab; user-select: none;';
        title.textContent = '超鑽姜太公';
        panel.appendChild(title);

        const statusDiv = document.createElement('div');
        statusDiv.id = 'arrow-status';
        statusDiv.style.cssText = 'margin-bottom: 15px; padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 6px; font-size: 11px; line-height: 2;';
        statusDiv.innerHTML = '<div>狀態: <span style="color: #ff4444;">⭕ 已停止</span></div><div>按下次數: <span style="color: #00ff00;">0</span></div><div>在綠色: <span style="color: #ffaa00;">-</span></div>';
        panel.appendChild(statusDiv);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 15px;';

        const startBtn = document.createElement('button');
        startBtn.textContent = '▶ 啟動';
        startBtn.style.cssText = 'flex: 1; padding: 10px; background: #00aa44; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;';
        startBtn.onmouseover = () => startBtn.style.background = '#00dd66';
        startBtn.onmouseout = () => startBtn.style.background = '#00aa44';

        const stopBtn = document.createElement('button');
        stopBtn.textContent = '⏹ 停止';
        stopBtn.style.cssText = 'flex: 1; padding: 10px; background: #aa0000; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;';
        stopBtn.onmouseover = () => stopBtn.style.background = '#dd0000';
        stopBtn.onmouseout = () => stopBtn.style.background = '#aa0000';

        buttonContainer.appendChild(startBtn);
        buttonContainer.appendChild(stopBtn);
        panel.appendChild(buttonContainer);

        const collapseBtn = document.createElement('button');
        collapseBtn.textContent = '收折面板';
        collapseBtn.style.cssText = 'width: 100%; padding: 10px; background: #333333; color: #cccccc; border: 1px solid #555555; border-radius: 6px; cursor: pointer; font-size: 12px;';
        collapseBtn.onmouseover = () => {
            collapseBtn.style.background = '#444444';
            collapseBtn.style.color = '#ffffff';
        };
        collapseBtn.onmouseout = () => {
            collapseBtn.style.background = '#333333';
            collapseBtn.style.color = '#cccccc';
        };
        panel.appendChild(collapseBtn);

        containerDiv.appendChild(toggleBtn);
        containerDiv.appendChild(panel);
        document.body.appendChild(containerDiv);

        let isMouseDown = false,
            startX, startY, startLeft, startTop;
        title.onmousedown = (e) => {
            isMouseDown = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = containerDiv.offsetLeft;
            startTop = containerDiv.offsetTop;
            title.style.cursor = 'grabbing';
        };
        document.onmousemove = (e) => {
            if (!isMouseDown) return;
            containerDiv.style.left = (startLeft + e.clientX - startX) + 'px';
            containerDiv.style.top = (startTop + e.clientY - startY) + 'px';
            containerDiv.style.transform = 'none';
        };
        document.onmouseup = () => {
            if (isMouseDown) {
                isMouseDown = false;
                title.style.cursor = 'grab';
            }
        };

        collapseBtn.onclick = () => {
            isPanelExpanded = false;
            panel.style.maxHeight = '0px';
            panel.style.opacity = '0';
            panel.style.overflow = 'hidden';
            panel.style.padding = '0px';
            toggleBtn.style.display = 'flex';
        };
        toggleBtn.onclick = () => {
            isPanelExpanded = true;
            panel.style.maxHeight = '600px';
            panel.style.opacity = '1';
            panel.style.overflow = 'visible';
            panel.style.padding = '20px';
            toggleBtn.style.display = 'none';
        };

        return {
            containerDiv,
            panel,
            toggleBtn,
            statusDiv,
            startBtn,
            stopBtn,
            title
        };
    }

    function updateStatus(inGreen = null) {
        const statusDiv = document.getElementById('arrow-status');
        if (statusDiv) {
            const statusText = isRunning ? '🟢 運行中' : '⭕ 已停止';
            const statusColor = isRunning ? '#00ff00' : '#ff4444';
            const greenText = inGreen === null ? '-' : (inGreen ? '✅ 是' : '❌ 否');
            const greenColor = inGreen === null ? '#ffaa00' : (inGreen ? '#00ff00' : '#ff4444');
            statusDiv.innerHTML = `<div>狀態: <span style="color: ${statusColor};">${statusText}</span></div><div>按下次數: <span style="color: #00ff00;">${pressCount}</span></div><div>在綠色: <span style="color: ${greenColor};">${greenText}</span></div>`;
        }
    }

    async function initializeScreenCapture() {
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: "browser"
                },
                audio: false,
                selfBrowserSurface: "include"
            });
            video = document.createElement('video');
            video.srcObject = stream;
            video.play();
            video.style.display = 'none';
            document.body.appendChild(video);
            canvas = document.createElement('canvas');
            canvas.style.display = 'none';
            document.body.appendChild(canvas);
            await new Promise(r => video.onloadedmetadata = r);
            console.log('✅ 螢幕捕捉已初始化');
            return true;
        } catch (err) {
            console.error('❌ 初始化失敗:', err);
            return false;
        }
    }

    function detectArrowInGreen() {
        if (!video || !canvas) return null;
        try {
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            let greenYList = [];
            for (let y = Math.floor(canvas.height * 0.3); y < Math.floor(canvas.height * 0.6); y += 5) {
                let greenCnt = 0;
                for (let x = 0; x < canvas.width; x += 20) {
                    const img = ctx.getImageData(x, y, 1, 1);
                    const d = img.data;
                    if (d[3] > 200 && isGreen(d[0], d[1], d[2])) greenCnt++;
                }
                if (greenCnt > 3) greenYList.push(y);
            }
            if (greenYList.length === 0) return null;
            const greenYMin = Math.min(...greenYList),
                greenYMax = Math.max(...greenYList),
                greenYCenter = Math.floor((greenYMin + greenYMax) / 2);
            let greenXMin = -1,
                greenXMax = -1;
            for (let x = 0; x < canvas.width; x += 2) {
                const img = ctx.getImageData(x, greenYCenter, 1, 1);
                const d = img.data;
                if (d[3] > 200 && isGreen(d[0], d[1], d[2])) {
                    if (greenXMin === -1) greenXMin = x;
                    greenXMax = x;
                }
            }
            if (greenXMin === -1) return null;
            for (let x = greenXMin; x <= greenXMax; x += 1) {
                for (let y = greenYMin; y <= greenYMax; y += 2) {
                    const img = ctx.getImageData(x, y, 1, 1);
                    const d = img.data;
                    if (d[3] > 200 && isArrow(d[0], d[1], d[2])) return true;
                }
            }
            return false;
        } catch (e) {
            return null;
        }
    }

    function pressXKey() {
        const eventDown = new KeyboardEvent('keydown', {
            key: 'x',
            code: 'KeyX',
            keyCode: 88,
            which: 88,
            bubbles: true,
            cancelable: true
        });
        window.dispatchEvent(eventDown);
        document.dispatchEvent(eventDown);
        setTimeout(() => {
            const eventUp = new KeyboardEvent('keyup', {
                key: 'x',
                code: 'KeyX',
                keyCode: 88,
                which: 88,
                bubbles: true,
                cancelable: true
            });
            window.dispatchEvent(eventUp);
            document.dispatchEvent(eventUp);
        }, 50);
    }

    async function autoClickLoop() {
        while (isRunning) {
            const inGreen = detectArrowInGreen();

            // 如果檢測失敗，等待後重試
            if (inGreen === null) {
                updateStatus(null);
                console.log('⏸️ 未找到綠色區間，等待...');

                // 隨機延遲 0-500ms
                const delay = Math.floor(Math.random() * 500);
                console.log(`⏱️ 延遲 ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));

                // 延遲後再按一次
                pressXKey();
                continue;
            }

            updateStatus(inGreen);

            if (inGreen) {
                console.log(`✅ 按下 X (Count: ${pressCount + 1})`);
                pressXKey();
                pressCount++;

                await new Promise(r => setTimeout(r, 250));
            } else {
                await new Promise(r => setTimeout(r, 32));
            }
        }
    }

    window.startAutoPress = async function() {
        if (isRunning) return;
        if (!video) {
            if (!await initializeScreenCapture()) return;
        }
        isRunning = true;
        pressCount = 0;
        updateBtnState();
        console.log('🚀 已啟動');
        updateStatus(null);
        autoClickLoop();
    };

    window.stopAutoPress = function() {
        isRunning = false;
        updateStatus(null);
        updateBtnState();
        console.log('⏹️ 已停止');
    };

    const {
        containerDiv,
        panel,
        toggleBtn,
        statusDiv,
        startBtn,
        stopBtn
    } = createControlPanel();
    startBtn.onclick = window.startAutoPress;
    stopBtn.onclick = window.stopAutoPress;
    updateStatus();
    updateBtnState();
    console.log('✨ 系統已準備就緒');
})();
