"use client";
import { useState } from "react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle login logic here
    console.log("Username:", username);
    console.log("Password:", password);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-4">
        <img src="/images/polstrat-dark.png" alt="Polstrat Dark" className="max-w-full h-auto mb-4" />
        <input
          type="text"
          placeholder="Email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="p-2 bg-black text-white border border-white rounded focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 bg-black text-white border border-white rounded focus:outline-none"
        />
        <button
          type="submit"
          className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
        >
          Login
        </button>
      </form>
    </div>
  );
}