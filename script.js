const video = document.getElementById('video');
const enrollButton = document.getElementById('enroll');
const recognizeButton = document.getElementById('recognize');
const exitButton = document.getElementById('exit');
const statusDiv = document.getElementById('status');
const enrolledList = document.getElementById('enrolledList');
const recognizedList = document.getElementById('recognizedList');

let labeledDescriptors = [];
let blinked = false;
let headMoved = false;
let livenessPassed = false;
let recognizing = false;
let streamRunning = false;

const EAR_THRESHOLD = 0.25;
const HEAD_MOVE_THRESHOLD = 20;
let initialNoseX = null;

let lastRecognized = null;
let lastRecognizedTime = 0;

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('./models')
]).then(() => {
  statusDiv.textContent = '✅ Models loaded. Click Enroll or Recognize to start.';
});

function startVideo() {
  if (streamRunning) return Promise.resolve();

  return navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => {
      video.srcObject = stream;
      streamRunning = true;
      video.play();
    })
    .catch(err => console.error(err));
}

video.addEventListener('playing', () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  canvas.id = "overlayCanvas";
  document.body.append(canvas);
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    if (!streamRunning) return;

    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detection) {
      const resized = faceapi.resizeResults(detection, displaySize);
      faceapi.draw.drawDetections(canvas, resized);
      faceapi.draw.drawFaceLandmarks(canvas, resized);

      const leftEye = resized.landmarks.getLeftEye();
      const rightEye = resized.landmarks.getRightEye();
      const ear = getEAR(leftEye, rightEye);

      if (ear < EAR_THRESHOLD && !blinked) {
        blinked = true;
        statusDiv.textContent = '👁️ Blink detected.';
      }

      const nose = resized.landmarks.getNose();
      const noseX = nose[3].x;

      if (initialNoseX === null) {
        initialNoseX = noseX;
      } else if (Math.abs(noseX - initialNoseX) > HEAD_MOVE_THRESHOLD && !headMoved) {
        headMoved = true;
        statusDiv.textContent += ' 🙆 Head movement detected.';
      }

      if (blinked && headMoved) {
        livenessPassed = true;
        statusDiv.textContent = '✅ Liveness confirmed (blink + head movement)';
      }

      if (recognizing && livenessPassed && labeledDescriptors.length > 0) {
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors);
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
        const box = resized.detection.box;

        ctx.strokeStyle = 'green';
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        ctx.fillStyle = 'green';
        ctx.font = '16px Arial';
        ctx.fillText(bestMatch.label, box.x, box.y - 10);

        // Facial features used
        const landmarks = resized.landmarks;
        const partsUsed = [];
        if (landmarks.getLeftEye()) partsUsed.push("👁️ Left Eye");
        if (landmarks.getRightEye()) partsUsed.push("👁️ Right Eye");
        if (landmarks.getNose()) partsUsed.push("👃 Nose");
        if (landmarks.getMouth()) partsUsed.push("👄 Mouth");
        if (landmarks.getJawOutline()) partsUsed.push("👂 Jawline");

        // Display in status div
        statusDiv.innerHTML = `
          🔍 <b>Recognized:</b> ${bestMatch.label}<br>
          🧠 <b>Features used:</b> ${partsUsed.join(", ")}
        `;

        // Recently recognized list (prevent rapid duplicates)
        const now = Date.now();
        if (bestMatch.label !== lastRecognized || (now - lastRecognizedTime) > 5000) {
          const li = document.createElement('li');
          li.textContent = `${bestMatch.label} (${new Date().toLocaleTimeString()})`;
          recognizedList.appendChild(li);

          while (recognizedList.children.length > 5) {
            recognizedList.removeChild(recognizedList.firstChild);
          }

          lastRecognized = bestMatch.label;
          lastRecognizedTime = now;
        }
      }
    }
  }, 300);
});

enrollButton.onclick = async () => {
  await startVideo();
  const descriptor = await getFaceDescriptor();
  if (descriptor) {
    const label = prompt('Enter your name:');
    if (!label || label.trim() === "") {
      statusDiv.textContent = '⚠️ Enrollment cancelled. Name is required.';
      return;
    }

    labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(label.trim(), [descriptor]));
    statusDiv.textContent = `✅ Face enrolled for ${label.trim()}.`;

    const li = document.createElement('li');
    li.textContent = label.trim();
    enrolledList.appendChild(li);
  } else {
    statusDiv.textContent = '❌ Face not detected.';
  }
};

recognizeButton.onclick = async () => {
  if (!livenessPassed) {
    statusDiv.textContent = '⚠️ Liveness check failed. Blink and move your head.';
    return;
  }
  await startVideo();
  recognizing = true;
};

exitButton.onclick = () => {
  const stream = video.srcObject;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  streamRunning = false;
  statusDiv.textContent = '🛑 Camera stopped.';
  blinked = false;
  headMoved = false;
  livenessPassed = false;
  initialNoseX = null;
  recognizing = false;
  lastRecognized = null;
  lastRecognizedTime = 0;
};

function getEAR(eye1, eye2) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const leftEAR = (dist(eye1[1], eye1[5]) + dist(eye1[2], eye1[4])) / (2.0 * dist(eye1[0], eye1[3]));
  const rightEAR = (dist(eye2[1], eye2[5]) + dist(eye2[2], eye2[4])) / (2.0 * dist(eye2[0], eye2[3]));
  return (leftEAR + rightEAR) / 2.0;
}

async function getFaceDescriptor() {
  const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks().withFaceDescriptor();
  return detection ? detection.descriptor : null;
}
