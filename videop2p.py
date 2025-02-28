import socket
import threading
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
import os
from video_handler import VideoHandler

# Generate RSA key pair for a user
def generate_keys():
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    public_key = private_key.public_key()
    return private_key, public_key

# Serialize public key to share it
def serialize_public_key(public_key):
    return public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )

# Deserialize public key received from another user
def deserialize_public_key(pem_data):
    return serialization.load_pem_public_key(pem_data, backend=default_backend())

# Encrypt a message with a public key
def encrypt_message(public_key, message):
    encrypted = public_key.encrypt(
        message.encode(),
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    return encrypted

# Decrypt a message with a private key
def decrypt_message(private_key, encrypted_message):
    decrypted = private_key.decrypt(
        encrypted_message,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    return decrypted.decode()

# Server to listen for incoming messages
def start_server(username, private_key, known_peers):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(('0.0.0.0', 5555))  # Listen on all interfaces, port 5555
    server.listen(5)
    print(f"{username} listening on port 5555...")

    while True:
        client, addr = server.accept()
        threading.Thread(target=handle_client, args=(client, private_key, known_peers)).start()

# Handle incoming messages
def handle_client(client, private_key, known_peers):
    data = client.recv(4096)
    if data:
        sender, encrypted_msg = data.split(b"|", 1)
        sender = sender.decode()
        decrypted_msg = decrypt_message(private_key, encrypted_msg)
        print(f"Message from {sender}: {decrypted_msg}")
    client.close()

# Send a message to a peer
def send_message(sender, recipient, message, private_key, known_peers):
    if recipient not in known_peers:
        print(f"Error: {recipient} not in known peers.")
        return

    recipient_public_key = deserialize_public_key(known_peers[recipient])
    encrypted_msg = encrypt_message(recipient_public_key, message)
    
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client.connect(('localhost', 5555))  # Replace 'localhost' with recipient's IP in a real scenario
    client.send(f"{sender}|".encode() + encrypted_msg)
    client.close()
    print(f"Sent to {recipient}: {message}")

# Main function to run the messenger
def main():
    username = input("Enter your username: ")
    private_key, public_key = generate_keys()
    serialized_pub_key = serialize_public_key(public_key)
    
    # Display user's public key
    print("\nYour public key (share this with others):")
    print(serialized_pub_key.decode())
    
    # Dictionary to store known peers' public keys
    known_peers = {}

    # Start the server in a separate thread
    threading.Thread(target=start_server, args=(username, private_key, known_peers), daemon=True).start()

    # Simulate adding a peer (in reality, you'd exchange public keys manually or through a trusted method)
    peer_username = input("Enter a peer username to add: ")
    peer_public_key = input(f"Enter {peer_username}'s public key (PEM format, for this demo paste manually): ").encode()
    known_peers[peer_username] = peer_public_key

    # Initialize video handler
    video_handler = VideoHandler(username, private_key, known_peers)
    threading.Thread(target=video_handler.start_video_server, daemon=True).start()

    # Main loop
    while True:
        print("\nOptions:")
        print("1. Send message")
        print("2. Start video call")
        print("3. Stop video call")
        print("4. Exit")
        choice = input("Choose an option (1-4): ")

        if choice == '1':
            recipient = input("Enter recipient username: ")
            message = input("Enter your message: ")
            send_message(username, recipient, message, private_key, known_peers)
        elif choice == '2':
            recipient = input("Enter recipient username for video call: ")
            print("Starting video call... Press 'q' in video window to stop")
            video_handler.start_video_stream(recipient)
        elif choice == '3':
            video_handler.stop_video_stream()
            video_handler.stop_receiving()
            print("Video call stopped")
        elif choice == '4':
            break

if __name__ == "__main__":
    print("Simple Encrypted Messenger (No Phone Number Required)")
    main()