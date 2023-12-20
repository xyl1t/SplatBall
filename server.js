// const PORT = process.env.PORT ?? 8080;
const PORT = process.env.NODE_ENV === "production" ? 80 : 8080;
import express from "express";
const app = express();
import cors from "cors";
import * as http from "http";
const server = http.createServer(app);
import { Server } from "socket.io";
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // NOTE: for development
  },
});

app.use(express.static("client/dist"));
app.use(cors());

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.emit("foo", { hello: "world" });

  socket.on("create-something", (data) => {
    console.log("create-something", data);
  });

  socket.on("disconnect", (reason) => {
    console.log("a user disconnected, reason:", reason);
  });
});

// setInterval(() => {
// }, 30)

server.listen(PORT, () => {
  console.log(`Server running under http://127.0.0.1:${PORT}`);
});
