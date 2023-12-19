import React from "react";

export function Events({ events }) {
  return (
    <div className="">
      <p>Events from server:</p>
      <ul>
        {events.map((event, index) => (
          <li key={index}><pre>{JSON.stringify(event)}</pre></li>
        ))}
      </ul>
    </div>
  );
}
