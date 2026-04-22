const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000',
};

const PIECES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};

const PIECE_KEYS = Object.keys(PIECES);

const SCORE_TABLE = [0, 100, 300, 500, 800];

const SPEED_BY_LEVEL = [800, 720, 630, 550, 470, 380, 300, 220, 130, 100, 80];

function randomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  return { type: key, matrix: PIECES[key].map(r => [...r]), x: 3, y: 0 };
}

function rotate(matrix) {
  const N = matrix.length;
  return matrix[0].map((_, c) => matrix.map((row, r) => matrix[N - 1 - r][c]));
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

class Tetris {
  constructor(canvas, nextCanvas, onScore) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext('2d');
    this.onScore = onScore;

    this.board = createBoard();
    this.current = randomPiece();
    this.next = randomPiece();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.paused = false;
    this._lastTime = 0;
    this._drop = 0;
    this._rafId = null;
  }

  start() {
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(t => this._loop(t));
  }

  stop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  _speed() {
    return SPEED_BY_LEVEL[Math.min(this.level - 1, SPEED_BY_LEVEL.length - 1)];
  }

  _loop(time) {
    if (!this.paused && !this.gameOver) {
      const delta = time - this._lastTime;
      this._drop += delta;
      if (this._drop >= this._speed()) {
        this._drop = 0;
        this._gravity();
      }
    }
    this._lastTime = time;
    this._draw();
    this._rafId = requestAnimationFrame(t => this._loop(t));
  }

  _gravity() {
    this.current.y++;
    if (this._collides(this.current)) {
      this.current.y--;
      this._lock();
    }
  }

  _collides(piece) {
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        const nx = piece.x + c;
        const ny = piece.y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  _lock() {
    for (let r = 0; r < this.current.matrix.length; r++) {
      for (let c = 0; c < this.current.matrix[r].length; c++) {
        if (!this.current.matrix[r][c]) continue;
        const ny = this.current.y + r;
        if (ny < 0) { this._endGame(); return; }
        this.board[ny][this.current.x + c] = this.current.type;
      }
    }
    this._clearLines();
    this.current = this.next;
    this.next = randomPiece();
    if (this._collides(this.current)) this._endGame();
  }

  _clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every(cell => cell !== null)) {
        this.board.splice(r, 1);
        this.board.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      this.score += SCORE_TABLE[cleared] * this.level;
      this.lines += cleared;
      this.level = Math.floor(this.lines / 10) + 1;
      this.onScore(this.score, this.lines, this.level);
    }
  }

  _endGame() {
    this.gameOver = true;
    this.onScore(this.score, this.lines, this.level, true);
  }

  moveLeft() {
    this.current.x--;
    if (this._collides(this.current)) this.current.x++;
  }

  moveRight() {
    this.current.x++;
    if (this._collides(this.current)) this.current.x--;
  }

  moveDown() {
    this.current.y++;
    if (this._collides(this.current)) {
      this.current.y--;
      this._lock();
    }
    this._drop = 0;
  }

  hardDrop() {
    while (!this._collides({ ...this.current, y: this.current.y + 1 })) {
      this.current.y++;
    }
    this._lock();
    this._drop = 0;
  }

  rotatePiece() {
    const rotated = rotate(this.current.matrix);
    const orig = this.current.matrix;
    this.current.matrix = rotated;
    if (this._collides(this.current)) {
      this.current.x--;
      if (this._collides(this.current)) {
        this.current.x += 2;
        if (this._collides(this.current)) {
          this.current.x--;
          this.current.matrix = orig;
        }
      }
    }
  }

  togglePause() {
    this.paused = !this.paused;
  }

  _ghostY() {
    let gy = this.current.y;
    while (!this._collides({ ...this.current, y: gy + 1 })) gy++;
    return gy;
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // draw board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.board[r][c]) {
          this._drawBlock(ctx, c, r, COLORS[this.board[r][c]]);
        } else {
          ctx.fillStyle = '#0f0f1a';
          ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2);
        }
      }
    }

    // draw ghost
    const ghostY = this._ghostY();
    for (let r = 0; r < this.current.matrix.length; r++) {
      for (let c = 0; c < this.current.matrix[r].length; c++) {
        if (!this.current.matrix[r][c]) continue;
        const x = (this.current.x + c) * BLOCK;
        const y = (ghostY + r) * BLOCK;
        ctx.strokeStyle = COLORS[this.current.type] + '55';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, BLOCK - 4, BLOCK - 4);
      }
    }

    // draw current piece
    for (let r = 0; r < this.current.matrix.length; r++) {
      for (let c = 0; c < this.current.matrix[r].length; c++) {
        if (!this.current.matrix[r][c]) continue;
        this._drawBlock(ctx, this.current.x + c, this.current.y + r, COLORS[this.current.type]);
      }
    }

    // draw next piece
    this._drawNext();
  }

  _drawBlock(ctx, col, row, color) {
    ctx.fillStyle = color;
    ctx.fillRect(col * BLOCK + 1, row * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(col * BLOCK + 1, row * BLOCK + 1, BLOCK - 2, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(col * BLOCK + 1, row * BLOCK + BLOCK - 5, BLOCK - 2, 4);
  }

  _drawNext() {
    const ctx = this.nextCtx;
    const size = 4 * 25;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, size, size);

    const m = this.next.matrix;
    const bSize = 22;
    const offX = Math.floor((4 - m[0].length) / 2);
    const offY = Math.floor((4 - m.length) / 2);

    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const x = (offX + c) * bSize + 4;
        const y = (offY + r) * bSize + 4;
        ctx.fillStyle = COLORS[this.next.type];
        ctx.fillRect(x, y, bSize - 2, bSize - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x, y, bSize - 2, 3);
      }
    }
  }
}

export { Tetris };
