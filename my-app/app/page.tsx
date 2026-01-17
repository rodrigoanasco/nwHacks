"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [msg, setMsg] = useState("loading...");

  useEffect(() => {
    fetch("/api/test")
      .then((r) => r.json())
      .then((data) => setMsg(data.message))
      .catch(() => setMsg("error"));
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Next.js + API Routes</h1>
      <p>API says: {msg}</p>
    </main>
  );
}
