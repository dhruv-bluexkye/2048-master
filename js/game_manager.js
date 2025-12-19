function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = 2;
  // Timer duration will be read dynamically when startTimer() is called
  this.timeLeft       = 180; // Default, will be updated when timer starts
  this.timerInterval  = null;
  this.gameStartTime  = null; // Track when game started for time calculation

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.stopTimer();
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  // Timer duration will be read when startTimer() is called
  this.setup();
  this.startTimer();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;
    // Timer duration will be set when startTimer() is called, not here

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) {
    // Ensure game over screen is shown even if game was already over
    if (this.over) {
      this.actuate();
    }
    return; // Don't do anything if the game's over
  }

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();

    if (!this.movesAvailable()) {
      this.stopTimer();
      this.over = true; // Game over!
      // Submit score when game ends due to no moves
      this.submitScore();
    }

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

// Start the timer
GameManager.prototype.startTimer = function () {
  var self = this;
  // Re-read Flutter timer duration when starting (in case it was injected after GameManager was created)
  // Check window.__GAME_SESSION__ first, then global gameTimerDuration, then default
  var timerDuration = 180; // Default
  
  // First check if window.__GAME_SESSION__ exists and has timerDuration
  if (window.__GAME_SESSION__ && window.__GAME_SESSION__.timerDuration !== undefined) {
    timerDuration = parseInt(window.__GAME_SESSION__.timerDuration) || 180;
  } else if (window.__GAME_SESSION__ && window.__GAME_SESSION__.timer !== undefined) {
    timerDuration = parseInt(window.__GAME_SESSION__.timer) || 180;
  } else if (typeof gameTimerDuration !== 'undefined' && gameTimerDuration) {
    // Fallback to global gameTimerDuration variable
    timerDuration = gameTimerDuration;
  }
  
  console.log('Starting timer with duration:', timerDuration, 'from', window.__GAME_SESSION__ ? 'window.__GAME_SESSION__' : 'gameTimerDuration');
  this.timeLeft = timerDuration;
  this.gameStartTime = Date.now(); // Track when game started
  this.actuator.updateTimer(this.timeLeft);
  
  this.timerInterval = setInterval(function() {
    self.timeLeft--;
    self.actuator.updateTimer(self.timeLeft);
    
    if (self.timeLeft <= 0) {
      self.stopTimer();
      self.over = true;
      self.actuate();
      // Submit score when timer runs out
      self.submitScore();
    }
  }, 1000);
};

// Stop the timer
GameManager.prototype.stopTimer = function () {
  if (this.timerInterval) {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }
};

// Submit score to Flutter backend
GameManager.prototype.submitScore = function () {
  console.log('submitScore called. Score:', this.score, 'TimeLeft:', this.timeLeft);
  console.log('submitScoreToFlutter function exists:', typeof submitScoreToFlutter === 'function');
  console.log('Flutter params - poolId:', typeof poolId !== 'undefined' ? poolId : 'undefined', 'sessionId:', typeof sessionId !== 'undefined' ? sessionId : 'undefined', 'authToken:', typeof authToken !== 'undefined' ? (authToken ? 'exists' : 'null') : 'undefined');
  
  if (typeof submitScoreToFlutter === 'function') {
    // Re-read Flutter timer duration (in case it was injected after GameManager was created)
    var timerDuration = 180; // Default
    
    // First check if window.__GAME_SESSION__ exists and has timerDuration
    if (window.__GAME_SESSION__ && window.__GAME_SESSION__.timerDuration !== undefined) {
      timerDuration = parseInt(window.__GAME_SESSION__.timerDuration) || 180;
    } else if (window.__GAME_SESSION__ && window.__GAME_SESSION__.timer !== undefined) {
      timerDuration = parseInt(window.__GAME_SESSION__.timer) || 180;
    } else if (typeof gameTimerDuration !== 'undefined' && gameTimerDuration) {
      // Fallback to global gameTimerDuration variable
      timerDuration = gameTimerDuration;
    }
    
    // Calculate time taken in seconds
    // If timer reached 0, time is full timer duration
    // Otherwise, if game ended early, time is timerDuration - remaining timer
    var timeTaken = timerDuration; // Default to full timer duration
    
    if (this.timeLeft !== undefined && this.timeLeft > 0) {
      // Game ended early (before timer), calculate time taken
      timeTaken = timerDuration - this.timeLeft;
      timeTaken = Math.ceil(timeTaken);
    } else if (this.timeLeft !== undefined && this.timeLeft <= 0) {
      // Timer reached 0, full timer duration
      timeTaken = timerDuration;
    }
    
    console.log('Calling submitScoreToFlutter with score:', this.score, 'timeTaken:', timeTaken);
    // Submit score
    submitScoreToFlutter(this.score, timeTaken);
  } else {
    console.error('submitScoreToFlutter function not found!');
  }
};
