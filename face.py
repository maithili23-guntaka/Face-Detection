'''import cv2

face_data = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

webcam = cv2.VideoCapture(0)

if not webcam.isOpened():
    print("❌ Error: Webcam not found or cannot be opened.")
    exit()

while True:
    successful_frame_read, frame = webcam.read()
    
    if not successful_frame_read:
        print("⚠️ Couldn't read frame from webcam.")
        continue

    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    face_coordinates = face_data.detectMultiScale(gray_frame, scaleFactor=1.5, minNeighbors=5)

    for (x, y, w, h) in face_coordinates:
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 10)
    
    cv2.imshow('Face Detector', frame)

    # Press 'q' to quit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Clean up
webcam.release()
cv2.destroyAllWindows()'''

import cv2

face_data = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

webcam = cv2.VideoCapture(0)

while True:
    
    successful_frame_read, frame = webcam.read()
    # Convert the image to grayscale
    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Detect faces
    face_coordinates = face_data.detectMultiScale(gray_frame, scaleFactor=1.5, minNeighbors=5)

    # Draw rectangles around the faces
    for (x, y, w, h) in face_coordinates:
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 10)
    
    cv2.imshow('Face Detector', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
    