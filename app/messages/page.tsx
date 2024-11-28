"use client";
import Header from '../../components/Header';
import Messages from '../../components/Messages';

export default function Forum() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Header />
      <Messages />
    </div>
  );
}