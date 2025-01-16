import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "../contexts/OrganizationContext";
import { useAuth } from "../contexts/AuthContext";
import { PageTransition } from "../components/transitions/PageTransition";
import { Tooltip } from "../components/common/Tooltip";
import { motion, AnimatePresence } from "framer-motion";

export default function OrganizationOnboardingPage() {
  const [orgName, setOrgName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoinMode, setIsJoinMode] = useState(false);
  const { createOrganization, joinOrganization } = useOrganization();
  const navigate = useNavigate();
  const { token } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    if (isJoinMode && !inviteCode.trim()) return;
    if (!isJoinMode && !orgName.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      if (isJoinMode) {
        await joinOrganization(inviteCode.trim());
      } else {
        await createOrganization(orgName.trim());
      }
      navigate("/chat");
    } catch (error) {
      setError(isJoinMode ? "Failed to join organization" : "Failed to create organization");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const formVariants = {
    initial: { 
      opacity: 0, 
      x: 50,
    },
    animate: { 
      opacity: 1, 
      x: 0,
    },
    exit: { 
      opacity: 0, 
      x: -50,
    }
  } as const;

  return (
    <PageTransition
      transitionKey="onboarding-page"
    >
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        {/* Mode Toggle */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="flex items-center">
            <label className="mr-2 text-sm text-gray-600">
              {isJoinMode ? "Join Mode" : "Create Mode"}
            </label>
            <button
              onClick={() => setIsJoinMode(!isJoinMode)}
              className={`
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full 
                border-2 border-transparent transition-colors duration-200 ease-in-out 
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                ${isJoinMode ? "bg-primary-500" : "bg-gray-200"}
              `}
            >
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full 
                  bg-white shadow ring-0 transition duration-200 ease-in-out
                  ${isJoinMode ? "translate-x-5" : "translate-x-0"}
                `}
              />
            </button>
          </div>
          <Tooltip content={`Toggle between creating a new organization or joining an existing one with an invite code`}>
            <button className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
          </Tooltip>
        </div>

        <motion.div
          initial={false}
          animate={{ height: 'auto' }}
          className="sm:mx-auto sm:w-full sm:max-w-md"
        >
          <motion.h2 
            key={isJoinMode ? 'join' : 'create'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center text-3xl font-extrabold text-gray-900"
          >
            {isJoinMode ? "Join an Organization" : "Create Your Organization"}
          </motion.h2>
          <motion.p 
            key={isJoinMode ? 'join-desc' : 'create-desc'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-center text-sm text-gray-600"
          >
            {isJoinMode 
              ? "Enter an invite code to join an existing organization"
              : "Get started by creating your first organization"
            }
          </motion.p>
        </motion.div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <AnimatePresence mode="wait">
              <motion.form
                key={isJoinMode ? 'join-form' : 'create-form'}
                variants={formVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: "spring", duration: 0.4 }}
                onSubmit={handleSubmit}
                className="space-y-6 relative w-full"
              >
                <div>
                  <motion.label 
                    htmlFor={isJoinMode ? "inviteCode" : "orgName"}
                    className="block text-sm font-medium text-gray-700"
                  >
                    {isJoinMode ? "Invite Code" : "Organization Name"}
                  </motion.label>
                  <div className="mt-1">
                    <motion.input
                      layoutId="input-field"
                      id={isJoinMode ? "inviteCode" : "orgName"}
                      name={isJoinMode ? "inviteCode" : "orgName"}
                      type="text"
                      required
                      value={isJoinMode ? inviteCode : orgName}
                      onChange={(e) => isJoinMode 
                        ? setInviteCode(e.target.value)
                        : setOrgName(e.target.value)
                      }
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder={isJoinMode 
                        ? "Enter invite code" 
                        : "Enter organization name"
                      }
                    />
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-600 text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <motion.button
                  layoutId="submit-button"
                  type="submit"
                  disabled={isLoading || (isJoinMode ? !inviteCode.trim() : !orgName.trim())}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading 
                    ? (isJoinMode ? "Joining..." : "Creating...") 
                    : (isJoinMode ? "Join Organization" : "Create Organization")
                  }
                </motion.button>
              </motion.form>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
