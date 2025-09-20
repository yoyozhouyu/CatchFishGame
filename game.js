// 海底狩猎游戏 - 主游戏引擎
// Underwater Hunting Game - Main Game Engine

class UnderwaterHuntingGame {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.gameWidth = 0;
        this.gameHeight = 0;
        
        // 游戏状态
        this.gameState = 'loading'; // loading, playing, paused, unconscious
        this.lastTime = 0;
        this.deltaTime = 0;
        
        // 设备检测
        this.isMobile = this.detectMobile();
        this.isPC = !this.isMobile;
        
        // 游戏对象
        this.player = null;
        this.fishes = [];
        this.obstacles = [];
        this.harpoon = null;
        this.fishingLine = null;
        this.particles = [];

        // 游戏资源
        this._coins = 125; // 初始金币（私有变量）

        // 游戏统计
        this.gameStats = {
            startTime: Date.now(),
            fishCaught: 0,
            totalCoinsEarned: 0,
            lineBreaks: 0,
            unconsciousCount: 0,
            totalRescueCost: 0,
            maxDepthReached: 0,
            playTime: 0
        };

        // 水域分层系统
        this.waterZones = {
            zone1: {
                unlocked: true,
                cost: 0,
                startDepth: 0.15,
                endDepth: 0.5,
                name: '浅水区域',
                fishTypes: ['small']
            },
            zone2: {
                unlocked: false,
                cost: 150,
                startDepth: 0.5,
                endDepth: 0.75,
                name: '中水区域',
                fishTypes: ['small', 'big']
            },
            zone3: {
                unlocked: false,
                cost: 300,
                startDepth: 0.75,
                endDepth: 1.0,
                name: '深水区域',
                fishTypes: ['small', 'big', 'octopus']
            }
        };

        // 解锁提示状态
        this.unlockPrompt = null;
        this.unlockPromptCooldown = {}; // 解锁提示冷却时间

        // 教程系统
        this.tutorial = {
            step: 0, // 0: 移动教程, 1: 射击教程, 2: 完成
            moveCompleted: false,
            shootCompleted: false,
            startTime: 0
        };

        // 第一次中鱼提示
        this.firstCatchTip = {
            shown: false,
            startTime: 0
        };
        
