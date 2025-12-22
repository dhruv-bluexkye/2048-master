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
  var gameOverTitle = document.querySelector(".game-over-title");
  var scoreWrapper = document.querySelector(".score-wrapper");
  var gameExplanation = document.querySelector(".game-explanation");
  var backButton = document.querySelector(".back-button");
  
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
    
    // Check if score submission is already complete
    var submissionComplete = (typeof scoreSubmissionComplete !== 'undefined' && scoreSubmissionComplete);
    var isSubmitting = (typeof scoreSubmitting !== 'undefined' && scoreSubmitting);
    
    // Update game over message based on session state and submission status
    if (submissionComplete) {
      // Submission already complete, show GAME OVER
      if (gameOverTitle) {
        gameOverTitle.textContent = 'GAME OVER';
      }
      if (backButton) {
        backButton.style.display = '';
      }
    } else if (typeof poolId !== 'undefined' && poolId && typeof sessionId !== 'undefined' && sessionId && typeof authToken !== 'undefined' && authToken && !isSubmitting) {
      // Has session but not submitting yet - will show submitting message
      // Only set if not already set to avoid overwriting updates
      if (gameOverTitle && gameOverTitle.textContent !== 'Submitting score...' && gameOverTitle.textContent !== 'GAME OVER') {
        gameOverTitle.textContent = 'Submitting score...';
      }
      // Hide back button initially (will show after score submission)
      if (backButton) {
        backButton.style.display = 'none';
      }
    } else if (isSubmitting) {
      // Currently submitting - keep the message as is or set to submitting
      if (gameOverTitle && gameOverTitle.textContent !== 'Submitting score...') {
        gameOverTitle.textContent = 'Submitting score...';
      }
      if (backButton) {
        backButton.style.display = 'none';
      }
    } else {
      // No session or other case - show GAME OVER
      if (gameOverTitle) {
        gameOverTitle.textContent = 'GAME OVER';
      }
      // If no session, show back button immediately
      if (backButton) {
        backButton.style.display = '';
      }
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

// Update game over message (global function for Flutter integration)
window.updateGameOverMessage = function(text) {
  console.log('updateGameOverMessage called with:', text);
  var gameOverTitle = document.querySelector(".game-over-title");
  if (gameOverTitle) {
    gameOverTitle.textContent = text;
    console.log('Game over title updated to:', text);
  } else {
    console.warn('Game over title element not found!');
    // Try again after a short delay in case element isn't ready yet
    setTimeout(function() {
      var retryElement = document.querySelector(".game-over-title");
      if (retryElement) {
        retryElement.textContent = text;
        console.log('Game over title updated on retry to:', text);
      }
    }, 100);
  }
};

// Polling function to check and update game over screen based on submission state
window.checkAndUpdateGameOverScreen = function() {
  var gameOverScreen = document.querySelector(".game-over-screen");
  if (!gameOverScreen || gameOverScreen.classList.contains("hidden")) {
    return; // Game over screen not visible
  }
  
  var gameOverTitle = document.querySelector(".game-over-title");
  var backButton = document.querySelector(".back-button");
  
  // Check submission state
  var submissionComplete = (typeof scoreSubmissionComplete !== 'undefined' && scoreSubmissionComplete);
  var isSubmitting = (typeof scoreSubmitting !== 'undefined' && scoreSubmitting);
  
  if (submissionComplete && gameOverTitle && gameOverTitle.textContent === 'Submitting score...') {
    // Submission complete but still showing submitting - update it
    gameOverTitle.textContent = 'GAME OVER';
    console.log('Polling: Updated game over message to GAME OVER');
    
    if (backButton) {
      backButton.style.display = '';
      console.log('Polling: Back button shown');
    }
  } else if (!isSubmitting && !submissionComplete && gameOverTitle && gameOverTitle.textContent === 'Submitting score...') {
    // Not submitting and not complete but still showing submitting - might be stuck
    // Check if we have session params
    var hasSession = (typeof poolId !== 'undefined' && poolId && typeof sessionId !== 'undefined' && sessionId && typeof authToken !== 'undefined' && authToken);
    if (!hasSession) {
      // No session, should show GAME OVER
      gameOverTitle.textContent = 'GAME OVER';
      if (backButton) {
        backButton.style.display = '';
      }
    }
  }
};

// Start polling when game over screen is shown
if (typeof setInterval !== 'undefined') {
  setInterval(function() {
    if (typeof checkAndUpdateGameOverScreen === 'function') {
      checkAndUpdateGameOverScreen();
    }
  }, 200); // Check every 200ms
}

// Show back button (global function for Flutter integration)
window.showBackButton = function() {
  var backButton = document.querySelector(".back-button");
  if (backButton) {
    backButton.style.display = '';
    // Fade in effect if supported
    if (backButton.style.transition !== undefined) {
      backButton.style.opacity = '0';
      setTimeout(function() {
        backButton.style.transition = 'opacity 0.3s';
        backButton.style.opacity = '1';
      }, 10);
    }
  }
};

// Hide back button (global function for Flutter integration)
window.hideBackButton = function() {
  var backButton = document.querySelector(".back-button");
  if (backButton) {
    backButton.style.display = 'none';
  }
};
