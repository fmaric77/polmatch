"use client";
import { useState } from "react";
import Header from '../../components/Header';

export default function Forum() {
  const [posts] = useState([
    { id: 1, title: "Welcome to the forum!", content: "Feel free to share your thoughts." },
    { id: 2, title: "Forum Rules", content: "Please be respectful to others." },
    // Add more posts as needed
  ]);

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Header />
      <div className="flex flex-col items-center justify-center flex-grow">
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