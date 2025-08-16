"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShieldAlt, 
  faUsers, 
  faHeart, 
  faBriefcase, 
  faLock, 
  faGlobe,
  faComments,
  faUserSecret,
  faArrowRight,
  faCheck,
  faInfinity,
  faEye,
  faBolt
} from '@fortawesome/free-solid-svg-icons';

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Check if user is already logged in
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/session', {
          credentials: 'include'
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            setIsLoggedIn(true);
            // If logged in, redirect to frontpage
            router.push('/frontpage');
            return;
          }
        }
        setIsLoggedIn(false);
      } catch (error) {
        console.error('Session check failed:', error);
        setIsLoggedIn(false);
      }
    }
    checkSession();
  }, [router]);


  // Show loading while checking session
  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  // If logged in, show nothing (will redirect)
  if (isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white overflow-x-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-r from-green-600/10 to-blue-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 container mx-auto px-6 py-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Image 
                src="/images/polstrat-dark.png" 
                alt="Polmatch" 
                width={150} 
                height={56}
                className="max-w-full h-auto transition-transform hover:scale-105"
              />
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-lg blur opacity-0 hover:opacity-100 transition-opacity"></div>
            </div>
          </div>
          <div className="space-x-4">
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2 border-2 border-white bg-transparent text-white hover:bg-white hover:text-black transition-all duration-300 font-medium uppercase tracking-wider transform hover:scale-105"
            >
              Login
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-all duration-300 font-medium uppercase tracking-wider transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-white via-gray-300 to-white bg-clip-text text-transparent animate-pulse">
            Secure Private Messaging
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-12 leading-relaxed">
            Connect safely across <span className="text-blue-400 font-semibold">business</span>, 
            <span className="text-green-400 font-semibold"> general discussions</span>, and 
            <span className="text-pink-400 font-semibold"> love</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button
              onClick={() => router.push('/login')}
              className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-300 uppercase tracking-wider flex items-center justify-center gap-2 transform hover:scale-105 shadow-xl hover:shadow-2xl"
            >
              Start Messaging 
              <FontAwesomeIcon icon={faArrowRight} className="transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-8 py-4 border-2 border-white bg-transparent text-white text-lg font-medium hover:bg-white hover:text-black transition-all duration-300 uppercase tracking-wider transform hover:scale-105"
            >
              Learn More
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faShieldAlt} className="text-green-400" />
              <span>End-to-End Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faEye} className="text-blue-400" />
              <span>Zero Data Collection</span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faBolt} className="text-yellow-400" />
              <span>Lightning Fast</span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faInfinity} className="text-purple-400" />
              <span>Free Forever</span>
            </div>
          </div>
        </div>
      </section>


      {/* Features Section */}
      <section className="relative z-10 container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Built for Every Connection
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Whether you&apos;re closing deals, sharing ideas, or finding love, Polmatch provides the secure platform you need.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {/* Business */}
          <div className="group bg-gradient-to-b from-gray-800 to-gray-900 p-8 border border-gray-700 hover:border-blue-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-blue-500/50 transition-shadow">
                <FontAwesomeIcon icon={faBriefcase} className="text-2xl text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-blue-400 transition-colors">Business</h3>
              <p className="text-gray-400 mb-6 group-hover:text-gray-300 transition-colors">
                Secure conversations for professional networking, deal-making, and team collaboration with enterprise-grade encryption.
              </p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                  End-to-end encryption
                </li>
                <li className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                  Professional profiles
                </li>
                <li className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                  Group channels
                </li>
              </ul>
            </div>
          </div>

          {/* General Discussions */}
          <div className="group bg-gradient-to-b from-gray-800 to-gray-900 p-8 border border-gray-700 hover:border-green-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-green-500/50 transition-shadow">
                <FontAwesomeIcon icon={faUsers} className="text-2xl text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-green-400 transition-colors">General Discussions</h3>
              <p className="text-gray-400 mb-6 group-hover:text-gray-300 transition-colors">
                Connect with like-minded individuals, join communities, and engage in meaningful conversations on topics you care about.
              </p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                  Public & private groups
                </li>
                <li className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                  Topic-based channels
                </li>
                <li className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                  Community discovery
                </li>
              </ul>
            </div>
          </div>

          {/* Love */}
          <div className="group bg-gradient-to-b from-gray-800 to-gray-900 p-8 border border-gray-700 hover:border-pink-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-pink-600 to-pink-800 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-pink-500/50 transition-shadow">
                <FontAwesomeIcon icon={faHeart} className="text-2xl text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4 group-hover:text-pink-400 transition-colors">Love & Romance</h3>
              <p className="text-gray-400 mb-6 group-hover:text-gray-300 transition-colors">
                Find meaningful connections and build lasting relationships in a safe, private environment designed for authentic conversations.
              </p>
              <ul className="text-sm text-gray-300 space-y-2">
                <li className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                  Privacy-first matching
                </li>
                <li className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                  Secure messaging
                </li>
                <li className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCheck} className="text-green-400" />
                  Authentic profiles
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>



      {/* Privacy Comparison Section */}
      <section className="relative z-10 container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Your Data Stays <span className="text-green-400">Yours</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-12">
            Built for people who value <span className="text-green-400 font-semibold">digital sovereignty</span>. 
            Unlike other messaging platforms, we don&apos;t mine, sell, or store your personal data. 
            Your conversations are truly private.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6">
            {/* Polmatch */}
            <div className="bg-gradient-to-br from-green-800 to-green-900 p-6 rounded-2xl border-2 border-green-400 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-green-400 text-black px-3 py-1 text-xs font-bold rounded-bl-lg">
                BEST
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-400 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faShieldAlt} className="text-2xl text-black" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Polmatch</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} className="text-green-400 flex-shrink-0" />
                    <span className="text-green-100">Zero data collection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} className="text-green-400 flex-shrink-0" />
                    <span className="text-green-100">No data selling</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} className="text-green-400 flex-shrink-0" />
                    <span className="text-green-100">No ads or tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} className="text-green-400 flex-shrink-0" />
                    <span className="text-green-100">Full message encryption</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} className="text-green-400 flex-shrink-0" />
                    <span className="text-green-100">Anonymous profiles</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Discord */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-600">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-indigo-600 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faComments} className="text-2xl text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Discord</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Collects user data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Shares with partners</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Targeted advertising</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Messages not encrypted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Data retention</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Teams */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-600">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faBriefcase} className="text-2xl text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Teams</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Microsoft data mining</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Telemetry collection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">AI training data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Corporate surveillance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Data monetization</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Guilded */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-600">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-yellow-600 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faUsers} className="text-2xl text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Guilded</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Roblox owned data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Usage analytics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Data sharing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Basic encryption only</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <span className="text-red-300">Gaming focus tracking</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-2xl p-6 max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold text-green-400 mb-4 flex items-center justify-center gap-3">
                <FontAwesomeIcon icon={faShieldAlt} />
                Digital Sovereignty Matters
              </h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                Take control of your digital life. Your conversations, relationships, and personal data 
                should belong to you alone. Polmatch empowers individuals who refuse to compromise 
                their privacy and want true ownership of their communications.
              </p>
              <div className="mt-6 p-4 bg-green-900/20 border border-green-500/30 rounded-xl">
                <p className="text-green-300 font-semibold">
                  <FontAwesomeIcon icon={faShieldAlt} className="mr-2" />
                  Join the movement toward digital independence and privacy sovereignty.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="relative z-10 bg-gradient-to-r from-gray-900 to-black py-20">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Security First
              </h2>
              <p className="text-xl text-gray-400 mb-8">
                Your privacy is our priority. Every message, every connection, every moment is protected by military-grade encryption.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center gap-3 group">
                  <FontAwesomeIcon icon={faShieldAlt} className="text-2xl text-green-400 group-hover:scale-110 transition-transform" />
                  <span className="font-medium group-hover:text-green-400 transition-colors">End-to-End Encryption</span>
                </div>
                <div className="flex items-center gap-3 group">
                  <FontAwesomeIcon icon={faLock} className="text-2xl text-green-400 group-hover:scale-110 transition-transform" />
                  <span className="font-medium group-hover:text-green-400 transition-colors">Zero Data Retention</span>
                </div>
                <div className="flex items-center gap-3 group">
                  <FontAwesomeIcon icon={faUserSecret} className="text-2xl text-green-400 group-hover:scale-110 transition-transform" />
                  <span className="font-medium group-hover:text-green-400 transition-colors">Anonymous Profiles</span>
                </div>
                <div className="flex items-center gap-3 group">
                  <FontAwesomeIcon icon={faGlobe} className="text-2xl text-green-400 group-hover:scale-110 transition-transform" />
                  <span className="font-medium group-hover:text-green-400 transition-colors">Global Infrastructure</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-80 h-80 bg-gradient-to-br from-green-400/20 to-blue-400/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-gray-600 animate-pulse">
                  <FontAwesomeIcon icon={faShieldAlt} className="text-8xl text-white/80" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-blue-400/10 rounded-full animate-ping"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="relative z-10 container mx-auto px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Connect Securely?
          </h2>
          <p className="text-xl text-gray-400 mb-12">
            Join Polmatch for secure, private conversations built around your privacy.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/login')}
              className="group px-12 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-300 uppercase tracking-wider transform hover:scale-105 shadow-xl hover:shadow-2xl"
            >
              Get Started Free
              <FontAwesomeIcon icon={faArrowRight} className="ml-2 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            No credit card required • Free forever • Enterprise options available
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <Image 
                src="/images/polstrat-dark.png" 
                alt="Polmatch" 
                width={120} 
                height={45}
                className="max-w-full h-auto"
              />
              <span className="text-gray-400">Secure messaging for everyone</span>
            </div>
            <div className="text-gray-400 text-sm">
              © {new Date().getFullYear()} Polmatch. Built with privacy in mind.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}