        // 输入系统
        this.input = {
            keys: {},
            mouse: { x: 0, y: 0, pressed: false },
            touch: { active: false, x: 0, y: 0 },
            joystick: { active: false, x: 0, y: 0, centerX: 0, centerY: 0 },
            shootButton: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 },
            pulling: false // 移动端拉拽状态
        };
        
        // 游戏设置
        this.settings = {
            targetFPS: 60,
            gravity: 0.3,
            waterResistance: 0.98,
            maxHarpoonDistance: 300,
            lineMaxDurability: 100,
            showCollisionBoxes: false,
            musicEnabled: true,
            musicVolume: 0.3
        };

        // 音频系统
        this.audio = {
            bgm: null,
            isPlaying: false,
            isMuted: false
        };

        // 图片资源系统
        this.images = {};
        this.imagesLoaded = false;

        // 初始化游戏
        this.init();
    }

    // 金币的getter和setter，用于监控所有金币变化
    get coins() {
        return this._coins;
    }

    set coins(value) {
        const oldValue = this._coins;
        this._coins = Math.max(0, value); // 确保金币不会为负数
        if (oldValue !== this._coins) {
            console.log(`金币变化: ${oldValue} -> ${this._coins} (变化: ${this._coins - oldValue})`);
        }
    }

    // 预加载图片资源
    async loadImages() {
        const imageList = [
            // 背景
            { key: 'background', src: 'res/scence/haidi_bg.png' },

            // 主角序列帧动画
            ...Array.from({ length: 22 }, (_, i) => ({
                key: `hero_idle_${i}`,
                src: `res/hero/action/idle/idle_${i}.png`
            })),

            // 猎物
            { key: 'fish_small', src: 'res/monster/xiaoyu.png' },
            { key: 'fish_big', src: 'res/monster/dayu.png' },
            { key: 'fish_octopus', src: 'res/monster/zhangyu.png' },

            // 障碍物
            { key: 'obstacle', src: 'res/monster/zuai.png' }
        ];

        const loadPromises = imageList.map(({ key, src }) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.images[key] = img;
                    console.log(`图片加载成功: ${key}`);
                    resolve();
                };
                img.onerror = () => {
                    console.error(`图片加载失败: ${src}`);
                    reject(new Error(`Failed to load image: ${src}`));
                };
                img.src = src;
            });
        });

        try {
            await Promise.all(loadPromises);
            this.imagesLoaded = true;
            console.log('所有图片资源加载完成');
        } catch (error) {
            console.error('图片资源加载失败:', error);
            throw error;
        }
    }

    // 加载音效资源
    async loadSounds() {
        this.sounds = {};
        const soundList = [
            { key: 'shoot', src: 'res/sound/SEffect/SEffect_shoot_01.wav' }
        ];

        const soundPromises = soundList.map(({ key, src }) => {
            return new Promise((resolve) => {
                const audio = new Audio();
                audio.oncanplaythrough = () => {
                    this.sounds[key] = audio;
                    console.log(`音效加载成功: ${key}`);
                    resolve();
                };
                audio.onerror = () => {
                    console.warn(`音效加载失败: ${src}`);
                    resolve(); // 即使失败也继续
                };
                audio.src = src;
            });
        });

        try {
            await Promise.all(soundPromises);
            console.log('所有音效资源加载完成');
        } catch (error) {
            console.warn('音效资源加载失败:', error);
        }
    }

    // 检测设备类型
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0);
    }
    
    // 初始化游戏
    async init() {
        try {
            console.log('开始初始化游戏...');

            console.log('设置画布...');
            this.setupCanvas();

            console.log('设置事件监听器...');
            this.setupEventListeners();

            console.log('设置UI...');
            this.setupUI();

            console.log('预加载图片资源...');
            await this.loadImages();

            console.log('预加载音效资源...');
            await this.loadSounds();

            console.log('创建游戏对象...');
            this.createGameObjects();

            console.log('初始化音频系统...');
            this.initAudio();

            console.log('游戏初始化完成，准备启动...');

            // 隐藏加载界面
            setTimeout(() => {
                console.log('隐藏加载界面，启动游戏循环...');
                document.getElementById('loadingScreen').style.display = 'none';
                this.gameState = 'playing';

                // 启动教程
                this.tutorial.startTime = Date.now();

                this.gameLoop();
                console.log('游戏启动成功！');
            }, 1000);

        } catch (error) {
            console.error('游戏初始化失败:', error);
            // 显示错误信息给用户
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.innerHTML = `
                    <div style="color: #ff6b6b; text-align: center;">
                        <h2>游戏加载失败</h2>
                        <p>错误信息: ${error.message}</p>
                        <p>请刷新页面重试</p>
                    </div>
                `;
            }
        }
    }

    // 初始化音频系统
    initAudio() {
        try {
            // 创建背景音乐音频对象
            this.audio.bgm = new Audio('haidi_bgm.mp3');
            this.audio.bgm.loop = true; // 循环播放
            this.audio.bgm.volume = this.settings.musicVolume;

            // 音频加载完成后的处理
            this.audio.bgm.addEventListener('loadeddata', () => {
                console.log('背景音乐加载完成');
            });

            // 音频播放错误处理
            this.audio.bgm.addEventListener('error', (e) => {
                console.warn('背景音乐加载失败:', e);
                this.settings.musicEnabled = false;
            });

            // 由于浏览器的自动播放策略，需要用户交互后才能播放
            // 我们将在用户首次点击时启动音乐
            this.setupAudioInteraction();

        } catch (error) {
            console.warn('音频系统初始化失败:', error);
            this.settings.musicEnabled = false;
        }
    }

    // 设置音频交互
    setupAudioInteraction() {
        const startAudio = () => {
            if (this.settings.musicEnabled && !this.audio.isPlaying) {
                this.playBackgroundMusic();
            }
            // 移除事件监听器，只需要触发一次
            document.removeEventListener('click', startAudio);
            document.removeEventListener('touchstart', startAudio);
            document.removeEventListener('keydown', startAudio);
        };

        // 监听用户交互事件
        document.addEventListener('click', startAudio);
        document.addEventListener('touchstart', startAudio);
        document.addEventListener('keydown', startAudio);
    }

    // 播放背景音乐
    playBackgroundMusic() {
        if (this.audio.bgm && this.settings.musicEnabled && !this.audio.isMuted) {
            this.audio.bgm.play().then(() => {
                this.audio.isPlaying = true;
                console.log('背景音乐开始播放');
            }).catch(error => {
                console.warn('背景音乐播放失败:', error);
            });
        }
    }

    // 暂停背景音乐
    pauseBackgroundMusic() {
        if (this.audio.bgm && this.audio.isPlaying) {
            this.audio.bgm.pause();
            this.audio.isPlaying = false;
            console.log('背景音乐已暂停');
        }
    }

    // 切换音乐静音状态
    toggleMute() {
        this.audio.isMuted = !this.audio.isMuted;

        if (this.audio.bgm) {
            this.audio.bgm.muted = this.audio.isMuted;
        }

        console.log('音乐静音状态:', this.audio.isMuted ? '开启' : '关闭');
        return this.audio.isMuted;
    }

    // 设置音乐音量
    setMusicVolume(volume) {
        this.settings.musicVolume = Math.max(0, Math.min(1, volume));

        if (this.audio.bgm) {
            this.audio.bgm.volume = this.settings.musicVolume;
        }

        console.log('音乐音量设置为:', this.settings.musicVolume);
    }

    // 设置画布
    setupCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 设置画布尺寸
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 禁用右键菜单
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }
    
    // 调整画布尺寸
    resizeCanvas() {
        const container = document.getElementById('gameContainer');
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // 计算适合的游戏尺寸（保持16:9比例）
        const aspectRatio = 9 / 16; // 竖屏比例
        let gameWidth = containerWidth * 0.9;
        let gameHeight = gameWidth / aspectRatio;
        
        if (gameHeight > containerHeight * 0.9) {
            gameHeight = containerHeight * 0.9;
            gameWidth = gameHeight * aspectRatio;
        }
        
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        
        this.canvas.width = gameWidth;
        this.canvas.height = gameHeight;
        this.canvas.style.width = gameWidth + 'px';
        this.canvas.style.height = gameHeight + 'px';
        
        // 设置高DPI支持
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = gameWidth * dpr;
        this.canvas.height = gameHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = gameWidth + 'px';
        this.canvas.style.height = gameHeight + 'px';
    }
    
    // 设置UI
    setupUI() {
        const gameContainer = document.getElementById('gameContainer');
        
        if (this.isPC) {
            gameContainer.classList.add('pc-mode');
            document.getElementById('pcControls').style.display = 'block';
            document.getElementById('mobileControls').style.display = 'none';
        } else {
            gameContainer.classList.remove('pc-mode');
            document.getElementById('pcControls').style.display = 'none';
            document.getElementById('mobileControls').style.display = 'block';
        }
    }
    
    // 设置事件监听器
    setupEventListeners() {
        if (this.isPC) {
            this.setupPCControls();
        } else {
            this.setupMobileControls();
        }
    }
    
    // PC端控制设置
    setupPCControls() {
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            this.input.keys[e.code] = true;
            // 切换碰撞盒显示（按C键）
            if (e.code === 'KeyC') {
                this.settings.showCollisionBoxes = !this.settings.showCollisionBoxes;
                console.log('碰撞盒显示:', this.settings.showCollisionBoxes ? '开启' : '关闭');
            }
        });

        document.addEventListener('keyup', (e) => {
            this.input.keys[e.code] = false;
        });
        
        // 鼠标事件
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.input.mouse.x = (e.clientX - rect.left) * (this.gameWidth / rect.width);
            this.input.mouse.y = (e.clientY - rect.top) * (this.gameHeight / rect.height);
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // 左键
                this.input.mouse.pressed = true;
                // 如果有鱼线且未断裂，则用于拉拽；否则用于射击
                if (this.fishingLine && !this.fishingLine.broken) {
                    console.log('开始拉拽鱼线...');
                } else {
                    this.handleShoot();
                }
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.input.mouse.pressed = false;
                if (this.fishingLine && !this.fishingLine.broken) {
                    console.log('停止拉拽鱼线...');
                }
            }
        });
    }
    
    // 移动端控制设置
    setupMobileControls() {
        this.setupVirtualJoystick();
        this.setupMobileButtons();
    }
    
    // 虚拟摇杆设置
    setupVirtualJoystick() {
        const joystick = document.getElementById('virtualJoystick');
        const knob = document.getElementById('joystickKnob');
        const joystickRect = joystick.getBoundingClientRect();
        
        this.input.joystick.centerX = joystickRect.left + joystickRect.width / 2;
        this.input.joystick.centerY = joystickRect.top + joystickRect.height / 2;
        
        const handleJoystickMove = (clientX, clientY) => {
            const deltaX = clientX - this.input.joystick.centerX;
            const deltaY = clientY - this.input.joystick.centerY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const maxDistance = 35; // 摇杆最大移动距离
            
            if (distance <= maxDistance) {
                this.input.joystick.x = deltaX / maxDistance;
                this.input.joystick.y = deltaY / maxDistance;
                knob.style.transform = `translate(${deltaX - 25}px, ${deltaY - 25}px)`;
            } else {
                const angle = Math.atan2(deltaY, deltaX);
                this.input.joystick.x = Math.cos(angle);
                this.input.joystick.y = Math.sin(angle);
                knob.style.transform = `translate(${Math.cos(angle) * maxDistance - 25}px, ${Math.sin(angle) * maxDistance - 25}px)`;
            }
        };
        
        const resetJoystick = () => {
            this.input.joystick.active = false;
            this.input.joystick.x = 0;
            this.input.joystick.y = 0;
            knob.style.transform = 'translate(-50%, -50%)';
        };
        
        // 触摸事件
        joystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.input.joystick.active = true;
            const touch = e.touches[0];
            handleJoystickMove(touch.clientX, touch.clientY);
        });
        
        joystick.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.input.joystick.active) {
                const touch = e.touches[0];
                handleJoystickMove(touch.clientX, touch.clientY);
            }
        });
        
        joystick.addEventListener('touchend', (e) => {
            e.preventDefault();
            resetJoystick();
        });
        
        // 鼠标事件（用于PC端测试）
        joystick.addEventListener('mousedown', (e) => {
            this.input.joystick.active = true;
            handleJoystickMove(e.clientX, e.clientY);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.input.joystick.active) {
                handleJoystickMove(e.clientX, e.clientY);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.input.joystick.active) {
                resetJoystick();
            }
        });
    }

    // 设置拉拽按钮
    setupPullButton() {
        const pullButton = document.getElementById('pullButton');
        if (!pullButton) return; // 如果没有拉拽按钮元素就跳过

        pullButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.fishingLine && !this.fishingLine.broken) {
                this.input.pulling = true;
                pullButton.classList.add('active');
            }
        });

        pullButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.input.pulling = false;
            pullButton.classList.remove('active');
        });

        // PC端鼠标支持
        pullButton.addEventListener('mousedown', (e) => {
            if (this.fishingLine && !this.fishingLine.broken) {
                this.input.pulling = true;
                pullButton.classList.add('active');
            }
        });

        pullButton.addEventListener('mouseup', (e) => {
            this.input.pulling = false;
            pullButton.classList.remove('active');
        });
    }
    
    // 移动端按钮设置
    setupMobileButtons() {
        // 加速按钮
        const boostButton = document.getElementById('boostButton');
        boostButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.input.keys['ShiftLeft'] = true;
        });
        
        boostButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.input.keys['ShiftLeft'] = false;
        });
        
        // 射击按钮
        this.setupShootButton();

        // 拉拽按钮
        this.setupPullButton();
    }
    
    // 射击按钮设置
    setupShootButton() {
        const shootButton = document.getElementById('shootButton');
        const buttonRect = shootButton.getBoundingClientRect();
        
        const handleShootStart = (clientX, clientY) => {
            this.input.shootButton.active = true;
            this.input.shootButton.startX = clientX;
            this.input.shootButton.startY = clientY;
            this.input.shootButton.currentX = clientX;
            this.input.shootButton.currentY = clientY;
            shootButton.classList.add('active');
        };
        
        const handleShootMove = (clientX, clientY) => {
            if (this.input.shootButton.active) {
                this.input.shootButton.currentX = clientX;
                this.input.shootButton.currentY = clientY;
            }
        };
        
        const handleShootEnd = () => {
            if (this.input.shootButton.active) {
                this.handleShoot();
                this.input.shootButton.active = false;
                shootButton.classList.remove('active');
            }
        };
        
        // 触摸事件
        shootButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleShootStart(touch.clientX, touch.clientY);
        });
        
        shootButton.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleShootMove(touch.clientX, touch.clientY);
        });
        
        shootButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleShootEnd();
        });
        
        // 鼠标事件
        shootButton.addEventListener('mousedown', (e) => {
            handleShootStart(e.clientX, e.clientY);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.input.shootButton.active) {
                handleShootMove(e.clientX, e.clientY);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (this.input.shootButton.active) {
                handleShootEnd();
            }
        });
    }

    // 创建游戏对象
    createGameObjects() {
        console.log('创建游戏对象...', 'gameWidth:', this.gameWidth, 'gameHeight:', this.gameHeight);

        // 检查画布尺寸是否已设置
        if (!this.gameWidth || !this.gameHeight) {
            throw new Error('画布尺寸未设置');
        }

        // 首先创建障碍物
        this.createObstacles();
        console.log('障碍物创建成功:', this.obstacles.length, '个障碍物');

        // 然后创建玩家 - 在水面附近出生
        const playerSpawn = this.findSafeSpawnPosition(this.gameWidth / 2, this.gameHeight * 0.2, 15);
        this.player = new Player(playerSpawn.x, playerSpawn.y, this);
        console.log('玩家创建成功（水面附近）:', this.player.x, this.player.y);

        // 最后创建鱼群 - 确保避开障碍物和玩家
        this.createFishes();
        console.log('鱼群创建成功:', this.fishes.length, '条鱼');

        // 创建粒子系统
        this.particles = [];
    }

    // 创建鱼群
    createFishes() {
        this.fishes = [];
        let successfulSpawns = 0;

        // 创建不同类型的鱼，数量翻倍
        const fishConfigs = [
            { type: 'small', count: 16, radius: 8 },
            { type: 'big', count: 8, radius: 20 },
            { type: 'octopus', count: 4, radius: 15 }
        ];

        fishConfigs.forEach(config => {
            for (let i = 0; i < config.count; i++) {
                // 根据鱼类类型确定生成区域
                let spawnDepthStart, spawnDepthEnd;

                if (config.type === 'small') {
                    // 小鱼可以在所有已解锁区域生成
                    spawnDepthStart = this.waterZones.zone1.startDepth;
                    spawnDepthEnd = this.getMaxUnlockedDepth();
                } else if (config.type === 'big') {
                    // 大鱼只在2层和3层生成
                    if (this.waterZones.zone2.unlocked) {
                        spawnDepthStart = this.waterZones.zone2.startDepth;
                        spawnDepthEnd = this.getMaxUnlockedDepth();
                    } else {
                        continue; // 如果2层未解锁，跳过大鱼生成
                    }
                } else if (config.type === 'octopus') {
                    // 章鱼只在3层生成
                    if (this.waterZones.zone3.unlocked) {
                        spawnDepthStart = this.waterZones.zone3.startDepth;
                        spawnDepthEnd = this.waterZones.zone3.endDepth;
                    } else {
                        continue; // 如果3层未解锁，跳过章鱼生成
                    }
                }

                // 尝试找到安全的出生位置
                const spawnPosition = this.findSafeSpawnPositionForFish(
                    Math.random() * (this.gameWidth - 100) + 50,
                    this.gameHeight * spawnDepthStart + Math.random() * (this.gameHeight * (spawnDepthEnd - spawnDepthStart)),
                    config.radius,
                    100 // 最大尝试次数
                );

                if (spawnPosition) {
                    this.fishes.push(new Fish(spawnPosition.x, spawnPosition.y, config.type, this));
                    successfulSpawns++;
                } else {
                    console.warn(`无法为${config.type}类型的鱼找到安全出生位置，跳过生成`);
                }
            }
        });

        console.log(`成功生成 ${successfulSpawns} 条鱼`);
    }

    // 获取最大已解锁深度
    getMaxUnlockedDepth() {
        if (this.waterZones.zone3.unlocked) return this.waterZones.zone3.endDepth;
        if (this.waterZones.zone2.unlocked) return this.waterZones.zone2.endDepth;
        return this.waterZones.zone1.endDepth; // 只有zone1解锁
    }

    // 检查水域解锁
    checkZoneUnlock(currentDepthPercent) {
        // 检查是否需要解锁zone2
        if (!this.waterZones.zone2.unlocked && currentDepthPercent >= this.waterZones.zone2.startDepth) {
            this.showUnlockPrompt('zone2');
            return;
        }

        // 检查是否需要解锁zone3
        if (!this.waterZones.zone3.unlocked && currentDepthPercent >= this.waterZones.zone3.startDepth) {
            this.showUnlockPrompt('zone3');
            return;
        }
    }

    // 显示解锁提示
    showUnlockPrompt(zoneId) {
        console.log(`🌊 显示解锁提示: ${zoneId}`);

        // 防止重复显示
        if (this.unlockPrompt) {
            console.log('⚠️ 解锁提示已存在，跳过显示');
            return;
        }

        // 检查冷却时间（60秒）
        const currentTime = Date.now();
        const cooldownTime = 60000; // 60秒

        if (this.unlockPromptCooldown[zoneId] &&
            currentTime - this.unlockPromptCooldown[zoneId] < cooldownTime) {
            return; // 还在冷却中
        }

        // 记录提示时间
        this.unlockPromptCooldown[zoneId] = currentTime;

        const zone = this.waterZones[zoneId];

        // 创建动态更新的提示界面
        this.createUnlockPrompt(zoneId, zone);
    }

    // 创建解锁提示界面
    createUnlockPrompt(zoneId, zone) {
        const hasEnoughCoins = this.coins >= zone.cost;
        console.log(`创建解锁界面: zoneId=${zoneId}, 当前金币=${this.coins}, 需要金币=${zone.cost}, 足够=${hasEnoughCoins}`);

        // 创建提示界面
        const promptDiv = document.createElement('div');
        promptDiv.id = 'unlockPrompt';
        promptDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            z-index: 1000;
            border: 2px solid #4CAF50;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
        `;

        // 更新界面内容
        this.updateUnlockPromptContent(promptDiv, zoneId, zone, hasEnoughCoins);

        document.body.appendChild(promptDiv);
        this.unlockPrompt = promptDiv;

        // 绑定事件（只绑定一次，使用事件委托）
        this.bindUnlockPromptEvents(promptDiv, zoneId);

        // 不使用定时更新，避免事件绑定被清除
        // 解锁界面显示时的金币状态就是最终状态
    }

    // 更新解锁提示内容
    updateUnlockPromptContent(promptDiv, zoneId, zone, hasEnoughCoins) {
        console.log(`更新解锁界面: zoneId=${zoneId}, 当前金币=${this.coins}, 需要金币=${zone.cost}, 足够=${hasEnoughCoins}`);
        promptDiv.innerHTML = `
            <h2 style="color: #4CAF50; margin-bottom: 20px;">🌊 发现新水域</h2>
            <p style="font-size: 1.2em; margin-bottom: 15px;">${zone.name}</p>
            <p style="margin-bottom: 20px;">解锁费用: <strong style="color: #ffd700;">${zone.cost} 金币</strong></p>
            <p class="coin-display" style="margin-bottom: 20px;">当前金币: <strong style="color: ${hasEnoughCoins ? '#4CAF50' : '#ff4444'};">${this.coins} 金币</strong></p>

            <div class="button-container">
                ${hasEnoughCoins ? `
                    <button id="unlockYes" style="
                        background: #4CAF50;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        margin: 5px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1em;
                    ">确定解锁</button>
                    <button id="unlockNo" style="
                        background: #f44336;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        margin: 5px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1em;
                    ">取消</button>
                ` : `
                    <p style="color: #ff4444; margin-bottom: 15px;">请先获得足够的金币！</p>
                    <button id="unlockClose" style="
                        background: #666;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1em;
                    ">关闭</button>
                `}
            </div>
        `;

        // 事件绑定已移到单独的函数中
    }

    // 绑定解锁提示事件（只绑定一次）
    bindUnlockPromptEvents(promptDiv, zoneId) {
        const gameInstance = this;
        console.log(`🔗 绑定解锁提示事件, zoneId: ${zoneId}`);

        // 使用事件委托，监听整个提示框的点击事件
        promptDiv.onclick = function(event) {
            const target = event.target;
            console.log(`🖱️ 点击了元素: ${target.id}, 标签: ${target.tagName}`);

            if (target.id === 'unlockYes') {
                console.log(`=== 点击解锁按钮 ===`);
                console.log(`zoneId: ${zoneId}`);
                console.log(`当前游戏实例:`, gameInstance);
                console.log(`当前金币: ${gameInstance.coins}`);
                console.log(`金币类型: ${typeof gameInstance.coins}`);
                console.log(`需要金币: ${gameInstance.waterZones[zoneId].cost}`);
                console.log(`需要金币类型: ${typeof gameInstance.waterZones[zoneId].cost}`);
                try {
                    gameInstance.unlockZone(zoneId);
                } catch (error) {
                    console.error('解锁过程中发生错误:', error);
                }
            } else if (target.id === 'unlockNo') {
                console.log('点击取消按钮');
                gameInstance.closeUnlockPrompt();
            } else if (target.id === 'unlockClose') {
                console.log('点击关闭按钮');
                gameInstance.closeUnlockPrompt();
            }
        };
    }

    // 只更新内容，不重新绑定事件
    updateUnlockPromptContentOnly(promptDiv, zoneId, zone, hasEnoughCoins) {
        console.log(`更新解锁界面内容: zoneId=${zoneId}, 当前金币=${this.coins}, 需要金币=${zone.cost}, 足够=${hasEnoughCoins}`);

        // 只更新金币显示，不重新创建整个HTML结构
        const coinElement = promptDiv.querySelector('.coin-display');
        if (coinElement) {
            coinElement.innerHTML = `当前金币: <strong style="color: ${hasEnoughCoins ? '#4CAF50' : '#ff4444'};">${this.coins} 金币</strong>`;
        }

        // 根据金币是否足够，显示或隐藏相应的按钮
        const buttonContainer = promptDiv.querySelector('.button-container');
        if (buttonContainer) {
            if (hasEnoughCoins) {
                buttonContainer.innerHTML = `
                    <button id="unlockYes" style="
                        background: #4CAF50;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        margin: 5px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1em;
                    ">确定解锁</button>
                    <button id="unlockNo" style="
                        background: #f44336;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        margin: 5px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1em;
                    ">取消</button>
                `;
            } else {
                buttonContainer.innerHTML = `
                    <p style="color: #ff4444; margin-bottom: 15px;">请先获得足够的金币！</p>
                    <button id="unlockClose" style="
                        background: #666;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1em;
                    ">关闭</button>
                `;
            }
        }
    }

    // 解锁水域
    unlockZone(zoneId) {
        console.log(`=== 开始解锁水域 ${zoneId} ===`);
        const zone = this.waterZones[zoneId];
        console.log(`水域信息:`, zone);
        console.log(`当前金币: ${this.coins}, 需要金币: ${zone.cost}`);
        console.log(`金币是否足够: ${this.coins >= zone.cost}`);

        if (this.coins >= zone.cost) {
            console.log(`开始扣除金币...`);
            // 扣除金币
            const oldCoins = this.coins;
            this.coins -= zone.cost;
            console.log(`金币扣除完成: ${oldCoins} -> ${this.coins}`);

            // 解锁区域
            console.log(`开始解锁区域...`);
            zone.unlocked = true;
            console.log(`区域解锁状态: ${zone.unlocked}`);

            // 显示解锁成功提示
            console.log(`显示解锁成功提示...`);
            this.addFloatingText(this.player.x, this.player.y - 50, `${zone.name}已解锁！`, '#4CAF50');

            // 重新生成鱼类
            console.log(`重新生成鱼类...`);
            this.createFishes();

            console.log(`${zone.name}已解锁，花费${zone.cost}金币，剩余金币: ${this.coins}`);
        } else {
            console.log(`金币不足，无法解锁！当前: ${this.coins}, 需要: ${zone.cost}`);
        }

        console.log(`关闭解锁提示界面...`);
        this.closeUnlockPrompt();
        console.log(`=== 解锁水域操作完成 ===`);
    }

    // 关闭解锁提示
    closeUnlockPrompt() {
        console.log('开始关闭解锁提示界面...');
        if (this.unlockPrompt) {
            try {
                document.body.removeChild(this.unlockPrompt);
                this.unlockPrompt = null;
                console.log('✅ 解锁提示界面已关闭');
            } catch (error) {
                console.error('❌ 关闭解锁提示界面失败:', error);
                this.unlockPrompt = null; // 强制清空引用
            }
        } else {
            console.log('⚠️ 解锁提示界面不存在，无需关闭');
        }
    }

    // 显示第一次中鱼提示
    showFirstCatchTip() {
        if (this.firstCatchTip.shown) return;

        this.firstCatchTip.shown = true;
        this.firstCatchTip.startTime = Date.now();

        // 添加飘字提示
        this.addFloatingText(
            this.player.x,
            this.player.y - 80,
            '打到鱼可以拉回水面，增加金币！',
            '#4CAF50',
            3000 // 显示3秒
        );

        console.log('显示第一次中鱼提示');
    }

    // 创建障碍物
    createObstacles() {
        this.obstacles = [];

        // 移除海底地面障碍物
        // 移除海草障碍物
        // 移除珊瑚礁障碍物

        // 分层障碍物分布 - 越靠近水底越多

        // 水面层（30-45%深度）- 少量漂浮物
        for (let i = 0; i < 6; i++) {
            const x = Math.random() * (this.gameWidth - 60) + 30;
            const y = this.gameHeight * 0.2 + Math.random() * (this.gameHeight * 0.15);
            const size = 15 + Math.random() * 10;
            this.obstacles.push(new Obstacle(
                x,
                y,
                size,
                size,
                'circle',
                'floating_debris',
                this
            ));
        }

        // 中上层（45-70%深度）- 中等数量海藻团
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * (this.gameWidth - 100) + 50;
            const y = this.gameHeight * 0.35 + Math.random() * (this.gameHeight * 0.25);
            const size = 18 + Math.random() * 12;
            this.obstacles.push(new Obstacle(
                x,
                y,
                size,
                size,
                'circle',
                'floating_seaweed',
                this
            ));
        }

        // 中层（70-85%深度）- 较多岩石和海藻
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * (this.gameWidth - 80) + 40;
            const y = this.gameHeight * 0.6 + Math.random() * (this.gameHeight * 0.15);

            if (Math.random() < 0.6) {
                // 60%概率生成岩石
                const width = 25 + Math.random() * 20;
                const height = 20 + Math.random() * 15;
                this.obstacles.push(new Obstacle(
                    x,
                    y,
                    width,
                    height,
                    'rectangle',
                    'sea_rock',
                    this
                ));
            } else {
                // 40%概率生成海藻团
                const size = 20 + Math.random() * 15;
                this.obstacles.push(new Obstacle(
                    x,
                    y,
                    size,
                    size,
                    'circle',
                    'floating_seaweed',
                    this
                ));
            }
        }

        // 深层（85-100%深度）- 大量障碍物
        for (let i = 0; i < 12; i++) {
            const x = Math.random() * (this.gameWidth - 80) + 40;
            const y = this.gameHeight * 0.85 + Math.random() * (this.gameHeight * 0.15);

            if (Math.random() < 0.7) {
                // 70%概率生成岩石（深层岩石更多更大）
                const width = 30 + Math.random() * 25;
                const height = 25 + Math.random() * 20;
                this.obstacles.push(new Obstacle(
                    x,
                    y,
                    width,
                    height,
                    'rectangle',
                    'sea_rock',
                    this
                ));
            } else {
                // 30%概率生成大型海藻团
                const size = 25 + Math.random() * 20;
                this.obstacles.push(new Obstacle(
                    x,
                    y,
                    size,
                    size,
                    'circle',
                    'floating_seaweed',
                    this
                ));
            }
        }

        // 沉船残骸（放置在深层，符合沉船应该在海底的逻辑）
        // 第一艘沉船 - 深层
        const shipX = this.gameWidth * (0.2 + Math.random() * 0.6);
        const shipY = this.gameHeight * (0.9 + Math.random() * 0.08); // 90-98%深度
        this.obstacles.push(new Obstacle(
            shipX,
            shipY,
            60,
            25,
            'rectangle',
            'shipwreck',
            this
        ));

        // 第二艘沉船 - 也在深层
        const shipX2 = this.gameWidth * (0.2 + Math.random() * 0.6);
        const shipY2 = this.gameHeight * (0.9 + Math.random() * 0.08); // 90-98%深度
        this.obstacles.push(new Obstacle(
            shipX2,
            shipY2,
            60,
            25,
            'rectangle',
            'shipwreck',
            this
        ));
    }

    // 处理射击
    handleShoot() {
        if (this.harpoon && this.harpoon.active) return; // 已经有鱼枪在飞行

        let targetX, targetY;

        if (this.isPC) {
            targetX = this.input.mouse.x;
            targetY = this.input.mouse.y;
        } else {
            // 移动端：根据射击按钮的拖拽方向计算目标
            const deltaX = this.input.shootButton.currentX - this.input.shootButton.startX;
            const deltaY = this.input.shootButton.currentY - this.input.shootButton.startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance < 20) {
                // 如果拖拽距离太小，向前射击
                targetX = this.player.x;
                targetY = this.player.y - 100;
            } else {
                // 根据拖拽方向计算目标点
                const angle = Math.atan2(deltaY, deltaX);
                targetX = this.player.x + Math.cos(angle) * 200;
                targetY = this.player.y + Math.sin(angle) * 200;
            }
        }

        // 播放射击音效
        if (this.sounds && this.sounds.shoot) {
            try {
                this.sounds.shoot.currentTime = 0; // 重置播放位置
                this.sounds.shoot.play().catch(e => {
                    console.warn('音效播放失败:', e);
                });
            } catch (error) {
                console.warn('音效播放错误:', error);
            }
        }

        // 创建鱼枪
        this.harpoon = new Harpoon(this.player.x, this.player.y, targetX, targetY, this);
    }

    // 游戏主循环
    gameLoop(currentTime = 0) {
        if (this.gameState !== 'playing') {
            // 昏厥状态下仍需要继续渲染，但不更新游戏逻辑
            if (this.gameState === 'unconscious') {
                this.render();
                requestAnimationFrame((time) => this.gameLoop(time));
                return;
            }
            // 游戏结束状态下停止循环
            if (this.gameState === 'gameOver') {
                return;
            }
            // 其他状态继续循环但不更新游戏逻辑
            requestAnimationFrame((time) => this.gameLoop(time));
            return;
        }

        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // 限制帧率
        if (this.deltaTime < 1000 / this.settings.targetFPS) {
            requestAnimationFrame((time) => this.gameLoop(time));
            return;
        }

        this.update();
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    // 更新游戏状态
    update() {
        // 更新玩家
        this.player.update();

        // 更新鱼群
        this.fishes.forEach(fish => fish.update());

        // 更新鱼枪
        if (this.harpoon) {
            this.harpoon.update();
            if (!this.harpoon.active && !this.harpoon.connected) {
                this.harpoon = null;
            }
        }

        // 更新鱼线
        if (this.fishingLine) {
            this.fishingLine.update();
            if (this.fishingLine.broken) {
                console.log('鱼线断裂！返回水面可补充鱼线');
                // 更新统计数据
                this.gameStats.lineBreaks++;
                this.fishingLine = null;
                // 重置补充标记，允许补充
                this.player.lineReplenished = false;
                // 注意：不重置渔枪，让玩家返回水面补充
            }
        }

        // 更新粒子
        this.particles = this.particles.filter(particle => {
            particle.update();
            return particle.life > 0;
        });

        // 更新UI状态
        this.updateUIState();

        // 更新教程
        this.updateTutorial();

        // 更新UI
        this.updateUI();
    }

    // 更新教程
    updateTutorial() {
        if (this.tutorial.step >= 2) return; // 教程已完成

        // 检查移动是否完成
        if (this.tutorial.step === 0 && !this.tutorial.moveCompleted) {
            const hasMovement = Object.values(this.input.keys).some(pressed => pressed) ||
                               this.input.joystick.active ||
                               (Math.abs(this.player.vx) > 0.1 || Math.abs(this.player.vy) > 0.1);

            if (hasMovement) {
                this.tutorial.moveCompleted = true;
                this.tutorial.step = 1;
                console.log('移动教程完成，进入射击教程');
            }
        }

        // 检查射击是否完成
        if (this.tutorial.step === 1 && !this.tutorial.shootCompleted) {
            if (this.harpoon || this.fishingLine) {
                this.tutorial.shootCompleted = true;
                this.tutorial.step = 2;
                console.log('射击教程完成，教程结束');
            }
        }
    }

    // 渲染游戏
    render() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);

        // 绘制背景
        this.renderBackground();

        // 绘制障碍物（在背景之后，其他对象之前）
        this.obstacles.forEach(obstacle => obstacle.render(this.ctx));

        // 绘制鱼线（在其他对象之前）
        if (this.fishingLine) {
            this.fishingLine.render(this.ctx);
        }

        // 绘制鱼群
        this.fishes.forEach(fish => fish.render(this.ctx));

        // 绘制玩家
        this.player.render(this.ctx);

        // 绘制鱼枪
        if (this.harpoon) {
            this.harpoon.render(this.ctx);
        }

        // 绘制粒子
        this.particles.forEach(particle => particle.render(this.ctx));

        // 绘制碰撞盒（调试模式）
        if (this.settings.showCollisionBoxes) {
            this.renderCollisionBoxes();
        }

        // 绘制瞄准线
        this.renderAimLine();

        // 绘制水域迷雾
        this.renderWaterZoneFog();

        // 绘制教程提示
        this.renderTutorial();

        // 绘制UI
        this.renderUI();
    }

    // 渲染碰撞盒（调试用）
    renderCollisionBoxes() {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        this.ctx.lineWidth = 2;

        // 绘制玩家碰撞盒
        if (this.player) {
            this.ctx.beginPath();
            this.ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // 绘制鱼类碰撞盒
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
        this.fishes.forEach(fish => {
            this.ctx.beginPath();
            this.ctx.arc(fish.x, fish.y, fish.radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });

        // 绘制障碍物碰撞盒
        this.ctx.strokeStyle = 'rgba(0, 0, 255, 0.7)';
        this.obstacles.forEach(obstacle => {
            obstacle.renderCollisionBox(this.ctx);
        });

        // 绘制鱼枪碰撞盒
        if (this.harpoon && this.harpoon.active) {
            this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
            this.ctx.beginPath();
            this.ctx.arc(this.harpoon.x, this.harpoon.y, 3, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    // 渲染UI
    renderUI() {
        this.ctx.save();

        // 渲染金币栏
        this.renderCoinBar();

        // 渲染氧气条（顶部中间）
        this.renderOxygenBar();

        // 渲染体力条（只在不满时显示）
        if (this.player.stamina < this.player.maxStamina) {
            this.renderStaminaBar();
        }

        // 渲染拉拽状态提示
        if (this.fishingLine && !this.fishingLine.broken) {
            this.renderPullPrompt();
        }

        // 鱼线信息已移除，不再显示张力长度等信息

        // 渲染鱼线断裂提示
        if (!this.fishingLine && this.harpoon && !this.harpoon.active) {
            this.renderLineRepairPrompt();
        }

        // 渲染氧气警告闪烁效果
        this.renderOxygenWarning();

        // 渲染制作者信息
        this.renderCreatorInfo();

        this.ctx.restore();
    }

    // 渲染金币栏（移到左上角）
    renderCoinBar() {
        const x = 20;
        const y = 20;
        const width = 80;
        const height = 35;

        // 背景
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(x - 5, y - 5, width + 10, height + 10);

        // 金币图标背景
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
        this.ctx.beginPath();
        this.ctx.arc(x + 18, y + 18, 12, 0, Math.PI * 2);
        this.ctx.fill();

        // 金币图标
        this.ctx.fillStyle = 'rgba(255, 165, 0, 1)';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('¥', x + 18, y + 23);

        // 金币数量
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${this.coins}`, x + 35, y + 23);

        // 金币标签
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '11px Arial';
        this.ctx.fillText('', x + 35 + this.ctx.measureText(`${this.coins}`).width + 8, y + 23);

        this.ctx.textAlign = 'left';
    }

    // 渲染制作者信息
    renderCreatorInfo() {
        this.ctx.save();

        // 设置字体和颜色
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.textAlign = 'left';

        // 在左下角显示制作者信息
        const x = 10;
        const y = this.gameHeight - 10;
        this.ctx.fillText('zy制作', x, y);

        this.ctx.restore();
    }

    // 渲染氧气条（顶部中间，类似图1的胶囊形状）
    renderOxygenBar() {
        const centerX = this.gameWidth / 2;
        const y = 15;
        const barWidth = 200;
        const barHeight = 20;
        const x = centerX - barWidth / 2;

        // 计算氧气百分比
        const oxygenPercent = this.player.oxygen / this.player.maxOxygen;

        // 外边框（深色）
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.beginPath();
        this.ctx.roundRect(x - 2, y - 2, barWidth + 4, barHeight + 4, 12);
        this.ctx.fill();

        // 内边框（浅色）
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.roundRect(x - 1, y - 1, barWidth + 2, barHeight + 2, 11);
        this.ctx.fill();

        // 背景（深蓝色）
        this.ctx.fillStyle = 'rgba(0, 50, 100, 0.8)';
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, barWidth, barHeight, 10);
        this.ctx.fill();

        // 氧气条填充
        const fillWidth = barWidth * oxygenPercent;
        if (fillWidth > 0) {
            // 根据氧气量改变颜色
            let fillColor;
            if (oxygenPercent > 0.6) {
                fillColor = '#00bfff'; // 蓝色（充足）
            } else if (oxygenPercent > 0.2) {
                fillColor = '#ffa500'; // 橙色（警告）
            } else {
                fillColor = '#ff4444'; // 红色（危险）
            }

            this.ctx.fillStyle = fillColor;
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, fillWidth, barHeight, 10);
            this.ctx.fill();

            // 添加光泽效果
            const gradient = this.ctx.createLinearGradient(x, y, x, y + barHeight);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');

            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, fillWidth, barHeight, 10);
            this.ctx.fill();
        }

        // 氧气文字和数值
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('氧气', centerX, y + 14);

        // 氧气百分比（小字）
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillText(`${Math.round(oxygenPercent * 100)}%`, centerX, y + 32);

        this.ctx.textAlign = 'left';
    }

    // 渲染氧气警告闪烁效果
    renderOxygenWarning() {
        const oxygenPercent = this.player.oxygen / this.player.maxOxygen;

        // 只在氧气低于20%时显示警告
        if (oxygenPercent > 0.5) {
            return;
        }

        // 计算闪烁强度（基于时间和氧气量）
        const time = Date.now() / 1000;
        const flashSpeed = oxygenPercent < 0.1 ? 8 : 4; // 氧气越少闪烁越快
        const flashIntensity = (Math.sin(time * flashSpeed) + 1) / 2; // 0-1之间的正弦波

        // 根据氧气量调整警告强度
        const warningIntensity = (0.5 - oxygenPercent) / 0.5; // 氧气越少，警告越强
        const alpha = flashIntensity * warningIntensity * 0.7; // 最大透明度30%

        // 绘制红色边缘闪烁
        this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;

        // 顶部边缘
        this.ctx.fillRect(0, 0, this.gameWidth, 20);
        // 底部边缘
        this.ctx.fillRect(0, this.gameHeight - 20, this.gameWidth, 20);
        // 左边缘
        this.ctx.fillRect(0, 0, 20, this.gameHeight);
        // 右边缘
        this.ctx.fillRect(this.gameWidth - 20, 0, 20, this.gameHeight);

        // 在氧气条附近显示警告文字
        if (oxygenPercent < 0.1) {
            const centerX = this.gameWidth / 2;
            const warningY = 55;

            this.ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity})`;
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('⚠️ 氧气不足！', centerX, warningY);

            this.ctx.textAlign = 'left';
        }
    }

    // 渲染环形体力条（塞尔达风格，挂在主角身上）
    renderStaminaBar() {
        const centerX = this.player.x; // 环形中心跟随主角X
        const centerY = this.player.y - 60; // 环形中心在主角上方
        const radius = 25; // 环形半径（稍小一些）
        const thickness = 6; // 环形厚度

        // 计算体力百分比
        const staminaPercent = this.player.stamina / this.player.maxStamina;
        const angle = staminaPercent * Math.PI * 2; // 体力对应的角度

        this.ctx.save();

        // 绘制背景环
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.lineWidth = thickness;
        this.ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        this.ctx.stroke();

        // 绘制体力环
        if (staminaPercent > 0) {
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + angle);
            this.ctx.lineWidth = thickness;

            // 根据体力值改变颜色
            if (staminaPercent > 0.6) {
                this.ctx.strokeStyle = 'rgba(76, 175, 80, 0.9)'; // 绿色
            } else if (staminaPercent > 0.3) {
                this.ctx.strokeStyle = 'rgba(255, 193, 7, 0.9)'; // 黄色
            } else {
                this.ctx.strokeStyle = 'rgba(244, 67, 54, 0.9)'; // 红色
            }

            this.ctx.stroke();
        }

        // 绘制外边框
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius + thickness/2 + 1, 0, Math.PI * 2);
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.stroke();

        // 绘制内边框
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius - thickness/2 - 1, 0, Math.PI * 2);
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.stroke();

        // 绘制中心文字
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('体力', centerX, centerY - 5);

        // 绘制数值
        this.ctx.font = '10px Arial';
        this.ctx.fillText(`${Math.round(this.player.stamina)}`, centerX, centerY + 8);

        // 如果正在拉拽，显示消耗提示
        if (this.player.isPulling) {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('拉拽中...', centerX + radius + 15, centerY);
        }

        this.ctx.restore();
    }

    // 渲染拉拽提示
    renderPullPrompt() {
        const centerX = this.gameWidth / 2;
        const centerY = this.gameHeight - 100;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(centerX - 100, centerY - 30, 200, 60);

        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';

        if (this.isPC) {
            this.ctx.fillText('按住鼠标左键拉拽鱼线', centerX, centerY - 5);
            this.ctx.fillText('消耗体力', centerX, centerY + 15);
        } else {
            this.ctx.fillText('按住拉拽按钮', centerX, centerY - 5);
            this.ctx.fillText('消耗体力', centerX, centerY + 15);
        }

        this.ctx.textAlign = 'left';
    }

    // 渲染鱼线修复提示
    renderLineRepairPrompt() {
        const centerX = this.gameWidth / 2;
        const centerY = this.gameHeight - 150;

        this.ctx.fillStyle = 'rgba(255, 69, 0, 0.8)';
        this.ctx.fillRect(centerX - 120, centerY - 40, 240, 80);

        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';

        if (this.coins >= 10) {
            this.ctx.fillText('鱼线已断裂！', centerX, centerY - 15);
            this.ctx.fillText('返回水面补充鱼线 (-10金币)', centerX, centerY + 5);
        } else {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 1)';
            this.ctx.fillText('鱼线已断裂！', centerX, centerY - 15);
            this.ctx.fillText('金币不足，无法补充鱼线', centerX, centerY + 5);
        }

        this.ctx.textAlign = 'left';
    }

    // 更新UI状态
    updateUIState() {
        const pullButton = document.getElementById('pullButton');
        if (pullButton) {
            // 只有在有鱼线且未断裂时显示拉拽按钮
            if (this.fishingLine && !this.fishingLine.broken && !this.isPC) {
                pullButton.classList.add('visible');
            } else {
                pullButton.classList.remove('visible');
                pullButton.classList.remove('active');
                this.input.pulling = false;
            }
        }
    }

    // 渲染鱼线信息
    renderLineInfo() {
        const x = this.gameWidth - 220;
        const y = 20;

        // 背景
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(x - 10, y - 5, 210, 80);

        this.ctx.fillStyle = 'white';
        this.ctx.font = '14px Arial';

        // 鱼线耐久度
        const durabilityPercent = this.fishingLine.durability / this.fishingLine.maxDurability;
        this.ctx.fillText(`鱼线耐久: ${Math.round(durabilityPercent * 100)}%`, x, y + 15);

        // 鱼线张力
        const tensionPercent = this.fishingLine.tension * 100;
        this.ctx.fillText(`张力: ${Math.round(tensionPercent)}%`, x, y + 35);

        // 鱼线长度
        const lengthPercent = (this.fishingLine.currentLength / this.fishingLine.maxLength) * 100;
        this.ctx.fillText(`长度: ${Math.round(lengthPercent)}%`, x, y + 55);

        // 张力警告
        if (this.fishingLine.tension > 0.8) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            this.ctx.fillText('⚠️ 张力过高!', x, y + 75);
        }
    }

    // 绘制背景
    renderBackground() {
        if (this.imagesLoaded && this.images.background) {
            // 使用背景图片
            this.ctx.drawImage(this.images.background, 0, 0, this.gameWidth, this.gameHeight);
        } else {
            // 备用渐变背景
            const gradient = this.ctx.createLinearGradient(0, 0, 0, this.gameHeight);
            gradient.addColorStop(0, 'rgba(135, 206, 235, 0.3)'); // 浅蓝色（海面）
            gradient.addColorStop(0.3, 'rgba(70, 130, 180, 0.5)'); // 中蓝色
            gradient.addColorStop(0.7, 'rgba(25, 25, 112, 0.8)'); // 深蓝色
            gradient.addColorStop(1, 'rgba(0, 0, 139, 1)'); // 最深蓝色（海底）

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.gameWidth, this.gameHeight);
        }

        // 绘制气泡效果
        this.renderBubbles();

        // 绘制水面效果
        this.renderWaterSurface();
    }

    // 绘制海底地形
    renderSeafloor() {
        this.ctx.fillStyle = 'rgba(139, 69, 19, 0.8)'; // 棕色海底
        this.ctx.fillRect(0, this.gameHeight * 0.9, this.gameWidth, this.gameHeight * 0.1);

        // 绘制一些海底装饰
        this.ctx.fillStyle = 'rgba(34, 139, 34, 0.6)'; // 绿色海草
        for (let i = 0; i < 5; i++) {
            const x = (i + 1) * (this.gameWidth / 6);
            const height = 30 + Math.random() * 20;
            this.ctx.fillRect(x - 5, this.gameHeight * 0.9 - height, 10, height);
        }

        // 绘制珊瑚礁
        this.ctx.fillStyle = 'rgba(255, 127, 80, 0.7)'; // 珊瑚色
        for (let i = 0; i < 3; i++) {
            const x = (i + 1) * (this.gameWidth / 4);
            const y = this.gameHeight * 0.9;
            this.ctx.beginPath();
            this.ctx.arc(x, y - 15, 15, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    // 绘制气泡效果
    renderBubbles() {
        const time = Date.now() * 0.001;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

        for (let i = 0; i < 10; i++) {
            const x = (i * 50 + Math.sin(time + i) * 20) % this.gameWidth;
            const y = (time * 30 + i * 80) % this.gameHeight;
            const size = 2 + Math.sin(time + i) * 2;

            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    // 绘制水面效果
    renderWaterSurface() {
        const time = Date.now() * 0.001;
        const surfaceY = this.gameHeight * 0.15; // 水面位置

        // 绘制水面波纹
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        for (let x = 0; x <= this.gameWidth; x += 5) {
            const waveHeight = Math.sin((x * 0.01) + (time * 2)) * 3;
            const y = surfaceY + waveHeight;

            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();

        // 绘制水面反光
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(0, 0, this.gameWidth, surfaceY + 10);

        // 绘制阳光射线效果
        this.ctx.strokeStyle = 'rgba(255, 255, 200, 0.2)';
        this.ctx.lineWidth = 1;

        for (let i = 0; i < 5; i++) {
            const x = (i + 1) * (this.gameWidth / 6) + Math.sin(time + i) * 20;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x + Math.sin(time + i) * 30, this.gameHeight * 0.2);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    // 绘制瞄准线
    renderAimLine() {
        if (this.harpoon && this.harpoon.active) return; // 鱼枪已发射时不显示瞄准线

        let targetX, targetY;

        if (this.isPC) {
            targetX = this.input.mouse.x;
            targetY = this.input.mouse.y;
        } else if (this.input.shootButton.active) {
            const deltaX = this.input.shootButton.currentX - this.input.shootButton.startX;
            const deltaY = this.input.shootButton.currentY - this.input.shootButton.startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance > 20) {
                const angle = Math.atan2(deltaY, deltaX);
                targetX = this.player.x + Math.cos(angle) * 200;
                targetY = this.player.y + Math.sin(angle) * 200;
            } else {
                return; // 不显示瞄准线
            }
        } else {
            return; // 不显示瞄准线
        }

        // 绘制虚线瞄准线
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.x, this.player.y);
        this.ctx.lineTo(targetX, targetY);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // 重置虚线
    }

    // 更新UI
    updateUI() {
        // 更新体力条
        const staminaBar = document.getElementById('staminaBar');
        const staminaPercent = (this.player.stamina / this.player.maxStamina) * 100;
        staminaBar.style.width = staminaPercent + '%';

        // 更新氧气条
        const oxygenBar = document.getElementById('oxygenBar');
        const oxygenPercent = (this.player.oxygen / this.player.maxOxygen) * 100;
        oxygenBar.style.width = oxygenPercent + '%';

        // 鱼线耐久度条现在在canvas中渲染，不再需要更新HTML元素
    }

    // 绘制水域迷雾
    renderWaterZoneFog() {
        this.ctx.save();

        // 绘制zone2迷雾
        if (!this.waterZones.zone2.unlocked) {
            const zone2StartY = this.gameHeight * this.waterZones.zone2.startDepth;
            const zone2EndY = this.gameHeight * this.waterZones.zone2.endDepth;

            // 创建迷雾渐变
            const gradient = this.ctx.createLinearGradient(0, zone2StartY, 0, zone2EndY);
            gradient.addColorStop(0, 'rgba(100, 100, 100, 0.3)');
            gradient.addColorStop(0.5, 'rgba(80, 80, 80, 0.7)');
            gradient.addColorStop(1, 'rgba(60, 60, 60, 0.9)');

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, zone2StartY, this.gameWidth, zone2EndY - zone2StartY);

            // 添加迷雾文字
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${this.waterZones.zone2.cost}金币解锁`, this.gameWidth / 2, zone2StartY + (zone2EndY - zone2StartY) / 2);

            // 添加迷雾粒子效果
            const time = Date.now() * 0.001;
            for (let i = 0; i < 20; i++) {
                const x = (Math.sin(time + i) * 50) + this.gameWidth / 2 + (i - 10) * 30;
                const y = zone2StartY + (zone2EndY - zone2StartY) * (0.3 + Math.sin(time * 2 + i) * 0.2);

                this.ctx.fillStyle = `rgba(200, 200, 200, ${0.3 + Math.sin(time * 3 + i) * 0.2})`;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 3 + Math.sin(time * 4 + i) * 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // 绘制zone3迷雾
        if (!this.waterZones.zone3.unlocked) {
            const zone3StartY = this.gameHeight * this.waterZones.zone3.startDepth;
            const zone3EndY = this.gameHeight * this.waterZones.zone3.endDepth;

            // 创建更深的迷雾渐变
            const gradient = this.ctx.createLinearGradient(0, zone3StartY, 0, zone3EndY);
            gradient.addColorStop(0, 'rgba(50, 50, 80, 0.5)');
            gradient.addColorStop(0.5, 'rgba(30, 30, 60, 0.8)');
            gradient.addColorStop(1, 'rgba(10, 10, 40, 0.95)');

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, zone3StartY, this.gameWidth, zone3EndY - zone3StartY);

            // 添加迷雾文字
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${this.waterZones.zone3.cost}金币解锁`, this.gameWidth / 2, zone3StartY + (zone3EndY - zone3StartY) / 2);

            // 添加深海迷雾粒子效果
            const time = Date.now() * 0.001;
            for (let i = 0; i < 15; i++) {
                const x = (Math.sin(time * 0.5 + i) * 80) + this.gameWidth / 2 + (i - 7) * 40;
                const y = zone3StartY + (zone3EndY - zone3StartY) * (0.2 + Math.sin(time * 1.5 + i) * 0.3);

                this.ctx.fillStyle = `rgba(100, 100, 150, ${0.4 + Math.sin(time * 2 + i) * 0.3})`;
                this.ctx.beginPath();
                this.ctx.arc(x, y, 4 + Math.sin(time * 3 + i) * 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        this.ctx.restore();
    }

    // 渲染教程提示
    renderTutorial() {
        if (this.tutorial.step >= 2) return; // 教程已完成

        const centerX = this.gameWidth / 2;
        const topY = 80;

        this.ctx.save();

        // 闪烁效果
        const time = Date.now() * 0.003;
        const alpha = 0.7 + Math.sin(time) * 0.3;

        // 背景
        this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
        this.ctx.fillRect(centerX - 200, topY - 30, 400, 60);

        // 边框
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(centerX - 200, topY - 30, 400, 60);

        // 文字
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'center';

        if (this.tutorial.step === 0) {
            this.ctx.fillText('按 W/A/S/D 按钮，可以上下移动', centerX, topY);
        } else if (this.tutorial.step === 1) {
            this.ctx.fillText('鼠标左键可以发射和收紧鱼枪', centerX, topY);
        }

        this.ctx.restore();
    }

    // 添加粒子效果
    addParticle(x, y, type = 'bubble') {
        this.particles.push(new Particle(x, y, type));
    }

    // 收集鱼类（到达水面时）
    collectFish(fish) {
        // 获得金币
        this.coins += fish.coinValue;

        // 更新统计数据
        this.gameStats.fishCaught++;
        this.gameStats.totalCoinsEarned += fish.coinValue;

        // 创建金币飘字效果
        this.addFloatingText(fish.x, fish.y, `+${fish.coinValue}`, '#ffd700');

        // 创建收集粒子效果
        this.addParticle(fish.x, fish.y, 'coin');

        // 移除鱼类
        const fishIndex = this.fishes.indexOf(fish);
        if (fishIndex > -1) {
            this.fishes.splice(fishIndex, 1);
        }

        // 断开鱼线
        if (this.fishingLine && this.fishingLine.fish === fish) {
            this.fishingLine = null;
        }

        // 重置渔枪状态，允许再次发射
        if (this.harpoon) {
            this.harpoon = null;
        }

        console.log(`收集了${fish.type}鱼，获得${fish.coinValue}金币，总金币：${this.coins}`);
    }

    // 添加飘字效果
    addFloatingText(x, y, text, color = '#ffffff', duration = 2000) {
        this.particles.push(new FloatingText(x, y, text, color, duration));
    }

    // 触发昏厥
    triggerUnconsciousness() {
        this.gameState = 'unconscious';

        // 计算救援费用（根据当前金币的20%，最少20金币，最多50金币）
        const rescueCost = Math.max(20, Math.min(50, Math.floor(this.coins * 0.2)));

        // 显示昏厥界面
        this.showUnconsciousScreen(rescueCost);
    }

    // 显示昏厥界面
    showUnconsciousScreen(rescueCost) {
        // 先移除可能存在的旧界面
        const existingScreen = document.getElementById('unconsciousScreen');
        if (existingScreen) {
            document.body.removeChild(existingScreen);
        }

        // 创建昏厥界面元素
        const unconsciousScreen = document.createElement('div');
        unconsciousScreen.id = 'unconsciousScreen';
        unconsciousScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            color: white;
            font-family: Arial, sans-serif;
        `;

        unconsciousScreen.innerHTML = `
            <div style="text-align: center; max-width: 500px; padding: 30px;">
                <h1 style="color: #ff4444; font-size: 3em; margin-bottom: 20px;">💀 昏厥</h1>
                <p style="font-size: 1.5em; margin-bottom: 20px;">氧气耗尽，你失去了意识...</p>
                <p style="font-size: 1.2em; margin-bottom: 30px;">幸运的是，救援队及时发现了你</p>
                <div style="background: rgba(255, 68, 68, 0.2); padding: 20px; border-radius: 10px; margin-bottom: 30px;">
                    <p style="font-size: 1.3em; color: #ff4444;">救援费用: ${rescueCost} 金币</p>
                    <p style="font-size: 1em; color: #ffaa00;">剩余金币: ${Math.max(0, this.coins - rescueCost)}</p>
                </div>
                <button id="reviveButton" style="
                    background: #4CAF50;
                    border: none;
                    color: white;
                    padding: 15px 30px;
                    font-size: 1.2em;
                    border-radius: 25px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4CAF50'">
                    复活 (-${rescueCost} 金币)
                </button>
            </div>
        `;

        document.body.appendChild(unconsciousScreen);

        // 绑定复活按钮事件 (使用一次性事件监听器防止重复绑定)
        const reviveButton = document.getElementById('reviveButton');
        const handleRevive = () => {
            try {
                console.log('开始复活操作...');
                console.log(`复活操作前金币: ${this.coins}, 复活费用: ${rescueCost}`);

                // 禁用按钮防止重复点击
                reviveButton.disabled = true;
                reviveButton.textContent = '复活中...';

                // 移除事件监听器
                reviveButton.removeEventListener('click', handleRevive);

                // 先移除界面
                if (document.body.contains(unconsciousScreen)) {
                    document.body.removeChild(unconsciousScreen);
                }

                // 然后复活玩家
                this.revivePlayer(rescueCost);

                console.log('复活操作完成');
                console.log(`复活操作后金币: ${this.coins}`);
            } catch (error) {
                console.error('复活操作失败:', error);

                // 确保界面被移除
                try {
                    if (document.body.contains(unconsciousScreen)) {
                        document.body.removeChild(unconsciousScreen);
                    }
                } catch (removeError) {
                    console.error('移除复活界面失败:', removeError);
                }

                // 强制重置游戏状态，但仍要扣除金币
                console.log(`强制重置前金币: ${this.coins}`);
                this.coins = Math.max(0, this.coins - rescueCost);
                console.log(`强制重置后金币: ${this.coins}`);

                this.gameState = 'playing';
                this.player.oxygen = this.player.maxOxygen;
                this.player.stamina = this.player.maxStamina;
                this.player.x = this.gameWidth / 2;
                this.player.y = this.gameHeight * 0.16;
            }
        };

        reviveButton.addEventListener('click', handleRevive);
    }

    // 复活玩家
    revivePlayer(rescueCost) {
        try {
            console.log('开始复活玩家...');
            console.log(`复活前金币: ${this.coins}, 复活费用: ${rescueCost}`);

            // 重置游戏状态为playing
            this.gameState = 'playing';

            // 扣除金币
            const oldCoins = this.coins;
            this.coins = Math.max(0, this.coins - rescueCost);
            console.log(`复活后金币: ${this.coins}, 实际扣除: ${oldCoins - this.coins}`);

            // 更新统计数据
            this.gameStats.unconsciousCount++;
            this.gameStats.totalRescueCost += rescueCost;

            // 复活在水面附近 (调整为0.16)
            this.player.x = this.gameWidth / 2;
            this.player.y = this.gameHeight * 0.16; // 水面附近
            this.player.vx = 0;
            this.player.vy = 0;

            // 完全恢复氧气和体力
            this.player.oxygen = this.player.maxOxygen;
            this.player.stamina = this.player.maxStamina;

            // 重置玩家状态
            this.player.isAtSurface = true; // 在水面
            this.player.isBoosting = false;
            this.player.isPulling = false;
            this.player.lineReplenished = false;

            // 重置游戏状态
            this.gameState = 'playing';

            // 清理鱼线和渔枪状态
            this.fishingLine = null;
            this.harpoon = null;

            // 清理所有鱼的被捕获状态
            this.fishes.forEach(fish => {
                fish.isCaught = false;
                fish.isEscaping = false;
                fish.isFastSwimming = false;
            });

            // 显示扣费飘字
            this.addFloatingText(this.player.x, this.player.y - 50, `-${rescueCost} 救援费用`, '#ff4444');

            // 创建复活粒子效果
            for (let i = 0; i < 10; i++) {
                this.addParticle(this.player.x + (Math.random() - 0.5) * 50,
                               this.player.y + (Math.random() - 0.5) * 50, 'repair');
            }

            console.log(`玩家已复活，扣除${rescueCost}金币，剩余金币：${this.coins}`);

            // 检查金币是否足够支付最低复活费用（20金币）
            // 只有当金币少于20时才触发游戏结束
            if (this.coins < 20) {
                console.log(`金币不足20，无法支付最低复活费用，触发游戏结束`);
                setTimeout(() => {
                    this.triggerGameOver();
                }, 1000); // 延迟1秒显示游戏结束界面
            } else {
                console.log(`复活成功，剩余金币${this.coins}足够继续游戏`);
            }
        } catch (error) {
            console.error('复活玩家时发生错误:', error);

            // 强制重置基本状态
            this.gameState = 'playing';
            this.player.oxygen = this.player.maxOxygen;
            this.player.stamina = this.player.maxStamina;
            this.fishingLine = null;
            this.harpoon = null;
        }
    }

    // 自动补充鱼线（鱼线断裂后调用）
    replenishFishingLine() {
        // 检查是否有足够金币
        if (this.coins < 10) {
            console.log('金币不足，无法自动补充鱼线');
            this.addFloatingText(this.player.x, this.player.y - 30, '金币不足！', '#ff4444');
            return;
        }

        // 扣除金币
        this.coins -= 10;

        // 创建扣费飘字提示
        this.addFloatingText(this.player.x, this.player.y - 30, '-10 鱼线补充', '#ff4444');

        // 重置渔枪状态，允许再次发射
        this.harpoon = null;

        // 创建补充效果
        this.addParticle(this.player.x, this.player.y, 'repair');

        // 重置玩家的补充标记
        this.player.lineReplenished = false;

        console.log(`鱼线自动补充完成，扣除10金币，剩余金币：${this.coins}`);
    }

    // 触发游戏结束
    triggerGameOver() {
        this.gameState = 'gameOver';

        // 计算游戏时间
        this.gameStats.playTime = Date.now() - this.gameStats.startTime;

        // 显示游戏结束界面
        this.showGameOverScreen();
    }

    // 显示游戏结束界面
    showGameOverScreen() {
        // 格式化游戏时间
        const playTimeMinutes = Math.floor(this.gameStats.playTime / 60000);
        const playTimeSeconds = Math.floor((this.gameStats.playTime % 60000) / 1000);
        const playTimeText = `${playTimeMinutes}分${playTimeSeconds}秒`;

        // 计算平均每条鱼的价值
        const avgFishValue = this.gameStats.fishCaught > 0 ?
            Math.round(this.gameStats.totalCoinsEarned / this.gameStats.fishCaught) : 0;

        // 创建游戏结束界面元素
        const gameOverScreen = document.createElement('div');
        gameOverScreen.id = 'gameOverScreen';
        gameOverScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            color: white;
            font-family: Arial, sans-serif;
        `;

        gameOverScreen.innerHTML = `
            <div style="text-align: center; max-width: 600px; padding: 30px;">
                <h1 style="color: #ff4444; font-size: 3.5em; margin-bottom: 20px;">💸 游戏结束</h1>
                <p style="font-size: 1.5em; margin-bottom: 30px; color: #ffaa00;">金币耗尽，无法继续冒险...</p>

                <div style="background: rgba(255, 255, 255, 0.1); padding: 25px; border-radius: 15px; margin-bottom: 30px;">
                    <h2 style="color: #4CAF50; margin-bottom: 20px;">📊 本次游戏统计</h2>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 1.1em;">
                        <div style="text-align: left;">
                            <div style="margin: 8px 0;"><span style="color: #81C784;">🐟 捕获鱼类:</span> <strong>${this.gameStats.fishCaught}</strong> 条</div>
                            <div style="margin: 8px 0;"><span style="color: #FFD54F;">💰 总收入:</span> <strong>${this.gameStats.totalCoinsEarned}</strong> 金币</div>
                            <div style="margin: 8px 0;"><span style="color: #FF8A65;">💔 鱼线断裂:</span> <strong>${this.gameStats.lineBreaks}</strong> 次</div>
                            <div style="margin: 8px 0;"><span style="color: #F48FB1;">💀 昏厥次数:</span> <strong>${this.gameStats.unconsciousCount}</strong> 次</div>
                        </div>
                        <div style="text-align: left;">
                            <div style="margin: 8px 0;"><span style="color: #90CAF9;">⏱️ 游戏时长:</span> <strong>${playTimeText}</strong></div>
                            <div style="margin: 8px 0;"><span style="color: #A5D6A7;">📈 平均鱼价:</span> <strong>${avgFishValue}</strong> 金币</div>
                            <div style="margin: 8px 0;"><span style="color: #FFAB91;">🚑 救援费用:</span> <strong>${this.gameStats.totalRescueCost}</strong> 金币</div>
                            <div style="margin: 8px 0;"><span style="color: #CE93D8;">🏊 最大深度:</span> <strong>${Math.round(this.gameStats.maxDepthReached)}%</strong></div>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 30px;">
                    <div style="font-size: 1.2em; color: #ffaa00; margin-bottom: 10px;">
                        净收益: <strong style="color: ${this.gameStats.totalCoinsEarned - this.gameStats.totalRescueCost >= 0 ? '#4CAF50' : '#ff4444'};">
                        ${this.gameStats.totalCoinsEarned - this.gameStats.totalRescueCost}</strong> 金币
                    </div>
                    <div style="font-size: 1em; color: #aaa;">
                        (总收入 ${this.gameStats.totalCoinsEarned} - 救援费用 ${this.gameStats.totalRescueCost})
                    </div>
                </div>

                <button id="restartButton" style="
                    background: linear-gradient(45deg, #4CAF50, #45a049);
                    border: none;
                    color: white;
                    padding: 15px 40px;
                    font-size: 1.3em;
                    border-radius: 30px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(76, 175, 80, 0.4)';"
                   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(76, 175, 80, 0.3)';">
                    🔄 重新开始游戏
                </button>
            </div>
        `;

        document.body.appendChild(gameOverScreen);

        // 绑定重新开始按钮事件
        document.getElementById('restartButton').addEventListener('click', () => {
            this.restartGame();
            document.body.removeChild(gameOverScreen);
        });
    }

    // 重新开始游戏
    restartGame() {
        // 重置金币
        this._coins = 125;

        // 重置统计数据
        this.gameStats = {
            startTime: Date.now(),
            fishCaught: 0,
            totalCoinsEarned: 0,
            lineBreaks: 0,
            unconsciousCount: 0,
            totalRescueCost: 0,
            maxDepthReached: 0,
            playTime: 0
        };

        // 重置玩家状态
        this.player.x = this.gameWidth / 2;
        this.player.y = this.gameHeight * 0.2; // 水面附近
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.oxygen = this.player.maxOxygen;
        this.player.stamina = this.player.maxStamina;
        this.player.lineReplenished = false;

        // 清理游戏对象
        this.fishingLine = null;
        this.harpoon = null;
        this.particles = [];

        // 重新生成鱼类
        this.fishes = [];
        this.spawnFish();

        // 恢复游戏状态
        this.gameState = 'playing';

        // 重新播放背景音乐
        if (this.settings.musicEnabled) {
            this.playBackgroundMusic();
        }

        console.log('游戏已重新开始');
    }

    // 寻找安全的出生位置
    findSafeSpawnPosition(preferredX, preferredY, radius, maxAttempts = 50) {
        // 首先检查首选位置是否安全
        if (!this.checkObstacleCollision(preferredX, preferredY, radius)) {
            return { x: preferredX, y: preferredY };
        }

        // 如果首选位置不安全，尝试在附近寻找安全位置
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            let x, y;

            if (attempt < maxAttempts / 2) {
                // 前一半尝试：在首选位置附近搜索
                const searchRadius = 50 + attempt * 10;
                const angle = Math.random() * Math.PI * 2;
                x = preferredX + Math.cos(angle) * searchRadius;
                y = preferredY + Math.sin(angle) * searchRadius;
            } else {
                // 后一半尝试：在整个游戏区域随机搜索
                x = Math.random() * (this.gameWidth - radius * 2) + radius;
                y = Math.random() * (this.gameHeight * 0.9 - radius * 2) + radius;
            }

            // 确保位置在游戏边界内
            x = Math.max(radius, Math.min(this.gameWidth - radius, x));
            y = Math.max(radius, Math.min(this.gameHeight * 0.9 - radius, y));

            // 检查这个位置是否安全
            if (!this.checkObstacleCollision(x, y, radius)) {
                console.log(`找到安全出生位置: (${Math.round(x)}, ${Math.round(y)}) 尝试次数: ${attempt + 1}`);
                return { x, y };
            }
        }

        console.warn(`经过 ${maxAttempts} 次尝试，无法找到安全的出生位置`);
        return null;
    }

    // 检查位置是否与其他生物重叠
    checkEntityCollision(x, y, radius, excludeEntity = null) {
        // 检查与玩家的碰撞
        if (this.player && this.player !== excludeEntity) {
            const dx = x - this.player.x;
            const dy = y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < radius + this.player.radius) {
                return true;
            }
        }

        // 检查与其他鱼类的碰撞
        for (let fish of this.fishes) {
            if (fish !== excludeEntity) {
                const dx = x - fish.x;
                const dy = y - fish.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < radius + fish.radius) {
                    return true;
                }
            }
        }

        return false;
    }

    // 为鱼类寻找安全的出生位置（避开障碍物和其他生物）
    findSafeSpawnPositionForFish(preferredX, preferredY, radius, maxAttempts = 100) {
        console.log(`为鱼类寻找出生位置，当前障碍物数量: ${this.obstacles.length}`);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            let x, y;

            if (attempt < maxAttempts / 3) {
                // 前1/3尝试：在首选位置附近搜索
                const searchRadius = 30 + attempt * 5;
                const angle = Math.random() * Math.PI * 2;
                x = preferredX + Math.cos(angle) * searchRadius;
                y = preferredY + Math.sin(angle) * searchRadius;
            } else if (attempt < maxAttempts * 2 / 3) {
                // 中1/3尝试：在较大范围内搜索
                const searchRadius = 100 + (attempt - maxAttempts / 3) * 10;
                const angle = Math.random() * Math.PI * 2;
                x = preferredX + Math.cos(angle) * searchRadius;
                y = preferredY + Math.sin(angle) * searchRadius;
            } else {
                // 后1/3尝试：在整个游戏区域随机搜索
                x = Math.random() * (this.gameWidth - radius * 2) + radius;
                y = Math.random() * (this.gameHeight * 0.7) + this.gameHeight * 0.3;
            }

            // 确保位置在游戏边界内
            x = Math.max(radius, Math.min(this.gameWidth - radius, x));
            y = Math.max(radius, Math.min(this.gameHeight * 0.85 - radius, y));

            // 检查是否与障碍物碰撞（增加安全边距）
            if (this.checkObstacleCollision(x, y, radius + 5)) {
                if (attempt < 10) {
                    console.log(`尝试 ${attempt + 1}: 位置 (${Math.round(x)}, ${Math.round(y)}) 与障碍物碰撞`);
                }
                continue;
            }

            // 检查是否与其他生物碰撞
            if (this.checkEntityCollision(x, y, radius + 3)) {
                if (attempt < 10) {
                    console.log(`尝试 ${attempt + 1}: 位置 (${Math.round(x)}, ${Math.round(y)}) 与其他生物碰撞`);
                }
                continue;
            }

            // 找到安全位置
            if (attempt > 10) {
                console.log(`鱼类找到安全出生位置: (${Math.round(x)}, ${Math.round(y)}) 尝试次数: ${attempt + 1}`);
            }
            return { x, y };
        }

        console.warn(`鱼类经过 ${maxAttempts} 次尝试，无法找到安全的出生位置`);
        return null;
    }

    // 重新尝试生成鱼类
    retryFishSpawning(remainingCount, fishTypes) {
        let retrySuccessful = 0;

        for (let i = 0; i < remainingCount; i++) {
            const type = fishTypes[Math.floor(Math.random() * fishTypes.length)];

            // 根据鱼类类型确定半径
            let fishRadius;
            switch (type) {
                case 'small': fishRadius = 8; break;
                case 'big': fishRadius = 20; break;
                case 'octopus': fishRadius = 15; break;
                default: fishRadius = 12;
            }

            // 在更大的范围内尝试生成
            const spawnPosition = this.findSafeSpawnPositionForFish(
                Math.random() * this.gameWidth,
                Math.random() * (this.gameHeight * 0.7) + this.gameHeight * 0.3,
                fishRadius,
                150 // 增加尝试次数
            );

            if (spawnPosition) {
                this.fishes.push(new Fish(spawnPosition.x, spawnPosition.y, type, this));
                retrySuccessful++;
            }
        }

        console.log(`重新生成成功: ${retrySuccessful}/${remainingCount} 条鱼`);
        console.log(`最终鱼类总数: ${this.fishes.length}`);

        // 验证重新生成的鱼类位置
        this.validateFishPositions();
    }

    // 验证所有鱼类的位置
    validateFishPositions() {
        let fishInObstacles = 0;
        let totalFish = this.fishes.length;

        console.log(`开始验证 ${totalFish} 条鱼的位置...`);

        this.fishes.forEach((fish, index) => {
            const collision = this.checkObstacleCollision(fish.x, fish.y, fish.radius);
            if (collision) {
                fishInObstacles++;
                console.error(`❌ 鱼类 ${index} (${fish.type}) 在障碍物 ${collision.obstacleType} 中! 位置: (${Math.round(fish.x)}, ${Math.round(fish.y)})`);

                // 尝试修复位置
                this.fixFishPosition(fish, index);
            } else {
                console.log(`✅ 鱼类 ${index} (${fish.type}) 位置安全: (${Math.round(fish.x)}, ${Math.round(fish.y)})`);
            }
        });

        if (fishInObstacles > 0) {
            console.error(`⚠️ 发现 ${fishInObstacles}/${totalFish} 条鱼在障碍物中!`);
        } else {
            console.log(`✅ 所有 ${totalFish} 条鱼的位置都安全`);
        }
    }

    // 修复鱼类位置
    fixFishPosition(fish, index) {
        console.log(`尝试修复鱼类 ${index} 的位置...`);

        const newPosition = this.findSafeSpawnPositionForFish(
            fish.x, fish.y, fish.radius, 50
        );

        if (newPosition) {
            fish.x = newPosition.x;
            fish.y = newPosition.y;
            fish.vx = 0;
            fish.vy = 0;
            console.log(`✅ 鱼类 ${index} 位置已修复: (${Math.round(newPosition.x)}, ${Math.round(newPosition.y)})`);
        } else {
            console.error(`❌ 无法修复鱼类 ${index} 的位置，将其移除`);
            this.fishes.splice(this.fishes.indexOf(fish), 1);
        }
    }

    // 碰撞检测
    checkCollision(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (obj1.radius + obj2.radius);
    }

    // 检查与障碍物的碰撞
    checkObstacleCollision(x, y, radius) {
        if (this.obstacles.length === 0) {
            console.warn('警告：检查碰撞时障碍物数组为空');
            return null;
        }

        for (let obstacle of this.obstacles) {
            if (obstacle.checkCollision(x, y, radius)) {
                console.log(`检测到碰撞: 位置(${Math.round(x)}, ${Math.round(y)}) 半径${radius} 与障碍物 ${obstacle.obstacleType}`);
                return obstacle;
            }
        }
        return null;
    }

    // 解决与障碍物的碰撞
    resolveObstacleCollision(obj, obstacle) {
        if (obstacle.type === 'circle') {
            // 圆形障碍物碰撞解决
            const dx = obj.x - obstacle.x;
            const dy = obj.y - obstacle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = obj.radius + obstacle.width;

            if (distance < minDistance && distance > 0) {
                const overlap = minDistance - distance;
                const separationX = (dx / distance) * overlap;
                const separationY = (dy / distance) * overlap;

                obj.x += separationX;
                obj.y += separationY;

                // 减少速度以避免震荡
                obj.vx *= 0.5;
                obj.vy *= 0.5;
            }
        } else if (obstacle.type === 'rectangle') {
            // 矩形障碍物碰撞解决
            const closestX = Math.max(obstacle.x - obstacle.width / 2,
                             Math.min(obj.x, obstacle.x + obstacle.width / 2));
            const closestY = Math.max(obstacle.y - obstacle.height / 2,
                             Math.min(obj.y, obstacle.y + obstacle.height / 2));

            const dx = obj.x - closestX;
            const dy = obj.y - closestY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < obj.radius) {
                if (distance === 0) {
                    // 对象在障碍物中心，随机推出
                    obj.x += (Math.random() - 0.5) * obj.radius * 2;
                    obj.y += (Math.random() - 0.5) * obj.radius * 2;
                } else {
                    const overlap = obj.radius - distance;
                    const separationX = (dx / distance) * overlap;
                    const separationY = (dy / distance) * overlap;

                    obj.x += separationX;
                    obj.y += separationY;

                    // 减少速度以避免震荡
                    obj.vx *= 0.5;
                    obj.vy *= 0.5;
                }
            }
        }
    }
}

// 障碍物类
class Obstacle {
    constructor(x, y, width, height, type, obstacleType, game) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type; // 'circle' 或 'rectangle'
        this.obstacleType = obstacleType; // 'seafloor', 'seaweed', 'coral'
        this.game = game; // 游戏实例引用
    }

    // 检查碰撞
    checkCollision(x, y, radius) {
        if (this.type === 'circle') {
            const dx = x - this.x;
            const dy = y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const collision = distance < (radius + this.width); // width作为半径

            if (collision && Math.random() < 0.01) { // 偶尔记录碰撞信息用于调试
                console.log(`圆形障碍物碰撞: 距离${Math.round(distance)} < ${radius + this.width}`);
            }

            return collision;
        } else if (this.type === 'rectangle') {
            // 检查圆形与矩形的碰撞
            const closestX = Math.max(this.x - this.width / 2,
                             Math.min(x, this.x + this.width / 2));
            const closestY = Math.max(this.y - this.height / 2,
                             Math.min(y, this.y + this.height / 2));

            const dx = x - closestX;
            const dy = y - closestY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const collision = distance < radius;

            if (collision && Math.random() < 0.01) { // 偶尔记录碰撞信息用于调试
                console.log(`矩形障碍物碰撞: 距离${Math.round(distance)} < ${radius}`);
            }

            return collision;
        }
        return false;
    }

    // 渲染障碍物
    render(ctx) {
        if (!this.game || !this.game.imagesLoaded || !this.game.images || !this.game.images.obstacle) {
            // 图片未加载时使用原始绘制方式
            this.renderFallback(ctx);
            return;
        }

        ctx.save();

        // 使用障碍物图片
        const image = this.game.images.obstacle;

        // 根据深度调整大小
        const depthPercent = this.y / this.game.gameHeight;
        let size;

        if (depthPercent <= 0.45) {
            // 水面层 - 小尺寸
            size = Math.max(this.width, this.height) * 0.8;
        } else if (depthPercent <= 0.7) {
            // 中上层 - 中等尺寸
            size = Math.max(this.width, this.height) * 1.0;
        } else if (depthPercent <= 0.85) {
            // 中层 - 较大尺寸
            size = Math.max(this.width, this.height) * 1.2;
        } else {
            // 深层 - 大尺寸
            size = Math.max(this.width, this.height) * 1.5;
        }

        // 绘制障碍物图片
        ctx.drawImage(image, this.x - size/2, this.y - size/2, size, size);

        ctx.restore();
    }

    // 备用渲染方法（原始绘制方式）
    renderFallback(ctx) {
        ctx.save();

        // 根据障碍物类型设置不同的渲染样式
        switch (this.obstacleType) {
            case 'floating_seaweed':
                // 漂浮海藻团
                ctx.fillStyle = 'rgba(46, 125, 50, 0.7)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'sea_rock':
                // 海中岩石
                ctx.fillStyle = 'rgba(96, 125, 139, 0.9)';
                ctx.fillRect(
                    this.x - this.width / 2,
                    this.y - this.height / 2,
                    this.width,
                    this.height
                );
                break;

            case 'shipwreck':
                // 沉船残骸
                ctx.fillStyle = 'rgba(101, 67, 33, 0.8)';
                ctx.fillRect(
                    this.x - this.width / 2,
                    this.y - this.height / 2,
                    this.width,
                    this.height
                );
                break;

            case 'floating_debris':
                // 海面漂浮物
                ctx.fillStyle = 'rgba(139, 115, 85, 0.8)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
                ctx.fill();
                break;

            default:
                // 默认障碍物
                ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
                ctx.fillRect(
                    this.x - this.width / 2,
                    this.y - this.height / 2,
                    this.width,
                    this.height
                );
                break;
        }

        ctx.restore();
    }

    // 渲染碰撞盒（调试用）
    renderCollisionBox(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;

        if (this.type === 'circle') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === 'rectangle') {
            ctx.strokeRect(
                this.x - this.width / 2,
                this.y - this.height / 2,
                this.width,
                this.height
            );
        }

        ctx.restore();
    }
}

// 玩家类
class Player {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.game = game;

        // 物理属性
        this.vx = 0;
        this.vy = 0;
        this.radius = 15;
        this.maxSpeed = 3;
        this.acceleration = 0.3;
        this.friction = 0.9;

        // 资源属性
        this.stamina = 100;
        this.maxStamina = 100;
        this.staminaRegenRate = 0.5;
        this.staminaConsumption = 2;

        this.oxygen = 100;
        this.maxOxygen = 100;
        this.oxygenConsumption = 0.1;
        this.oxygenRegenRate = 1;

        // 状态
        this.isBoosting = false;
        this.isAtSurface = false;
        this.isPulling = false; // 是否正在拉拽鱼线
        this.lineReplenished = false; // 鱼线补充标记，防止重复补充

        // 动画系统
        this.animation = {
            currentFrame: 0,
            frameCount: 22, // idle动画有22帧
            frameTime: 0,
            frameDelay: 100, // 默认帧延迟(毫秒)
            direction: 'up', // 朝向：up, down, left, right
            isMoving: false,
            lastUpdateTime: Date.now()
        };

        // 渲染属性
        this.angle = 0;
        this.targetAngle = 0;
    }

    update() {
        this.handleInput();
        this.updatePhysics();
        this.updateResources();
        this.updatePosition();
        this.updateAngle();
        this.updateAnimation();
    }

    handleInput() {
        let moveX = 0;
        let moveY = 0;

        if (this.game.isPC) {
            // PC端键盘控制
            if (this.game.input.keys['KeyW'] || this.game.input.keys['ArrowUp']) moveY -= 1;
            if (this.game.input.keys['KeyS'] || this.game.input.keys['ArrowDown']) moveY += 1;
            if (this.game.input.keys['KeyA'] || this.game.input.keys['ArrowLeft']) moveX -= 1;
            if (this.game.input.keys['KeyD'] || this.game.input.keys['ArrowRight']) moveX += 1;

            this.isBoosting = this.game.input.keys['ShiftLeft'] || this.game.input.keys['ShiftRight'];

            // PC端拉拽控制（鼠标左键）
            this.isPulling = this.game.input.mouse.pressed && this.game.fishingLine && !this.game.fishingLine.broken;
        } else {
            // 移动端虚拟摇杆控制
            if (this.game.input.joystick.active) {
                moveX = this.game.input.joystick.x;
                moveY = this.game.input.joystick.y;
            }

            this.isBoosting = this.game.input.keys['ShiftLeft'];

            // 移动端拉拽控制（通过UI按钮）
            this.isPulling = this.game.input.pulling && this.game.fishingLine && !this.game.fishingLine.broken;
        }

        // 标准化移动向量
        const moveLength = Math.sqrt(moveX * moveX + moveY * moveY);
        if (moveLength > 0) {
            moveX /= moveLength;
            moveY /= moveLength;

            // 计算目标角度
            this.targetAngle = Math.atan2(moveY, moveX);

            // 更新朝向和动画状态
            this.updateDirection(moveX, moveY);
            this.animation.isMoving = true;
        } else {
            this.animation.isMoving = false;
        }

        // 应用移动
        if (moveLength > 0) {
            let speed = this.acceleration;

            // 加速功能
            if (this.isBoosting && this.stamina > 0) {
                speed *= 2;
                this.stamina -= this.staminaConsumption;
            }

            this.vx += moveX * speed;
            this.vy += moveY * speed;
        }

        // 处理拉拽
        this.handlePulling();
    }

    // 更新朝向
    updateDirection(moveX, moveY) {
        // 根据移动方向确定朝向
        if (Math.abs(moveX) > Math.abs(moveY)) {
            // 水平移动优先
            this.animation.direction = moveX > 0 ? 'right' : 'left';
        } else {
            // 垂直移动
            this.animation.direction = moveY < 0 ? 'up' : 'down';
        }
    }

    // 更新动画
    updateAnimation() {
        const currentTime = Date.now();

        // 根据状态设置动画速度
        let frameDelay = 100; // 默认1倍速
        if (this.animation.isMoving) {
            frameDelay = this.isBoosting ? 50 : 67; // 加速时2倍速，移动时1.5倍速
        }

        this.animation.frameDelay = frameDelay;

        // 更新帧
        if (currentTime - this.animation.lastUpdateTime >= this.animation.frameDelay) {
            this.animation.currentFrame = (this.animation.currentFrame + 1) % this.animation.frameCount;
            this.animation.lastUpdateTime = currentTime;
        }
    }

    // 处理鱼线拉拽
    handlePulling() {
        if (!this.isPulling || !this.game.fishingLine || this.game.fishingLine.broken) {
            return;
        }

        // 检查体力
        if (this.stamina <= 0) {
            return;
        }

        // 消耗体力
        const pullStaminaCost = 1.5; // 拉拽体力消耗
        this.stamina -= pullStaminaCost;
        if (this.stamina < 0) this.stamina = 0;

        // 获取鱼线和鱼的引用
        const fishingLine = this.game.fishingLine;
        const fish = fishingLine.fish;

        if (!fish || fish.isCaught === false) {
            return;
        }

        // 计算拉拽力
        const dx = this.x - fish.x;
        const dy = this.y - fish.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            // 增强拉拽强度基于玩家体力和鱼线张力
            const pullStrength = 0.8 * (this.stamina / this.maxStamina) * (1 - fishingLine.tension * 0.3);

            // 对鱼施加更强的拉拽力
            const pullForceX = (dx / distance) * pullStrength;
            const pullForceY = (dy / distance) * pullStrength;

            fish.vx += pullForceX;
            fish.vy += pullForceY;

            // 鱼会更强烈地反抗拉拽
            if (fish.stamina > 0) {
                const resistanceStrength = 0.6 * (fish.stamina / fish.maxStamina);
                fish.vx -= pullForceX * resistanceStrength;
                fish.vy -= pullForceY * resistanceStrength;

                // 鱼消耗更多体力反抗
                fish.stamina -= 1.5;
                if (fish.stamina < 0) fish.stamina = 0;
            }

            // 更快增加鱼线张力
            fishingLine.tension = Math.min(fishingLine.tension + 0.05, 1.0);

            // 玩家也会受到反作用力（增强效果）
            const reactionForce = 0.3;
            this.vx -= pullForceX * reactionForce;
            this.vy -= pullForceY * reactionForce;

            // 张力不再造成耐久度损失，只影响视觉效果
        }
    }

    updatePhysics() {
        // 应用摩擦力
        this.vx *= this.friction;
        this.vy *= this.friction;

        // 限制最大速度
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > this.maxSpeed) {
            this.vx = (this.vx / speed) * this.maxSpeed;
            this.vy = (this.vy / speed) * this.maxSpeed;
        }

        // 水中阻力
        this.vx *= this.game.settings.waterResistance;
        this.vy *= this.game.settings.waterResistance;
    }

    updatePosition() {
        // 保存旧位置
        const oldX = this.x;
        const oldY = this.y;

        // 更新位置
        this.x += this.vx;
        this.y += this.vy;

        // 检查与障碍物的碰撞
        const collidedObstacle = this.game.checkObstacleCollision(this.x, this.y, this.radius);
        if (collidedObstacle) {
            // 恢复到旧位置
            this.x = oldX;
            this.y = oldY;

            // 尝试沿着障碍物边缘滑动
            this.slideAlongObstacle(collidedObstacle);
        }

        // 边界检测
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = 0;
        }
        if (this.x > this.game.gameWidth - this.radius) {
            this.x = this.game.gameWidth - this.radius;
            this.vx = 0;
        }

        // 限制在水面以下 (水面位置已调整为0.15)
        const waterSurface = this.game.gameHeight * 0.15;
        if (this.y < waterSurface) {
            this.y = waterSurface;
            this.vy = 0;
        }

        // 水域分层限制
        const currentDepthPercent = this.y / this.game.gameHeight;
        let maxAllowedDepth = this.game.getMaxUnlockedDepth();

        if (currentDepthPercent > maxAllowedDepth) {
            // 检查是否接近未解锁区域边界
            const boundaryY = this.game.gameHeight * maxAllowedDepth;
            const distanceToBoundary = this.y - boundaryY;

            if (distanceToBoundary > -30) { // 在边界附近30像素内
                this.game.checkZoneUnlock(currentDepthPercent);
            }

            // 限制移动
            this.y = boundaryY - this.radius;
            this.vy = 0;
        }

        if (this.y > this.game.gameHeight - this.radius) {
            this.y = this.game.gameHeight - this.radius;
            this.vy = 0;
        }

        // 检测是否在海面 (调整为0.16)
        this.isAtSurface = this.y < this.game.gameHeight * 0.16;
    }

    // 沿着障碍物边缘滑动
    slideAlongObstacle(obstacle) {
        // 尝试只在X方向移动
        let testX = this.x + this.vx;
        let testY = this.y;

        if (!this.game.checkObstacleCollision(testX, testY, this.radius)) {
            this.x = testX;
            this.vy *= 0.8; // 减少垂直速度
            return;
        }

        // 尝试只在Y方向移动
        testX = this.x;
        testY = this.y + this.vy;

        if (!this.game.checkObstacleCollision(testX, testY, this.radius)) {
            this.y = testY;
            this.vx *= 0.8; // 减少水平速度
            return;
        }

        // 如果都不行，就停止移动
        this.vx *= 0.5;
        this.vy *= 0.5;
    }

    updateResources() {
        // 体力恢复
        if (!this.isBoosting && this.stamina < this.maxStamina) {
            this.stamina += this.staminaRegenRate;
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
        }

        // 氧气管理 (调整水面阈值为0.18)
        const surfaceThreshold = this.game.gameHeight * 0.18; // 水面附近阈值

        if (this.y < surfaceThreshold) {
            // 在水面附近时恢复氧气
            if (this.oxygen < this.maxOxygen) {
                const regenMultiplier = this.y < this.game.gameHeight * 0.16 ? 3 : 2; // 越接近水面恢复越快
                this.oxygen += this.oxygenRegenRate * regenMultiplier;
                if (this.oxygen > this.maxOxygen) this.oxygen = this.maxOxygen;
            }
            this.isAtSurface = true;
        } else {
            // 在深水中时消耗氧气
            this.oxygen -= this.oxygenConsumption;
            if (this.oxygen <= 0) {
                this.oxygen = 0;
                // 触发昏厥
                this.triggerUnconsciousness();
            }
            this.isAtSurface = false;
        }

        // 鱼线现在自动补充，不需要检查水面补充

        // 更新最大深度统计
        const currentDepthPercent = (this.y / this.game.gameHeight) * 100;
        if (currentDepthPercent > this.game.gameStats.maxDepthReached) {
            this.game.gameStats.maxDepthReached = currentDepthPercent;
        }
    }

    // 原来的水面补充逻辑已移除，现在鱼线断裂后自动补充

    // 触发昏厥
    triggerUnconsciousness() {
        if (this.game.gameState === 'unconscious') return; // 防止重复触发

        console.log('氧气耗尽，玩家昏厥！');
        this.game.triggerUnconsciousness();
    }

    updateAngle() {
        // 平滑角度过渡
        let angleDiff = this.targetAngle - this.angle;

        // 处理角度环绕
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        this.angle += angleDiff * 0.1;
    }

    render(ctx) {
        if (!this.game.imagesLoaded) {
            // 图片未加载时使用原始绘制方式
            this.renderFallback(ctx);
            return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        // 获取当前帧图片
        const frameKey = `hero_idle_${this.animation.currentFrame}`;
        const image = this.game.images[frameKey];

        if (image) {
            const size = this.radius * 2.5; // 图片显示大小

            // 根据朝向进行变换
            switch (this.animation.direction) {
                case 'up':
                case 'left':
                    // 向上和向左时使用原图
                    break;
                case 'right':
                    // 向右时水平翻转
                    ctx.scale(-1, 1);
                    break;
                case 'down':
                    // 向下时先垂直翻转再向左旋转300度
                    ctx.scale(1, -1);
                    ctx.rotate(-Math.PI * 5 / 3); // -300度
                    break;
            }

            // 绘制图片
            ctx.drawImage(image, -size/2, -size/2, size, size);
        } else {
            // 图片加载失败时使用备用绘制
            this.renderFallback(ctx);
        }

        ctx.restore();

        // 绘制加速效果
        if (this.isBoosting && this.stamina > 0) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#ffa500';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 绘制气泡效果
        if (Math.random() < 0.1) {
            this.game.addParticle(this.x + (Math.random() - 0.5) * 20, this.y - 10, 'bubble');
        }
    }

    // 备用渲染方法（原始绘制方式）
    renderFallback(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 绘制潜水员身体
        ctx.fillStyle = '#4a90e2';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // 绘制潜水员头部
        ctx.fillStyle = '#f4c2a1';
        ctx.beginPath();
        ctx.arc(-this.radius * 0.3, -this.radius * 0.2, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // 绘制潜水镜
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.arc(-this.radius * 0.3, -this.radius * 0.2, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// 鱼类
class Fish {
    constructor(x, y, type, game) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.game = game;

        // 根据类型设置属性
        this.setupByType();

        // 物理属性
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.angle = Math.random() * Math.PI * 2;
        this.targetAngle = this.angle;

        // AI属性
        this.aiTimer = 0;
        this.aiInterval = 60 + Math.random() * 120; // 1-3秒
        this.escapeTimer = 0;
        this.escapeInterval = 120 + Math.random() * 180; // 2-5秒

        // 状态
        this.isEscaping = false;
        this.isCaught = false;
        this.health = this.maxHealth;

        // 体力系统（在setupByType之后初始化）
        this.staminaRegenRate = 1.0; // 体力恢复速度（每帧）
        this.isExhausted = false; // 是否疲劳
        this.exhaustedRecoveryThreshold = 0.25; // 疲劳恢复阈值（25%）
        this.isFastSwimming = false; // 是否正在快速游动
        this.fastSwimDirection = { x: 0, y: 0 }; // 快速游动方向
    }

    setupByType() {
        switch (this.type) {
            case 'small':
                this.radius = 10;
                this.maxSpeed = 2.5;
                this.maxHealth = 30;
                this.maxStamina = 100; // 小鱼体力50
                this.staminaConsumption = 0.8; // 体力消耗速度
                this.fastSwimMultiplier = 2.5; // 快速游动倍数
                this.escapeForce = 4;
                this.color = '#ffd700'; // 金色
                this.points = 10;
                this.coinValue = 5; // 小鱼价值5金币
                break;
            case 'big':
                this.radius = 20;
                this.maxSpeed = 1.5;
                this.maxHealth = 100;
                this.maxStamina = 150; // 大鱼体力100
                this.staminaConsumption = 1.2; // 体力消耗速度
                this.fastSwimMultiplier = 2.5; // 快速游动倍数
                this.escapeForce = 6;
                this.color = '#ff6b6b'; // 红色
                this.points = 50;
                this.coinValue = 15; // 大鱼价值15金币
                break;
            case 'octopus':
                this.radius = 15;
                this.maxSpeed = 2;
                this.maxHealth = 70;
                this.maxStamina = 120; // 章鱼体力75
                this.staminaConsumption = 1.0; // 体力消耗速度
                this.fastSwimMultiplier = 2.5; // 快速游动倍数
                this.escapeForce = 5;
                this.color = '#9b59b6'; // 紫色
                this.points = 30;
                this.coinValue = 25; // 章鱼价值25金币
                break;
        }

        // 初始化体力值（在maxStamina设置之后）
        this.stamina = this.maxStamina;
    }

    update() {
        if (this.isCaught) {
            this.updateCaughtBehavior();
        } else {
            this.updateFreeBehavior();
        }

        this.updatePhysics();
        this.updatePosition();
        this.updateAngle();
        this.recoverStamina();

        // 检查是否到达水面
        this.checkSurfaceReached();
    }

    // 检查是否到达水面
    checkSurfaceReached() {
        const surfaceThreshold = this.game.gameHeight * 0.2; // 水面阈值

        if (this.isCaught && this.y < surfaceThreshold) {
            // 鱼被拉到水面，给玩家金币并移除鱼
            this.game.collectFish(this);
        }
    }

    updateFreeBehavior() {
        // 检查玩家接近并逃避
        this.checkPlayerProximity();

        // 检查疲劳状态
        if (this.isExhausted) {
            // 疲劳状态下不游动，只恢复体力
            this.vx *= 0.95; // 逐渐减速
            this.vy *= 0.95;
            this.isFastSwimming = false; // 停止快速游动

            // 检查是否恢复到25%体力
            if (this.stamina >= this.maxStamina * this.exhaustedRecoveryThreshold) {
                this.isExhausted = false;
                // 重新设置AI参数，开始正常游动
                this.aiTimer = 0;
                this.aiInterval = 60 + Math.random() * 120;
                this.targetAngle = Math.random() * Math.PI * 2;
                console.log(`${this.type}鱼体力恢复，重新开始游动`);
            } else {
                return; // 只有在还没恢复时才返回
            }
        }

        // 快速游动模式
        if (this.isFastSwimming) {
            // 检查前方是否有障碍物
            const fastSpeed = this.maxSpeed * this.fastSwimMultiplier;
            const nextX = this.x + this.fastSwimDirection.x * fastSpeed;
            const nextY = this.y + this.fastSwimDirection.y * fastSpeed;

            // 检查是否会碰到障碍物
            let willCollide = false;
            for (let obstacle of this.game.obstacles) {
                if (this.checkCollisionWithObstacle(nextX, nextY, obstacle)) {
                    willCollide = true;
                    break;
                }
            }

            // 如果会碰到障碍物，改变方向
            if (willCollide) {
                this.changeFastSwimDirection();
            }

            // 持续快速游动直到体力耗尽
            this.vx = this.fastSwimDirection.x * fastSpeed;
            this.vy = this.fastSwimDirection.y * fastSpeed;

            // 快速游动时大量消耗体力
            this.consumeStamina(this.staminaConsumption * 2);

            // 如果体力耗尽，停止快速游动
            if (this.stamina <= 0) {
                this.isFastSwimming = false;
                console.log(`${this.type}鱼体力耗尽，停止快速游动`);
            }
            return;
        }

        // 正常AI行为
        this.aiTimer++;

        if (this.aiTimer >= this.aiInterval) {
            this.aiTimer = 0;
            this.aiInterval = 60 + Math.random() * 120;

            // 随机改变方向
            this.targetAngle = Math.random() * Math.PI * 2;
        }

        // 朝目标角度游动
        const speed = this.maxSpeed * 0.3;
        this.vx += Math.cos(this.targetAngle) * speed * 0.1;
        this.vy += Math.sin(this.targetAngle) * speed * 0.1;

        // 自然游动消耗少量体力
        this.consumeStamina(0.1);
    }

    updateCaughtBehavior() {
        // 检查疲劳状态
        if (this.isExhausted) {
            // 疲劳状态下无法逃脱，只能被拖拽；体力恢复到阈值则立即恢复游动
            this.vx *= 0.9;
            this.vy *= 0.9;
            this.isFastSwimming = false; // 停止快速游动
            if (this.stamina >= this.maxStamina * this.exhaustedRecoveryThreshold) {
                this.isExhausted = false; // 恢复游动
                // 不return，让本帧继续执行后续逻辑
            } else {
                return;
            }
        }

        // 快速游动模式（被捕获时也可以快速游动）
        if (this.isFastSwimming) {
            // 检查前方是否有障碍物
            const fastSpeed = this.maxSpeed * this.fastSwimMultiplier;
            const nextX = this.x + this.fastSwimDirection.x * fastSpeed;
            const nextY = this.y + this.fastSwimDirection.y * fastSpeed;

            // 检查是否会碰到障碍物
            let willCollide = false;
            for (let obstacle of this.game.obstacles) {
                if (this.checkCollisionWithObstacle(nextX, nextY, obstacle)) {
                    willCollide = true;
                    break;
                }
            }

            // 如果会碰到障碍物，改变方向
            if (willCollide) {
                this.changeFastSwimDirection();
            }

            // 持续快速游动直到体力耗尽
            this.vx = this.fastSwimDirection.x * fastSpeed;
            this.vy = this.fastSwimDirection.y * fastSpeed;

            // 快速游动时大量消耗体力
            this.consumeStamina(this.staminaConsumption * 2);

            // 如果体力耗尽，停止快速游动
            if (this.stamina <= 0) {
                this.isFastSwimming = false;
                console.log(`${this.type}鱼体力耗尽，停止快速游动`);
            }
            return;
        }

        // 正常的间歇性逃脱行为
        this.escapeTimer++;

        if (this.escapeTimer >= this.escapeInterval && this.stamina > 20) {
            this.escapeTimer = 0;
            this.escapeInterval = 120 + Math.random() * 180;
            this.isEscaping = true;

            // 快速逃脱时大量消耗体力
            this.consumeStamina(this.staminaConsumption * 3);

            // 朝远离玩家的方向快速逃脱
            const dx = this.x - this.game.player.x;
            const dy = this.y - this.game.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                const escapeSpeed = this.escapeForce * this.fastSwimMultiplier;
                this.vx += (dx / distance) * escapeSpeed;
                this.vy += (dy / distance) * escapeSpeed;
            }
        }

        this.isEscaping = false;
    }

    updatePhysics() {
        // 应用摩擦力
        this.vx *= 0.95;
        this.vy *= 0.95;

        // 限制最大速度
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > this.maxSpeed) {
            this.vx = (this.vx / speed) * this.maxSpeed;
            this.vy = (this.vy / speed) * this.maxSpeed;
        }
    }

    updatePosition() {
        // 保存旧位置
        const oldX = this.x;
        const oldY = this.y;

        // 更新位置
        this.x += this.vx;
        this.y += this.vy;

        // 检查与障碍物的碰撞
        const collidedObstacle = this.game.checkObstacleCollision(this.x, this.y, this.radius);
        if (collidedObstacle) {
            // 恢复到旧位置
            this.x = oldX;
            this.y = oldY;

            // 改变方向避开障碍物
            this.avoidObstacle(collidedObstacle);
        }

        // 边界检测 - 改进的反弹逻辑
        let bounced = false;

        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = Math.abs(this.vx) * 0.8; // 减少反弹力度
            this.targetAngle = Math.PI * 0.25 + Math.random() * Math.PI * 0.5; // 向右游
            bounced = true;
        }
        if (this.x > this.game.gameWidth - this.radius) {
            this.x = this.game.gameWidth - this.radius;
            this.vx = -Math.abs(this.vx) * 0.8; // 减少反弹力度
            this.targetAngle = Math.PI * 0.75 + Math.random() * Math.PI * 0.5; // 向左游
            bounced = true;
        }

        // 限制在水面以下
        const waterSurface = this.game.gameHeight * 0.15;
        if (this.y < waterSurface) {
            this.y = waterSurface + this.radius;
            this.vy = Math.abs(this.vy) * 0.8; // 减少反弹力度
            this.targetAngle = Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.5; // 向下游
            bounced = true;
        }

        // 水域分层限制 - 鱼类不能进入未解锁区域
        const currentDepthPercent = this.y / this.game.gameHeight;
        let maxAllowedDepth = 1.0;

        // 根据鱼类类型确定允许的最大深度
        if (this.type === 'big' && !this.game.waterZones.zone2.unlocked) {
            maxAllowedDepth = this.game.waterZones.zone1.endDepth; // 大鱼需要zone2解锁
        } else if (this.type === 'octopus' && !this.game.waterZones.zone3.unlocked) {
            maxAllowedDepth = this.game.waterZones.zone2.endDepth; // 章鱼需要zone3解锁
        } else {
            maxAllowedDepth = this.game.getMaxUnlockedDepth();
        }

        if (currentDepthPercent > maxAllowedDepth) {
            const boundaryY = this.game.gameHeight * maxAllowedDepth;
            this.y = boundaryY - this.radius;
            this.vy = -Math.abs(this.vy) * 0.8; // 减少反弹力度
            this.targetAngle = Math.PI * 1.5 + (Math.random() - 0.5) * Math.PI * 0.5; // 向上游
            bounced = true;
        }

        if (this.y > this.game.gameHeight - this.radius) {
            this.y = this.game.gameHeight - this.radius;
            this.vy = -Math.abs(this.vy) * 0.8; // 减少反弹力度
            this.targetAngle = Math.PI * 1.5 + (Math.random() - 0.5) * Math.PI * 0.5; // 向上游
            bounced = true;
        }

        // 如果发生了反弹，给鱼一个推力避免卡在边缘
        if (bounced) {
            const pushForce = 0.5;
            this.vx += Math.cos(this.targetAngle) * pushForce;
            this.vy += Math.sin(this.targetAngle) * pushForce;
        }
    }

    // 避开障碍物
    avoidObstacle(obstacle) {
        // 计算远离障碍物的方向
        const dx = this.x - obstacle.x;
        const dy = this.y - obstacle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            // 设置新的目标角度，远离障碍物
            this.targetAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * Math.PI * 0.5;

            // 立即调整速度方向
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            this.vx = Math.cos(this.targetAngle) * speed;
            this.vy = Math.sin(this.targetAngle) * speed;
        } else {
            // 如果距离为0，随机选择方向
            this.targetAngle = Math.random() * Math.PI * 2;
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            this.vx = Math.cos(this.targetAngle) * speed;
            this.vy = Math.sin(this.targetAngle) * speed;
        }
    }

    updateAngle() {
        // 根据移动方向更新角度
        if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
            // 小鱼的图片朝向需要调整，其他鱼类正常
            if (this.type === 'small') {
                // 小鱼图片朝向相反，需要加上π来翻转
                this.angle = Math.atan2(this.vy, this.vx) + Math.PI;
            } else {
                // 大鱼和章鱼正常朝向
                this.angle = Math.atan2(this.vy, this.vx);
            }
        }
    }

    // 检查玩家接近并逃避
    checkPlayerProximity() {
        const player = this.game.player;
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 根据鱼类类型设置不同的逃避距离
        let escapeDistance;
        switch (this.type) {
            case 'small':
                escapeDistance = 80; // 小鱼更敏感
                break;
            case 'big':
                escapeDistance = 60; // 大鱼稍微迟钝
                break;
            case 'octopus':
                escapeDistance = 70; // 章鱼中等敏感
                break;
            default:
                escapeDistance = 70;
        }

        // 如果玩家太近，开始逃避
        if (distance < escapeDistance && !this.isExhausted) {
            // 计算逃避方向
            let escapeX, escapeY;
            if (distance > 0) {
                escapeX = dx / distance;
                escapeY = dy / distance;
            } else {
                // 如果距离为0，随机选择方向
                const angle = Math.random() * Math.PI * 2;
                escapeX = Math.cos(angle);
                escapeY = Math.sin(angle);
            }

            // 应用逃避力
            const escapeForce = 0.5;
            this.vx += escapeX * escapeForce;
            this.vy += escapeY * escapeForce;

            // 更新目标角度
            this.targetAngle = Math.atan2(escapeY, escapeX);

            // 消耗少量体力
            this.stamina -= 0.2;
            if (this.stamina < 0) this.stamina = 0;
        }
    }

    // 被击中后立即逃脱
    triggerImmediateEscape(player) {
        if (this.isExhausted) return; // 疲劳状态下无法逃脱

        // 启动持续快速游动模式
        this.isFastSwimming = true;

        // 计算逃脱方向
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            this.fastSwimDirection.x = dx / distance;
            this.fastSwimDirection.y = dy / distance;
        } else {
            // 如果距离为0，随机选择方向
            const angle = Math.random() * Math.PI * 2;
            this.fastSwimDirection.x = Math.cos(angle);
            this.fastSwimDirection.y = Math.sin(angle);
        }

        console.log(`${this.type}鱼被击中，开始持续快速游动！体力: ${Math.round(this.stamina)}/${this.maxStamina}`);
    }

    // 改变快速游动方向（避开障碍物）
    changeFastSwimDirection() {
        // 尝试几个不同的方向
        const attempts = 8;
        const angleStep = (Math.PI * 2) / attempts;

        for (let i = 0; i < attempts; i++) {
            const angle = i * angleStep;
            const testDirX = Math.cos(angle);
            const testDirY = Math.sin(angle);

            // 检查这个方向是否安全
            const testSpeed = this.maxSpeed * this.fastSwimMultiplier;
            const testX = this.x + testDirX * testSpeed * 3; // 检查更远的距离
            const testY = this.y + testDirY * testSpeed * 3;

            let isSafe = true;
            for (let obstacle of this.game.obstacles) {
                if (this.checkCollisionWithObstacle(testX, testY, obstacle)) {
                    isSafe = false;
                    break;
                }
            }

            // 如果这个方向安全，使用它
            if (isSafe) {
                this.fastSwimDirection.x = testDirX;
                this.fastSwimDirection.y = testDirY;
                console.log(`${this.type}鱼改变快速游动方向，避开障碍物`);
                return;
            }
        }

        // 如果所有方向都不安全，随机选择一个方向
        const randomAngle = Math.random() * Math.PI * 2;
        this.fastSwimDirection.x = Math.cos(randomAngle);
        this.fastSwimDirection.y = Math.sin(randomAngle);
        console.log(`${this.type}鱼随机改变快速游动方向`);
    }

    // 检查与障碍物的碰撞
    checkCollisionWithObstacle(x, y, obstacle) {
        if (obstacle.type === 'circle') {
            const dx = x - obstacle.x;
            const dy = y - obstacle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < (this.radius + obstacle.radius);
        } else if (obstacle.type === 'rect') {
            return x - this.radius < obstacle.x + obstacle.width &&
                   x + this.radius > obstacle.x &&
                   y - this.radius < obstacle.y + obstacle.height &&
                   y + this.radius > obstacle.y;
        }
        return false;
    }

    // 消耗体力
    consumeStamina(amount) {
        this.stamina -= amount;
        if (this.stamina <= 0) {
            this.stamina = 0;
            this.isExhausted = true;
            console.log(`${this.type}鱼体力耗尽，进入疲劳状态`);
        }
    }

    // 恢复体力
    recoverStamina() {
        if (this.stamina < this.maxStamina) {
            this.stamina += this.staminaRegenRate;
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
        }
    }

    render(ctx) {
        if (!this.game.imagesLoaded) {
            // 图片未加载时使用原始绘制方式
            this.renderFallback(ctx);
        } else {
            // 使用图片渲染
            this.renderWithImage(ctx);
        }

        // 绘制逃脱效果
        if (this.isEscaping) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 绘制体力条（只在被击中时显示）
        if (this.isCaught) {
            this.renderStaminaBar(ctx);
        }

        // 绘制疲劳效果
        if (this.isExhausted) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = '#888888';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    // 使用图片渲染
    renderWithImage(ctx) {
        let imageKey;
        switch (this.type) {
            case 'small':
                imageKey = 'fish_small';
                break;
            case 'big':
                imageKey = 'fish_big';
                break;
            case 'octopus':
                imageKey = 'fish_octopus';
                break;
            default:
                imageKey = 'fish_small';
        }

        const image = this.game.images[imageKey];
        if (image) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            const size = this.radius * 2.5; // 图片显示大小
            ctx.drawImage(image, -size/2, -size/2, size, size);

            ctx.restore();
        } else {
            // 图片加载失败时使用备用绘制
            this.renderFallback(ctx);
        }
    }

    // 备用渲染方法（原始绘制方式）
    renderFallback(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 绘制鱼身
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // 绘制鱼尾
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(-this.radius, 0);
        ctx.lineTo(-this.radius * 1.5, -this.radius * 0.4);
        ctx.lineTo(-this.radius * 1.5, this.radius * 0.4);
        ctx.closePath();
        ctx.fill();

        // 绘制鱼眼
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.radius * 0.3, -this.radius * 0.2, this.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.radius * 0.4, -this.radius * 0.2, this.radius * 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // 渲染环形体力条（塞尔达风格）
    renderStaminaBar(ctx) {
        const centerX = this.x;
        const centerY = this.y - this.radius - 40; // 在鱼的上方显示
        const radius = 20; // 环形半径（比玩家的小）
        const thickness = 4; // 环形厚度

        // 计算体力百分比
        const staminaPercent = this.stamina / this.maxStamina;
        const angle = staminaPercent * Math.PI * 2; // 体力对应的角度

        ctx.save();

        // 绘制背景环
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.lineWidth = thickness;
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.4)';
        ctx.stroke();

        // 绘制体力环
        if (staminaPercent > 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + angle);
            ctx.lineWidth = thickness;

            // 根据体力值改变颜色
            if (staminaPercent > 0.6) {
                ctx.strokeStyle = 'rgba(76, 175, 80, 0.9)'; // 绿色
            } else if (staminaPercent > 0.3) {
                ctx.strokeStyle = 'rgba(255, 193, 7, 0.9)'; // 黄色
            } else {
                ctx.strokeStyle = 'rgba(244, 67, 54, 0.9)'; // 红色
            }

            ctx.stroke();
        }

        // 绘制外边框
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + thickness/2 + 1, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.stroke();

        // 绘制内边框
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - thickness/2 - 1, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.stroke();

        // 绘制中心文字
        ctx.fillStyle = 'white';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.type}`, centerX, centerY - 2);

        // 绘制数值
        ctx.font = '7px Arial';
        ctx.fillText(`${Math.round(this.stamina)}`, centerX, centerY + 6);

        // 疲劳状态提示
        if (this.isExhausted) {
            ctx.fillStyle = '#ff4444';
            ctx.font = '8px Arial';
            ctx.fillText('疲劳', centerX, centerY + 35);
        }

        // 快速游动状态提示
        if (this.isFastSwimming) {
            ctx.fillStyle = '#ffaa00';
            ctx.font = '8px Arial';
            ctx.fillText('冲刺', centerX, centerY - 35);
        }

        ctx.restore();
    }
}

