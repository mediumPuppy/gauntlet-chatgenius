import { Link } from 'react-router-dom';

interface NavigationProps {
  showAuthButtons?: boolean;
}

export function Navigation({ showAuthButtons = false }: NavigationProps) {
  return (
    <nav className="bg-white border-b border-primary-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-primary-500 hover:text-primary-600 transition-colors">
              ChatGenius
            </Link>
          </div>
          {showAuthButtons && (
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-primary-600 hover:text-primary-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-primary-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-600 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 