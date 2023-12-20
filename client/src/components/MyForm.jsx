import React, { useState } from "react";
import { socket } from "../socket";

export function MyForm() {
  const [value, setValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function onSubmit(event) {
    event.preventDefault();
    setIsLoading(true);

    socket.timeout(5000).emit("create-something", value, () => {
      setIsLoading(false);
    });
  }

  return (
    <form className="flex gap-4" onSubmit={onSubmit}>
      <input
        className="border p-1 rounded"
        onChange={(e) => setValue(e.target.value)}
      />

      <button
        className="bg-gray-200 py-2 px-4 rounded hover:bg-gray-100 active:bg-gray-300"
        type="submit"
        disabled={isLoading}
      >
        Submit to server
      </button>
    </form>
  );
}
