import { Link } from 'react-router-dom';

const ChatIllustration = () => (
  <svg className="w-full h-full" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="250" cy="250" r="200" fill="url(#gradient)" fillOpacity="0.1"/>
    <path d="M150 150h200v120c0 11.046-8.954 20-20 20H170c-11.046 0-20-8.954-20-20V150z" fill="#0070cc" fillOpacity="0.2"/>
    <path d="M180 200h140M180 250h80" stroke="#0070cc" strokeWidth="20" strokeLinecap="round"/>
    <circle cx="320" cy="320" r="60" fill="#0c8ee3"/>
    <path d="M300 320h40M320 300v40" stroke="white" strokeWidth="8" strokeLinecap="round"/>
    <defs>
      <linearGradient id="gradient" x1="0" y1="0" x2="500" y2="500" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0070cc"/>
        <stop offset="1" stopColor="#00396b"/>
      </linearGradient>
    </defs>
  </svg>
);

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-primary-600">ChatGenius</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-6xl font-bold text-gray-900 leading-tight mb-6">
              Connect and Chat
              <span className="block text-primary-600">with Intelligence</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Experience the next generation of messaging with AI-powered features, 
              real-time communication, and seamless collaboration tools.
            </p>
            <div className="flex gap-4">
              <Link
                to="/signup"
                className="bg-primary-600 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-primary-700 transition-colors inline-flex items-center"
              >
                Get Started
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                to="/about"
                className="text-primary-600 px-8 py-4 rounded-lg text-lg font-medium hover:text-primary-700 transition-colors inline-flex items-center"
              >
                Learn More
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-50 to-transparent rounded-3xl transform rotate-3"></div>
            <div className="relative transform -rotate-3">
              <ChatIllustration />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 