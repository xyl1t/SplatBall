import { socket } from "../socket";

export function ConnectionManager() {
  function connect() {
    socket.connect();
  }

  function disconnect() {
    socket.disconnect();
  }

  return (
    <div className="flex gap-4">
      <button
        className="bg-gray-200 py-2 px-4 rounded hover:bg-gray-100 active:bg-gray-300"
        onClick={connect}
      >
        Connect
      </button>
      <button
        className="bg-gray-200 py-2 px-4 rounded hover:bg-gray-100 active:bg-gray-300"
        onClick={disconnect}
      >
        Disconnect
      </button>
    </div>
  );
}
