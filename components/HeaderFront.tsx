import React from 'react';
import Image from 'next/image';

const HeaderFront = () => {
  return (
    <header className="w-full bg-black text-white py-4 flex justify-between items-center px-6 border-b-2 border-white">
      <Image src="/images/polstrat-dark.png" alt="Polstrat Logo" width={128} height={48} className="h-12" />
    </header>
  );
};

export default HeaderFront;