// 鱼枪类
class Harpoon {
    constructor(startX, startY, targetX, targetY, game) {
        this.startX = startX;
        this.startY = startY;
        this.x = startX;
        this.y = startY;
        this.game = game;

        // 计算方向和速度
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        this.speed = 8;
        this.vx = (dx / distance) * this.speed;
        this.vy = (dy / distance) * this.speed;
        this.angle = Math.atan2(dy, dx);

        // 状态
        this.active = true;
        this.connected = false;
        this.targetFish = null;
        this.maxDistance = game.settings.maxHarpoonDistance;
        this.traveledDistance = 0;

        // 渲染属性
        this.length = 20;
        this.width = 3;
    }

    update() {
        if (!this.active) return;

        if (!this.connected) {
            // 鱼枪飞行阶段
            this.x += this.vx;
            this.y += this.vy;
            this.traveledDistance += this.speed;

            // 减速效果
            this.vx *= 0.98;
            this.vy *= 0.98;
            this.speed *= 0.98;

            // 检查是否超出最大距离
            if (this.traveledDistance >= this.maxDistance || this.speed < 0.5) {
                this.active = false;
                return;
            }

            // 边界检测
            if (this.x < 0 || this.x > this.game.gameWidth ||
                this.y < 0 || this.y > this.game.gameHeight * 0.9) {
                this.active = false;
                return;
            }

            // 检测与障碍物的碰撞
            const collidedObstacle = this.game.checkObstacleCollision(this.x, this.y, 3);
            if (collidedObstacle) {
                this.active = false;
                this.game.addParticle(this.x, this.y, 'splash');
                return;
            }

            // 检测与鱼的碰撞
            this.checkFishCollision();
        }
    }

