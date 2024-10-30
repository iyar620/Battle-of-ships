const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverMessageElement = document.getElementById('gameOverMessage');
const gameOverTextElement = document.getElementById('gameOverText');
const restartButton = document.getElementById('restartButton');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const images = {
    player: './images/player.png',
    enemy: './images/enemy.png',
    wood: './images/wood.png',
    bullet: './images/rocket.png',
};

let loadedImages = {};
let imagesToLoad = Object.keys(images).length;
let imagesLoaded = 0;
let gameOver = false;
let waveOffset = 0;
let backgroundOffset = 0;
const waveSpeed = 0.050; // האטת מהירות הגלים
const backgroundSpeed = 0.1; // מהירות שינוי הצבעים ברקע

function loadImages() {
    for (let key in images) {
        loadedImages[key] = new Image();
        loadedImages[key].src = images[key];
        loadedImages[key].onload = onImageLoad;
        loadedImages[key].onerror = () => console.error(`Failed to load ${images[key]}`);
    }
}
document.body.addEventListener('touchmove', function(event) {
    event.preventDefault();
}, { passive: false });

function onImageLoad() {
    imagesLoaded++;
    if (imagesLoaded === imagesToLoad) {
        startGame();
    }
}

class Ship {
    constructor(x, y, image) {
        this.x = x;
        this.y = y;
        this.width = image.width;
        this.height = image.height;
        this.image = image;
        this.health = 300;
        this.speed = 7;
        this.fireRate = 7;
        this.wood = 0;
        this.lastShotTime = 0;
        this.range = 500;
        this.dx = 0;
        this.dy = 0;
    }

    draw() {
        if (!gameOver) {
            ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            this.drawHealthAndUpgrades();
        }
    }

    drawHealthAndUpgrades() {
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(`Health: ${this.health}`, this.x, this.y - 10);
        ctx.fillText(`Upgrades: ${this.wood}`, this.x, this.y - 25);
    }

    move() {
        if (!gameOver) {
            this.x = Math.max(0, Math.min(canvas.width - this.width, this.x + this.dx * this.speed));
            this.y = Math.max(0, Math.min(canvas.height - this.height, this.y + this.dy * this.speed));
        }
    }

    canShoot() {
        const currentTime = Date.now();
        return currentTime - this.lastShotTime >= (1000 / this.fireRate);
    }

    shoot(target) {
        if (this.canShoot()) {
            this.lastShotTime = Date.now();
            const angle = Math.atan2(target.y - this.y, target.x - this.x);
            bullets.push(new Bullet(this.x + this.width / 2, this.y + this.height / 2, angle));
        }
    }

    collectWood() {
        this.wood += 1;
        this.health += 10;
        this.fireRate += 0.1;
    }
}

class EnemyShip extends Ship {
    constructor(x, y) {
        super(x, y, loadedImages.enemy);
        this.health = 150;
        this.speed = 4;
        this.fireRate = 4;
        this.lastShotTime = 0;
    }

    moveTowards(target) {
        const dx = (target.x + target.width / 2) - (this.x + this.width / 2);
        const dy = (target.y + target.height / 2) - (this.y + this.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.x += (dx / distance) * this.speed;
        this.y += (dy / distance) * this.speed;
    }

    shootAtPlayer(player) {
        const distance = Math.hypot(
            (player.x + player.width / 2) - (this.x + this.width / 2),
            (player.y + player.height / 2) - (this.y + this.height / 2)
        );
        if (distance < this.range && this.canShoot()) {
            this.lastShotTime = Date.now();
            const angle = Math.atan2(
                (player.y + player.height / 2) - (this.y + this.height / 2),
                (player.x + player.width / 2) - (this.x + this.width / 2)
            );
            enemyBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height / 2, angle));
        }
    }
}

class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.width = 5;
        this.height = 10;
        this.speed = 7;
        this.angle = angle;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.drawImage(loadedImages.bullet, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }

    hits(ship) {
        return (
            this.x < ship.x + ship.width &&
            this.x + this.width > ship.x &&
            this.y < ship.y + ship.height &&
            this.y + this.height > ship.y
        );
    }
}

class Wood {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
    }

    draw() {
        ctx.drawImage(loadedImages.wood, this.x, this.y, this.width, this.height);
    }

    collect(ship) {
        return (
            ship.x < this.x + this.width &&
            ship.x + ship.width > this.x &&
            ship.y < this.y + this.height &&
            ship.y + ship.height > this.y
        );
    }
}

let player;
let enemies = [];
let woods = [];
let bullets = [];
let enemyBullets = [];
let score = 0;
let keys = {};

function startGame() {
    player = new Ship(canvas.width / 2, canvas.height - 60, loadedImages.player);
    enemies = [];
    woods = [];
    bullets = [];
    enemyBullets = [];
    score = 0;
    gameOver = false;
    gameOverMessageElement.style.display = 'none';
    spawnEnemies();
    spawnWoods();
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
     // מאזיני מגע
    canvas.addEventListener('touchstart', (event) => {
        const nearestEnemy = getNearestEnemy();
        if (nearestEnemy) {
            player.shoot(nearestEnemy);
        }
        event.preventDefault(); // למנוע גלילה
    });

    canvas.addEventListener('touchmove', (event) => {
        const touch = event.touches[0];
        player.x = touch.clientX - player.width / 2;
        player.y = touch.clientY - player.height / 2;
        event.preventDefault(); // למנוע גלילה
    });
        // בדיקת ירי במגע
    canvas.addEventListener('touchstart', (event) => {
        const nearestEnemy = getNearestEnemy();
        if (nearestEnemy) {
            player.shoot(nearestEnemy);
        }
        // ננסה להסיר את preventDefault זמנית לבדיקה
        // event.preventDefault();
    });

    // בדיקת תזוזת השחקן במגע
    canvas.addEventListener('touchmove', (event) => {
        const touch = event.touches[0];
        console.log("Touch X:", touch.clientX, "Touch Y:", touch.clientY); // בדיקת קואורדינטות במסוף
        player.x = touch.clientX - player.width / 2;
        player.y = touch.clientY - player.height / 2;
        // ננסה להסיר את preventDefault זמנית לבדיקה
        // event.preventDefault();
    });

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    gameLoop();
}

