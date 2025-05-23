"use client";
import { useEffect, useState } from "react";
import Header from '../../components/Header';

export default function Forum() {
  const [authorized, setAuthorized] = useState<null | boolean>(null);
  const [posts, setPosts] = useState([
    { id: 1, title: "Welcome to the forum!", content: "Feel free to share your thoughts." },
    { id: 2, title: "Forum Rules", content: "Please be respectful to others." },
    // Add more posts as needed
  ]);

  // Check for session cookie on client side
  useEffect(() => {
    async function checkSession() {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.valid) {
        window.location.href = '/';
      } else {
        setAuthorized(true);
      }
    }
    checkSession();
  }, []);

  if (authorized === null) {
    // Show nothing or a loading spinner while checking session
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Checking session...</div>;
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Header />
      <div className="flex flex-col items-center justify-center flex-grow ml-64">
        <div className="w-full max-w-2xl mt-4">
          {posts.map((post) => (
            <div key={post.id} className="border-b border-gray-300 py-4">
              <h2 className="text-2xl font-semibold">{post.title}</h2>
              <p className="mt-2">{post.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}