    checkFishCollision() {
        for (let fish of this.game.fishes) {
            if (fish.isCaught) continue;

            const dx = this.x - fish.x;
            const dy = this.y - fish.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < fish.radius + 5) {
                // 命中鱼类
                this.connected = true;
                this.targetFish = fish;
                fish.isCaught = true;

                // 鱼被击中后立即快速逃脱
                fish.triggerImmediateEscape(this.game.player);

                // 创建鱼线
                this.game.fishingLine = new FishingLine(this.game.player, fish, this.game);

                // 显示第一次中鱼提示
                if (!this.game.firstCatchTip.shown) {
                    this.game.showFirstCatchTip();
                }

                // 添加击中效果
                this.game.addParticle(this.x, this.y, 'splash');

                break;
            }
        }
    }

    render(ctx) {
        if (!this.active && !this.connected) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 绘制鱼枪主体
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(-this.length / 2, -this.width / 2, this.length, this.width);

        // 绘制鱼枪尖端
        ctx.fillStyle = '#c0c0c0';
        ctx.beginPath();
        ctx.moveTo(this.length / 2, 0);
        ctx.lineTo(this.length / 2 + 8, -2);
        ctx.lineTo(this.length / 2 + 8, 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// 鱼线类
class FishingLine {
    constructor(player, fish, game) {
        this.player = player;
        this.fish = fish;
        this.game = game;

        // 耐久度系统
        this.durability = game.settings.lineMaxDurability;
        this.maxDurability = game.settings.lineMaxDurability;

        // 物理属性
        this.segments = [];
        this.segmentCount = 10;
        this.segmentLength = 0;

        // 状态
        this.broken = false;
        this.tension = 0;
        this.maxLength = 200; // 最大鱼线长度
        this.currentLength = 0; // 当前鱼线长度

        this.initializeSegments();
    }

    initializeSegments() {
        // 初始化线段
        const dx = this.fish.x - this.player.x;
        const dy = this.fish.y - this.player.y;

        for (let i = 0; i <= this.segmentCount; i++) {
            const t = i / this.segmentCount;
            this.segments.push({
                x: this.player.x + dx * t,
                y: this.player.y + dy * t,
                oldX: this.player.x + dx * t,
                oldY: this.player.y + dy * t
            });
        }

        this.segmentLength = Math.sqrt(dx * dx + dy * dy) / this.segmentCount;
    }

    update() {
        if (this.broken) return;

        // 更新线段位置
        this.updateSegments();

        // 检查碰撞
        this.checkCollisions();

        // 更新鱼线长度
        this.updateLineLength();

        // 计算张力
        this.calculateTension();

        // 应用相互作用力
        this.applyForces();

        // 检查耐久度
        if (this.durability <= 0) {
            this.breakLine();
        }
    }

    updateSegments() {
        // 固定端点
        this.segments[0].x = this.player.x;
        this.segments[0].y = this.player.y;
        this.segments[this.segmentCount].x = this.fish.x;
        this.segments[this.segmentCount].y = this.fish.y;

        // 更新中间段
        for (let i = 1; i < this.segmentCount; i++) {
            const segment = this.segments[i];
            const tempX = segment.x;
            const tempY = segment.y;

            segment.x += (segment.x - segment.oldX) * 0.99;
            segment.y += (segment.y - segment.oldY) * 0.99;

            segment.oldX = tempX;
            segment.oldY = tempY;
        }

        // 约束长度
        for (let iteration = 0; iteration < 3; iteration++) {
            for (let i = 0; i < this.segmentCount; i++) {
                const segA = this.segments[i];
                const segB = this.segments[i + 1];

                const dx = segB.x - segA.x;
                const dy = segB.y - segA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    const difference = this.segmentLength - distance;
                    const percent = difference / distance / 2;
                    const offsetX = dx * percent;
                    const offsetY = dy * percent;

                    if (i > 0) {
                        segA.x -= offsetX;
                        segA.y -= offsetY;
                    }
                    if (i < this.segmentCount - 1) {
                        segB.x += offsetX;
                        segB.y += offsetY;
                    }
                }
            }
        }
    }

    checkCollisions() {
        // 检查鱼线段与障碍物的碰撞
        for (let i = 0; i < this.segments.length; i++) {
            const segment = this.segments[i];

            // 检查与所有障碍物的碰撞
            for (let obstacle of this.game.obstacles) {
                if (obstacle.checkCollision(segment.x, segment.y, 2)) {
                    // 将线段推出障碍物
                    if (obstacle.type === 'circle') {
                        const dx = segment.x - obstacle.x;
                        const dy = segment.y - obstacle.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance > 0) {
                            const pushDistance = obstacle.width + 2 - distance;
                            if (pushDistance > 0) {
                                segment.x += (dx / distance) * pushDistance;
                                segment.y += (dy / distance) * pushDistance;
                                this.takeDamage(0.5);
                            }
                        }
                    } else if (obstacle.type === 'rectangle') {
                        // 将线段推到矩形外
                        const closestX = Math.max(obstacle.x - obstacle.width / 2,
                                         Math.min(segment.x, obstacle.x + obstacle.width / 2));
                        const closestY = Math.max(obstacle.y - obstacle.height / 2,
                                         Math.min(segment.y, obstacle.y + obstacle.height / 2));

                        const dx = segment.x - closestX;
                        const dy = segment.y - closestY;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < 2 && distance > 0) {
                            const pushDistance = 2 - distance;
                            segment.x += (dx / distance) * pushDistance;
                            segment.y += (dy / distance) * pushDistance;
                            this.takeDamage(0.5);
                        }
                    }
                }
            }
        }
    }

    // 更新鱼线长度
    updateLineLength() {
        const dx = this.fish.x - this.player.x;
        const dy = this.fish.y - this.player.y;
        const actualDistance = Math.sqrt(dx * dx + dy * dy);

        // 更新当前长度
        this.currentLength = actualDistance;

        // 如果鱼游得太远，允许鱼线拉长
        const maxAllowedLength = Math.min(actualDistance, this.maxLength);
        const targetSegmentLength = maxAllowedLength / this.segmentCount;

        // 平滑调整段长度
        const lengthDiff = targetSegmentLength - this.segmentLength;
        if (Math.abs(lengthDiff) > 0.5) {
            this.segmentLength += lengthDiff * 0.1; // 平滑调整
        }

        // 如果鱼线被拉得太长，只增加张力，不造成耐久度损失
        if (actualDistance > this.maxLength) {
            const overstretch = (actualDistance - this.maxLength) / this.maxLength;
            this.tension = Math.min(this.tension + overstretch * 0.1, 1.0);
        }
    }

    calculateTension() {
        const dx = this.fish.x - this.player.x;
        const dy = this.fish.y - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = this.segmentLength * this.segmentCount;

        this.tension = Math.min(distance / maxDistance, 1);
    }

    applyForces() {
        // 对玩家和鱼施加更强的相互作用力
        const dx = this.fish.x - this.player.x;
        const dy = this.fish.y - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            // 增强基础力的强度
            const baseForce = this.tension * 0.25;

            // 根据距离调整力的强度（距离越远，力越大）
            const distanceMultiplier = Math.min(distance / 200, 2.0);
            const force = baseForce * distanceMultiplier;

            const forceX = (dx / distance) * force;
            const forceY = (dy / distance) * force;

            // 对玩家施加更强的拉力
            this.player.vx += forceX * 1.2;
            this.player.vy += forceY * 1.2;

            // 对鱼施加更强的拉力
            const fishForceMultiplier = this.fish.isExhausted ? 1.5 : 0.8; // 疲劳的鱼更容易被拖拽
            this.fish.vx -= forceX * fishForceMultiplier;
            this.fish.vy -= forceY * fishForceMultiplier;

            // 如果鱼在快速游动，增加额外的张力
            if (this.fish.isFastSwimming) {
                const extraTension = 0.03;
                this.tension = Math.min(this.tension + extraTension, 1.0);

                // 快速游动的鱼会对玩家产生更大的拖拽力
                const fastSwimForce = 0.4;
                this.player.vx += (this.fish.vx * fastSwimForce * 0.1);
                this.player.vy += (this.fish.vy * fastSwimForce * 0.1);
            }
        }
    }

    takeDamage(amount) {
        this.durability -= amount;
        if (this.durability < 0) this.durability = 0;
    }

    breakLine() {
        this.broken = true;
        this.fish.isCaught = false;

        // 添加断线效果
        for (let segment of this.segments) {
            this.game.addParticle(segment.x, segment.y, 'splash');
        }

        // 自动补充鱼线（延迟2秒后补充）
        setTimeout(() => {
            this.game.replenishFishingLine();
        }, 2000);
    }

    render(ctx) {
        if (this.broken) return;

        ctx.save();

        // 根据张力改变线的颜色
        const tension = this.tension;
        const red = Math.floor(255 * tension);
        const green = Math.floor(255 * (1 - tension));
        ctx.strokeStyle = `rgb(${red}, ${green}, 0)`;
        ctx.lineWidth = 2 + tension * 2;

        ctx.beginPath();
        ctx.moveTo(this.segments[0].x, this.segments[0].y);

        for (let i = 1; i <= this.segmentCount; i++) {
            ctx.lineTo(this.segments[i].x, this.segments[i].y);
        }

        ctx.stroke();

        // 渲染耐久度条（跟随鱼线中点）
        this.renderDurabilityBar(ctx);

        ctx.restore();
    }

    // 渲染耐久度条
    renderDurabilityBar(ctx) {
        if (this.broken || this.segments.length < 2) return;

        // 找到鱼线的中点
        const midIndex = Math.floor(this.segments.length / 2);
        const midSegment = this.segments[midIndex];

        // 耐久度条尺寸（与体力条相同）
        const barWidth = 120;
        const barHeight = 20;
        const x = midSegment.x - barWidth / 2;
        const y = midSegment.y - 30; // 在鱼线上方显示

        // 计算耐久度百分比
        const durabilityPercent = this.durability / this.maxDurability;

        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

        // 耐久度条背景
        ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        ctx.fillRect(x, y, barWidth, barHeight);

        // 耐久度条
        const durabilityWidth = barWidth * durabilityPercent;

        // 根据耐久度值改变颜色
        if (durabilityPercent > 0.6) {
            ctx.fillStyle = 'rgba(76, 175, 80, 0.9)'; // 绿色
        } else if (durabilityPercent > 0.3) {
            ctx.fillStyle = 'rgba(255, 193, 7, 0.9)'; // 黄色
        } else {
            ctx.fillStyle = 'rgba(244, 67, 54, 0.9)'; // 红色
        }

        ctx.fillRect(x, y, durabilityWidth, barHeight);

        // 边框
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);

        // 文字标签
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('鱼线', x + barWidth / 2, y - 5);

        // 百分比文字
        ctx.font = '10px Arial';
        ctx.fillText(`${Math.round(durabilityPercent * 100)}%`, x + barWidth / 2, y + 14);

        ctx.textAlign = 'left'; // 重置文字对齐
    }
}