function spawnEnemies() {
    setInterval(() => {
        if (enemies.length < 3) {
            const x = Math.random() * (canvas.width - 50);
            enemies.push(new EnemyShip(x, -50));
        }
    }, 3000);
}

function spawnWoods() {
    setInterval(() => {
        if (woods.length < 5) {
            const x = Math.random() * (canvas.width - 20);
            const y = Math.random() * (canvas.height - 20);
            woods.push(new Wood(x, y));
        }
    }, 5000);
}

function getNearestEnemy() {
    let nearestEnemy = null;
    let minDistance = Infinity;

    enemies.forEach(enemy => {
        const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (distance < minDistance && distance <= player.range) {
            minDistance = distance;
            nearestEnemy = enemy;
        }
    });

    return nearestEnemy;
}

function drawWaves() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // צבעים ברקע משתנים
    const hue = (backgroundOffset % 360);
    const waveColors = [
        `hsl(${hue}, 80%, 60%)`,
        `hsl(${hue + 20}, 80%, 65%)`,
        `hsl(${hue + 40}, 80%, 70%)`,
        `hsl(${hue + 60}, 80%, 75%)`,
        `hsl(${hue + 80}, 80%, 80%)`
    ];

    // הגדרת קונפיגורציות לכל קו גל
    const waveConfigs = [
        { amplitude: 20, frequency: 0.02, phase: 0, speed: waveSpeed, verticalOffset: canvas.height / 3 },
        { amplitude: 25, frequency: 0.03, phase: Math.PI / 4, speed: waveSpeed, verticalOffset: canvas.height / 2 },
        { amplitude: 18, frequency: 0.04, phase: -Math.PI / 4, speed: waveSpeed, verticalOffset: canvas.height / 1.5 }
    ];

    waveConfigs.forEach((config, index) => {
        ctx.strokeStyle = waveColors[index];
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x++) {
            const y = config.amplitude * Math.sin(x * config.frequency + waveOffset + config.phase) + config.verticalOffset;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    });
    waveOffset += waveSpeed;
    backgroundOffset += backgroundSpeed;
}

function handleKeyDown(e) {
    keys[e.code] = true;

    if (e.code === 'Space') {
        const nearestEnemy = getNearestEnemy();
        if (nearestEnemy) {
            player.shoot(nearestEnemy);
        }
    }
}

function handleKeyUp(e) {
    keys[e.code] = false;
}

function updatePlayerMovement() {
    player.dx = 0;
    player.dy = 0;
    if (keys['ArrowUp'] || keys['KeyW']) player.dy = -1;
    if (keys['ArrowDown'] || keys['KeyS']) player.dy = 1;
    if (keys['ArrowLeft'] || keys['KeyA']) player.dx = -1;
    if (keys['ArrowRight'] || keys['KeyD']) player.dx = 1;
    player.move();
}

function updateBullets() {
    bullets = bullets.filter(bullet => {
        bullet.update();
        let hitEnemy = false;
        enemies = enemies.filter(enemy => {
            if (bullet.hits(enemy)) {
                enemy.health -= 50;
                hitEnemy = true;
                if (enemy.health <= 0) {
                    score += 10;
                    return false;
                }
            }
            return true;
        });
        return !hitEnemy && bullet.x > 0 && bullet.x < canvas.width && bullet.y > 0 && bullet.y < canvas.height;
    });
}

function updateEnemyBullets() {
    enemyBullets = enemyBullets.filter(bullet => {
        bullet.update();
        if (bullet.hits(player)) {
            player.health -= 20;
            return false;
        }
        return bullet.x > 0 && bullet.x < canvas.width && bullet.y > 0 && bullet.y < canvas.height;
    });
}

function updateEnemies() {
    enemies.forEach(enemy => {
        enemy.moveTowards(player);
        enemy.shootAtPlayer(player);
    });
}

function updateWoods() {
    woods = woods.filter(wood => {
        if (wood.collect(player)) {
            player.collectWood();
            return false;
        }
        return true;
    });
}

function checkGameOver() {
    if (player.health <= 0) {
        gameOver = true;
        gameOverTextElement.textContent = `Game Over! Score: ${score}`;
        gameOverMessageElement.style.display = 'block';
    }
}

function gameLoop() {
    if (!gameOver) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawWaves();
        player.draw();
        updatePlayerMovement();
        updateBullets();
        updateEnemyBullets();
        updateEnemies();
        updateWoods();
        checkGameOver();
        bullets.forEach(bullet => bullet.draw());
        enemyBullets.forEach(bullet => bullet.draw());
        woods.forEach(wood => wood.draw());
        enemies.forEach(enemy => enemy.draw());
        requestAnimationFrame(gameLoop);
    }
}

restartButton.addEventListener('click', startGame);
loadImages();
