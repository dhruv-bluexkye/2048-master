// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  var startScreen = document.querySelector(".start-screen");
  var playButton = document.querySelector(".play-button");
  var gameOverScreen = document.querySelector(".game-over-screen");
  var backButton = document.querySelector(".back-button");
  var gameManager = null;

  // Function to start the game
  function startGame() {
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

  // Add click event to play button
  playButton.addEventListener("click", startGame);
  playButton.addEventListener("touchend", function(e) {
    e.preventDefault();
    startGame();
  });

  // Add click event to back button
  backButton.addEventListener("click", goBack);
  backButton.addEventListener("touchend", function(e) {
    e.preventDefault();
    goBack();
  });
});
