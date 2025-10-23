import { createClient } from '@wix/sdk';
import { storage } from '@wix/storage';

// Initialize Wix client
const wixClient = createClient({
  modules: {
    storage: storage
  }
});

// Configure environment variables for different environments
const config = {
  development: {
    baseUrl: 'http://localhost:3000',
    wixDomain: 'localhost'
  },
  production: {
    baseUrl: process.env.WIX_DOMAIN,
    wixDomain: process.env.WIX_DOMAIN
  }
};

const env = process.env.NODE_ENV || 'development';

export default {
  ...config[env],
  wixClient
};
