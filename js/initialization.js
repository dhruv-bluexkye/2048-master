// Flutter integration variables
var poolId = null;
var sessionId = null;
var authToken = null;
var gameStartTime = null;
var gameTimerDuration = 180; // Default timer duration in seconds (will be overridden by Flutter)
var apiServerUrl = 'https://api.metaninza.net'; // Default API server URL

// Get URL parameters for Flutter integration (fallback method)
function getUrlParameter(name) {
	name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
	var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
	var results = regex.exec(location.search);
	return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Update timer display from current session or global variable
function updateTimerDisplay() {
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
	
	setTimeout(function() {
		var timerContainer = document.querySelector(".timer-container");
		if (timerContainer) {
			timerContainer.textContent = timerDuration;
		}
	}, 100);
}

// Initialize Flutter parameters - priority: window.__GAME_SESSION__ > URL params > postMessage
function initFlutterParams() {
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
					gameTimerDuration = parseInt(event.data.timerDuration) || 180;
				}
				if (event.data.apiServerUrl || event.data.apiServer) {
					apiServerUrl = event.data.apiServerUrl || event.data.apiServer;
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
	
	// Log for debugging
	if (sessionId && authToken) {
		console.log('Flutter session initialized successfully', {
			poolId: poolId,
			sessionId: sessionId,
			timerDuration: gameTimerDuration,
			apiServerUrl: apiServerUrl
		});
	} else {
		console.log('Flutter session parameters not found - game will run without score submission');
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
function submitScoreToFlutter(score, timeTaken) {
	console.log('submitScoreToFlutter called with score:', score, 'timeTaken:', timeTaken);
	console.log('Checking parameters - poolId:', poolId, 'sessionId:', sessionId, 'authToken:', authToken ? 'exists' : 'null');
	
	// Check if required parameters are available
	if (!poolId || !sessionId || !authToken) {
		console.log('Flutter parameters not available. Score not submitted.');
		console.log('Missing: poolId=' + !poolId + ', sessionId=' + !sessionId + ', authToken=' + !authToken);
		return;
	}
	
	// Get current timer duration for validation
	var currentTimerDuration = 180; // Default
	if (window.__GAME_SESSION__ && window.__GAME_SESSION__.timerDuration !== undefined) {
		currentTimerDuration = parseInt(window.__GAME_SESSION__.timerDuration) || 180;
	} else if (window.__GAME_SESSION__ && window.__GAME_SESSION__.timer !== undefined) {
		currentTimerDuration = parseInt(window.__GAME_SESSION__.timer) || 180;
	} else if (typeof gameTimerDuration !== 'undefined' && gameTimerDuration) {
		currentTimerDuration = gameTimerDuration;
	}
	
	// Ensure time is at least 1 second and at most timer duration
	timeTaken = Math.max(1, Math.min(currentTimerDuration, timeTaken));
	console.log('Time validation - timeTaken:', timeTaken, 'timerDuration:', currentTimerDuration);
	
	// Use injected API server URL or default
	var baseUrl = apiServerUrl || 'https://api.metaninza.net';
	// Remove trailing slash if present
	baseUrl = baseUrl.replace(/\/$/, '');
	var url = baseUrl + '/api/v1/game-pools/' + poolId + '/sessions/' + sessionId + '/submit-score';
	var data = {
		score: score,
		time: timeTaken
	};
	
	console.log('Submitting score to API:', url);
	console.log('Request data:', JSON.stringify(data));
	
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
		// Try to parse response as JSON (works for both success and error)
		var responseData;
		try {
			responseData = await response.json();
		} catch (e) {
			// If JSON parsing fails, create error object
			responseData = {
				error: 'Failed to parse response',
				message: response.statusText || 'Unknown error',
				status: response.status
			};
		}
		
		if (!response.ok) {
			// Non-200 status code - send error JSON to Flutter
			console.error('Error submitting score:', responseData);
			sendMessageToFlutter('scoreSubmitError', {
				status: response.status,
				error: responseData
			});
			return;
		}
		
		// Success - send success response to Flutter
		console.log('Score submitted successfully:', responseData);
		sendMessageToFlutter('scoreSubmitSuccess', {
			status: response.status,
			data: responseData
		});
	})
	.catch(error => {
		// Network error or other fetch error
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
	});
}

// Initialize on page load
function initOnLoad() {
	initFlutterParams();
	
	// Update initial timer display if element exists
	updateTimerDisplay();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initOnLoad);
} else {
	initOnLoad();
}

// Re-initialize on visibility change (in case Flutter injects params later)
document.addEventListener('visibilitychange', function() {
	if (!document.hidden) {
		initFlutterParams();
		updateTimerDisplay();
	}
});

// Also listen for focus events
window.addEventListener('focus', function() {
	initFlutterParams();
	updateTimerDisplay();
});

