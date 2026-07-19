// Mock for next-auth/next
module.exports = {
  SessionProvider: function SessionProvider({ children }) {
    return children;
  },
  getServerSession: async function() { return null; },
  signIn: async function() { return { error: null }; },
  signOut: async function() { return { error: null }; },
};