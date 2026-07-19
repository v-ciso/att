// Mock for next-auth
module.exports = {
  default: function NextAuth() {
    return { handlers: { GET: () => {}, POST: () => {} } };
  },
  getServerSession: async function() { return null; },
  signIn: async function() { return { error: null }; },
  signOut: async function() { return { error: null }; },
};