// 粒子类
class Particle {
    constructor(x, y, type = 'bubble') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 1.0;
        this.maxLife = 1.0;

        switch (type) {
            case 'bubble':
                this.vx = (Math.random() - 0.5) * 2;
                this.vy = -Math.random() * 2 - 1;
                this.size = Math.random() * 5 + 2;
                this.color = 'rgba(255, 255, 255, 0.6)';
                break;
            case 'splash':
                this.vx = (Math.random() - 0.5) * 8;
                this.vy = (Math.random() - 0.5) * 8;
                this.size = Math.random() * 3 + 1;
                this.color = 'rgba(135, 206, 235, 0.8)';
                break;
            case 'coin':
                this.vx = (Math.random() - 0.5) * 4;
                this.vy = -Math.random() * 3 - 2;
                this.size = Math.random() * 4 + 3;
                this.color = 'rgba(255, 215, 0, 0.9)';
                break;
            case 'repair':
                this.vx = (Math.random() - 0.5) * 6;
                this.vy = -Math.random() * 4 - 2;
                this.size = Math.random() * 3 + 2;
                this.color = 'rgba(76, 175, 80, 0.8)';
                break;
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.02;

        if (this.type === 'bubble') {
            this.vy -= 0.1; // 气泡上升
        }
    }

