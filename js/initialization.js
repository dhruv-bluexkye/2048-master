// ============================================
// Flutter Integration Variables
// ============================================
var poolId = null;
var sessionId = null;
var authToken = null;
var gameStartTime = null;
var gameTimerDuration = 180; // Default timer duration in seconds (will be overridden by Flutter)
var apiServerUrl = 'https://api.metaninza.net'; // Default API server URL

// Session and submission state tracking
var sessionReady = false; // Track if session parameters are ready
var scoreSubmitting = false; // Track if score is being submitted
var scoreSubmissionComplete = false; // Track if score submission is complete

// Timer variables (if using timer)
var gameTimer = null; // Current timer value
var gameTimerStartTime = undefined; // When the timer started (timestamp)
var gameTimerPausedElapsed = undefined; // Elapsed time when paused

// Get URL parameters for Flutter integration (fallback method)
function getUrlParameter(name) {
	name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
	var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
	var results = regex.exec(location.search);
	return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Update timer display from current session or global variable
function updateTimerDisplay() {
	var timerDuration = gameTimerDuration || 15; // Default
	
	// First check if window.__GAME_SESSION__ exists and has timerDuration
	if (window.__GAME_SESSION__ && window.__GAME_SESSION__.timerDuration !== undefined) {
		timerDuration = parseInt(window.__GAME_SESSION__.timerDuration) || gameTimerDuration || 15;
	} else if (window.__GAME_SESSION__ && window.__GAME_SESSION__.timer !== undefined) {
		timerDuration = parseInt(window.__GAME_SESSION__.timer) || gameTimerDuration || 15;
	} else if (typeof gameTimerDuration !== 'undefined' && gameTimerDuration) {
		// Fallback to global gameTimerDuration variable
		timerDuration = gameTimerDuration;
	}
	
	setTimeout(function() {
		var timerContainer = document.querySelector(".timer-container");
		if (timerContainer) {
			timerContainer.textContent = timerDuration;
		}
	}, 100);
}

// Initialize Flutter parameters - priority: window.__GAME_SESSION__ > URL params > postMessage
function initFlutterParams() {
	// Request Flutter for parameters if not available
	if (!window.__GAME_SESSION__ && !sessionId && !authToken) {
		console.log('Requesting Flutter for session parameters...');
		// Try to request via postMessage
		if (window.parent && window.parent !== window) {
			window.parent.postMessage({ type: 'requestSessionParams' }, '*');
		} else if (window.flutter_inappwebview) {
			window.flutter_inappwebview.callHandler('requestSessionParams');
		}
	}
	
	// First, try to get from window.__GAME_SESSION__ (Flutter InAppWebView injection)
	if (window.__GAME_SESSION__) {
		sessionId = window.__GAME_SESSION__.sessionId;
		authToken = window.__GAME_SESSION__.token;
		
		// Check if session has expired
		if (window.__GAME_SESSION__.expiresAt && Date.now() > window.__GAME_SESSION__.expiresAt) {
			console.warn('Game session has expired');
			sessionId = null;
			authToken = null;
		}
		
		// poolId might be in the session object or URL
		if (window.__GAME_SESSION__.poolId) {
			poolId = window.__GAME_SESSION__.poolId;
		} else {
			poolId = getUrlParameter('poolId');
		}
		
		// Get timer duration from Flutter (in seconds)
		if (window.__GAME_SESSION__.timerDuration !== undefined) {
			gameTimerDuration = parseInt(window.__GAME_SESSION__.timerDuration) || 180;
		} else if (window.__GAME_SESSION__.timer !== undefined) {
			gameTimerDuration = parseInt(window.__GAME_SESSION__.timer) || 180;
		}
		// Update timer display when timer duration is set
		if (typeof updateTimerDisplay === 'function') {
			updateTimerDisplay();
		}
		
		// Get API server URL from Flutter
		if (window.__GAME_SESSION__.apiServerUrl) {
			apiServerUrl = window.__GAME_SESSION__.apiServerUrl;
		} else if (window.__GAME_SESSION__.apiServer) {
			apiServerUrl = window.__GAME_SESSION__.apiServer;
		}
	} else {
		// Fallback to URL parameters
		poolId = getUrlParameter('poolId');
		sessionId = getUrlParameter('sessionId');
		authToken = getUrlParameter('authToken');
		
		// Get timer from URL parameter if available
		var urlTimer = getUrlParameter('timer');
		if (urlTimer) {
			gameTimerDuration = parseInt(urlTimer) || 180;
		}
		
		// Get API server URL from URL parameter if available
		var urlApiServer = getUrlParameter('apiServerUrl') || getUrlParameter('apiServer');
		if (urlApiServer) {
			apiServerUrl = urlApiServer;
		}
	}
	
	// Also listen for postMessage if embedded (additional fallback)
	if (window.parent && window.parent !== window) {
		window.addEventListener('message', function(event) {
			if (event.data && event.data.type === 'flutterParams') {
				poolId = event.data.poolId || poolId;
				sessionId = event.data.sessionId || sessionId;
				authToken = event.data.authToken || authToken;
				if (event.data.timerDuration) {
					gameTimerDuration = parseInt(event.data.timerDuration) || 15;
				}
				if (event.data.apiServerUrl || event.data.apiServer) {
					apiServerUrl = event.data.apiServerUrl || event.data.apiServer;
				}
				// Update session ready flag
				if (sessionId && authToken) {
					sessionReady = true;
					// Show play button if on start screen
					if (typeof showPlayButton === 'function') {
						showPlayButton();
					}
				}
			}
		});
	}
	
	// Debug mode: Allow setting session via URL parameter for testing
	var debugMode = getUrlParameter('debug') === 'true';
	if (debugMode && !sessionId && !authToken) {
		// For testing: allow setting via URL parameters when debug=true
		poolId = getUrlParameter('poolId') || poolId || 'test-pool-123';
		sessionId = getUrlParameter('sessionId') || sessionId || 'test-session-456';
		authToken = getUrlParameter('authToken') || authToken || 'test-token-789';
		var debugApiServer = getUrlParameter('apiServerUrl') || getUrlParameter('apiServer');
		if (debugApiServer) {
			apiServerUrl = debugApiServer;
		}
		console.log('DEBUG MODE: Using test parameters');
	}
	
	// Update session ready flag
	if (sessionId && authToken) {
		sessionReady = true;
		console.log('Flutter session initialized successfully', {
			poolId: poolId,
			sessionId: sessionId,
			timerDuration: gameTimerDuration,
			apiServerUrl: apiServerUrl
		});
	} else {
		sessionReady = false;
		console.log('Flutter session parameters not found - waiting for session...');
	}
}

// Send message to Flutter app (for API responses, errors, etc.)
function sendMessageToFlutter(type, data) {
	var message = {
		type: type,
		data: data
	};
	
	if (window.parent && window.parent !== window) {
		// If in iframe, send message to parent
		window.parent.postMessage(message, '*');
	} else if (window.flutter_inappwebview) {
		// If using Flutter InAppWebView
		window.flutter_inappwebview.callHandler('onMessage', message);
	} else {
		console.log('Flutter message:', message);
	}
}

// Send message to Flutter app to close window
function closeFlutterWindow() {
	if (window.parent && window.parent !== window) {
		// If in iframe, send message to parent
		window.parent.postMessage({ type: 'closeGame' }, '*');
	} else if (window.flutter_inappwebview) {
		// If using Flutter InAppWebView
		window.flutter_inappwebview.callHandler('closeGame');
	} else {
		// Fallback: try to close window
		window.close();
	}
}

// Submit score to Flutter backend
function submitScoreToFlutter() {
	// Check if required parameters are available
	if (!poolId || !sessionId || !authToken) {
		console.log('Flutter parameters not available. Score not submitted.');
		// Show back button if no session
		if (typeof showBackButton === 'function') {
			showBackButton();
		}
		if (typeof updateGameOverMessage === 'function') {
			updateGameOverMessage('GAME OVER');
		}
		return;
	}
	
	// Mark that we're submitting
	scoreSubmitting = true;
	scoreSubmissionComplete = false;
	
	// Get score from game manager if available
	var currentScore = 0;
	if (typeof window.gameManager !== 'undefined' && window.gameManager && window.gameManager.score !== undefined) {
		currentScore = window.gameManager.score;
	} else if (typeof score !== 'undefined') {
		currentScore = score;
	}
	
	// Calculate time taken in seconds
	var timeTaken = gameTimerDuration; // Default to full timer duration
	
	if (typeof window.gameManager !== 'undefined' && window.gameManager) {
		// Get timer duration from game manager or global
		var timerDuration = gameTimerDuration;
		if (window.__GAME_SESSION__ && window.__GAME_SESSION__.timerDuration !== undefined) {
			timerDuration = parseInt(window.__GAME_SESSION__.timerDuration) || gameTimerDuration;
		} else if (window.__GAME_SESSION__ && window.__GAME_SESSION__.timer !== undefined) {
			timerDuration = parseInt(window.__GAME_SESSION__.timer) || gameTimerDuration;
		}
		
		if (window.gameManager.timeLeft !== undefined && window.gameManager.timeLeft > 0) {
			// Game ended early, calculate time taken
			timeTaken = timerDuration - window.gameManager.timeLeft;
			timeTaken = Math.ceil(timeTaken);
		} else if (window.gameManager.timeLeft !== undefined && window.gameManager.timeLeft <= 0) {
			// Timer reached 0, full timer duration
			timeTaken = timerDuration;
		}
	} else if (gameTimer !== undefined && gameTimer > 0) {
		// Game ended early, calculate time taken
		timeTaken = gameTimerDuration - gameTimer;
		timeTaken = Math.ceil(timeTaken);
	} else if (gameTimer !== undefined && gameTimer <= 0) {
		// Timer reached 0, full timer duration
		timeTaken = gameTimerDuration;
	}
	
	// Ensure time is at least 1 second and at most timer duration
	timeTaken = Math.max(1, Math.min(gameTimerDuration, timeTaken));
	
	// Use injected API server URL or default
	var baseUrl = apiServerUrl || 'https://api.metaninza.net';
	baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
	var url = baseUrl + '/api/v1/game-pools/' + poolId + '/sessions/' + sessionId + '/submit-score';
	var data = {
		score: currentScore,
		time: timeTaken
	};
	
	// Make API request
	fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + authToken
		},
		body: JSON.stringify(data)
	})
	.then(async response => {
		var responseData;
		try {
			responseData = await response.json();
		} catch (e) {
			responseData = {
				error: 'Failed to parse response',
				message: response.statusText || 'Unknown error',
				status: response.status
			};
		}
		
		if (!response.ok) {
			// Error - send to Flutter
			console.error('Error submitting score:', responseData);
			sendMessageToFlutter('scoreSubmitError', {
				status: response.status,
				error: responseData
			});
			// Mark submission complete and show back button
			scoreSubmitting = false;
			scoreSubmissionComplete = true;
			
			// Update UI immediately
			function updateGameOverUIError() {
				// Update UI - use direct DOM manipulation
				var gameOverTitle = document.querySelector(".game-over-title");
				if (gameOverTitle) {
					gameOverTitle.textContent = 'GAME OVER';
					console.log('Game over message updated to GAME OVER (error case)');
				}
				
				// Show back button
				var backButton = document.querySelector(".back-button");
				if (backButton) {
					backButton.style.display = '';
					console.log('Back button shown (error case)');
				}
				
				// Also try the function
				if (typeof updateGameOverMessage === 'function') {
					updateGameOverMessage('GAME OVER');
				}
				if (typeof showBackButton === 'function') {
					showBackButton();
				}
			}
			
			// Update immediately
			updateGameOverUIError();
			
			// Also update after delays to catch any race conditions
			setTimeout(updateGameOverUIError, 50);
			setTimeout(updateGameOverUIError, 200);
			setTimeout(updateGameOverUIError, 500);
			return;
		}
		
		// Success - send to Flutter
		console.log('Score submitted successfully:', responseData);
		sendMessageToFlutter('scoreSubmitSuccess', {
			status: response.status,
			data: responseData
		});
		
		// Mark submission complete and show back button
		scoreSubmitting = false;
		scoreSubmissionComplete = true;
		
		// Update UI immediately
		function updateGameOverUI() {
			// Update UI - use direct DOM manipulation
			var gameOverTitle = document.querySelector(".game-over-title");
			if (gameOverTitle) {
				gameOverTitle.textContent = 'GAME OVER';
				console.log('Game over message updated to GAME OVER');
			}
			
			// Show back button
			var backButton = document.querySelector(".back-button");
			if (backButton) {
				backButton.style.display = '';
				console.log('Back button shown');
			}
			
			// Also try the function
			if (typeof updateGameOverMessage === 'function') {
				updateGameOverMessage('GAME OVER');
			}
			if (typeof showBackButton === 'function') {
				showBackButton();
			}
		}
		
		// Update immediately
		updateGameOverUI();
		
		// Also update after a short delay to catch any race conditions
		setTimeout(updateGameOverUI, 50);
		setTimeout(updateGameOverUI, 200);
		setTimeout(updateGameOverUI, 500);
	})
	.catch(error => {
		// Network error
		console.error('Error submitting score:', error);
		var errorData = {
			error: 'Network error',
			message: error.message || 'Failed to submit score',
			status: 0
		};
		sendMessageToFlutter('scoreSubmitError', {
			status: 0,
			error: errorData
		});
		
		// Mark submission complete and show back button
		scoreSubmitting = false;
		scoreSubmissionComplete = true;
		
		// Update UI immediately
		function updateGameOverUINetwork() {
			// Update UI - use direct DOM manipulation
			var gameOverTitle = document.querySelector(".game-over-title");
			if (gameOverTitle) {
				gameOverTitle.textContent = 'GAME OVER';
				console.log('Game over message updated to GAME OVER (network error)');
			}
			
			// Show back button
			var backButton = document.querySelector(".back-button");
			if (backButton) {
				backButton.style.display = '';
				console.log('Back button shown (network error)');
			}
			
			// Also try the function
			if (typeof updateGameOverMessage === 'function') {
				updateGameOverMessage('GAME OVER');
			}
			if (typeof showBackButton === 'function') {
				showBackButton();
			}
		}
		
		// Update immediately
		updateGameOverUINetwork();
		
		// Also update after delays to catch any race conditions
		setTimeout(updateGameOverUINetwork, 50);
		setTimeout(updateGameOverUINetwork, 200);
		setTimeout(updateGameOverUINetwork, 500);
	});
}

