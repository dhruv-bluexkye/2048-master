function HTMLActuator() {
  this.tileContainer    = document.querySelector(".tile-container");
  this.scoreContainer   = document.querySelector(".score-container");
  this.bestContainer    = document.querySelector(".best-container");
  this.messageContainer = document.querySelector(".game-message");
  this.gameOverScreen   = document.querySelector(".game-over-screen");
  this.finalScore       = document.querySelector(".final-score");
  this.timerContainer   = document.querySelector(".timer-container");

  this.score = 0;
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  // Show game over screen immediately if game is over
  if (metadata.over) {
    this.showGameOverScreen(metadata.score);
  }

  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);

    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) {
          self.addTile(cell);
        }
      });
    });

    self.updateScore(metadata.score);
    self.updateBestScore(metadata.bestScore);

    if (metadata.over) {
      self.message(false); // You lose
      // Screen already shown above, but ensure it's still visible
      self.showGameOverScreen(metadata.score);
    } else if (metadata.terminated && metadata.won) {
      self.message(true); // You win!
    }

  });
};

// Continues the game (both restart and keep playing)
HTMLActuator.prototype.continueGame = function () {
  this.clearMessage();
  this.hideGameOverScreen();
};

// Show the game over screen
HTMLActuator.prototype.showGameOverScreen = function (score) {
  // Query elements each time to ensure they exist
  var gameOverScreen = document.querySelector(".game-over-screen");
  var finalScore = document.querySelector(".final-score");
  var scoreWrapper = document.querySelector(".score-wrapper");
  var gameExplanation = document.querySelector(".game-explanation");
  
  if (gameOverScreen) {
    gameOverScreen.classList.remove("hidden");
    if (finalScore) {
      finalScore.textContent = score;
    }
    // Hide score and instructions when game over screen is shown
    if (scoreWrapper) {
      scoreWrapper.classList.add("start-hidden");
    }
    if (gameExplanation) {
      gameExplanation.classList.add("start-hidden");
    }
  }
};

// Hide the game over screen
HTMLActuator.prototype.hideGameOverScreen = function () {
  var gameOverScreen = document.querySelector(".game-over-screen");
  if (gameOverScreen) {
    gameOverScreen.classList.add("hidden");
  }
};

HTMLActuator.prototype.clearContainer = function (container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
};

HTMLActuator.prototype.addTile = function (tile) {
  var self = this;

  var wrapper   = document.createElement("div");
  var inner     = document.createElement("div");
  var position  = tile.previousPosition || { x: tile.x, y: tile.y };
  var positionClass = this.positionClass(position);

  // We can't use classlist because it somehow glitches when replacing classes
  var classes = ["tile", "tile-" + tile.value, positionClass];

  if (tile.value > 2048) classes.push("tile-super");

  this.applyClasses(wrapper, classes);

  inner.classList.add("tile-inner");
  inner.textContent = tile.value;

  if (tile.previousPosition) {
    // Make sure that the tile gets rendered in the previous position first
    window.requestAnimationFrame(function () {
      classes[2] = self.positionClass({ x: tile.x, y: tile.y });
      self.applyClasses(wrapper, classes); // Update the position
    });
  } else if (tile.mergedFrom) {
    classes.push("tile-merged");
    this.applyClasses(wrapper, classes);

    // Render the tiles that merged
    tile.mergedFrom.forEach(function (merged) {
      self.addTile(merged);
    });
  } else {
    classes.push("tile-new");
    this.applyClasses(wrapper, classes);
  }

  // Add the inner part of the tile to the wrapper
  wrapper.appendChild(inner);

  // Put the tile on the board
  this.tileContainer.appendChild(wrapper);
};

HTMLActuator.prototype.applyClasses = function (element, classes) {
  element.setAttribute("class", classes.join(" "));
};

HTMLActuator.prototype.normalizePosition = function (position) {
  return { x: position.x + 1, y: position.y + 1 };
};

HTMLActuator.prototype.positionClass = function (position) {
  position = this.normalizePosition(position);
  return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.updateScore = function (score) {
  this.clearContainer(this.scoreContainer);

  var difference = score - this.score;
  this.score = score;

  this.scoreContainer.textContent = this.score;

  if (difference > 0) {
    var addition = document.createElement("div");
    addition.classList.add("score-addition");
    addition.textContent = "+" + difference;

    this.scoreContainer.appendChild(addition);
  }
};

HTMLActuator.prototype.updateBestScore = function (bestScore) {
  this.bestContainer.textContent = bestScore;
};

HTMLActuator.prototype.updateTimer = function (timeLeft) {
  if (this.timerContainer) {
    this.timerContainer.textContent = timeLeft;
  } else {
    // Fallback: query element if not cached
    var timerContainer = document.querySelector(".timer-container");
    if (timerContainer) {
      timerContainer.textContent = timeLeft;
    }
  }
};

HTMLActuator.prototype.message = function (won) {
  var type    = won ? "game-won" : "game-over";
  var message = won ? "You win!" : "Game over!";

  this.messageContainer.classList.add(type);
  this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.clearMessage = function () {
  // IE only takes one value to remove at a time.
  this.messageContainer.classList.remove("game-won");
  this.messageContainer.classList.remove("game-over");
};
