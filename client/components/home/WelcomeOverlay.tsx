/**
 * WelcomeOverlay.tsx
 * This is the welcome overlay component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

export default function WelcomeOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50  z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome to Glow! 🌟
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg
                className="w-6 h-6 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {/* My Cohorts Section */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                📚 My Cohorts
              </h3>
              <p className="text-blue-800 dark:text-blue-200">
                These are like quizzes and this is what you get graded on. You
                will have a "x" amount of students to interact with in a "y"
                number of minutes. You will keep retaking these cohorts until
                you get a passing score.
              </p>
            </div>

            {/* Default Simulations Section */}
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                🎯 Default Simulations
              </h3>
              <p className="text-green-800 dark:text-green-200">
                These are practice simulations with a specific type of student.
                You have unlimited time for these and you still get a score, but
                it doesn't go into the gradebook.
              </p>
            </div>

            {/* History Section */}
            <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
                📊 History
              </h3>
              <p className="text-purple-800 dark:text-purple-200">
                This will show your previous interactions and you can see how
                you did in previous cohorts and simulations. You can click on
                individual ones to go and see exactly what you said, and you can
                also filter by various characteristics to try and find a
                particular conversation you may have had.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
