import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 font-mono p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-black border-2 border-white rounded-none shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b-2 border-white">
          <div className="flex-1 pr-4">
            <div className="text-blue-400 font-mono uppercase tracking-widest text-xs mb-2">PLATFORM INFORMATION</div>
            <h2 className="text-xl font-mono uppercase tracking-wider text-white flex items-center">
              <FontAwesomeIcon icon={faInfoCircle} className="mr-3" />
              POLMATCH COMMUNITY HUB
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-black text-red-400 border border-red-400 rounded-none hover:bg-red-400 hover:text-black transition-all shadow-lg font-mono flex-shrink-0"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Description */}
          <div className="bg-black border border-gray-400 rounded-none p-4 shadow-lg">
            <div className="text-white font-mono leading-relaxed">
              The Polmatch Community Hub was developed to facilitate the networking of people who share our concerns about the future of the Western world, and those who want to find friends or join communities with others of like mind.
            </div>
          </div>

          <div className="bg-black border border-gray-400 rounded-none p-4 shadow-lg">
            <div className="text-white font-mono leading-relaxed">
              Our social network was designed to help people find each other in the real world, while at the same time giving care to users&apos; privacy and security, allowing users to mask their identity with multiple profiles and aliases.
            </div>
          </div>

          <div className="bg-black border border-gray-400 rounded-none p-4 shadow-lg">
            <div className="text-white font-mono leading-relaxed">
              This improvised social network has been introduced due to the rapidly declining social and economic situation in our Western world, and the limitations of other popular social networking sites.
            </div>
          </div>

          <div className="bg-black border border-gray-400 rounded-none p-4 shadow-lg">
            <div className="text-white font-mono leading-relaxed">
              This platform is a necessary tool to help people effectively organize the actualization of their own ideas, initiatives, and plans, allowing them to find the type of quality people which they need.
            </div>
          </div>

          <div className="bg-black border border-gray-400 rounded-none p-4 shadow-lg">
            <div className="text-white font-mono leading-relaxed">
              This platform is an opportunity and it will work if we will be smart enough to appreciate what it provides and use it.
            </div>
          </div>

          {/* Video Links */}
          <div className="bg-black border-2 border-blue-400 rounded-none p-4 shadow-lg">
            <div className="text-blue-400 font-mono uppercase tracking-widest text-xs mb-3">INSTRUCTIONAL VIDEOS</div>
            <div className="space-y-3">
              <div className="text-white font-mono">
                <span className="text-gray-400">Who is this Platform for and why do we need it?</span>
                <br />
                <a 
                  href="https://youtu.be/2940q2fdjAs" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline break-all"
                >
                  https://youtu.be/2940q2fdjAs
                </a>
              </div>
              
              <div className="text-white font-mono">
                <span className="text-gray-400">General Summary and How to Use:</span>
                <br />
                <a 
                  href="https://youtu.be/OZ6wUq2pP3k" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline break-all"
                >
                  https://youtu.be/OZ6wUq2pP3k
                </a>
              </div>
              
              <div className="text-white font-mono">
                <span className="text-gray-400">Is the Polmatch Platform safe?</span>
                <br />
                <a 
                  href="https://youtu.be/w3wyqqA45po" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline break-all"
                >
                  https://youtu.be/w3wyqqA45po
                </a>
              </div>
              
              <div className="text-white font-mono">
                <span className="text-gray-400">The video with the plan:</span>
                <br />
                <a 
                  href="https://youtu.be/d3Y4P8peVxY" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline break-all"
                >
                  https://youtu.be/d3Y4P8peVxY
                </a>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-black border-2 border-green-400 rounded-none p-4 shadow-lg">
            <div className="text-green-400 font-mono uppercase tracking-widest text-xs mb-3">CONTACT INFORMATION</div>
            <div className="space-y-3">
              <div className="text-white font-mono">
                <span className="text-gray-400">For general subjects and questions:</span>
                <br />
                <a 
                  href="mailto:contactorel01@gmail.com"
                  className="text-green-400 hover:text-green-300"
                >
                  contactorel01@gmail.com
                </a>
              </div>
              
              <div className="text-white font-mono">
                <span className="text-gray-400">To support:</span>
                <br />
                <a 
                  href="mailto:helporel01@gmail.com"
                  className="text-green-400 hover:text-green-300"
                >
                  helporel01@gmail.com
                </a>
                <span className="text-gray-400"> OR </span>
                <a 
                  href="mailto:orelsupport@protonmail.com"
                  className="text-green-400 hover:text-green-300"
                >
                  orelsupport@protonmail.com
                </a>
              </div>
              
              <div className="text-white font-mono">
                <span className="text-gray-400">For urgent matters:</span>
                <br />
                <a 
                  href="mailto:orelurgent@protonmail.com"
                  className="text-green-400 hover:text-green-300"
                >
                  orelurgent@protonmail.com
                </a>
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="bg-black border-2 border-yellow-400 rounded-none p-4 shadow-lg">
            <div className="text-yellow-400 font-mono uppercase tracking-widest text-xs mb-3">OFFICIAL CHANNELS</div>
            <div className="text-white font-mono">
              <span className="text-gray-400">I do not own any social media accounts except the one mentioned below:</span>
              <br /><br />
              <span className="text-gray-400">Youtube:</span>
              <br />
              <a 
                href="https://www.youtube.com/channel/UCLDPjq0bVvLg-CsRJAwnbgg" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-yellow-400 hover:text-yellow-300 underline break-all"
              >
                https://www.youtube.com/channel/UCLDPjq0bVvLg-CsRJAwnbgg
              </a>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-red-900/20 border-2 border-red-400 rounded-none p-4 shadow-lg">
            <div className="text-red-400 font-mono uppercase tracking-widest text-xs mb-3">⚠ SECURITY NOTICE ⚠</div>
            <div className="text-white font-mono leading-relaxed">
              Please note: if someone posts controversial comments or material posing as me or any of our representatives from any other channel or any other platform, it&apos;s not me and it might be some bad guy spreading disinformation.
            </div>
          </div>

          {/* Pilot Testing Notice */}
          <div className="bg-blue-900/20 border-2 border-blue-400 rounded-none p-4 shadow-lg">
            <div className="text-blue-400 font-mono uppercase tracking-widest text-xs mb-3">PILOT TESTING RELEASE</div>
            <div className="text-white font-mono leading-relaxed">
              Please test all the mechanics without breaking the platform&apos;s rules (Terms of Service). If you find platform security holes please provide info in detail about them so we can patch them, also please note the current server is a temporary solution for the testing phase ONLY (we will rent our own servers later).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