// Function to check session and update UI
function checkSessionAndUpdateUI() {
	var wasReady = sessionReady;
	initFlutterParams();
	
	// If session just became ready, show the play button
	if (sessionReady && !wasReady) {
		// Show play button if on start screen
		if (typeof showPlayButton === 'function') {
			showPlayButton();
		}
	}
	
	// If session is not ready, keep checking periodically
	if (!sessionReady) {
		setTimeout(checkSessionAndUpdateUI, 500);
	}
}

// Initialize on page load
function initOnLoad() {
	initFlutterParams();
	
	// Update initial timer display if element exists
	updateTimerDisplay();
	
	// Check for session after a short delay
	setTimeout(function() {
		checkSessionAndUpdateUI();
	}, 100);
	
	// Also check on window load event
	window.addEventListener('load', function() {
		checkSessionAndUpdateUI();
	});
	
	// Start periodic checking if session not ready
	if (!sessionReady) {
		setTimeout(checkSessionAndUpdateUI, 500);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initOnLoad);
} else {
	initOnLoad();
}

// Re-initialize on visibility change (in case Flutter injects params later)
document.addEventListener('visibilitychange', function() {
	if (!document.hidden) {
		checkSessionAndUpdateUI();
		updateTimerDisplay();
	}
});

// Also listen for focus events
window.addEventListener('focus', function() {
	checkSessionAndUpdateUI();
	updateTimerDisplay();
});

