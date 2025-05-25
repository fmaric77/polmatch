"use client";
import { useState } from "react";
import Navigation from '../../components/Navigation';

export default function Forum() {
  const [posts] = useState([
    { id: 1, title: "Welcome to the forum!", content: "Feel free to share your thoughts." },
    { id: 2, title: "Forum Rules", content: "Please be respectful to others." },
    // Add more posts as needed
  ]);

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="catalogs" />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="w-full max-w-2xl mx-auto mt-12 p-6">
          <div className="bg-black/80 border border-white rounded-lg shadow-lg p-6">
            <h1 className="text-3xl font-bold mb-6">Forum</h1>
            {posts.map((post) => (
              <div key={post.id} className="border-b border-gray-300 py-4">
                <h2 className="text-2xl font-semibold">{post.title}</h2>
                <p className="mt-2">{post.content}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}