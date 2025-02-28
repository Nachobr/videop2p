import cv2
import numpy as np
import socket
import threading
import pickle
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes

class VideoHandler:
    def __init__(self, username, private_key, known_peers, video_port=5556):
        self.username = username
        self.private_key = private_key
        self.known_peers = known_peers
        self.video_port = video_port
        self.streaming = False
        self.receiving = False

    def start_video_server(self):
        """Start a server to receive video streams"""
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.bind(('0.0.0.0', self.video_port))
        server.listen(5)
        print(f"Video server listening on port {self.video_port}...")

        while True:
            client, addr = server.accept()
            threading.Thread(target=self._handle_video_client, args=(client,)).start()

    def _handle_video_client(self, client):
        """Handle incoming video stream from a peer"""
        try:
            # Receive sender information
            header = client.recv(1024)
            sender = header.decode()
            
            self.receiving = True
            cv2.namedWindow(f"Video from {sender}")

            while self.receiving:
                # Receive encrypted frame size
                size_data = client.recv(4)
                if not size_data:
                    break
                frame_size = int.from_bytes(size_data, 'big')

                # Receive encrypted frame data
                frame_data = b''
                while len(frame_data) < frame_size:
                    chunk = client.recv(min(frame_size - len(frame_data), 8192))
                    if not chunk:
                        break
                    frame_data += chunk

                # Decrypt and display frame
                try:
                    decrypted_data = self.private_key.decrypt(
                        frame_data,
                        padding.OAEP(
                            mgf=padding.MGF1(algorithm=hashes.SHA256()),
                            algorithm=hashes.SHA256(),
                            label=None
                        )
                    )
                    frame = pickle.loads(decrypted_data)
                    cv2.imshow(f"Video from {sender}", frame)
                    
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                except Exception as e:
                    print(f"Error decrypting frame: {e}")
                    break

        finally:
            self.receiving = False
            cv2.destroyAllWindows()
            client.close()

    def start_video_stream(self, recipient):
        """Start streaming video to a specific recipient"""
        if recipient not in self.known_peers:
            print(f"Error: {recipient} not in known peers.")
            return

        # Get recipient's public key
        recipient_public_key = serialization.load_pem_public_key(
            self.known_peers[recipient],
            backend=default_backend()
        )

        # Initialize video capture
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("Error: Could not open video capture device")
            return

        try:
            # Connect to recipient's video server
            client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client.connect(('localhost', self.video_port))  # Replace with actual IP in real scenario
            client.send(self.username.encode())

            self.streaming = True
            while self.streaming and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                # Compress frame before encryption
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                frame_data = pickle.dumps(buffer)

                # Encrypt frame
                encrypted_data = recipient_public_key.encrypt(
                    frame_data,
                    padding.OAEP(
                        mgf=padding.MGF1(algorithm=hashes.SHA256()),
                        algorithm=hashes.SHA256(),
                        label=None
                    )
                )

                # Send encrypted frame size and data
                size_bytes = len(encrypted_data).to_bytes(4, 'big')
                client.send(size_bytes)
                client.send(encrypted_data)

                # Show local preview
                cv2.imshow('Local Preview', frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

        finally:
            self.streaming = False
            cap.release()
            cv2.destroyAllWindows()
            client.close()

    def stop_video_stream(self):
        """Stop the video stream"""
        self.streaming = False

    def stop_receiving(self):
        """Stop receiving video"""
        self.receiving = False