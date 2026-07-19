// Mock for next-auth/core
module.exports = {
  default: function() {
    return {
      handlers: { GET: () => {}, POST: () => {} },
    };
  },
};