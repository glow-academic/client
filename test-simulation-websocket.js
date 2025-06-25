const { io } = require("socket.io-client");

console.log("Testing Simulation WebSocket Events...");

const socket = io("http://localhost:8000", {
  transports: ["polling", "websocket"],
  timeout: 15000,
  query: {
    profileId: "test-profile-id",
    timestamp: Date.now(),
  },
});

socket.on("connect", () => {
  console.log("✅ Connected to server!");
  console.log("Socket ID:", socket.id);

  // Test dummy audio data (base64 encoded "Hello World" as audio)
  const dummyAudioBase64 =
    "UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAABAAEAAgACAA==";

  // Test 1: Start simulation
  console.log("\n📡 Testing start_simulation...");
  socket.emit("start_simulation", {
    simulation_id: "test-simulation-id",
    profile_id: "test-profile-id",
  });

  // Test 2: Send text message (after a delay)
  setTimeout(() => {
    console.log("\n📡 Testing send_message...");
    socket.emit("send_message", {
      chat_id: "test-chat-id",
      message: "Hello, this is a test message!",
    });
  }, 2000);

  // Test 3: Send audio message (after a delay)
  setTimeout(() => {
    console.log("\n📡 Testing send_audio...");
    socket.emit("send_audio", {
      chat_id: "test-chat-id",
      audio_data: dummyAudioBase64,
      audio_format: "wav",
    });
  }, 4000);

  // Test 4: Stop simulation (after a delay)
  setTimeout(() => {
    console.log("\n📡 Testing stop_simulation...");
    socket.emit("stop_simulation", {
      chat_id: "test-chat-id",
    });
  }, 6000);

  // Test 5: Continue simulation (after a delay)
  setTimeout(() => {
    console.log("\n📡 Testing continue_simulation...");
    socket.emit("continue_simulation", {
      chat_id: "test-chat-id",
      attempt_id: "test-attempt-id",
    });
  }, 8000);

  // Disconnect after all tests
  setTimeout(() => {
    console.log("\n🔌 Disconnecting...");
    socket.disconnect();
    process.exit(0);
  }, 10000);
});

socket.on("disconnect", (reason) => {
  console.log("❌ Disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.error("❌ Connection error:", error.message);
  process.exit(1);
});

// Listen for simulation-specific events
socket.on("simulation_started", (data) => {
  console.log("✅ Simulation started:", data);
});

socket.on("message_processing", (data) => {
  console.log("⏳ Message processing:", data);
});

socket.on("audio_transcribed", (data) => {
  console.log("🎤 Audio transcribed:", data);
});

socket.on("new_message", (data) => {
  console.log("💬 New message:", data);
});

socket.on("message_token", (data) => {
  console.log("🔤 Message token:", data.token);
});

socket.on("message_complete", (data) => {
  console.log("✅ Message complete:", data);
});

socket.on("simulation_stopped", (data) => {
  console.log("🛑 Simulation stopped:", data);
});

socket.on("simulation_continued", (data) => {
  console.log("➡️ Simulation continued:", data);
});

socket.on("error", (data) => {
  console.error("❌ Error:", data);
});

socket.on("message_error", (data) => {
  console.error("❌ Message error:", data);
});
