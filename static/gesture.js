// Initialize MediaPipe Hands
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
  maxNumHands: 2,           // Detect up to 2 hands
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
hands.onResults(onResults);

// Start the camera
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const gestureElement = document.getElementById('gesture');

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 640,
  height: 480
});
camera.start();

// Helper function to calculate palm center
function calculatePalmCenter(landmarks, imageWidth, imageHeight) {
  const palmLandmarks = [0, 5, 9, 13, 17]; // wrist, index base, middle base, ring base, pinky base
  let sumX = 0;
  let sumY = 0;
  palmLandmarks.forEach(idx => {
    sumX += landmarks[idx].x * imageWidth;
    sumY += landmarks[idx].y * imageHeight;
  });
  return {x: sumX / palmLandmarks.length, y: sumY / palmLandmarks.length};
}

// Helper function to calculate hand size
function calculateHandSize(landmarks, imageWidth, imageHeight) {
  const wrist = {x: landmarks[0].x * imageWidth, y: landmarks[0].y * imageHeight};
  const middleTip = {x: landmarks[12].x * imageWidth, y: landmarks[12].y * imageHeight};
  return Math.sqrt(Math.pow(wrist.x - middleTip.x, 2) + Math.pow(wrist.y - middleTip.y, 2));
}

// Helper function to calculate distance between two points
function calculateDistance(point1, point2) {
  return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
}

// Get finger states for single-hand gestures
function getFingerStates(landmarks, handedness) {
  const fingerStates = {};
  // Thumb
  const thumbTip = landmarks[4];
  const thumbMcp = landmarks[2];
  fingerStates.thumb = handedness === 'Right' ? thumbTip.x < thumbMcp.x : thumbTip.x > thumbMcp.x;
  // Other fingers
  const fingers = ['index', 'middle', 'ring', 'pinky'];
  const fingerIndices = [[8, 6], [12, 10], [16, 14], [20, 18]]; // [tip, pip]
  fingers.forEach((finger, i) => {
    const [tipIdx, pipIdx] = fingerIndices[i];
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    fingerStates[finger] = tip.y < pip.y; // Finger up if tip is above pip
  });
  return fingerStates;
}

// Classify single-hand gestures
function classifyGesture(fingerStates) {
  if (fingerStates.thumb && !fingerStates.index && !fingerStates.middle && !fingerStates.ring && !fingerStates.pinky) {
    return 'Thumbs Up';
  } else if (!fingerStates.thumb && fingerStates.index && fingerStates.middle && !fingerStates.ring && !fingerStates.pinky) {
    return 'Peace Sign';
  } else if (!fingerStates.thumb && !fingerStates.index && !fingerStates.middle && !fingerStates.ring && !fingerStates.pinky) {
    return 'Fist';
  } else if (fingerStates.thumb && fingerStates.index && fingerStates.middle && fingerStates.ring && fingerStates.pinky) {
    return 'Open Hand';
  } else {
    return 'Unknown';
  }
}

// Process detection results
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  const imageWidth = canvasElement.width;
  const imageHeight = canvasElement.height;

  if (results.multiHandLandmarks && results.multiHandLandmarks.length === 2) {
    // Two hands detected
    const hand1 = results.multiHandLandmarks[0];
    const hand2 = results.multiHandLandmarks[1];
    const palmCenter1 = calculatePalmCenter(hand1, imageWidth, imageHeight);
    const palmCenter2 = calculatePalmCenter(hand2, imageWidth, imageHeight);
    const handSize1 = calculateHandSize(hand1, imageWidth, imageHeight);
    const handSize2 = calculateHandSize(hand2, imageWidth, imageHeight);
    const distance = calculateDistance(palmCenter1, palmCenter2);
    const averageHandSize = (handSize1 + handSize2) / 2;

    if (distance < 0.5 * averageHandSize) {
      gestureElement.textContent = 'Gesture: Clap';
    } else {
      const gesture1 = classifyGesture(getFingerStates(hand1, results.multiHandedness[0].label));
      const gesture2 = classifyGesture(getFingerStates(hand2, results.multiHandedness[1].label));
      gestureElement.textContent = `Left: ${gesture1}, Right: ${gesture2}`;
    }
  } else if (results.multiHandLandmarks && results.multiHandLandmarks.length === 1) {
    // One hand detected
    const landmarks = results.multiHandLandmarks[0];
    const handedness = results.multiHandedness[0].label;
    const fingerStates = getFingerStates(landmarks, handedness);
    const gesture = classifyGesture(fingerStates);
    gestureElement.textContent = `Gesture: ${gesture}`;
  } else {
    // No hands detected
    gestureElement.textContent = 'Gesture: None';
  }

  // Draw landmarks
  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 5});
      drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 2});
    }
  }
  canvasCtx.restore();
}