// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  var startScreen = document.querySelector(".start-screen");
  var playButton = document.querySelector(".play-button");
  var playButtonText = playButton ? playButton.textContent : null;
  var gameOverScreen = document.querySelector(".game-over-screen");
  var backButton = document.querySelector(".back-button");
  var gameManager = null;

  // Function to show play button (only if session is ready)
  window.showPlayButton = function() {
    if (typeof sessionReady !== 'undefined' && sessionReady) {
      if (playButton) {
        playButton.style.display = '';
        playButton.classList.remove("hidden");
        // Update text to "Play!" when session ready
        if (playButtonText !== null) {
          playButton.textContent = 'Play!';
        }
      }
    } else {
      if (playButton) {
        playButton.style.display = 'none';
      }
    }
  };

  // Function to hide play button
  window.hidePlayButton = function() {
    if (playButton) {
      playButton.style.display = 'none';
    }
  };

  // Function to update start screen message
  function updateStartScreenMessage() {
    var startDescription = document.querySelector(".start-description");
    if (startDescription) {
      if (typeof sessionReady !== 'undefined' && sessionReady) {
        startDescription.textContent = 'Join the numbers and get to the 2048 tile!';
      } else {
        startDescription.textContent = 'Setting up your session...';
      }
    }
  }

  // Function to start the game
  function startGame() {
    // Don't start if session not ready
    if (typeof sessionReady !== 'undefined' && !sessionReady) {
      return false;
    }
    
    // Reset submission state flags for new game
    if (typeof scoreSubmitting !== 'undefined') {
      scoreSubmitting = false;
    }
    if (typeof scoreSubmissionComplete !== 'undefined') {
      scoreSubmissionComplete = false;
    }
    
    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    // Hide title and above-game section (New Game button and intro text)
    var heading = document.querySelector(".heading");
    var aboveGame = document.querySelector(".above-game");
    if (heading) heading.classList.add("start-hidden");
    if (aboveGame) aboveGame.classList.add("start-hidden");
    // Show only score and game explanation
    var scoreWrapper = document.querySelector(".score-wrapper");
    var gameExplanation = document.querySelector(".game-explanation");
    if (scoreWrapper) scoreWrapper.classList.remove("start-hidden");
    if (gameExplanation) gameExplanation.classList.remove("start-hidden");
    
    // Clear any saved game state to ensure fresh start
    var storageManager = new LocalStorageManager();
    storageManager.clearGameState();
    
    if (!gameManager) {
      gameManager = new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
      window.gameManager = gameManager; // Make available globally for score submission
      gameManager.startTimer();
    } else {
      // Always start a new game when Play is clicked
      gameManager.restart();
    }
  }

  // Function to go back to start screen or close Flutter window
  function goBack() {
    // If Flutter integration is available, close the window
    if (typeof closeFlutterWindow === 'function') {
      closeFlutterWindow();
    } else {
      // Fallback: go back to start screen
      gameOverScreen.classList.add("hidden");
      startScreen.classList.remove("hidden");
      // Hide game elements
      var hiddenElements = document.querySelectorAll(".start-hidden");
      hiddenElements.forEach(function(el) {
        el.classList.add("start-hidden");
      });
    }
  }

  // Initial setup: hide play button and show loading message
  if (playButton) {
    playButton.style.display = 'none';
  }
  updateStartScreenMessage();

  // Check session periodically and update UI
  function checkSessionPeriodically() {
    if (typeof sessionReady !== 'undefined') {
      if (sessionReady) {
        showPlayButton();
        updateStartScreenMessage();
      } else {
        hidePlayButton();
        updateStartScreenMessage();
        // Check again after a delay
        setTimeout(checkSessionPeriodically, 500);
      }
    } else {
      // sessionReady not defined yet, check again
      setTimeout(checkSessionPeriodically, 500);
    }
  }
  
  // Start checking after a short delay
  setTimeout(checkSessionPeriodically, 100);

  // Add click event to play button
  if (playButton) {
    playButton.addEventListener("click", startGame);
    playButton.addEventListener("touchend", function(e) {
      e.preventDefault();
      startGame();
    });
  }

  // Add click event to back button
  if (backButton) {
    backButton.addEventListener("click", goBack);
    backButton.addEventListener("touchend", function(e) {
      e.preventDefault();
      goBack();
    });
  }
});
