"use client";
import Header from '../../components/Header';
import dynamic from 'next/dynamic';

const WorldMap = dynamic(() => import('../../components/WorldMap'), { ssr: false });

export default function Forum() {
  return (
    <div className="w-screen h-screen min-h-screen min-w-full bg-black text-white overflow-hidden">
      <Header />
      <div className="w-full h-full absolute top-0 left-0">
        <WorldMap />
      </div>
    </div>
  );
}