    render(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;

        if (this.type === 'coin') {
            // 金币粒子特殊效果
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();

            // 添加闪光效果
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'repair') {
            // 修复粒子特殊效果
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();

            // 添加十字标记
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.x - this.size * 0.6, this.y);
            ctx.lineTo(this.x + this.size * 0.6, this.y);
            ctx.moveTo(this.x, this.y - this.size * 0.6);
            ctx.lineTo(this.x, this.y + this.size * 0.6);
            ctx.stroke();
        } else {
            // 默认粒子渲染
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// 游戏初始化
document.addEventListener('DOMContentLoaded', () => {
    // 创建游戏实例
    window.game = new UnderwaterHuntingGame();
});

// 防止页面滚动
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// 防止双击缩放
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// 飘字效果类
class FloatingText {
    constructor(x, y, text, color = '#ffffff', duration = 2000) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.vy = -2; // 向上飘动
        this.vx = (Math.random() - 0.5) * 1; // 轻微左右摆动
        this.lifeDecay = 1.0 / (duration / 16.67); // 基于60FPS计算衰减率
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.lifeDecay;

        // 减速效果
        this.vy *= 0.98;
        this.vx *= 0.98;
    }

    render(ctx) {
        if (this.life <= 0) return;

        ctx.save();

        // 透明度随生命值变化
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;

        // 文字样式
        ctx.fillStyle = this.color;
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 3;

        // 描边
        ctx.strokeText(this.text, this.x, this.y);
        // 填充
        ctx.fillText(this.text, this.x, this.y);

        ctx.restore();
    }
}
